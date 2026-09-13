import { nanoid } from "nanoid";
import type { JSONContent } from "@tiptap/react";
import type { Choice } from "../types/project";
import type { VariableAction, VariableCondition } from "../types/variables";

export const CHOICE_BLOCK_TYPE = "choiceBlock";

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
}

function readOptions(attrs: Record<string, unknown> | undefined): ChoiceOption[] {
  const raw = attrs?.options;
  if (!Array.isArray(raw)) return [];
  return raw.map((option) => ({
    id: (option?.id as string) ?? nanoid(),
    text: (option?.text as string) ?? "",
    targetSceneId: (option?.targetSceneId as string | null) ?? null,
    actions: Array.isArray(option?.actions) ? (option.actions as VariableAction[]) : [],
    // Defaulted here rather than migrated into every saved document: this
    // is the one place options are ever read, so an older project gets the
    // current shape for free the moment it's loaded, and nothing has to
    // rewrite files that were perfectly valid.
    conditions: Array.isArray(option?.conditions) ? (option.conditions as VariableCondition[]) : [],
    whenUnmet: option?.whenUnmet === "lock" ? "lock" : "hide",
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
      readOptions(node.attrs).forEach((option) => found.push({ ...option }));
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
      found = readOptions(node.attrs);
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
    if (node.type === CHOICE_BLOCK_TYPE) {
      return {
        ...node,
        attrs: {
          ...node.attrs,
          blockId: nanoid(),
          options: readOptions(node.attrs).map((option) => ({
            ...option,
            id: nanoid(),
            targetSceneId:
              option.targetSceneId && sceneIdMap?.has(option.targetSceneId)
                ? sceneIdMap.get(option.targetSceneId)!
                : option.targetSceneId,
            actions: option.actions.map((action) => ({ ...action, id: nanoid() })),
            conditions: option.conditions.map((condition) => ({ ...condition, id: nanoid() })),
          })),
        },
      };
    }
    if (!node.content) return node;
    return { ...node, content: node.content.map(walk) };
  }

  return walk(content);
}

/**
 * Builds a `choiceBlock` node ready to insert into a Tiptap document. With
 * no arguments it's a fresh block with two empty options — a reasonable
 * default for "branch the story", easy to trim down to one or grow further
 * from the block's own "+ Add option" button.
 */
export function buildChoiceBlockNode(
  options: ChoiceOption[] = [
    { id: nanoid(), text: "", targetSceneId: null, actions: [], conditions: [], whenUnmet: "hide" },
    { id: nanoid(), text: "", targetSceneId: null, actions: [], conditions: [], whenUnmet: "hide" },
  ],
  blockId = nanoid(),
): JSONContent {
  return {
    type: CHOICE_BLOCK_TYPE,
    attrs: { blockId, options },
  };
}

/**
 * Projects saved before this milestone stored a Choice Block as a single
 * `{choiceId, text, targetSceneId}` (one option per node, no `options`
 * array). Upgrades any such node in place into the new
 * `{blockId, options: [...]}` shape, one option carried over unchanged —
 * a no-op for content that's already in the new shape.
 */
export function migrateLegacyChoiceBlocks(content: JSONContent | undefined | null): JSONContent {
  const EMPTY: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };
  if (!content) return EMPTY;

  function walk(node: JSONContent): JSONContent {
    if (node.type === CHOICE_BLOCK_TYPE && !Array.isArray(node.attrs?.options)) {
      const attrs = node.attrs ?? {};
      return {
        ...node,
        attrs: {
          blockId: nanoid(),
          options: [
            {
              id: (attrs.choiceId as string) ?? nanoid(),
              text: (attrs.text as string) ?? "",
              targetSceneId: (attrs.targetSceneId as string | null) ?? null,
              actions: [],
              conditions: [],
              whenUnmet: "hide",
            },
          ],
        },
      };
    }
    if (!node.content) return node;
    return { ...node, content: node.content.map(walk) };
  }

  return walk(content);
}
