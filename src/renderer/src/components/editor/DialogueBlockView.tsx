import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useInspectorStore } from "../../state/inspectorStore";
import { useProjectStore } from "../../state/projectStore";
import { appendDialogueLine, DIALOGUE_BLOCK_TYPE } from "../../utils/dialogueBlocks";
import type { DialogueAfter } from "../../types/nodeTypes";

/**
 * The Dialogue, while writing (v0.66.0).
 *
 * THE HEADER HAS TO DO THE TEACHING. "Dialogue" on its own is ambiguous in
 * exactly the way the naming decision warned about — a scene already
 * contains dialogue — so the block says what it is beside its own name:
 * *stays on this page*. It is four words and it is the difference between
 * a writer understanding the block on sight and guessing at it.
 *
 * The footer states the one fact a writer needs to trust the block: what
 * is written BELOW it waits until the conversation closes. That sentence
 * is the feature, and it is invisible until you play — so it is said here.
 */
export function DialogueBlockView({ node, deleteNode, selected, editor }: NodeViewProps) {
  const selectTarget = useInspectorStore((s) => s.selectTarget);
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);

  const lines = node.childCount;
  let exits = 0;
  let closes = false;
  node.forEach((child) => {
    const after = (child.attrs.after as DialogueAfter) ?? "stay";
    if (after === "leave") exits += 1;
    if (after === "end" || after === "leave") closes = true;
    if (after === "stay" && !child.attrs.repeatable) closes = true;
  });

  function focusInspector(e: ReactMouseEvent): void {
    const blockId = node.attrs.blockId as string | undefined;
    if (!blockId || !selectedSceneId) return;
    e.preventDefault();

    let inside = -1;
    editor.state.doc.descendants((candidate, pos) => {
      if (inside !== -1) return false;
      if (candidate.type.name === DIALOGUE_BLOCK_TYPE && candidate.attrs.blockId === blockId) {
        // +1 into the block, +1 into its first line.
        inside = pos + 2;
        return false;
      }
      return true;
    });

    if (inside === -1) {
      selectTarget({ kind: "dialogue", sceneId: selectedSceneId, blockId });
      return;
    }
    editor.chain().focus().setTextSelection(inside).run();
  }

  function addLine(e: ReactMouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    const blockId = node.attrs.blockId as string | undefined;
    if (blockId) appendDialogueLine(editor, blockId);
  }

  return (
    <NodeViewWrapper
      className={`dialogue-block my-3 rounded-md border px-3 py-2.5 transition-colors ${
        selected
          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
          : "border-[var(--border)] bg-[var(--surface-2-faint)]"
      }`}
      data-dialogue-block={node.attrs.blockId ?? undefined}
    >
      <div
        contentEditable={false}
        onMouseDown={focusInspector}
        className="scriare-section-label mb-1.5 flex select-none items-center gap-1.5 text-[var(--accent)]"
      >
        <span aria-hidden>◆</span>
        <span>Dialogue</span>
        <span className="font-normal normal-case text-[var(--text-3)]">
          — stays on this page
        </span>
        <span className="ml-auto font-normal normal-case text-[var(--text-3)]">
          {lines} {lines === 1 ? "line" : "lines"}
          {exits > 0 && ` · ${exits} ${exits === 1 ? "exit" : "exits"}`}
        </span>
      </div>

      <NodeViewContent className="scriare-dialogue-lines flex flex-col gap-1.5" />

      <div contentEditable={false} className="mt-1.5 flex select-none items-center justify-between gap-2">
        {/* The one thing that is true and invisible until you play it. */}
        <span className="min-w-0 text-xs text-[var(--text-3)]">
          {closes ? (
            <>Anything written below waits until this conversation ends.</>
          ) : (
            <span className="text-[var(--warning)]">
              Nothing ends this conversation — the reader will be stuck here.
            </span>
          )}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={addLine}
            title="Add another line to this conversation"
            className="rounded px-1.5 py-0.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-soft-2)]"
          >
            + Line
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => deleteNode()}
            title="Remove this entire Dialogue"
            className="rounded px-1.5 py-0.5 text-xs text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"
          >
            Remove block
          </button>
        </div>
      </div>
    </NodeViewWrapper>
  );
}
