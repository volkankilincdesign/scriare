import type { JSONContent } from "@tiptap/react";
import type { ContentNode, Project, Scene } from "../../types/project";
import { childrenOf } from "../../utils/contentTree";
import { mentionLabel } from "../../types/entities";
import { isPlayerSpeaker, playerLabel } from "../../types/speaker";
import { CHOICE_BLOCK_TYPE, CHOICE_OPTION_TYPE } from "../../types/nodeTypes";
import { CONDITIONAL_BLOCK_TYPE } from "../../utils/choiceBlockEditing";
import { extractDialogueLines } from "../../utils/dialogueBlocks";
import { DIALOGUE_BLOCK_TYPE } from "../../types/nodeTypes";
import { actionPhrase, conditionPhrase } from "../../../../shared/script/model";
import type {
  ScriptBlock,
  ScriptChapter,
  ScriptDocument,
  ScriptLayout,
  ScriptLine,
  ScriptScene,
} from "../../../../shared/script/model";

/**
 * The project, walked once into a printable script (v0.64.0).
 *
 * ORDER IS THE CONTENT TREE, his call: the chapter boxes top to bottom,
 * the scenes inside each in the order they sit there. The alternative — a
 * walk of the graph from the start scene — reads closer to play order
 * right up until the first loop, and The Blue Hour has loops. A story
 * with loops has no correct linear order, only a rule, and "the order you
 * arranged them in" is a rule the writer can see and change. It also has
 * the property a script needs most: export the same story twice and get
 * the same document.
 *
 * A scene that is not in the tree cannot be printed in tree order, so
 * anything orphaned is appended at the end under its own heading rather
 * than dropped — a scene missing from a script is worse than a scene in
 * the wrong place.
 */

/** Everything printable inside a scene, flattened to text. */
function flatten(node: JSONContent, resolve: (id: string | null, stored: string) => string): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "mention") {
    return resolve((node.attrs?.entityId as string) ?? null, (node.attrs?.label as string) ?? "");
  }
  return (node.content ?? []).map((c) => flatten(c, resolve)).join("");
}

/**
 * How short a scene has to be before it refuses to break across a page.
 *
 * LOWERED FROM 7 IN v0.65.0, after looking at the output. Seven kept
 * almost every scene in The Blue Hour whole, which meant almost every
 * scene that did not fit in the remaining space started a fresh page —
 * 3,300 words came out as 29 pages, most of them half empty. That reads
 * as tidy for about four pages and as padding after that.
 *
 * Three is the number at which the rule only catches what it was for: a
 * scene of two lines and a choice block, which would look absurd split
 * in half. Everything longer flows, and the finer rules — a heading
 * never last on a page, a cue never parted from its line, a choice block
 * never split — go on doing the work his request was actually about.
 */
const KEEP_WHOLE_BLOCKS = 3;

