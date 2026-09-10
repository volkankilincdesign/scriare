import { create } from "zustand";

/**
 * Small cross-cutting UI flags that more than one component needs to
 * trigger — today just "is the Variable Manager open". Kept separate from
 * both `projectStore` (project data) and `inspectorStore` (what the
 * Inspector is showing) because it's neither: TopBar's toolbar button and
 * the Inspector's Choice Properties empty-state ("no variables yet") both
 * need to be able to open the same dialog, and a plain component-local
 * `useState` (the pattern `ProjectSettingsDialog` uses from TopBar) can't
 * be reached from a sibling panel.
 */
interface UIState {
  variableManagerOpen: boolean;
  openVariableManager: () => void;
  closeVariableManager: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  variableManagerOpen: false,
  openVariableManager: () => set({ variableManagerOpen: true }),
  closeVariableManager: () => set({ variableManagerOpen: false }),
}));
