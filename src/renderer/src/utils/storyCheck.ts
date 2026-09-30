import type { JSONContent } from "@tiptap/react";
import { CHOICE_BLOCK_TYPE, readChoiceBlockOptions } from "./choiceBlocks";
import type { MentionLabelResolver } from "./choiceBlocks";
import { mentionResolver } from "./mentions";
import { dialogueCanClose, findDialogueBlockLines } from "./dialogueBlocks";
import type { DialogueLine } from "./dialogueBlocks";
import { DIALOGUE_BLOCK_TYPE } from "../types/nodeTypes";
import { MENTION_TYPE } from "../types/entities";
import { speakerReferences } from "./speakerLines";
import { canSpeak } from "../types/speaker";
import type { ChoiceOption } from "./choiceBlocks";
import type { Project, Scene } from "../types/project";

/**
 * Story validation (v0.36.0) — the questions a branching writer asks at 2am,
 * answered from the graph the app already has.
 *
 * Two things make this worth building rather than leaving to a careful
 * writer. First, every one of these questions is invisible while writing:
 * a scene nobody can reach looks exactly like a scene you haven't linked
 * YET, and a choice pointing at a deleted scene looks exactly like a choice.
 * Second, they compound — the branch you forgot to link is the branch you
 * then wrote four scenes into.
 *
 * Nothing here is a rule about how to write. A dead end is called an
 * ENDING, not an error, because most of them are; an unreachable scene is
 * a warning rather than a problem, because "written but not wired up yet"
 * is a normal Tuesday. Only the things that are definitely broken —
 * choices that go nowhere, links to scenes that no longer exist, gates on
 * variables that were deleted — are called problems.
 */

export type StoryIssueKind =
  | "no-start-scene"
  | "unlinked-choice"
  | "broken-link"
  | "unreachable-scene"
  /** v0.66.0 — a conversation with no way out holds the reader forever. */
  | "dialogue-never-ends"
  /** v0.66.0 — a line gated on a variable that no longer exists. */
  | "dialogue-dead-gate"
  | "missing-variable-condition"
  | "missing-variable-action"
  /** v0.72.0 — a locked option naming a variable the writer never named. */
  | "unnamed-variable-shown"
  /**
   * v0.76.0 — a line whose speaker was deleted. It does not break the
   * story, it quietly changes it: `speakerName` returns null for an id
   * that resolves to nobody, and a line with no name in front of it is
   * narration. Nothing anywhere said so, in the editor or in the report,
   * so the only way to find it was to read the whole story again.
   */
  | "deleted-speaker"
  /**
   * v0.76.0 — a speaker that still exists but cannot speak: a Location, or
   * a Note. Same silent outcome, different cause, so it is its own kind
   * rather than a footnote on the one above — "İstanbul was deleted" would
   * be a lie about a location that is still in the story. Only reachable
   * in a story written against the FIRST build of v0.37.0, before
   * `canSpeak` (v0.37.1), when every entity was offered as a speaker.
   */
  | "silent-speaker"
  | "empty-scene";

export type StorySeverity = "problem" | "warning" | "note";

export interface StoryIssue {
  id: string;
  kind: StoryIssueKind;
  severity: StorySeverity;
  /** The full sentence, for a tooltip and for anything reading this aloud. */
  title: string;
  /** What to do about it, where that isn't obvious. */
  detail: string;
  /**
   * The thing itself, named as briefly as it can be while staying true:
   * a choice's own text, or WHERE it is when it hasn't been written yet.
   * "Untitled choice" was the panel repeating the editor's placeholder
   * back at the writer — and in a list of six, every row claimed to be
   * the same choice.
   */
  label: string;
  /**
   * Two words for what's wrong. Since v0.77.0 this is for the CHIP on a
   * scene's header, where it counts ("3 unnamed variable") — it is no
   * longer drawn on the row, where it was saying the same thing as the
   * hint one line below it.
   */
  what: string;
  /**
   * One line, on the row, at rest (v0.77.0).
   *
   * The third text, between `what` (two words, a chip) and `detail` (a
   * full sentence with the fix in it). Neither was the right size for a
   * row: `what` is jargon — "unnamed variable" tells a writer nothing
   * about what their reader will see — and `detail` runs to 200
   * characters. Until now the only way to read `detail` was to hover,
   * which is why this was reported at all.
   *
   * Every kind has one, even the ones where arriving at the line shows
   * you the problem anyway. An explanation on four rows out of six is a
   * writer wondering what is different about the other two.
   */
  hint: string;
  /** Where to go when this is clicked. */
  sceneId?: string;
  blockId?: string;
  /**
   * What `blockId` actually points AT, so the Inspector can be opened on
   * it (v0.77.0).
   *
   * `goTo` used to send `kind: "choice"` for anything carrying a blockId,
   * which was true while only choices carried one. v0.76.0 broke that
   * without noticing: a speaker finding passes a PARAGRAPH's id, and the
   * Inspector has no paragraph state — so it was being told a paragraph
   * was a choice and asked to find one that does not exist.
   *
   * `null` means the id is worth revealing in the editor but is not
   * something the Inspector can show; the panel stays on the scene.
   */
  inspect?: "choice" | "dialogue" | null;
}

