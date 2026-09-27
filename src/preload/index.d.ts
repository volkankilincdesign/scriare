import { ElectronAPI } from "@electron-toolkit/preload";

/**
 * A story's shape, cached so the Welcome screen can draw its map without
 * opening it — see renderer/src/utils/recentShape.ts.
 */
export interface StoredShape {
  /**
   * Shape format version. ABSENT on anything written by v0.53.0, whose
   * coordinates mean something different — the reader treats a shape it
   * does not recognise as no shape, and the Welcome screen redraws it.
   * Everything here is optional for that reason: this is a record of what
   * some version of the app once wrote, not a promise about it.
   */
  v?: number;
  nodes: { x: number; y: number }[];
  edges: [number, number][];
  start: number;
  total: number;
  w?: number;
  h?: number;
  node?: { w: number; h: number };
}

/** What the writer was in the middle of when they last saved. */
export interface StoredResume {
  /**
   * v0.54.0 — which kind of page it was: "scene", "character" or
   * "location". Absent on anything written before that, which could only
   * ever have been a scene, so the reader treats a record without it as
   * one. Every field is optional for the same reason the cached shape's
   * are: this is a record of what some version of the app once wrote.
   */
  kind?: string;
  title?: string;
  context?: string | null;
  /** Pre-v0.54.0 spellings of `title` and `context`. */
  sceneTitle?: string;
  groupName?: string | null;
  excerpt?: string;
  at?: string;
}

export interface RecentProjectEntry {
  name: string;
  filePath: string;
  lastOpened: string;
  /**
   * v0.53.0. Both are absent on any project last saved by an earlier
   * version, and `shape` is explicitly null for a project with no scenes —
   * the Welcome screen draws that state rather than treating it as an
   * error.
   */
  shape?: StoredShape | null;
  resume?: StoredResume | null;
  /**
   * Whether the file is still on disk. Recomputed every time a list is
   * returned and never persisted — see main/ipc/projectHandlers.ts.
   */
  missing?: boolean;
}

/** A file's identity as the app last saw it — see main/projectFile.ts. */
export interface FileStamp {
  mtimeMs: number;
  size: number;
}

/** What a save did: replaced the file, or refused because it had changed. */
export type SaveOutcome =
  | { status: "saved"; stamp: FileStamp; backedUp: boolean }
  | { status: "changed"; stamp: FileStamp };

export interface ScriareAPI {
  /** v0.63.0 — which build this is, straight from the packaged app. */
  app: {
    version: () => Promise<string>;
    /** Copies the full report line and returns exactly what was copied. */
    copyVersion: () => Promise<string>;
  };
  project: {
    create: (
      projectJson: string,
      projectName: string,
    ) => Promise<{
      filePath: string;
      recent: RecentProjectEntry[];
      stamp: FileStamp | null;
    } | null>;
    open: () => Promise<{
      filePath: string;
      raw: string;
      recent: RecentProjectEntry[];
      stamp: FileStamp | null;
    } | null>;
    openPath: (filePath: string) => Promise<{
      filePath: string;
      raw: string;
      recent: RecentProjectEntry[];
      stamp: FileStamp | null;
    }>;
    save: (
      filePath: string,
      projectJson: string,
      expected: FileStamp | null,
      /** Keep a backup even if one was taken recently — see main/projectFile.ts. */
      forceBackup?: boolean,
    ) => Promise<SaveOutcome>;
    /**
     * v0.53.1 — reads a project without opening it or touching its place
     * in Recent Projects. Used only to backfill a missing story map.
     * `raw` is null when the file could not be read or is too large to be
     * worth parsing for a thumbnail.
     */
    readForShape: (
      filePath: string,
    ) => Promise<{ raw: string | null; reason: "too-large" | "unreadable" | null }>;
    /** Writes the open project somewhere else, and switches to it. */
    saveCopy: (
      suggestedPath: string,
      projectJson: string,
    ) => Promise<{
      filePath: string;
      recent: RecentProjectEntry[];
      stamp: FileStamp | null;
    } | null>;
  };
  recent: {
    list: () => Promise<RecentProjectEntry[]>;
    remove: (filePath: string) => Promise<RecentProjectEntry[]>;
    /**
     * v0.53.0 — refresh what is cached about a story already in the list,
     * without moving it. A path that is not in the list is ignored.
     */
    touch: (
      filePath: string,
      patch: { shape?: StoredShape | null; resume?: StoredResume | null; name?: string },
    ) => Promise<RecentProjectEntry[]>;
  };
  /** v0.48.0 — the story as a page anyone can read. */
  exportStory: {
    /**
     * Shows a save dialog and writes the page. `nearPath` is the open
     * project's own path, so the export is offered beside the story it
     * came from; null falls back to Documents. A null return means the
     * writer cancelled.
     */
    html: (
      suggestedName: string,
      html: string,
      nearPath: string | null,
    ) => Promise<{ filePath: string; bytes: number } | null>;
    /** Hands the exported file to the OS — in practice, the browser. */
    open: (filePath: string) => Promise<void>;
  };
  /** v0.64.0 — the story as a printable script. */
  script: {
    save: (payload: {
      format: "pdf" | "docx";
      model: unknown;
      html: string;
      suggestedName: string;
      nearPath: string | null;
    }) => Promise<{ filePath: string; bytes: number } | null>;
    open: (filePath: string) => Promise<void>;
  };
  /** v0.49.0 — closing the window writes what is pending first. */
  lifecycle: {
    /**
     * The window is about to close. Do whatever has to happen first, then
     * call `readyToClose`. Returns an unsubscribe function.
     */
    onBeforeClose: (handler: () => void) => () => void;
    /** `false` keeps the window open — the writer said no. */
    readyToClose: (proceed: boolean) => void;
    /** The story this launch was asked to open, or null (v0.61.0). */
    pendingOpen: () => Promise<string | null>;
    /** The first screen is decided; the window may be shown (v0.62.0). */
    shellReady: () => void;
    /** A story opened from the desktop while the app was already running. */
    onOpenFromDisk: (handler: (filePath: string) => void) => () => void;
    /**
     * Sent repeatedly while the close is being handled, to say the renderer
     * is alive. The main process gives up only when these STOP — a window
     * waiting on a slow disk, or on the writer reading a question, is not a
     * window that has hung (v0.49.1).
     */
    stillWorking: () => void;
  };
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: ScriareAPI;
  }
}
