import { GROUND_TOKENS } from "./readingThemes";

/**
 * What a writer's stylesheet is about to cost them (v0.80.0).
 *
 * Read in two places and written once: the stylesheet editor, where a
 * writer finds out while they are typing, and the Export dialog, where it
 * decides whether the Export button is available at all. Two copies of
 * this would be two different opinions about the same CSS, and the one in
 * the dialog would be the one that mattered.
 *
 * NOTHING HERE PARSES CSS. There is no CSS parser in this app and adding
 * one to find two patterns would be a dependency shipped for a regex's
 * worth of work. What that costs is precision at the edges: a `url(` inside
 * a comment counts, and a very unusual spelling might not. Both errors are
 * in the direction of TELLING THE WRITER SOMETHING TRUE ABOUT THEIR FILE —
 * a false positive is a sentence they can read and dismiss, where a false
 * negative would be a page that quietly phones home.
 */

/** Every token a reading ground defines, collected from the grounds themselves. */
function groundTokenNames(): string[] {
  const names = new Set<string>();
  for (const block of Object.values(GROUND_TOKENS)) {
    for (const match of block.matchAll(/(--[a-z0-9-]+)\s*:/gi)) names.add(match[1]);
  }
  return [...names];
}

/**
 * Anything in the stylesheet that would make the exported page fetch
 * something.
 *
 * This is the one promise in the README a stylesheet can break: "one file,
 * no requests — it works offline, from a folder or a USB stick, and nobody
 * learns who read it." A single webfont `@import` turns that sentence into
 * a false claim, and the reader's browser tells a third party every time
 * the story is opened. So the export names each one and will not go ahead
 * until the writer has said they meant it.
 *
 * `data:` URIs are deliberately NOT counted. They fetch nothing — an
 * inlined image or font is still one file — and counting them would train
 * a writer to tick past the warning that matters.
 */
export function remoteFetches(css: string | undefined | null): string[] {
  if (!css) return [];

  // KEYED ON THE TARGET, not on the spelling. `@import url("…")` matches
  // both patterns below, and the first version of this counted it twice —
  // caught by the test, which expected two things and was told three. A
  // writer asked to confirm "3 things" that are two is being asked to
  // confirm something untrue, in the one dialog whose whole job is telling
  // them the truth about their file.
  const byTarget = new Map<string, string>();

  for (const match of css.matchAll(/@import\s+(?:url\(\s*)?["']?([^"')\s;]+)/gi)) {
    const target = match[1].trim();
    if (!/^data:/i.test(target)) byTarget.set(target, `@import ${target}`);
  }
  for (const match of css.matchAll(/url\(\s*["']?([^"')]+)/gi)) {
    const target = match[1].trim();
    // Relative paths are left alone: they point at a file beside the
    // exported page, which the writer put there on purpose and which no
    // third party sees. Only a scheme or a protocol-relative host reaches
    // the network. An @import already recorded keeps its own wording,
    // which is the more useful of the two.
    if (/^(https?:)?\/\//i.test(target) && !byTarget.has(target)) {
      byTarget.set(target, `url(${target})`);
    }
  }

  return [...byTarget.values()];
}

/**
 * Ground tokens the stylesheet redefines.
 *
 * Not a warning — overriding `--page` is one of the most reasonable things
 * a writer can do with this feature, and it is the single cheapest way to
 * restyle a whole story. It matters because the CONTRAST CHECK reads the
 * grounds' own values: once a token is overridden, those findings describe
 * a page that is not the one being shipped. The dialog says so rather than
 * printing numbers it can no longer stand behind.
 */
export function overriddenGroundTokens(css: string | undefined | null): string[] {
  if (!css) return [];
  const known = groundTokenNames();
  const found = new Set<string>();
  for (const match of css.matchAll(/(--[a-z0-9-]+)\s*:/gi)) {
    if (known.includes(match[1])) found.add(match[1]);
  }
  return [...found];
}

/**
 * The hooks a stylesheet can target, and where each one is real.
 *
 * `inPlay: false` is the honest half. docs/export.md has claimed since
 * v0.48.0 that these names are the same in the editor, in Play Mode and in
 * the export; three of them never were, and v0.80.0 added the ones it
 * could. `.scriare-page`, `.scriare-bar` and `.scriare-resume` are still
 * export-only, because Play Mode draws no sheet, has the app's own bar,
 * and never offers to resume — so a writer styling them sees nothing in
 * the preview and something in the file. Saying which is which costs one
 * column and saves an hour of doubting the feature.
 */
export interface StyleHook {
  selector: string;
  what: string;
  inPlay: boolean;
}

export const STYLE_HOOKS: StyleHook[] = [
  { selector: ".scriare-page", what: "the sheet a scene is printed on", inPlay: false },
  { selector: ".scriare-scene", what: "the scene wrapper", inPlay: true },
  { selector: ".scriare-scene-title", what: "the scene's title", inPlay: true },
  { selector: ".scriare-prose", what: "a run of ordinary content", inPlay: true },
  { selector: ".scriare-speaker", what: "a speaker's name, as prose", inPlay: true },
  { selector: ".scriare-mention", what: "a mention", inPlay: true },
  { selector: '[data-type="callout"]', what: "a callout block", inPlay: true },
  { selector: ".scriare-choices", what: "the column of choices", inPlay: true },
  { selector: ".scriare-choice", what: "one choice", inPlay: true },
  { selector: ".scriare-choice.is-locked", what: "a choice whose conditions failed", inPlay: true },
  { selector: ".scriare-lock-why", what: "the reason it is locked", inPlay: false },
  { selector: ".scriare-ending", what: "the last screen", inPlay: true },
  { selector: ".scriare-bar", what: "Back / Restart / ground switch", inPlay: false },
  { selector: ".scriare-resume", what: "the “you were partway through” offer", inPlay: false },
];
