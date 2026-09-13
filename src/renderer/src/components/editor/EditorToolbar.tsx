import { useMemo, useRef } from "react";
import type { ReactNode } from "react";
import type { Editor } from "@tiptap/react";

interface EditorToolbarProps {
  editor: Editor | null;
}

/**
 * A native `<input type="color">` fires its `input`/`onChange` event on
 * every pixel of movement while the user drags inside the picker's
 * gradient — dozens of times per second. Each call here used to run
 * straight into `editor.chain().setColor(...).run()`, which is a full
 * ProseMirror transaction: it triggers SceneEditor's `onUpdate`, which
 * calls `updateSceneContent()` (a full `editor.getJSON()` serialization
 * committed to the Zustand store as a brand-new `project` object), which
 * in turn makes FlowPanel's project-keyed `edgesBase`/`choiceCountByScene`
 * memo recompute — a full `extractChoices()` walk of every scene's
 * document (see "Known pitfalls" in the architecture doc, the same class
 * of per-event cost the v0.10.3 drag-performance fix exists to warn
 * against, just triggered by a colour drag instead of a node drag).
 * Coalescing every same-frame event into one requestAnimationFrame-
 * scheduled call keeps the effective commit rate at the display's own
 * refresh rate — still feels live, but never runs this pipeline more
 * than once per frame no matter how many `onChange` events fire in it.
 */
function useRafThrottledCallback<T extends (value: string) => void>(callback: T): T {
  const rafId = useRef<number | null>(null);
  const latestValue = useRef<string>("");

  return useMemo(() => {
    const throttled = (value: string) => {
      latestValue.current = value;
      if (rafId.current !== null) return;
      rafId.current = requestAnimationFrame(() => {
        rafId.current = null;
        callback(latestValue.current);
      });
    };
    return throttled as T;
  }, [callback]);
}

interface ToolbarButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}

