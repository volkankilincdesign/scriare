import JSZip from "jszip";
import { EDITABLE_COLUMNS, SHEET_COLUMNS } from "../../shared/sheet/model";
import type { SheetDocument, SheetRow } from "../../shared/sheet/model";

/**
 * The workbook, written as OOXML (v0.70.0).
 *
 * An .xlsx is a zip of XML parts, and this writes them directly rather
 * than through a spreadsheet library. The reason is the size of what is
 * actually needed: two sheets, one formula column, frozen header,
 * autofilter, and a protection scheme where exactly two columns are
 * editable. A library that does all of that brings a megabyte of code and
 * its own opinions about types and dates; this file is a few hundred lines
 * and every decision in it is visible.
 *
 * INLINE STRINGS RATHER THAN A SHARED-STRING TABLE. The table is the
 * space-efficient form and the whole point of it is repeated strings —
 * which a sheet of prose does not have, because every row is a different
 * sentence. Inline costs a few percent on a file this size and removes an
 * index that has to be kept in step with every cell that points into it.
 *
 * WHAT THE PROTECTION IS FOR, and what it is not. A translator opening
 * this can type in Translation and Notes and nowhere else, which stops the
 * commonest accident by far: a sort or a paste that shifts one column out
 * of step with the rest and silently reattaches every translation to the
 * wrong line. It is not security — Excel's sheet protection is a guard
 * rail, it is removable in two clicks, and it is meant to be.
 */

/** Escape for XML text and attribute values. */
function x(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // Control characters are illegal in XML 1.0 and Excel refuses the
    // whole file rather than the cell. Tab, newline and carriage return
    // are the three that are legal and the three a writer can produce.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
}

/** A1-style column name: 0 → A, 25 → Z, 26 → AA. */
export function columnName(index: number): string {
  let name = "";
  let n = index;
  for (;;) {
    name = String.fromCharCode(65 + (n % 26)) + name;
    if (n < 26) return name;
    n = Math.floor(n / 26) - 1;
  }
}

/**
 * The style indices this workbook uses, in the order styles.xml declares
 * them. Named rather than numbered at the call sites, because an off-by-one
 * in a style index is invisible until somebody opens the file.
 */
const STYLE = {
  /** Locked, wrapped, top-aligned — every read-only cell of the table. */
  cell: 1,
  /** The header band: bold, filled, locked, frozen above the rest. */
  header: 2,
  /** Translation and Notes: UNLOCKED and shaded, so the shading IS the
   *  invitation — the one place the eye should land. */
  editable: 3,
  /** Key, Scene ID, hash: monospaced, so a mistyped id is visible. */
  mono: 4,
  /** The Read me's headings. */
  readmeHead: 5,
} as const;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="4">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
    <font><sz val="10"/><name val="Consolas"/></font>
    <font><b/><sz val="13"/><name val="Calibri"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1F2933"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF8E1"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left/><right/><top/><bottom style="thin"><color rgb="FFD0D5DB"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="6">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1" applyProtection="1">
      <alignment vertical="top" wrapText="1"/><protection locked="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1" applyProtection="1">
      <alignment vertical="center"/><protection locked="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyAlignment="1" applyProtection="1">
      <alignment vertical="top" wrapText="1"/><protection locked="0"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyAlignment="1" applyProtection="1">
      <alignment vertical="top"/><protection locked="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/** Which style a column's body cells take. */
function styleFor(column: number): number {
  if (EDITABLE_COLUMNS.includes(column)) return STYLE.editable;
  // Key (0), Scene ID (4) and Source hash (16) are machine strings a human
  // reads back character by character when something has gone wrong.
  if (column === 0 || column === 4 || column === 16) return STYLE.mono;
  return STYLE.cell;
}

