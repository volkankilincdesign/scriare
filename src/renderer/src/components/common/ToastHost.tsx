import { useToastStore } from "../../state/toastStore";

/**
 * Renders the transient notices at the bottom of the window. Mounted once
 * near the app root, alongside ConfirmDialogHost — nothing to render most
 * of the time.
 *
 * Deliberately bottom-centre and quiet: this is a receipt for something
 * the writer already did, not a demand for attention. A toast whose action
 * has gone stale (see toastStore) keeps its message but drops the button,
 * so it never silently becomes a lie about what clicking it would do.
 */
export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  const undoToast = useToastStore((s) => s.undoToast);

  if (toasts.length === 0) return null;

  return (
    // ABOVE the modal layer (z-[100]), not below it. Both are fixed
    // siblings under App's root, which creates no stacking context, so
    // they competed directly — and at z-50 the toast lost. Three callers
    // raise one from INSIDE their own dialog: Export's disk-full and
    // read-only notices, the Variable Manager's delete-with-Undo, and
    // Choice Styles' delete-with-Undo. In all three the writer saw the row
    // vanish with no undo offered, or an export button that returned to
    // "Export…" with no explanation. toastStore.ts says of showNotice
    // that "a disk with no room left is the one moment the app must not
    // fail quietly" — this was that moment, failing quietly (v0.49.0).
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[110] flex flex-col items-center gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className="scriare-toast pointer-events-auto flex items-center gap-3 rounded-lg border border-[var(--border-faint)] bg-[var(--surface-2)] py-2 pl-4 pr-2 shadow-[shadow:var(--shadow-floating)]"
        >
          <span className="text-sm text-[var(--text-2)]">{toast.message}</span>

          {toast.undoToken !== null && !toast.stale && (
            <button
              type="button"
              onClick={() => undoToast(toast.id)}
              className="rounded-md px-2.5 py-1 text-sm font-medium text-[var(--text)] underline decoration-[var(--border-faint)] underline-offset-4 transition-colors hover:bg-[var(--surface-3)] hover:decoration-[var(--text-2)]"
            >
              Undo
            </button>
          )}

          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            aria-label="Dismiss"
            className="rounded-md px-2 py-1 text-sm leading-none text-[var(--text-3)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-2)]"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
