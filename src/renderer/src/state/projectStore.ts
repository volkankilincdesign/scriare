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
import { ENTITY_CATEGORY, ENTITY_LABEL, buildEntity } from "../types/entities";
import type { EntityKind } from "../types/entities";
import { computeGraphLayout } from "../utils/autoLayoutGraph";
import { regenerateContentIds } from "../utils/contentIds";
import { snapPoint, snapRect } from "../utils/graphConstants";
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
import { buildResume, buildStoryShape, landingFor } from "../utils/recentShape";
import type { ResumeKind } from "../utils/recentShape";
import type { StoredShape } from "../../../preload/index.d";
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
  /** v0.53.0 — see utils/recentShape.ts and main/ipc/projectHandlers.ts. */
  shape?: StoredShape | null;
  /** Read with `readResume` — the fields have changed once. */
  resume?: unknown;
  /** Derived from the disk on every list; never stored. */
  missing?: boolean;
}

/**
 * What the app believes is on disk (v0.47.0). Carried from the read or the
 * last successful save into the next save, so the main process can tell
 * whether anything else has written to the file in between — see
 * main/projectFile.ts.
 */
export interface FileStamp {
  mtimeMs: number;
  size: number;
}

/**
 * A save that found the file changed underneath it. Holds everything needed
 * to decide without asking the disk again, and its presence is what stops
 * autosave: a conflict raises ONE question, not one every 1.5 seconds.
 */
export interface SaveConflict {
  filePath: string;
  /** The stamp the file actually has now — what we would be overwriting. */
  found: FileStamp;
}

interface ProjectState {
  project: Project | null;
  filePath: string | null;
  /** The version of the file this session is editing. Null before a save is possible. */
  fileStamp: FileStamp | null;
  /** Set when a save refused to overwrite someone else's newer version. */
  saveConflict: SaveConflict | null;
  selectedSceneId: string | null;
  /**
   * v0.35.0 — the Character or Location page currently open in the editor,
   * if one is. Exactly one of this and `selectedSceneId` is ever set: the
   * workspace shows one document at a time, and two "what's open" fields
   * that could both be set is precisely the kind of pair that drifts (see
   * the folder/frame split v0.28.0 spent a version undoing).
   */
  selectedEntityId: string | null;
  /**
   * Bumped every time the whole project is REPLACED rather than edited —
   * a new project, an open, or answering "open the version on disk" in the
   * conflict dialog (v0.49.0).
   *
   * The editors reuse one Tiptap instance and reload it when the open
   * document changes, guarded on the document's id so that ordinary
   * re-renders don't throw away what the writer is typing. That guard is
   * right for moving between scenes and wrong for a project swap: the
   * scene id is usually the SAME across a reload, so the guard
   * short-circuited and ProseMirror kept showing the text the writer had
   * just chosen to discard — until their next keystroke wrote it back over
   * the version they had chosen to keep.
   *
   * A counter rather than a flag, for the reason v0.10.5 learned the hard
   * way about `measuredVersion`: a boolean that has to be un-set again is a
   * boolean somebody forgets to un-set, and a value that only ever goes up
   * can be compared without any bookkeeping at the other end.
   */
  documentToken: number;
  saveStatus: SaveStatus;
  recentProjects: RecentProjectEntry[];

  isPlaying: boolean;
  playSceneId: string | null;
  /**
   * v0.66.0 — which VISIT this is. Bumped by every start and every
   * restart, so anything that belongs to one pass through a scene — a
   * conversation's spent lines, above all — can reset on a restart that
   * lands on the scene it was already on. Keying that reset on
   * `playSceneId` alone left a story you restarted with its conversations
   * already exhausted.
   */
  playToken: number;
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
  /**
   * `target` is the page to land on — the Welcome hero passes the one it
   * named, a story card passes nothing and gets the start scene. See
   * `landingFor`.
   */
  openRecentProject: (
    filePath: string,
    target?: { kind: ResumeKind; id: string | null } | null,
  ) => Promise<void>;

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

  /**
   * v0.35.0 — entities. Creating one files it in its kind's category and
   * opens it. `name` is optional so the @ menu can create "Kestrel"
   * mid-sentence without a dialog; it returns the id so the caller can
   * link to what it just made.
   */
  createEntity: (kind: EntityKind, name?: string, options?: { select?: boolean }) => string | null;
  renameEntity: (entityId: string, name: string) => void;
  setEntityAliases: (entityId: string, aliases: string[]) => void;
  updateEntityContent: (entityId: string, content: JSONContent) => void;
  /** Removes the entity and its row in the tree. Mentions of it in scenes
   *  are deliberately NOT rewritten — see the comment on the implementation. */
  deleteEntity: (entityId: string) => void;
  /** Opens an entity's page in the editor (and closes whatever was open). */
  selectEntity: (entityId: string | null) => void;

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

