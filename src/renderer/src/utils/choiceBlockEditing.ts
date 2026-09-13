import type { Editor } from "@tiptap/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { CHOICE_BLOCK_TYPE, CHOICE_OPTION_TYPE, buildChoiceOptionNode } from "./choiceBlocks";
import type { VariableCondition } from "../types/variables";

export const CONDITIONAL_BLOCK_TYPE = "conditionalBlock";

/** Reads one Conditional Block's conditions out of the live document. */
export function findConditionalBlockConditions(
  content: import("@tiptap/react").JSONContent | undefined | null,
  blockId: string,
): VariableCondition[] | null {
  if (!content) return null;
  let found: VariableCondition[] | null = null;

  function walk(node: import("@tiptap/react").JSONContent): void {
    if (found) return;
    if (node.type === CONDITIONAL_BLOCK_TYPE && node.attrs?.blockId === blockId) {
      found = Array.isArray(node.attrs?.conditions)
        ? (node.attrs.conditions as VariableCondition[])
        : [];
      return;
    }
    node.content?.forEach(walk);
  }

  walk(content);
  return found;
}

/**
 * Applies one option's non-text properties — destination, conditions,
 * actions, appearance — through a real transaction on the live editor.
 *
 * The label is deliberately NOT settable here. Since v0.32.0 it is inline
 * content the writer types directly (see ChoiceOptionView), so writing it
 * from a panel would mean two writers for the same text and the desync
 * that always follows. Everything else about an option is structured data
 * edited through controls, and that is what this moves.
 *
 * Returns false when the option isn't found — e.g. the Inspector still has
 * a now-deleted choice targeted.
 */
export function applyChoiceOptionAttrs(
  editor: Editor,
  optionId: string,
  attrs: Record<string, unknown>,
): boolean {
  let found = false;
  const { tr } = editor.state;

  editor.state.doc.descendants((node, pos) => {
    if (found) return false;
    if (node.type.name === CHOICE_OPTION_TYPE && node.attrs.optionId === optionId) {
      found = true;
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs });
      return false;
    }
    return true;
  });

  if (!found) return false;
  editor.view.dispatch(tr);
  return true;
}

/** Removes one option. Removing the last one takes the whole block with it,
 *  the way it always has — an empty Choice Block is a branching point that
 *  doesn't branch. */
export function removeChoiceOption(editor: Editor, optionId: string): boolean {
  interface OptionSite {
    pos: number;
    size: number;
    parentPos: number;
    parentSize: number;
  }
  let target: OptionSite | null = null;

  editor.state.doc.descendants((node, pos) => {
    if (target) return false;
    if (node.type.name !== CHOICE_BLOCK_TYPE) return true;
    node.forEach((child, offset) => {
      if (target) return;
      if (child.type.name === CHOICE_OPTION_TYPE && child.attrs.optionId === optionId) {
        target = {
          pos: pos + 1 + offset,
          size: child.nodeSize,
          parentPos: pos,
          parentSize: node.nodeSize,
        };
      }
    });
    return false;
  });

  if (!target) return false;
  const { tr } = editor.state;
  const t: OptionSite = target;
  // `nodeSize - 2` is the block's content size; if the option being removed
  // accounts for all of it, the block is left empty and goes too.
  if (t.size >= t.parentSize - 2) tr.delete(t.parentPos, t.parentPos + t.parentSize);
  else tr.delete(t.pos, t.pos + t.size);
  editor.view.dispatch(tr);
  return true;
}

/** Reorders one block's options — what the Inspector's drag-to-reorder commits. */
export function reorderChoiceOptions(editor: Editor, blockId: string, order: string[]): boolean {
  interface BlockSite {
    pos: number;
    node: ProseMirrorNode;
  }
  let found: BlockSite | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (found) return false;
    if (node.type.name === CHOICE_BLOCK_TYPE && node.attrs.blockId === blockId) {
      found = { pos, node };
      return false;
    }
    return true;
  });
  if (!found) return false;

  const f: BlockSite = found;
  const children: ProseMirrorNode[] = [];
  f.node.forEach((child) => children.push(child));

  const byId = new Map(children.map((c) => [c.attrs.optionId as string, c]));
  const reordered = order.map((id) => byId.get(id)).filter((c): c is ProseMirrorNode => Boolean(c));
  // Anything the caller didn't mention keeps its place at the end rather
  // than being dropped — a reorder must never lose a choice.
  for (const child of children) {
    if (!order.includes(child.attrs.optionId as string)) reordered.push(child);
  }
  if (reordered.length !== children.length) return false;

  const { tr } = editor.state;
  tr.replaceWith(f.pos + 1, f.pos + f.node.nodeSize - 1, reordered);
  editor.view.dispatch(tr);
  return true;
}

/**
 * Adds a fresh empty option to the end of a block and puts the caret in it,
 * because the next thing anyone wants after adding a choice is to type it.
 *
 * Takes the block's id rather than its position: a caller holding a stale
 * position after some other edit would insert into the middle of unrelated
 * content, and every caller has the id to hand anyway.
 */
export function appendChoiceOption(editor: Editor, blockId: string): boolean {
  let blockPos = -1;
  let blockSize = 0;
  editor.state.doc.descendants((node, pos) => {
    if (blockPos !== -1) return false;
    if (node.type.name === CHOICE_BLOCK_TYPE && node.attrs.blockId === blockId) {
      blockPos = pos;
      blockSize = node.nodeSize;
      return false;
    }
    return true;
  });
  if (blockPos === -1) return false;

  const insertAt = blockPos + blockSize - 1;
  const option = editor.schema.nodeFromJSON(buildChoiceOptionNode());
  const { tr } = editor.state;
  tr.insert(insertAt, option);
  editor.view.dispatch(tr);
  editor.commands.focus(insertAt + 1);
  return true;
}

/**
 * The same idea for a Conditional Block's condition list (v0.30.0): one
 * ProseMirror transaction on the live editor, so the mounted document and
 * the saved project can't diverge whatever edited them.
 *
 * Unlike a Choice Block, an empty list does NOT remove the node. A
 * conditional section with no conditions is a perfectly sensible thing to
 * have mid-write — you wrap the prose first and decide the gate after —
 * and it renders unconditionally until you fill it in, which is exactly
 * what an empty condition list means everywhere else. Deleting the writer's
 * paragraphs because they cleared a dropdown would be unforgivable.
 */
export function applyConditionalBlockConditions(
  editor: Editor,
  blockId: string,
  conditions: VariableCondition[],
): boolean {
  let found = false;
  const { tr } = editor.state;

  editor.state.doc.descendants((node, pos) => {
    if (found) return false;
    if (node.type.name === CONDITIONAL_BLOCK_TYPE && node.attrs.blockId === blockId) {
      found = true;
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, conditions });
      return false;
    }
    return true;
  });

  if (!found) return false;
  editor.view.dispatch(tr);
  return true;
}
