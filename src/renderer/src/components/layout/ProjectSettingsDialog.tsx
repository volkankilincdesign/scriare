import { useState } from "react";
import { Modal } from "../common/Modal";
import { useProjectStore } from "../../state/projectStore";
import { THEMES, useThemeStore } from "../../state/themeStore";
import { useUIStore } from "../../state/uiStore";
import type { ThemeId } from "../../state/themeStore";

interface ProjectSettingsDialogProps {
  onClose: () => void;
}

/**
 * Project-wide settings: the Start Scene (the scene Play Mode begins from)
 * and Appearance (Light/Dark mode, as of v0.12.0's Minimal redesign —
 * previously a 4-way colour theme picker). Appearance applies instantly as
 * you click a swatch — it's a display preference, not something that
 * needs a Save step — while Start Scene stays a draft until Save/Enter, to
 * match its existing behaviour.
 */
export function ProjectSettingsDialog({ onClose }: ProjectSettingsDialogProps) {
  const project = useProjectStore((s) => s.project);
  const setStartScene = useProjectStore((s) => s.setStartScene);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const [draftStart, setDraftStart] = useState(
    project?.startSceneId ?? project?.scenes[0]?.id ?? "",
  );

  if (!project) return null;

  function handleSave(): void {
    if (draftStart) setStartScene(draftStart);
    onClose();
  }

  return (
    <Modal onClose={onClose} onEnter={handleSave} widthClassName="max-w-md">
      <h2 className="mb-4 font-serif-narrative text-base italic text-[var(--text)]">
        Project Settings
      </h2>

      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
        Appearance
      </label>
      <p className="mb-2.5 text-xs text-[var(--text-3)]">
        Light or dark mode. Your choice is remembered between sessions.
      </p>
      <div className="mb-5 grid grid-cols-2 gap-2.5">
        {THEMES.map((t) => (
          <ThemeSwatch key={t.id} id={t.id} label={t.label} active={theme === t.id} onSelect={setTheme} />
        ))}
      </div>

      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
        Start Scene
      </label>
      <p className="mb-2 text-xs text-[var(--text-3)]">
        Play Mode begins here. If none is set, the first Story scene is used.
      </p>
      <select
        autoFocus
        value={draftStart}
        onChange={(e) => setDraftStart(e.target.value)}
        className="mb-4 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
      >
        {project.scenes.map((scene) => (
          <option key={scene.id} value={scene.id}>
            {scene.title || "Untitled scene"}
          </option>
        ))}
      </select>

      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
        Choice Styles
      </label>
      <p className="mb-2 text-xs text-[var(--text-3)]">
        How choices look — named once, used anywhere in the story.
      </p>
      <button
        type="button"
        onClick={() => {
          // Closes this dialog rather than stacking one modal on another:
          // the styles manager is a place you go, not a detail of Settings.
          onClose();
          useUIStore.getState().openChoiceStyles();
        }}
        className="mb-5 w-full rounded-md border border-[var(--border)] px-3 py-2 text-left text-sm text-[var(--text-2)] hover:border-[var(--border-faint)] hover:text-[var(--text)]"
      >
        {project.choiceStyles.length}{" "}
        {project.choiceStyles.length === 1 ? "style" : "styles"} — manage…
      </button>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-3 py-1.5 text-sm text-[var(--text-2)] hover:bg-[var(--surface-2)]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-text-on)] hover:bg-[var(--accent-hover)]"
        >
          Save
        </button>
      </div>
    </Modal>
  );
}

interface ThemeSwatchProps {
  id: ThemeId;
  label: string;
  active: boolean;
  onSelect: (id: ThemeId) => void;
}

/**
 * A theme's three signature colours (background / text / accent), read live
 * from that theme's own CSS variables so the swatch never drifts out of
 * sync with themes.css — nothing here is a hardcoded duplicate of the
 * palette values.
 */
function ThemeSwatch({ id, label, active, onSelect }: ThemeSwatchProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      data-theme={id}
      className={`rounded-lg border p-2.5 text-left transition-colors ${
        active
          ? "border-[var(--accent)] shadow-[0_0_0_3px_var(--accent-soft-2)]"
          : "border-[var(--border)] hover:border-[var(--border-faint)]"
      }`}
      style={{ background: "var(--surface-2)" }}
    >
      <span className="mb-2 flex gap-1">
        <span
          className="h-4 w-4 rounded-full border border-black/10"
          style={{ background: "var(--bg)" }}
        />
        <span
          className="h-4 w-4 rounded-full border border-black/10"
          style={{ background: "var(--text)" }}
        />
        <span
          className="h-4 w-4 rounded-full border border-black/10"
          style={{ background: "var(--accent)" }}
        />
      </span>
      <span className="block text-xs font-semibold text-[var(--text)]">{label}</span>
    </button>
  );
}
