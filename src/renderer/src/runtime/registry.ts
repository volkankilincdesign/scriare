import type { ReactNode } from "react";
import type { JSONContent } from "@tiptap/react";
import type { RuntimeBlockDefinition, RuntimeContext } from "./types";
import { choiceRuntimeBlock } from "./blocks/choiceRuntimeBlock";
import { conditionalRuntimeBlock } from "./blocks/conditionalRuntimeBlock";

/**
 * Every narrative block the Play runtime knows how to render, keyed by the
 * Tiptap node type it owns. This is the runtime's one extension point —
 * adding a future block (Variables, Conditions, Images, Dialogue, Embedded
 * widgets, ...) means adding one more entry here and giving it its own file
 * under runtime/blocks/, nothing else: the document-splitting and rendering
 * loop in documentSegments.ts / PlayRuntime.tsx never needs to change.
 */
export const RUNTIME_BLOCKS: RuntimeBlockDefinition[] = [
  choiceRuntimeBlock,
  conditionalRuntimeBlock,
];

/**
 * Node types that must be rendered as their own segment rather than folded
 * into the surrounding static HTML — anything in this set breaks the prose
 * around it into its own step in `splitDocumentIntoSegments`.
 */
export const RUNTIME_BLOCK_TYPES: Set<string> = new Set(RUNTIME_BLOCKS.map((b) => b.nodeType));

const definitionsByType = new Map(RUNTIME_BLOCKS.map((b) => [b.nodeType, b]));

/** Looks up and invokes the registered renderer for a runtime block node. */
export function renderRuntimeBlock(
  node: JSONContent,
  context: RuntimeContext,
  key: string | number,
): ReactNode {
  const definition = node.type ? definitionsByType.get(node.type) : undefined;
  return definition ? definition.render(node, context, key) : null;
}
