import { useConfirmDialogStore } from "../../state/confirmDialogStore";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { DialogHeader } from "./DialogHeader";

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
      <DialogHeader title={request.title} />
      <p className="-mt-2 mb-5 text-sm leading-relaxed text-[var(--text-2)]">{request.message}</p>
      <div className="flex justify-end gap-2">
        {/* Cancel is the way OUT of a dialog, not a second action — so it
            is a ghost rather than a bordered control competing with the
            one that does something. */}
        <Button intent="ghost" onClick={() => resolve(false)}>
          {request.cancelLabel ?? "Cancel"}
        </Button>
        <Button
          intent={request.danger ? "danger" : "primary"}
          autoFocus
          onClick={() => resolve(true)}
        >
          {request.confirmLabel ?? "Confirm"}
        </Button>
      </div>
    </Modal>
  );
}
