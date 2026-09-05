import { useState } from "react";
import { useProjectStore } from "../../state/projectStore";

interface NewProjectDialogProps {
  onClose: () => void;
}

export function NewProjectDialog({ onClose }: NewProjectDialogProps) {
  const newProject = useProjectStore((s) => s.newProject);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate(): Promise<void> {
    if (!name.trim() || creating) return;
    setCreating(true);
    await newProject(name);
    setCreating(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-5">
        <h2 className="mb-4 text-sm font-semibold text-[var(--text)]">New Project</h2>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleCreate();
            if (e.key === "Escape") onClose();
          }}
          placeholder="Story title"
          className="mb-4 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
        />
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
            onClick={() => void handleCreate()}
            disabled={!name.trim() || creating}
            className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-text-on)] hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
