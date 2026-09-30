import type { JSONContent } from "@tiptap/react";
import type { Entity } from "../types/entities";
import { CHOICE_OPTION_TYPE, DIALOGUE_LINE_TYPE } from "../types/nodeTypes";
import { nodeSpeaker, speakerName, PLAYER_SPEAKER } from "../types/speaker";
import { idAttrFor } from "./contentIds";
import type { Speaker } from "../types/speaker";

export const SPEAKER_LABEL_MARK = "speakerLabel";

/**
 * When a spoken line PRINTS its speaker's name, and when it doesn't.
 *
 * The rule: print the name whenever the speaker CHANGES, and not while the
 * same person keeps talking. It exists because of what Volkan chose for
 * Play Mode — the name inline, "MARA: line" — combined with Enter carrying
 * the speaker forward. Three sentences of one speech would otherwise read
 *
 *     MARA: I found it.
 *     MARA: Under the floor, where you said.
 *     MARA: You knew.
 *
 * which is how a script reads, not how a story does. Prose and Ink both
 * name the speaker once and let the paragraphs run; so does this.
 *
 * A run is broken by ANYTHING that isn't the same speaker still talking:
 * a line of narration, a heading, a divider, a Choice Block. That last one
 * matters most — a choice is a moment where the player acts, and whoever
 * was speaking before it cannot be assumed to still be speaking after.
 *
 * The editor and the runtime both drive this same object rather than each
 * implementing the rule, because two copies of "has the speaker changed"
 * would disagree the first time either side gained a block type.
 */
export function speakerRun(): {
  line: (speaker: Speaker) => boolean;
  breakRun: () => void;
} {
  let last: Speaker = null;
  return {
    line(speaker) {
      const show = Boolean(speaker) && speaker !== last;
      last = speaker;
      return show;
    },
    breakRun() {
      last = null;
    },
  };
}

/**
 * The runtime's speaker pass: a copy of the document in which every line
 * that should announce its speaker has the name PREPENDED AS REAL INLINE
 * CONTENT, marked `speakerLabel`.
 *
 * Done as a document transform rather than as a rendering flourish because
 * of how Play Mode renders prose: one `generateHTML` call per run of
 * ordinary content (see runtime/documentSegments.ts). There is no React
 * component per paragraph to hang a prefix on, and a CSS `::before` reading
 * an attribute couldn't express "only when the speaker changes" without
 * inventing a second attribute for the answer. Putting the name in the
 * content instead means the existing pipeline renders it with no new path —
 * the same reason a choice's label became real text in v0.32.0.
 *
 * It also makes choices work for free: a Choice Block's option is rendered
 * through that same `generateHTML` pass (see choiceRuntimeBlock's Label),
 * so an option that carries a speaker arrives at the button already
 * wearing the name — the Disco Elysium reading Volkan asked for, where the
 * choices themselves are voices rather than a neutral menu.
 *
 * Run AFTER `resolveMentions`, on the resolved copy: both are per-render
 * passes over a document nobody is editing.
 */
