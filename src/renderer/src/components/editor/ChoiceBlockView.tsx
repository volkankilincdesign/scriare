import { Button } from "../common/Button";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { blockTagline } from "../../narrativeBlocks/registry";
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
      // v0.81.0 — the handle its two siblings have carried since the day
      // they were drawn. Found by a first-run check that could read the
      // Dialogue's header and the Conditional's and not the Choice's: the
      // oldest of the three blocks was the only one a test could not point
      // at, which is the same age-not-behaviour gap that left it without a
      // tagline.
      data-choice-block={node.attrs.blockId ?? undefined}
    >
      <div
        contentEditable={false}
        onMouseDown={focusInspector}
        className="scriare-section-label mb-1.5 flex select-none items-center gap-1.5 text-[var(--accent)]"
      >
        <span aria-hidden>⤷</span>
        <span>Choice</span>
        {/* v0.81.0 — THE TAGLINE, and the count moved to the right to
            match. Both siblings have worn one since the day they were
            drawn — the Dialogue "— stays on this page", the Conditional
            "— appears sometimes" — and the Choice, which is the block a
            newcomer meets first, had neither. The siblings rule says
            anything drawn for one is drawn for all three unless the
            difference is behavioural, and "the header is older" is not a
            behaviour.

            "The page turns here" is chosen against "stays on this page"
            on purpose: the pair teaches the distinction between the two
            blocks in four words, which is the thing a newcomer actually
            needs and no amount of documentation delivers as cheaply. */}
        <span className="font-normal normal-case text-[var(--text-3)]">
          — {blockTagline("choice")}
        </span>
        <span className="ml-auto font-normal normal-case text-[var(--text-3)]">
          {count} {count === 1 ? "option" : "options"}
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
          <Button
            onMouseDown={(e) => e.preventDefault()}
            onClick={addChoice}
            title="Add another choice to this block"
            intent="accentGhost"
            size="xs"
          >
            + Add Choice
          </Button>
          <Button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => deleteNode()}
            title="Remove this entire Choice Block"
            intent="quietDanger"
            size="xs"
          >
            Remove block
          </Button>
        </div>
      </div>
    </NodeViewWrapper>
  );
}
