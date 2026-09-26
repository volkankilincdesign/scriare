import { useState } from "react";
import { useProjectStore } from "../../state/projectStore";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { DialogHeader } from "../common/DialogHeader";
import { INPUT_CLASS } from "../common/Field";

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
      {/* v0.56.0: this was the app's only `text-sm font-semibold` title —
          a fourth size, on the first dialog a new writer ever sees. */}
      <DialogHeader title="New Project">
        Name it now; you can rename it whenever you like.
      </DialogHeader>
      <input
        autoFocus
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Story title"
        className={`mb-4 ${INPUT_CLASS}`}
      />
      <div className="flex justify-end gap-2">
        <Button intent="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          intent="primary"
          onClick={() => void handleCreate()}
          disabled={!name.trim() || creating}
        >
          {creating ? "Creating…" : "Create"}
        </Button>
      </div>
    </Modal>
  );
}
