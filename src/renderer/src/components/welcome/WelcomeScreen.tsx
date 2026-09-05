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
    <div className="flex h-screen w-screen items-center justify-center bg-zinc-900 text-zinc-200">
      <div className="w-full max-w-md">
        <h1 className="mb-1 text-2xl font-semibold text-zinc-100">Scriare</h1>
        <p className="mb-8 text-sm text-zinc-500">Build stories, not syntax.</p>

        <div className="mb-8 flex gap-3">
          <button
            type="button"
            onClick={() => setShowNewProjectDialog(true)}
            className="flex-1 rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
          >
            New Project
          </button>
          <button
            type="button"
            onClick={() => void openProject()}
            className="flex-1 rounded-md border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            Open Project
          </button>
        </div>

        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Recent Projects
          </h2>
          {recentProjects.length === 0 ? (
            <p className="text-sm text-zinc-600">No recent projects yet.</p>
          ) : (
            <ul className="space-y-1">
              {recentProjects.map((p) => (
                <li key={p.filePath}>
                  <button
                    type="button"
                    onClick={() => void openRecentProject(p.filePath)}
                    className="w-full rounded-md px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800"
                    title={p.filePath}
                  >
                    <div className="font-medium text-zinc-200">{p.name}</div>
                    <div className="truncate text-xs text-zinc-500">{p.filePath}</div>
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
