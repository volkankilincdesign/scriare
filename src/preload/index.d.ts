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
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: ScriareAPI;
  }
}
