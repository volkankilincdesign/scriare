import { create } from "zustand";

export const THEMES = [
  { id: "dark", label: "Dark", description: "Default — minimal black/white/gray" },
  { id: "light", label: "Light", description: "Minimal black/white/gray, light surface" },
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
