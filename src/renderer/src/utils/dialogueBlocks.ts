import { nanoid } from "nanoid";
import type { JSONContent } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { VariableAction, VariableCondition } from "../types/variables";
import type { Speaker } from "../types/speaker";
import { DIALOGUE_BLOCK_TYPE, DIALOGUE_LINE_TYPE } from "../types/nodeTypes";
import type { DialogueAfter } from "../types/nodeTypes";

export { DIALOGUE_BLOCK_TYPE, DIALOGUE_LINE_TYPE };
export type { DialogueAfter };

/**
 * The Dialogue's lines, read out of and written into a document (v0.66.0).
 *
 * This is `choiceBlocks.ts` for the other block, and it is deliberately a
 * separate file rather than a widened version of it. The two node types
 * mean opposite things — a choice leaves the scene, a dialogue line stays
 * in it — and the one thing every downstream surface needs (Check Story,
 * the graph, Script Export) is to be able to tell them apart without
 * inspecting attributes. One reader that returned both would put that
 * decision back into every caller.
 */

export interface DialogueLine {
  /**
   * Stable for the life of the line. This is the id the spreadsheet export
   * will key on, which is why it is generated once at insert and never
   * recomputed from position.
   */
  id: string;
  /** The player's line, flattened. The node keeps the real inline content. */
  text: string;
  /** Who says the line itself — usually the player. */
  speaker: Speaker;
  /** What comes back. Flat text, by decision: see the note in the block. */
  reply: string;
  /** Who gives the reply. An inner voice answering is the whole point. */
  replySpeaker: Speaker;
  after: DialogueAfter;
  /** Only meaningful when `after` is "leave". */
  targetSceneId: string | null;
  /** A line that does not leave the list when it has been said. */
  repeatable: boolean;
  conditions: VariableCondition[];
  actions: VariableAction[];
  whenUnmet: "hide" | "lock";
  style: Record<string, unknown> | null;
  /** The line's own node, so a renderer can draw its formatting. */
  node?: JSONContent;
}

export interface DialogueLineSeed {
  id?: string;
  text?: string;
  speaker?: Speaker;
  reply?: string;
  replySpeaker?: Speaker;
  after?: DialogueAfter;
  targetSceneId?: string | null;
  repeatable?: boolean;
  conditions?: VariableCondition[];
  actions?: VariableAction[];
  whenUnmet?: "hide" | "lock";
  style?: Record<string, unknown> | null;
}

export function buildDialogueLineNode(seed: DialogueLineSeed = {}): JSONContent {
  const text = seed.text ?? "";
  return {
    type: DIALOGUE_LINE_TYPE,
    attrs: {
      lineId: seed.id ?? nanoid(),
      speaker: seed.speaker ?? "@player",
      reply: seed.reply ?? "",
      replySpeaker: seed.replySpeaker ?? null,
      after: seed.after ?? "stay",
      targetSceneId: seed.targetSceneId ?? null,
      repeatable: seed.repeatable ?? false,
      conditions: seed.conditions ?? [],
      actions: seed.actions ?? [],
      whenUnmet: seed.whenUnmet ?? "hide",
      style: seed.style ?? null,
    },
    // Empty label is an empty node, never a zero-length text node —
    // ProseMirror rejects those outright. Same rule as a choice option.
    content: text ? [{ type: "text", text }] : [],
  };
}

export function buildDialogueBlockNode(
  lines: DialogueLineSeed[] = [{}, {}],
  blockId = nanoid(),
): JSONContent {
  return {
    type: DIALOGUE_BLOCK_TYPE,
    attrs: { blockId },
    content: lines.map(buildDialogueLineNode),
  };
}

/** Flattens a node's inline content, resolving mentions through `resolve`. */
function flatten(node: JSONContent, resolve?: (id: string | null, stored: string) => string): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "mention") {
    const stored = (node.attrs?.label as string) ?? "";
    return resolve ? resolve((node.attrs?.entityId as string) ?? null, stored) : stored;
  }
  return (node.content ?? []).map((c) => flatten(c, resolve)).join("");
}

