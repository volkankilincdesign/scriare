import { useProjectStore } from "../../state/projectStore";
import { Button } from "../common/Button";
import { confirmDialog } from "../../state/confirmDialogStore";
import { useUIStore } from "../../state/uiStore";
import { ProjectSettingsDialog } from "./ProjectSettingsDialog";
import { PreferencesDialog } from "./PreferencesDialog";
import { BrandMark } from "../common/BrandMark";
import { Icon } from "../common/Icon";

const SAVE_STATUS_LABEL = {
  saved: "All changes saved",
  saving: "Saving...",
  unsaved: "Unsaved changes",
} as const;

export function TopBar() {
  const projectName = useProjectStore((s) => s.project?.name ?? "Untitled Story");
  const saveStatus = useProjectStore((s) => s.saveStatus);
  const closeProject = useProjectStore((s) => s.closeProject);

  const isPlaying = useProjectStore((s) => s.isPlaying);
  const startPlay = useProjectStore((s) => s.startPlay);
  const exitPlay = useProjectStore((s) => s.exitPlay);
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const openSettings = useUIStore((s) => s.openSettings);
  const closeSettings = useUIStore((s) => s.closeSettings);
  const preferencesOpen = useUIStore((s) => s.preferencesOpen);
  const closePreferences = useUIStore((s) => s.closePreferences);
  const openVariableManager = useUIStore((s) => s.openVariableManager);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const canUndo = useProjectStore((s) => s.canUndo);
  const canRedo = useProjectStore((s) => s.canRedo);
  const undoLabel = useProjectStore((s) => s.undoLabel);
  const redoLabel = useProjectStore((s) => s.redoLabel);

  /**
   * Back to the Welcome screen — writing anything pending on the way out.
   * `closeProject` does the flush; the question below covers the one state
   * it cannot flush, for the reasons in hooks/useCloseGuard.ts.
   */
  async function handleClose(): Promise<void> {
    if (useProjectStore.getState().saveConflict) {
      const proceed = await confirmDialog({
        title: "Close without saving?",
        message:
          "This story has changes that haven't been saved, and a conflict you haven't answered yet. " +
          "Closing now loses everything written since you opened it.",
        confirmLabel: "Close anyway",
        cancelLabel: "Go back",
        danger: true,
      });
      if (!proceed) return;
    }
    await closeProject();
  }

  const modifier = navigator.platform.toLowerCase().includes("mac") ? "⌘" : "Ctrl+";

  return (
    <header className="scriare-topbar flex h-14 shrink-0 items-center justify-between border-b border-[var(--border-soft)] bg-[var(--surface)] px-5">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={() => void handleClose()}
          className="flex items-center gap-2 text-sm font-semibold tracking-wide text-[var(--text)] hover:text-[var(--accent)]"
          title="Back to Welcome screen"
        >
          {/* v0.68.0 — the mark takes the theme's accent, and sits on the
              LINE of the word rather than on the centre of its own box. A
              24px disc beside an 11px cap band cannot be centred as boxes
              and look level: measured, it sat 2.5px low. The nudge is a
              whole pixel, because a half-pixel offset smears the disc
              across two rows at 100% zoom, which is the thing it was
              supposed to fix. */}
          <BrandMark className="h-6 w-6 shrink-0 -translate-y-[2px] text-[var(--accent)]" />
          <span className="font-serif-narrative italic">Scriare</span>
        </button>
        <span className="text-[var(--text-3)]">/</span>
        {/* min-w-0 + truncate, because a flex child will not shrink below
            its content otherwise: a multi-word story name wrapped to two
            lines inside this fixed 56px bar and spilled over the border,
            while a single long token pushed the whole right-hand group of
            buttons into wrapping. The status bar already truncates both of
            its names; the two ends of the window disagreed. */}
        <span className="min-w-0 truncate text-sm text-[var(--text-2)]" title={projectName}>
          {projectName}
        </span>
        {!isPlaying && (
          <span className="ml-2 shrink-0 text-xs text-[var(--text-3)]">
            {SAVE_STATUS_LABEL[saveStatus]}
          </span>
        )}

        {/* Undo/redo sit with the project's identity rather than with the
            actions on the right, because they're about the file's state,
            not about starting something. Kept icon-only and disabled-quiet:
            for a writer with nothing to undo they should read as absent,
            not as two buttons refusing to work. The keyboard shortcut is
            the real interface; these exist so it's discoverable. */}
        {!isPlaying && (
          <div className="ml-3 flex items-center gap-0.5">
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              title={canUndo ? `Undo ${undoLabel} (${modifier}Z)` : `Nothing to undo (${modifier}Z)`}
              aria-label={canUndo ? `Undo ${undoLabel}` : "Nothing to undo"}
              className="rounded-md p-1.5 text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)] disabled:pointer-events-none disabled:text-[var(--border-faint)]"
            >
              <Icon name="undo" className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!canRedo}
              title={
                canRedo ? `Redo ${redoLabel} (${modifier}⇧Z)` : `Nothing to redo (${modifier}⇧Z)`
              }
              aria-label={canRedo ? `Redo ${redoLabel}` : "Nothing to redo"}
              className="rounded-md p-1.5 text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)] disabled:pointer-events-none disabled:text-[var(--border-faint)]"
            >
              <Icon name="redo" className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {!isPlaying && (
          <button
            type="button"
            onClick={() => useUIStore.getState().openStoryCheck()}
            title="Check the story for dead links, unreachable scenes and the shape of its routes"
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)]"
          >
            Check
          </button>
        )}
        {!isPlaying && (
          <button
            type="button"
            onClick={openVariableManager}
            title="Variables"
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)]"
          >
            𝑥 Variables
          </button>
        )}
        {/* v0.81.0 — "How Scriare works". Here rather than in the editor's
            own toolbar, where it belongs by meaning and did not fit by
            geometry: see EditorToolbar for the row it made wrap. Beside
            Settings because they are the same kind of control — a door to
            a place, not an action on the story. */}
        {!isPlaying && (
          <button
            type="button"
            onClick={() => useUIStore.getState().openHelp()}
            title="How Scriare works — what the three blocks are for"
            aria-label="How Scriare works"
            data-open-help
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)]"
          >
            ?
          </button>
        )}
        {!isPlaying && (
          <button
            type="button"
            onClick={() => openSettings()}
            title="Project Settings"
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)]"
          >
            ⚙
          </button>
        )}
        {isPlaying ? (
          <button
            type="button"
            onClick={exitPlay}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-2)]"
          >
            ■ Exit Play
          </button>
        ) : (
          <Button
            intent="primary"
            onClick={startPlay}
          >
            ▶ Play
          </Button>
        )}
        {!isPlaying && (
          <button
            type="button"
            onClick={() => useUIStore.getState().openExport()}
            title="Export the story as a web page anyone can read"
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)]"
          >
            Export
          </button>
        )}
      </div>

      {settingsOpen && <ProjectSettingsDialog onClose={closeSettings} />}
      {preferencesOpen && <PreferencesDialog onClose={closePreferences} />}
    </header>
  );
}
