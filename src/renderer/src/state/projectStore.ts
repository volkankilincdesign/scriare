import { create } from "zustand";
import { nanoid } from "nanoid";
import type { JSONContent } from "@tiptap/react";
import type {
  ContentFolder,
  ContentLeaf,
  ContentNode,
  Favorite,
  FolderRect,
  Project,
  Scene,
} from "../types/project";
import { buildProject, buildScene, buildStoryFolder, normalizeProject } from "../types/project";
import { computeGraphLayout } from "../utils/autoLayoutGraph";
import { regenerateChoiceIds } from "../utils/choiceBlocks";
import {
  DEFAULT_CHOICE_STYLE_ID,
  buildChoiceStyle,
  normalizeChoiceStyles,
} from "../types/choiceStyles";
import type { ChoiceBox } from "../types/choiceStyles";
import { childrenOf, isDescendant, nextOrder } from "../utils/contentTree";
import { FOLDER_PADDING } from "../utils/graphConstants";
import {
  contentBounds,
  folderSubtree,
  graphGroups,
  groupAtPoint,
  groupContaining,
  unionRect,
} from "../utils/graphGroups";
import type { ContentClipboard } from "../utils/contentClipboard";
import type { Variable, VariableAction, VariableType, VariableValue } from "../types/variables";
import { applyVariableAction, buildVariable, changeVariableType } from "../types/variables";
import { useInspectorStore } from "./inspectorStore";
import {
  clearHistory,
  historyFlags,
  mergeLiveProse,
  recordSnapshot,
  takeRedo,
  takeUndo,
} from "./history";

type SaveStatus = "saved" | "saving" | "unsaved";

interface RecentProjectEntry {
  name: string;
  filePath: string;
  lastOpened: string;
}

interface ProjectState {
  project: Project | null;
  filePath: string | null;
  selectedSceneId: string | null;
  saveStatus: SaveStatus;
  recentProjects: RecentProjectEntry[];

  isPlaying: boolean;
  playSceneId: string | null;
  /**
   * Live variable values for the CURRENT play session — seeded from
   * `project.variables`' defaultValue on startPlay/restartPlay, then
   * mutated by applyVariableActions as Choice Actions fire. Deliberately
   * separate from `project.variables` (the definitions) for the same
   * reason `playSceneId` is separate from `project.scenes`: playing a
   * story is a read-only pass over the project's data, and this is the one
   * piece of state Play Mode is allowed to actually change — see the
   * comment above `startPlay` below for why that never touches `project`
   * or marks the file unsaved.
   */
  playVariableValues: Record<string, VariableValue>;

  /**
   * Mirrors of the history stacks in state/history.ts, kept here so the UI
   * can enable/disable its controls and name what it's about to reverse.
   * The stacks themselves live in that module rather than in this store on
   * purpose — they hold references to previous `project` objects, and
   * putting those in React state would make every component that
   * subscribes to the whole store re-render on each history push for no
   * visible reason.
   */
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  /**
   * Identity of the step `undo()` would currently reverse. The undo toast
   * captures this when it appears and stops offering its action if it
   * changes — see state/toastStore.ts.
   */
  undoToken: number | null;
  /** Steps back one structural change. Prose is never rolled back — see history.ts. */
  undo: () => void;
  redo: () => void;

  loadRecent: () => Promise<void>;
  newProject: (name: string) => Promise<void>;
  openProject: () => Promise<void>;
  openRecentProject: (filePath: string) => Promise<void>;

  selectScene: (sceneId: string) => void;
  createScene: (parentId?: string | null) => void;
  /** Creates a Story scene WITHOUT selecting it or navigating away from
   * whatever scene is currently open — the Inspector's inline "+ Create New
   * Scene" (Sprint 9C) needs a fresh Destination to link to without
   * interrupting the writer's current editing flow, unlike `createScene`
   * above (the Content Browser's "+ Scene", which is meant to jump you into
   * the new scene). Returns the new scene's id, or null if there's no open
   * project. */
  createUnlinkedScene: (parentId?: string | null) => string | null;
  renameScene: (sceneId: string, title: string) => void;
  deleteScene: (sceneId: string) => void;
  duplicateScene: (sceneId: string) => void;
  duplicateScenes: (sceneIds: string[]) => void;
  updateSceneContent: (sceneId: string, content: JSONContent) => void;

  createFolder: (parentId?: string | null) => void;
  renameFolder: (folderId: string, name: string) => void;
  deleteFolder: (folderId: string) => void;
  moveContentNode: (nodeId: string, newParentId: string | null, newIndex: number) => void;
  moveContentNodes: (nodeIds: string[], newParentId: string | null, newIndex: number) => void;
  /** Bulk delete for multi-selection: scenes are removed, folders are ungrouped (never destroyed). */
  deleteContentNodes: (nodeIds: string[]) => void;
  /**
   * Inserts a clipboard payload under `parentId`, with fresh ids
   * throughout. Returns the ids of the top-level nodes it created (for
   * selecting them), or an empty array if there was nothing to paste.
   */
  pasteContentNodes: (clipboard: ContentClipboard, parentId: string | null) => string[];

  toggleFavorite: (refType: Favorite["refType"], refId: string) => void;
  setFavorites: (refType: Favorite["refType"], refIds: string[], value: boolean) => void;

  updateScenePosition: (sceneId: string, position: { x: number; y: number }) => void;
  autoLayoutScenes: () => void;

  /** Pass a scene id to make it the Start Scene, or null to clear it (Play
   * Mode then falls back to the first Story scene, same as an unset project). */
  setStartScene: (sceneId: string | null) => void;

