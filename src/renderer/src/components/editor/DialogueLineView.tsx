import { useEffect, useLayoutEffect, useRef } from "react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useProjectStore } from "../../state/projectStore";
import { choiceBoxCss, resolveChoiceBox } from "../../types/choiceStyles";
import type { ChoiceStyleRef } from "../../types/choiceStyles";
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
/** Grows a reply field to its content, or leaves it alone if it cannot be
 *  measured yet (see the note in the component). */
function fit(el: HTMLTextAreaElement | null): void {
  if (!el) return;
  el.style.height = "auto";
  const height = el.scrollHeight;
  if (height > 0) el.style.height = `${height}px`;
}

const AFTER_ORDER: DialogueAfter[] = ["stay", "end", "leave"];
const AFTER_MARK: Record<DialogueAfter, string> = { stay: "·", end: "✓", leave: "↪" };
const AFTER_TITLE: Record<DialogueAfter, string> = {
  stay: "Stays in the conversation",
  end: "Ends the conversation — the rest of the page unfolds",
  leave: "Leaves this scene",
};

export function DialogueLineView({ node, editor, getPos }: NodeViewProps) {
  const project = useProjectStore((s) => s.project);
  const replyRef = useRef<HTMLTextAreaElement | null>(null);
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

  /**
   * v0.67.0 — THE SAME BOX A CHOICE WEARS.
   *
   * A Dialogue and a Choice are siblings: same palette, same principles,
   * and only their behaviour differs. v0.66.0 drew this row on hard-coded
   * `--surface` and `--border-soft` while a choice row painted the writer's
   * own Choice Style — so the two blocks disagreed about what a row looks
   * like in every one of the eight themes, and worse, a writer who had
   * restyled their choices found their conversations had not moved with
   * them. The line already carries a `style` attribute and Play Mode has
   * always honoured it; the editor simply was not asking.
   */
  const box = resolveChoiceBox(project?.choiceStyles, node.attrs.style as ChoiceStyleRef | null);

  /**
   * The reply grows with what is typed rather than scrolling inside two
   * lines — the difference between a field and a place to write.
   *
   * v0.66.1 — THIS USED TO BE A REF CALLBACK, and a ref callback is the one
   * place it cannot work. ProseMirror builds a node view's DOM before it
   * puts it in the document, so the callback ran on a detached element,
   * `scrollHeight` was 0, and the height was written as `0px` and never
   * recomputed: a reply that existed in the file, was in the field's value,
   * and could not be seen. Measured height on a freshly seeded block: 0.
   *
   * So: measure after layout AND again on the next frame, once ProseMirror
   * has inserted the view, and never write a height of zero — a measurement
   * that comes back empty means the element is not in the document yet, not
   * that the reply is empty.
   */
  useLayoutEffect(() => {
    fit(replyRef.current);
  }, [reply]);
  useEffect(() => {
    const id = requestAnimationFrame(() => fit(replyRef.current));
    return () => cancelAnimationFrame(id);
  }, [reply]);

  /**
   * v0.67.0 — AND AGAIN WHENEVER THE COLUMN CHANGES WIDTH.
   *
   * A height in pixels is an answer to "how many lines does this wrap to",
   * and that answer expires the moment the column is resized. Collapse a
   * dock, widen the window, and a reply that now fits on one line kept the
   * two lines' worth of height it was measured at — the gap Volkan saw
   * under one-line replies, measured at 33px drawn against 17px needed.
   *
   * A ResizeObserver rather than a window listener: the editor column
   * changes width when the docks move, which the window never hears about.
   */
  useEffect(() => {
    const el = replyRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let last = el.getBoundingClientRect().width;
    const observer = new ResizeObserver(() => {
      const width = el.getBoundingClientRect().width;
      // Only width matters. Reacting to height would mean reacting to the
      // change this very callback just made.
      if (Math.abs(width - last) < 0.5) return;
      last = width;
      fit(el);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function cycleAfter(): void {
    const next = AFTER_ORDER[(AFTER_ORDER.indexOf(after) + 1) % AFTER_ORDER.length];
    applyDialogueLineAttrs(editor, lineId, { after: next });
  }

  return (
    <NodeViewWrapper
      className="scriare-dialogue-line group relative px-2 py-1.5"
      data-line-id={lineId || undefined}
      data-after={after}
      style={choiceBoxCss(box)}
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
            {/* v0.66.1 — the name and the reply share a line box rather
                than a hand-picked padding. `pt-[3px]` was a guess made at
                one font size and it put the name a baseline's width below
                the words it introduces. A textarea cannot be aligned with
                `items-baseline` — a scrollable box reports its bottom
                edge as its baseline, so a two-line reply would drag the
                name down with it — so both sides are given the SAME line
                box (16.5px, which is the reply's own `leading-snug` at
                12px) and the name's smaller type is centred in it by the
                browser. Measured at 0.3px apart, and held there by
                speaker-alignment.spec. */}
            {who && (
              <span className="shrink-0 text-[10px] font-semibold uppercase leading-[16.5px] tracking-wide text-[var(--text-3)]">
                {who}
              </span>
            )}
            <textarea
              ref={replyRef}
              value={reply}
              rows={1}
              placeholder="…and the reply"
              onChange={(e) => applyDialogueLineAttrs(editor, lineId, { reply: e.target.value })}
              data-reply-for={lineId}
              // min-h is the floor the measurement can never go under: see
              // the note on `fit` above. leading-snug here and on the name
              // beside it are the same line box on purpose.
              className="min-h-[1.05rem] min-w-0 flex-1 resize-none border-0 bg-transparent p-0 text-xs leading-snug text-[var(--text-2)] outline-none placeholder:text-[var(--text-3)]"
            />
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}
