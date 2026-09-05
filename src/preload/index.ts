import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

const api = {
  project: {
    create: (projectJson: string, projectName: string) =>
      ipcRenderer.invoke("project:create", projectJson, projectName),
    open: () => ipcRenderer.invoke("project:open"),
    openPath: (filePath: string) =>
      ipcRenderer.invoke("project:openPath", filePath),
    save: (filePath: string, projectJson: string) =>
      ipcRenderer.invoke("project:save", filePath, projectJson),
  },
  recent: {
    list: () => ipcRenderer.invoke("recent:list"),
    remove: (filePath: string) => ipcRenderer.invoke("recent:remove", filePath),
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
