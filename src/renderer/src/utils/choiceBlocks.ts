import { nanoid } from "nanoid";
import type { JSONContent } from "@tiptap/react";
import type { Choice } from "../types/project";
import type { VariableAction, VariableCondition } from "../types/variables";
import type { ChoiceStyleRef } from "../types/choiceStyles";

export const CHOICE_BLOCK_TYPE = "choiceBlock";
export const CHOICE_OPTION_TYPE = "choiceOption";

/**
 * One option inside a Choice Block — a Choice Block holds one or more of
 * these. `actions` (Sprint 9A) are the runtime effects picking this option
 * has — see types/variables.ts's VariableAction — and default to an empty
 * array so every project saved before this sprint still normalizes
 * correctly (readOptions below is the single place that ever needs to know
 * that). `conditions` (Sprint 9B) is intentionally NOT a field yet: nothing
 * reads it this sprint, and adding an empty array no code touches would
 * just be dead data — see the Inspector's Conditions placeholder instead.
 *
 * v0.30.0 filled that gap: `conditions` are the tests that must all hold
 * for this option to be offered, and `whenUnmet` says what the player sees
 * when they don't. Both default so that every choice written before this
 * existed behaves exactly as it always did — no conditions means always
 * available, which is what `evaluateConditions` returns for an empty list.
 */
export interface ChoiceOption {
  id: string;
  text: string;
  targetSceneId: string | null;
  actions: VariableAction[];
  /** All must be true for the option to be offered. Empty means always. */
  conditions: VariableCondition[];
  /**
   * What a player sees when the conditions fail. "hide" removes the option
   * entirely — the player never learns it was there, which is what most
   * branching fiction wants. "lock" shows it greyed out with the reason,
   * for the "you need 3 Trust" moments where knowing the door exists is
   * the point. Per option rather than per project, because a story usually
   * wants both in different places.
   */
  whenUnmet: "hide" | "lock";
  /**
   * The option's own document node, carrying its label as inline content.
   * Present whenever the option was read out of a document (which is every
   * real case); the runtime uses it to render a styled label, while
   * `text` above is the same thing flattened for anything that just wants
   * a string.
   */
  node?: JSONContent;
  /**
   * v0.34.0 — which Choice Style this option wears, plus any one-off
   * tweaks. `null` means "the project default", which is why the node
   * attribute defaults to null: the Inspector has to tell "never touched"
   * from "set to the same values" to offer a meaningful reset.
   */
  style: ChoiceStyleRef | null;
}

/**
 * Flattens a `choiceOption` node's inline content back to plain text —
 * what anything that needs a LABEL rather than a rendering wants: the
 * Inspector's collapsed summary, the graph's edge label, the runtime's
 * accessible name. Marks are dropped on purpose; this is the text, not the
 * typography.
 */
export function optionPlainText(node: JSONContent | undefined): string {
  if (!node?.content) return "";
  let out = "";
  (function walk(n: JSONContent): void {
    if (typeof n.text === "string") out += n.text;
    n.content?.forEach(walk);
  })(node);
  return out;
}

/**
 * Reads one Choice Block node's options.
 *
 * Since v0.32.0 an option is a child `choiceOption` node: its label is that
 * node's inline content, everything else is its attributes. `text` here is
 * the flattened label, kept because most callers want a string; anything
 * that needs the styled version reads the node's content directly (see
 * the runtime's choice block).
 */
export function readChoiceBlockOptions(node: JSONContent | undefined): ChoiceOption[] {
  return readOptions(node);
}

function readOptions(node: JSONContent | undefined): ChoiceOption[] {
  const children = node?.content ?? [];
  return children
    .filter((child) => child.type === CHOICE_OPTION_TYPE)
    .map((child) => ({
      id: (child.attrs?.optionId as string) ?? nanoid(),
      text: optionPlainText(child),
      targetSceneId: (child.attrs?.targetSceneId as string | null) || null,
      actions: Array.isArray(child.attrs?.actions) ? (child.attrs.actions as VariableAction[]) : [],
      conditions: Array.isArray(child.attrs?.conditions)
        ? (child.attrs.conditions as VariableCondition[])
        : [],
      whenUnmet: child.attrs?.whenUnmet === "lock" ? "lock" : "hide",
      style: (child.attrs?.style as ChoiceStyleRef | null) ?? null,
      /** The node itself, for anything that needs the label's formatting. */
      node: child,
    }));
}

