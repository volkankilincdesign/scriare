import type { JSONContent } from "@tiptap/react";
import type { Entity } from "../types/entities";
import { CHOICE_OPTION_TYPE } from "../types/nodeTypes";
import { nodeSpeaker, speakerName } from "../types/speaker";
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
      const name = run.line(speaker) ? speakerName(speaker, entities) : null;
      if (!name) return node;
      return prefixed(node, name);
    }

    if (node.type === CHOICE_OPTION_TYPE) {
      // A choice is its own object on screen, in its own box, read at a
      // moment when the player is choosing rather than reading — so it
      // always names its speaker if it has one. Suppressing it to match a
      // neighbouring line would be answering a question nobody asked.
      const name = speakerName(nodeSpeaker(node.attrs), entities);
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
