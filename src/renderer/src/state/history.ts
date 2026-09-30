import type { Project } from "../types/project";

/**
 * Undo/redo for *structural* project changes (v0.25.0).
 *
 * ---------------------------------------------------------------------------
 * Why snapshots rather than a command pattern
 * ---------------------------------------------------------------------------
 * Every mutating action in projectStore.ts already builds a brand-new
 * `project` object out of the old one — `{ ...project, scenes: [...] }` —
 * and never mutates in place. That means the previous `project` reference
 * stays valid and fully intact for free: undo is just "put that reference
 * back."
 *
 * The usual objection to snapshotting a whole document is memory, and it
 * doesn't apply here for the same reason. Because the updates are
 * immutable, a snapshot SHARES STRUCTURE with the version that replaced it:
 * renaming one scene in a 200-scene project allocates one new scene object
 * and one new array — the other 199 scenes are the exact same objects in
 * both snapshots. So a history entry costs roughly the size of that
 * action's diff, not the size of the project. Deep-cloning here (via
 * structuredClone or JSON round-tripping) would destroy that sharing and
 * turn a cheap history into a genuinely expensive one, so it is deliberately
 * NOT done.
 *
 * This also means one rule must hold for the history to stay correct: no
 * action may ever mutate `project` (or anything reachable from it) in
 * place. Every action in projectStore.ts follows that today. Breaking it
 * would silently corrupt history entries rather than fail loudly, so it is
 * worth keeping in mind when adding new actions.
 *
 * ---------------------------------------------------------------------------
 * What this stack does NOT cover, on purpose
 * ---------------------------------------------------------------------------
 * Prose. Typing inside a scene is Tiptap's own history, which is already
 * wired up, already scoped to the editor, and already does the
 * type-a-word-at-a-time coalescing that a document editor needs. Choice
 * Block edits go through a ProseMirror transaction too (see
 * utils/choiceBlockEditing.ts), so they ride on that same stack even when
 * they're made from the Inspector.
 *
 * That leaves two stacks in the app, which is only coherent because they
 * are disjoint in effect: Tiptap's never changes project structure, and
 * this one never changes prose (see `mergeLiveProse` below, which is what
 * guarantees the second half). The keyboard hook routes between them by
 * focus — Ctrl+Z inside the editor is Tiptap's, anywhere else is this one.
 */
export interface HistoryEntry {
  /** Shown as "Undo <label>" — the action the user is about to reverse. */
  label: string;
  project: Project;
  selectedSceneId: string | null;
  /**
   * This step owns the PROSE as well as the structure (v0.79.0).
   *
   * Everything else in this stack is structural, so undo carries the live
   * prose forward rather than reverting it — see `mergeLiveProse`, and the
   * v0.49.0 note in it about the paragraphs that used to vanish. Replace
   * is the first action that deliberately rewrites prose across documents
   * nobody has open, and for it that rule is exactly backwards: carrying
   * the live prose forward would carry the replacement forward and make
   * undo a no-op. Measured on the first build, which did.
   *
   * Set it only for an action whose whole purpose is the prose, or the
   * v0.49.0 bug comes back wearing this flag.
   */
  ownsProse?: boolean;
  /**
   * Optional identity for run-together edits. Two consecutive snapshots
   * sharing a mergeKey, less than MERGE_WINDOW_MS apart, collapse into the
   * first — see `recordSnapshot`. Scope it to the thing being edited
   * (`"rename-scene:" + sceneId`), never just to the kind of edit, so
   * renaming one scene and then immediately renaming a different one stays
   * two separate undo steps.
   */
  mergeKey?: string;
  /**
   * Assigned by `recordSnapshot`. Identifies one specific step so a piece
   * of UI can ask "is the thing I offered to undo still the thing undo
   * would undo?" — see the undo toast, which must never quietly reverse a
   * *different* action just because the writer did something else in the
   * seconds before clicking it.
   */
  token?: number;
}

/**
 * How many steps back a writer can go. Entries are cheap (see the
 * structure-sharing note above), so this is set by what's actually useful
 * to a person rather than by memory pressure — past a few dozen steps,
 * nobody is undoing their way out of a mistake any more, they're looking
 * for a previous version of the file.
 */
export const HISTORY_LIMIT = 50;

let past: HistoryEntry[] = [];
let future: HistoryEntry[] = [];

/**
 * Coalescing window. Several store actions can fire in one synchronous
 * burst from a single user gesture — dragging a multi-selection in the
 * graph calls `updateScenePosition` once per selected scene from inside
 * one `onNodeDragStop` handler. Without this, one drag would cost five
 * undo steps and the writer would have to press Ctrl+Z five times to put
 * things back.
 *
 * Rather than asking every such call site to remember to open a
 * transaction (a rule that gets forgotten the moment someone adds a new
 * one), the first snapshot in a synchronous task wins and any further
 * snapshot in that same task is folded into it. A microtask is exactly the
 * right boundary: everything a single event handler does runs inside one,
 * and two genuinely separate user actions can never share one.
 */
let taskOpen = false;

/**
 * The other coalescing window, for edits that arrive as a stream of
 * separate events rather than one burst: a text field wired to `onChange`
 * calls its store action on every keystroke, so renaming a Frame to
 * "Chapter Two" would otherwise cost eleven undo steps and undoing it
 * would replay the name backwards one letter at a time.
 *
 * Consecutive snapshots that share a `mergeKey` and land within this many
 * milliseconds of each other collapse into the first — the one holding the
 * name as it was before typing started, which is the state a writer
 * actually wants back. The timer refreshes on each keystroke, so a pause
 * longer than this starts a fresh step, which is the same rule (and
 * roughly the same duration) ProseMirror's own history uses for grouping
 * typing.
 */
