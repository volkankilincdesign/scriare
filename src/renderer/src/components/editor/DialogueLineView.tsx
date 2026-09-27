import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useProjectStore } from "../../state/projectStore";
import { applyDialogueLineAttrs, removeDialogueLine } from "../../utils/dialogueBlocks";
import { speakerName } from "../../types/speaker";
import type { DialogueAfter } from "../../types/nodeTypes";

/**
 * One line of a conversation, while writing (v0.66.0).
 *
 * Two fields, stacked: the line, which is real inline content and takes
 * every mark the toolbar has — and the reply, which is a plain field.
 * The reply being flat is the one compromise in this block, argued in
 * extensions/DialogueLine.ts; here it shows up as a textarea rather than a
 * second NodeViewContent.
 *
 * THE MARK ON THE RIGHT IS THE LINE'S "AFTER", and it is the only thing in
 * the block a reader of the page has to understand: · stays, ✓ closes the
 * conversation, ↪ leaves the scene. It is a button because the three-way
 * cycle is faster than opening the Inspector for a thing that changes this
 * often, and the Inspector still owns the same control for anyone who
 * wants to see all three named.
 */
const AFTER_ORDER: DialogueAfter[] = ["stay", "end", "leave"];
const AFTER_MARK: Record<DialogueAfter, string> = { stay: "·", end: "✓", leave: "↪" };
const AFTER_TITLE: Record<DialogueAfter, string> = {
  stay: "Stays in the conversation",
  end: "Ends the conversation — the rest of the page unfolds",
  leave: "Leaves this scene",
};

export function DialogueLineView({ node, editor, getPos }: NodeViewProps) {
  const project = useProjectStore((s) => s.project);
  const entities = project?.entities ?? [];

  const lineId = (node.attrs.lineId as string) ?? "";
  const after = ((node.attrs.after as DialogueAfter) ?? "stay") as DialogueAfter;
  const reply = (node.attrs.reply as string) ?? "";
  const replySpeaker = (node.attrs.replySpeaker as string | null) ?? null;
  const repeatable = Boolean(node.attrs.repeatable);
  const conditions = (node.attrs.conditions as unknown[]) ?? [];
  const targetSceneId = (node.attrs.targetSceneId as string | null) ?? null;
  const target = targetSceneId ? project?.scenes.find((s) => s.id === targetSceneId) : undefined;

  // Read from the document, not passed in: a NodeView does not know where
  // its own node sits, and the number has to stay right when a line is
  // added or removed above it. Same reasoning as ChoiceOptionView.
  let index = 0;
  if (typeof getPos === "function") {
    const pos = getPos();
    if (typeof pos === "number") index = editor.state.doc.resolve(pos).index();
  }

  const who = speakerName(replySpeaker, entities);

  function cycleAfter(): void {
    const next = AFTER_ORDER[(AFTER_ORDER.indexOf(after) + 1) % AFTER_ORDER.length];
    applyDialogueLineAttrs(editor, lineId, { after: next });
  }

  return (
    <NodeViewWrapper
      className="scriare-dialogue-line group relative rounded border border-[var(--border-soft)] bg-[var(--surface)] px-2 py-1.5"
      data-line-id={lineId || undefined}
      data-after={after}
    >
      <div className="flex items-baseline gap-2">
        <span contentEditable={false} className="shrink-0 select-none text-xs text-[var(--text-3)]">
          {index + 1}.
        </span>

        {/* The line. Real content — bold, colour, a mention, all of it. */}
        <NodeViewContent className="scriare-dialogue-label min-w-0 flex-1 outline-none" />

        <span contentEditable={false} className="flex shrink-0 select-none items-baseline gap-1">
          {repeatable && (
            <span className="text-[10px] text-[var(--text-3)]" title="Can be said again">
              ↻
            </span>
          )}
          {conditions.length > 0 && (
            <span
              className="text-[10px] text-[var(--text-3)]"
              title={`${conditions.length} condition${conditions.length === 1 ? "" : "s"}`}
            >
              ◇
            </span>
          )}
          <button
            type="button"
            onClick={cycleAfter}
            title={AFTER_TITLE[after]}
            data-after-toggle={after}
            className={`rounded px-1 text-xs hover:bg-[var(--surface-3)] ${
              after === "leave" ? "text-[var(--accent)]" : "text-[var(--text-3)]"
            }`}
          >
            {AFTER_MARK[after]}
          </button>
          <button
            type="button"
            onClick={() => removeDialogueLine(editor, lineId)}
            title="Remove this line"
            className="rounded px-1 text-xs text-[var(--text-3)] opacity-0 transition-opacity hover:bg-[var(--surface-3)] hover:text-[var(--danger)] group-hover:opacity-100"
          >
            ✕
          </button>
        </span>
      </div>

      {/* The reply, or where it leads. A leaving line has no reply — it is
          an exit, and a reply the reader would never finish reading is a
          reply nobody should be asked to write. */}
      <div contentEditable={false} className="mt-1 pl-5 select-none">
        {after === "leave" ? (
          <span className="text-xs text-[var(--accent)]">
            ↪ {target ? target.title || "Untitled scene" : "not linked yet"}
          </span>
        ) : (
          <div className="flex items-start gap-1.5 border-l-2 border-[var(--border-faint)] pl-2">
            {who && (
              <span className="shrink-0 pt-[3px] text-[10px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
                {who}
              </span>
            )}
            <textarea
              value={reply}
              rows={1}
              placeholder="…and the reply"
              onChange={(e) => applyDialogueLineAttrs(editor, lineId, { reply: e.target.value })}
              data-reply-for={lineId}
              className="min-w-0 flex-1 resize-none border-0 bg-transparent p-0 text-xs leading-snug text-[var(--text-2)] outline-none placeholder:text-[var(--text-3)]"
              // Grows with what is typed rather than scrolling inside two
              // lines, which is the difference between a field and a place
              // to write.
              ref={(el) => {
                if (!el) return;
                el.style.height = "auto";
                el.style.height = `${el.scrollHeight}px`;
              }}
            />
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}
