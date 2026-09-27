import { generateHTML } from "@tiptap/core";
import type { JSONContent } from "@tiptap/react";
import type { Project } from "../types/project";
import { EMPTY_DOC } from "../types/project";
import type { Variable, VariableAction, VariableCondition } from "../types/variables";
import { describeCondition } from "../types/variables";
import { resolveChoiceBox } from "../types/choiceStyles";
import type { ChoiceBox } from "../types/choiceStyles";
import { readChoiceBlockOptions } from "../utils/choiceBlocks";
import { extractDialogueLines, DIALOGUE_BLOCK_TYPE } from "../utils/dialogueBlocks";
import { speakerName } from "../types/speaker";
import { resolveMentions } from "../utils/mentions";
import { applySpeakerPrefixes } from "../utils/speakerLines";
import { splitDocumentIntoSegments } from "../runtime/documentSegments";
import { RUNTIME_EXTENSIONS } from "../runtime/extensions";

/**
 * Turning a project into the data an exported page reads (v0.48.0).
 *
 * The rule this file follows: EVERYTHING that does not depend on what the
 * reader has done is computed here, at export time, in the app, using the
 * app's own code. Only what genuinely depends on runtime state — which
 * conditions currently pass, what the variables hold — is left for the
 * exported page's script to work out.
 *
 * That split is what keeps the export honest. Prose goes through the same
 * `resolveMentions` → `applySpeakerPrefixes` → `splitDocumentIntoSegments`
 * → `generateHTML(RUNTIME_EXTENSIONS)` pipeline Play Mode uses, so a story
 * exported from Scriare renders the writer's formatting because it IS the
 * renderer the writer was looking at, not a second implementation of it.
 * "The export must inherit the rich text editor's changes" is not a feature
 * that had to be built here; it is a consequence of not building a second
 * path.
 *
 * What is left over — condition evaluation and variable arithmetic — is
 * about forty lines of pure switch statements, and it IS duplicated in the
 * exported page, because there is no way to ship TypeScript to a browser
 * from a save dialog. That duplication is the one real risk in this
 * feature, so it is not defended by care: tests/export-evaluator.spec.mjs
 * runs both implementations over every type, every comparator, both
 * polarities of `negate` and a spread of values, and asserts they agree on
 * all of them. Drift is caught by a failing test, not by a reader noticing
 * a locked door that should have opened.
 */

/** A choice as the exported page needs it. Short keys: this is serialized
 *  into the file, and a 200-scene story writes these a few thousand times. */
export interface ExportChoice {
  /** Pre-rendered label, with the writer's own formatting. */
  l: string;
  /** Destination scene id. */
  t: string;
  c: VariableCondition[];
  /** "lock" shows it disabled with the reason; "hide" removes it. */
  u: "hide" | "lock";
  /** The reason, already in words — built with the app's own describeCondition. */
  r: string;
  a: VariableAction[];
  /** Resolved box. Styles are looked up here so the export carries values,
   *  not a style table plus a resolution algorithm. */
  b: ChoiceBox;
}

/** One line of a Dialogue, as the exported page needs it (v0.66.0). */
export interface ExportDialogueLine {
  /** Stable id — what the page keys "already said" on. */
  i: string;
  /** Pre-rendered label, with the writer's own formatting. */
  l: string;
  /** The speaker's name, already resolved. The page has no entity list. */
  s: string;
  /** The reply, flat, and who gives it. */
  y: string;
  ys: string;
  /** "stay" | "end" | "leave". */
  f: string;
  /** Destination, only when f is "leave". */
  t: string;
  /** Does not leave the list when said. */
  rp: boolean;
  c: VariableCondition[];
  u: "hide" | "lock";
  r: string;
  a: VariableAction[];
  b: ChoiceBox;
}

export type ExportSegment =
  | { k: "p"; h: string }
  | { k: "c"; o: ExportChoice[] }
  | { k: "if"; c: VariableCondition[]; h: string }
  | { k: "d"; id: string; o: ExportDialogueLine[] };

export interface ExportScene {
  id: string;
  title: string;
  seg: ExportSegment[];
}

export interface ExportStory {
  name: string;
  /**
   * The project's own id, used by the exported page to key what it
   * remembers in the reader's browser. The project id rather than the name
   * so that renaming a story does not lose a reader's place, and rather
   * than a fixed string so two stories from the same writer, opened from
   * the same folder, do not overwrite each other's progress.
   */
  key: string;
  start: string | null;
  scenes: ExportScene[];
  variables: Variable[];
}

function renderProse(content: JSONContent): string {
  try {
    return generateHTML(content, RUNTIME_EXTENSIONS);
  } catch {
    // A document this schema cannot parse is one paragraph lost, not an
    // export that fails. The same swallow Play Mode does, for the same
    // reason: a writer mid-export does not want a stack trace, and the rest
    // of the story is still perfectly exportable.
    return "";
  }
}

