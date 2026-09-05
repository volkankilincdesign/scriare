import type { JSONContent } from "@tiptap/react";
import { RUNTIME_BLOCK_TYPES } from "./registry";

/**
 * A scene's document, split into ordered segments: runs of ordinary content
 * (rendered as static HTML) and individual runtime blocks (rendered by their
 * own registered component — see registry.ts). This is what lets Play Mode
 * render a scene top-to-bottom exactly as written — paragraph, paragraph,
 * Choice Block, paragraph, divider, paragraph — instead of stripping
 * interactive blocks out and rendering them all bunched together elsewhere.
 * Only walks the top-level `doc.content` array, matching how narrative
 * blocks are always inserted (at the top level via the slash menu / toolbar).
 */
export type DocumentSegment =
  | { kind: "prose"; content: JSONContent }
  | { kind: "block"; node: JSONContent };

export function splitDocumentIntoSegments(content: JSONContent | undefined | null): DocumentSegment[] {
  const nodes = content?.content ?? [];
  const segments: DocumentSegment[] = [];
  let buffer: JSONContent[] = [];

  function flushBuffer(): void {
    if (buffer.length === 0) return;
    segments.push({ kind: "prose", content: { type: "doc", content: buffer } });
    buffer = [];
  }

  for (const node of nodes) {
    if (node.type && RUNTIME_BLOCK_TYPES.has(node.type)) {
      flushBuffer();
      segments.push({ kind: "block", node });
    } else {
      buffer.push(node);
    }
  }
  flushBuffer();

  return segments;
}