const MERGE_WINDOW_MS = 700;
let lastMergeKey: string | null = null;
let lastMergeAt = 0;

/** Monotonic, never reused — see HistoryEntry.token. */
let nextToken = 0;

/**
 * Records the state the project is in *before* an action runs. Call this
 * from the top of a mutating action, while `project` is still the old one.
 */
export function recordSnapshot(entry: HistoryEntry): void {
  const now = Date.now();

  // Doing something new discards the branch you'd redone away from —
  // standard behaviour, and the only alternative (a history tree) is a
  // much bigger idea than this is trying to be.
  //
  // This runs first, before either coalescing check can bail out: a change
  // that merges into an existing step is still a change, and leaving a
  // stale redo branch alive would let Ctrl+Shift+Z jump to a future that
  // no longer follows from the present.
  future = [];

  if (entry.mergeKey) {
    const continues =
      entry.mergeKey === lastMergeKey &&
      now - lastMergeAt < MERGE_WINDOW_MS &&
      past.length > 0 &&
      past[past.length - 1].mergeKey === entry.mergeKey;
    lastMergeKey = entry.mergeKey;
    lastMergeAt = now;
    // Keep the older snapshot: it holds the value from before this run of
    // edits began, which is what "undo the rename" means.
    if (continues) return;
  } else {
    lastMergeKey = null;
  }

  if (taskOpen) return; // already captured this gesture — see `taskOpen`
  taskOpen = true;
  queueMicrotask(() => {
    taskOpen = false;
  });

  past.push({ ...entry, token: ++nextToken });
  if (past.length > HISTORY_LIMIT) past.shift();
}

/** Pops one step back, handing `current` to the redo stack. Null if empty. */
export function takeUndo(current: HistoryEntry): HistoryEntry | null {
  const entry = past.pop();
  if (!entry) return null;
  // Stepping through history ends any run of merging edits: typing a name,
  // undoing it, then typing again must not fold back into the step that
  // was just undone.
  lastMergeKey = null;
  // The label AND the prose ownership travel with the step, not with the
  // direction. A Replace undone has to be redoable as a Replace, and the
  // first build carried only the label — so redo fell back to merging the
  // live (already-undone) prose forward and did nothing at all.
  future.push({ ...current, label: entry.label, ownsProse: entry.ownsProse });
  return entry;
}

/** Pops one step forward, handing `current` to the undo stack. Null if empty. */
export function takeRedo(current: HistoryEntry): HistoryEntry | null {
  const entry = future.pop();
  if (!entry) return null;
  lastMergeKey = null;
  past.push({ ...current, label: entry.label, ownsProse: entry.ownsProse });
  return entry;
}

/** Wipes both stacks — opening, creating or closing a project. */
export function clearHistory(): void {
  past = [];
  future = [];
  taskOpen = false;
  lastMergeKey = null;
  lastMergeAt = 0;
}

/** The four values the store mirrors into React state so the UI can react. */
export function historyFlags(): {
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  undoToken: number | null;
} {
  const top = past.length > 0 ? past[past.length - 1] : null;
  return {
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    undoLabel: top ? top.label : null,
    redoLabel: future.length > 0 ? future[future.length - 1].label : null,
    undoToken: top?.token ?? null,
  };
}

/**
 * Carries today's prose across an undo.
 *
 * A snapshot is a whole project, so restoring one naively would also roll
 * back every word written since — delete a scene, write two paragraphs
 * somewhere else, press Ctrl+Z, lose the paragraphs. That is a data-loss
 * bug dressed up as a feature.
 *
 * The fix is to treat scene content as belonging to the live project
 * rather than to the snapshot: for any scene that exists in BOTH, the
 * current content wins. A scene that exists only in the snapshot (because
 * the action being undone deleted it) keeps the snapshot's content, which
 * is by then the only copy of it anywhere — which is exactly the case undo
 * exists for.
 *
 * The result is the clean division the two-stack design depends on: this
 * stack moves structure, Tiptap's stack moves words, and neither can
 * clobber the other.
 */
export function mergeLiveProse(snapshot: Project, current: Project | null): Project {
  if (!current) return snapshot;

  const liveScenes = new Map(current.scenes.map((scene) => [scene.id, scene.content]));
  let changed = false;
  const scenes = snapshot.scenes.map((scene) => {
    const live = liveScenes.get(scene.id);
    if (live && live !== scene.content) {
      changed = true;
      return { ...scene, content: live };
    }
    return scene;
  });

  // ENTITY PAGES TOO (v0.49.0). This used to carry only `scenes` forward,
  // and a Character or Location page's prose has no protection on either
  // side — `updateEntityContent`, like `updateSceneContent`, deliberately
  // takes no snapshot of its own. So a structural undo silently reverted
  // whatever had been written on a character page since the snapshot was
  // taken. Measured: create a scene (snapshot), write three paragraphs on
  // a character's page, undo — the scene goes, and so do the paragraphs,
  // with nothing on screen to say so, because the undo's label only ever
  // mentioned the scene.
  const liveEntities = new Map((current.entities ?? []).map((e) => [e.id, e.content]));
  const entities = (snapshot.entities ?? []).map((entity) => {
    const live = liveEntities.get(entity.id);
    if (live && live !== entity.content) {
      changed = true;
      return { ...entity, content: live };
    }
    return entity;
  });

  return changed ? { ...snapshot, scenes, entities } : snapshot;
}
