import { create } from "zustand";
import type { ColorSubject } from "../export/contrastCheck";

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
/** Where a dialog was opened from, when that decides how it gets back. */
export type DialogOrigin = "settings";

interface UIState {
  variableManagerOpen: boolean;
  openVariableManager: () => void;
  closeVariableManager: () => void;
  /** v0.34.0 — the Choice Styles manager, reachable from two places for the
   *  same reason the Variable Manager is: Project Settings is where you go
   *  looking for it, and the Inspector's per-choice Appearance section is
   *  where you realise you need it. */
  choiceStylesOpen: boolean;
  /**
   * `from` records WHERE the writer came in, so the dialog can offer a way
   * back (v0.55.0). Choice Styles closes Project Settings on its way open —
   * deliberately, because it is a place you go rather than a detail of
   * Settings — and until now that left no route back: the only way to
   * change the Start Scene after looking at a style was to reopen Settings
   * from the top bar.
   */
  openChoiceStyles: (from?: DialogOrigin | null) => void;
  closeChoiceStyles: () => void;
  choiceStylesFrom: DialogOrigin | null;
  /**
   * v0.55.0 — Project Settings. It was TopBar's own `useState`, which is
   * exactly the limitation the header of this file describes: a dialog
   * Settings opened could not get back to it, because nothing outside
   * TopBar could reopen it.
   */
  /**
   * v0.80.0 — the story's stylesheet. A place you go, on the Choice Styles
   * pattern and for the same reason: it is a surface you sit in, not a
   * field on a form. It records where it came from so it can offer the way
   * back, which v0.55.0 established as the price of closing Settings on
   * the way open.
   */
  /**
   * v0.81.0 — "How Scriare works". A place rather than an event: nothing
   * opens it on first launch and nothing dismisses it forever, because the
   * question it answers is asked more often in week three than in minute
   * one.
   */
  helpOpen: boolean;
  openHelp: () => void;
  closeHelp: () => void;
  stylesheetOpen: boolean;
  openStylesheet: (from?: DialogOrigin | null) => void;
  closeStylesheet: () => void;
  stylesheetFrom: DialogOrigin | null;
  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  /**
   * v0.75.0 — Preferences: how the app looks on THIS computer, which is
   * the one setting that was never a project setting. Same arrangement as
   * Choice Styles and for the same reason: it is a place you go, it closes
   * Settings on its way open, and it remembers where it came from so it
   * can offer the way back.
   */
  preferencesOpen: boolean;
  preferencesFrom: DialogOrigin | null;
  openPreferences: (from?: DialogOrigin | null) => void;
  closePreferences: () => void;
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

  /**
   * The colour the writer is choosing, and how it reads on the reader's
   * two grounds (v0.58.1) — or null when nobody is picking one.
   *
   * HERE RATHER THAN IN THE TOOLBAR, for the reason this store exists at
   * all. The panel was rendered by the control that opens the picker, so
   * it appeared directly underneath it — which is exactly where Chromium
   * puts the colour picker itself, and the reading spent the whole pick
   * hidden behind the thing it was about. It now belongs to the editor
   * PANE, which draws it in its own bottom corner, and a component cannot
   * render into its parent's corner without being told from somewhere
   * both of them can reach.
   */
  colorReading: ColorSubject | null;
  showColorReading: (subject: ColorSubject) => void;
  clearColorReading: () => void;
}

export interface RevealRequest {
  sceneId: string | null;
  entityId: string | null;
  /**
   * ProseMirror positions of the match, as computed by findInStory.
   * Ignored when `nodeId` is set.
   */
  from: number;
  to: number;
  /**
   * A node's stable id, for a caller that names the THING rather than the
   * place (v0.77.0).
   *
   * Find computes positions from the stored document, which is right for
   * it: a match is a range of characters with no identity of its own.
   * Check Story's findings are about objects — this choice, this line —
   * and those carry ids (extensions/LineId.ts). An id survives the writer
   * inserting a sentence above it; a position does not.
   *
   * The two also BEHAVE differently, deliberately. Find selects its match,
   * because somebody who clicked words means to replace them. A finding is
   * something to look at before deciding, so this leaves a collapsed caret
   * and marks the node instead — landing with a whole Choice Block
   * selected would mean the next keystroke deletes it.
   */
  nodeId?: string;
}

export const useUIStore = create<UIState>((set) => ({
  variableManagerOpen: false,
  openVariableManager: () => set({ variableManagerOpen: true }),
  closeVariableManager: () => set({ variableManagerOpen: false }),
  choiceStylesOpen: false,
  choiceStylesFrom: null,
  // The origin is set on EVERY open, including the ones that pass none —
  // which is what stops a writer who arrives from the Inspector being
  // offered a way "back" to a Settings dialog they were never in. Clearing
  // it again on close was written first and was dead: its negative control
  // came back green, because the open path had already covered the case.
  openChoiceStyles: (from = null) => set({ choiceStylesOpen: true, choiceStylesFrom: from }),
  closeChoiceStyles: () => set({ choiceStylesOpen: false }),
  preferencesOpen: false,
  preferencesFrom: null,
  openPreferences: (from = null) => set({ preferencesOpen: true, preferencesFrom: from }),
  // The origin is cleared with the dialog, so a later visit from the top
  // bar is not offered a way "back" to a Settings dialog it was never in —
  // the same bug the Choice Styles origin had and the same fix.
  closePreferences: () => set({ preferencesOpen: false, preferencesFrom: null }),

  helpOpen: false,
  openHelp: () => set({ helpOpen: true }),
  closeHelp: () => set({ helpOpen: false }),
  stylesheetOpen: false,
  stylesheetFrom: null,
  openStylesheet: (from = null) => set({ stylesheetOpen: true, stylesheetFrom: from }),
  closeStylesheet: () => set({ stylesheetOpen: false }),
  settingsOpen: false,
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
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
  colorReading: null,
  showColorReading: (subject) => set({ colorReading: subject }),
  clearColorReading: () => set({ colorReading: null }),
}));
