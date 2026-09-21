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
  /** v0.36.0 — Check Story. */
  storyCheckOpen: boolean;
  openStoryCheck: () => void;
  closeStoryCheck: () => void;
  /**
   * v0.48.0 — Export. Here rather than as TopBar's own `useState` for the
   * reason this store exists: Check Story's report is where a writer
   * realises they are ready to export, so it needs to be able to open this
   * from a sibling panel.
   */
  exportOpen: boolean;
  openExport: () => void;
  closeExport: () => void;

  /**
   * v0.38.0 — Find. A counter rather than a boolean: Ctrl+F pressed while
   * the box is already focused should still select what's in it, and a
   * flag that is already true is an event that doesn't happen.
   */
  findToken: number;
  requestFind: () => void;

  /**
   * The match a writer clicked, on its way to the editor.
   *
   * Find searches the STORED documents; only one of them is open in
   * ProseMirror at a time. So a click on a result in another scene has to
   * open that scene and then — a beat later, once its content has actually
   * been loaded into the editor — put the caret on the words. This is the
   * note left between those two moments; SceneEditor and EntityEditor pick
   * it up when the document they just loaded is the one it names, and
   * clear it.
   */
  reveal: RevealRequest | null;
  requestReveal: (reveal: RevealRequest) => void;
  clearReveal: () => void;
}

export interface RevealRequest {
  sceneId: string | null;
  entityId: string | null;
  /** ProseMirror positions of the match, as computed by findInStory. */
  from: number;
  to: number;
}

export const useUIStore = create<UIState>((set) => ({
  variableManagerOpen: false,
  openVariableManager: () => set({ variableManagerOpen: true }),
  closeVariableManager: () => set({ variableManagerOpen: false }),
  choiceStylesOpen: false,
  openChoiceStyles: () => set({ choiceStylesOpen: true }),
  closeChoiceStyles: () => set({ choiceStylesOpen: false }),
  storyCheckOpen: false,
  openStoryCheck: () => set({ storyCheckOpen: true }),
  closeStoryCheck: () => set({ storyCheckOpen: false }),
  exportOpen: false,
  openExport: () => set({ exportOpen: true }),
  closeExport: () => set({ exportOpen: false }),
  findToken: 0,
  requestFind: () => set((state) => ({ findToken: state.findToken + 1 })),
  reveal: null,
  requestReveal: (reveal) => set({ reveal }),
  clearReveal: () => set({ reveal: null }),
}));
