import { Modal } from "./Modal";
import { useProjectStore } from "../../state/projectStore";

/**
 * The file changed underneath us (v0.47.0).
 *
 * Raised when a save found the project on disk is no longer the version this
 * session opened — the other machine's copy arrived through OneDrive, or the
 * project was edited in a second window. Nothing has been written at the
 * point this appears: the work is still in memory and the newer version is
 * still on disk, which is why this can afford to ask.
 *
 * Three answers, and each one is a sentence about what happens to the work
 * rather than a verb. "Overwrite" is last and is the only one that loses
 * something, so it is drawn as the destructive action it is.
 */
export function SaveConflictDialog() {
  const conflict = useProjectStore((s) => s.saveConflict);
  const reload = useProjectStore((s) => s.resolveConflictReload);
  const saveCopy = useProjectStore((s) => s.resolveConflictSaveCopy);
  const overwrite = useProjectStore((s) => s.resolveConflictOverwrite);

  if (!conflict) return null;

  const name = conflict.filePath.split(/[\\/]/).pop() ?? conflict.filePath;

  return (
    // No onClose: there is no "not now". Dismissing would leave autosave
    // switched off and the writer typing into a document that cannot be
    // saved, which is the failure this whole release is about.
    <Modal onClose={() => {}} widthClassName="max-w-lg">
      <h2 className="mb-3 font-serif-narrative text-base italic text-[var(--text)]">
        This file changed outside Scriare
      </h2>
      <p className="mb-2 text-sm text-[var(--text-2)]">
        <span className="font-medium text-[var(--text)]">{name}</span> is not the
        version you opened. Something else has written to it — another machine
        through a synced folder, or a second window.
      </p>
      <p className="mb-5 text-sm text-[var(--text-3)]">
        Nothing has been saved yet. Your work is still here, and the newer
        version is still on disk.
      </p>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => void saveCopy()}
          className="rounded-md border border-[var(--accent)] bg-[var(--accent)] px-3 py-2 text-left text-sm font-medium text-[var(--accent-text-on)] hover:bg-[var(--accent-hover)]"
        >
          Save my version as a copy
          <span className="mt-0.5 block text-xs font-normal opacity-80">
            Keeps both. You carry on writing in the copy.
          </span>
        </button>
        <button
          type="button"
          onClick={() => void reload()}
          className="rounded-md border border-[var(--border)] px-3 py-2 text-left text-sm text-[var(--text-2)] hover:border-[var(--border-faint)] hover:text-[var(--text)]"
        >
          Open the version on disk
          <span className="mt-0.5 block text-xs text-[var(--text-3)]">
            Discards the changes you have made in this session.
          </span>
        </button>
        <button
          type="button"
          onClick={() => void overwrite()}
          className="rounded-md border border-[var(--danger)] px-3 py-2 text-left text-sm text-[var(--danger)] hover:bg-[var(--danger)] hover:text-[var(--danger-text-on)]"
        >
          Overwrite it with my version
          <span className="mt-0.5 block text-xs opacity-80">
            Discards whatever the other version contains.
          </span>
        </button>
      </div>
    </Modal>
  );
}