function readLine(node: JSONContent, resolve?: (id: string | null, stored: string) => string): DialogueLine {
  const attrs = node.attrs ?? {};
  return {
    id: (attrs.lineId as string) ?? "",
    text: flatten(node, resolve),
    speaker: (attrs.speaker as Speaker) ?? null,
    reply: (attrs.reply as string) ?? "",
    replySpeaker: (attrs.replySpeaker as Speaker) ?? null,
    after: (attrs.after as DialogueAfter) ?? "stay",
    targetSceneId: (attrs.targetSceneId as string | null) ?? null,
    repeatable: Boolean(attrs.repeatable),
    conditions: Array.isArray(attrs.conditions) ? (attrs.conditions as VariableCondition[]) : [],
    actions: Array.isArray(attrs.actions) ? (attrs.actions as VariableAction[]) : [],
    whenUnmet: attrs.whenUnmet === "lock" ? "lock" : "hide",
    style: (attrs.style as Record<string, unknown> | null) ?? null,
    node,
  };
}

/** Every Dialogue line in a document, in reading order. */
export function extractDialogueLines(
  content: JSONContent | undefined | null,
  resolve?: (id: string | null, stored: string) => string,
): DialogueLine[] {
  const found: DialogueLine[] = [];
  if (!content) return found;
  (function walk(node: JSONContent): void {
    if (node.type === DIALOGUE_LINE_TYPE) {
      found.push(readLine(node, resolve));
      return;
    }
    (node.content ?? []).forEach(walk);
  })(content);
  return found;
}

/** One block's lines, by its blockId. Null when there is no such block. */
export function findDialogueBlockLines(
  content: JSONContent | undefined | null,
  blockId: string,
  resolve?: (id: string | null, stored: string) => string,
): DialogueLine[] | null {
  if (!content) return null;
  let found: DialogueLine[] | null = null;
  (function walk(node: JSONContent): void {
    if (found) return;
    if (node.type === DIALOGUE_BLOCK_TYPE && node.attrs?.blockId === blockId) {
      found = (node.content ?? [])
        .filter((c) => c.type === DIALOGUE_LINE_TYPE)
        .map((c) => readLine(c, resolve));
      return;
    }
    (node.content ?? []).forEach(walk);
  })(content);
  return found;
}

/**
 * THE RULE EVERY DOWNSTREAM SURFACE SHARES: a Dialogue line is an edge
 * only if it leaves.
 *
 * Stated once, here, because Check Story, the Story Graph and Script
 * Export all need the same answer and three implementations of it would
 * drift the first time one of them was fixed. Board G6 agreed the rule;
 * this is the rule.
 */
export function dialogueExits(line: DialogueLine): boolean {
  return line.after === "leave";
}

/**
 * Can this conversation ever be closed?
 *
 * False is the "this conversation cannot be left" warning: every line
 * repeatable and none of them ending or leaving means the reader is held
 * on the page forever, and everything written below the block is
 * unreachable. A block with no lines at all closes immediately, which is
 * pointless but not a trap.
 */
export function dialogueCanClose(lines: DialogueLine[]): boolean {
  if (lines.length === 0) return true;
  if (lines.some((line) => line.after === "end" || line.after === "leave")) return true;
  // Otherwise it closes only by running out of things to say, which needs
  // at least one line that is spent when said.
  return lines.some((line) => !line.repeatable);
}

/** Writes new attributes onto one line in the live document. */
export function applyDialogueLineAttrs(
  editor: Editor,
  lineId: string,
  attrs: Record<string, unknown>,
): void {
  const { state, view } = editor;
  let at = -1;
  state.doc.descendants((node, pos) => {
    if (at !== -1) return false;
    if (node.type.name === DIALOGUE_LINE_TYPE && node.attrs.lineId === lineId) {
      at = pos;
      return false;
    }
    return true;
  });
  if (at === -1) return;
  const node = state.doc.nodeAt(at);
  if (!node) return;
  view.dispatch(state.tr.setNodeMarkup(at, undefined, { ...node.attrs, ...attrs }));
}

/**
 * Puts one block's lines in a given order (v0.67.0).
 *
 * The twin of `reorderChoiceOptions`, deliberately written the same way
 * down to the safeguard: a line the caller did not mention keeps its place
 * at the end rather than being dropped, and a reorder that would not come
 * back with every line it started with does nothing at all. **A reorder
 * must never lose a line** — it is one transaction, and a transaction that
 * silently drops a row is how a writer loses a conversation.
 */
