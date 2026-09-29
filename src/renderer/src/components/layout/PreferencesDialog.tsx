import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { DialogHeader } from "../common/DialogHeader";
import { useUIStore } from "../../state/uiStore";
import { THEMES, useThemeStore } from "../../state/themeStore";
import type { ThemeId } from "../../state/themeStore";

interface PreferencesDialogProps {
  onClose: () => void;
}

/**
 * How the app looks on THIS computer (v0.75.0).
 *
 * Appearance lived in Project Settings from v0.12.0 until now, and it was
 * always in the wrong dialog. Every other setting in there is a fact about
 * the story: it is written into the `.scriare`, it travels with the file,
 * and several of them reach the reader — the title on the exported page,
 * the language in its `lang` attribute, the player's name in front of every
 * line they speak. The theme is none of those things. It is remembered in
 * this machine's localStorage and never written to the file at all, so
 * opening your story on another computer keeps its title and its author and
 * loses its theme.
 *
 * Filing the two together under a heading that says "Project" said they
 * were the same kind of thing. They are the same distinction the app
 * already draws between a theme and a reading ground — the writer's room
 * against the reader's page — and it is worth one more dialog to stop
 * contradicting it.
 *
 * Reached from Project Settings, which is where a writer will look for it
 * out of habit, and told where it came from so it can offer the way back —
 * the same arrangement Choice Styles has had since v0.55.0, for the same
 * reason.
 */
export function PreferencesDialog({ onClose }: PreferencesDialogProps) {
  const cameFrom = useUIStore((s) => s.preferencesFrom);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <Modal onClose={onClose} onEnter={onClose} widthClassName="max-w-md">
      <DialogHeader title="Preferences" />

      <label className="scriare-section-label mb-1 block text-[var(--text-3)]">
        Appearance
      </label>
      <p className="mb-2.5 text-xs text-[var(--text-3)]">
        Eight themes. Applies instantly, remembered between sessions, and not
        saved in the story.
      </p>
      {/* Four columns rather than two, now that there are eight (v0.44.0):
          a theme is chosen by looking, so they have to be on screen at once
          — a list you scroll turns a comparison into a memory test. */}
      <div className="mb-5 grid grid-cols-4 gap-2">
        {THEMES.map((t) => (
          <ThemeSwatch
            key={t.id}
            id={t.id}
            label={t.label}
            description={t.description}
            active={theme === t.id}
            onSelect={setTheme}
          />
        ))}
      </div>

      <div className="flex justify-end gap-2">
        {/* The way back, when there is one to go back to. A writer who
            opened this from Project Settings was in the middle of
            something; sending them to the top bar to start again is the
            dead end v0.55.0 exists to have closed. */}
        {cameFrom === "settings" && (
          <Button
            intent="ghost"
            onClick={() => {
              onClose();
              useUIStore.getState().openSettings();
            }}
          >
            Back to Project Settings
          </Button>
        )}
        <Button intent="primary" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}

interface ThemeSwatchProps {
  id: ThemeId;
  label: string;
  /** Shown as the button's title — what the theme is, in three words. */
  description: string;
  active: boolean;
  onSelect: (id: ThemeId) => void;
}

/**
 * A theme's three signature colours (background / text / accent), read live
 * from that theme's own CSS variables so the swatch never drifts out of
 * sync with themes.css — nothing here is a hardcoded duplicate of the
 * palette values.
 */
function ThemeSwatch({ id, label, description, active, onSelect }: ThemeSwatchProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      data-theme={id}
      // A theme picker's whole job is to paint colours that are NOT the
      // current palette — eight grounds, four dots each, every one of them
      // deliberately foreign. `data-content-colour` is the existing mark
      // for "this colour IS the content" (see EditorToolbar), and this is
      // the other place in the app that qualifies. Without it, extending
      // the palette walk to this dialog in v0.50.0 reported 43 strays per
      // theme, all of them correct behaviour.
      data-content-colour
      title={description}
      aria-pressed={active}
      className={`rounded-lg border p-2 text-left transition-colors ${
        active
          ? "border-[var(--accent)] shadow-[0_0_0_3px_var(--accent-soft-2)]"
          : "border-[var(--border)] hover:border-[var(--border-faint)]"
      }`}
      style={{ background: "var(--surface-2)" }}
    >
      {/* Four dots, not three: --page joined them in v0.44.0 and it is the
          one a writer looks at longest. Read live from this button's own
          data-theme, so a swatch can never disagree with the theme it
          stands for. */}
      <span className="mb-1.5 flex gap-1">
        <span
          className="h-3.5 w-3.5 rounded-full border border-[var(--border)]"
          style={{ background: "var(--bg)" }}
        />
        <span
          className="h-3.5 w-3.5 rounded-full border border-[var(--border)]"
          style={{ background: "var(--page)" }}
        />
        <span
          className="h-3.5 w-3.5 rounded-full border border-[var(--border)]"
          style={{ background: "var(--text)" }}
        />
        <span
          className="h-3.5 w-3.5 rounded-full border border-[var(--border)]"
          style={{ background: "var(--accent)" }}
        />
      </span>
      <span className="block truncate text-[11px] font-semibold text-[var(--text)]">{label}</span>
    </button>
  );
}
