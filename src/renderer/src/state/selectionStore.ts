import { create } from "zustand";

/**
 * Which panel the keyboard is currently talking to, and what it has
 * selected (v0.27.0).
 *
 * Two panels can hold a selection at the same time — a set of rows in the
 * Content Browser and a set of nodes in the Story Graph — and both of them
 * keep that selection visible, deliberately, so you don't lose your place
 * when you look at the other one. That's fine until a window-level Delete
 * has to decide which one it means.
 *
 * The rule is the one every desktop app uses without ever explaining it:
 * the panel you touched last owns the keyboard. Each panel claims the
 * surface on pointer-down anywhere inside it, which is exactly the gesture
 * that precedes reaching for a key, and publishes its ids as they change.
 *
 * The selections themselves stay local to their components — this is a
 * mirror for the shortcut layer to read, not a second source of truth.
 * Lifting either one out of its panel would mean rewriting a working
 * multi-selection implementation to fix a problem it doesn't have.
 */
export type SelectionSurface = "content" | "graph";

interface SelectionState {
  surface: SelectionSurface | null;
  /** Content Browser rows: folder and scene ids, in tree order. */
  contentIds: string[];
  /** Story Graph nodes: scene ids, and frame ids, mixed. */
  graphIds: string[];

  claimSurface: (surface: SelectionSurface) => void;
  setContentIds: (ids: string[]) => void;
  setGraphIds: (ids: string[]) => void;
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  surface: null,
  contentIds: [],
  graphIds: [],

  claimSurface: (surface) => {
    if (get().surface === surface) return; // no-op writes would re-render both panels on every click
    set({ surface });
  },

  setContentIds: (ids) => {
    if (sameIds(get().contentIds, ids)) return;
    set({ contentIds: ids });
  },

  setGraphIds: (ids) => {
    if (sameIds(get().graphIds, ids)) return;
    set({ graphIds: ids });
  },
}));

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}
