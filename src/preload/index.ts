import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

const api = {
  /**
   * v0.63.0 — which build this is. Asked for rather than baked in: the
   * main process reads it off the packaged app, so what the Welcome screen
   * prints and what Windows lists under Apps & features cannot disagree.
   */
  app: {
    version: (): Promise<string> => ipcRenderer.invoke("app:version"),
    /** Puts the full "version · platform · Electron · Chromium" line on the
     *  clipboard and returns it. Composed and copied in main — see there. */
    copyVersion: (): Promise<string> => ipcRenderer.invoke("app:copyVersion"),
  },
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
    readForShape: (filePath: string) => ipcRenderer.invoke("project:readForShape", filePath),
    saveCopy: (suggestedPath: string, projectJson: string) =>
      ipcRenderer.invoke("project:saveCopy", suggestedPath, projectJson),
  },
  recent: {
    list: () => ipcRenderer.invoke("recent:list"),
    remove: (filePath: string) => ipcRenderer.invoke("recent:remove", filePath),
    touch: (filePath: string, patch: unknown) =>
      ipcRenderer.invoke("recent:touch", filePath, patch),
  },
  exportStory: {
    html: (suggestedName: string, html: string, nearPath: string | null) =>
      ipcRenderer.invoke("export:html", suggestedName, html, nearPath),
    open: (filePath: string) => ipcRenderer.invoke("export:reveal", filePath),
  },
  /**
   * v0.64.0 — the story as a script somebody can read on paper. The model
   * crosses as plain JSON; the HTML is what printToPDF lays out.
   */
  script: {
    save: (payload: unknown) => ipcRenderer.invoke("script:save", payload),
    open: (filePath: string) => ipcRenderer.invoke("script:reveal", filePath),
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
    /**
     * "Still here, still working." v0.49.1 — the main process's give-up
     * timer used to be a deadline for the whole answer, which meant the
     * writer had four seconds to read a question about losing an hour of
     * work. It is a liveness check now, and this is the pulse.
     */
    stillWorking: () => ipcRenderer.send("app:closing-heartbeat"),
    /**
     * v0.61.0 — the story this launch was asked to open, if the app was
     * started by double-clicking one. Asked for once, by the renderer,
     * when it is ready to act on the answer.
     */
    pendingOpen: (): Promise<string | null> => ipcRenderer.invoke("app:pendingOpen"),
    /**
     * v0.62.0 — "I know what to draw." The main process is holding the
     * window back until this, or until the grace elapses.
     */
    shellReady: () => ipcRenderer.send("app:shell-ready"),
    /** ...and the same request arriving while the app is already running. */
    onOpenFromDisk: (handler: (filePath: string) => void) => {
      const listener = (_event: unknown, filePath: string): void => handler(filePath);
      ipcRenderer.on("project:open-from-disk", listener);
      return () => ipcRenderer.off("project:open-from-disk", listener);
    },
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