/**
 * Choices live inside the scene's document as `choiceBlock` nodes, each
 * holding one or more options — this walks the Tiptap JSON tree and
 * flattens every block's options into a single ordered list, for anything
 * that needs a flat choice list (the graph, Auto Layout, the read-only
 * Inspector summary). The Play runtime does NOT use this for rendering (it
 * needs to know where each block sits in the document — see
 * runtime/documentSegments.ts) but still uses it to check whether a scene
 * has any linked choice at all.
 */
export function extractChoices(content: JSONContent | undefined | null): Choice[] {
  if (!content) return [];
  const found: Choice[] = [];

  function walk(node: JSONContent): void {
    if (node.type === CHOICE_BLOCK_TYPE) {
      readOptions(node).forEach((option) => found.push({ ...option }));
      return;
    }
    node.content?.forEach(walk);
  }

  walk(content);
  return found;
}

/**
 * Finds one Choice Block's full option list by its block id — what the
 * Inspector's Choice Properties view (InspectorPanel.tsx) reads to render
 * every option as its own accordion (per `inspectorStore`'s
 * `{kind: "choice", blockId}` — Sprint 9B moved Inspector targeting from a
 * single option up to the whole block, since the Inspector now edits every
 * option in the block at once rather than one at a time). Returns `null`
 * when the block no longer exists (e.g. it was deleted while the Inspector
 * still had it targeted).
 */
export function findChoiceBlockOptions(
  content: JSONContent | undefined | null,
  blockId: string,
): ChoiceOption[] | null {
  if (!content) return null;
  let found: ChoiceOption[] | null = null;

  function walk(node: JSONContent): void {
    if (found) return;
    if (node.type === CHOICE_BLOCK_TYPE && node.attrs?.blockId === blockId) {
      found = readOptions(node);
      return;
    }
    node.content?.forEach(walk);
  }

  walk(content);
  return found;
}

/**
 * A copy of the scene's content with every `choiceBlock` node removed —
 * kept for any place that just wants "the prose, no choices" (the Play
 * runtime itself renders via runtime/documentSegments.ts instead, which
 * preserves document order rather than stripping choices out).
 */
export function stripChoiceBlocks(content: JSONContent | undefined | null): JSONContent {
  const EMPTY: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };
  if (!content) return EMPTY;

  function walk(node: JSONContent): JSONContent {
    if (!node.content) return node;
    return {
      ...node,
      content: node.content
        .filter((child) => child.type !== CHOICE_BLOCK_TYPE)
        .map(walk),
    };
  }

  return walk(content);
}

/**
 * Returns a deep copy of `content` with every choiceBlock's `blockId` and
 * every option's `id` replaced with a fresh id — used whenever a Scene is
 * copied, so the copy's choices are distinct nodes rather than two scenes
 * claiming the same block ids.
 *
 * `sceneIdMap` handles the case where a WHOLE SET of scenes is copied at
 * once (a multi-scene duplicate, or a paste). Any choice pointing at a
 * scene inside that set is rewritten to point at that scene's copy, so
 * copying a two-scene branch gives you a branch — the copies link to each
 * other, not back to the originals. A choice pointing at a scene *outside*
 * the set is left alone, which is equally deliberate: copying a scene that
 * leads to Chapter Three should still lead to Chapter Three.
 *
 * Omit the map (a single-scene duplicate) and every destination is left
 * untouched, which is the behaviour this function has always had.
 */
export function regenerateChoiceIds(
  content: JSONContent | undefined | null,
  sceneIdMap?: ReadonlyMap<string, string>,
): JSONContent {
  const EMPTY: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };
  if (!content) return EMPTY;

  function walk(node: JSONContent): JSONContent {
    if (node.type === CHOICE_OPTION_TYPE) {
      const attrs = node.attrs ?? {};
      const target = attrs.targetSceneId as string | null;
      return {
        ...node,
        attrs: {
          ...attrs,
          optionId: nanoid(),
          targetSceneId: target && sceneIdMap?.has(target) ? sceneIdMap.get(target)! : target,
          actions: ((attrs.actions as { id: string }[]) ?? []).map((a) => ({ ...a, id: nanoid() })),
          conditions: ((attrs.conditions as { id: string }[]) ?? []).map((c) => ({
            ...c,
            id: nanoid(),
          })),
        },
      };
    }
    if (node.type === CHOICE_BLOCK_TYPE) {
      return {
        ...node,
        attrs: { ...node.attrs, blockId: nanoid() },
        content: node.content?.map(walk),
      };
    }
    if (!node.content) return node;
    return { ...node, content: node.content.map(walk) };
  }

  return walk(content);
}

