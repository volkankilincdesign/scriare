import type { ReactNode } from "react";
import type { Editor } from "@tiptap/react";

interface EditorToolbarProps {
  editor: Editor | null;
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
  return <span className="mx-1 h-4 w-px shrink-0 bg-[var(--surface-2)]" />;
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
  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-[var(--border-soft)] bg-[var(--surface)] px-4 py-1.5">
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
          else editor.chain().focus().unsetFontFamily().run();
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
          else editor.chain().focus().unsetFontSize().run();
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
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          className="h-0 w-0 opacity-0"
        />
      </label>

      <label
        title="Highlight"
        className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded border border-[var(--border)] text-xs font-semibold text-amber-400 hover:border-[var(--border-faint)]"
      >
        H
        <input
          type="color"
          defaultValue="#f5d90a"
          onChange={(e) => editor.chain().focus().setHighlight({ color: e.target.value }).run()}
          className="h-0 w-0 opacity-0"
        />
      </label>

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
        onClick={() => editor.chain().focus().insertChoiceBlock().run()}
        title="Insert a Choice Block"
        className="rounded bg-[var(--accent-fill-strong)] px-2 py-1 text-xs font-medium text-[var(--accent-text-on)] hover:bg-[var(--accent-hover)]"
      >
        + Choice
      </button>
    </div>
  );
}
