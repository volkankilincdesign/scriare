import { create } from "zustand";

export const THEMES = [
  { id: "crimson", label: "Crimson Noir", description: "Default — cool near-black with a red accent" },
  { id: "indigo", label: "Indigo Dusk", description: "Cool blue-violet accent" },
  { id: "emerald", label: "Emerald Slate", description: "Muted forest green accent" },
  { id: "ivory", label: "Ivory Gold", description: "Light, warm neutrals" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

const STORAGE_KEY = "scriare.theme";
const DEFAULT_THEME: ThemeId = "crimson";

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
