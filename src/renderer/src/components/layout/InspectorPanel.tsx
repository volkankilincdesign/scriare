import { useProjectStore } from "../../state/projectStore";
import { extractChoices } from "../../utils/choiceBlocks";

interface InspectorPanelProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function InspectorPanel({ collapsed, onToggle }: InspectorPanelProps) {
  const project = useProjectStore((s) => s.project);
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
  const setStartScene = useProjectStore((s) => s.setStartScene);

  const scene = project?.scenes.find((s) => s.id === selectedSceneId) ?? null;
  const choices = scene ? extractChoices(scene.content) : [];
  const isStartScene = Boolean(scene) && project?.startSceneId === scene?.id;

  function destinationLabel(targetSceneId: string | null): string {
    if (!targetSceneId) return "Not linked yet";
    const target = project?.scenes.find((sc) => sc.id === targetSceneId);
    return target ? `→ ${target.title || "Untitled scene"}` : "Not linked yet";
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="flex w-8 shrink-0 flex-col items-center gap-1.5 border-l border-[var(--border-soft)] bg-[var(--surface)] pt-2 text-[var(--text-3)] hover:text-[var(--text)]"
        title="Expand Scene Details"
      >
        <span aria-hidden className="text-[10px]">◂</span>
        <span className="[writing-mode:vertical-rl] text-xs font-semibold uppercase tracking-wide">
          Scene Details
        </span>
      </button>
    );
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-[var(--border-soft)] bg-[var(--surface)]">
      <div className="flex items-center gap-2 border-b border-[var(--border-soft)] px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          className="rounded px-1.5 text-sm text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          title="Collapse"
        >
          <span aria-hidden>▸</span>
        </button>
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">
          Scene Details
        </span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3 text-sm">
        {!scene ? (
          <p className="text-[var(--text-3)]">Select a scene to see its details.</p>
        ) : (
          <div>
            <label className="mb-4 flex items-center gap-2 text-sm text-[var(--text-2)]">
              <input
                type="checkbox"
                checked={isStartScene}
                onChange={(e) => setStartScene(e.target.checked ? scene.id : null)}
                className="h-3.5 w-3.5 accent-[var(--accent)]"
              />
              This is the Start Scene
            </label>

            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">
              Outgoing Choices
            </h3>

            {choices.length === 0 ? (
              <p className="text-[var(--text-3)]">
                This scene has no Choice Blocks yet. Insert one from the editor's
                toolbar (+ Choice) or by typing <code>/choice</code> to let this
                scene branch somewhere else.
              </p>
            ) : (
              <ul className="space-y-3">
                {choices.map((choice) => (
                  <li key={choice.id} className="rounded-md border border-[var(--border-soft)] px-2 py-1.5">
                    <div
                      className="mb-1 truncate text-[var(--text-2)]"
                      title={choice.text || "(untitled choice)"}
                    >
                      {choice.text || "(untitled choice)"}
                    </div>
                    <span
                      className={`text-xs ${
                        choice.targetSceneId ? "text-[var(--accent)]" : "text-[var(--text-3)]"
                      }`}
                    >
                      {destinationLabel(choice.targetSceneId)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-3 text-xs text-[var(--text-3)]">
              Edit choice text and destinations directly in the document.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
