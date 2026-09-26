import { ipcMain, dialog, app, BrowserWindow } from "electron";
import { promises as fs } from "fs";
import path from "path";
import { readStamp, writeProjectFile } from "../projectFile";
import type { FileStamp } from "../projectFile";
import { forStorage, mergeRecentEntry } from "../../shared/recentEntries";
import type { RecentEntry as SharedRecentEntry } from "../../shared/recentEntries";

/**
 * The record kept for each recent project, and the two rules about it that
 * are easy to get wrong — see shared/recentEntries.ts, where they live so
 * that the test build can reach them without reaching into the writer's
 * own recent-projects.json.
 */
type RecentProjectEntry = SharedRecentEntry;

/**
 * The file extension (v0.48.0).
 *
 * Projects were `.json` — which is honest about the format and wrong about
 * everything else. A `.json` sitting in a folder of documents is a file the
 * writer has no reason to think is theirs: it sorts with config files,
 * Explorer shows it as a generic text document, and nothing about it says
 * "this is my story". The format has not changed and is not being hidden —
 * a `.scriare` file is still JSON, still opens in any text editor, and
 * claude/file-format.md still describes it byte for byte. What changed is
 * that the file now says whose it is.
 *
 * `.scri` was the shorter candidate and lost on the argument that three
 * letters save nothing anyone ever types: the name is typed once, in a save
 * dialog, and read a thousand times in a file list, where `.scriare` is
 * unambiguous and `.scri` is a guess.
 *
 * `.json` stays in the OPEN filter permanently. Every project that exists
 * today is a `.json`, and an extension change that makes a writer's
 * existing work unopenable is not a rename — it is data loss with good
 * manners.
 */
const PROJECT_EXT = "scriare";
const OPEN_FILTERS: Electron.FileFilter[] = [
  { name: "Scriare Project", extensions: [PROJECT_EXT, "json"] },
  { name: "All Files", extensions: ["*"] },
];
const SAVE_FILTERS: Electron.FileFilter[] = [
  { name: "Scriare Project", extensions: [PROJECT_EXT] },
];

/**
 * Where a new project is offered first.
 *
 * `Documents/Scriare/` rather than `Documents/` itself, because a story is
 * not one file: it is the project, its `.bak`, and — from this version on —
 * the HTML exported beside it. Loose in Documents that is three
 * unrelated-looking files in the folder everything else already lands in;
 * in a folder of their own it is one thing.
 *
 * Created here rather than at startup, so a writer who never makes a
 * project never gets a folder they did not ask for. Best-effort: if it
 * cannot be made — permissions, or a FILE of that name already sitting
 * there — the dialog opens in Documents, which is exactly where it used to.
 */
async function defaultProjectDirectory(): Promise<string> {
  const documents = app.getPath("documents");
  const folder = path.join(documents, "Scriare");
  try {
    await fs.mkdir(folder, { recursive: true });
    return folder;
  } catch {
    return documents;
  }
}

/**
 * A save dialog can still return a path with no extension: on Windows a
 * writer who types `My Story` does not always get one appended, and on
 * Linux they never do. A project with no extension is a file the OS has no
 * opinion about, so the extension is added here rather than hoped for.
 *
 * Tested against a KNOWN SET rather than against `extname(p) === ""`, which
 * was the v0.48.0 version and is wrong for a very ordinary story title:
 * `path.extname("My Story v1.2")` is `".2"`, so the guard did not fire, and
 * the project was saved as `My Story v1.2` with no extension at all — not
 * listed by the open dialog's default filter, and never opened by a
 * double-click in Explorer. The writer's reasonable conclusion is that the
 * story was not saved.
 *
 * `.json` is in the set because a writer who deliberately types one is
 * choosing the older extension, which still opens (see OPEN_FILTERS).
 * Anything else — `.2`, `.txt`, whatever the title happened to end with —
 * is a filename, not a choice of format, and gets `.scriare` after it.
 */
const KNOWN_PROJECT_EXTENSIONS = new Set([`.${PROJECT_EXT}`, ".json"]);

function withProjectExtension(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  return KNOWN_PROJECT_EXTENSIONS.has(extension) ? filePath : `${filePath}.${PROJECT_EXT}`;
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
  await fs.writeFile(
    recentFilePath(),
    JSON.stringify(list.map(forStorage), null, 2),
    "utf-8",
  );
}

