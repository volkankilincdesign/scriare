import { create } from "zustand";
import { TOUR_STOPS } from "../tour/tourSteps";
import { useProjectStore } from "./projectStore";

/**
 * The first-launch tour (v0.91.0).
 *
 * `step` is -1 for the welcome card (the one with no region lit) and
 * 0..TOUR_STOPS.length-1 for the stops. The welcome card is its own step
 * rather than a separate dialog because it is the same object as the rest —
 * same card, same keys, same way out — and a stranger should meet one
 * thing, not two.
 *
 * SEEN IS REMEMBERED PER INSTALL, like the theme and the panel layout:
 * which tour you have taken is a fact about you on this machine, not about
 * a story, so it lives in localStorage and never in a `.scriare` file.
 * Finishing and skipping are recorded differently because they ARE
 * different answers, and the difference is worth keeping for the day
 * somebody asks how many people skip it — but both mean "do not start on
 * your own again".
 */
export const TOUR_STORAGE_KEY = "scriare:tour";
export type TourRecord = "finished" | "skipped";

function readRecord(): TourRecord | null {
  try {
    const value = window.localStorage.getItem(TOUR_STORAGE_KEY);
    return value === "finished" || value === "skipped" ? value : null;
  } catch {
    return null;
  }
}

function writeRecord(value: TourRecord): void {
  try {
    window.localStorage.setItem(TOUR_STORAGE_KEY, value);
  } catch {
    // Best-effort. A machine that cannot remember will offer the tour again,
    // which is the forgiving way to be wrong.
  }
}

interface TourState {
  active: boolean;
  step: number;
  /** True while the practice story is being written, so Start cannot double-fire. */
  starting: boolean;
  /**
   * Opens the welcome card. `auto` is the first-launch path: it does
   * nothing if this install has already finished or skipped the tour, so it
   * is safe to call every time the empty Welcome screen mounts.
   */
  offer: (auto?: boolean) => void;
  /** From the welcome card: opens a practice story if no story is open, then goes to the first stop. */
  begin: () => Promise<void>;
  next: () => void;
  back: () => void;
  /** Ends the tour. `finished` from the last stop's button, `skipped` from Skip or Esc. */
  end: (how: TourRecord) => void;
}

export const useTourStore = create<TourState>((set, get) => ({
  active: false,
  step: -1,
  starting: false,

  offer: (auto = false) => {
    if (get().active) return;
    if (auto && readRecord() !== null) return;
    set({ active: true, step: -1, starting: false });
  },

  begin: async () => {
    if (get().starting) return;
    set({ starting: true });
    // ON THE STORY THAT IS OPEN, if there is one. Replaying the tour from
    // the ? with a story open is asking "what is all this again", and the
    // answer is clearest pointed at their own writing. Only a tour started
    // from the Welcome screen needs a story made for it.
    if (!useProjectStore.getState().project) {
      const opened = await useProjectStore.getState().openPracticeProject();
      if (!opened) {
        set({ active: false, step: -1, starting: false });
        return;
      }
    }
    set({ step: 0, starting: false });
  },

  next: () => {
    const { step, active } = get();
    if (!active) return;
    if (step === -1) {
      void get().begin();
      return;
    }
    if (step >= TOUR_STOPS.length - 1) get().end("finished");
    else set({ step: step + 1 });
  },

  back: () => {
    const { step, active } = get();
    // Not back past the first stop: the welcome card's only job is to
    // start the tour, and returning to it from inside would offer to start
    // what is already running.
    if (!active || step <= 0) return;
    set({ step: step - 1 });
  },

  end: (how) => {
    writeRecord(how);
    set({ active: false, step: -1, starting: false });
  },
}));