  updateScenePosition: (
    sceneId: string,
    position: { x: number; y: number },
    /** v0.42.0 — false places the scene exactly where it was dropped
     *  (Alt held on the graph). Everything else snaps to the grid. */
    snap?: boolean,
  ) => void;
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
  updateFolderRect: (
    folderId: string,
    rect: FolderRect,
    reparent?: boolean,
    /** As updateScenePosition's `snap`. */
    snap?: boolean,
  ) => void;
  /** Folds a group down to a single block on the graph, or unfolds it. */
  toggleFolderCollapsed: (folderId: string) => void;

  /** Adds a fresh, unnamed Variable (see types/variables.ts's buildVariable) — the
   * Variable Manager's "+ Add Variable" button. */
  /**
   * Adds a blank variable and RETURNS ITS ID (v0.56.0), the way
   * `addChoiceStyle` already did — the Variable Manager opens the new row
   * for editing, and a row that appears collapsed and empty is a row you
   * have to work out how to open.
   */
  addVariable: () => string | null;
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
  /** Throws away this session's edits and re-reads the file from disk. */
  resolveConflictReload: () => Promise<void>;
  /** Keeps both: writes this session's version somewhere else and continues there. */
  resolveConflictSaveCopy: () => Promise<void>;
  /** Writes over the newer version on disk, deliberately. */
  resolveConflictOverwrite: () => Promise<void>;
  closeProject: () => Promise<void>;
}

let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Saves are serialised (v0.47.0). Autosave fires 1.5 seconds after a change
 * and Ctrl+S fires whenever the writer presses it, so two saves overlapping
 * is an ordinary Tuesday — and two overlapping saves used to fight: the
 * second read the file the FIRST had just replaced, found a version it did
 * not recognise, and raised a "this changed outside Scriare" dialog against
 * the app's own writing.
 *
 * One at a time, then, with a single re-run queued if anything changed while
 * a save was in flight — so the last keystroke before Ctrl+S still reaches
 * the disk, and never by racing the save already on its way there.
 */
let saveInFlight = false;
let saveQueued = false;
/**
 * The save currently on its way to disk, INCLUDING the re-run it queues for
 * anything typed while it was in flight (v0.49.1).
 *
 * `saveInFlight` answers "is one running"; this answers "when is the disk
 * actually current", and they are not the same question. v0.49.0's
 * `closeProject` awaited `saveNow()` to flush before closing — but
 * `saveNow`'s first branch is "one is already on its way, queue and
 * return", which hands back an already-resolved promise having written
 * nothing. So the await waited for nothing, `closeProject` then cleared
 * `saveQueued` — the flag that call had just set — and nulled `filePath`,
 * and the real save landed afterwards, saw the path had changed and
 * dropped the queue as well.
 *
 * Measured: save V2 in flight, type V3, close → the file holds V2 and the
 * store reports "saved". The window is ordinary, not exotic: autosave
 * fires 1.5s after a change, a write to a synced folder is not instant,
 * and typing during that second is what typing is.
 *
 * Returning this promise from that branch is what makes `await saveNow()`
 * mean "the disk is current" for every caller, which is what closing,
 * quitting and Ctrl+S all assumed it already meant.
 */
let saveRun: Promise<void> | null = null;
/**
 * Whether the last save failed. Autosave fires after every change, so a
 * folder that has gone away would otherwise raise the same notice every 1.5
 * seconds for as long as someone keeps typing — which is how a message that
 * matters becomes one people learn to dismiss. Said once, and again only
 * after a save has succeeded in between.
 */
let lastSaveFailed = false;

/**
 * How often a save may also refresh the recent entry's cached picture
 * (v0.53.0).
 *
 * The cached shape and excerpt are what let the Welcome screen draw a
 * story's map without opening it, and keeping them current is the only
 * reason this app would ever write a SECOND file during a save. Autosave
 * fires 1.5s after a change, so refreshing on every save means an extra
 * write every 1.5 seconds for a whole writing session — to update a
 * picture on a screen that is, by definition, not open.
 *
 * Six seconds is chosen against what is lost when a refresh is skipped:
 * the Welcome screen shows a map and an excerpt from a few seconds
 * earlier, and the next save fixes it. Nothing is lost that waiting does
 * not repair, so this errs generously towards not writing. Closing the
 * project forces one through, so what the writer sees next time they
 * launch is where they actually stopped.
 */
