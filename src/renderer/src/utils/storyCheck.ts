import type { JSONContent } from "@tiptap/react";
import { CHOICE_BLOCK_TYPE, readChoiceBlockOptions } from "./choiceBlocks";
import type { MentionLabelResolver } from "./choiceBlocks";
import { mentionResolver } from "./mentions";
import { dialogueCanClose, findDialogueBlockLines } from "./dialogueBlocks";
import type { DialogueLine } from "./dialogueBlocks";
import { DIALOGUE_BLOCK_TYPE } from "../types/nodeTypes";
import { MENTION_TYPE } from "../types/entities";
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
  /** Two words for what's wrong, for chips and the right-hand column. */
  what: string;
  /** Where to go when this is clicked. */
  sceneId?: string;
  blockId?: string;
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
  const variableIds = new Set(project.variables.map((v) => v.id));
  const issues: StoryIssue[] = [];
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
            });
          } else {
            targets.push(line.targetSceneId);
          }
        }

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
            });
          }
        });
      });
    });
    links.set(scene.id, targets);

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
    issues: issues.sort(bySeverity),
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
