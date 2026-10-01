import { create } from "zustand";

/**
 * The question asked when a close meets a save that cannot be written
 * (v0.86.0).
 *
 * ITS OWN STORE RATHER THAN `confirmDialogStore`, and the reason is the
 * dismiss. That store is a yes/no, and a yes/no has to decide which answer
 * an Escape key means — here both answers are consequential, and the safe
 * one (keep writing) and the destructive one (close without saving) cannot
 * share a key. SaveConflictDialog solved the same problem the same way: a
 * dialog with three real answers and no way out that isn't one of them.
 *
 * Deliberately NOT part of projectStore. What is being asked is a question
 * about the window, raised by two different close paths, and the project
 * store already carries the fact the question is about — `saveFailed`.
 */
interface SaveFailedPromptState {
  /** Set while the question is on screen; resolves the caller's promise. */
  resolver: ((proceed: boolean) => void) | null;
  /** Raises the question. Resolves true to go on closing, false to stay. */
  ask: () => Promise<boolean>;
  resolve: (proceed: boolean) => void;
}

export const useSaveFailedPromptStore = create<SaveFailedPromptState>((set, get) => ({
  resolver: null,

  ask: () =>
    new Promise<boolean>((resolve) => {
      // A second close request while the first question stands resolves the
      // first as "stay" rather than leaving a promise that never settles —
      // confirmDialogStore's rule, and for the same reason.
      get().resolver?.(false);
      set({ resolver: resolve });
    }),

  resolve: (proceed) => {
    const { resolver } = get();
    set({ resolver: null });
    resolver?.(proceed);
  },
}));

/** `if (await askBeforeLosingUnsavedWork()) { close }` */
export function askBeforeLosingUnsavedWork(): Promise<boolean> {
  return useSaveFailedPromptStore.getState().ask();
}
