import { useState } from "react";
import { Modal } from "../common/Modal";
import { useProjectStore } from "../../state/projectStore";

interface ProjectSettingsDialogProps {
  onClose: () => void;
}

/**
 * Project-wide settings — today just the Start Scene, the scene Play Mode
 * begins from. Kept as its own small dialog rather than a full settings
 * panel/page since there's exactly one setting to hold right now; more
 * settings can be added as fields in this same dialog later without a
 * bigger structural change.
 */
export function ProjectSettingsDialog({ onClose }: ProjectSettingsDialogProps) {
  const project = useProjectStore((s) => s.project);
  const setStartScene = useProjectStore((s) => s.setStartScene);
  const [draftStart, setDraftStart] = useState(
    project?.startSceneId ?? project?.scenes[0]?.id ?? "",
  );

  if (!project) return null;

  function handleSave(): void {
    if (draftStart) setStartScene(draftStart);
    onClose();
  }

  return (
    <Modal onClose={onClose} onEnter={handleSave}>
      <h2 className="mb-4 text-sm font-semibold text-zinc-100">Project Settings</h2>

      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
        Start Scene
      </label>
      <p className="mb-2 text-xs text-zinc-600">
        Play Mode begins here. If none is set, the first Story scene is used.
      </p>
      <select
        autoFocus
        value={draftStart}
        onChange={(e) => setDraftStart(e.target.value)}
        className="mb-4 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-600"
      >
        {project.scenes.map((scene) => (
          <option key={scene.id} value={scene.id}>
            {scene.title || "Untitled scene"}
          </option>
        ))}
      </select>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
        >
          Save
        </button>
      </div>
    </Modal>
  );
}