/** An inline-string cell. */
function textCell(ref: string, style: number, value: string): string {
  if (!value) return `<c r="${ref}" s="${style}" t="inlineStr"><is><t/></is></c>`;
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${x(value)}</t></is></c>`;
}

/** The seventeen values of one row, before the formula column is spliced in. */
function valuesOf(row: SheetRow): string[] {
  return [
    row.key,
    row.ref,
    row.where,
    row.scene,
    row.sceneId,
    row.type,
    row.speaker,
    row.text,
    "", // Translation
    "", // Notes
    row.mentions,
    row.shownWhen,
    row.changes,
    row.after,
    row.voFile,
    "", // Chars — written as a formula below
    row.hash,
  ];
}

function linesSheet(sheet: SheetDocument): string {
  const lastColumn = columnName(SHEET_COLUMNS.length - 1);
  const lastRow = sheet.rows.length + 1;

  const cols = SHEET_COLUMNS.map(
    (column, index) =>
      `<col min="${index + 1}" max="${index + 1}" width="${column.width}" customWidth="1"/>`,
  ).join("");

  const header = SHEET_COLUMNS.map((column, index) =>
    textCell(`${columnName(index)}1`, STYLE.header, column.header),
  ).join("");

  const body = sheet.rows
    .map((row, i) => {
      const r = i + 2;
      const values = valuesOf(row);
      const cells = values
        .map((value, index) => {
          const ref = `${columnName(index)}${r}`;
          // Chars is a REAL FORMULA, not a number computed here. A
          // translator typing into I watches P change, and that is the
          // whole point of the column: a length budget you can see while
          // you are spending it. No cached <v>, so Excel and LibreOffice
          // both compute it on open — see fullCalcOnLoad in the workbook.
          if (index === 15) return `<c r="${ref}" s="${STYLE.cell}"><f>LEN(H${r})</f></c>`;
          return textCell(ref, styleFor(index), value);
        })
        .join("");
      // A fixed row height would clip a long line; letting Excel measure it
      // is what `wrapText` is for, so the height is deliberately unset.
      return `<row r="${r}">${cells}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr><outlinePr summaryBelow="1" summaryRight="1"/></sheetPr>
  <dimension ref="A1:${lastColumn}${lastRow}"/>
  <sheetViews>
    <sheetView tabSelected="1" workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
      <selection pane="bottomLeft" activeCell="I2" sqref="I2"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>${cols}</cols>
  <sheetData><row r="1" ht="22" customHeight="1">${header}</row>${body}</sheetData>
  <sheetProtection sheet="1" objects="1" scenarios="1" selectLockedCells="1" selectUnlockedCells="1" sort="0" autoFilter="0" formatColumns="0" formatRows="0"/>
  <autoFilter ref="A1:${lastColumn}${lastRow}"/>
</worksheet>`;
}

/**
 * The Read me.
 *
 * A second sheet rather than a block of notes above the table, because
 * anything above row 1 breaks the frozen header, the filter and every
 * "the header is row 1" assumption an importer makes.
 *
 * It carries a schema version and a fingerprint so a future importer can
 * refuse a sheet that belongs to another story, or to another version of
 * this one, instead of matching what it can and silently dropping the
 * rest. That is the same call the app made about save safety: notice the
 * conflict and say so.
 */
function readmeSheet(sheet: SheetDocument): string {
  const s = sheet.stats;
  const rows: [string, string][] = [
    ["Story", sheet.title],
    ["Language", sheet.language || "(not stated)"],
    ["Exported", sheet.generatedAt],
    ["Schema version", String(sheet.schemaVersion)],
    ["Story fingerprint", sheet.fingerprint],
    ["", ""],
    ["Rows", String(sheet.rows.length)],
    ["Scenes", `${s.scenes}${s.unreachableScenes ? ` (${s.unreachableScenes} unreachable)` : ""}`],
    ["Prose paragraphs", String(s.prose)],
    ["Choices", String(s.choices)],
    ["Dialogue lines", String(s.dialogue)],
    ["Replies", String(s.replies)],
    ["Speaking parts", String(s.speakers)],
    ["Rows naming a character or place", String(s.mentions)],
    ["Empty strings skipped", String(sheet.skippedEmpty)],
    ["", ""],
    ["How to use this", ""],
    ["Translation (column I)", "Type here. It is the only column you need."],
    ["Notes (column J)", "Anything you want to send back with it."],
    ["Everything else is locked", "So a sort can never shift one column out of step."],
    ["Key (column A)", "The line's identity. Never changes, never edit it."],
    ["Ref (column B)", "Where the line is: 15.D2 is scene 15, dialogue 2."],
    ["", "Recomputed every export — it moves when the story does."],
    ["Chars (column P)", "Counts column H as you type. A length budget you can see."],
    [
      "Source hash (column Q)",
      "If the English changes after this sheet went out, the hash changes with it.",
    ],
    ["Rows named U1, U2…", "Scenes nothing currently leads to. Still translated."],
  ];

  const body = rows
    .map(([name, value], i) => {
      const r = i + 2;
      const style = value === "" && name !== "" ? STYLE.readmeHead : STYLE.cell;
      return `<row r="${r}">${textCell(`A${r}`, style, name)}${textCell(`B${r}`, STYLE.cell, value)}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:B${rows.length + 1}"/>
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols><col min="1" max="1" width="32" customWidth="1"/><col min="2" max="2" width="70" customWidth="1"/></cols>
  <sheetData>
    <row r="1" ht="22" customHeight="1">${textCell("A1", STYLE.header, "Read me")}${textCell("B1", STYLE.header, "")}</row>
    ${body}
  </sheetData>
  <sheetProtection sheet="1" objects="1" scenarios="1"/>
</worksheet>`;
}

export async function buildSheetXlsx(sheet: SheetDocument): Promise<Buffer> {
  const zip = new JSZip();
  /**
   * A fixed timestamp on every entry rather than "now".
   *
   * Exporting the same story twice should give two identical files — it is
   * what lets a writer check whether a sheet is stale by comparing it
   * rather than by remembering. The zip's per-entry modification time is
   * the only thing that would otherwise differ, and it is per ENTRY, not a
   * generate option.
   */
  const at = new Date("2000-01-01T00:00:00Z");
  const put = (name: string, body: string): void => {
    // `createFolders: false` because JSZip otherwise adds an entry for
    // every directory in the path — `xl/`, `xl/worksheets/` — and stamps
    // each with the current time, which puts the clock back into a file
    // that is meant not to have one. A negative control found it: the
    // bytes still matched between two exports seconds apart, because DOS
    // timestamps have two-second resolution, and would have stopped
    // matching the moment somebody exported twice in one afternoon.
    // Nothing reads those entries either — an xlsx is addressed by part
    // name, not by walking folders.
    zip.file(name, body, { date: at, createFolders: false });
  };

  put(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`,
  );

  put(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
  );

  put(
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Lines" sheetId="1" r:id="rId1"/>
    <sheet name="Read me" sheetId="2" r:id="rId2"/>
  </sheets>
  <definedNames>
    <definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">Lines!$A$1:$${columnName(
      SHEET_COLUMNS.length - 1,
    )}$${sheet.rows.length + 1}</definedName>
  </definedNames>
  <calcPr calcId="0" fullCalcOnLoad="1"/>
</workbook>`,
  );

  put(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
  );

  put("xl/styles.xml", STYLES_XML);
  put("xl/worksheets/sheet1.xml", linesSheet(sheet));
  put("xl/worksheets/sheet2.xml", readmeSheet(sheet));

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}
