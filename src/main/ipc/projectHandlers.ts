import { ipcMain, dialog, app, BrowserWindow } from "electron";
import { promises as fs } from "fs";
import path from "path";
import { readStamp, writeProjectFile } from "../projectFile";
import type { FileStamp } from "../projectFile";

interface RecentProjectEntry {
  name: string;
  filePath: string;
  lastOpened: string;
}

function recentFilePath(): string {
  return path.join(app.getPath("userData"), "recent-projects.json");
}

async function readRecent(): Promise<RecentProjectEntry[]> {
  try {
    const raw = await fs.readFile(recentFilePath(), "utf-8");
    return JSON.parse(raw) as RecentProjectEntry[];
  } catch {
    return [];
  }
}

async function writeRecent(list: RecentProjectEntry[]): Promise<void> {
  await fs.writeFile(recentFilePath(), JSON.stringify(list, null, 2), "utf-8");
}

async function addRecent(entry: RecentProjectEntry): Promise<RecentProjectEntry[]> {
  const list = await readRecent();
  const filtered = list.filter((p) => p.filePath !== entry.filePath);
  filtered.unshift(entry);
  const trimmed = filtered.slice(0, 8);
  await writeRecent(trimmed);
  return trimmed;
}

/** Registers all project-related IPC handlers. Call once during startup. */
export function registerProjectHandlers(): void {
  ipcMain.handle("recent:list", async () => {
    return readRecent();
  });

  ipcMain.handle("recent:remove", async (_event, filePath: string) => {
    const list = await readRecent();
    const next = list.filter((p) => p.filePath !== filePath);
    await writeRecent(next);
    return next;
  });

  ipcMain.handle(
    "project:create",
    async (event, projectJson: string, projectName: string) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const dialogOptions = {
        title: "Create New Scriare Project",
        defaultPath: path.join(app.getPath("documents"), `${projectName}.json`),
        filters: [{ name: "Scriare Project", extensions: ["json"] }],
      };
      const result = win
        ? await dialog.showSaveDialog(win, dialogOptions)
        : await dialog.showSaveDialog(dialogOptions);

      if (result.canceled || !result.filePath) return null;

      // No expectation: the save dialog has just confirmed this path, and if
      // something is already there the writer said to replace it.
      const outcome = await writeProjectFile(result.filePath, projectJson, null);
      const recent = await addRecent({
        name: projectName,
        filePath: result.filePath,
        lastOpened: new Date().toISOString(),
      });

      return {
        filePath: result.filePath,
        recent,
        stamp: outcome.status === "saved" ? outcome.stamp : null,
      };
    },
  );

  ipcMain.handle("project:open", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const dialogOptions: Electron.OpenDialogOptions = {
      title: "Open Scriare Project",
      properties: ["openFile"],
      filters: [{ name: "Scriare Project", extensions: ["json"] }],
    };
    const result = win
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (result.canceled || result.filePaths.length === 0) return null;

    const filePath = result.filePaths[0];
    const raw = await fs.readFile(filePath, "utf-8");
    // Stamped as it is read, so the first save can tell whether anything has
    // touched the file since — see projectFile.ts.
    const stamp = await readStamp(filePath);
    const parsed = JSON.parse(raw) as { name?: string };
    const recent = await addRecent({
      name: parsed.name ?? path.basename(filePath),
      filePath,
      lastOpened: new Date().toISOString(),
    });

    return { filePath, raw, recent, stamp };
  });

  ipcMain.handle("project:openPath", async (_event, filePath: string) => {
    const raw = await fs.readFile(filePath, "utf-8");
    const stamp = await readStamp(filePath);
    const parsed = JSON.parse(raw) as { name?: string };
    const recent = await addRecent({
      name: parsed.name ?? path.basename(filePath),
      filePath,
      lastOpened: new Date().toISOString(),
    });

    return { filePath, raw, recent, stamp };
  });

  ipcMain.handle(
    "project:save",
    async (
      _event,
      filePath: string,
      projectJson: string,
      expected: FileStamp | null,
      forceBackup?: boolean,
    ) => {
      return writeProjectFile(filePath, projectJson, expected ?? null, {
        forceBackup: forceBackup === true,
      });
    },
  );

  /**
   * "Save a copy" — the way out of a conflict that keeps both versions.
   * Deliberately a separate channel from `project:create`: that one is about
   * starting a story and files the result in Recent as a new project, while
   * this is the same story going somewhere else because the original path
   * now holds someone else's newer work.
   */
  ipcMain.handle(
    "project:saveCopy",
    async (event, suggestedPath: string, projectJson: string) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const dialogOptions = {
        title: "Save a Copy",
        defaultPath: suggestedPath,
        filters: [{ name: "Scriare Project", extensions: ["json"] }],
      };
      const result = win
        ? await dialog.showSaveDialog(win, dialogOptions)
        : await dialog.showSaveDialog(dialogOptions);

      if (result.canceled || !result.filePath) return null;

      const outcome = await writeProjectFile(result.filePath, projectJson, null);
      const recent = await addRecent({
        name: path.basename(result.filePath),
        filePath: result.filePath,
        lastOpened: new Date().toISOString(),
      });

      return {
        filePath: result.filePath,
        recent,
        stamp: outcome.status === "saved" ? outcome.stamp : null,
      };
    },
  );
}