const RECENT_TOUCH_INTERVAL_MS = 6000;
let lastRecentTouch = { key: "", at: 0 };

/**
 * Refreshes what Recent Projects knows about the story that was just
 * saved — its shape, and the scene the writer is in.
 *
 * Best-effort in the strongest sense: nothing here may surface a failure,
 * because the save it follows SUCCEEDED. A notice saying something went
 * wrong immediately after a good save teaches the writer to distrust the
 * one message that has to be believed.
 */
async function refreshRecentEntry(
  project: Project,
  filePath: string,
  selectedSceneId: string | null,
  selectedEntityId: string | null,
  force: boolean,
): Promise<RecentProjectEntry[] | null> {
  const shape = buildStoryShape(project);
  const resume = buildResume(project, selectedSceneId, selectedEntityId);

  // Deduped on content as well as throttled on time. `at` is deliberately
  // left out of the key: including it would make every payload unique and
  // turn the dedupe into a no-op, which is how a throttle quietly stops
  // throttling.
  const key = JSON.stringify([
    filePath,
    shape,
    resume && [resume.kind, resume.title, resume.excerpt, resume.context],
  ]);
  const now = Date.now();
  if (key === lastRecentTouch.key) return null;
  if (!force && now - lastRecentTouch.at < RECENT_TOUCH_INTERVAL_MS) return null;
  lastRecentTouch = { key, at: now };

  try {
    return await window.api.recent.touch(filePath, { shape, resume });
  } catch {
    // See above. A stale thumbnail is not worth a word.
    return null;
  }
}

function scheduleAutosave(get: () => ProjectState): void {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    // A conflict is a question waiting for an answer, and re-asking it every
    // 1.5 seconds would make the app unusable while the writer reads the
    // dialog. saveNow() returns early in that state; the timer is dropped
    // here as well so nothing keeps firing behind the modal (v0.47.0).
    if (get().saveConflict) return;
    void get().saveNow();
  }, 1500);
}

/**
 * Whether a failed open means "that file is not there" or something else
 * entirely (v0.49.0).
 *
 * The distinction is the whole point: a missing file should leave Recent
 * Projects, and a file that is momentarily locked, half-synced, unreadable
 * or malformed must NOT — it is still the writer's story, and removing it
 * from the one list they look in is a worse outcome than the failure.
 */
function isMissingFile(error: unknown): boolean {
  const message = (error as { message?: string })?.message ?? String(error ?? "");
  return /ENOENT|no such file/i.test(message);
}

/**
 * Says why an open failed, instead of doing nothing.
 *
 * `openProject` had no try/catch and was called as `void openProject()`,
 * with `JSON.parse` running unguarded in the main process — so a truncated
 * or half-synced project file produced no toast, no dialog, and no change
 * on screen. The Welcome screen simply did not react, and the writer's
 * reasonable conclusion was that the app was broken or the story was gone.
 * The same rejection inside the conflict dialog made its "Open the version
 * on disk" button look dead.
 */
