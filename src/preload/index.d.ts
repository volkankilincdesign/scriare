import { ElectronAPI } from "@electron-toolkit/preload";

export interface RecentProjectEntry {
  name: string;
  filePath: string;
  lastOpened: string;
}

export interface ScriareAPI {
  project: {
    create: (
      projectJson: string,
      projectName: string,
    ) => Promise<{ filePath: string; recent: RecentProjectEntry[] } | null>;
    open: () => Promise<
      { filePath: string; raw: string; recent: RecentProjectEntry[] } | null
    >;
    openPath: (
      filePath: string,
    ) => Promise<{ filePath: string; raw: string; recent: RecentProjectEntry[] }>;
    save: (filePath: string, projectJson: string) => Promise<boolean>;
  };
  recent: {
    list: () => Promise<RecentProjectEntry[]>;
    remove: (filePath: string) => Promise<RecentProjectEntry[]>;
  };
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: ScriareAPI;
  }
}
