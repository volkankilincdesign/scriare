import { ipcMain, dialog, app, BrowserWindow } from "electron";
import { promises as fs } from "fs";
import path from "path";

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

      await fs.writeFile(result.filePath, projectJson, "utf-8");
      const recent = await addRecent({
        name: projectName,
        filePath: result.filePath,
        lastOpened: new Date().toISOString(),
      });

      return { filePath: result.filePath, recent };
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
    const parsed = JSON.parse(raw) as { name?: string };
    const recent = await addRecent({
      name: parsed.name ?? path.basename(filePath),
      filePath,
      lastOpened: new Date().toISOString(),
    });

    return { filePath, raw, recent };
  });

  ipcMain.handle("project:openPath", async (_event, filePath: string) => {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as { name?: string };
    const recent = await addRecent({
      name: parsed.name ?? path.basename(filePath),
      filePath,
      lastOpened: new Date().toISOString(),
    });

    return { filePath, raw, recent };
  });

  ipcMain.handle(
    "project:save",
    async (_event, filePath: string, projectJson: string) => {
      await fs.writeFile(filePath, projectJson, "utf-8");
      return true;
    },
  );
}