export function applySpeakerPrefixes(
  content: JSONContent | undefined | null,
  entities: Entity[],
  /** What this story calls its player; "You" when it has not said (v0.75.0). */
  playerName?: string | null,
): JSONContent {
  const EMPTY: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };
  if (!content) return EMPTY;
  const run = speakerRun();

  function prefixed(node: JSONContent, name: string): JSONContent {
    return {
      ...node,
      content: [
        {
          type: "text",
          text: `${name}: `,
          marks: [{ type: SPEAKER_LABEL_MARK }],
        },
        ...(node.content ?? []),
      ],
    };
  }

  /**
   * Does this node actually say anything?
   *
   * Not `content.length`, which counts children rather than words: a
   * paragraph holding one empty text node, or nothing but a hard break,
   * has content and is still blank on the page.
   */
  function hasVisibleText(node: JSONContent): boolean {
    for (const child of node.content ?? []) {
      if (typeof child.text === "string") {
        if (child.text.length > 0) return true;
        continue;
      }
      if (child.type === "hardBreak") continue;
      // Anything else — a mention, an image — is something the reader sees.
      return true;
    }
    return false;
  }

  function walk(node: JSONContent): JSONContent {
    if (node.type === "paragraph") {
      // An empty spoken line gets no prefix — a name with nothing after it
      // is the writer's scaffolding showing through — and, just as
      // importantly, it must not COUNT as the line that opened the run.
      //
      // Until v0.49.0 this check sat after `run.line(speaker)`, which
      // mutates the run's memory of who spoke last. So a blank paragraph
      // still carrying a speaker consumed the start of that speaker's run
      // and the name never appeared at all. Measured:
      //
      //   "Rain on the glass."  /  (blank, speaker Mara)  /  "I found it."
      //   → ["Rain on the glass.", "", "I found it."]     ← no "Mara:"
      //
      // Reachable by pressing Enter on a spoken line, since `keepOnSplit`
      // carries the speaker onto the new paragraph — so a writer who left
      // a blank line between two speeches lost the attribution on the line
      // after it, in Play Mode and in the export both.
      //
      // Emptiness is measured in TEXT, not in the length of the content
      // array: a paragraph whose only child is an empty text node or a
      // hard break has content and still says nothing, and that case used
      // to print a bare "Mara: " with nothing after it.
      if (!hasVisibleText(node)) return node;

      const speaker = nodeSpeaker(node.attrs);
      const name = run.line(speaker) ? speakerName(speaker, entities, playerName) : null;
      if (!name) return node;
      return prefixed(node, name);
    }

    if (node.type === CHOICE_OPTION_TYPE) {
      // A choice is its own object on screen, in its own box, read at a
      // moment when the player is choosing rather than reading — so it
      // always names its speaker if it has one. Suppressing it to match a
      // neighbouring line would be answering a question nobody asked.
      const name = speakerName(nodeSpeaker(node.attrs), entities, playerName);
      if (!name || !hasVisibleText(node)) return node;
      return prefixed(node, name);
    }

    // Anything that isn't a spoken line ends the run — a heading, a
    // divider, a Choice Block, a line of narration. (`doc` is the wrapper,
    // not a thing in the story; text nodes are never reached, since a
    // paragraph returns above without descending.)
    if (node.type && node.type !== "doc") run.breakRun();

    if (!node.content) return node;
    return { ...node, content: node.content.map(walk) };
  }

  return walk(content);
}

/**
 * Where a speaker is referred to — the four places, in one list (v0.76.0).
 *
 * WHY A SHARED WALK. A `Speaker` is stored in four slots, and they were
 * added at four different times: a paragraph's attribute (v0.37.0), a
 * choice option's (v0.37.0), and a Dialogue line's two, its own and its
 * reply's (v0.66.0). Nothing had ever enumerated them, so every feature
 * that wanted "who speaks in this story" either walked three of the four
 * or invented its own list — and the reply is the one that gets missed,
 * because it is an attribute of a line rather than a line of its own.
 *
 * The siblings rule says anything drawn for the Choice is drawn for the
 * Dialogue too. It applies to what the app KNOWS as much as to what it
 * draws: a check that finds a broken speaker in a choice and not in a
 * conversation is the same defect wearing a different coat.
 *
 * `@player` is not a reference to anything — it resolves through the
 * story's own player name and cannot dangle — so it is left out here
 * rather than filtered by every caller.
 */
export interface SpeakerReference {
  /** The entity id referred to. Never `null`, never `"@player"`. */
  entityId: string;
  /** Which slot it came from, for wording a report. */
  slot: "line" | "choice" | "dialogue" | "reply";
  /** The nearest id that can be selected — a block or a line. */
  anchorId: string | null;
}

