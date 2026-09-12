import type { Editor } from "@tiptap/react";
import { CHOICE_BLOCK_TYPE } from "./choiceBlocks";
import type { ChoiceOption } from "./choiceBlocks";

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
