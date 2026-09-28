import { ipcMain, dialog, app, BrowserWindow, shell } from "electron";
import { promises as fs } from "fs";
import path from "path";
import { writeProjectFile } from "../projectFile";
import { buildSheetXlsx } from "../sheet/sheetXlsx";
import { buildSheetCsv } from "../sheet/sheetCsv";
import type { SheetDocument } from "../../shared/sheet/model";

/**
 * Writing the spreadsheet to disk (v0.70.0).
 *
 * TWO FILES FROM ONE EXPORT, side by side, from one save dialog. The
 * workbook is the translator's document and the CSV is the engine's, and
 * they answer to different needs — seventeen columns against six, wrapped
 * prose against a fixed struct. What they must never do is disagree about
 * what the story says, and the surest way to guarantee that is to write
 * them from one model in one go rather than leaving the second export to
 * be remembered, later, from an edited story.
 *
 * The dialog asks for the workbook's path and the CSV takes the same name
 * beside it. That is stated in the panel before the export, not discovered
 * afterwards: a file appearing in somebody's folder that they did not ask
 * for is a small betrayal even when it is the file they needed.
 *
 * Both go through the same atomic write as everything else, so a failure
 * leaves the previous export standing rather than a half-written sheet
 * that opens with no error and is missing its last four hundred rows.
 */

/** Never honoured as a destination extension, whatever the dialog returns. */
const PROJECT_EXTENSIONS = new Set([".scriare", ".json"]);

/**
 * The same guard the script and the web page have. The save dialog opens
 * in the project's own folder, where clicking the story fills the name box
 * with `My Story.scriare` — and one OK would replace the story with a
 * workbook, atomically, with no backup.
 */
export function asSheetFile(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".xlsx") return filePath;
  const base = PROJECT_EXTENSIONS.has(extension)
    ? filePath.slice(0, filePath.length - extension.length)
    : filePath;
  return `${base}.xlsx`;
}

/** The CSV that goes beside it: the same path with the other extension. */
export function csvBeside(xlsxPath: string): string {
  return `${xlsxPath.slice(0, xlsxPath.length - ".xlsx".length)}.csv`;
}

export function registerSheetHandlers(): void {
  ipcMain.handle(
    "sheet:save",
    async (
      event,
      payload: { sheet: SheetDocument; suggestedName: string; nearPath: string | null },
    ) => {
      const { sheet, suggestedName, nearPath } = payload;
      const win = BrowserWindow.fromWebContents(event.sender);
      const directory = nearPath ? path.dirname(nearPath) : app.getPath("documents");

      const dialogOptions = {
        title: "Export Lines as a Spreadsheet",
        defaultPath: path.join(directory, `${suggestedName}.xlsx`),
        filters: [{ name: "Excel Workbook", extensions: ["xlsx"] }],
      };
      const result = win
        ? await dialog.showSaveDialog(win, dialogOptions)
        : await dialog.showSaveDialog(dialogOptions);

      if (result.canceled || !result.filePath) return null;
      const xlsxPath = asSheetFile(result.filePath);
      const csvPath = csvBeside(xlsxPath);

      // Built before either is written: if the workbook cannot be
      // generated, neither file is touched, rather than leaving a CSV
      // beside a workbook from last week.
      const xlsx = await buildSheetXlsx(sheet);
      const csv = buildSheetCsv(sheet);

      await writeProjectFile(xlsxPath, xlsx, null, { noBackup: true });
      await writeProjectFile(csvPath, csv, null, { noBackup: true });

      const info = await fs.stat(xlsxPath).catch(() => null);
      return {
        filePath: xlsxPath,
        csvPath,
        bytes: info?.size ?? xlsx.byteLength,
        rows: sheet.rows.length,
      };
    },
  );

  /** "Open it", handed to whatever the OS uses for workbooks. */
  ipcMain.handle("sheet:reveal", async (_event, filePath: string) => {
    await shell.openPath(filePath);
  });
}
