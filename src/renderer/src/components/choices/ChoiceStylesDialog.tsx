import { useMemo, useRef, useState } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { DialogHeader } from "../common/DialogHeader";
import { useUIStore } from "../../state/uiStore";
import { Field } from "../common/Field";
import { ColorOnGrounds } from "../common/ColorOnGrounds";
import { useProjectStore } from "../../state/projectStore";
import { useToastStore } from "../../state/toastStore";
import { DEFAULT_CHOICE_STYLE_ID, choiceBoxCss } from "../../types/choiceStyles";
import type { ChoiceBox, ChoiceStyle } from "../../types/choiceStyles";

interface ChoiceStylesDialogProps {
  onClose: () => void;
}

/**
 * The Choice Styles manager (v0.34.0) — modelled on the Variable Manager,
 * because it does the same kind of job: name a thing once, project-wide, and
 * refer to it from anywhere.
 *
 * Every control commits immediately, like the rest of the app's inline
 * editing. There is no Save step and no preview-versus-real distinction:
 * the swatch beside each style IS a choice rendered with that style, so
 * what you adjust here is what you will see in the scene and in Play Mode.
 */
export function ChoiceStylesDialog({ onClose }: ChoiceStylesDialogProps) {
  const project = useProjectStore((s) => s.project);
  const addChoiceStyle = useProjectStore((s) => s.addChoiceStyle);
  const updateChoiceStyle = useProjectStore((s) => s.updateChoiceStyle);
  const deleteChoiceStyle = useProjectStore((s) => s.deleteChoiceStyle);
  const [openId, setOpenId] = useState<string | null>(null);
  const cameFromSettings = useUIStore((s) => s.choiceStylesFrom) === "settings";

  if (!project) return null;
  const styles = project.choiceStyles;

  function handleAdd(): void {
    const id = addChoiceStyle(`Style ${styles.length}`);
    if (id) setOpenId(id);
  }

  function handleDelete(style: ChoiceStyle): void {
    deleteChoiceStyle(style.id);
    // Choices wearing it aren't rewritten — they fall back to Default when
    // painted. Saying so out loud beats letting someone discover it.
    useToastStore
      .getState()
      .showUndo(`Deleted "${style.name}" — choices using it fall back to Default`);
  }

  return (
    <Modal onClose={onClose} label="Choice Styles" widthClassName="max-w-lg">
      <DialogHeader
        title="Choice Styles"
        back={
          cameFromSettings
            ? {
                label: "Project Settings",
                onBack: () => {
                  // A swap, not a stack — see DialogBackLink.
                  useUIStore.getState().closeChoiceStyles();
                  useUIStore.getState().openSettings();
                },
              }
            : undefined
        }
      >
        How a choice looks, named once and used anywhere. Change a style here
        and every choice wearing it changes with it. The words inside a choice
        are styled with the toolbar, like any other sentence.
      </DialogHeader>

      <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
        {styles.map((style) => {
          const isDefault = style.id === DEFAULT_CHOICE_STYLE_ID;
          const open = openId === style.id;
          return (
            <div
              key={style.id}
              data-style-id={style.id}
              className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg)]"
            >
              <div className="flex items-center gap-2 p-2">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : style.id)}
                  title={open ? "Collapse" : "Edit this style"}
                  className="shrink-0 rounded px-1 text-xs text-[var(--text-3)] hover:text-[var(--text)]"
                >
                  {open ? "▾" : "▸"}
                </button>

                {/* A real choice, wearing this style. Nothing here is a
                    mock-up of the result — it is the result. */}
                <span
                  style={choiceBoxCss(style.box)}
                  className="min-w-0 flex-1 truncate px-3 py-1.5 text-sm text-[var(--text)]"
                >
                  {style.name || "Untitled style"}
                </span>

                {isDefault ? (
                  <span className="shrink-0 select-none px-1 text-[10px] uppercase tracking-wider text-[var(--text-3)]">
                    Default
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleDelete(style)}
                    title="Delete this style"
                    className="shrink-0 rounded px-1.5 text-xs text-[var(--text-3)] hover:text-[var(--danger)]"
                  >
                    ✕
                  </button>
                )}
              </div>

              {open && (
                <div className="space-y-2.5 border-t border-[var(--border-soft)] px-3 py-3">
                  <Field label="Name">
                    <input
                      value={style.name}
                      onChange={(e) => updateChoiceStyle(style.id, { name: e.target.value })}
                      disabled={isDefault}
                      title={isDefault ? "The Default style keeps its name" : undefined}
                      className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] disabled:text-[var(--text-3)]"
                    />
                  </Field>
                  <BoxControls
                    box={style.box}
                    onChange={(patch) => updateChoiceStyle(style.id, { box: patch })}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <Button intent="accentGhost" onClick={handleAdd}>
          + Add Style
        </Button>
        <Button intent="primary" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}

/**
 * One commit per animation frame, whatever the input's event rate.
 *
 * The same shape as EditorToolbar's `useRafThrottledCallback`, carrying a
 * PATCH rather than a string, and merging patches within a frame so a
 * writer dragging the thickness slider while the colour picker is still
 * settling cannot lose either. Refs, not state: nothing renders
 * differently because a frame is pending.
 */
function useRafThrottledPatch(
  commit: (patch: Partial<ChoiceBox>) => void,
): (patch: Partial<ChoiceBox>) => void {
  const frame = useRef<number | null>(null);
  const pending = useRef<Partial<ChoiceBox>>({});
  const latest = useRef(commit);
  latest.current = commit;

  return useMemo(
    () => (patch: Partial<ChoiceBox>) => {
      pending.current = { ...pending.current, ...patch };
      if (frame.current !== null) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        const merged = pending.current;
        pending.current = {};
        latest.current(merged);
      });
    },
    [],
  );
}

