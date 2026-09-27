import { ipcMain, dialog, app, BrowserWindow, shell } from "electron";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { writeProjectFile } from "../projectFile";
import { buildScriptDocx } from "../script/scriptDocx";
import type { ScriptDocument, ScriptFormat } from "../../shared/script/model";

/**
 * Writing a script to disk (v0.64.0).
 *
 * Two formats, one model. The renderer hands over the `ScriptDocument`
 * and, for the PDF, the HTML it was typeset into; this file turns each
 * into bytes and writes them through the same atomic path everything else
 * uses, so a failed export leaves the previous one standing rather than a
 * truncated file.
 *
 * THE PDF IS PRINTED, NOT GENERATED. An offscreen window loads the page
 * and `printToPDF` lays it out — which means Chromium's own paged-media
 * engine decides the page breaks, honouring every `break-inside: avoid`
 * and `keepNext` rule the stylesheet asks for. Writing a PDF by hand with
 * a library would mean re-implementing pagination, badly, in the one
 * place the writer will notice it.
 *
 * The window is offscreen and never shown: `show: false` with no
 * `ready-to-show` handler, so it cannot flash in front of the writer the
 * way v0.62.0 spent a version making sure the real window does not.
 */

const EXTENSION: Record<ScriptFormat, string> = { pdf: ".pdf", docx: ".docx" };
const FILTER: Record<ScriptFormat, { name: string; extensions: string[] }> = {
  pdf: { name: "PDF Document", extensions: ["pdf"] },
  docx: { name: "Word Document", extensions: ["docx"] },
};
/** Never honoured as a destination extension, whatever the dialog returns. */
const PROJECT_EXTENSIONS = new Set([".scriare", ".json"]);

/**
 * The same guard `asWebPage` exists for, and for the same reason: the save
 * dialog opens in the project's own folder, where clicking the story fills
 * the name box with `My Story.scriare`, and one OK would replace the story
 * with a PDF — atomically, with no backup.
 */
export function asScriptFile(filePath: string, format: ScriptFormat): string {
  const wanted = EXTENSION[format];
  const extension = path.extname(filePath).toLowerCase();
  if (extension === wanted) return filePath;
  const base = PROJECT_EXTENSIONS.has(extension)
    ? filePath.slice(0, filePath.length - extension.length)
    : filePath;
  return `${base}${wanted}`;
}

/**
 * Page numbers along the foot. Chromium renders header and footer
 * templates in their own margin bands, which is why the page margins are
 * set HERE rather than in the stylesheet's `@page` rule — a CSS margin
 * plus `marginType: "none"` leaves the footer band zero pixels tall and
 * the numbers are silently clipped.
 */
const FOOTER = `
<div style="width:100%;font:8pt 'Courier New',monospace;color:#555;padding:0 18mm 0 22mm;
            display:flex;justify-content:space-between;">
  <span class="title"></span><span class="pageNumber"></span>
</div>`;

async function renderPdf(html: string): Promise<Buffer> {
  // Written to a real file rather than loaded as a data: URL — a 30-scene
  // script is well past the length at which data URLs start being refused,
  // and the failure is silent.
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "scriare-script-"));
  const page = path.join(directory, "script.html");
  await fs.writeFile(page, html, "utf-8");

  const window = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: true, javascript: false },
  });

  try {
    await window.loadFile(page);
    return await window.webContents.printToPDF({
      pageSize: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: FOOTER,
      margins: { top: 0.79, bottom: 0.71, left: 0.87, right: 0.71 },
    });
  } finally {
    if (!window.isDestroyed()) window.destroy();
    await fs.rm(directory, { recursive: true, force: true }).catch(() => {});
  }
}

export function registerScriptHandlers(): void {
  ipcMain.handle(
    "script:save",
    async (
      event,
      payload: {
        format: ScriptFormat;
        model: ScriptDocument;
        html: string;
        suggestedName: string;
        nearPath: string | null;
      },
    ) => {
      const { format, model, html, suggestedName, nearPath } = payload;
      const win = BrowserWindow.fromWebContents(event.sender);
      const directory = nearPath ? path.dirname(nearPath) : app.getPath("documents");

      const dialogOptions = {
        title: format === "pdf" ? "Export Script as a PDF" : "Export Script as a Word Document",
        defaultPath: path.join(directory, suggestedName),
        filters: [FILTER[format]],
      };
      const result = win
        ? await dialog.showSaveDialog(win, dialogOptions)
        : await dialog.showSaveDialog(dialogOptions);

      if (result.canceled || !result.filePath) return null;
      const filePath = asScriptFile(result.filePath, format);

      const bytes = format === "pdf" ? await renderPdf(html) : await buildScriptDocx(model);
      await writeProjectFile(filePath, bytes, null, { noBackup: true });

      const info = await fs.stat(filePath).catch(() => null);
      return { filePath, bytes: info?.size ?? bytes.byteLength };
    },
  );

  /** "Open it", handed to whatever the OS uses for PDFs and Word files. */
  ipcMain.handle("script:reveal", async (_event, filePath: string) => {
    await shell.openPath(filePath);
  });
}
