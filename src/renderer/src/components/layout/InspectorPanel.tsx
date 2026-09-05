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
        className="flex w-8 shrink-0 items-center justify-center border-l border-zinc-800 bg-zinc-950 text-zinc-500 hover:text-zinc-200"
        title="Expand Scene Details"
      >
        <span className="[writing-mode:vertical-rl] text-xs tracking-wide">
          Scene Details
        </span>
      </button>
    );
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Scene Details
        </span>
        <button
          type="button"
          onClick={onToggle}
          className="rounded px-1.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          title="Collapse"
        >
          ⟩
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3 text-sm">
        {!scene ? (
          <p className="text-zinc-500">Select a scene to see its details.</p>
        ) : (
          <div>
            <label className="mb-4 flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={isStartScene}
                onChange={(e) => setStartScene(e.target.checked ? scene.id : null)}
                className="h-3.5 w-3.5 accent-emerald-600"
              />
              This is the Start Scene
            </label>

            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Outgoing Choices
            </h3>

            {choices.length === 0 ? (
              <p className="text-zinc-600">
                This scene has no Choice Blocks yet. Insert one from the editor's
                toolbar (+ Choice) or by typing <code>/choice</code> to let this
                scene branch somewhere else.
              </p>
            ) : (
              <ul className="space-y-3">
                {choices.map((choice) => (
                  <li key={choice.id} className="rounded-md border border-zinc-800 px-2 py-1.5">
                    <div
                      className="mb-1 truncate text-zinc-300"
                      title={choice.text || "(untitled choice)"}
                    >
                      {choice.text || "(untitled choice)"}
                    </div>
                    <span
                      className={`text-xs ${
                        choice.targetSceneId ? "text-emerald-500" : "text-zinc-600"
                      }`}
                    >
                      {destinationLabel(choice.targetSceneId)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-3 text-xs text-zinc-600">
              Edit choice text and destinations directly in the document.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