export function buildScript(
  project: Project,
  options: { layout: ScriptLayout; showConditions: boolean },
): ScriptDocument {
  const entityById = new Map(project.entities.map((e) => [e.id, e]));
  const variableById = new Map(project.variables.map((v) => [v.id, v]));
  const sceneById = new Map(project.scenes.map((s) => [s.id, s]));
  const resolve = (id: string | null, stored: string): string =>
    mentionLabel(id ? entityById.get(id) : undefined, stored || null);

  const speakerOf = (attrs: Record<string, unknown> | undefined): string | null => {
    const raw = attrs?.speaker;
    if (typeof raw !== "string" || !raw) return null;
    if (isPlayerSpeaker(raw)) return playerLabel(project.playerName);
    const entity = entityById.get(raw);
    // Deliberately NOT falling back to the raw id: a line attributed to a
    // deleted character is narration, which is what the app already does
    // on screen, and a script that prints an id would be printing a bug.
    return entity?.kind === "character" ? entity.name.trim() || null : null;
  };

  const conditionWords = (list: unknown): string[] =>
    (Array.isArray(list) ? list : []).map((c) =>
      conditionPhrase(
        variableById.get(c.variableId)?.name ?? "(deleted variable)",
        c.comparator,
        c.value,
        c.negate,
      ),
    );

  const actionWords = (list: unknown): string[] =>
    (Array.isArray(list) ? list : []).map((a) =>
      actionPhrase(variableById.get(a.variableId)?.name ?? "(deleted variable)", a.operation, a.value),
    );

  // Scene numbering follows the printed order, so it has to be settled
  // before any block is built — a choice in scene 3 prints the number of a
  // scene that may come later.
  const ordered: { scene: Scene; chapter: ScriptChapter }[] = [];
  const chapters: ScriptChapter[] = [];
  const placed = new Set<string>();

  function walk(parentId: string | null, chapter: ScriptChapter): void {
    for (const node of childrenOf(project.content, "story", parentId)) {
      if (node.kind === "leaf" && node.refType === "scene") {
        const scene = sceneById.get(node.id);
        if (!scene || placed.has(scene.id)) continue;
        placed.add(scene.id);
        ordered.push({ scene, chapter });
      } else if (node.kind === "folder") {
        // A nested group does not get a page of its own — it is a shelf,
        // not a chapter. Its scenes belong to the chapter above it, which
        // is how they read in the Content panel.
        walk(node.id, chapter);
      }
    }
  }

  const roots: ContentNode[] = childrenOf(project.content, "story", null);
  const looseChapter: ScriptChapter = { id: "__loose", name: "", scenes: [] };
  for (const node of roots) {
    if (node.kind === "folder") {
      const chapter: ScriptChapter = { id: node.id, name: node.name, scenes: [] };
      chapters.push(chapter);
      walk(node.id, chapter);
    } else if (node.kind === "leaf" && node.refType === "scene") {
      const scene = sceneById.get(node.id);
      if (!scene || placed.has(scene.id)) continue;
      placed.add(scene.id);
      if (!chapters.includes(looseChapter)) chapters.unshift(looseChapter);
      ordered.push({ scene, chapter: looseChapter });
    }
  }

  // Anything the tree does not mention. Printed rather than lost.
  const orphans = project.scenes.filter((s) => !placed.has(s.id));
  if (orphans.length) {
    const chapter: ScriptChapter = { id: "__orphans", name: "Not in the Content tree", scenes: [] };
    chapters.push(chapter);
    for (const scene of orphans) ordered.push({ scene, chapter });
  }

  const numberOf = new Map(ordered.map((entry, i) => [entry.scene.id, i + 1]));
  const castCounts = new Map<string, number>();
  let lineCount = 0;
  let choiceCount = 0;

  for (const { scene, chapter } of ordered) {
    const blocks: ScriptBlock[] = [];
    let lineRef = 0;
    let choiceRef = 0;
    let location: string | null = null;

    const makeLine = (node: JSONContent): ScriptLine => {
      lineRef += 1;
      lineCount += 1;
      const speaker = speakerOf(node.attrs as Record<string, unknown> | undefined);
      if (speaker) castCounts.set(speaker, (castCounts.get(speaker) ?? 0) + 1);
      return { ref: String(lineRef), speaker, text: flatten(node, resolve).trim() };
    };

    // The slug line comes from the first LOCATION mentioned anywhere in
    // the scene. Nothing is invented when there is none: the layouts
    // print that the location is unset, which is a prompt to the writer
    // rather than a guess the reader cannot check.
    (function findLocation(node: JSONContent): void {
      if (location) return;
      if (node.type === "mention") {
        const entity = entityById.get((node.attrs?.entityId as string) ?? "");
        if (entity?.kind === "location") location = entity.name;
        return;
      }
      (node.content ?? []).forEach(findLocation);
    })(scene.content);

    for (const node of scene.content.content ?? []) {
      if (node.type === CHOICE_BLOCK_TYPE) {
        // NOT `options` — that is this function's own parameter, and a
        // const of the same name inside the block shadows it, so the
        // `options.showConditions` read a few lines down hits the
        // temporal dead zone of the very array being built. It threw on
        // the first real export and on nothing before it.
        const choiceOptions = (node.content ?? [])
          .filter((o) => o.type === CHOICE_OPTION_TYPE)
          .map((o) => {
            choiceRef += 1;
            choiceCount += 1;
            const targetId = (o.attrs?.targetSceneId as string | null) ?? null;
            const target = targetId ? sceneById.get(targetId) : undefined;
            return {
              ref: `C${choiceRef}`,
              text: flatten(o, resolve).trim(),
              target:
                target && numberOf.has(target.id)
                  ? { n: numberOf.get(target.id)!, title: target.title || "Untitled scene" }
                  : null,
              conditions: options.showConditions ? conditionWords(o.attrs?.conditions) : [],
              actions: options.showConditions ? actionWords(o.attrs?.actions) : [],
              unmet: (o.attrs?.whenUnmet as "hide" | "lock") ?? "hide",
            };
          });
        if (choiceOptions.length) blocks.push({ kind: "choices", options: choiceOptions });
      } else if (node.type === DIALOGUE_BLOCK_TYPE) {
        // A conversation prints as the conversation it is: each line with
        // its reply under it, and what happens after in the margin where
        // conditions already go.
        const spoken = extractDialogueLines(node, resolve).map((line, i) => {
          lineCount += 1;
          const who = speakerOf({ speaker: line.speaker } as Record<string, unknown>);
          if (who) castCounts.set(who, (castCounts.get(who) ?? 0) + 1);
          const replyWho = speakerOf({ speaker: line.replySpeaker } as Record<string, unknown>);
          if (replyWho && line.reply) {
            castCounts.set(replyWho, (castCounts.get(replyWho) ?? 0) + 1);
          }
          const target = line.targetSceneId ? sceneById.get(line.targetSceneId) : undefined;
          return {
            ref: `D${i + 1}`,
            speaker: who,
            text: line.text.trim(),
            reply: line.reply.trim(),
            replySpeaker: replyWho,
            after: line.after,
            target:
              target && numberOf.has(target.id)
                ? { n: numberOf.get(target.id)!, title: target.title || "Untitled scene" }
                : null,
            repeatable: line.repeatable,
            conditions: options.showConditions ? conditionWords(line.conditions) : [],
            actions: options.showConditions ? actionWords(line.actions) : [],
            unmet: line.whenUnmet,
          };
        });
        if (spoken.length) blocks.push({ kind: "dialogue", lines: spoken });
      } else if (node.type === CONDITIONAL_BLOCK_TYPE) {
        const lines = (node.content ?? [])
          .filter((c) => c.type === "paragraph")
          .map(makeLine)
          .filter((l) => l.text.length > 0);
        if (!lines.length) continue;
        // With conditions turned off, gated prose still prints — it is
        // part of the story — it simply stops saying what gates it.
        if (options.showConditions) {
          blocks.push({ kind: "gate", conditions: conditionWords(node.attrs?.conditions), lines });
        } else {
          for (const line of lines) blocks.push({ kind: "line", line });
        }
      } else if (node.type === "paragraph") {
        const line = makeLine(node);
        if (line.text) {
          blocks.push({ kind: "line", line });
        } else {
          // An empty paragraph is spacing in the editor and nothing on
          // paper, so it gives its number back rather than leaving a gap
          // in the line refs a VO session would read out.
          lineRef -= 1;
          lineCount -= 1;
        }
      }
    }

    const built: ScriptScene = {
      id: scene.id,
      n: numberOf.get(scene.id)!,
      title: scene.title || "Untitled scene",
      location,
      blocks,
      keepWhole: blocks.length <= KEEP_WHOLE_BLOCKS,
    };
    chapter.scenes.push(built);
  }

  const allScenes = chapters.flatMap((c) => c.scenes);
  const endings = allScenes.filter((s) => !s.blocks.some((b) => b.kind === "choices")).length;

  return {
    title: project.name || "Untitled Story",
    layout: options.layout,
    showConditions: options.showConditions,
    generatedAt: new Date().toISOString(),
    cast: [...castCounts.entries()]
      .map(([name, lines]) => ({ name, lines }))
      .sort((a, b) => b.lines - a.lines || a.name.localeCompare(b.name)),
    chapters: chapters.filter((c) => c.scenes.length > 0),
    stats: { scenes: ordered.length, lines: lineCount, choices: choiceCount, endings },
  };
}
