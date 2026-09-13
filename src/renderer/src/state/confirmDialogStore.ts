import { create } from "zustand";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button red — use for destructive actions. */
  danger?: boolean;
}

interface ConfirmRequest extends ConfirmOptions {
  id: number;
}

interface ConfirmDialogState {
  request: ConfirmRequest | null;
  resolver: ((result: boolean) => void) | null;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  resolve: (result: boolean) => void;
}

let nextId = 0;

/**
 * A single in-app replacement for window.confirm(), so anything that needs
 * a yes/no shares one themed modal instead of the OS's native dialog.
 * `<ConfirmDialogHost />` (mounted once near the app root) renders whatever
 * `request` is currently pending.
 *
 * NOTHING CALLS THIS RIGHT NOW, and that's deliberate rather than an
 * oversight. Every caller it had was a delete — scene, folder, bulk, frame,
 * variable — and v0.26.0 replaced those with an undo toast: a modal that
 * stops the writer to prevent a mistake earns its interruption only while
 * the mistake is permanent, and since v0.25.0 none of them are. The store
 * stays because the *next* thing that needs confirming probably won't be
 * undoable — overwriting a file, discarding unsaved work on quit — and
 * that is exactly the case a blocking dialog is for. Deleting it would
 * mean rebuilding it, worse, under time pressure.
 */
export const useConfirmDialogStore = create<ConfirmDialogState>((set, get) => ({
  request: null,
  resolver: null,

  confirm: (options) =>
    new Promise<boolean>((resolve) => {
      // Resolve any dialog already open as "cancelled" before opening a new
      // one — callers should never be left with a promise that never settles.
      get().resolver?.(false);
      set({ request: { ...options, id: ++nextId }, resolver: resolve });
    }),

  resolve: (result) => {
    const { resolver } = get();
    set({ request: null, resolver: null });
    resolver?.(result);
  },
}));

/** Convenience wrapper — `if (await confirmDialog({...})) { ... }`. */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return useConfirmDialogStore.getState().confirm(options);
}
