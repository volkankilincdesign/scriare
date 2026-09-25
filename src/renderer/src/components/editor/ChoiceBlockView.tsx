import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useInspectorStore } from "../../state/inspectorStore";
import { useProjectStore } from "../../state/projectStore";
import { appendChoiceOption } from "../../utils/choiceBlockEditing";

/**
 * A Choice Block in the writing surface (v0.32.0).
 *
 * This used to be a read-only preview of an atom node, because the block's
 * options lived in an attribute and there was nothing here to edit. Now the
 * options are real child nodes with editable labels, so this is a genuine
 * container: `<NodeViewContent>` renders them and the writer types straight
 * into the choices, where the choices are.
 *
 * The block's chrome — the header, the add button, the hint — sits outside
 * the editable region so the caret can't land in it.
 */
export function ChoiceBlockView({ node, deleteNode, selected, editor }: NodeViewProps) {
  const selectTarget = useInspectorStore((s) => s.selectTarget);
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
  const count = node.childCount;

  /**
   * Clicking the block's chrome selects the block — by putting the caret in
   * it (v0.34.1).
   *
   * The version before this only pointed the Inspector at the block and
   * deliberately left the caret alone. That was wrong in a way that looked
   * right: the click still travelled on to ProseMirror, which placed the
   * caret at the nearest editable position — OUTSIDE the block, since the
   * header isn't editable — and the selection handler then saw a caret in
   * ordinary prose and cleared the Inspector straight back to Scene
   * Properties. The panel opened and closed within the same click.
   *
   * Placing the caret in the block's first choice makes one thing true
   * instead of two: the Inspector shows what the caret is in, always, with
   * no second mechanism that can disagree with it.
   */
  function focusInspector(e: ReactMouseEvent): void {
    const blockId = node.attrs.blockId as string | undefined;
    if (!blockId || !selectedSceneId) return;
    // Stops ProseMirror placing its own caret from this click — this
    // handler is choosing where the caret goes.
    e.preventDefault();

    let inside = -1;
    editor.state.doc.descendants((candidate, pos) => {
      if (inside !== -1) return false;
      if (candidate.type.name === "choiceBlock" && candidate.attrs.blockId === blockId) {
        // +1 into the block, +1 into its first option.
        inside = pos + 2;
        return false;
      }
      return true;
    });

    if (inside === -1) {
      selectTarget({ kind: "choice", sceneId: selectedSceneId, blockId });
      return;
    }
    // The selection handler picks the Inspector target up from here, so
    // there is no second call to make.
    editor.chain().focus().setTextSelection(inside).run();
  }

  function addChoice(e: ReactMouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    const blockId = node.attrs.blockId as string | undefined;
    if (blockId) appendChoiceOption(editor, blockId);
  }

  return (
    <NodeViewWrapper
      className={`choice-block my-3 rounded-md border px-3 py-2.5 transition-colors ${
        selected
          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
          : "border-[var(--border)] bg-[var(--surface-2-faint)]"
      }`}
    >
      <div
        contentEditable={false}
        onMouseDown={focusInspector}
        className="scriare-section-label mb-1.5 flex select-none items-center gap-1.5 text-[var(--accent)]"
      >
        <span aria-hidden>⤷</span>
        <span>Choice</span>
        <span className="font-normal normal-case text-[var(--text-3)]">
          ({count} {count === 1 ? "option" : "options"})
        </span>
      </div>

      <NodeViewContent className="scriare-choice-options" />

      <div
        contentEditable={false}
        className="mt-1.5 flex select-none items-center justify-between"
      >
        <span className="text-xs text-[var(--text-3)]">
          Type the choices here · destinations and conditions in the Inspector →
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={addChoice}
            title="Add another choice to this block"
            className="rounded px-1.5 py-0.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-soft-2)]"
          >
            + Add Choice
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => deleteNode()}
            title="Remove this entire Choice Block"
            className="rounded px-1.5 py-0.5 text-xs text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"
          >
            Remove block
          </button>
        </div>
      </div>
    </NodeViewWrapper>
  );
}
