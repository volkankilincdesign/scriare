/**
 * The spreadsheet, as a shape both writers read (v0.70.0).
 *
 * Same rule as the script model, for the same reason: the story is walked
 * into THIS once, and after that neither the xlsx writer nor the CSV
 * writer looks at a Tiptap document again. An xlsx and a CSV of one story
 * that disagree by a line is the bug nobody finds until a translator has
 * worked a week in the wrong file.
 *
 * Everything here is plain JSON — the model crosses IPC to the main
 * process, which is where both files are actually written.
 *
 * The design this implements is `docs/spreadsheet-export.md`, settled with
 * Volkan in one pass. The short version of the part that governs this
 * file: a row's identity is the app's own id, its ADDRESS is recomputed on
 * every export, and the two are different columns because one must never
 * change and the other must change the moment the story does.
 */

/** The kinds of string a reader can see. One letter each in a Ref. */
export type SheetRowType =
  | "Scene"
  | "Text"
  | "Choice"
  | "Dialogue"
  | "Reply"
  /**
   * v0.72.0 — a variable's reader-facing name. It reaches a player through
   * a locked option's "Requires The Roster", so it is a string somebody
   * reads and therefore a string somebody translates.
   */
  | "Variable"
  /** v0.72.0 — a locked option's own sentence, written by the writer. */
  | "Reason";

/** The letter each kind takes inside a Ref: `15.D2`, `15.T4`. */
export const TYPE_LETTER: Record<SheetRowType, string> = {
  Scene: "S",
  Text: "T",
  Choice: "C",
  Dialogue: "D",
  Reply: "D",
  // A Reason has no letter of its own: its ref hangs off the option it
  // belongs to, the way a reply's does — `15.C2w`. Deleting the choice
  // takes the reason's address with it rather than leaving a stray number.
  Reason: "",
  Variable: "V",
};

export interface SheetRow {
  /**
   * Column A. The app's own id for this string, and the CSV's RowName.
   *
   * Opaque, from the file, never edited, and — since v0.69.0 — actually
   * unique across the project. It is what makes "this is the same line I
   * sent you last week" answerable after the story has been rearranged.
   */
  key: string;
  /** Column B. The address: `15.D2`. Recomputed every export, never stored. */
  ref: string;
  /** Column C. The same thing as a sentence: `15 · The Big Table · dialogue 2`. */
  where: string;
  /** Column D. The scene's title, as the writer typed it. */
  scene: string;
  /** Column E. The scene's own opaque id — the Key's argument, one level up. */
  sceneId: string;
  /** Column F. The VO filter. */
  type: SheetRowType;
  /** Column G. A resolved name, "You (the player)", or empty for narration. */
  speaker: string;
  /** Column H. The source string. */
  text: string;
  /** Column K. Entities named inside the text, comma separated. */
  mentions: string;
  /** Column L. Conditions in words. */
  shownWhen: string;
  /** Column M. Variable changes in words. */
  changes: string;
  /** Column N. `stays`, `ends`, `↪ 12 The Yard`. Dialogue lines only. */
  after: string;
  /** Column O. `s15_d02_nesrin.wav`, generated. Empty for a scene title. */
  voFile: string;
  /** Column Q. A short hash of the text, so a stale translation is findable. */
  hash: string;
}

export interface SheetDocument {
  /** The story's name, for the file name and the Read me. */
  title: string;
  /** What the translator is translating INTO. Empty when unstated. */
  language: string;
  generatedAt: string;
  /**
   * Bumped when the meaning of a column changes, so a future importer can
   * refuse a sheet it does not understand rather than misreading it.
   */
  schemaVersion: number;
  /**
   * A hash over every key and every source string, in order. Two sheets
   * with the same fingerprint describe the same story text; a different
   * one means the story moved underneath the translation.
   */
  fingerprint: string;
  rows: SheetRow[];
  /**
   * Strings that were empty and therefore have no row. Counted rather than
   * silently dropped: an omission a translator cannot see is the kind of
   * thing that turns into "why is line 40 missing" three weeks later.
   */
  skippedEmpty: number;
  stats: {
    scenes: number;
    unreachableScenes: number;
    prose: number;
    choices: number;
    dialogue: number;
    replies: number;
    speakers: number;
    mentions: number;
    /** v0.72.0 — locked options carrying a sentence the writer wrote. */
    reasons: number;
    /** v0.72.0 — variables with a name a reader is allowed to see. */
    variableNames: number;
  };
}

/** The seventeen columns, in order, with the headers the sheet prints. */
export const SHEET_COLUMNS: { header: string; width: number }[] = [
  { header: "Key", width: 27 },
  { header: "Ref", width: 10 },
  { header: "Where", width: 34 },
  { header: "Scene", width: 22 },
  { header: "Scene ID", width: 15 },
  { header: "Type", width: 11 },
  { header: "Speaker", width: 19 },
  { header: "Text", width: 62 },
  { header: "Translation", width: 62 },
  { header: "Notes", width: 26 },
  { header: "Mentions", width: 18 },
  { header: "Shown when", width: 26 },
  { header: "Changes", width: 22 },
  { header: "After", width: 18 },
  { header: "VO file", width: 24 },
  { header: "Chars", width: 8 },
  { header: "Source hash", width: 13 },
];

/** Zero-based indices of the two columns a translator may edit. */
export const EDITABLE_COLUMNS = [8, 9];

/**
 * What the CSV carries, by column index into SHEET_COLUMNS.
 *
 * A LEAN FIXED SUBSET, and deliberately not the seventeen. Unreal compiles
 * a DataTable against a struct: every column is a field somebody has to
 * declare, and seventeen fields to get at six is a chore repeated in every
 * project that imports one of these. The xlsx is the translator's document
 * and keeps everything; the CSV is the engine's and keeps what an engine
 * reads.
 */
export const CSV_COLUMNS = [0, 1, 5, 6, 7, 8];

/**
 * A short, stable hash. FNV-1a, base36, eight characters.
 *
 * Not a cryptographic one and not trying to be: the job is "has this
 * string changed since the sheet went out", where a collision costs one
 * missed staleness warning and the alternative — shipping a hash function
 * from a package into both the renderer and the main process — costs a
 * dependency. Written here once so the xlsx, the CSV and any future
 * importer cannot disagree about what the hash of a line is.
 */
export function shortHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    // The FNV prime, by shifts — a plain `* 16777619` overflows into
    // floating point and stops being the same function on long strings.
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return (hash >>> 0).toString(36).padStart(7, "0").slice(0, 8);
}

/** A name safe to put in a file name, and recognisable in a VO folder. */
export function slug(text: string): string {
  return (
    text
      .toLocaleLowerCase("en")
      // Turkish and the rest of Latin-1 fold to their bare letters rather
      // than vanishing: a folder of `s15_d02_.wav` is not a VO manifest.
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/ı/g, "i")
      .replace(/ş/g, "s")
      .replace(/ğ/g, "g")
      .replace(/ç/g, "c")
      .replace(/ö/g, "o")
      .replace(/ü/g, "u")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 24) || "x"
  );
}

/** The file name offered in the save dialog, without an extension. */
export function suggestedSheetName(title: string, language: string): string {
  const safe = (title || "Untitled Story").replace(/[\\/:*?"<>|]/g, "").trim() || "Untitled Story";
  const tongue = language.replace(/[\\/:*?"<>|]/g, "").trim();
  return tongue ? `${safe} — Lines (${tongue})` : `${safe} — Lines`;
}
