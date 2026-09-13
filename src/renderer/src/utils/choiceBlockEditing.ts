import type { Editor } from "@tiptap/react";
import { CHOICE_BLOCK_TYPE } from "./choiceBlocks";
import type { ChoiceOption } from "./choiceBlocks";
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
 * Sprint 9B — replaces one Choice Block's entire option list (add, remove,
 * reorder, or edit any field of any option all go through this one
 * function) via a direct ProseMirror transaction on the live editor
 * instance, rather than writing to `project.scenes` in the store directly.
 *
 * See state/editorStore.ts's comment for why this has to be a real editor
 * transaction: it's what keeps the mounted Tiptap document and the saved
 * project in sync no matter which surface (the editor's own NodeView, or
 * the Inspector) made the edit, since the transaction's own `onUpdate` is
 * the single path that persists to `project.scenes`.
 *
 * An empty `options` array removes the whole Choice Block node instead of
 * leaving a block with nothing in it — the same "last option removed ⇒
 * block goes away" behavior the editor's own NodeView already had.
 *
 * Returns `false` (no-op) if the block isn't found — e.g. the Inspector
 * still has a now-deleted block targeted.
 */
export function applyChoiceBlockOptions(
  editor: Editor,
  blockId: string,
  options: ChoiceOption[],
): boolean {
  let found = false;
  const { tr } = editor.state;

  editor.state.doc.descendants((node, pos) => {
    if (found) return false;
    if (node.type.name === CHOICE_BLOCK_TYPE && node.attrs.blockId === blockId) {
      found = true;
      if (options.length === 0) {
        tr.delete(pos, pos + node.nodeSize);
      } else {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, options });
      }
      return false;
    }
    return true;
  });

  if (!found) return false;
  editor.view.dispatch(tr);
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
