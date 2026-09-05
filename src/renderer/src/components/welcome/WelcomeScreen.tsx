import { useEffect, useState } from "react";
import { useProjectStore } from "../../state/projectStore";
import { NewProjectDialog } from "./NewProjectDialog";

export function WelcomeScreen() {
  const recentProjects = useProjectStore((s) => s.recentProjects);
  const loadRecent = useProjectStore((s) => s.loadRecent);
  const openProject = useProjectStore((s) => s.openProject);
  const openRecentProject = useProjectStore((s) => s.openRecentProject);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[var(--bg)] text-[var(--text)]">
      <div className="w-full max-w-md">
        <span aria-hidden className="font-blackletter-mark mb-2 block text-5xl text-[var(--accent)]">
          S
        </span>
        <h1 className="font-serif-narrative mb-1 text-3xl italic text-[var(--text)]">Scriare</h1>
        <p className="mb-8 text-sm text-[var(--text-3)]">Build stories, not syntax.</p>

        <div className="mb-8 flex gap-3">
          <button
            type="button"
            onClick={() => setShowNewProjectDialog(true)}
            className="flex-1 rounded-md bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--accent-text-on)] hover:bg-[var(--accent-hover)] transition-colors"
          >
            New Project
          </button>
          <button
            type="button"
            onClick={() => void openProject()}
            className="flex-1 rounded-md border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
          >
            Open Project
          </button>
        </div>

        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">
            Recent Projects
          </h2>
          {recentProjects.length === 0 ? (
            <p className="text-sm text-[var(--text-3)]">No recent projects yet.</p>
          ) : (
            <ul className="space-y-1">
              {recentProjects.map((p) => (
                <li key={p.filePath}>
                  <button
                    type="button"
                    onClick={() => void openRecentProject(p.filePath)}
                    className="w-full rounded-md px-3 py-2 text-left text-sm text-[var(--text-2)] hover:bg-[var(--surface-2)]"
                    title={p.filePath}
                  >
                    <div className="font-medium text-[var(--text)]">{p.name}</div>
                    <div className="truncate text-xs text-[var(--text-3)]">{p.filePath}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {showNewProjectDialog && (
        <NewProjectDialog onClose={() => setShowNewProjectDialog(false)} />
      )}
    </div>
  );
}
