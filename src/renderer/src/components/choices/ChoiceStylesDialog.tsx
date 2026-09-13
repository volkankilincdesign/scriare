import { useState } from "react";
import { Modal } from "../common/Modal";
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
    <Modal onClose={onClose} widthClassName="max-w-lg">
      <h2 className="mb-1 font-serif-narrative text-base italic text-[var(--text)]">
        Choice Styles
      </h2>
      <p className="mb-4 text-xs text-[var(--text-3)]">
        How a choice looks, named once and used anywhere. Change a style here and
        every choice wearing it changes with it. The words inside a choice are
        styled with the toolbar, like any other sentence.
      </p>

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
        <button
          type="button"
          onClick={handleAdd}
          className="rounded px-1.5 py-0.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-soft-2)]"
        >
          + Add Style
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-text-on)] hover:bg-[var(--accent-hover)]"
        >
          Done
        </button>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
        {label}
      </span>
      {children}
    </label>
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
}: {
  box: ChoiceBox;
  onChange: (patch: Partial<ChoiceBox>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <Field label="Fill">
        <ColorField
          value={box.fill}
          fallback="#2a2a28"
          onChange={(fill) => onChange({ fill })}
        />
      </Field>
      <Field label="Border">
        <ColorField
          value={box.border}
          fallback="#3a3a37"
          onChange={(border) => onChange({ border })}
        />
      </Field>
      <Field label={`Thickness — ${box.borderWidth}px`}>
        <input
          type="range"
          min={0}
          max={5}
          step={1}
          value={box.borderWidth}
          onChange={(e) => onChange({ borderWidth: Number(e.target.value) })}
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
          onChange={(e) => onChange({ radius: Number(e.target.value) })}
          className="w-full accent-[var(--accent)]"
        />
      </Field>
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
  onChange,
}: {
  value: string | null;
  fallback: string;
  onChange: (value: string | null) => void;
}) {
  const isThemed = !value || value.startsWith("var(");
  return (
    <span className="flex items-center gap-1.5">
      <label
        className="flex h-7 w-9 shrink-0 cursor-pointer items-center justify-center rounded border border-[var(--border)]"
        style={{ background: value ?? "var(--surface-2)" }}
        title="Pick a colour"
      >
        <input
          type="color"
          value={isThemed ? fallback : value}
          onChange={(e) => onChange(e.target.value)}
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
