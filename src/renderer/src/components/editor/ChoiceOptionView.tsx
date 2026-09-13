import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useProjectStore } from "../../state/projectStore";
import { removeChoiceOption } from "../../utils/choiceBlockEditing";
import { choiceBoxCss, resolveChoiceBox } from "../../types/choiceStyles";
import type { ChoiceStyleRef } from "../../types/choiceStyles";

/**
 * One option inside a Choice Block, as it appears while writing (v0.32.0).
 *
 * The important part is `<NodeViewContent>`: that is the option's label,
 * and it is genuinely editable text in the document. A writer types a
 * choice where the choice is, the toolbar styles it like any other
 * sentence, and a word inside it can be bold on its own. Before this the
 * label was a string in an attribute rendered as a read-only span, editable
 * only through a field in the Inspector.
 *
 * Everything around the label is chrome and sits outside the editable
 * region: the number, the destination, and the remove button are all
 * `contentEditable={false}` so a caret can never land in them and a
 * backspace at the start of a label can't eat them.
 */
export function ChoiceOptionView({ node, editor, getPos }: NodeViewProps) {
  const project = useProjectStore((s) => s.project);
  const targetSceneId = (node.attrs.targetSceneId as string | null) ?? null;
  const conditions = (node.attrs.conditions as unknown[]) ?? [];

  // v0.34.0 — the option is drawn in its own style WHILE WRITING, not only
  // in Play Mode. A styling feature you have to leave the page to see is a
  // styling feature you end up guessing at; and since the label is real
  // text with real marks, what's on screen here is already the finished
  // article apart from the chrome around it.
  const box = resolveChoiceBox(project?.choiceStyles, node.attrs.style as ChoiceStyleRef | null);

  const target = targetSceneId ? project?.scenes.find((s) => s.id === targetSceneId) : undefined;
  const destination = target ? `→ ${target.title || "Untitled scene"}` : "Not linked yet";

  // Index is read from the document rather than passed in, because a
  // NodeView has no idea where its own node sits — and the number has to
  // stay right when an option is added, removed or reordered above it.
  //
  // `$pos.index()` rather than scanning the parent for an identical child:
  // ProseMirror hands a NodeView a node that is equal to but not the same
  // object as the one in the document, so an identity comparison silently
  // matches nothing and every row renders as "1."
  let index = 0;
  if (typeof getPos === "function") {
    const pos = getPos();
    if (typeof pos === "number") index = editor.state.doc.resolve(pos).index();
  }

  return (
    <NodeViewWrapper
      className="scriare-choice-option group relative flex items-baseline gap-2 px-2 py-1.5"
      data-option-id={node.attrs.optionId ?? undefined}
      style={choiceBoxCss(box)}
    >
      <span
        contentEditable={false}
        className="shrink-0 select-none text-xs text-[var(--text-3)]"
      >
        {index + 1}.
      </span>

      {/* The label. Everything the toolbar can do to a sentence, it can do
          to this — which is the entire point of the v0.32.0 schema change. */}
      <NodeViewContent className="scriare-choice-label min-w-0 flex-1 outline-none" />

      <span
        contentEditable={false}
        className={`shrink-0 select-none whitespace-nowrap text-xs ${
          targetSceneId ? "text-[var(--accent)]" : "text-[var(--text-3)]"
        }`}
        title={targetSceneId ? destination : "Set a destination in the Inspector"}
      >
        {destination}
      </span>

      {conditions.length > 0 && (
        <span
          contentEditable={false}
          className="shrink-0 select-none text-xs text-[var(--text-3)]"
          title={`${conditions.length} condition${conditions.length === 1 ? "" : "s"} must hold`}
        >
          ◇{conditions.length}
        </span>
      )}

      {/* Hidden until hover so a block of choices reads as writing rather
          than as a form full of controls.

          `removeChoiceOption` rather than the NodeView's own `deleteNode`:
          a Choice Block's content is `choiceOption+`, so deleting the last
          option on its own would leave a block the schema forbids. The
          helper takes the block with it, which is also what "I removed my
          only choice" means. */}
      <button
        type="button"
        contentEditable={false}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          const optionId = node.attrs.optionId as string | undefined;
          if (optionId) removeChoiceOption(editor, optionId);
        }}
        title="Remove this choice"
        className="shrink-0 select-none rounded px-1 text-xs text-[var(--text-3)] opacity-0 transition-opacity hover:text-[var(--danger)] group-hover:opacity-100"
      >
        ✕
      </button>
    </NodeViewWrapper>
  );
}