function renderLabel(node: JSONContent | undefined, fallback: string): string {
  const inline = node?.content as JSONContent[] | undefined;
  if (!inline || inline.length === 0) return escapeText(fallback || "Continue");
  try {
    const html = generateHTML(
      { type: "doc", content: [{ type: "paragraph", content: inline }] },
      RUNTIME_EXTENSIONS,
    );
    // The wrapping paragraph comes off for the same reason it does in
    // choiceRuntimeBlock: a label is a line inside a button, not a block,
    // and keeping it would drag the prose column's vertical rhythm into a
    // control.
    return html.replace(/^<p>|<\/p>$/g, "");
  } catch {
    return escapeText(fallback || "Continue");
  }
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Every scene in the project, in project order.
 *
 * Deliberately not "every scene reachable from the start". A writer who
 * exports a story with an orphaned scene in it has a story with an orphaned
 * scene in it, and silently dropping it would make the export disagree with
 * Check Story — which already reports unreachable scenes, in the place
 * where that is a useful thing to be told. The exported page simply never
 * navigates there, which costs a few kilobytes and no correctness.
 */
export function buildExportStory(project: Project): ExportStory {
  const entities = project.entities ?? [];
  const variables = project.variables ?? [];
  const styles = project.choiceStyles ?? [];

  const scenes: ExportScene[] = project.scenes.map((scene) => {
    const resolved = resolveMentions(scene.content ?? EMPTY_DOC, entities);
    const spoken = applySpeakerPrefixes(resolved, entities);

    const seg: ExportSegment[] = [];
    for (const segment of splitDocumentIntoSegments(spoken)) {
      if (segment.kind === "prose") {
        const h = renderProse(segment.content);
        if (h) seg.push({ k: "p", h });
        continue;
      }

      const node = segment.node;

      if (node.type === "conditionalBlock") {
        const conditions = (node.attrs?.conditions as VariableCondition[] | undefined) ?? [];
        const content = node.content ?? [];
        if (content.length === 0) continue;
        const h = renderProse({ type: "doc", content });
        if (h) seg.push({ k: "if", c: conditions, h });
        continue;
      }

      // v0.66.0 — the Dialogue. Everything it needs is resolved HERE, in
      // the app, where the entity list and the style table live: the page
      // gets names and boxes, never a lookup table plus an algorithm.
      if (node.type === DIALOGUE_BLOCK_TYPE) {
        const lines = extractDialogueLines(node).map<ExportDialogueLine>((line) => ({
          i: line.id,
          l: renderLabel(line.node, line.text),
          s: speakerName(line.speaker, entities) ?? "",
          y: line.reply,
          ys: speakerName(line.replySpeaker, entities) ?? "",
          f: line.after,
          // A leaving line with nowhere to go is shipped with an empty
          // destination rather than dropped: unlike a choice, it still has
          // a reply and a place in the conversation, and silently removing
          // it would change what the reader can say.
          t: line.after === "leave" ? (line.targetSceneId ?? "") : "",
          rp: line.repeatable,
          c: line.conditions ?? [],
          u: line.whenUnmet,
          r: line.conditions?.length
            ? line.conditions.map((condition) => describeCondition(condition, variables)).join(", and ")
            : "",
          a: line.actions ?? [],
          b: resolveChoiceBox(styles, line.style),
        }));
        if (lines.length > 0) {
          seg.push({ k: "d", id: (node.attrs?.blockId as string) ?? "", o: lines });
        }
        continue;
      }

      if (node.type === "choiceBlock") {
        const options = readChoiceBlockOptions(node)
          // An option with nowhere to go is skipped rather than shipped as a
          // dead button — same rule the runtime applies, and the reason
          // Check Story exists to catch them before it gets this far.
          .filter((option) => option.targetSceneId)
          .map<ExportChoice>((option) => ({
            l: renderLabel(option.node, option.text),
            t: option.targetSceneId as string,
            c: option.conditions ?? [],
            u: option.whenUnmet,
            r:
              option.conditions?.length
                ? option.conditions
                    .map((condition) => describeCondition(condition, variables))
                    .join(", and ")
                : "",
            a: option.actions ?? [],
            b: resolveChoiceBox(styles, option.style),
          }));
        if (options.length > 0) seg.push({ k: "c", o: options });
        continue;
      }
    }

    return { id: scene.id, title: scene.title || "Untitled scene", seg };
  });

  return {
    name: project.name,
    key: project.id,
    start: project.startSceneId ?? (scenes[0]?.id ?? null),
    scenes,
    variables,
  };
}