function ToolbarButton({ active, onClick, label, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      // A plain click on a toolbar button first fires `mousedown`, whose
      // browser default is to move DOM focus onto the button — which, since
      // the button lives outside the ProseMirror contenteditable, also
      // clears the browser's native text selection inside the editor. Tiptap's
      // `.focus()` (every handler below chains `.chain().focus().<cmd>().run()`)
      // then schedules a `view.focus()` for the *next* animation frame; by the
      // time that fires, the browser has nothing to restore, so it drops a
      // fresh collapsed caret somewhere and ProseMirror resyncs its selection
      // to match — silently collapsing whatever range was selected. The
      // command itself (e.g. `unsetColor()`) already ran correctly against
      // the original range *before* any of this, so nothing about the
      // document's formatting is actually lost — but every control that
      // reads `editor.getAttributes(...)` off the (now wrong, collapsed)
      // selection re-renders showing the attributes at that unrelated cursor
      // position instead, which is what made the text-color reset button
      // look like it was also wiping font family/size: it wasn't touching
      // them, the toolbar was just reporting the wrong position's attributes
      // afterward. `preventDefault` on mousedown is the standard fix for
      // contenteditable toolbars — it stops the browser from ever moving
      // focus/clearing the selection in the first place, so `.focus()`'s
      // delayed re-sync has nothing to disturb.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={label}
      className={`rounded px-2 py-1 text-sm font-medium transition-colors ${
        active ? "bg-[var(--surface-3)] text-[var(--text)]" : "text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1.5 h-4 w-px shrink-0 bg-[var(--border-soft)]" />;
}

const FONT_FAMILIES = [
  { label: "Default", value: "" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Sans", value: "Helvetica, Arial, sans-serif" },
  { label: "Mono", value: "'Courier New', monospace" },
];

const FONT_SIZES = [
  { label: "Default", value: "" },
  { label: "Small", value: "13px" },
  { label: "Normal", value: "16px" },
  { label: "Large", value: "20px" },
  { label: "Huge", value: "28px" },
];

export function EditorToolbar({ editor }: EditorToolbarProps) {
  // Called before the `editor` null-check below so hook order never
  // changes across renders — see useRafThrottledCallback's own comment
  // for why setColor/setHighlight go through this instead of straight
  // through onChange.
  const setColorThrottled = useRafThrottledCallback((value: string) => {
    editor?.chain().focus().setColor(value).run();
  });
  const setHighlightThrottled = useRafThrottledCallback((value: string) => {
    editor?.chain().focus().setHighlight({ color: value }).run();
  });

  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-[var(--border-soft)] bg-[var(--surface)] px-5 py-2.5">
      <ToolbarButton
        label="Bold (Ctrl+B)"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        B
      </ToolbarButton>
      <ToolbarButton
        label="Italic (Ctrl+I)"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        I
      </ToolbarButton>
      <ToolbarButton
        label="Underline (Ctrl+U)"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        U
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Heading 1"
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        H1
      </ToolbarButton>
      <ToolbarButton
        label="Heading 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        H2
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        •
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        1.
      </ToolbarButton>
      <ToolbarButton
        label="Quote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        "
      </ToolbarButton>
      <ToolbarButton
        label="Horizontal divider"
        active={false}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        ―
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Align left"
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
      >
        ⟸
      </ToolbarButton>
      <ToolbarButton
        label="Align center"
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
      >
        ⇔
      </ToolbarButton>
      <ToolbarButton
        label="Align right"
        active={editor.isActive({ textAlign: "right" })}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
      >
        ⟹
      </ToolbarButton>
      <ToolbarButton
        label="Justify"
        active={editor.isActive({ textAlign: "justify" })}
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
      >
        ≡
      </ToolbarButton>

      <Divider />

      <select
        title="Font family"
        value={editor.getAttributes("textStyle").fontFamily ?? ""}
        onChange={(e) => {
          const value = e.target.value;
          if (value) editor.chain().focus().setFontFamily(value).run();
          // Not unsetFontFamily() — see TextStyleCleanup's own comment for
          // why its removeEmptyTextStyle() step silently also strips
          // color/fontSize whenever the selection is inside a list.
          else editor.chain().focus().setMark("textStyle", { fontFamily: null }).cleanupTextStyle().run();
        }}
        className="rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 py-1 text-xs text-[var(--text-2)] outline-none focus:border-[var(--accent)]"
      >
        {FONT_FAMILIES.map((f) => (
          <option key={f.label} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      <select
        title="Font size"
        value={editor.getAttributes("textStyle").fontSize ?? ""}
        onChange={(e) => {
          const value = e.target.value;
          if (value) editor.chain().focus().setFontSize(value).run();
          // See the fontFamily <select> above / TextStyleCleanup's comment.
          else editor.chain().focus().setMark("textStyle", { fontSize: null }).cleanupTextStyle().run();
        }}
        className="rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 py-1 text-xs text-[var(--text-2)] outline-none focus:border-[var(--accent)]"
      >
        {FONT_SIZES.map((f) => (
          <option key={f.label} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      <label
        title="Text color"
        className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded border border-[var(--border)] text-xs font-semibold text-[var(--text-2)] hover:border-[var(--border-faint)]"
      >
        A
        <input
          type="color"
          value={editor.getAttributes("textStyle").color ?? "#e4e4e7"}
          onChange={(e) => setColorThrottled(e.target.value)}
          className="h-0 w-0 opacity-0"
        />
      </label>
      <ToolbarButton
        label="Default text color"
        active={false}
        // Not unsetColor() — it internally chains
        // .setMark('textStyle', {color: null}).removeEmptyTextStyle(), and
        // that second step is what was silently also wiping font
        // family/size whenever the selection sat inside a bullet or
        // numbered list. cleanupTextStyle() (extensions/TextStyleCleanup.ts)
        // does the same "drop the mark once every attribute on it is falsy"
        // cleanup, just scoped correctly to actual text nodes instead of
        // every node — including list containers — the selection passes
        // through.
        onClick={() => editor.chain().focus().setMark("textStyle", { color: null }).cleanupTextStyle().run()}
      >
        <span className="text-[10px] leading-none">✕</span>
      </ToolbarButton>

      <label
        title="Highlight"
        className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded border border-[var(--border)] text-xs font-semibold text-amber-400 hover:border-[var(--border-faint)]"
      >
        H
        <input
          type="color"
          defaultValue="#f5d90a"
          onChange={(e) => setHighlightThrottled(e.target.value)}
          className="h-0 w-0 opacity-0"
        />
      </label>
      <ToolbarButton
        label="No highlight"
        active={false}
        onClick={() => editor.chain().focus().unsetHighlight().run()}
      >
        <span className="text-[10px] leading-none">✕</span>
      </ToolbarButton>

      <ToolbarButton
        label="Clear formatting"
        active={false}
        onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
      >
        ⌫
      </ToolbarButton>

      <Divider />

      <button
        type="button"
        // Same focus/selection-stealing issue ToolbarButton's onMouseDown
        // comment explains — this button isn't a ToolbarButton, so it needs
        // its own guard.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().insertChoiceBlock().run()}
        title="Insert a Choice Block"
        className="rounded bg-[var(--accent-fill-strong)] px-2 py-1 text-xs font-medium text-[var(--accent-text-on)] hover:bg-[var(--accent-hover)]"
      >
        + Choice
      </button>
    </div>
  );
}
