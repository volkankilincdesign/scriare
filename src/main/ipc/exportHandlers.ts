import { ipcMain, dialog, app, BrowserWindow, shell } from "electron";
import { promises as fs } from "fs";
import path from "path";
import { writeProjectFile } from "../projectFile";

/**
 * Writing an exported story to disk (v0.48.0).
 *
 * Its own channel rather than a flag on `project:save`, because the two are
 * different promises. A project save must never lose the writer's work and
 * carries the whole conflict machinery to prove it. An export is a
 * derivative: it can be regenerated from the project in one click, so
 * nothing here needs a stamp, a conflict question, or a `.bak`.
 *
 * It still goes through `writeProjectFile`, and that is not
 * over-engineering. The atomic temp-file-then-rename in there means a
 * failed export — a full disk, a sync client holding the file, the power
 * going — leaves the PREVIOUS export intact rather than a half-written
 * page. A writer who has just sent someone a link to their story does not
 * want the next export to be the thing that breaks it.
 *
 * The backup side of that function is switched OFF here, which was a
 * review finding rather than a design decision: reusing the save path
 * brought the `.bak` along with it, so exporting twice would have left a
 * `My Story.html.bak` in the folder — a backup of a file that is itself a
 * derivative, in the one folder this version just finished arguing should
 * hold a story and nothing surprising.
 */
/**
 * The destination, forced to be a web page (v0.49.0).
 *
 * This used to be `extname(p) === "" ? p + ".html" : p` — anything with an
 * extension was accepted verbatim. Combined with `expected: null` (no
 * conflict check) and `noBackup: true` (no recovery), and with the dialog
 * opening in the project's OWN folder, that made one misclick fatal:
 * `My Story.scriare` is sitting right there in the file list, clicking a
 * file in a native Save dialog fills the name box with it, and the story
 * was then replaced by a web page — atomically, completely, with no
 * backup. The app's next act was to offer "Open it".
 *
 * Two changes. An extension that is a PROJECT extension is never honoured,
 * whatever the dialog returns. And anything that isn't already `.html` or
 * `.htm` gains `.html` rather than only an empty one doing so — because
 * `path.extname("My Story v1.2")` is `".2"`, so a perfectly ordinary story
 * title used to produce a file the OS had no opinion about and no browser
 * would open.
 */
const PROJECT_EXTENSIONS = new Set([".scriare", ".json"]);
const WEB_PAGE_EXTENSIONS = new Set([".html", ".htm"]);

export function asWebPage(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (WEB_PAGE_EXTENSIONS.has(extension)) return filePath;
  // A project extension is stripped, not appended to: `My Story.scriare`
  // becomes `My Story.html`, not `My Story.scriare.html`, which would sort
  // next to the story and read like a variant of it.
  const base = PROJECT_EXTENSIONS.has(extension)
    ? filePath.slice(0, filePath.length - extension.length)
    : filePath;
  return `${base}.html`;
}

export function registerExportHandlers(): void {
  ipcMain.handle(
    "export:html",
    async (event, suggestedName: string, html: string, nearPath: string | null) => {
      const win = BrowserWindow.fromWebContents(event.sender);

      // Offered beside the project by default. An exported story belongs
      // with the story it came from — that is the whole reason a new project
      // gets a folder of its own (see projectHandlers.ts).
      const directory = nearPath ? path.dirname(nearPath) : app.getPath("documents");

      const dialogOptions = {
        title: "Export Story as a Web Page",
        defaultPath: path.join(directory, suggestedName),
        filters: [{ name: "Web Page", extensions: ["html"] }],
      };
      const result = win
        ? await dialog.showSaveDialog(win, dialogOptions)
        : await dialog.showSaveDialog(dialogOptions);

      if (result.canceled || !result.filePath) return null;

      const filePath = asWebPage(result.filePath);

      await writeProjectFile(filePath, html, null, { noBackup: true });

      const info = await fs.stat(filePath).catch(() => null);
      return { filePath, bytes: info?.size ?? Buffer.byteLength(html, "utf-8") };
    },
  );

  /**
   * "Open it" straight after exporting. `openPath` hands the file to
   * whatever the reader's OS has registered for HTML, which is the browser
   * — the same thing that will open it when it reaches anyone else, so it
   * is a real check of the export rather than a preview of it.
   */
  ipcMain.handle("export:reveal", async (_event, filePath: string) => {
    await shell.openPath(filePath);
  });
}