export interface StoryStats {
  scenes: number;
  words: number;
  choices: number;
  /** Scenes with no way out — the story's endings. */
  endings: number;
  /** Scenes reachable from the start by following choices. */
  reachable: number;
  /** True when some route leads back on itself. */
  loops: boolean;
  /**
   * Scenes on the longest route from the start, or null when the story
   * loops — with a cycle there is no longest route, and inventing a number
   * for one would be worse than admitting it.
   */
  longestRoute: number | null;
  /** Scenes on the shortest route from the start to any ending. */
  shortestRoute: number | null;
}

export interface StoryCheck {
  issues: StoryIssue[];
  stats: StoryStats;
  endings: { id: string; title: string }[];
}

/** Every choice in a scene, with the block it belongs to. */
interface SceneChoice {
  blockId: string;
  option: ChoiceOption;
}

function sceneChoices(
  content: JSONContent | undefined | null,
  resolve?: MentionLabelResolver,
): SceneChoice[] {
  const found: SceneChoice[] = [];
  if (!content) return found;
  (function walk(node: JSONContent): void {
    if (node.type === CHOICE_BLOCK_TYPE) {
      const blockId = (node.attrs?.blockId as string) ?? "";
      readChoiceBlockOptions(node, resolve).forEach((option) => found.push({ blockId, option }));
      return;
    }
    node.content?.forEach(walk);
  })(content);
  return found;
}

/**
 * Words, counted the way a writer counts them: the prose, the choices the
 * player reads, and the names that appear in sentences. A mention has no
 * text of its own — it's a reference — so its label is counted in its
 * place, or "Behind it, Mara waits" would come out as three words.
 *
 * EXPORTED IN v0.59.0, and the status bar now reads it. There were two of
 * these: this one, and a simpler copy in StatusBar.tsx that walked only
 * text nodes — so a scene with three characters mentioned in it was
 * reported three words short in the status bar and correctly in Check
 * Story, about the same scene, on the same screen. One measurement, one
 * implementation; the same rule v0.57.0 applied to the reading grounds and
 * v0.58.0 to the contrast check.
 */
