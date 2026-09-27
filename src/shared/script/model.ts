/**
 * The script, as a shape both renderers read (v0.64.0).
 *
 * Script Export writes two formats and offers two layouts, which is four
 * ways to get the same story onto a page — and four chances for them to
 * disagree about what the story says. So the story is turned into THIS
 * once, by one walk of the project, and after that nothing looks at a
 * Tiptap document again: the HTML renderer and the DOCX renderer are two
 * ways of typesetting the same object.
 *
 * That is the same rule the grounds, the contrast reading and the word
 * count are already under. It matters more here than it did there, because
 * a PDF and a Word file of the same script that differ by one line is the
 * kind of bug nobody finds until somebody records the wrong take.
 *
 * Everything in here is plain JSON: the model crosses IPC to the main
 * process, which is where the DOCX is actually built.
 */

/** Which of the two page layouts (board K, 27 Sep). */
export type ScriptLayout = "screenplay" | "production";
export type ScriptFormat = "pdf" | "docx";

export interface ScriptLine {
  /**
   * Stable WITHIN a scene: "1", "2", "C1". Printed in the production
   * layout, where a VO director reads it into a session and an
   * implementer reads it into the engine — which only works if adding a
   * line to scene 4 does not renumber scene 19.
   */
  ref: string;
  speaker: string | null;
  text: string;
}

export interface ScriptChoice {
  ref: string;
  text: string;
  /** Null when the option has no destination yet. */
  target: { n: number; title: string } | null;
  conditions: string[];
  actions: string[];
  /**
   * "lock" is shown to the player greyed out; "hide" is never shown at
   * all. Both print, and the difference is stated — a hidden line still
   * has to be translated and still has to be recorded, and leaving lines
   * out of a script is how lines go unrecorded.
   */
  unmet: "hide" | "lock";
}

/** One thing that can be said in a conversation (v0.66.0). */
export interface ScriptDialogueLine {
  ref: string;
  speaker: string | null;
  text: string;
  reply: string;
  replySpeaker: string | null;
  /** "stay" | "end" | "leave", in words a reader of paper understands. */
  after: string;
  target: { n: number; title: string } | null;
  repeatable: boolean;
  conditions: string[];
  actions: string[];
  unmet: "hide" | "lock";
}

export type ScriptBlock =
  | { kind: "line"; line: ScriptLine }
  | { kind: "gate"; conditions: string[]; lines: ScriptLine[] }
  | { kind: "choices"; options: ScriptChoice[] }
  /**
   * v0.66.0 — a conversation is not a branch, so it is not printed as one.
   * Its own kind rather than a flag on `choices`, for the same reason the
   * node type is its own: every renderer has to be able to tell a door out
   * of the scene from a thing said inside it.
   */
  | { kind: "dialogue"; lines: ScriptDialogueLine[] };

export interface ScriptScene {
  id: string;
  /** Its number in the printed script, which is its place in the tree. */
  n: number;
  title: string;
  /** From the first location mentioned in the scene, or null. */
  location: string | null;
  blocks: ScriptBlock[];
  /**
   * Whether this scene is short enough to be worth keeping on one page.
   * Decided at build time rather than in CSS, because the DOCX renderer
   * has no equivalent of `break-inside: avoid` for an arbitrary run of
   * paragraphs and has to say "keep with next" on each one instead.
   */
  keepWhole: boolean;
}

export interface ScriptChapter {
  id: string;
  name: string;
  scenes: ScriptScene[];
}

export interface ScriptDocument {
  title: string;
  layout: ScriptLayout;
  /** The dialog's checkbox. Off prints prose and choices and nothing else. */
  showConditions: boolean;
  generatedAt: string;
  /** Characters with at least one line, most spoken first. */
  cast: { name: string; lines: number }[];
  chapters: ScriptChapter[];
  stats: { scenes: number; lines: number; choices: number; endings: number };
}

// ── how a condition and an action are PHRASED ───────────────────────────
// Here rather than in either renderer, because "resolve ≥ 3" in the PDF
// and "resolve gte 3" in the Word file would be the two documents
// disagreeing about the story in the one place a reader cannot check.

const COMPARATOR_WORDS: Record<string, string> = {
  eq: "is",
  neq: "is not",
  gt: "is more than",
  gte: "is at least",
  lt: "is less than",
  lte: "is at most",
};

const OPERATION_WORDS: Record<string, string> = {
  set: "=",
  add: "+",
  subtract: "−",
};

export function conditionPhrase(
  name: string,
  comparator: string,
  value: unknown,
  negate?: boolean,
): string {
  const word = COMPARATOR_WORDS[comparator] ?? comparator;
  return `${name} ${negate ? "not " : ""}${word} ${String(value)}`;
}

export function actionPhrase(name: string, operation: string, value: unknown): string {
  if (operation === "toggle") return `toggle ${name}`;
  if (operation === "set") return `${name} = ${String(value)}`;
  return `${name} ${OPERATION_WORDS[operation] ?? operation}${String(value)}`;
}

/** The file name offered in the save dialog. */
export function suggestedScriptName(title: string, layout: ScriptLayout): string {
  const safe = (title || "Untitled Story").replace(/[\\/:*?"<>|]/g, "").trim() || "Untitled Story";
  return `${safe} — ${layout === "screenplay" ? "Script" : "Production Script"}`;
}
