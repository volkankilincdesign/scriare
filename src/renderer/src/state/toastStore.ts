import { create } from "zustand";
import { useProjectStore } from "./projectStore";

/**
 * Transient notices along the bottom of the window (v0.26.0).
 *
 * The reason this exists is that v0.25.0's undo made the app's delete
 * confirmations redundant in the wrong direction. A modal asking "are you
 * sure?" stops the writer to prevent a mistake that is now reversible; it
 * costs a click on every single delete to protect against a case that
 * costs one Ctrl+Z. The toast inverts that trade: the delete happens
 * immediately, and the way out is offered afterwards, where it interrupts
 * nobody.
 *
 * The correctness problem a naive version of this gets wrong: the toast's
 * "Undo" button must reverse THE ACTION IT IS ABOUT, not whatever happens
 * to be on top of the undo stack when it's clicked. Delete a scene, drag
 * two nodes in the graph, then click the toast — a naive implementation
 * would undo the drag and leave the scene deleted, which is worse than
 * having no button at all.
 *
 * So a toast records the history token of the step it was raised for (see
 * history.ts) and stops offering its action the moment that step is no
 * longer the one undo would reverse. The store is subscribed to for
 * exactly that, rather than the component polling.
 */
export interface Toast {
  id: number;
  message: string;
  /**
   * The history step this toast can reverse, or null for a plain notice
   * with no action.
   */
  undoToken: number | null;
  /** True once something else has happened and the action is no longer safe. */
  stale: boolean;
}

interface ToastState {
  toasts: Toast[];
  /** Raises a toast offering to undo whatever was just done. */
  showUndo: (message: string) => void;
  dismiss: (id: number) => void;
  /** Undoes the step this toast was raised for, then dismisses it. */
  undoToast: (id: number) => void;
}

/** How long a toast stays up. Long enough to notice and react, not long
 *  enough to become furniture. */
export const TOAST_DURATION_MS = 9000;

let nextId = 0;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  showUndo: (message) => {
    const undoToken = useProjectStore.getState().undoToken;
    const id = ++nextId;

    set({ toasts: [...get().toasts, { id, message, undoToken, stale: false }] });

    timers.set(
      id,
      setTimeout(() => get().dismiss(id), TOAST_DURATION_MS),
    );
  },

  dismiss: (id) => {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },

  undoToast: (id) => {
    const toast = get().toasts.find((t) => t.id === id);
    get().dismiss(id);
    if (!toast || toast.stale || toast.undoToken === null) return;
    // Re-check against the live store rather than trusting `stale`: the
    // flag is set by a subscription, and a click could in principle land
    // in the same tick as the change that invalidates it.
    if (useProjectStore.getState().undoToken !== toast.undoToken) return;
    useProjectStore.getState().undo();
  },
}));

/**
 * Marks every outstanding toast stale as soon as the top of the undo stack
 * moves — whether because the writer did something else, or because they
 * undid it another way (the keyboard, the top bar). Subscribing once here,
 * at module scope, keeps the rule in one place instead of in each toast.
 */
useProjectStore.subscribe((state, previous) => {
  if (state.undoToken === previous.undoToken) return;
  const { toasts } = useToastStore.getState();
  if (toasts.length === 0) return;
  useToastStore.setState({
    toasts: toasts.map((t) =>
      t.undoToken !== null && t.undoToken !== state.undoToken ? { ...t, stale: true } : t,
    ),
  });
});
