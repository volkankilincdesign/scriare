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
  /** v0.34.0 — the Choice Styles manager, reachable from two places for the
   *  same reason the Variable Manager is: Project Settings is where you go
   *  looking for it, and the Inspector's per-choice Appearance section is
   *  where you realise you need it. */
  choiceStylesOpen: boolean;
  openChoiceStyles: () => void;
  closeChoiceStyles: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  variableManagerOpen: false,
  openVariableManager: () => set({ variableManagerOpen: true }),
  closeVariableManager: () => set({ variableManagerOpen: false }),
  choiceStylesOpen: false,
  openChoiceStyles: () => set({ choiceStylesOpen: true }),
  closeChoiceStyles: () => set({ choiceStylesOpen: false }),
}));
