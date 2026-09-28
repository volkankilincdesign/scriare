import { CSV_COLUMNS, SHEET_COLUMNS } from "../../shared/sheet/model";
import type { SheetDocument, SheetRow } from "../../shared/sheet/model";

/**
 * The CSV, written by hand (v0.70.0).
 *
 * WHY NOT "SAVE AS CSV" FROM EXCEL. On a Turkish Windows the list
 * separator is a semicolon and the encoding is CP1254, so Excel writes a
 * semicolon-delimited CP1254 file and calls it a CSV. Unreal reads commas
 * and UTF-8. The result is one column of garbage where the İ and the ş
 * used to be — and the writer has no way of knowing, because the file
 * opens perfectly in the app that broke it.
 *
 * So this one is written here: comma-delimited, every field quoted, UTF-8,
 * newlines escaped as a literal `\n` two-character sequence rather than
 * left as real line breaks. A DataTable row cannot span lines.
 *
 * NO BYTE ORDER MARK. Excel wants one to recognise UTF-8; Unreal's
 * DataTable importer takes the BOM as part of the first column's name and
 * looks for a field called `﻿Key`. The CSV's audience is the engine —
 * the translator's file is the xlsx, and it has no such problem.
 */

/** One field, quoted the way RFC 4180 says and the way engines expect. */
function field(value: string): string {
  return `"${value.replace(/"/g, '""').replace(/\r\n|\r|\n/g, "\\n")}"`;
}

/** The six columns an engine reads, in the order the header declares them. */
function cells(row: SheetRow): string[] {
  const all = [
    row.key,
    row.ref,
    row.where,
    row.scene,
    row.sceneId,
    row.type,
    row.speaker,
    row.text,
    "", // Translation — the column the translator fills
    "", // Notes
    row.mentions,
    row.shownWhen,
    row.changes,
    row.after,
    row.voFile,
    "", // Chars is a formula in the workbook and has no meaning here
    row.hash,
  ];
  return CSV_COLUMNS.map((index) => all[index]);
}

export function buildSheetCsv(sheet: SheetDocument): Buffer {
  const header = CSV_COLUMNS.map((index) =>
    // `Key` becomes `RowName`, which is the one name Unreal requires: it is
    // what the engine's lookups compile against. Everything else keeps the
    // header the workbook shows, so the two files read as one pair.
    field(index === 0 ? "RowName" : SHEET_COLUMNS[index].header),
  ).join(",");

  const lines = [header, ...sheet.rows.map((row) => cells(row).map(field).join(","))];
  // CRLF, because that is what RFC 4180 specifies and what every importer
  // that has ever been strict about it wanted.
  return Buffer.from(`${lines.join("\r\n")}\r\n`, "utf-8");
}
