import { ElectronAPI } from "@electron-toolkit/preload";

export interface RecentProjectEntry {
  name: string;
  filePath: string;
  lastOpened: string;
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
  /** v0.49.0 — closing the window writes what is pending first. */
  lifecycle: {
    /**
     * The window is about to close. Do whatever has to happen first, then
     * call `readyToClose`. Returns an unsubscribe function.
     */
    onBeforeClose: (handler: () => void) => () => void;
    /** `false` keeps the window open — the writer said no. */
    readyToClose: (proceed: boolean) => void;
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
