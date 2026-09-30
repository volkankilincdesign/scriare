import { create } from "zustand";
import { DEFAULT_GROUND } from "../export/readingThemes";
import type { ReadingGround } from "../export/readingThemes";

/**
 * Which reading ground Play Mode is on (v0.57.0).
 *
 * WHY THIS IS NOT THE THEME STORE. A theme is chrome — the room the
 * writer works in, eight of them, tuned for panels and borders. A reading
 * ground is content — the page a stranger reads, two of them, tuned for
 * prose and nothing else. export/readingThemes.ts argues that distinction
 * at length and the export has enforced it since v0.48.0; Play Mode did
 * not, and wore whichever theme the writer happened to be in. So a writer
 * in Phosphor rehearsed their story in terminal green and then exported
 * something they had never seen.
 *
 * Kept in its own store rather than as a flag on `projectStore` because it
 * is not part of the story: two writers opening the same .scriare file
 * should each get the ground they last read on, the same way they each get
 * their own theme. It is a preference about how this machine shows a page,
 * which is exactly what localStorage is for.
 *
 * REMEMBERED, LIKE THE READER'S. The exported page remembers which ground
 * its reader last switched to (see export/pageRuntime.ts). This is the
 * same promise on this side of the line: press Play tomorrow and you are
 * on the ground you were reading yesterday, not back on the default.
 */

const STORAGE_KEY = "scriare.playGround";
const CSS_KEY = "scriare.playCustomCss";

function isGround(value: string | null): value is ReadingGround {
  return value === "night" || value === "paper";
}

function readStoredGround(): ReadingGround {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isGround(stored) ? stored : DEFAULT_GROUND;
  } catch {
    // Storage throws outright in a few embeddings. A ground that cannot be
    // remembered is a smaller failure than a Play Mode that will not open,
    // which is the same call export/pageRuntime.ts makes for the reader.
    return DEFAULT_GROUND;
  }
}

/**
 * Whether Play Mode is wearing the story's own stylesheet (v0.80.0).
 *
 * DEFAULTS TO ON, because Play Mode is the preview — a writer who has
 * written CSS wants to see it, and one who has not is unaffected by a
 * switch that has nothing to apply. Only an explicit "off" is remembered,
 * so a storage read that fails or returns nothing means on.
 *
 * IT EXISTS AT ALL because of a question a writer asks the moment
 * something looks wrong: is that my stylesheet, or is that my story? The
 * only honest answer is a way to take the stylesheet off and look again,
 * and having to delete their CSS to ask is not that.
 */
function readStoredCustomCss(): boolean {
  try {
    return window.localStorage.getItem(CSS_KEY) !== "off";
  } catch {
    return true;
  }
}

interface PlayGroundState {
  ground: ReadingGround;
  setGround: (ground: ReadingGround) => void;
  /** The bar's control is a toggle, because there are two grounds and the
   *  export's own bar has settled on that shape already. */
  toggleGround: () => void;
  /** Is Play Mode wearing the story's own stylesheet? (v0.80.0) */
  customCss: boolean;
  toggleCustomCss: () => void;
}

export const usePlayGroundStore = create<PlayGroundState>((set, get) => ({
  ground: readStoredGround(),
  setGround: (ground) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, ground);
    } catch {
      // Best-effort, as above — the switch still works for this session.
    }
    set({ ground });
  },
  toggleGround: () => get().setGround(get().ground === "night" ? "paper" : "night"),
  customCss: readStoredCustomCss(),
  toggleCustomCss: () => {
    const next = !get().customCss;
    try {
      window.localStorage.setItem(CSS_KEY, next ? "on" : "off");
    } catch {
      // Best-effort, as above.
    }
    set({ customCss: next });
  },
}));
