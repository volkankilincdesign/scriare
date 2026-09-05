import { nanoid } from "nanoid";
import type { JSONContent } from "@tiptap/react";
import type { Choice } from "../types/project";

export const CHOICE_BLOCK_TYPE = "choiceBlock";

/** One option inside a Choice Block — a Choice Block holds one or more of these. */
export interface ChoiceOption {
  id: string;
  text: string;
  targetSceneId: string | null;
}

function readOptions(attrs: Record<string, unknown> | undefined): ChoiceOption[] {
  const raw = attrs?.options;
  if (!Array.isArray(raw)) return [];
  return raw.map((option) => ({
    id: (option?.id as string) ?? nanoid(),
    text: (option?.text as string) ?? "",
    targetSceneId: (option?.targetSceneId as string | null) ?? null,
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
 * every option's `id` replaced with a fresh id — used when duplicating a
 * Scene, so the copy's choices are distinct nodes (each option's
 * `targetSceneId` is left untouched, so the duplicate still branches to the
 * same destinations as the original).
 */
export function regenerateChoiceIds(content: JSONContent | undefined | null): JSONContent {
  const EMPTY: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };
  if (!content) return EMPTY;

  function walk(node: JSONContent): JSONContent {
    if (node.type === CHOICE_BLOCK_TYPE) {
      return {
        ...node,
        attrs: {
          ...node.attrs,
          blockId: nanoid(),
          options: readOptions(node.attrs).map((option) => ({ ...option, id: nanoid() })),
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
    { id: nanoid(), text: "", targetSceneId: null },
    { id: nanoid(), text: "", targetSceneId: null },
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