/** Moves a story to the front of Recent Projects — see mergeRecentEntry. */
async function addRecent(entry: RecentProjectEntry): Promise<RecentProjectEntry[]> {
  const list = await readRecent();
  const merged = mergeRecentEntry(
    list.find((p) => p.filePath === entry.filePath),
    entry,
  );
  const filtered = list.filter((p) => p.filePath !== entry.filePath);
  filtered.unshift(merged);
  const trimmed = filtered.slice(0, 8);
  await writeRecent(trimmed);
  // Annotated rather than returned raw, so that EVERY channel that hands
  // the renderer a recent list hands it the same shape. A list without
  // `missing` is not merely less informative — the Welcome screen reads it
  // as "every file is present", so one channel forgetting would quietly
  // clear the warning icons until the next `recent:list`.
  return listWithPresence();
}

/**
 * Is the file still where the entry says it is?
 *
 * Only ENOENT counts as missing. A file that is there but locked, still
 * syncing, or briefly unreadable by an antivirus scanner is NOT missing —
 * marking it so would put a warning icon on a perfectly intact story, and
 * that is the same mistake `openRecentProject` had to be fixed for in
 * v0.49.1 (see the comment there). Anything that is not a plain "not
 * found" is treated as present.
 */
async function isMissing(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return false;
  } catch (error) {
    return (error as NodeJS.ErrnoException)?.code === "ENOENT";
  }
}

async function listWithPresence(): Promise<RecentProjectEntry[]> {
  const list = await readRecent();
  return Promise.all(
    list.map(async (entry) => ({ ...entry, missing: await isMissing(entry.filePath) })),
  );
}

/** Registers all project-related IPC handlers. Call once during startup. */
export function registerProjectHandlers(): void {
  ipcMain.handle("recent:list", async () => {
    return listWithPresence();
  });

  /**
   * Update what is cached about a story WITHOUT touching its place in the
   * list (v0.53.0).
   *
   * Separate from `addRecent` on purpose: that one means "this story was
   * just opened", and reordering Recent Projects every time autosave fires
   * would make the list reshuffle under the writer's cursor while they
   * type. This one means "here is a fresher picture of a story already in
   * the list", and it deliberately does nothing when the path is not
   * there — a save to a file that has fallen off the end of an 8-entry
   * list should not put it back.
   */
  ipcMain.handle(
    "recent:touch",
    async (_event, filePath: string, patch: Partial<RecentProjectEntry>) => {
      const list = await readRecent();
      const at = list.findIndex((p) => p.filePath === filePath);
      if (at === -1) return listWithPresence();
      list[at] = { ...list[at], ...patch, filePath };
      await writeRecent(list);
      return listWithPresence();
    },
  );

  ipcMain.handle("recent:remove", async (_event, filePath: string) => {
    const list = await readRecent();
    const next = list.filter((p) => p.filePath !== filePath);
    await writeRecent(next);
    return listWithPresence();
  });

  ipcMain.handle(
    "project:create",
    async (event, projectJson: string, projectName: string) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const dialogOptions = {
        title: "Create New Scriare Project",
        defaultPath: path.join(await defaultProjectDirectory(), `${projectName}.${PROJECT_EXT}`),
        filters: SAVE_FILTERS,
      };
      const result = win
        ? await dialog.showSaveDialog(win, dialogOptions)
        : await dialog.showSaveDialog(dialogOptions);

      if (result.canceled || !result.filePath) return null;

      const filePath = withProjectExtension(result.filePath);

      // No expectation: the save dialog has just confirmed this path, and if
      // something is already there the writer said to replace it.
      const outcome = await writeProjectFile(filePath, projectJson, null);
      const recent = await addRecent({
        name: projectName,
        filePath,
        lastOpened: new Date().toISOString(),
      });

      return {
        filePath,
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
      filters: OPEN_FILTERS,
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
        filters: SAVE_FILTERS,
      };
      const result = win
        ? await dialog.showSaveDialog(win, dialogOptions)
        : await dialog.showSaveDialog(dialogOptions);

      if (result.canceled || !result.filePath) return null;

      const filePath = withProjectExtension(result.filePath);

      const outcome = await writeProjectFile(filePath, projectJson, null);
      const recent = await addRecent({
        name: path.basename(filePath),
        filePath,
        lastOpened: new Date().toISOString(),
      });

      return {
        filePath,
        recent,
        stamp: outcome.status === "saved" ? outcome.stamp : null,
      };
    },
  );
}
