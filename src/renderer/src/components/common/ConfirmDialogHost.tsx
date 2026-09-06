import { useConfirmDialogStore } from "../../state/confirmDialogStore";
import { Modal } from "./Modal";

/**
 * Mounted once near the app root. Renders whatever confirmation is
 * currently pending via `confirmDialog()` — nothing to render most of the
 * time (`request` is null), so it's safe to keep mounted everywhere,
 * including behind Play Mode.
 */
export function ConfirmDialogHost() {
  const request = useConfirmDialogStore((s) => s.request);
  const resolve = useConfirmDialogStore((s) => s.resolve);

  if (!request) return null;

  return (
    <Modal onClose={() => resolve(false)} onEnter={() => resolve(true)}>
      <h2 className="mb-2 text-base font-semibold text-[var(--text)]">{request.title}</h2>
      <p className="mb-5 text-sm leading-relaxed text-[var(--text-2)]">{request.message}</p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => resolve(false)}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)]"
        >
          {request.cancelLabel ?? "Cancel"}
        </button>
        <button
          type="button"
          autoFocus
          onClick={() => resolve(true)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            request.danger
              ? "bg-[var(--danger)] text-[var(--danger-text-on)] hover:bg-[var(--danger-hover)]"
              : "bg-[var(--accent)] text-[var(--accent-text-on)] hover:bg-[var(--accent-hover)]"
          }`}
        >
          {request.confirmLabel ?? "Confirm"}
        </button>
      </div>
    </Modal>
  );
}
