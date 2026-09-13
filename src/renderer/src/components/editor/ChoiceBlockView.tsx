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
   * Focuses this block in the Inspector without stealing the caret.
   *
   * The old version set a ProseMirror NodeSelection over the whole block on
   * mousedown, because an atom node had no inside to put a cursor in. That
   * would now fight the writer: clicking a choice has to place a caret in
   * its label, which is the whole reason this schema changed. So the
   * Inspector is pointed at the block directly instead — SceneEditor's
   * selection handler does the same thing whenever the caret is inside a
   * choice, and this covers a click on the block's own chrome.
   */
  function focusInspector(): void {
    const blockId = node.attrs.blockId as string | undefined;
    if (!blockId || !selectedSceneId) return;
    selectTarget({ kind: "choice", sceneId: selectedSceneId, blockId });
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
          : "border-[var(--border)] bg-[var(--overlay)]"
      }`}
    >
      <div
        contentEditable={false}
        onMouseDown={focusInspector}
        className="mb-1.5 flex select-none items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--accent)]"
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