  /**
   * Creates a Story group placed on the canvas, empty — the graph's
   * "+ Group" button. A group made from the Content Browser starts with no
   * rectangle and appears on the graph as soon as it holds a scene (see
   * utils/graphGroups.ts); this one is drawn from the moment it exists,
   * because placing it IS the gesture.
   */
  addGraphGroup: () => void;
  /**
   * Moves and/or resizes a folder's box, carrying everything inside it, and
   * re-files the folder itself if it was dropped inside (or dragged out of)
   * another group. `reparent` is false during a resize, where the box
   * changes shape without the writer meaning to move it anywhere.
   */
  updateFolderRect: (folderId: string, rect: FolderRect, reparent?: boolean) => void;
  /** Folds a group down to a single block on the graph, or unfolds it. */
  toggleFolderCollapsed: (folderId: string) => void;

  /** Adds a fresh, unnamed Variable (see types/variables.ts's buildVariable) — the
   * Variable Manager's "+ Add Variable" button. */
  addVariable: () => void;
  /** Creates a fully-formed Variable (name + type, defaultValue derived from
   * type) and returns its id — used by the Inspector's inline "+ Create
   * Variable" (Sprint 9C), so a writer can define a new variable without
   * leaving the Action row they were configuring. Distinct from `addVariable`
   * (the Variable Manager's "+ Add Variable", which starts blank and is
   * edited in place there) because this needs the finished variable's id
   * back immediately, synchronously, to wire it into the Action being built. */
  createVariable: (name: string, type: VariableType) => string | null;
  updateVariable: (variableId: string, patch: Partial<Variable>) => void;
  /** Does NOT cascade-delete VariableActions that reference this variable across every
   * scene — see the comment above this action's implementation for why. */
  deleteVariable: (variableId: string) => void;

  /** v0.34.0 — named Choice Styles. Creating one starts from the Default
   *  style's values rather than from nothing, because an empty box renders
   *  as an invisible choice and nobody means that. Returns the new id so
   *  the caller can select it immediately. */
  addChoiceStyle: (name: string) => string | null;
  updateChoiceStyle: (styleId: string, patch: { name?: string; box?: Partial<ChoiceBox> }) => void;
  /** Does NOT rewrite choices that wear this style — `resolveChoiceBox`
   *  falls back to Default for an unknown id, so deleting a style is one
   *  cheap edit rather than a walk through every scene's document. Same
   *  call this codebase already makes for deleted variables and deleted
   *  scene destinations. The Default style itself cannot be deleted. */
  deleteChoiceStyle: (styleId: string) => void;

  startPlay: () => void;
  exitPlay: () => void;
  goToPlayScene: (sceneId: string) => void;
  restartPlay: () => void;
  /** Runs a Choice option's Actions against the live play session — see choiceRuntimeBlock.tsx. */
  applyVariableActions: (actions: VariableAction[]) => void;

  saveNow: () => Promise<void>;
  closeProject: () => void;
}

let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleAutosave(get: () => ProjectState): void {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    void get().saveNow();
  }, 1500);
}

type SetState = (partial: Partial<ProjectState>) => void;

/**
 * Call at the top of any action that changes project STRUCTURE, after that
 * action's early-return guards but before its `set` — while `project` is
 * still the version the user is about to move away from. Deliberately not
 * called by `updateSceneContent`: prose belongs to Tiptap's own history
 * (see state/history.ts for why the two stacks can coexist safely).
 *
 * `mergeKey` folds a run of keystroke-level edits to the same thing into
 * one undo step; omit it for anything that happens once per gesture.
 */
