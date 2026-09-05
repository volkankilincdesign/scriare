import { useState } from "react";
import { useProjectStore } from "../../state/projectStore";
import { ProjectSettingsDialog } from "./ProjectSettingsDialog";

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

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={closeProject}
          className="text-sm font-semibold tracking-wide text-zinc-100 hover:text-emerald-400"
          title="Back to Welcome screen"
        >
          Scriare
        </button>
        <span className="text-zinc-600">/</span>
        <span className="text-sm text-zinc-300">{projectName}</span>
        {!isPlaying && (
          <span className="ml-2 text-xs text-zinc-500">{SAVE_STATUS_LABEL[saveStatus]}</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {!isPlaying && (
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            title="Project Settings"
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800"
          >
            ⚙
          </button>
        )}
        {isPlaying ? (
          <button
            type="button"
            onClick={exitPlay}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
          >
            ■ Exit Play
          </button>
        ) : (
          <button
            type="button"
            onClick={startPlay}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
          >
            ▶ Play
          </button>
        )}
        <button
          type="button"
          disabled
          title="Coming in a later milestone"
          className="cursor-not-allowed rounded-md border border-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-500"
        >
          Export
        </button>
      </div>

      {settingsOpen && <ProjectSettingsDialog onClose={() => setSettingsOpen(false)} />}
    </header>
  );
}
