/**
 * The way back out of a dialog you reached from another one (v0.55.0).
 *
 * Scriare's dialogs deliberately do not stack: opening the Choice Styles
 * manager from Project Settings CLOSES Settings, because the manager is a
 * place you go rather than a detail of the dialog you left. That decision
 * is still right — two dimmed backdrops over each other is how a settings
 * screen starts feeling like a maze — but it left a dead end. The only way
 * back to the Start Scene after looking at a style was to dismiss the
 * manager and reopen Settings from the top bar, which is the kind of gap
 * that reads as the app not knowing where it is.
 *
 * So the relationship is drawn instead of stacked: one line at the top of
 * the child dialog, naming the parent, above the child's own heading.
 *
 * ESCAPE STILL CLOSES EVERYTHING rather than stepping back one level.
 * Stepping back is the other defensible rule and it was considered — it is
 * what a nested settings screen does elsewhere — but Escape and the
 * backdrop are the same gesture in this app ("I am done here"), and
 * turning "done" into "up one level" would mean a writer who clicks well
 * outside the card lands in a dialog they did not ask for. The way back is
 * visible; nobody has to guess it from a key.
 */
export function DialogBackLink({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="-ml-1.5 mb-2 flex items-center gap-1.5 rounded px-1.5 py-1 text-xs text-[var(--text-3)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="flex-shrink-0"
      >
        <path d="M19 12H6M11 6l-6 6 6 6" />
      </svg>
      {label}
    </button>
  );
}
