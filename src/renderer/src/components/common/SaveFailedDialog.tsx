import { Modal } from "./Modal";
import { useProjectStore } from "../../state/projectStore";

/**
 * The story cannot be saved where it lives, and you asked to leave (v0.86.0).
 *
 * MEASURED FIRST, and the measurement is why this exists instead of the
 * crash-recovery journal the roadmap had carried since v0.47.0. An ordinary
 * edit reaches the disk in 1.53 seconds, and when the disk refuses the app
 * already does the right things: it says so once, names the cause, keeps the
 * work, leaves the last good file untouched, and heals by itself 1.4 seconds
 * after the folder comes back. A journal would have insured a window a
 * second and a half wide — and for a full disk, the commonest cause, the
 * journal could not have been written either.
 *
 * What the same measurement found was a state where work really does
 * disappear, with no crash involved: close the project after a save has
 * failed, and the app clears it without asking, while the notice still on
 * screen says "your work is still open, and the last saved version is
 * intact". The second half of that sentence stays true. The first half
 * becomes a lie at the moment the project closes.
 *
 * THE EXISTING BEHAVIOUR WAS A DECISION, NOT AN OVERSIGHT, which is worth
 * saying because it changes what the fix should be. `useCloseGuard` records
 * it: "a failed save is not a reason to trap the writer in a window they
 * asked to close — the file on disk is still the last good version." That
 * is right about the window. Quitting is a thing a person is entitled to do,
 * and a modal that refuses is a trap. It was then applied to closing a
 * PROJECT, where nobody is trapped — the writer is still in the app, two
 * clicks from carrying on — and where a question costs nothing.
 *
 * So this asks, and every answer is a way out. There is no "not now",
 * because a dialog you can dismiss leaves the writer exactly where they
 * were: holding unsaved work with nowhere to put it.
 *
 * Modelled on SaveConflictDialog deliberately — same family, same question
 * ("we cannot save; what happens to the work?"), so it is the same shape:
 * three full-width stacked choices, each a sentence about the work rather
 * than a verb, with the one that loses something drawn as destructive and
 * placed last.
 */
export function SaveFailedDialog({
  /** What the app will do once an answer is given — close, or go back. */
  onResolve,
}: {
  onResolve: (proceed: boolean) => void;
}) {
  const filePath = useProjectStore((s) => s.filePath);
  const saveCopy = useProjectStore((s) => s.saveCopyElsewhere);
  const name = filePath ? (filePath.split(/[\\/]/).pop() ?? filePath) : "This story";

  return (
    // No onClose, for the reason in the header: dismissing this is the one
    // answer that leaves the problem exactly as it was.
    <Modal onClose={() => {}} widthClassName="max-w-lg">
      <h2 className="mb-3 font-serif-narrative text-base italic text-[var(--text)]">
        This story couldn’t be saved
      </h2>
      <p className="mb-2 text-sm text-[var(--text-2)]">
        Scriare tried to write{" "}
        <span className="font-medium text-[var(--text)]">{name}</span> and the
        folder it lives in would not take it.
      </p>
      <p className="mb-5 text-sm text-[var(--text-3)]">
        Everything you have written since the last successful save is still
        here, in this window, and nowhere else.
      </p>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            // ONLY CLOSE IF SOMETHING WAS WRITTEN. Cancelling the file dialog
            // is not a decision to lose the work, and closing anyway would
            // turn a misclick into the exact loss this dialog exists to
            // prevent. The question stays on screen instead.
            void saveCopy().then((written) => {
              if (written) onResolve(true);
            });
          }}
          /* Not the kit's Button, for SaveConflictDialog's reason: these are
             three stacked answers to a question, not a dialog footer. */
          className="rounded-md border border-[var(--accent)] bg-[var(--accent)] px-3 py-2 text-left text-sm font-medium text-[var(--accent-text-on)] hover:bg-[var(--accent-hover)]"
        >
          Save it somewhere else
          <span className="mt-0.5 block text-xs font-normal opacity-80">
            Pick any folder that works. You carry on in the copy.
          </span>
        </button>
        <button
          type="button"
          onClick={() => onResolve(false)}
          className="rounded-md border border-[var(--border)] px-3 py-2 text-left text-sm text-[var(--text-2)] hover:border-[var(--border-faint)] hover:text-[var(--text)]"
        >
          Keep writing
          <span className="mt-0.5 block text-xs text-[var(--text-3)]">
            Nothing closes. Scriare keeps trying every time you type.
          </span>
        </button>
        <button
          type="button"
          onClick={() => onResolve(true)}
          className="rounded-md border border-[var(--danger)] px-3 py-2 text-left text-sm text-[var(--danger)] hover:bg-[var(--danger)] hover:text-[var(--danger-text-on)]"
        >
          Close without saving
          <span className="mt-0.5 block text-xs opacity-80">
            Loses everything written since the last successful save.
          </span>
        </button>
      </div>
    </Modal>
  );
}
