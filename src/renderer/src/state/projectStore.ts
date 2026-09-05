import { create } from "zustand";
import { nanoid } from "nanoid";
import type { JSONContent } from "@tiptap/react";
import type { ContentFolder, ContentLeaf, ContentNode, Favorite, Project, Scene } from "../types/project";
import { buildFrame, buildProject, buildScene, normalizeProject } from "../types/project";
import { computeAutoLayout } from "../utils/autoLayout";
import { extractChoices, regenerateChoiceIds } from "../utils/choiceBlocks";
import { childrenOf, isDescendant, nextOrder } from "../utils/contentTree";
import { SCENE_NODE_HEIGHT, SCENE_NODE_WIDTH } from "../utils/graphConstants";

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

  loadRecent: () => Promise<void>;
  newProject: (name: string) => Promise<void>;
  openProject: () => Promise<void>;
  openRecentProject: (filePath: string) => Promise<void>;

  selectScene: (sceneId: string) => void;
  createScene: (parentId?: string | null) => void;
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

  startPlay: () => void;
  exitPlay: () => void;
  goToPlayScene: (sceneId: string) => void;
  restartPlay: () => void;

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

  selectScene: (sceneId) => set({ selectedSceneId: sceneId }),

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
    // Frame's rectangle, it joins that frame; otherwise it's ungrouped.
    const center = {
      x: position.x + SCENE_NODE_WIDTH / 2,
      y: position.y + SCENE_NODE_HEIGHT / 2,
    };
    const containingFrame = project.frames.find(
      (frame) =>
        center.x >= frame.position.x &&
        center.x <= frame.position.x + frame.size.width &&
        center.y >= frame.position.y &&
        center.y <= frame.position.y + frame.size.height,
    );

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

    // Only rearrange scenes that aren't manually grouped into a Frame —
    // Auto Layout should never undo a writer's own organizing work.
    const looseScenes = project.scenes.filter((s) => !s.frameId);
    if (looseScenes.length === 0) return;

    const edges = project.scenes.flatMap((scene) =>
      extractChoices(scene.content)
        .filter((choice): choice is typeof choice & { targetSceneId: string } =>
          Boolean(choice.targetSceneId),
        )
        .map((choice) => ({ source: scene.id, target: choice.targetSceneId })),
    );

    const positions = computeAutoLayout(
      looseScenes.map((s) => s.id),
      edges,
    );

    set({
      project: {
        ...project,
        scenes: project.scenes.map((s) =>
          positions[s.id] ? { ...s, position: positions[s.id] } : s,
        ),
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

  // Play Mode is purely a read-only presentation over the existing project
  // data — none of these actions touch `project` or trigger autosave.
  startPlay: () => {
    const { project } = get();
    if (!project) return;
    set({
      isPlaying: true,
      playSceneId: project.startSceneId ?? project.scenes[0]?.id ?? null,
    });
  },

  exitPlay: () => set({ isPlaying: false }),

  goToPlayScene: (sceneId) => set({ playSceneId: sceneId }),

  restartPlay: () => {
    const { project } = get();
    if (!project) return;
    set({ playSceneId: project.startSceneId ?? project.scenes[0]?.id ?? null });
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
