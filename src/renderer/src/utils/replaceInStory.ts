import type { JSONContent } from "@tiptap/react";
import { nodeSize } from "./findInStory";
import type { FindHit } from "./findInStory";

/**
 * Replace (v0.79.0) — Find's other half, eighteen versions late.
 *
 * WHAT IT WORKS ON, AND WHY THAT IS THE STORED JSON. Find searches the
 * documents in the store rather than the live editor, because only one
 * scene is ever open in ProseMirror and the other forty are JSON. Replace
 * has to do the same or it could only ever change the scene you are
 * looking at, which is not the feature. The open scene catches up because
 * `documentToken` makes the editor reload — see projectStore.
 *
 * DESCENDING ORDER IS THE WHOLE TRICK. Every position a hit carries was
 * computed against the document as it was; replacing "Mara" with "Meral"
 * makes every later position in that document wrong by one. Applying from
 * the END backwards means no edit can move a position that has not been
 * used yet, and nothing has to be recomputed. The alternative — tracking a
 * running offset — is the same arithmetic done in a way that is wrong the
 * first time somebody replaces text with text of the same length and stops
 * noticing.
 *
 * WHAT IT REFUSES TO TOUCH. A hit that runs through a mention, and a hit
 * on an entity's own name. Neither is text in the document: a mention is
 * an entity id wearing whatever that entity is currently called, and a
 * name hit is the entity record itself. Writing over either would swap a
 * live link for dead letters. `replaceableHits` is the filter, and the
 * panel says out loud what it skipped rather than quietly doing less than
 * it was asked.
 *
 * MARKS SURVIVE, and that is why this rebuilds text nodes rather than
 * lines. A line is a paragraph with several inline children — some bold,
 * some plain, some mentions — so the only safe unit is the text node. A
 * match that spans two of them (`Ma` plain, `ra` bold) puts the whole
 * replacement in the first and removes what it covered from the rest,
 * which keeps the first node's formatting and is what every editor does.
 */

/** A hit Replace is allowed to act on. */
export function isReplaceable(hit: FindHit): boolean {
  return !hit.touchesMention && hit.kind !== "name";
}

export function replaceableHits(hits: FindHit[]): FindHit[] {
  return hits.filter(isReplaceable);
}

/** How many of a set Replace would leave alone, and why. */
export function skipped(hits: FindHit[]): { mentions: number; names: number } {
  return {
    mentions: hits.filter((h) => h.touchesMention).length,
    names: hits.filter((h) => !h.touchesMention && h.kind === "name").length,
  };
}

/**
 * Applies a set of replacements to ONE document, returning a new one.
 *
 * `ranges` are ProseMirror positions in this document, as `findInStory`
 * computed them. They may arrive in any order; they are sorted here, so a
 * caller cannot get it wrong by passing the panel's display order.
 */
export function replaceInDocument(
  content: JSONContent | undefined | null,
  ranges: { from: number; to: number }[],
  replacement: string,
): { content: JSONContent | null; replaced: number } {
  if (!content || ranges.length === 0) {
    return { content: content ?? null, replaced: 0 };
  }

  // Descending, and de-duplicated: the same match can be listed twice if a
  // caller builds its set from two places, and applying it twice would
  // delete text either side of it.
  const seen = new Set<string>();
  const ordered = [...ranges]
    .filter((r) => {
      const key = `${r.from}:${r.to}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.from - a.from);

  const doc = JSON.parse(JSON.stringify(content)) as JSONContent;
  let replaced = 0;

  for (const range of ordered) {
    if (applyOne(doc, range, replacement)) replaced += 1;
  }

  // Emptied text nodes are removed, and this is not tidiness. ProseMirror's
  // schema has no such thing as an empty text node — `Fragment.fromJSON`
  // throws on one — so a match spanning `Ma` + bold `ra` would replace
  // correctly, leave `{text: "", marks: [bold]}` behind, and crash the
  // editor the next time that scene was opened. Measured on the first
  // build of this: the replacement was right and the document would not
  // load.
  if (replaced > 0) pruneEmptyText(doc);

  return { content: doc, replaced };
}

/**
 * One replacement, in place, walking the document to find the text nodes
 * the range covers.
 *
 * Returns false when the range does not land on text — a stale position,
 * or a hit somebody passed that should have been filtered out. Silence
 * would be worse: the count the panel reports is the count that happened.
 */
function applyOne(
  doc: JSONContent,
  range: { from: number; to: number },
  replacement: string,
): boolean {
  /** Every text node the range touches, with the slice of it covered. */
  const covered: { node: JSONContent; start: number; end: number }[] = [];

  (function walk(node: JSONContent, pos: number): void {
    if (typeof node.text === "string") {
      const nodeFrom = pos;
      const nodeTo = pos + node.text.length;
      const from = Math.max(range.from, nodeFrom);
      const to = Math.min(range.to, nodeTo);
      if (from < to) covered.push({ node, start: from - nodeFrom, end: to - nodeFrom });
      return;
    }
    // findInStory's OWN `nodeSize`, imported rather than copied. The first
    // draft of this file reimplemented it and got the empty-paragraph case
    // wrong — a node with no content is size 2 if it is a paragraph and 1
    // if it is a divider, and the difference lives in the schema rather
    // than in the document, which is exactly what that function's comment
    // warns about. Two copies of this arithmetic is how the positions Find
    // hands over start meaning something else here.
    let at = pos + (node.type === "doc" ? 0 : 1);
    for (const child of node.content ?? []) {
      walk(child, at);
      at += nodeSize(child);
    }
  })(doc, 0);

  if (covered.length === 0) return false;

  // First node keeps its marks and takes the whole replacement; the rest
  // lose what the match covered.
  covered.forEach((piece, index) => {
    const text = piece.node.text ?? "";
    piece.node.text =
      text.slice(0, piece.start) + (index === 0 ? replacement : "") + text.slice(piece.end);
  });

  return true;
}

/** Drops text nodes that a replacement emptied, at any depth. */
function pruneEmptyText(node: JSONContent): void {
  if (!node.content) return;
  node.content = node.content.filter((child) => !(typeof child.text === "string" && child.text.length === 0));
  for (const child of node.content) pruneEmptyText(child);
}
