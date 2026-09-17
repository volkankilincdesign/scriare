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
  { id: "dark", label: "Dark", description: "Monochrome, warm neutral" },
  { id: "light", label: "Light", description: "Monochrome, daylight" },
  { id: "daylight", label: "Daylight", description: "Paper and sepia ink" },
  { id: "overcast", label: "Overcast", description: "Mid slate; the page is the bright thing" },
  { id: "lamplight", label: "Lamplight", description: "Dark and warm, amber" },
  { id: "deep-water", label: "Deep Water", description: "Dark and cold, cyan" },
  { id: "nocturne", label: "Nocturne", description: "Violet and rose" },
  { id: "phosphor", label: "Phosphor", description: "Terminal green" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

const STORAGE_KEY = "scriare.theme";
const DEFAULT_THEME: ThemeId = "dark";

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