export function speakerReferences(
  content: JSONContent | undefined | null,
): SpeakerReference[] {
  const found: SpeakerReference[] = [];
  if (!content) return found;

  const take = (
    raw: unknown,
    slot: SpeakerReference["slot"],
    anchorId: string | null,
  ): void => {
    // `nodeSpeaker` normalises "" and undefined to null; `@player` is the
    // one non-null value that points at nobody.
    const speaker = nodeSpeaker({ speaker: raw });
    if (!speaker || speaker === PLAYER_SPEAKER) return;
    found.push({ entityId: speaker, slot, anchorId });
  };

  (function walk(node: JSONContent): void {
    // `idAttrFor`, NOT `node.attrs.id` (v0.77.0 — this was wrong in
    // v0.76.0 and shipped). No node type in this app stores its id under
    // `id`: a paragraph and a Dialogue line use `lineId`, an option
    // `optionId`, both block kinds `blockId`. So every anchor this
    // returned was null in a real document, every speaker finding lost
    // its blockId, and the row that was supposed to point at the first
    // affected line pointed at the scene.
    //
    // The v0.76.0 spec passed because its fixture wrote `attrs.id` by
    // hand — it was testing the fixture, not the app. contentIds.ts has
    // held the mapping since v0.69.0 and its own comment calls it "one
    // namespace for all five"; the fix is to ask it.
    const attr = idAttrFor(node.type);
    const raw = attr ? node.attrs?.[attr] : undefined;
    const id = typeof raw === "string" ? raw : null;
    if (node.type === "paragraph") take(node.attrs?.speaker, "line", id);
    else if (node.type === CHOICE_OPTION_TYPE) take(node.attrs?.speaker, "choice", id);
    else if (node.type === DIALOGUE_LINE_TYPE) {
      take(node.attrs?.speaker, "dialogue", id);
      // The reply's speaker is a second reference on the SAME node, which
      // is exactly why a walk written per-node rather than per-slot loses
      // it. Both are reported, because both print a name on the page.
      take(node.attrs?.replySpeaker, "reply", id);
    }
    node.content?.forEach(walk);
  })(content);

  return found;
}

/**
 * What deleting this entity would cost — how many lines lose their name,
 * and across how many scenes (v0.76.0).
 *
 * WHY THIS IS A TOAST AND NOT A CONFIRM. `confirmDialogStore`'s own note
 * has said since v0.26.0 that a modal earns its interruption only while
 * the mistake is permanent, and deleting a character has not been
 * permanent since v0.25.0 — the undo toast is already there. So the fix
 * is not to stop the writer, it is to stop the toast being vague: the
 * thing they do not know is not that they pressed Delete, it is that Mara
 * was speaking in three scenes they have not opened this week.
 *
 * Counted in REFERENCES rather than lines, the same as the report: a
 * Dialogue line whose reply is spoken by the same character loses two
 * names, and the sentence has to be true.
 */
export function speakerImpact(
  scenes: { id: string; content?: JSONContent | null }[],
  entityId: string,
): { references: number; scenes: number } {
  let references = 0;
  let touched = 0;
  scenes.forEach((scene) => {
    const here = speakerReferences(scene.content).filter((r) => r.entityId === entityId).length;
    if (here === 0) return;
    references += here;
    touched += 1;
  });
  return { references, scenes: touched };
}

/**
 * That impact as the sentence the toast adds, or "" when there is none.
 *
 * Returns the whole clause rather than the numbers so the wording lives in
 * one place: two call sites delete an entity (the Delete key and the
 * context menu), and ContentBrowser's own comment says no way of deleting
 * something should be quieter than another.
 */
export function deletedSpeakerNote(
  scenes: { id: string; content?: JSONContent | null }[],
  entityId: string,
): string {
  const { references, scenes: count } = speakerImpact(scenes, entityId);
  if (references === 0) return "";
  const lines = `${references} ${references === 1 ? "line" : "lines"}`;
  const where = count === 1 ? "a scene" : `${count} scenes`;
  return ` — ${lines} in ${where} now read as narration`;
}
