import { useState } from "react";
import { useProjectStore } from "../../state/projectStore";
import { useUIStore } from "../../state/uiStore";
import { ProjectSettingsDialog } from "./ProjectSettingsDialog";
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openVariableManager = useUIStore((s) => s.openVariableManager);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const canUndo = useProjectStore((s) => s.canUndo);
  const canRedo = useProjectStore((s) => s.canRedo);
  const undoLabel = useProjectStore((s) => s.undoLabel);
  const redoLabel = useProjectStore((s) => s.redoLabel);

  const modifier = navigator.platform.toLowerCase().includes("mac") ? "⌘" : "Ctrl+";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border-soft)] bg-[var(--surface)] px-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={closeProject}
          className="flex items-center gap-2 text-sm font-semibold tracking-wide text-[var(--text)] hover:text-[var(--accent)]"
          title="Back to Welcome screen"
        >
          <BrandMark className="h-6 w-6 shrink-0" />
          <span className="font-serif-narrative italic">Scriare</span>
        </button>
        <span className="text-[var(--text-3)]">/</span>
        <span className="text-sm text-[var(--text-2)]">{projectName}</span>
        {!isPlaying && (
          <span className="ml-2 text-xs text-[var(--text-3)]">{SAVE_STATUS_LABEL[saveStatus]}</span>
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

      <div className="flex items-center gap-2">
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
        {!isPlaying && (
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
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
          <button
            type="button"
            onClick={startPlay}
            className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-text-on)] hover:bg-[var(--accent-hover)]"
          >
            ▶ Play
          </button>
        )}
        <button
          type="button"
          disabled
          title="Coming in a later milestone"
          className="cursor-not-allowed rounded-md border border-[var(--border-soft)] px-3 py-1.5 text-sm font-medium text-[var(--text-3)]"
        >
          Export
        </button>
      </div>

      {settingsOpen && <ProjectSettingsDialog onClose={() => setSettingsOpen(false)} />}
    </header>
  );
}