/**
 * The four box controls, shared by this dialog and the Inspector's
 * per-choice overrides — so a style and a one-off tweak are edited with the
 * same controls in the same order, and neither can grow a property the
 * other doesn't have.
 */
export function BoxControls({
  box,
  onChange,
  subject = "style",
}: {
  box: ChoiceBox;
  onChange: (patch: Partial<ChoiceBox>) => void;
  /** What the writer is editing, for the notice when a colour gets pinned.
   *  v0.67.2 — "line" joined the list when the Dialogue's panel started
   *  using this control instead of a copy of it. */
  subject?: "style" | "choice" | "line";
}) {
  // Coalesced to one commit per frame, for the reason EditorToolbar.tsx
  // documents at length: a native colour input fires on every pixel of
  // pointer movement inside the picker — 60-120 events a second — and each
  // one here runs a full-document ProseMirror walk, a transaction,
  // `getJSON()` of the whole scene, and a brand-new project object, which
  // then re-runs every scene's choice extraction for the graph. The
  // toolbar got this throttle; these two controls did not, and they reach
  // the same pipeline by a longer route (v0.49.0).
  const onChangeFrame = useRafThrottledPatch(onChange);
  /**
   * Whether the fill's reading on the two grounds is on screen (v0.58.0).
   *
   * THE FILL AND NOT THE BORDER, deliberately. The fill is what a choice's
   * label has to be legible against, and it is what `checkStoryContrast`
   * measures — so the panel and the export's warning are answering the
   * same question with the same function. A border has no text on it and
   * no threshold in the export; giving it a number here would invent a
   * rule the export does not enforce, and two rules is how they disagree.
   * The specimen draws the border anyway, because it is part of the box.
   */
  const [readingFill, setReadingFill] = useState(false);
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <Field label="Fill">
        <ColorField
          value={box.fill}
          fallback="#2a2a28"
          subject={subject}
          onChange={(fill) => onChangeFrame({ fill })}
          onPin={(fill) => onChange({ fill })}
          onPick={() => setReadingFill(true)}
        />
      </Field>
      <Field label="Border">
        <ColorField
          value={box.border}
          fallback="#3a3a37"
          subject={subject}
          onChange={(border) => onChangeFrame({ border })}
          onPin={(border) => onChange({ border })}
        />
      </Field>
      <Field label={`Thickness — ${box.borderWidth}px`}>
        <input
          type="range"
          min={0}
          max={5}
          step={1}
          value={box.borderWidth}
          onChange={(e) => onChangeFrame({ borderWidth: Number(e.target.value) })}
          className="w-full accent-[var(--accent)]"
        />
      </Field>
      <Field label={`Corners — ${box.radius}px`}>
        <input
          type="range"
          min={0}
          max={20}
          step={1}
          value={box.radius}
          onChange={(e) => onChangeFrame({ radius: Number(e.target.value) })}
          className="w-full accent-[var(--accent)]"
        />
      </Field>

      {/* Across both columns and in the flow rather than floating: this is
          a dialog and an Inspector panel, not a toolbar, so there is room
          to say it without covering the controls it is about. */}
      {readingFill && (
        <div className="col-span-2">
          <ColorOnGrounds
            subject={{ kind: "box", fill: box.fill }}
            onDismiss={() => setReadingFill(false)}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
}

/**
 * A colour with a way back to "the app's own". That matters more here than
 * in the toolbar: the default fill and border are theme variables, so a
 * style that hasn't been given a colour follows light and dark mode, and
 * once you pick a hex it no longer can. "Theme" puts it back.
 */
function ColorField({
  value,
  fallback,
  subject,
  onChange,
  onPin,
  onPick,
}: {
  value: string | null;
  fallback: string;
  subject: "style" | "choice" | "line";
  /** Throttled to one commit per frame — the ordinary path. */
  onChange: (value: string | null) => void;
  /**
   * The same edit, NOT throttled. Used for the single event that turns a
   * themed colour into a fixed one, because the notice raised alongside it
   * offers to undo that edit — and a toast can only carry the history step
   * that already exists when it is raised. Through the throttle, the step
   * lands a frame later and the toast is left with nothing to reverse.
   */
  onPin: (value: string | null) => void;
  /** Fired on the first event of a pick, where the caller shows how the
   *  colour reads on the reader's two grounds (v0.58.0). */
  onPick?: () => void;
}) {
  const isThemed = !value || value.startsWith("var(");
  // Fires once per themed → fixed crossing, not once per pointer event.
  // A native colour input emits continuously while the pointer moves
  // inside it, and `value` only catches up a frame later, so a check on
  // the prop alone would raise the same notice sixty times a second.
  const announced = useRef(false);
  if (isThemed && announced.current) announced.current = false;

  return (
    <span className="flex items-center gap-1.5">
      <label
        className={`flex h-7 w-9 shrink-0 cursor-pointer items-center justify-center rounded border ${
          isThemed ? "border-[var(--border)]" : "border-[var(--accent)]"
        }`}
        style={{ background: value ?? "var(--surface-2)" }}
        title={isThemed ? "Pick a colour" : "A fixed colour — this no longer follows the theme"}
      >
        <input
          type="color"
          value={isThemed ? fallback : value}
          onChange={(e) => {
            onPick?.();
            /*
              SAY IT AT THE MOMENT IT HAPPENS (v0.55.0).
              Opening this picker on a themed colour and moving the pointer
              at all writes a hex into the STORY FILE, permanently — the
              style stops following light and dark for good, and nothing
              said so. A writer found out when a reader opened the export
              on a light ground and the choices were dark boxes. The
              "Theme" button beside this has always been the way back; it
              was just never announced, and an affordance nobody knows they
              need is not a way back.

              `showUndo` rather than a plain notice, because the edit is a
              history step with a merge key (see `updateChoiceStyle`), so
              one click reverses the whole colour change rather than one
              frame of it.
            */
            if (!announced.current) {
              announced.current = true;
              // Commit first, announce second. See `onPin`.
              onPin(e.target.value);
              useToastStore
                .getState()
                .showUndo(
                  `This ${subject} now uses a fixed colour and no longer follows the theme`,
                );
              return;
            }
            onChange(e.target.value);
          }}
          className="h-0 w-0 opacity-0"
        />
      </label>
      <button
        type="button"
        onClick={() => onChange(null)}
        disabled={isThemed}
        title="Follow the app's light/dark theme"
        className="rounded px-1.5 py-1 text-[11px] text-[var(--text-3)] hover:text-[var(--text)] disabled:opacity-40"
      >
        Theme
      </button>
    </span>
  );
}
