import { useState } from "react";
import { useProjectStore } from "../../state/projectStore";
import { Modal } from "../common/Modal";

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

  // Sprint 8D consistency fix: this was the one dialog in the app not built
  // on the shared <Modal> shell — it had its own hand-rolled backdrop with a
  // hardcoded `bg-black/50` instead of the `--overlay` token every other
  // dialog reads, no backdrop-blur, and (since it had no click-outside or
  // window-level Escape handling of its own) didn't dismiss on either,
  // unlike every other dialog in the app. It's also the very first dialog a
  // new user ever sees, which made the gap more noticeable, not less. Now
  // built on Modal like ProjectSettingsDialog/MoveToDialog/ConfirmDialogHost,
  // with the input's own Enter/Escape handling left in place since Modal's
  // window-level listener only fires once the input isn't swallowing the key.
  return (
    <Modal onClose={onClose} onEnter={() => void handleCreate()}>
      <h2 className="mb-4 text-sm font-semibold text-[var(--text)]">New Project</h2>
      <input
        autoFocus
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
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
    </Modal>
  );
}
