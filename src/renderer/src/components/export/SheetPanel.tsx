import { useMemo, useState } from "react";
import { Button } from "../common/Button";
import { useProjectStore } from "../../state/projectStore";
import { useToastStore } from "../../state/toastStore";
import { buildSheet } from "../../export/sheet/buildSheet";
import { suggestedSheetName } from "../../../../shared/sheet/model";

/**
 * Every string a reader sees, as something a translator can work in
 * (v0.70.0).
 *
 * WHY THIS IS THE THIRD DOOR rather than a menu of its own: "get this
 * story out of the app" is one intention with three answers — a page to
 * play, a script to read, a sheet to work from — and the third was the one
 * the Script panel explicitly deferred. Its own comment says so: a Word
 * table of nine hundred rows is a worse spreadsheet than a spreadsheet.
 *
 * ONE CONTROL, and it is optional. The seventeen columns, the two editable
 * ones, the locking, the Ref scheme — all settled once in
 * docs/spreadsheet-export.md rather than handed to the writer as fifteen
 * decisions while they are trying to send a file to somebody. The one
 * thing the app genuinely cannot know is which language this copy is going
 * out for, and that only exists because the answer is one file per
 * language: two translators working at once should never have to merge
 * workbooks.
 */

interface Result {
  filePath: string;
  csvPath: string;
  bytes: number;
  rows: number;
}

export function SheetPanel({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project);
  const filePath = useProjectStore((s) => s.filePath);
  const showNotice = useToastStore((s) => s.showNotice);

  const [language, setLanguage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Result | null>(null);

  /**
   * Rebuilt as the language changes, which is nearly free — the walk is
   * over the project's own documents — and means the counts under the
   * field are the counts of the rows that will actually be written rather
   * than an estimate of them.
   */
  const sheet = useMemo(
    () => (project ? buildSheet(project, { language }) : null),
    [project, language],
  );

  if (!project || !sheet) return null;

  async function handleExport(): Promise<void> {
    if (!sheet) return;
    setBusy(true);
    try {
      const result = await window.api.sheet.save({
        sheet,
        suggestedName: suggestedSheetName(sheet.title, sheet.language),
        nearPath: filePath,
      });
      if (result) setDone(result);
    } catch (error) {
      showNotice(
        `The spreadsheet couldn't be written — ${error instanceof Error ? error.message : "unknown error"}`,
      );
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const name = done.filePath.split(/[\\/]/).pop() ?? done.filePath;
    const csvName = done.csvPath.split(/[\\/]/).pop() ?? done.csvPath;
    return (
      <div>
        <p className="mb-1 text-sm text-[var(--text)]">
          {done.rows} {done.rows === 1 ? "line" : "lines"} written.
        </p>
        <p className="mb-4 break-all text-xs text-[var(--text-3)]">
          {name} · {Math.max(1, Math.round(done.bytes / 1024))} KB
          <span className="mt-0.5 block">and {csvName} beside it</span>
        </p>
        <div className="flex items-center justify-end gap-2">
          <Button intent="ghost" onClick={() => void window.api.sheet.open(done.filePath)}>
            Open it
          </Button>
          <Button
            intent="primary"
            onClick={() => {
              setDone(null);
              onClose();
            }}
          >
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <p className="mb-4 text-sm leading-relaxed text-[var(--text-2)]">
        Every string a reader sees — scene titles, prose, choices, dialogue and replies —
        one row each, in reading order from your first scene. One column to translate into,
        one for notes, and everything else locked so a sort can't shift a translation onto
        the wrong line.
      </p>

      <div className="mb-4">
        <label
          className="scriare-section-label mb-2 block text-[var(--text-3)]"
          htmlFor="sheet-language"
        >
          Target language
        </label>
        <input
          id="sheet-language"
          type="text"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          placeholder="Turkish, German, Japanese…"
          data-sheet-language
          className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--bg)] px-2.5 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--text-3)] focus:border-[var(--accent)] focus:outline-none"
        />
        <p className="mt-1.5 text-xs text-[var(--text-3)]">
          Goes in the file name and the Read me. One file per language, so two translators
          never have to merge workbooks. Leave it blank if you're not sure yet.
        </p>
      </div>

      {/* Said before the export rather than discovered after it. A file
          appearing in somebody's folder that they didn't ask for is a
          small betrayal even when it is the file they needed. */}
      <div className="mb-4 rounded-md border border-[var(--border-soft)] bg-[var(--surface-2-faint)] p-3">
        <div className="scriare-section-label mb-2 text-[var(--text-3)]">Two files, side by side</div>
        <ul className="space-y-1 text-xs leading-relaxed text-[var(--text-2)]">
          <li>
            <span className="text-[var(--text)]">.xlsx</span> — for the translator. All
            seventeen columns, header frozen, filters on, a live character count.
          </li>
          <li>
            <span className="text-[var(--text)]">.csv</span> — for the engine. Six columns,
            comma-delimited UTF-8, the line's id as the RowName. Not Excel's idea of a CSV.
          </li>
        </ul>
      </div>

      <div className="mb-1 rounded-md border border-[var(--border-soft)] bg-[var(--surface-2-faint)] p-3">
        <div className="scriare-section-label mb-2 text-[var(--text-3)]">What gets written</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-[var(--text-2)]">
          <span>{sheet.rows.length} rows</span>
          <span>{sheet.stats.prose} prose</span>
          <span>{sheet.stats.choices} choices</span>
          <span>{sheet.stats.dialogue} dialogue</span>
          <span>{sheet.stats.replies} replies</span>
          <span>{sheet.stats.speakers} speaking parts</span>
        </div>
        {/* Two things worth knowing BEFORE the file goes out, because both
            are invisible in the sheet itself and both are questions the
            translator would otherwise ask. */}
        {(sheet.stats.unreachableScenes > 0 || sheet.stats.mentions > 0) && (
          <div className="mt-2 space-y-1 border-t border-[var(--border-soft)] pt-2 text-xs text-[var(--text-3)]">
            {sheet.stats.unreachableScenes > 0 && (
              <div>
                {sheet.stats.unreachableScenes}{" "}
                {sheet.stats.unreachableScenes === 1 ? "scene is" : "scenes are"} unreachable —
                numbered U1, U2 and still translated.
              </div>
            )}
            {sheet.stats.mentions > 0 && (
              <div>
                {sheet.stats.mentions}{" "}
                {sheet.stats.mentions === 1 ? "row names" : "rows name"} a character or place.
                The name is baked into the text, so renaming one later unsyncs those rows —
                column K lists them.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button intent="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button intent="primary" disabled={busy} onClick={() => void handleExport()}>
          {busy ? "Writing…" : "Export Lines…"}
        </Button>
      </div>
    </>
  );
}