function pushHistory(set: SetState, get: () => ProjectState, label: string, mergeKey?: string): void {
  const { project, selectedSceneId } = get();
  if (!project) return;
  recordSnapshot({ label, project, selectedSceneId, mergeKey });
  set(historyFlags());
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  filePath: null,
  selectedSceneId: null,
  saveStatus: "saved",
  recentProjects: [],

  isPlaying: false,
  playSceneId: null,
  playVariableValues: {},

  canUndo: false,
  canRedo: false,
  undoLabel: null,
  redoLabel: null,
  undoToken: null,

  undo: () => {
    const { project, selectedSceneId, isPlaying } = get();
    // Play Mode is a read-only pass over the project; nothing there can
    // have created a history step, and letting Ctrl+Z reach through it
    // would change the story out from under a playthrough in progress.
    if (!project || isPlaying) return;

    const entry = takeUndo({ label: "", project, selectedSceneId });
    if (!entry) return;

    set({
      project: mergeLiveProse(entry.project, project),
      // A scene that was open before the undone action may no longer
      // exist (undoing a Create), so fall back rather than pointing the
      // editor at nothing.
      selectedSceneId:
        entry.selectedSceneId && entry.project.scenes.some((s) => s.id === entry.selectedSceneId)
          ? entry.selectedSceneId
          : selectedSceneId,
      saveStatus: "unsaved",
      ...historyFlags(),
    });
    // The Inspector's target is a Choice Block inside a specific scene's
    // document; after a structural change it may be pointing at a scene
    // that just stopped existing (same reasoning as selectScene).
    useInspectorStore.getState().clearTarget();
    scheduleAutosave(get);
  },

  redo: () => {
    const { project, selectedSceneId, isPlaying } = get();
    if (!project || isPlaying) return;

    const entry = takeRedo({ label: "", project, selectedSceneId });
    if (!entry) return;

    set({
      project: mergeLiveProse(entry.project, project),
      selectedSceneId:
        entry.selectedSceneId && entry.project.scenes.some((s) => s.id === entry.selectedSceneId)
          ? entry.selectedSceneId
          : selectedSceneId,
      saveStatus: "unsaved",
      ...historyFlags(),
    });
    useInspectorStore.getState().clearTarget();
    scheduleAutosave(get);
  },

  loadRecent: async () => {
    const list = await window.api.recent.list();
    set({ recentProjects: list });
  },

  newProject: async (name: string) => {
    const project = buildProject(name.trim() || "Untitled Story");
    const result = await window.api.project.create(
      JSON.stringify(project, null, 2),
      project.name,
    );
    if (!result) return; // user canceled the save dialog

    // History belongs to one project in one editing session — never carry
    // steps across a project boundary, where "undo" would try to restore
    // scenes that belong to a different file.
    clearHistory();
    set({
      project,
      filePath: result.filePath,
      selectedSceneId: project.startSceneId,
      saveStatus: "saved",
      recentProjects: result.recent,
      ...historyFlags(),
    });
  },

  openProject: async () => {
    const result = await window.api.project.open();
    if (!result) return;

    const project: Project = normalizeProject(JSON.parse(result.raw));
    clearHistory();
    set({
      project,
      filePath: result.filePath,
      selectedSceneId: project.startSceneId ?? project.scenes[0]?.id ?? null,
      saveStatus: "saved",
      recentProjects: result.recent,
      ...historyFlags(),
    });
  },

  openRecentProject: async (filePath: string) => {
    try {
      const result = await window.api.project.openPath(filePath);
      const project: Project = normalizeProject(JSON.parse(result.raw));
      clearHistory();
      set({
        project,
        filePath: result.filePath,
        selectedSceneId: project.startSceneId ?? project.scenes[0]?.id ?? null,
        saveStatus: "saved",
        recentProjects: result.recent,
        ...historyFlags(),
      });
    } catch {
      // The file was probably moved or deleted — drop it from the recent list.
      const list = await window.api.recent.remove(filePath);
      set({ recentProjects: list });
    }
  },

  selectScene: (sceneId) => {
    set({ selectedSceneId: sceneId });
    // Switching scenes always leaves behind whatever Choice Block the
    // Inspector was showing for the PREVIOUS scene — see inspectorStore.ts.
    useInspectorStore.getState().clearTarget();
  },

  createScene: (parentId = null) => {
    const { project } = get();
    if (!project) return;

    pushHistory(set, get, "Create Scene");
    const scene = buildScene(`Scene ${project.scenes.length + 1}`, project.scenes.length);
    const leaf: ContentLeaf = {
      id: scene.id,
      kind: "leaf",
      category: "story",
      parentId,
      order: nextOrder(project.content, "story", parentId),
      refType: "scene",
    };

    set({
      project: {
        ...project,
        scenes: [...project.scenes, scene],
        content: [...project.content, leaf],
        updatedAt: new Date().toISOString(),
      },
      selectedSceneId: scene.id,
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
  },

  createUnlinkedScene: (parentId = null) => {
    const { project } = get();
    if (!project) return null;

    pushHistory(set, get, "Create Scene");
    const scene = buildScene(`Scene ${project.scenes.length + 1}`, project.scenes.length);
    const leaf: ContentLeaf = {
      id: scene.id,
      kind: "leaf",
      category: "story",
      parentId,
      order: nextOrder(project.content, "story", parentId),
      refType: "scene",
    };

    set({
      project: {
        ...project,
        scenes: [...project.scenes, scene],
        content: [...project.content, leaf],
        updatedAt: new Date().toISOString(),
      },
      // Deliberately does NOT set selectedSceneId — see the interface
      // comment above `createUnlinkedScene` for why this must not navigate
      // the writer away from the scene they're currently editing.
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
    return scene.id;
  },

  renameScene: (sceneId, title) => {
    const { project } = get();
    if (!project) return;

    pushHistory(set, get, "Rename Scene", `rename-scene:${sceneId}`);
    set({
      project: {
        ...project,
        scenes: project.scenes.map((s) => (s.id === sceneId ? { ...s, title } : s)),
        updatedAt: new Date().toISOString(),
      },
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
  },

  deleteScene: (sceneId) => {
    const { project, selectedSceneId } = get();
    if (!project) return;
    if (project.scenes.length <= 1) return; // always keep at least one scene

    pushHistory(set, get, "Delete Scene");
    const remaining = project.scenes.filter((s) => s.id !== sceneId);
    const nextStart =
      project.startSceneId === sceneId ? remaining[0]?.id ?? null : project.startSceneId;

    set({
      project: {
        ...project,
        scenes: remaining,
        content: project.content.filter((n) => n.id !== sceneId),
        favorites: project.favorites.filter((f) => !(f.refType === "scene" && f.refId === sceneId)),
        startSceneId: nextStart,
        updatedAt: new Date().toISOString(),
      },
      selectedSceneId: selectedSceneId === sceneId ? remaining[0]?.id ?? null : selectedSceneId,
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
  },

  duplicateScene: (sceneId) => {
    const { project } = get();
    if (!project) return;

    const original = project.scenes.find((s) => s.id === sceneId);
    const originalLeaf = project.content.find(
      (n): n is ContentLeaf => n.id === sceneId && n.kind === "leaf",
    );
    if (!original || !originalLeaf) return;

    pushHistory(set, get, "Duplicate Scene");
    const newId = nanoid();
    const duplicated: Scene = {
      ...original,
      id: newId,
      title: `${original.title} Copy`,
      content: regenerateChoiceIds(original.content),
      position: { x: original.position.x + 40, y: original.position.y + 40 },
    };
    const newLeaf: ContentLeaf = {
      ...originalLeaf,
      id: newId,
      order: nextOrder(project.content, "story", originalLeaf.parentId),
    };

    set({
      project: {
        ...project,
        scenes: [...project.scenes, duplicated],
        content: [...project.content, newLeaf],
        updatedAt: new Date().toISOString(),
      },
      selectedSceneId: newId,
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
  },

  duplicateScenes: (sceneIds) => {
    const { project } = get();
    if (!project) return;

    const newScenes: Scene[] = [];
    const newLeaves: ContentLeaf[] = [];
    let lastNewId: string | null = null;

    // Assign every copy's id up front so the choices in each one can be
    // rewritten to point at the OTHER copies rather than at the originals
    // — duplicating a two-scene branch should give you a branch, not two
    // loose scenes both feeding back into the source material.
    const idMap = new Map<string, string>();
    for (const sceneId of sceneIds) {
      const exists =
        project.scenes.some((s) => s.id === sceneId) &&
        project.content.some((n) => n.id === sceneId && n.kind === "leaf");
      if (exists) idMap.set(sceneId, nanoid());
    }

    for (const sceneId of sceneIds) {
      const original = project.scenes.find((s) => s.id === sceneId);
      const originalLeaf = project.content.find(
        (n): n is ContentLeaf => n.id === sceneId && n.kind === "leaf",
      );
      if (!original || !originalLeaf) continue;

      const newId = idMap.get(sceneId)!;
      newScenes.push({
        ...original,
        id: newId,
        title: `${original.title} Copy`,
        content: regenerateChoiceIds(original.content, idMap),
        position: { x: original.position.x + 40, y: original.position.y + 40 },
      });
      newLeaves.push({
        ...originalLeaf,
        id: newId,
        // Recompute against content-so-far so duplicating several scenes from
        // the same folder in one go doesn't hand out colliding order values.
        order: nextOrder([...project.content, ...newLeaves], "story", originalLeaf.parentId),
      });
      lastNewId = newId;
    }

    if (newScenes.length === 0) return;

    pushHistory(set, get, "Duplicate Scenes");
    set({
      project: {
        ...project,
        scenes: [...project.scenes, ...newScenes],
        content: [...project.content, ...newLeaves],
        updatedAt: new Date().toISOString(),
      },
      selectedSceneId: lastNewId ?? get().selectedSceneId,
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
  },

  updateSceneContent: (sceneId, content) => {
    const { project } = get();
    if (!project) return;

    set({
      project: {
        ...project,
        scenes: project.scenes.map((s) => (s.id === sceneId ? { ...s, content } : s)),
        updatedAt: new Date().toISOString(),
      },
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
  },

  // Sprint 9B removed the old store-level `updateChoiceOption` — Choice
  // Block edits (from the editor's own NodeView, or from the Inspector's
  // Choices accordion) now go through a single path instead: a real
  // ProseMirror transaction dispatched on the live editor instance (see
  // utils/choiceBlockEditing.ts + state/editorStore.ts). That transaction's
  // own `onUpdate` calls `updateSceneContent` above, so there's exactly one
  // writer of scene content no matter which surface made the edit — see
  // editorStore.ts's comment for why a second, store-only write path caused
  // real desync bugs between the mounted editor and the saved project.

  createFolder: (parentId = null) => {
    const { project } = get();
    if (!project) return;

    pushHistory(set, get, "Create Group");
    const folder: ContentFolder = {
      id: nanoid(),
      kind: "folder",
      category: "story",
      parentId,
      order: nextOrder(project.content, "story", parentId),
      name: "New Group",
    };

    set({
      project: {
        ...project,
        content: [...project.content, folder],
        updatedAt: new Date().toISOString(),
      },
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
  },

  renameFolder: (folderId, name) => {
    const { project } = get();
    if (!project) return;

    pushHistory(set, get, "Rename Group", `rename-folder:${folderId}`);
    set({
      project: {
        ...project,
        content: project.content.map((n) => (n.id === folderId && n.kind === "folder" ? { ...n, name } : n)),
        updatedAt: new Date().toISOString(),
      },
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
  },

  deleteFolder: (folderId) => {
    const { project } = get();
    if (!project) return;

    const folder = project.content.find((n) => n.id === folderId);
    if (!folder) return;

    pushHistory(set, get, "Delete Group");
    // Ungroup, don't destroy: a folder's children move up to its parent —
    // same non-destructive philosophy as deleting a graph Frame. Nothing
    // inside a folder is ever deleted just because the folder was.
    set({
      project: {
        ...project,
        content: project.content
          .filter((n) => n.id !== folderId)
          .map((n) => (n.parentId === folderId ? { ...n, parentId: folder.parentId } : n)),
        updatedAt: new Date().toISOString(),
      },
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
  },

  moveContentNode: (nodeId, newParentId, newIndex) => {
    get().moveContentNodes([nodeId], newParentId, newIndex);
  },

  moveContentNodes: (nodeIds, newParentId, newIndex) => {
    const { project } = get();
    if (!project) return;

    const movingSet = new Set(nodeIds);
    const nodesToMove = project.content
      .filter((n) => movingSet.has(n.id))
      .sort((a, b) => a.order - b.order); // preserve the selection's relative order at the destination
    if (nodesToMove.length === 0) return;
    if (newParentId && movingSet.has(newParentId)) return; // can't drop something into itself

    const category = nodesToMove[0].category;
    const wouldCycle = nodesToMove.some(
      (n) => n.kind === "folder" && newParentId && isDescendant(project.content, newParentId, n.id),
    );
    if (wouldCycle) return; // would nest a folder inside its own descendant — refuse the whole move

    pushHistory(set, get, nodeIds.length > 1 ? "Move Items" : "Move Item");
    const updates = new Map<string, { parentId: string | null; order: number }>();

    const destSiblings = childrenOf(project.content, category, newParentId).filter((n) => !movingSet.has(n.id));
    const clampedIndex = Math.max(0, Math.min(newIndex, destSiblings.length));
    destSiblings.splice(clampedIndex, 0, ...nodesToMove);
    destSiblings.forEach((n, i) => updates.set(n.id, { parentId: newParentId, order: i }));

    const oldParentIds = new Set(nodesToMove.map((n) => n.parentId));
    for (const oldParentId of oldParentIds) {
      if (oldParentId === newParentId) continue; // already reindexed above
      const remaining = childrenOf(project.content, category, oldParentId).filter((n) => !movingSet.has(n.id));
      remaining.forEach((n, i) => updates.set(n.id, { parentId: oldParentId, order: i }));
    }

    set({
      project: {
        ...project,
        content: project.content.map((n) => {
          const update = updates.get(n.id);
          return update ? { ...n, parentId: update.parentId, order: update.order } : n;
        }),
        updatedAt: new Date().toISOString(),
      },
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
  },

  deleteContentNodes: (nodeIds) => {
    const { project, selectedSceneId } = get();
    if (!project) return;

    pushHistory(set, get, nodeIds.length > 1 ? "Delete Items" : "Delete Item");
    const idsToDelete = new Set(nodeIds);
    const folderIdsToDelete = new Set(
      project.content.filter((n) => idsToDelete.has(n.id) && n.kind === "folder").map((n) => n.id),
    );
    let sceneIdsToDelete = project.content
      .filter((n) => idsToDelete.has(n.id) && n.kind === "leaf")
      .map((n) => n.id);

    // Always keep at least one scene in the project, same rule as the
    // single-scene delete — trim the bulk deletion rather than refusing it.
    if (sceneIdsToDelete.length >= project.scenes.length) {
      sceneIdsToDelete = sceneIdsToDelete.slice(0, -1);
    }
    const sceneIdsToDeleteSet = new Set(sceneIdsToDelete);

    // A node whose parent was itself deleted (a folder inside a deleted
    // folder, or several nested levels deep) ungroups up to the nearest
    // surviving ancestor — same non-destructive rule as a single folder delete.
    function resolveSurvivingParent(parentId: string | null): string | null {
      let current = parentId;
      while (current && folderIdsToDelete.has(current)) {
        current = project!.content.find((n) => n.id === current)?.parentId ?? null;
      }
      return current;
    }

    const content: ContentNode[] = project.content
      .filter((n) => !folderIdsToDelete.has(n.id) && !sceneIdsToDeleteSet.has(n.id))
      .map((n) => ({ ...n, parentId: resolveSurvivingParent(n.parentId) }));

    const remainingScenes = project.scenes.filter((s) => !sceneIdsToDeleteSet.has(s.id));
    const nextStart =
      project.startSceneId && sceneIdsToDeleteSet.has(project.startSceneId)
        ? remainingScenes[0]?.id ?? null
        : project.startSceneId;
    const nextSelected =
      selectedSceneId && sceneIdsToDeleteSet.has(selectedSceneId)
        ? remainingScenes[0]?.id ?? null
        : selectedSceneId;

    set({
      project: {
        ...project,
        scenes: remainingScenes,
        content,
        favorites: project.favorites.filter(
          (f) => !(f.refType === "scene" && sceneIdsToDeleteSet.has(f.refId)),
        ),
        startSceneId: nextStart,
        updatedAt: new Date().toISOString(),
      },
      selectedSceneId: nextSelected,
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
  },

  pasteContentNodes: (clipboard, parentId) => {
    const { project } = get();
    if (!project || clipboard.nodes.length === 0) return [];

    // Pasting a folder into its own copied descendant is impossible here
    // (the payload is a snapshot with fresh ids), but pasting into a
    // folder that no longer exists is not — a writer can copy, delete the
    // destination folder, then paste. Fall back to the root rather than
    // creating orphans with a dangling parentId.
    const destination =
      parentId && project.content.some((n) => n.id === parentId && n.kind === "folder")
        ? parentId
        : null;

    pushHistory(set, get, "Paste");

    const idMap = new Map<string, string>();
    for (const node of clipboard.nodes) idMap.set(node.id, nanoid());

    const copiedIds = new Set(clipboard.nodes.map((n) => n.id));
    const rootIds: string[] = [];

    // Roots append to the end of the destination; everything else keeps
    // the relative order it had inside its own copied folder.
    let nextRootOrder = nextOrder(project.content, "story", destination);

    const newNodes: ContentNode[] = clipboard.nodes.map((node) => {
      const isRoot = node.parentId === null || !copiedIds.has(node.parentId);
      const newId = idMap.get(node.id)!;
      if (isRoot) rootIds.push(newId);
      return {
        ...node,
        id: newId,
        parentId: isRoot ? destination : idMap.get(node.parentId!)!,
        order: isRoot ? nextRootOrder++ : node.order,
      };
    });

    // Pasting next to the thing you copied gives two rows with the same
    // name, which is a worse list than it was before. So a pasted ROOT
    // whose name already exists among its new siblings gets a suffix, the
    // way every file manager does it. Nodes *inside* a pasted folder are
    // left alone: their folder already tells them apart, and renaming them
    // would quietly rewrite scene titles the writer chose.
    const rootIdSet = new Set(rootIds);
    const siblingNames = new Set(
      project.content
        .filter((n) => n.parentId === destination && n.category === "story")
        .map((n) => (n.kind === "folder" ? n.name : project.scenes.find((s) => s.id === n.id)?.title))
        .filter((name): name is string => Boolean(name)),
    );

    function uniqueName(original: string): string {
      if (!siblingNames.has(original)) {
        siblingNames.add(original);
        return original;
      }
      let candidate = `${original} Copy`;
      let n = 2;
      while (siblingNames.has(candidate)) candidate = `${original} Copy ${n++}`;
      siblingNames.add(candidate);
      return candidate;
    }

    for (const node of newNodes) {
      if (node.kind === "folder" && rootIdSet.has(node.id)) node.name = uniqueName(node.name);
    }

    // Scene ids are remapped through the same map, so choices pointing
    // inside the copied set follow the copies — see regenerateChoiceIds.
    const newScenes: Scene[] = clipboard.scenes.map((scene) => ({
      ...scene,
      id: idMap.get(scene.id)!,
      title: rootIdSet.has(idMap.get(scene.id)!) ? uniqueName(scene.title) : scene.title,
      content: regenerateChoiceIds(scene.content, idMap),
      position: { x: scene.position.x + 40, y: scene.position.y + 40 },
      // Frames aren't part of the payload, so inheriting a frameId would
      // point at a group the pasted scene isn't visually inside — or, after
      // a paste into a different project, at nothing at all.
      frameId: null,
    }));

    set({
      project: {
        ...project,
        scenes: [...project.scenes, ...newScenes],
        content: [...project.content, ...newNodes],
        updatedAt: new Date().toISOString(),
      },
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
    return rootIds;
  },

  toggleFavorite: (refType, refId) => {
    const { project } = get();
    if (!project) return;

    pushHistory(set, get, "Favorite");
    const existing = project.favorites.find((f) => f.refType === refType && f.refId === refId);
    const favorites: Favorite[] = existing
      ? project.favorites.filter((f) => f !== existing)
      : [...project.favorites, { id: nanoid(), refType, refId }];

    set({
      project: { ...project, favorites, updatedAt: new Date().toISOString() },
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
  },

  setFavorites: (refType, refIds, value) => {
    const { project } = get();
    if (!project) return;

    pushHistory(set, get, "Favorite");
    const idsSet = new Set(refIds);
    let favorites = project.favorites.filter((f) => !(f.refType === refType && idsSet.has(f.refId)));
    if (value) {
      favorites = [...favorites, ...refIds.map((refId) => ({ id: nanoid(), refType, refId }))];
    }

    set({
      project: { ...project, favorites, updatedAt: new Date().toISOString() },
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
  },

  updateScenePosition: (sceneId, position) => {
    const { project } = get();
    if (!project) return;

    pushHistory(set, get, "Move Scene");

    // Figma-style auto-grouping, except the group is now a real folder: a
    // scene dropped inside a group's box moves INTO that folder, and one
    // dropped on open canvas moves out to the Story root. Since v0.28.0
    // that's one fact rather than two — the Content Browser reorganises
    // itself as you rearrange the graph, instead of the two panels drifting
    // apart. Uses the same containment check the live drag-hover highlight
    // uses, so what lights up while dragging is always what you get.
    const groups = graphGroups(project.content, project.scenes);
    const target = groupAtPoint(groups, position);
    const leaf = project.content.find((n) => n.id === sceneId);
    const nextParentId = target?.id ?? null;
    const reparenting = Boolean(leaf) && leaf!.parentId !== nextParentId;

    const content = reparenting
      ? project.content.map((n) =>
          n.id === sceneId
            ? { ...n, parentId: nextParentId, order: nextOrder(project.content, "story", nextParentId) }
            : n,
        )
      : project.content;

    set({
      project: {
        ...project,
        scenes: project.scenes.map((s) => (s.id === sceneId ? { ...s, position } : s)),
        content,
        updatedAt: new Date().toISOString(),
      },
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
  },

  autoLayoutScenes: () => {
    const { project } = get();
    if (!project) return;

    // As of v0.29.0 this arranges EVERYTHING, including the inside of every
    // group, and resizes each group to fit what it now holds. The old rule
    // ("never rearrange what's inside a box") came from the Frame era, when
    // a box was something drawn and filled by hand; a group is a chapter
    // now, and the inside of a chapter is precisely what gets messy after a
    // run of imprecise drags — which is what someone reaches for this
    // button to fix. The safety net is that it's a single undo step, not
    // that the button refuses to do its job.
    const result = computeGraphLayout(project);
    if (!result) return;

    pushHistory(set, get, "Auto Layout");

    set({
      project: {
        ...project,
        scenes: result.scenes,
        content: result.content,
        updatedAt: new Date().toISOString(),
      },
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
  },


  setStartScene: (sceneId) => {
    const { project } = get();
    if (!project) return;
    // A project only ever has one Start Scene — writing straight into
    // startSceneId (rather than e.g. tracking a separate "isStart" flag per
    // scene) is what guarantees that: assigning a new one automatically
    // stops the previous one from being the Start Scene, with no separate
    // bookkeeping, and every surface that shows the Start Scene (Project
    // Settings, the Content Browser badge, the Inspector toggle, the graph
    // node badge) reads this same field, so they can never disagree.
    if (sceneId !== null && !project.scenes.some((s) => s.id === sceneId)) return;

    pushHistory(set, get, "Set Start Scene");
    set({
      project: { ...project, startSceneId: sceneId, updatedAt: new Date().toISOString() },
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
  },

  addGraphGroup: () => {
    const { project } = get();
    if (!project) return;

    pushHistory(set, get, "Add Group");

    // Offset each new group so a second one doesn't land exactly on top of
    // the first — the same trick `buildScene` uses for new scenes.
    const existing = project.content.filter(
      (n) => n.kind === "folder" && n.category === "story" && n.rect,
    ).length;
    const folder = buildStoryFolder(
      "New Group",
      null,
      nextOrder(project.content, "story", null),
      { x: 60 + existing * 40, y: 320 + existing * 40, width: 480, height: 320 },
    );

    set({
      project: {
        ...project,
        content: [...project.content, folder],
        updatedAt: new Date().toISOString(),
      },
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
  },

  updateFolderRect: (folderId, rect, reparent = true) => {
    const { project } = get();
    if (!project) return;

    const folder = project.content.find(
      (n): n is ContentFolder => n.id === folderId && n.kind === "folder",
    );
    if (!folder) return;

    // A group drawn only because it holds scenes has no stored rectangle —
    // its box is derived from those scenes (see graphGroups). Touching it is
    // what makes it real: we take the box the writer was actually looking
    // at as the starting point, so the first drag moves it from exactly
    // where it appeared rather than snapping from some default.
    const currentRect =
      folder.rect ??
      graphGroups(project.content, project.scenes).find((g) => g.id === folderId)?.rect;
    if (!currentRect) return;

    pushHistory(set, get, reparent ? "Move Group" : "Resize Group");

    const dx = rect.x - currentRect.x;
    const dy = rect.y - currentRect.y;
    const moved = dx !== 0 || dy !== 0;

    // Everything inside travels with the box. A group is the thing that
    // contains its scenes, so dragging one and leaving its contents behind
    // would be a lie about what the box means — the same rule frames had,
    // now applied recursively, since folders nest and frames never could.
    const subtree = folderSubtree(project.content, folderId);
    subtree.delete(folderId);

    let content = project.content.map((n) => {
      if (n.id === folderId && n.kind === "folder") return { ...n, rect };
      if (moved && subtree.has(n.id) && n.kind === "folder" && n.rect) {
        return { ...n, rect: { ...n.rect, x: n.rect.x + dx, y: n.rect.y + dy } };
      }
      return n;
    });

    const scenes = moved
      ? project.scenes.map((s) =>
          subtree.has(s.id) ? { ...s, position: { x: s.position.x + dx, y: s.position.y + dy } } : s,
        )
      : project.scenes;

    // Where a box sits decides which box owns it, exactly as it does for a
    // scene — drag a sub-chapter out of its chapter and it really leaves.
    // Full containment rather than a centre point, because a chapter's
    // centre can easily land inside a small sub-chapter it visually
    // swallows; see groupContaining.
    if (reparent) {
      const groups = graphGroups(content, project.scenes);
      const excluded = folderSubtree(content, folderId);
      const host = groupContaining(groups, rect, excluded);
      const nextParentId = host?.id ?? null;
      if (folder.parentId !== nextParentId) {
        content = content.map((n) =>
          n.id === folderId
            ? { ...n, parentId: nextParentId, order: nextOrder(content, "story", nextParentId) }
            : n,
        );
      }
    }

    // A child resized past its parent's edge grows the parent rather than
    // spilling out of it — the picture and the tree must never disagree
    // about what is inside what, and clamping the child instead would mean
    // silently refusing a resize the writer clearly asked for.
    const grown = { ...project, scenes, content };
    let ancestorId = content.find((n) => n.id === folderId)?.parentId ?? null;
    let guard = 0;
    while (ancestorId && guard++ < 32) {
      const ancestor = grown.content.find(
        (n): n is ContentFolder => n.id === ancestorId && n.kind === "folder",
      );
      if (!ancestor?.rect) break;
      const needed = contentBounds(grown, ancestor.id, FOLDER_PADDING);
      if (needed) {
        const merged = unionRect(ancestor.rect, needed);
        if (
          merged.x !== ancestor.rect.x ||
          merged.y !== ancestor.rect.y ||
          merged.width !== ancestor.rect.width ||
          merged.height !== ancestor.rect.height
        ) {
          grown.content = grown.content.map((n) =>
            n.id === ancestor.id && n.kind === "folder" ? { ...n, rect: merged } : n,
          );
        }
      }
      ancestorId = ancestor.parentId;
    }

    set({
      project: { ...project, scenes: grown.scenes, content: grown.content, updatedAt: new Date().toISOString() },
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
  },

  toggleFolderCollapsed: (folderId) => {
    const { project } = get();
    if (!project) return;
    const folder = project.content.find(
      (n): n is ContentFolder => n.id === folderId && n.kind === "folder",
    );
    // Drawn at all — stored rectangle or derived from its scenes. A group
    // that isn't on the canvas has nothing to fold.
    const drawn =
      Boolean(folder?.rect) ||
      graphGroups(project.content, project.scenes).some((g) => g.id === folderId);
    if (!folder || !drawn) return;

    pushHistory(set, get, folder.collapsed ? "Unfold Group" : "Fold Group");

    set({
      project: {
        ...project,
        content: project.content.map((n) =>
          n.id === folderId && n.kind === "folder" ? { ...n, collapsed: !n.collapsed } : n,
        ),
        updatedAt: new Date().toISOString(),
      },
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
  },


  addVariable: () => {
    const { project } = get();
    if (!project) return;

    pushHistory(set, get, "Add Variable");    set({
      project: {
        ...project,
        variables: [...project.variables, buildVariable()],
        updatedAt: new Date().toISOString(),
      },
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
  },

  createVariable: (name, type) => {
    const { project } = get();
    if (!project) return null;

    pushHistory(set, get, "Create Variable");    const variable = changeVariableType({ ...buildVariable(), name }, type);
    set({
      project: {
        ...project,
        variables: [...project.variables, variable],
        updatedAt: new Date().toISOString(),
      },
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
    return variable.id;
  },

  updateVariable: (variableId, patch) => {
    const { project } = get();
    if (!project) return;

    pushHistory(set, get, "Edit Variable", `variable:${variableId}`);    set({
      project: {
        ...project,
        variables: project.variables.map((v) =>
          v.id === variableId ? ({ ...v, ...patch } as Variable) : v,
        ),
        updatedAt: new Date().toISOString(),
      },
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
  },

  // Deliberately does NOT walk every scene stripping out VariableActions
  // that reference this variable — the same call this codebase already
  // made for Choice destinations (deleteScene never rewrites other scenes'
  // choiceBlock nodes when the scene they pointed at is deleted; the
  // Inspector/graph just render a dangling targetSceneId as "Not linked
  // yet"). Doing that for variables would mean a full content rewrite of
  // every scene in the project on every delete — exactly the kind of
  // "recompute everything" cost the architecture doc's own performance
  // notes warn against for what should be a cheap, instant edit. A
  // VariableAction whose variableId no longer resolves is instead handled
  // defensively wherever it's read: the Inspector's Choice Properties flags
  // it, and applyVariableActions below just skips it at runtime.
  deleteVariable: (variableId) => {
    const { project } = get();
    if (!project) return;

    pushHistory(set, get, "Delete Variable");    set({
      project: {
        ...project,
        variables: project.variables.filter((v) => v.id !== variableId),
        updatedAt: new Date().toISOString(),
      },
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
  },

  addChoiceStyle: (name) => {
    const { project } = get();
    if (!project) return null;

    // Normalized rather than indexed into directly: every path that loads a
    // project runs normalizeProject, but a project handed to the store by
    // some other route (a test, a future importer) might not carry the
    // array at all, and "add a style" is not a thing that should be able to
    // throw.
    const styles = normalizeChoiceStyles(project.choiceStyles);
    const style = buildChoiceStyle(name || "New style", styles[0].box);
    pushHistory(set, get, "Add Choice Style");
    set({
      project: {
        ...project,
        choiceStyles: [...styles, style],
        updatedAt: new Date().toISOString(),
      },
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
    return style.id;
  },

  updateChoiceStyle: (styleId, patch) => {
    const { project } = get();
    if (!project) return;

    // Merged by key rather than replaced, so editing one value of a style
    // can't silently clear the others.
    pushHistory(set, get, "Edit Choice Style", `choiceStyle:${styleId}`);
    set({
      project: {
        ...project,
        choiceStyles: normalizeChoiceStyles(project.choiceStyles).map((s) =>
          s.id === styleId ? { ...s, ...patch, box: { ...s.box, ...(patch.box ?? {}) } } : s,
        ),
        updatedAt: new Date().toISOString(),
      },
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
  },

  deleteChoiceStyle: (styleId) => {
    const { project } = get();
    if (!project || styleId === DEFAULT_CHOICE_STYLE_ID) return;

    pushHistory(set, get, "Delete Choice Style");
    set({
      project: {
        ...project,
        choiceStyles: normalizeChoiceStyles(project.choiceStyles).filter((s) => s.id !== styleId),
        updatedAt: new Date().toISOString(),
      },
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
  },

  // Play Mode is purely a read-only presentation over the existing project
  // data — none of these actions touch `project` or trigger autosave.
  // `playVariableValues` is the one exception a story actually needs to be
  // able to change while it runs; it's seeded fresh from each variable's
  // defaultValue here and in restartPlay, and only ever mutated by
  // applyVariableActions below — never by anything that also touches
  // `project`, so playing a story can never itself mark the file unsaved.
  startPlay: () => {
    const { project } = get();
    if (!project) return;
    const playVariableValues: Record<string, VariableValue> = {};
    for (const variable of project.variables) playVariableValues[variable.id] = variable.defaultValue;
    set({
      isPlaying: true,
      playSceneId: project.startSceneId ?? project.scenes[0]?.id ?? null,
      playVariableValues,
    });
  },

  exitPlay: () => set({ isPlaying: false }),

  goToPlayScene: (sceneId) => set({ playSceneId: sceneId }),

  restartPlay: () => {
    const { project } = get();
    if (!project) return;
    const playVariableValues: Record<string, VariableValue> = {};
    for (const variable of project.variables) playVariableValues[variable.id] = variable.defaultValue;
    set({ playSceneId: project.startSceneId ?? project.scenes[0]?.id ?? null, playVariableValues });
  },

  // Called by the Choice runtime block (runtime/blocks/choiceRuntimeBlock.tsx)
  // right before it navigates to the picked option's destination. Resolves
  // each action's variable fresh out of `project.variables` every call
  // rather than trusting a stale reference, so a variable deleted mid-story
  // (impossible today since editing is disabled in Play Mode, but this is
  // the seam Sprint 9B's Conditions will read the same way) is silently
  // skipped instead of throwing.
  applyVariableActions: (actions) => {
    const { project, playVariableValues } = get();
    if (!project || actions.length === 0) return;

    const next = { ...playVariableValues };
    for (const action of actions) {
      const variable = project.variables.find((v) => v.id === action.variableId);
      if (!variable) continue;
      const current = next[variable.id] ?? variable.defaultValue;
      next[variable.id] = applyVariableAction(current, variable, action);
    }
    set({ playVariableValues: next });
  },

  saveNow: async () => {
    const { project, filePath } = get();
    if (!project || !filePath) return;

    set({ saveStatus: "saving" });
    await window.api.project.save(filePath, JSON.stringify(project, null, 2));
    set({ saveStatus: "saved" });
  },

  closeProject: () => {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    clearHistory();
    set({
      project: null,
      filePath: null,
      selectedSceneId: null,
      saveStatus: "saved",
      isPlaying: false,
      playSceneId: null,
      ...historyFlags(),
    });
  },
}));