/** The shape `buildChoiceOptionNode` takes — everything but the label's formatting. */
export interface ChoiceOptionSeed {
  id?: string;
  text?: string;
  targetSceneId?: string | null;
  actions?: VariableAction[];
  conditions?: VariableCondition[];
  whenUnmet?: "hide" | "lock";
  style?: Record<string, unknown> | null;
}

/** One `choiceOption` node, its label as real inline content. */
export function buildChoiceOptionNode(seed: ChoiceOptionSeed = {}): JSONContent {
  const text = seed.text ?? "";
  return {
    type: CHOICE_OPTION_TYPE,
    attrs: {
      optionId: seed.id ?? nanoid(),
      targetSceneId: seed.targetSceneId ?? null,
      actions: seed.actions ?? [],
      conditions: seed.conditions ?? [],
      whenUnmet: seed.whenUnmet ?? "hide",
      style: seed.style ?? null,
    },
    // An empty label is an empty node, NOT a text node with an empty
    // string: ProseMirror rejects zero-length text nodes outright, and a
    // fresh choice always starts empty.
    content: text ? [{ type: "text", text }] : [],
  };
}

/**
 * Builds a `choiceBlock` node ready to insert into a Tiptap document. With
 * no arguments it's a fresh block with two empty options — a reasonable
 * default for "branch the story", easy to trim to one or grow further from
 * the block's own "+ Add Choice" button.
 */
export function buildChoiceBlockNode(
  options: ChoiceOptionSeed[] = [{}, {}],
  blockId = nanoid(),
): JSONContent {
  return {
    type: CHOICE_BLOCK_TYPE,
    attrs: { blockId },
    content: options.map(buildChoiceOptionNode),
  };
}

/**
 * Brings older documents up to the current Choice Block shape. Two
 * generations are handled, and both are no-ops on content that's already
 * current:
 *
 *  - pre-v0.7.0: one option per block, flat on the node's attributes
 *    (`{choiceId, text, targetSceneId}`, no list at all);
 *  - pre-v0.32.0: the whole option list in an `options` attribute, each
 *    label a plain string.
 *
 * The second is the one that matters now. A label moves from a string in an
 * attribute to inline content in a real `choiceOption` node, which is what
 * lets the toolbar, undo, find and Play Mode's own renderer treat choice
 * text as the prose it always was. Everything else about an option moves to
 * that node's attributes unchanged, so no destination, condition or action
 * is touched by the conversion.
 */
export function migrateLegacyChoiceBlocks(content: JSONContent | undefined | null): JSONContent {
  const EMPTY: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };
  if (!content) return EMPTY;

  function walk(node: JSONContent): JSONContent {
    if (node.type === CHOICE_BLOCK_TYPE) {
      // Already current: it has real option children and no legacy attrs.
      const hasOptionNodes = node.content?.some((c) => c.type === CHOICE_OPTION_TYPE);
      if (hasOptionNodes && !node.attrs?.options) return node;

      const attrs = node.attrs ?? {};
      const legacyList = Array.isArray(attrs.options)
        ? (attrs.options as ChoiceOptionSeed[])
        : [
            {
              id: (attrs.choiceId as string) ?? undefined,
              text: (attrs.text as string) ?? "",
              targetSceneId: (attrs.targetSceneId as string | null) ?? null,
            },
          ];

      return {
        type: CHOICE_BLOCK_TYPE,
        attrs: { blockId: (attrs.blockId as string) ?? nanoid() },
        content: legacyList.map(buildChoiceOptionNode),
      };
    }
    if (!node.content) return node;
    return { ...node, content: node.content.map(walk) };
  }

  return walk(content);
}
