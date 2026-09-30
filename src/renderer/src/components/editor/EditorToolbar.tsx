import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import { Icon } from "../common/Icon";
import type { IconName } from "../common/Icon";
import { useProjectStore } from "../../state/projectStore";
import { useUIStore } from "../../state/uiStore";
import { useInspectorStore } from "../../state/inspectorStore";
import { appendChoiceOption } from "../../utils/choiceBlockEditing";

interface EditorToolbarProps {
  editor: Editor | null;
}

/**
 * The editor toolbar (redrawn in v0.33.0).
 *
 * Every control was previously a literal character: `B`, `H1`, `•`, `"`,
 * `⟸`, `⌫`, and two anonymous `✕`s. That made the bar the one part of the
 * app not speaking its own visual language — the Content Browser, the
 * graph and the tabs are all drawn with the stroked 16-grid icons in
 * components/common/Icon.tsx, and the toolbar was typography pretending to
 * be iconography. Worse, some of those characters were simply wrong:
 * arrows standing in for text alignment, a straight typewriter quote for
 * blockquote, and a backspace glyph for "clear formatting".
 *
 * What changed and what deliberately didn't:
 *
 *  - EVERY control is now an icon from the app's own set, at the same grid
 *    and stroke as everything else. Nothing moved and nothing was removed,
 *    because the complaint was about how the bar is drawn, not where its
 *    controls sit.
 *  - B / I / U stay as letterforms, but as real specimens — the B is bold,
 *    the I is italic and set in the app's reading face, the U is
 *    underlined. Drawing those three as pictures would be less legible
 *    than the convention every editor already uses.
 *  - The colour controls now WEAR the colour they apply, as a bar beneath
 *    the letter, rather than hiding it inside a bordered box. That is also
 *    what lets the two unlabelled ✕ buttons become real reset controls
 *    sitting with the thing they reset.
 *  - When the caret is inside a Choice Block, a small Choice group appends
 *    to the END of the bar (see ChoiceContextGroup). Appending rather than
 *    inserting matters: nothing already on the toolbar ever moves under
 *    the writer's cursor because of where their caret happens to be.
 */

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
  active?: boolean;
  onClick: () => void;
  label: string;
  /**
   * A 24px button instead of 28px, for controls sitting INSIDE a bordered
   * group. The group's own border and padding have to come out of the row's
   * 28px or the toolbar grows taller whenever the group appears — which it
   * did, by six pixels, and read exactly as jumpy as it sounds.
   */
  compact?: boolean;
  children: ReactNode;
}

function ToolbarButton({
  active = false,
  onClick,
  label,
  compact = false,
  children,
}: ToolbarButtonProps) {
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
      aria-label={label}
      aria-pressed={active}
      className={`flex shrink-0 items-center justify-center rounded-[5px] px-1.5 transition-colors ${
        compact ? "h-6 min-w-6" : "h-7 min-w-7"
      } ${
        active
          ? "bg-[var(--surface-3)] text-[var(--text)]"
          : "text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
      }`}
    >
      {children}
    </button>
  );
}

/** An icon control — the shape of nearly every button on this bar. */
function IconButton({
  icon,
  ...rest
}: Omit<ToolbarButtonProps, "children"> & { icon: IconName }) {
  return (
    <ToolbarButton {...rest}>
      <Icon name={icon} className={rest.compact ? "h-[15px] w-[15px]" : "h-4 w-4"} />
    </ToolbarButton>
  );
}

