import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { nanoid } from "nanoid";
import { useProjectStore } from "../../state/projectStore";
import type { ChoiceOption } from "../../utils/choiceBlocks";
import { applyChoiceBlockOptions } from "../../utils/choiceBlockEditing";

/**
 * Sprint 9B — Choice Block Inspector Refactor. This NodeView used to BE the
 * choice-editing UI (per-option text/destination inputs, add/remove,
 * reorder buttons) sitting inline in the document. All of that behavior
 * editing has moved to the Inspector's new Choices accordion — this view is
 * now a compact, read-only preview: what the block contains, at a glance,
 * so the editor stays a writing surface rather than a form. Clicking
 * anywhere in the block selects it as one object (a ProseMirror
 * NodeSelection), which is what tells SceneEditor's onSelectionUpdate to
 * switch the Inspector to this block's Choice Properties.
 */
export function ChoiceBlockView({ node, deleteNode, selected, editor, getPos }: NodeViewProps) {
  const project = useProjectStore((s) => s.project);
  const options = (node.attrs.options as ChoiceOption[] | undefined) ?? [];

  function destinationLabel(targetSceneId: string | null): string {
    if (!targetSceneId) return "Not linked yet";
    const target = project?.scenes.find((s) => s.id === targetSceneId);
    return target ? `→ ${target.title || "Untitled scene"}` : "Not linked yet";
  }

  // Selecting the block on `mousedown` (not `click`) and calling
  // `preventDefault()` matters: this NodeView's DOM is `contentEditable=
  // false`, so a plain click inside it makes the *browser* place its own
  // native caret in the nearest editable text (a neighboring paragraph,
  // often nowhere near this block) — and ProseMirror syncs its own
  // selection from that native caret on the following `selectionchange`,
  // silently overwriting whatever NodeSelection we'd just set. Blocking
  // the browser's default mousedown behavior before that happens is the
  // standard fix for "click an atom NodeView to select it" in ProseMirror.
  function selectBlock(e: ReactMouseEvent): void {
    e.preventDefault();
    if (typeof getPos !== "function") return;
    const pos = getPos();
    if (typeof pos === "number") editor.commands.setNodeSelection(pos);
  }

  // Sprint 9C — restores the Rich Text workflow for adding a Choice
  // (previously Inspector-only, per the Sprint 9B refactor). Goes through
  // the same `applyChoiceBlockOptions` transaction path the Inspector uses
  // — see utils/choiceBlockEditing.ts — so both surfaces create identical
  // Choice objects and stay synchronized with each other automatically
  // (this block's `options` attr, read above, is the single source of
  // truth either one is editing).
  function addChoice(e: ReactMouseEvent): void {
    e.stopPropagation();
    const blockId = node.attrs.blockId as string | undefined;
    if (!blockId) return;
    const option: ChoiceOption = { id: nanoid(), text: "", targetSceneId: null, actions: [] };
    applyChoiceBlockOptions(editor, blockId, [...options, option]);
  }

  return (
    <NodeViewWrapper
      onMouseDown={selectBlock}
      className={`choice-block my-3 cursor-pointer rounded-md border px-3 py-2.5 ${
        selected ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-[var(--overlay)]"
      }`}
      contentEditable={false}
    >
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
        <span>⤷</span>
        <span>Choice</span>
        <span className="font-normal normal-case text-[var(--text-3)]">
          ({options.length} {options.length === 1 ? "option" : "options"})
        </span>
      </div>

      <ul className="space-y-1">
        {options.map((option, index) => (
          <li key={option.id} className="flex items-baseline gap-1.5 text-sm">
            <span className="shrink-0 text-[var(--text-3)]">{index + 1}.</span>
            <span className={`truncate ${option.text ? "text-[var(--text)]" : "italic text-[var(--text-3)]"}`}>
              {option.text || "Untitled choice"}
            </span>
            <span
              className={`shrink-0 text-xs ${
                option.targetSceneId ? "text-[var(--accent)]" : "text-[var(--text-3)]"
              }`}
            >
              {destinationLabel(option.targetSceneId)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-[var(--text-3)]">
          Edit destinations and actions in the Inspector →
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={addChoice}
            title="Add another choice to this block"
            className="rounded px-1.5 py-0.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-soft-2)]"
          >
            + Add Choice
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              deleteNode();
            }}
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
