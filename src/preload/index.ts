import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

const api = {
  project: {
    create: (projectJson: string, projectName: string) =>
      ipcRenderer.invoke("project:create", projectJson, projectName),
    open: () => ipcRenderer.invoke("project:open"),
    openPath: (filePath: string) =>
      ipcRenderer.invoke("project:openPath", filePath),
    save: (
      filePath: string,
      projectJson: string,
      expected: { mtimeMs: number; size: number } | null,
      forceBackup?: boolean,
    ) =>
      ipcRenderer.invoke("project:save", filePath, projectJson, expected, forceBackup),
    saveCopy: (suggestedPath: string, projectJson: string) =>
      ipcRenderer.invoke("project:saveCopy", suggestedPath, projectJson),
  },
  recent: {
    list: () => ipcRenderer.invoke("recent:list"),
    remove: (filePath: string) => ipcRenderer.invoke("recent:remove", filePath),
  },
  exportStory: {
    html: (suggestedName: string, html: string, nearPath: string | null) =>
      ipcRenderer.invoke("export:html", suggestedName, html, nearPath),
    open: (filePath: string) => ipcRenderer.invoke("export:reveal", filePath),
  },
  /**
   * v0.49.0 — the window asks before it closes, so a pending autosave is
   * written rather than discarded. See main/index.ts for the handshake.
   */
  lifecycle: {
    onBeforeClose: (handler: () => void) => {
      const listener = (): void => handler();
      ipcRenderer.on("app:before-close", listener);
      return () => ipcRenderer.off("app:before-close", listener);
    },
    readyToClose: (proceed: boolean) => ipcRenderer.send("app:ready-to-close", proceed),
  },
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.api = api;
}