export function reorderDialogueLines(editor: Editor, blockId: string, order: string[]): boolean {
  let at = -1;
  let block: ProseMirrorNode | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (at !== -1) return false;
    if (node.type.name === DIALOGUE_BLOCK_TYPE && node.attrs.blockId === blockId) {
      at = pos;
      block = node;
      return false;
    }
    return true;
  });
  if (at === -1 || !block) return false;

  const found: ProseMirrorNode = block;
  const children: ProseMirrorNode[] = [];
  found.forEach((child) => children.push(child));

  const byId = new Map(children.map((c) => [c.attrs.lineId as string, c]));
  const reordered = order.map((id) => byId.get(id)).filter((c): c is ProseMirrorNode => Boolean(c));
  for (const child of children) {
    if (!order.includes(child.attrs.lineId as string)) reordered.push(child);
  }
  if (reordered.length !== children.length) return false;

  const { tr } = editor.state;
  tr.replaceWith(at + 1, at + found.nodeSize - 1, reordered);
  editor.view.dispatch(tr);
  return true;
}

/** Adds an empty line to the end of one block. */
export function appendDialogueLine(editor: Editor, blockId: string): void {
  const { state, view } = editor;
  let at = -1;
  let size = 0;
  state.doc.descendants((node, pos) => {
    if (at !== -1) return false;
    if (node.type.name === DIALOGUE_BLOCK_TYPE && node.attrs.blockId === blockId) {
      at = pos;
      size = node.nodeSize;
      return false;
    }
    return true;
  });
  if (at === -1) return;
  const type = state.schema.nodes[DIALOGUE_LINE_TYPE];
  if (!type) return;
  const fresh = type.createAndFill(buildDialogueLineNode().attrs);
  if (!fresh) return;
  view.dispatch(state.tr.insert(at + size - 1, fresh));
}

/** Removes one line. The block goes with its last line. */
export function removeDialogueLine(editor: Editor, lineId: string): void {
  const { state, view } = editor;
  let lineAt = -1;
  let lineSize = 0;
  let blockAt = -1;
  let blockSize = 0;
  let siblings = 0;
  state.doc.descendants((node, pos) => {
    if (node.type.name === DIALOGUE_BLOCK_TYPE) {
      const holdsIt = (node.content as unknown as { content?: unknown[] }) && false;
      void holdsIt;
      node.forEach((child) => {
        if (child.type.name === DIALOGUE_LINE_TYPE && child.attrs.lineId === lineId) {
          blockAt = pos;
          blockSize = node.nodeSize;
          siblings = node.childCount;
        }
      });
    }
    if (node.type.name === DIALOGUE_LINE_TYPE && node.attrs.lineId === lineId) {
      lineAt = pos;
      lineSize = node.nodeSize;
    }
    return true;
  });
  if (lineAt === -1) return;
  if (siblings <= 1 && blockAt !== -1) {
    view.dispatch(state.tr.delete(blockAt, blockAt + blockSize));
    return;
  }
  view.dispatch(state.tr.delete(lineAt, lineAt + lineSize));
}

/**
 * Stamping every paragraph with an id it keeps (v0.66.0).
 *
 * Prose paragraphs carried no identity at all: a line was "the third
 * paragraph of scene 19", which is a name that changes the moment somebody
 * inserts a sentence above it. That is survivable for a script somebody
 * reads once and fatal for a translation memory, which is why the
 * spreadsheet export was queued behind this and not in front of it.
 *
 * Run once per scene on open, alongside the choice-block migrations, and a
 * no-op on anything already stamped. Deliberately additive: a paragraph
 * that already has a `lineId` keeps it, so ids survive every later open.
 */
export function stampParagraphIds(content: JSONContent | undefined | null): JSONContent {
  const EMPTY: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };
  if (!content) return EMPTY;

  let changed = false;

  function walk(node: JSONContent): JSONContent {
    const kids = node.content?.map(walk);
    const next: JSONContent = kids ? { ...node, content: kids } : { ...node };

    if (node.type === "paragraph" && !next.attrs?.lineId) {
      changed = true;
      next.attrs = { ...(next.attrs ?? {}), lineId: nanoid() };
    }
    return next;
  }

  const out = walk(content);
  return changed ? out : content;
}
