import { create } from "zustand";
import { nanoid } from "nanoid";
import type { JSONContent } from "@tiptap/react";
import type { ContentFolder, ContentLeaf, ContentNode, Favorite, Project, Scene } from "../types/project";
import { buildFrame, buildProject, buildScene, normalizeProject } from "../types/project";
import { computeAutoLayout } from "../utils/autoLayout";
import { extractChoices, regenerateChoiceIds } from "../utils/choiceBlocks";
import { childrenOf, isDescendant, nextOrder } from "../utils/contentTree";
import { findContainingFrame } from "../utils/graphConstants";
import type { Variable, VariableAction, VariableType, VariableValue } from "../types/variables";
import { applyVariableAction, buildVariable, changeVariableType } from "../types/variables";
import { useInspectorStore } from "./inspectorStore";

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

  toggleFavorite: (refType: Favorite["refType"], refId: string) => void;
  setFavorites: (refType: Favorite["refType"], refIds: string[], value: boolean) => void;

  updateScenePosition: (sceneId: string, position: { x: number; y: number }) => void;
  autoLayoutScenes: () => void;

  /** Pass a scene id to make it the Start Scene, or null to clear it (Play
   * Mode then falls back to the first Story scene, same as an unset project). */
  setStartScene: (sceneId: string | null) => void;

  addFrame: () => void;
  renameFrame: (frameId: string, title: string) => void;
  updateFramePosition: (frameId: string, position: { x: number; y: number }) => void;
  updateFrameRect: (
    frameId: string,
    rect: { x: number; y: number; width: number; height: number },
  ) => void;
  deleteFrame: (frameId: string) => void;

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

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  filePath: null,
  selectedSceneId: null,
  saveStatus: "saved",
  recentProjects: [],

  isPlaying: false,
  playSceneId: null,
  playVariableValues: {},

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

    set({
      project,
      filePath: result.filePath,
      selectedSceneId: project.startSceneId,
      saveStatus: "saved",
      recentProjects: result.recent,
    });
  },

  openProject: async () => {
    const result = await window.api.project.open();
    if (!result) return;

    const project: Project = normalizeProject(JSON.parse(result.raw));
    set({
      project,
      filePath: result.filePath,
      selectedSceneId: project.startSceneId ?? project.scenes[0]?.id ?? null,
      saveStatus: "saved",
      recentProjects: result.recent,
    });
  },

  openRecentProject: async (filePath: string) => {
    try {
      const result = await window.api.project.openPath(filePath);
      const project: Project = normalizeProject(JSON.parse(result.raw));
      set({
        project,
        filePath: result.filePath,
        selectedSceneId: project.startSceneId ?? project.scenes[0]?.id ?? null,
        saveStatus: "saved",
        recentProjects: result.recent,
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

    for (const sceneId of sceneIds) {
      const original = project.scenes.find((s) => s.id === sceneId);
      const originalLeaf = project.content.find(
        (n): n is ContentLeaf => n.id === sceneId && n.kind === "leaf",
      );
      if (!original || !originalLeaf) continue;

      const newId = nanoid();
      newScenes.push({
        ...original,
        id: newId,
        title: `${original.title} Copy`,
        content: regenerateChoiceIds(original.content),
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

    const folder: ContentFolder = {
      id: nanoid(),
      kind: "folder",
      category: "story",
      parentId,
      order: nextOrder(project.content, "story", parentId),
      name: "New Folder",
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

  toggleFavorite: (refType, refId) => {
    const { project } = get();
    if (!project) return;

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

    // Figma-style auto-grouping: if the scene's new position lands inside a
    // Frame's rectangle, it joins that frame; otherwise it's ungrouped. Uses
    // the same containment check the graph's live drag-hover preview uses,
    // so what the user sees highlighted while dragging is always what
    // actually happens on drop.
    const containingFrame = findContainingFrame(project.frames, position);

    set({
      project: {
        ...project,
        scenes: project.scenes.map((s) =>
          s.id === sceneId
            ? { ...s, position, frameId: containingFrame?.id ?? null }
            : s,
        ),
        updatedAt: new Date().toISOString(),
      },
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
  },

  autoLayoutScenes: () => {
    const { project } = get();
    if (!project) return;

    // A Frame's own manual arrangement is never touched by Auto Layout —
    // that part is unchanged from before v0.16.0, and is exactly what
    // "Auto Layout should never undo a writer's own organizing work" has
    // always meant here. What changed: previously a Frame (and everything
    // inside it) was entirely invisible to the layout algorithm — it just
    // sat wherever it was while loose scenes rearranged around it,
    // regardless of whether a loose scene's own connections ran into or
    // out of that Frame. As of v0.16.0, a Frame that contains at least one
    // scene participates in Auto Layout as its own single node — sized to
    // the Frame's own footprint, connected via any choice edge that
    // crosses in or out of it — so the Frame's *position* (as a whole) is
    // included in the layout, while every scene *inside* it keeps its
    // exact relative arrangement, shifted only by however far the Frame
    // itself moved. A Frame with no scenes in it isn't a stand-in for
    // anything with connections, so it's left exactly where it is, same
    // as before.
    const framesWithScenes = project.frames.filter((f) =>
      project.scenes.some((s) => s.frameId === f.id),
    );
    const frameIdSet = new Set(framesWithScenes.map((f) => f.id));
    const looseScenes = project.scenes.filter((s) => !s.frameId);
    if (framesWithScenes.length === 0 && looseScenes.length === 0) return;

    // Every scene maps to the id that represents it in the layout graph:
    // its containing Frame's id if that Frame is one of the ones being
    // laid out, or its own id if it's loose. A scene whose `frameId`
    // points at neither (a stale/orphaned reference) maps to nothing and
    // is simply excluded from the layout, matching how it was already
    // excluded from `looseScenes` before this change.
    const layoutNodeIdForScene = (sceneId: string): string | undefined => {
      const scene = project.scenes.find((s) => s.id === sceneId);
      if (!scene) return undefined;
      if (scene.frameId) return frameIdSet.has(scene.frameId) ? scene.frameId : undefined;
      return scene.id;
    };

    const nodeIds = [...framesWithScenes.map((f) => f.id), ...looseScenes.map((s) => s.id)];

    // Collapse every choice connection down to the layout-node level: an
    // edge between two scenes grouped into the *same* Frame becomes a
    // self-loop once both ends map to that Frame's id — dropped below,
    // since dagre lays out relationships *between* nodes and this one is
    // now fully internal to a single node. An edge crossing into or out of
    // a Frame becomes an edge to/from that Frame's own node id instead of
    // the individual scene's, which is what actually pulls a Frame into
    // the same layout flow as everything it's connected to.
    const rawEdges = project.scenes.flatMap((scene) =>
      extractChoices(scene.content)
        .filter((choice): choice is typeof choice & { targetSceneId: string } =>
          Boolean(choice.targetSceneId),
        )
        .map((choice) => ({ source: scene.id, target: choice.targetSceneId })),
    );
    const seenEdges = new Set<string>();
    const edges: { source: string; target: string }[] = [];
    for (const edge of rawEdges) {
      const source = layoutNodeIdForScene(edge.source);
      const target = layoutNodeIdForScene(edge.target);
      if (!source || !target || source === target) continue;
      const key = `${source}->${target}`;
      if (seenEdges.has(key)) continue;
      seenEdges.add(key);
      edges.push({ source, target });
    }

    const positions = computeAutoLayout(nodeIds, edges, (id) => {
      const frame = framesWithScenes.find((f) => f.id === id);
      return frame?.size;
    });

    // Frames move first (capturing how far each one actually moved), then
    // every scene either rides along with its containing Frame's delta or,
    // if it's loose, takes its own freshly computed position directly —
    // mirroring the exact "shift the frame, carry its scenes by the same
    // delta" pattern `updateFramePosition`/`updateFrameRect` already use
    // for a manual Frame drag/resize, so a Frame's contained scenes never
    // need their own position recomputed by dagre at all.
    const frameDeltas = new Map<string, { dx: number; dy: number }>();
    const newFrames = project.frames.map((f) => {
      const newPos = positions[f.id];
      if (!newPos) return f;
      frameDeltas.set(f.id, { dx: newPos.x - f.position.x, dy: newPos.y - f.position.y });
      return { ...f, position: newPos };
    });

    const newScenes = project.scenes.map((s) => {
      if (s.frameId && frameDeltas.has(s.frameId)) {
        const { dx, dy } = frameDeltas.get(s.frameId)!;
        return dx !== 0 || dy !== 0
          ? { ...s, position: { x: s.position.x + dx, y: s.position.y + dy } }
          : s;
      }
      const newPos = positions[s.id];
      return newPos ? { ...s, position: newPos } : s;
    });

    set({
      project: {
        ...project,
        frames: newFrames,
        scenes: newScenes,
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

    set({
      project: { ...project, startSceneId: sceneId, updatedAt: new Date().toISOString() },
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
  },

  addFrame: () => {
    const { project } = get();
    if (!project) return;

    const frame = buildFrame("New Frame", project.frames.length);
    set({
      project: {
        ...project,
        frames: [...project.frames, frame],
        updatedAt: new Date().toISOString(),
      },
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
  },

  renameFrame: (frameId, title) => {
    const { project } = get();
    if (!project) return;

    set({
      project: {
        ...project,
        frames: project.frames.map((f) => (f.id === frameId ? { ...f, title } : f)),
        updatedAt: new Date().toISOString(),
      },
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
  },

  updateFramePosition: (frameId, position) => {
    const { project } = get();
    if (!project) return;

    const frame = project.frames.find((f) => f.id === frameId);
    if (!frame) return;

    const dx = position.x - frame.position.x;
    const dy = position.y - frame.position.y;

    set({
      project: {
        ...project,
        frames: project.frames.map((f) => (f.id === frameId ? { ...f, position } : f)),
        scenes: project.scenes.map((s) =>
          s.frameId === frameId
            ? { ...s, position: { x: s.position.x + dx, y: s.position.y + dy } }
            : s,
        ),
        updatedAt: new Date().toISOString(),
      },
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
  },

  updateFrameRect: (frameId, rect) => {
    const { project } = get();
    if (!project) return;

    const frame = project.frames.find((f) => f.id === frameId);
    if (!frame) return;

    const dx = rect.x - frame.position.x;
    const dy = rect.y - frame.position.y;

    set({
      project: {
        ...project,
        frames: project.frames.map((f) =>
          f.id === frameId
            ? { ...f, position: { x: rect.x, y: rect.y }, size: { width: rect.width, height: rect.height } }
            : f,
        ),
        // Resizing from the top-left handle shifts the frame's origin —
        // keep contained scenes moving with it, same as a plain drag.
        scenes:
          dx !== 0 || dy !== 0
            ? project.scenes.map((s) =>
                s.frameId === frameId
                  ? { ...s, position: { x: s.position.x + dx, y: s.position.y + dy } }
                  : s,
              )
            : project.scenes,
        updatedAt: new Date().toISOString(),
      },
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
  },

  deleteFrame: (frameId) => {
    const { project } = get();
    if (!project) return;

    set({
      project: {
        ...project,
        frames: project.frames.filter((f) => f.id !== frameId),
        scenes: project.scenes.map((s) =>
          s.frameId === frameId ? { ...s, frameId: null } : s,
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
    set({
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
    const variable = changeVariableType({ ...buildVariable(), name }, type);
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
    set({
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
    set({
      project: {
        ...project,
        variables: project.variables.filter((v) => v.id !== variableId),
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
    set({
      project: null,
      filePath: null,
      selectedSceneId: null,
      saveStatus: "saved",
      isPlaying: false,
      playSceneId: null,
    });
  },
}));
