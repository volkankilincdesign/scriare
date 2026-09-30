import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useInspectorStore } from "../../state/inspectorStore";
import { useProjectStore } from "../../state/projectStore";
import { describeCondition } from "../../types/variables";
import type { VariableCondition } from "../../types/variables";

/**
 * The Conditional, while writing (v0.78.0) — the third sibling.
 *
 * WHY IT IS A NODE VIEW AT ALL. Since v0.30.0 this block was drawn entirely
 * in CSS: a dashed left rule, a recessed ground, and the word "IF" in a
 * `::before`. That was defensible while it was a quiet margin annotation
 * nobody could create on purpose — it had no toolbar button and only a
 * slash command. It stopped being defensible the moment it became the
 * third button, because a `::before` cannot say how many conditions there
 * are, cannot say what they are, and cannot offer a way out.
 *
 * It also could not END. Measured on three stacked blocks: 18px between
 * them, no closing edge, and a ground at 20% alpha that does not register
 * on screen — so the gap between two unrelated blocks was SMALLER than the
 * gap between two paragraphs inside one of them. Things that belong
 * together looked further apart than things that do not, which is a
 * grouping failure rather than a matter of taste. Reported, and the reason
 * this exists.
 *
 * THE SAME AS ITS SIBLINGS, to the token. Same radius, same border, same
 * fill, same header grammar (glyph, name, a normal-case note, a
 * right-aligned summary), same footer shape, same selected state. Nothing
 * here is special-cased for a theme, because nothing here is special.
 *
 * This is his call and it overruled mine. I drew it lighter — no fill —
 * on the argument that its siblings are furniture the reader meets while
 * this is prose that happens to be gated, and that a page of filled boxes
 * stops reading as writing. His answer is the better one: the whole reason
 * this block was unreadable stacked is that it was drawn as a different
 * KIND of thing from the two it sits beside, and answering that with a
 * third different weight keeps the same mistake in a smaller size. Three
 * things that behave alike should look alike; what makes this one the
 * lightest is what it DOES, not what it is painted.
 *
 * NO `+ Add` ANYTHING, and that is where the difference belongs — the
 * behavioural exemption the siblings rule allows. A Choice holds options
 * and a Dialogue holds lines, so both offer a way to add one. This holds
 * prose, which you add to by typing, so the footer carries only the way
 * out. A "+ Add Condition" here would be a second door to the Inspector's
 * own control, which is the growth he asked me to stop.
 */
export function ConditionalBlockView({ node, deleteNode, selected }: NodeViewProps) {
  const selectTarget = useInspectorStore((s) => s.selectTarget);
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
  const variables = useProjectStore((s) => s.project?.variables) ?? [];

  const conditions = (node.attrs.conditions as VariableCondition[] | undefined) ?? [];
  const count = conditions.length;

  function focusInspector(e: ReactMouseEvent): void {
    const blockId = node.attrs.blockId as string | undefined;
    if (!blockId || !selectedSceneId) return;
    e.preventDefault();
    selectTarget({ kind: "conditional", sceneId: selectedSceneId, blockId });
  }

  /**
   * The one fact worth the footer's width.
   *
   * A Dialogue counts its lines there because a conversation has several
   * and the count is the shape of it. A Conditional has exactly one thing
   * worth knowing and it is not a number — it is WHEN. So the sentence is
   * the conditions themselves, through `describeCondition`, which is the
   * same phrasing Play Mode and the exported page use for a locked choice.
   * Two spellings of one rule is how the app ends up telling a writer a
   * story reads differently from how it plays.
   */
  const when =
    count === 0
      ? "Always shown — no conditions set yet."
      : `Shown when ${conditions.map((c) => describeCondition(c, variables)).join(", and ")}.`;

  return (
    <NodeViewWrapper
      className={`conditional-block my-3 rounded-md border px-3 py-2.5 transition-colors ${
        selected
          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
          : "border-[var(--border)] bg-[var(--surface-2-faint)]"
      }`}
      data-conditional-block={node.attrs.blockId ?? undefined}
    >
      <div
        contentEditable={false}
        onMouseDown={focusInspector}
        className="scriare-section-label mb-1.5 flex select-none items-center gap-1.5 text-[var(--accent)]"
      >
        {/* The diamond, because it is already what a condition is marked
            with on a Dialogue line and on a choice's chip. Borrowed rather
            than invented — the block IS the thing those chips point at. */}
        <span aria-hidden>◇</span>
        <span>Conditional</span>
        <span className="font-normal normal-case text-[var(--text-3)]">
          — appears sometimes
        </span>
        <span className="ml-auto font-normal normal-case text-[var(--text-3)]">
          {count === 0 ? "no conditions" : `${count} ${count === 1 ? "condition" : "conditions"}`}
        </span>
      </div>

      <NodeViewContent className="scriare-conditional-body" />

      <div
        contentEditable={false}
        className="mt-1.5 flex select-none items-center justify-between gap-2"
      >
        <span className="min-w-0 truncate text-xs text-[var(--text-3)]">{when}</span>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => deleteNode()}
            title="Remove this Conditional — the writing inside it goes too"
            className="rounded px-1.5 py-0.5 text-xs text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"
          >
            Remove block
          </button>
        </div>
      </div>
    </NodeViewWrapper>
  );
}
