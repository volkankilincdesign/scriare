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
 * A single in-app replacement for window.confirm(), used app-wide so every
 * destructive action (deleting a scene, a folder, a graph Frame, and
 * whatever needs confirming next) shares one dark-themed modal instead of
 * the OS's native dialog. `<ConfirmDialogHost />` (mounted once near the
 * app root) renders whatever `request` is currently pending.
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