function reportOpenFailure(filePath: string | null, error: unknown): void {
  const message = (error as { message?: string })?.message ?? "";
  const name = filePath ? filePath.split(/[\\/]/).pop() : null;
  const what = name ? `“${name}”` : "That project";

  const why = isMissingFile(error)
    ? "isn't where it used to be."
    : /EACCES|EPERM/.test(message)
      ? "can't be read — check its permissions."
      : /EBUSY|EAGAIN/.test(message)
        ? "is in use by something else. If it's syncing, try again in a moment."
        : "couldn't be read. It may still be syncing, or it may be damaged.";

  void import("./toastStore").then(({ useToastStore }) => {
    useToastStore.getState().showNotice(`${what} ${why}`);
  });
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
  fileStamp: null,
  saveConflict: null,
  selectedSceneId: null,
  selectedEntityId: null,
  documentToken: 0,
  saveStatus: "saved",
  recentProjects: [],

  isPlaying: false,
  playSceneId: null,
  playToken: 0,
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
      fileStamp: result.stamp,
      saveConflict: null,
      selectedSceneId: project.startSceneId,
      selectedEntityId: null,
      documentToken: get().documentToken + 1,
      saveStatus: "saved",
      recentProjects: result.recent,
      ...historyFlags(),
    });
  },

  openProject: async () => {
    let result: Awaited<ReturnType<typeof window.api.project.open>>;
    try {
      result = await window.api.project.open();
    } catch (error) {
      reportOpenFailure(null, error);
      return;
    }
    if (!result) return;

    let project: Project;
    try {
      project = normalizeProject(JSON.parse(result.raw));
    } catch (error) {
      reportOpenFailure(result.filePath, error);
      return;
    }

    clearHistory();
    set({
      project,
      filePath: result.filePath,
      fileStamp: result.stamp,
      saveConflict: null,
      selectedSceneId: project.startSceneId ?? project.scenes[0]?.id ?? null,
      selectedEntityId: null,
      documentToken: get().documentToken + 1,
      saveStatus: "saved",
      recentProjects: result.recent,
      ...historyFlags(),
    });
  },

  openRecentProject: async (filePath: string, target = null) => {
    try {
      const result = await window.api.project.openPath(filePath);
      const project: Project = normalizeProject(JSON.parse(result.raw));
      clearHistory();
      set({
        project,
        filePath: result.filePath,
        fileStamp: result.stamp,
        saveConflict: null,
        ...landingFor(project, target),
        documentToken: get().documentToken + 1,
        saveStatus: "saved",
        recentProjects: result.recent,
        ...historyFlags(),
      });
    } catch (error) {
      reportOpenFailure(filePath, error);

      // ONLY a file that is genuinely not there is dropped from the list.
      //
      // This catch used to be blanket, on the reasoning that a failure
      // means the file "was probably moved or deleted" — but it cannot
      // tell ENOENT from a JSON parse error, from the EBUSY a sync client
      // or an antivirus scanner hands back for a few seconds, or from a
      // permission that changed. A half-synced OneDrive file therefore
      // vanished from Recent Projects, silently and permanently, while
      // sitting perfectly intact on disk — and thirty seconds later, when
      // the sync finished, it was openable and invisible.
      if (isMissingFile(error)) {
        const list = await window.api.recent.remove(filePath);
        set({ recentProjects: list });
      }
    }
  },

  selectScene: (sceneId) => {
    // Opening a scene closes an entity page, and vice versa — one document
    // is open at a time.
    set({ selectedSceneId: sceneId, selectedEntityId: null });
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
      // Whatever opens a scene closes an entity page: the interface
      // comment on `selectedEntityId` promises "exactly one of this and
      // `selectedSceneId` is ever set", and `selectScene`/`selectEntity`
      // were the only two that kept it. Creating, duplicating, pasting or
      // deleting while a Character page was open left BOTH set — and
      // EditorGraphSplit resolves that tie as "entity wins", so the tree
      // and the Inspector switched to the new scene while everything typed
      // still went into the character (v0.49.0).
      selectedEntityId: null,
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
      // Whatever opens a scene closes an entity page: the interface
      // comment on `selectedEntityId` promises "exactly one of this and
      // `selectedSceneId` is ever set", and `selectScene`/`selectEntity`
      // were the only two that kept it. Creating, duplicating, pasting or
      // deleting while a Character page was open left BOTH set — and
      // EditorGraphSplit resolves that tie as "entity wins", so the tree
      // and the Inspector switched to the new scene while everything typed
      // still went into the character (v0.49.0).
      selectedEntityId: null,
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
      content: regenerateContentIds(original.content),
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
      // Whatever opens a scene closes an entity page: the interface
      // comment on `selectedEntityId` promises "exactly one of this and
      // `selectedSceneId` is ever set", and `selectScene`/`selectEntity`
      // were the only two that kept it. Creating, duplicating, pasting or
      // deleting while a Character page was open left BOTH set — and
      // EditorGraphSplit resolves that tie as "entity wins", so the tree
      // and the Inspector switched to the new scene while everything typed
      // still went into the character (v0.49.0).
      selectedEntityId: null,
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
        content: regenerateContentIds(original.content, idMap),
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
      // Whatever opens a scene closes an entity page: the interface
      // comment on `selectedEntityId` promises "exactly one of this and
      // `selectedSceneId` is ever set", and `selectScene`/`selectEntity`
      // were the only two that kept it. Creating, duplicating, pasting or
      // deleting while a Character page was open left BOTH set — and
      // EditorGraphSplit resolves that tie as "entity wins", so the tree
      // and the Inspector switched to the new scene while everything typed
      // still went into the character (v0.49.0).
      selectedEntityId: null,
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

  createEntity: (kind, name = "", options) => {
    const { project } = get();
    if (!project) return null;

    const category = ENTITY_CATEGORY[kind];
    const existing = project.entities.filter((e) => e.kind === kind).length;
    const entity = buildEntity(kind, name || `${ENTITY_LABEL[kind]} ${existing + 1}`);
    const leaf: ContentLeaf = {
      id: entity.id,
      kind: "leaf",
      category,
      parentId: null,
      order: nextOrder(project.content, category, null),
      refType: kind,
    };

    pushHistory(set, get, `Create ${ENTITY_LABEL[kind]}`);
    set({
      project: {
        ...project,
        entities: [...project.entities, entity],
        content: [...project.content, leaf],
        updatedAt: new Date().toISOString(),
      },
      // The @ menu creates without navigating: a writer mid-sentence is not
      // asking to be taken somewhere else.
      ...(options?.select === false
        ? {}
        : { selectedEntityId: entity.id, selectedSceneId: null }),
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
    return entity.id;
  },

  renameEntity: (entityId, name) => {
    const { project } = get();
    if (!project) return;

    // Coalesced like a scene rename, so typing a name is one undo step
    // rather than one per keystroke.
    pushHistory(set, get, "Rename", `entity:${entityId}`);
    set({
      project: {
        ...project,
        entities: project.entities.map((e) => (e.id === entityId ? { ...e, name } : e)),
        updatedAt: new Date().toISOString(),
      },
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
  },

  setEntityAliases: (entityId, aliases) => {
    const { project } = get();
    if (!project) return;

    pushHistory(set, get, "Edit Aliases", `aliases:${entityId}`);
    set({
      project: {
        ...project,
        entities: project.entities.map((e) => (e.id === entityId ? { ...e, aliases } : e)),
        updatedAt: new Date().toISOString(),
      },
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
  },

  updateEntityContent: (entityId, content) => {
    const { project } = get();
    if (!project) return;

    set({
      project: {
        ...project,
        entities: project.entities.map((e) => (e.id === entityId ? { ...e, content } : e)),
        updatedAt: new Date().toISOString(),
      },
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
  },

  // Mentions of a deleted entity are NOT stripped from the scenes that
  // contain them — the same call this codebase makes for deleted variables
  // and deleted choice destinations. Walking every scene's document to
  // delete words out of someone's prose is both expensive and presumptuous;
  // a mention whose entity is gone renders as the plain text it was written
  // with (see extensions/Mention.ts), so the sentence still reads.
  deleteEntity: (entityId) => {
    const { project, selectedEntityId } = get();
    if (!project) return;

    pushHistory(set, get, "Delete");
    set({
      project: {
        ...project,
        entities: project.entities.filter((e) => e.id !== entityId),
        content: project.content.filter((n) => n.id !== entityId),
        updatedAt: new Date().toISOString(),
      },
      selectedEntityId: selectedEntityId === entityId ? null : selectedEntityId,
      saveStatus: "unsaved",
    });
    scheduleAutosave(get);
  },

  selectEntity: (entityId) => {
    set({ selectedEntityId: entityId, selectedSceneId: entityId ? null : get().selectedSceneId });
    useInspectorStore.getState().clearTarget();
  },

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
      // Whatever opens a scene closes an entity page: the interface
      // comment on `selectedEntityId` promises "exactly one of this and
      // `selectedSceneId` is ever set", and `selectScene`/`selectEntity`
      // were the only two that kept it. Creating, duplicating, pasting or
      // deleting while a Character page was open left BOTH set — and
      // EditorGraphSplit resolves that tie as "entity wins", so the tree
      // and the Inspector switched to the new scene while everything typed
      // still went into the character (v0.49.0).
      selectedEntityId: null,
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
    // inside the copied set follow the copies — see regenerateContentIds.
    const newScenes: Scene[] = clipboard.scenes.map((scene) => ({
      ...scene,
      id: idMap.get(scene.id)!,
      title: rootIdSet.has(idMap.get(scene.id)!) ? uniqueName(scene.title) : scene.title,
      content: regenerateContentIds(scene.content, idMap),
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

  updateScenePosition: (sceneId, rawPosition, snap = true) => {
    const { project } = get();
    if (!project) return;

    pushHistory(set, get, "Move Scene");

    // v0.42.0 — the grid is enforced here, at the one door every move goes
    // through, not only in the drag that usually opens it. React Flow
    // already snaps the live drag, but a position can also arrive from a
    // paste, from Auto Layout, or from a project file written before the
    // grid existed; snapping at the commit means the stored story is always
    // on the lattice, and "everything lines up" is a property of the data
    // rather than a habit of one interaction.
    const position = snap ? snapPoint(rawPosition) : rawPosition;

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

    // v0.42.0 — the tidy pass lands on the same lattice a hand-drag does.
    // Snapped here rather than inside the layout algorithm because dagre
    // positions by CENTRE and the boxes are resized to fit afterwards: doing
    // it at the end is the only place where what gets stored is what gets
    // drawn. Without it, one Auto Layout leaves every card a few pixels off
    // the grid and the next manual nudge appears to move something that was
    // already aligned.
    const scenes = result.scenes.map((scene) => ({ ...scene, position: snapPoint(scene.position) }));
    const content = result.content.map((node) =>
      node.kind === "folder" && node.rect ? { ...node, rect: snapRect(node.rect) } : node,
    );

    set({
      project: {
        ...project,
        scenes,
        content,
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

  updateFolderRect: (folderId, rawRect, reparent = true, snap = true) => {
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

    // Boxes obey the same lattice as the cards inside them — see
    // updateScenePosition. A RESIZE is snapped by its corners, so both the
    // edge that moved and the one that didn't land on a line (snapRect).
    //
    // A MOVE is snapped by its origin alone, and keeps its size to the
    // pixel. Corner-snapping a move looks identical on paper and is wrong in
    // practice: origin and far edge round independently, so sliding a
    // 620x300 chapter two cells to the right quietly made it 612x306. Doing
    // that on every drag means a box a writer never resized drifts a cell
    // per move. What is being dragged decides which rule applies, and a
    // gesture that doesn't change the size is a move.
    const isMove = rawRect.width === currentRect.width && rawRect.height === currentRect.height;
    const rect = !snap
      ? rawRect
      : isMove
        ? { ...snapPoint({ x: rawRect.x, y: rawRect.y }), width: rawRect.width, height: rawRect.height }
        : snapRect(rawRect);

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
    if (!project) return null;

    pushHistory(set, get, "Add Variable");
    const variable = buildVariable();
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
      playToken: get().playToken + 1,
    });
  },

  exitPlay: () => set({ isPlaying: false }),

  goToPlayScene: (sceneId) => set({ playSceneId: sceneId }),

  restartPlay: () => {
    const { project } = get();
    if (!project) return;
    const playVariableValues: Record<string, VariableValue> = {};
    for (const variable of project.variables) playVariableValues[variable.id] = variable.defaultValue;
    set({
      playSceneId: project.startSceneId ?? project.scenes[0]?.id ?? null,
      playVariableValues,
      playToken: get().playToken + 1,
    });
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
    const { project, filePath, fileStamp, saveConflict } = get();
    if (!project || !filePath) return;
    // One unanswered question at a time — see scheduleAutosave.
    if (saveConflict) return;
    // One save at a time — see saveInFlight. A save already on its way will
    // pick up whatever has changed since, so this returns rather than
    // starting a second one beside it.
    if (saveInFlight) {
      saveQueued = true;
      // AWAIT THE RUN THAT IS ALREADY GOING. Returning here — v0.49.0 —
      // handed the caller a resolved promise having written nothing, so
      // `await saveNow()` meant "a save is happening somewhere" rather
      // than "the disk is current". `closeProject` believed the second
      // reading, cleared the flag this line had just set, and closed over
      // the top of the write. See saveRun.
      await saveRun;
      return;
    }

    saveInFlight = true;
    // Resolved in the outer `finally` below, AFTER the queued re-run — so
    // anyone awaiting this is waiting for the disk to be current, not
    // merely for one write to return.
    let settle: () => void = () => {};
    saveRun = new Promise<void>((resolve) => {
      settle = resolve;
    });
    set({ saveStatus: "saving" });
    try {
    try {
      const outcome = await window.api.project.save(
        filePath,
        JSON.stringify(project, null, 2),
        fileStamp,
      );

      if (outcome.status === "changed") {
        // Nothing was written. The work is still here, in memory, and the
        // file on disk is still whoever else's — which is the whole point:
        // the choice between them belongs to the writer.
        // Nothing queued survives a conflict: the question on screen is
        // what happens next, and a leftover flag would fire one spurious
        // save the moment it is answered.
        saveQueued = false;
        set({
          saveStatus: "unsaved",
          saveConflict: { filePath, found: outcome.stamp },
        });
        return;
      }

      lastSaveFailed = false;

      // WHICH FILE DID THIS SAVE BELONG TO? `filePath` was captured before
      // the await; the store may have moved on while the write was in
      // flight — the writer closed the project, or opened another one.
      // Writing this stamp back regardless left the store holding project
      // B's path with project A's stamp, so B's very first autosave
      // reported a conflict about a file nothing had touched — and one
      // click of "open the version on disk" on that phantom conflict
      // discarded the whole session (v0.49.0).
      if (get().filePath !== filePath) {
        saveQueued = false;
        return;
      }

      // AND IS "saved" STILL TRUE? This used to set `saved`
      // unconditionally, which is a lie whenever a keystroke arrived while
      // the write was in flight: the bar read "All changes saved" while
      // newer text existed only in memory. That was half of why closing
      // the project lost work — the writer checked the bar first.
      //
      // `saveQueued` is precisely the record of "something changed after
      // this save started", so it is also the answer to "is the file now
      // current", and the re-run below is what makes it so.
      set(saveQueued ? { fileStamp: outcome.stamp } : { saveStatus: "saved", fileStamp: outcome.stamp });

      // The story is on disk; now refresh the picture Recent Projects keeps
      // of it. AFTER the status is set, and awaited rather than fired and
      // forgotten, so that `await saveNow()` still means "everything this
      // save does is done" — closing the project relies on that (see
      // saveRun above), and it is the one caller that needs this write to
      // have landed.
      const touched = await refreshRecentEntry(
        project,
        filePath,
        get().selectedSceneId,
        get().selectedEntityId,
        false,
      );
      // Same guard as the stamp above: the writer may have opened another
      // project while this was in flight, and that project's Welcome list
      // is not this one's.
      if (touched && get().filePath === filePath) set({ recentProjects: touched });
    } catch (error) {
      // A save can fail for reasons that have nothing to do with this app —
      // a full disk, a folder that went away with the USB stick it was on, a
      // permission that changed. Before this, the status simply stopped at
      // "Saving…" and stayed there: the one moment the writer most needs to
      // be told something, told silently (v0.47.0).
      //
      // Nothing was written — see main/projectFile.ts — so the work is still
      // here and the file on disk is still the last good version. Saying so
      // is the whole job.
      const reason = (error as { message?: string })?.message ?? "";
      const detail = /ENOSPC/.test(reason)
        ? "there is no room left on the disk"
        : /EACCES|EPERM/.test(reason)
          ? "the file is not writable"
          : /ENOENT/.test(reason)
            ? "the folder it lives in is gone"
            : "the file could not be written";
      // Retrying straight away would fail the same way and say so twice, so
      // the queue is dropped; the next edit schedules another autosave.
      saveQueued = false;
      set({ saveStatus: "unsaved" });
      const alreadyKnown = lastSaveFailed;
      lastSaveFailed = true;
      if (alreadyKnown) return;
      // Imported here rather than at the top: toastStore already imports
      // this module, and a static cycle between two stores is the kind of
      // thing that works until a bundler decides otherwise.
      const { useToastStore } = await import("./toastStore");
      useToastStore
        .getState()
        .showNotice(
          `Couldn't save — ${detail}. Your work is still open, and the last saved version is intact.`,
        );
    } finally {
      saveInFlight = false;
    }

    // Something changed while that was in flight: save once more, with the
    // stamp this save just earned, so the newer keystrokes land too.
    if (saveQueued) {
      saveQueued = false;
      await get().saveNow();
    }
    } finally {
      // Every exit runs this, including the two early returns inside the
      // block above — a `return` that skipped it would leave anyone
      // awaiting `saveRun` waiting forever, which is a worse failure than
      // the one this whole change is about.
      settle();
      saveRun = null;
    }
  },

  resolveConflictReload: async () => {
    const { saveConflict } = get();
    if (!saveConflict) return;

    let result: Awaited<ReturnType<typeof window.api.project.openPath>>;
    let project: Project;
    try {
      result = await window.api.project.openPath(saveConflict.filePath);
      project = normalizeProject(JSON.parse(result.raw));
    } catch (error) {
      // The conflict stands — nothing has been decided, and the dialog has
      // to keep standing with it. Before this, the rejection was swallowed
      // by `void reload()` at the call site and the button simply looked
      // dead, in the one dialog the writer cannot dismiss.
      reportOpenFailure(saveConflict.filePath, error);
      return;
    }

    // The session's edits are gone, so its undo history describes scenes
    // that no longer exist — the same reason opening any project clears it.
    clearHistory();
    set({
      project,
      filePath: result.filePath,
      fileStamp: result.stamp,
      saveConflict: null,
      selectedSceneId: project.startSceneId ?? project.scenes[0]?.id ?? null,
      selectedEntityId: null,
      // The editors must reload even though the scene id has not changed —
      // this is the reason the token exists. See the field's own note.
      documentToken: get().documentToken + 1,
      saveStatus: "saved",
      recentProjects: result.recent,
      ...historyFlags(),
    });
  },

  resolveConflictSaveCopy: async () => {
    const { project, saveConflict } = get();
    if (!project || !saveConflict) return;

    // Suggested beside the original, named for what it is. The writer can
    // put it anywhere; this only has to be a sensible default.
    const dot = saveConflict.filePath.lastIndexOf(".");
    const suggested =
      dot > 0
        ? `${saveConflict.filePath.slice(0, dot)} (copy)${saveConflict.filePath.slice(dot)}`
        : `${saveConflict.filePath} (copy)`;

    const result = await window.api.project.saveCopy(
      suggested,
      JSON.stringify(project, null, 2),
    );
    // Cancelled: the conflict stands, because nothing has been decided.
    if (!result) return;

    // The session continues in the copy. Anything else would leave the next
    // keystroke heading back into the same collision.
    set({
      filePath: result.filePath,
      fileStamp: result.stamp,
      saveConflict: null,
      saveStatus: "saved",
      recentProjects: result.recent,
    });
  },

  resolveConflictOverwrite: async () => {
    const { project, saveConflict } = get();
    if (!project || !saveConflict) return;

    set({ saveStatus: "saving", saveConflict: null });
    // The stamp that was found is passed as the expectation, so this still
    // refuses if the file changed AGAIN between the dialog appearing and the
    // writer answering it — which is exactly when a sync client is busy.
    const outcome = await window.api.project.save(
      saveConflict.filePath,
      JSON.stringify(project, null, 2),
      saveConflict.found,
      // Always keep what is being destroyed here, whatever the backup
      // cadence says: this is the one save that deliberately replaces
      // someone else's newer version of the story.
      true,
    );

    if (outcome.status === "changed") {
      set({
        saveStatus: "unsaved",
        saveConflict: { filePath: saveConflict.filePath, found: outcome.stamp },
      });
      return;
    }

    set({ saveStatus: "saved", fileStamp: outcome.stamp });
  },

  /**
   * Closing the project writes what is pending first (v0.49.0).
   *
   * This used to be `if (autosaveTimer) clearTimeout(autosaveTimer)` — it
   * CANCELLED the pending write rather than performing it. Autosave fires
   * 1.5 seconds after the last change, so anything typed inside that
   * window was simply discarded when the writer clicked back to the
   * Welcome screen. Worse, `saveNow` used to report "All changes saved"
   * whenever its own write landed, even if newer keystrokes had arrived
   * meanwhile (fixed above) — so the status bar was often saying the work
   * was safe at the exact moment clicking would lose it.
   *
   * The one state that cannot be flushed is an unresolved conflict: the
   * path is precisely the one we are not allowed to write to. `App.tsx`
   * asks before closing in that case, because there is no other answer
   * that keeps the work.
   */
  closeProject: async () => {
    if (autosaveTimer) {
      clearTimeout(autosaveTimer);
      autosaveTimer = null;
    }
    // The flush. v0.49.0 ran this and then cleared `saveQueued` — the flag
    // the call had just set — and closed over the top of the write it
    // believed it had waited for. What fixes that is `saveRun` in saveNow,
    // NOT the order of the lines here: a negative control that moved the
    // reset back above this flush changed nothing, because `saveNow` sets
    // the flag itself a line later. Recorded because the first version of
    // this comment said the order was the mechanism, and it isn't.
    if (get().saveStatus !== "saved" && !get().saveConflict) {
      await get().saveNow();
    }

    // The one moment the cached picture is worth writing unconditionally
    // (v0.53.0). Every other refresh is throttled — see
    // RECENT_TOUCH_INTERVAL_MS — so the last few seconds of a session are
    // exactly what the throttle is most likely to have dropped, and they
    // are also the only part the Welcome screen shows next launch. Forced
    // here rather than inside `saveNow`, because a close that arrives
    // while a save is already in flight takes saveNow's early branch and
    // never reaches its refresh at all.
    //
    // Before the state is cleared, and awaited: after the `set` below
    // there is no project left to describe.
    {
      const { project, filePath, selectedSceneId, selectedEntityId } = get();
      if (project && filePath) {
        const touched = await refreshRecentEntry(
          project,
          filePath,
          selectedSceneId,
          selectedEntityId,
          true,
        );
        if (touched) set({ recentProjects: touched });
      }
    }

    // Module-level, and never reset here before — so a save still in
    // flight when the project closed left `saveInFlight` true forever, and
    // the next project's first save queued itself behind a write that had
    // already finished. By this line the chain above has finished, so these
    // are belt and braces rather than the mechanism.
    saveInFlight = false;
    saveQueued = false;
    saveRun = null;
    lastSaveFailed = false;

    clearHistory();
    set({
      project: null,
      filePath: null,
      fileStamp: null,
      saveConflict: null,
      selectedSceneId: null,
      selectedEntityId: null,
      documentToken: get().documentToken + 1,
      saveStatus: "saved",
      isPlaying: false,
      playSceneId: null,
      ...historyFlags(),
    });
  },
}));