function Divider() {
  return <span className="mx-1.5 h-4 w-px shrink-0 bg-[var(--border)]" aria-hidden />;
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

/**
 * A native `<select>` inside a bordered shell with the family/size icon
 * beside it. Native on purpose: a hand-built dropdown next to a
 * contenteditable is a focus-management problem with no upside here, and
 * the OS one already handles keyboard, scrolling and long lists.
 */
function SelectControl({
  icon,
  label,
  value,
  options,
  onChange,
}: {
  icon: IconName;
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label
      title={label}
      className="flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-[5px] border border-[var(--border)] pl-1.5 pr-0.5 text-[var(--text-2)] transition-colors hover:border-[var(--border-faint)] hover:text-[var(--text)] focus-within:border-[var(--accent)]"
    >
      <Icon name={icon} className="h-3.5 w-3.5" />
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-full cursor-pointer bg-transparent pr-1 text-xs text-inherit outline-none"
      >
        {options.map((o) => (
          <option key={o.label} value={o.value} className="bg-[var(--surface)] text-[var(--text)]">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * A colour control that shows its colour. The letterform sits above a bar
 * filled with the colour currently in effect, so the button answers "what
 * will this apply?" without being opened — which the old bordered box with
 * a hidden input never did.
 */
function ColorControl({
  icon,
  label,
  swatch,
  value,
  onChange,
  onPick,
}: {
  icon: IconName;
  label: string;
  /** What the bar shows. Separate from `value` so an unset colour can read
   *  as the text's own default rather than as an arbitrary swatch. */
  swatch: string;
  value: string;
  onChange: (value: string) => void;
  /**
   * Fired on every event of a pick, so the caller can keep the reading on
   * the two grounds up to date (v0.58.0). The control itself keeps its
   * native `<input type="color">` exactly as it was — first press still
   * opens the browser's own picker, with its eyedropper — and deliberately
   * draws NOTHING of its own: the picker opens directly beneath this
   * button, so anything drawn here spends the whole pick behind it
   * (v0.58.1).
   */
  onPick?: () => void;
}) {
  return (
    <label
      title={label}
      className="flex h-7 w-7 shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[5px] text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
    >
      <Icon name={icon} className="h-3.5 w-3.5" />
      <span className="sr-only">{label}</span>
      {/* The one place in the chrome that deliberately paints a colour from
          outside the palette: this bar IS the colour the writer picked, so it
          is marked as content and skipped by the palette audit in
          tests/themes.spec.mjs (v0.46.0). */}
      <span
        aria-hidden
        data-content-colour
        className="h-[3px] w-4 rounded-[1px] ring-1 ring-inset ring-[var(--border-faint)]"
        style={{ background: swatch }}
      />
      <input
        type="color"
        value={value}
        onChange={(e) => {
          onPick?.();
          onChange(e.target.value);
        }}
        className="h-0 w-0 opacity-0"
      />
    </label>
  );
}

/**
 * The contextual group (v0.33.0). Present only while the caret is inside a
 * Choice Block, appended after everything else.
 *
 * It holds the two things a writer wants without leaving the sentence they
 * are in: another option, and the option's properties. Destination and
 * conditions themselves stay in the Inspector — this doesn't duplicate
 * them, it points at them, which keeps one editor for each thing.
 *
 * EXACTLY 28px TALL, like every other control on the bar. Its border and
 * padding are taken out of that height rather than added to it (hence the
 * compact buttons inside): the first version was 34px, so the whole toolbar
 * grew six pixels the moment a caret entered a choice and shrank again when
 * it left. A toolbar that changes height while you type is the kind of
 * thing you feel before you can name it.
 */
function ChoiceContextGroup({
  editor,
  blockId,
  optionId,
  sceneId,
}: {
  editor: Editor;
  blockId: string;
  optionId: string | null;
  sceneId: string;
}) {
  const selectTarget = useInspectorStore((s) => s.selectTarget);

  return (
    <span
      role="group"
      aria-label="The choice the caret is in"
      className="ml-1 flex h-7 shrink-0 items-center gap-0.5 rounded-[7px] border border-[var(--accent-soft-2)] bg-[var(--accent-soft)] pl-1.5 pr-0.5"
    >
      {/* The branch mark rather than the word "Choice": the insert button
          sitting immediately to the left already says Choice, and two of
          the same word side by side read as one control with a label. */}
      <Icon name="branch" className="mr-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
      <IconButton
        icon="plus"
        compact
        label="Add another choice to this block"
        onClick={() => appendChoiceOption(editor, blockId)}
      />
      <IconButton
        icon="properties"
        compact
        label="Choice properties (destination, conditions, actions)"
        // Carries the option too, so the Inspector opens on the choice the
        // caret is in rather than on the block's first one.
        onClick={() => selectTarget({ kind: "choice", sceneId, blockId, optionId })}
      />
    </span>
  );
}

/**
 * The Choice Block the selection sits in, and the option within it, or
 * null. Walks the selection's ancestors rather than asking `isActive`,
 * because what's wanted is the block's identity and not merely whether one
 * is in scope.
 */
function enclosingChoice(editor: Editor): { blockId: string; optionId: string | null } | null {
  const { selection } = editor.state;
  const nodeSelection = selection as {
    node?: { type: { name: string }; attrs: Record<string, unknown> };
  };
  if (nodeSelection.node?.type.name === "choiceBlock") {
    const blockId = nodeSelection.node.attrs.blockId as string | undefined;
    return blockId ? { blockId, optionId: null } : null;
  }
  const { $from } = selection;
  let optionId: string | null = null;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const ancestor = $from.node(depth);
    if (ancestor.type.name === "choiceOption") {
      optionId = (ancestor.attrs.optionId as string) ?? null;
    }
    if (ancestor.type.name === "choiceBlock") {
      const blockId = ancestor.attrs.blockId as string | undefined;
      return blockId ? { blockId, optionId } : null;
    }
  }
  return null;
}

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
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);

  if (!editor) return null;

  const textStyle = editor.getAttributes("textStyle");
  const currentColor = (textStyle.color as string | undefined) ?? "";
  const currentHighlight = (editor.getAttributes("highlight").color as string | undefined) ?? "";

  /**
   * The reading of whichever colour is being picked (v0.58.0), handed to
   * the editor pane, which draws it in its own bottom corner — far from
   * the picker, which opens directly under the control (v0.58.1).
   *
   * Pushed on every event of the pick rather than once at the start: the
   * throttle below already limits those to one a frame, and that is what
   * makes the reading follow the drag instead of reporting where it began.
   */
  const showColorReading = useUIStore((s) => s.showColorReading);
  const clearColorReading = useUIStore((s) => s.clearColorReading);
  /**
   * WHICH colour is being picked, not what it currently is. The value has
   * to be re-read from the editor on every render, because the commit is
   * throttled to one a frame: a subject captured inside the input's own
   * event handler is always a frame stale, and on the very first event it
   * is the colour the writer had BEFORE they started — which showed up as
   * a panel reporting "follows it" for the first frame of every pick.
   */
  const [picking, setPicking] = useState<"text" | "highlight" | null>(null);
  useEffect(() => {
    if (picking === "text") showColorReading({ kind: "ink", color: currentColor });
    // "wash", not "ink": a highlight goes BEHIND the words, so what has to
    // be readable is the ground's own text on top of it.
    else if (picking === "highlight") showColorReading({ kind: "wash", color: currentHighlight });
  }, [picking, currentColor, currentHighlight, showColorReading]);

  // The caret moving on is the writer saying they are done with this
  // colour. Dismissing on it keeps the panel from following someone into
  // the next paragraph, which is the failure mode of every editor notice
  // that outstays its moment.
  const caret = editor.state.selection.from;
  useEffect(() => {
    setPicking(null);
    clearColorReading();
  }, [caret, clearColorReading]);
  const choice = enclosingChoice(editor);

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="scriare-toolbar flex flex-wrap items-center gap-1 border-b border-[var(--border-soft)] bg-[var(--surface)] px-5 py-2.5"
    >
      {/* B / I / U as specimens rather than characters: each one is set in
          the style it applies, which is the clearest possible label. */}
      <ToolbarButton
        label="Bold (Ctrl+B)"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <span className="text-[13px] font-bold leading-none">B</span>
      </ToolbarButton>
      <ToolbarButton
        label="Italic (Ctrl+I)"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        {/* Inter's own italic, which is bundled (main.tsx loads the
            opsz-italic face) — not a browser-synthesised slant. */}
        <span className="text-[14px] italic leading-none">I</span>
      </ToolbarButton>
      <ToolbarButton
        label="Underline (Ctrl+U)"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <span className="text-[13px] leading-none underline underline-offset-[3px]">U</span>
      </ToolbarButton>

      <Divider />

      <IconButton
        icon="heading1"
        label="Heading 1"
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      />
      <IconButton
        icon="heading2"
        label="Heading 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />

      <Divider />

      <IconButton
        icon="bulletList"
        label="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <IconButton
        icon="orderedList"
        label="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <IconButton
        icon="quote"
        label="Quote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <IconButton
        icon="rule"
        label="Horizontal divider"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      />

      <Divider />

      <IconButton
        icon="alignLeft"
        label="Align left"
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
      />
      <IconButton
        icon="alignCenter"
        label="Align centre"
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
      />
      <IconButton
        icon="alignRight"
        label="Align right"
        active={editor.isActive({ textAlign: "right" })}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
      />
      <IconButton
        icon="alignJustify"
        label="Justify"
        active={editor.isActive({ textAlign: "justify" })}
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
      />

      <Divider />

      <SelectControl
        icon="fontFamily"
        label="Font family"
        value={(textStyle.fontFamily as string | undefined) ?? ""}
        options={FONT_FAMILIES}
        onChange={(value) => {
          if (value) editor.chain().focus().setFontFamily(value).run();
          // Not unsetFontFamily() — see TextStyleCleanup's own comment for
          // why its removeEmptyTextStyle() step silently also strips
          // color/fontSize whenever the selection is inside a list.
          else
            editor
              .chain()
              .focus()
              .setMark("textStyle", { fontFamily: null })
              .cleanupTextStyle()
              .run();
        }}
      />
      <SelectControl
        icon="fontSize"
        label="Font size"
        value={(textStyle.fontSize as string | undefined) ?? ""}
        options={FONT_SIZES}
        onChange={(value) => {
          if (value) editor.chain().focus().setFontSize(value).run();
          // See the font family control above / TextStyleCleanup's comment.
          else
            editor
              .chain()
              .focus()
              .setMark("textStyle", { fontSize: null })
              .cleanupTextStyle()
              .run();
        }}
      />

      <ColorControl
        icon="textColor"
        label="Text colour"
        swatch={currentColor || "var(--text-reading)"}
        value={currentColor || "#e4e4e7"}
        onChange={setColorThrottled}
        onPick={() => setPicking("text")}
      />
      <IconButton
        icon="colorReset"
        label="Default text colour"
        // Not unsetColor() — it internally chains
        // .setMark('textStyle', {color: null}).removeEmptyTextStyle(), and
        // that second step is what was silently also wiping font
        // family/size whenever the selection sat inside a bullet or
        // numbered list. cleanupTextStyle() (extensions/TextStyleCleanup.ts)
        // does the same "drop the mark once every attribute on it is falsy"
        // cleanup, just scoped correctly to actual text nodes instead of
        // every node — including list containers — the selection passes
        // through.
        onClick={() => {
          setPicking(null);
          clearColorReading();
          editor.chain().focus().setMark("textStyle", { color: null }).cleanupTextStyle().run();
        }}
      />

      <ColorControl
        icon="highlight"
        label="Highlight"
        swatch={currentHighlight || "#f5d90a"}
        value={currentHighlight || "#f5d90a"}
        onChange={setHighlightThrottled}
        onPick={() => setPicking("highlight")}
      />
      <IconButton
        icon="colorReset"
        label="Remove highlight"
        onClick={() => {
          setPicking(null);
          clearColorReading();
          editor.chain().focus().unsetHighlight().run();
        }}
      />

      <IconButton
        icon="clearFormat"
        label="Clear formatting"
        onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
      />

      {/* Only where a Choice Block can actually go. An entity page uses
          this same toolbar with a prose-only schema, and a button that
          inserts something the document can't hold is worse than a missing
          one. Asking the schema means no component has to be told. */}
      {editor.schema.nodes.choiceBlock && (
        <>
      <Divider />

      <button
        type="button"
        // Same focus/selection-stealing issue ToolbarButton's onMouseDown
        // comment explains — this button isn't a ToolbarButton, so it needs
        // its own guard.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().insertChoiceBlock().run()}
        title="Insert a Choice Block"
        data-insert-choice
        className="flex h-7 shrink-0 items-center gap-1.5 rounded-[5px] bg-[var(--accent-fill-strong)] px-2.5 text-xs font-semibold text-[var(--accent-text-on)] transition-colors hover:bg-[var(--accent)]"
      >
        <Icon name="branch" className="h-[15px] w-[15px]" />
        Choice
      </button>

      {/* v0.66.1 — the Dialogue, beside the Choice, because they are the
          two block types a writer reaches for and one of them being a
          button while the other was only a slash command said the wrong
          thing about which was real. Same schema guard, same reason.

          v0.67.4 — AND THE SAME BUTTON. It shipped as the quieter half of
          the pair on a "one primary per bar" argument, which is a rule
          about bars in general and not about these two: they are the two
          block types, they are reached for equally, and drawing one of
          them as the lesser control says the thing about the Dialogue that
          having no button at all said. Every value below is the Choice
          button's; only the icon and the word differ. */}
      {editor.schema.nodes.dialogueBlock && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().insertDialogueBlock().run()}
          title="Insert a Dialogue — a conversation that stays on this page"
          data-insert-dialogue
          className="flex h-7 shrink-0 items-center gap-1.5 rounded-[5px] bg-[var(--accent-fill-strong)] px-2.5 text-xs font-semibold text-[var(--accent-text-on)] transition-colors hover:bg-[var(--accent)]"
        >
          <Icon name="dialogue" className="h-[15px] w-[15px]" />
          Dialogue
        </button>
      )}

      {/* v0.78.0 — the third, and the last block type to get one at all.
          Conditional Text has existed since v0.30.0 reachable only by a
          slash command, which means a writer had to already know it was
          there to find it.

          THE SAME BUTTON AGAIN, for v0.67.4's reason restated: drawing
          this one quieter would say it is the lesser of three, which is
          what having no button at all was already saying. Three block
          types, three identical controls; only the icon and the word
          differ. It reads "Conditional" rather than "IF" so the button
          and the block's own header agree on one name. */}
      {editor.schema.nodes.conditionalBlock && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().insertConditionalBlock().run()}
          title="Insert a Conditional — a passage that only appears sometimes"
          data-insert-conditional
          className="flex h-7 shrink-0 items-center gap-1.5 rounded-[5px] bg-[var(--accent-fill-strong)] px-2.5 text-xs font-semibold text-[var(--accent-text-on)] transition-colors hover:bg-[var(--accent)]"
        >
          <Icon name="conditional" className="h-[15px] w-[15px]" />
          Conditional
        </button>
      )}
        </>
      )}

      {choice && selectedSceneId && (
        <ChoiceContextGroup
          editor={editor}
          blockId={choice.blockId}
          optionId={choice.optionId}
          sceneId={selectedSceneId}
        />
      )}
    </div>
  );
}
