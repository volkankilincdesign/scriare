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

      const filePath =
        path.extname(result.filePath) === "" ? `${result.filePath}.html` : result.filePath;

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