export function countWords(content: JSONContent | undefined | null): number {
  if (!content) return 0;
  let text = "";
  (function walk(node: JSONContent): void {
    if (node.type === MENTION_TYPE) {
      text += ` ${String(node.attrs?.label ?? "")} `;
      return;
    }
    if (typeof node.text === "string") text += node.text;
    node.content?.forEach(walk);
    // A space on the way out of every container. Without it the last word
    // of a paragraph and the first word of the choice below it arrive as
    // "waits.Open" — one token, one word, and a word count quietly short
    // by one per block for the whole story.
    if (node.content) text += " ";
  })(content);
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

function isEmptyScene(scene: Scene): boolean {
  return countWords(scene.content) === 0 && sceneChoices(scene.content).length === 0;
}

/**
 * A locked option tells the reader why (v0.72.0).
 *
 * That is deliberate — the runtime's comment argues a crossed-out option
 * with no reason is worse than no option at all — and it means the
 * variable's name is prose. A writer who has not given that variable a
 * display name is publishing an identifier: "Requires knows_roster".
 *
 * Reported rather than prevented, and only where it can actually be seen:
 * a HIDDEN option shows the reader nothing, and an option carrying the
 * writer's own sentence never names the variable at all. So this fires on
 * exactly the strings a player can read, which is the difference between a
 * warning worth having and a list everybody learns to ignore.
 */
function unnamedShownVariablesFor(
  gated: { conditions: { variableId: string }[]; whenUnmet: string; lockReason?: string },
  byId: Map<string, { displayName?: string; name: string }>,
): string[] {
  if (gated.whenUnmet !== "lock") return [];
  if (gated.lockReason?.trim()) return [];
  const unnamed: string[] = [];
  for (const condition of gated.conditions) {
    const variable = byId.get(condition.variableId);
    if (variable && !variable.displayName?.trim()) unnamed.push(variable.name || "a variable");
  }
  return [...new Set(unnamed)];
}

export function checkStory(project: Project | null): StoryCheck {
  const empty: StoryCheck = {
    issues: [],
    stats: {
      scenes: 0, words: 0, choices: 0, endings: 0, reachable: 0,
      loops: false, longestRoute: null, shortestRoute: null,
    },
    endings: [],
  };
  if (!project) return empty;

  const scenes = project.scenes;
  const byId = new Map(scenes.map((s) => [s.id, s]));
  // Entities, for the speaker pass below. `?? []` because a project
  // written before v0.35.0 has no entities key at all.
  const entityById = new Map((project.entities ?? []).map((e) => [e.id, e]));
  const variableIds = new Set(project.variables.map((v) => v.id));
  const variableById = new Map(project.variables.map((v) => [v.id, v]));

  /** Push one issue per gated thing whose reader-visible variables are unnamed. */
  const reportUnnamed = (
    gated: { conditions: { variableId: string }[]; whenUnmet: string; lockReason?: string },
    id: string,
    where: string,
    label: string,
    sceneId: string,
    blockId: string,
    /**
     * Which kind of block raised it (v0.77.1). The same finding comes from
     * a choice option and from a Dialogue line, so the KIND cannot say
     * what its blockId points at — only the caller knows.
     */
    inspect: "choice" | "dialogue" = "choice",
  ): void => {
    const unnamed = unnamedShownVariablesFor(gated, variableById);
    if (unnamed.length === 0) return;
    issues.push({
      id: `unnamed:${id}`,
      kind: "unnamed-variable-shown",
      severity: "warning",
      title: where,
      detail:
        unnamed.length === 1
          ? `This option is shown locked, so the reader is told why — and is shown the variable's own name, "${unnamed[0]}". Give it a display name, or write this option a reason of its own.`
          : `This option is shown locked, so the reader is told why — and is shown ${unnamed.length} variables by their own names: ${unnamed.map((n) => `"${n}"`).join(", ")}. Give them display names, or write this option a reason of its own.`,
      // Names the variable, because that is the whole finding: the reader
      // is about to read the word `knows_roster`, and which word it is is
      // the thing the writer needs in order to care.
      hint:
        unnamed.length === 1
          ? `The reader is shown “${unnamed[0]}”.`
          : `The reader is shown ${unnamed.length} variables by their own names.`,
      label,
      what: "unnamed variable",
      sceneId,
      blockId,
      inspect,
    });
  };
  // A draft until `finish` fills the two fields that are the same for
  // every occurrence of a kind — see HINTS and INSPECTS. A site that has
  // something better to say sets its own and keeps it.
  const issues: IssueDraft[] = [];
  const title = (scene: Scene): string => scene.title || "Untitled scene";

  // ── Per-scene checks, and the edges the reachability pass needs ──────
  const links = new Map<string, string[]>();
  let choiceCount = 0;

  // A choice named after a character has to be named after the character
  // she is NOW, not the one she was when the line was written.
  const resolve = mentionResolver(project.entities ?? []);

  scenes.forEach((scene) => {
    const choices = sceneChoices(scene.content, resolve);
    const targets: string[] = [];

    choices.forEach(({ blockId, option }, index) => {
      choiceCount += 1;
      // A choice nobody has written yet is named by its position, which is
      // both true and different for every row.
      const label = option.text || `choice ${index + 1}`;
      const where = `${title(scene)} — "${label}"`;

      if (!option.targetSceneId) {
        issues.push({
          id: `unlinked:${option.id}`,
          kind: "unlinked-choice",
          severity: "problem",
          title: where,
          detail: "This choice doesn't go anywhere yet.",
          label,
          what: "unlinked",
          sceneId: scene.id,
          blockId,
        });
      } else if (!byId.has(option.targetSceneId)) {
        issues.push({
          id: `broken:${option.id}`,
          kind: "broken-link",
          severity: "problem",
          title: where,
          detail: "It points at a scene that no longer exists.",
          label,
          what: "broken link",
          sceneId: scene.id,
          blockId,
        });
      } else {
        targets.push(option.targetSceneId);
      }

      // A gate whose variable was deleted can never open — conditions fail
      // closed on a missing variable (see evaluateConditions), so this
      // choice is invisible to every player, in every playthrough.
      option.conditions.forEach((condition) => {
        if (!variableIds.has(condition.variableId)) {
          issues.push({
            id: `cond:${condition.id}`,
            kind: "missing-variable-condition",
            severity: "problem",
            title: where,
            detail:
              "A condition on this choice uses a variable that was deleted, so the choice can never appear.",
            label,
            what: "dead gate",
            sceneId: scene.id,
            blockId,
          });
        }
      });

      option.actions.forEach((action) => {
        if (!variableIds.has(action.variableId)) {
          issues.push({
            id: `act:${action.id}`,
            kind: "missing-variable-action",
            severity: "warning",
            title: where,
            detail: "An action on this choice sets a variable that was deleted; it does nothing.",
            label,
            what: "dead action",
            sceneId: scene.id,
            blockId,
          });
        }
      });

      reportUnnamed(option, option.id, where, label, scene.id, blockId);
    });

    // ── the Dialogue (v0.66.0) ──────────────────────────────────────
    //
    // THE RULE, restated: an option is an edge only if it LEAVES. A line
    // that stays on the page is not a link, so it adds nothing to
    // `targets` — which is what makes reachability MORE accurate than it
    // was, not less: before this block existed, a writer faking a
    // conversation with self-linking choices made every such scene look
    // like it led somewhere.
    const dialogueBlocks: { blockId: string; lines: DialogueLine[] }[] = [];
    (function findBlocks(node: JSONContent): void {
      if (node.type === DIALOGUE_BLOCK_TYPE) {
        const blockId = (node.attrs?.blockId as string) ?? "";
        dialogueBlocks.push({
          blockId,
          lines: findDialogueBlockLines(scene.content, blockId, resolve) ?? [],
        });
        return;
      }
      (node.content ?? []).forEach(findBlocks);
    })(scene.content ?? { type: "doc", content: [] });

    dialogueBlocks.forEach(({ blockId, lines: dialogueLines }) => {
      if (!dialogueCanClose(dialogueLines)) {
        issues.push({
          id: `dialogue-open:${blockId}`,
          kind: "dialogue-never-ends",
          severity: "problem",
          title: title(scene),
          detail:
            "This conversation can never be left — every line can be said again, and none of them ends it or leaves the scene. A reader would be held here, and anything written below it never appears.",
          label: title(scene),
          what: "no way out",
          sceneId: scene.id,
          blockId,
          inspect: "dialogue",
        });
      }

      dialogueLines.forEach((line, index) => {
        const label = line.text || `line ${index + 1}`;
        const where = `${title(scene)} — "${label}"`;

        if (line.after === "leave") {
          if (!line.targetSceneId) {
            issues.push({
              id: `dialogue-unlinked:${line.id}`,
              kind: "unlinked-choice",
              severity: "problem",
              title: where,
              detail: "This line leaves the scene but doesn't say where to.",
              label,
              what: "unlinked",
              sceneId: scene.id,
              blockId,
              inspect: "dialogue",
            });
          } else if (!byId.has(line.targetSceneId)) {
            issues.push({
              id: `dialogue-broken:${line.id}`,
              kind: "broken-link",
              severity: "problem",
              title: where,
              detail: "It points at a scene that no longer exists.",
              label,
              what: "broken link",
              sceneId: scene.id,
              blockId,
              inspect: "dialogue",
            });
          } else {
            targets.push(line.targetSceneId);
          }
        }

        reportUnnamed(line, line.id, where, label, scene.id, blockId, "dialogue");

        line.conditions.forEach((condition) => {
          if (!variableIds.has(condition.variableId)) {
            issues.push({
              id: `dialogue-cond:${condition.id}`,
              kind: "dialogue-dead-gate",
              severity: "problem",
              title: where,
              detail:
                "A condition on this line uses a variable that was deleted, so this line can never be said.",
              label,
              what: "can never be said",
              sceneId: scene.id,
              blockId,
              inspect: "dialogue",
            });
          }
        });

        line.actions.forEach((action) => {
          if (!variableIds.has(action.variableId)) {
            issues.push({
              id: `dialogue-act:${action.id}`,
              kind: "missing-variable-action",
              severity: "problem",
              title: where,
              detail:
                "An action on this line changes a variable that was deleted, so it does nothing.",
              label,
              what: "dead action",
              sceneId: scene.id,
              blockId,
              inspect: "dialogue",
            });
          }
        });
      });
    });
    links.set(scene.id, targets);

    /**
     * Who speaks here, and are they still able to (v0.76.0).
     *
     * ONE ISSUE PER SPEAKER PER SCENE, his call. A character deleted
     * halfway through a draft may have thirty lines across four scenes,
     * and thirty rows saying the same thing is a report nobody reads to
     * the bottom of — it is one mistake, not thirty. Grouped by scene
     * rather than by story because that is how the rest of this report
     * groups, and because the fix is per-scene work: you go there and
     * re-attribute the lines.
     *
     * The count is of REFERENCES, not of lines: a Dialogue line whose
     * reply is spoken by the same missing character loses two names, and
     * saying "1 line" while two names vanish would be the report being
     * tidier than the truth.
     */
    const speakersHere = new Map<string, { count: number; anchor: string | null }>();
    speakerReferences(scene.content).forEach((ref) => {
      const seen = speakersHere.get(ref.entityId);
      // The FIRST one keeps its anchor: one row stands for several lines,
      // and a row has to land somewhere when it is clicked. The first is
      // the one to land on — it is where the writer starts reading.
      if (seen) seen.count += 1;
      else speakersHere.set(ref.entityId, { count: 1, anchor: ref.anchorId });
    });
    speakersHere.forEach(({ count, anchor }, entityId) => {
      const entity = entityById.get(entityId);
      // Still here and still able to speak — nothing to say.
      if (entity && canSpeak(entity)) return;
      // "1 line here are spoken by" is what counting without conjugating
      // gets you, and it shipped in the first draft of this. The verb has
      // to agree with the count, so both halves are chosen together.
      const places =
        count === 1 ? "1 line here is" : `${count} lines here are`;
      issues.push({
        id: `speaker:${scene.id}:${entityId}`,
        kind: entity ? "silent-speaker" : "deleted-speaker",
        // A warning rather than a problem: the story still plays and every
        // route still works. What changed is what the READER sees, which
        // is why it cannot be a note either.
        severity: "warning",
        title: title(scene),
        detail: entity
          ? `${places} spoken by ${entity.name || "an unnamed entity"}, which is a ${entity.kind} and cannot speak. ${count === 1 ? "It reads" : "They read"} as narration.`
          : `${places} spoken by someone who was deleted. ${count === 1 ? "It reads" : "They read"} as narration.`,
        // Says HOW MANY, because one lost line and five are different
        // amounts of work and the row is standing in for all of them.
        hint:
          count === 1
            ? "1 line reads as narration."
            : `${count} lines read as narration.`,
        label: entity ? entity.name || "Unnamed" : "Deleted character",
        what: entity ? "cannot speak" : "no speaker",
        sceneId: scene.id,
        // The id of the first line that lost its name. Not something the
        // Inspector can show — `inspect` is null for these kinds — but
        // exactly what the editor should scroll to and mark (v0.77.0).
        ...(anchor ? { blockId: anchor } : {}),
      });
    });

    if (isEmptyScene(scene)) {
      issues.push({
        id: `empty:${scene.id}`,
        kind: "empty-scene",
        severity: "note",
        title: title(scene),
        detail: "Nothing written here yet.",
        label: title(scene),
        what: "empty",
        sceneId: scene.id,
      });
    }
  });

  // ── Reachability ─────────────────────────────────────────────────────
  // An unset Start Scene is NOT a problem: Play Mode falls back to the
  // first Story scene, which is the documented behaviour and what a writer
  // who has never opened Project Settings relies on. What IS a problem is
  // a Start Scene that was set and then deleted — the story then begins
  // somewhere the writer didn't choose, silently.
  const declaredStart = project.startSceneId;
  const startId = (declaredStart && byId.has(declaredStart) ? declaredStart : scenes[0]?.id) ?? null;

  if (declaredStart && !byId.has(declaredStart)) {
    issues.push({
      id: "no-start",
      kind: "no-start-scene",
      severity: "problem",
      title: "The first scene was deleted",
      detail:
        "This story starts from a scene that no longer exists, so Play Mode begins wherever it can. Set a Start Scene in Project Settings.",
      label: "The first scene was deleted",
      what: "no start",
    });
  } else if (!startId) {
    issues.push({
      id: "no-start",
      kind: "no-start-scene",
      severity: "problem",
      title: "This story has no scenes yet",
      detail: "Play Mode has nowhere to begin.",
      label: "This story has no scenes yet",
      what: "no start",
    });
  }

  const reachable = new Set<string>();
  if (startId && byId.has(startId)) {
    const queue = [startId];
    reachable.add(startId);
    while (queue.length > 0) {
      const current = queue.shift() as string;
      (links.get(current) ?? []).forEach((next) => {
        if (!reachable.has(next)) {
          reachable.add(next);
          queue.push(next);
        }
      });
    }
  }

  scenes.forEach((scene) => {
    if (reachable.has(scene.id)) return;
    issues.push({
      id: `unreachable:${scene.id}`,
      kind: "unreachable-scene",
      severity: "warning",
      title: title(scene),
      detail: "No choice leads here, so a player can never see it.",
      label: title(scene),
      what: "unreachable",
      sceneId: scene.id,
    });
  });

  // ── Endings, and how long the routes are ────────────────────────────
  const endings = scenes
    .filter((scene) => reachable.has(scene.id) && (links.get(scene.id) ?? []).length === 0)
    .map((scene) => ({ id: scene.id, title: title(scene) }));

  const loops = hasCycle(startId, links, reachable);

  return {
    issues: issues.map(finish).sort(bySeverity),
    endings,
    stats: {
      scenes: scenes.length,
      words: scenes.reduce((total, scene) => total + countWords(scene.content), 0),
      choices: choiceCount,
      endings: endings.length,
      reachable: reachable.size,
      loops,
      // With a cycle there is no longest route — you can go round again —
      // so this says nothing rather than something untrue.
      longestRoute: loops ? null : longestRoute(startId, links, reachable),
      shortestRoute: shortestRoute(startId, links, new Set(endings.map((e) => e.id))),
    },
  };
}

const SEVERITY_ORDER: Record<StorySeverity, number> = { problem: 0, warning: 1, note: 2 };
function bySeverity(a: StoryIssue, b: StoryIssue): number {
  return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
}

/**
 * The row's one line, per kind (v0.77.0).
 *
 * A TABLE rather than a field on fourteen construction sites, because
 * eleven of the thirteen kinds say the same thing every time they occur —
 * "goes nowhere" is not a fact about a particular choice. The three that
 * genuinely vary set their own and this leaves them alone.
 *
 * Written to be read at a glance and to be TRUE, in that order of
 * difficulty. The temptation is to compress "an action on this choice
 * sets a variable that was deleted; it does nothing" into "dead action",
 * which is what `what` already says and what nobody can act on.
 */
const HINTS: Record<StoryIssueKind, string> = {
  "unlinked-choice": "Goes nowhere.",
  "broken-link": "Its scene was deleted.",
  "missing-variable-condition": "Its variable was deleted, so it never shows.",
  "missing-variable-action": "Its variable was deleted, so it does nothing.",
  "unnamed-variable-shown": "The reader is shown the variable's own name.",
  "dialogue-never-ends": "Nothing closes this conversation.",
  "dialogue-dead-gate": "Its variable was deleted, so it can never be said.",
  "deleted-speaker": "Reads as narration.",
  "silent-speaker": "This cannot speak, so it reads as narration.",
  "unreachable-scene": "No choice leads here.",
  "no-start-scene": "Play Mode has nowhere to begin.",
  "empty-scene": "Nothing written yet.",
};

/**
 * What a kind's `blockId` points at, when it has one.
 *
 * Only two of the Inspector's states can be opened from here. A speaker
 * finding's id is a paragraph, which the Inspector has no state for — so
 * it is `null`: worth revealing in the editor, not worth pointing a panel
 * at. Absent from this table means the finding is about the scene itself.
 */
const INSPECTS: Partial<Record<StoryIssueKind, "choice" | "dialogue" | null>> = {
  "unlinked-choice": "choice",
  "broken-link": "choice",
  "missing-variable-condition": "choice",
  "missing-variable-action": "choice",
  "unnamed-variable-shown": "choice",
  "dialogue-never-ends": "dialogue",
  "dialogue-dead-gate": "dialogue",
  "deleted-speaker": null,
  "silent-speaker": null,
};

type IssueDraft = Omit<StoryIssue, "hint"> & { hint?: string };

/** Fills in whatever the construction site did not say for itself. */
function finish(issue: IssueDraft): StoryIssue {
  return {
    ...issue,
    hint: issue.hint || HINTS[issue.kind],
    inspect: issue.inspect !== undefined ? issue.inspect : (INSPECTS[issue.kind] ?? null),
  };
}

/** Depth-first, tracking the current path — a scene seen twice on one route
 *  is a loop, while a scene seen again on a different route is just a
 *  branch rejoining, which is ordinary branching and not worth reporting. */
function hasCycle(
  start: string | null,
  links: Map<string, string[]>,
  reachable: Set<string>,
): boolean {
  if (!start) return false;
  const onPath = new Set<string>();
  const settled = new Set<string>();

  function visit(id: string): boolean {
    if (onPath.has(id)) return true;
    if (settled.has(id)) return false;
    onPath.add(id);
    for (const next of links.get(id) ?? []) {
      if (reachable.has(next) && visit(next)) return true;
    }
    onPath.delete(id);
    settled.add(id);
    return false;
  }

  return visit(start);
}

/**
 * Scenes on the longest route from the start, or null if the story can
 * return on itself — where there is no longest route, only a longer one.
 *
 * The caller already knows whether the story loops and skips this when it
 * does. The path check below is not redundant with that: without it, one
 * cyclic story recurses until the stack overflows and takes Check Story —
 * and the window it opened in — down with it. A function that walks a
 * graph should survive the graph it is handed, not depend on being asked
 * nicely. (Confirmed by removing the caller's guard: a two-scene loop
 * crashes the app outright.)
 */
function longestRoute(
  start: string | null,
  links: Map<string, string[]>,
  reachable: Set<string>,
): number | null {
  if (!start || !reachable.has(start)) return null;
  const memo = new Map<string, number>();
  const onPath = new Set<string>();
  let looped = false;

  function depth(id: string): number {
    if (onPath.has(id)) {
      looped = true;
      return 0;
    }
    const seen = memo.get(id);
    if (seen !== undefined) return seen;

    onPath.add(id);
    const next = (links.get(id) ?? []).filter((t) => reachable.has(t));
    const value = next.length === 0 ? 1 : 1 + Math.max(...next.map(depth));
    onPath.delete(id);

    memo.set(id, value);
    return value;
  }

  const result = depth(start);
  return looped ? null : result;
}

/** Scenes on the shortest route from the start to any ending — breadth
 *  first, so it's well-defined whether or not the story loops. */
function shortestRoute(
  start: string | null,
  links: Map<string, string[]>,
  endings: Set<string>,
): number | null {
  if (!start || endings.size === 0) return null;
  const seen = new Set([start]);
  let frontier = [start];
  let depth = 1;
  while (frontier.length > 0) {
    if (frontier.some((id) => endings.has(id))) return depth;
    const next: string[] = [];
    frontier.forEach((id) => {
      (links.get(id) ?? []).forEach((target) => {
        if (!seen.has(target)) {
          seen.add(target);
          next.push(target);
        }
      });
    });
    frontier = next;
    depth += 1;
  }
  return null;
}
