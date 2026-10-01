import { create } from "zustand";

/**
 * Every theme the app ships, in the order the picker shows them (v0.44.0).
 *
 * The two monochromes first, because they are the ones that hold to the
 * app's own rule — colour belongs to what the writer assigns meaning to —
 * and one of them is where everybody starts. The six after them tint the
 * room rather than the content: the ground carries the hue, and the accent,
 * which only ever marks selection, focus and the primary action, is the one
 * piece of chrome allowed to carry a colour of its own.
 *
 * A theme is entirely a block of tokens in styles/themes.css. Nothing here
 * knows a colour, and the swatches in Settings read each theme's own
 * variables live, so this list can never drift out of step with the CSS.
 */
export const THEMES = [
  { id: "dark", label: "Dark", description: "Monochrome, warm neutral", ground: "dark" },
  { id: "light", label: "Light", description: "Monochrome, daylight", ground: "light" },
  { id: "daylight", label: "Daylight", description: "Paper and sepia ink", ground: "light" },
  {
    id: "overcast",
    label: "Overcast",
    description: "Mid slate; the page is the bright thing",
    ground: "light",
  },
  { id: "lamplight", label: "Lamplight", description: "Dark and warm, amber", ground: "dark" },
  { id: "deep-water", label: "Deep Water", description: "Dark and cold, cyan", ground: "dark" },
  { id: "nocturne", label: "Nocturne", description: "Violet and rose", ground: "dark" },
  { id: "phosphor", label: "Phosphor", description: "Terminal green", ground: "dark" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

/**
 * Is this theme's ground light or dark? (v0.53.0)
 *
 * Needed by anything that swaps a fixed IMAGE rather than a token — the
 * logo is the only one today. Recorded on the theme rather than guessed,
 * because `overcast` is the case a guess gets wrong: a mid slate, lighter
 * than every dark theme and darker than every light one, whose `--text` is
 * near-black. Before this, `BrandMark` asked `theme === "light"`, so
 * daylight and overcast — two light grounds — were handed the logo drawn
 * for dark ones, and the mark came out pale on pale.
 */
export function isLightGround(theme: ThemeId): boolean {
  return THEMES.find((t) => t.id === theme)?.ground === "light";
}

const STORAGE_KEY = "scriare.theme";
/**
 * What a stranger lands on (v0.88.0).
 *
 * DAYLIGHT, his call — the first time this has been decided on purpose
 * rather than inherited. It was "dark" because dark was the only theme the
 * app had when the line was written, and it stayed through seven more.
 *
 * The argument is the one the whole app rests on: the first thing a
 * stranger should see is prose on a page, and of the three light themes
 * photographed against the real story the warm one carries prose best. A
 * writer who prefers a dark room is one click away in Settings and that
 * choice is remembered; a stranger who never opens Settings gets the
 * reading ground rather than the tool's.
 */
export const DEFAULT_THEME: ThemeId = "daylight";

function isThemeId(value: string | null): value is ThemeId {
  return !!value && THEMES.some((t) => t.id === value);
}

function readStoredTheme(): ThemeId {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isThemeId(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function applyThemeToDocument(theme: ThemeId): void {
  document.documentElement.setAttribute("data-theme", theme);
}

interface ThemeState {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

// Apply the persisted theme immediately (module load, before first paint)
// so there's no flash of the default theme before React mounts.
const initialTheme = readStoredTheme();
applyThemeToDocument(initialTheme);

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initialTheme,
  setTheme: (theme) => {
    applyThemeToDocument(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Best-effort persistence — theming still works for the rest of the
      // session even if localStorage is unavailable.
    }
    set({ theme });
  },
}));
