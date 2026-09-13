import { useState } from "react";
import { useProjectStore } from "../../state/projectStore";
import { useUIStore } from "../../state/uiStore";
import { ProjectSettingsDialog } from "./ProjectSettingsDialog";
import { BrandMark } from "../common/BrandMark";

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
      </div>

      <div className="flex items-center gap-2">
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
