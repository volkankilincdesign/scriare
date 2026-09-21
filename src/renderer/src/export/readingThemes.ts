/**
 * The two reading grounds an exported story ships with (v0.48.0).
 *
 * WHY THESE ARE NOT THE APP'S EIGHT THEMES. A theme in styles/themes.css is
 * chrome: forty-seven tokens tuned for a room with panels, borders, a
 * docked graph and three levels of text hierarchy — "a theme tints the
 * room, not the content", as that file puts it. An exported page has no
 * room. It is one column of prose on a ground, and most of those tokens
 * have no referent in it. Shipping the writer's editor theme would mean
 * publishing whatever they happened to find restful at 2am during a
 * four-hour session, to a stranger reading on a phone at lunchtime. Those
 * are different jobs, and Phosphor — a good editor theme — is a punishing
 * one to read a chapter in.
 *
 * So the export gets two grounds of its own, built for reading rather than
 * for sitting beside panels:
 *
 *   Paper  — warm off-white. Deliberately NOT the Light theme's sheet,
 *            which is near-white because it has to out-bright a desk; a
 *            page with no desk around it only needs to stop glaring.
 *   Night  — lifted off black. The Dark theme's ground is 9.5% because
 *            panels sit above it; a reading page has nothing above it, and
 *            white text on near-black at 15:1 halates badly on an OLED
 *            phone. 18.5% and a body text pulled down to 84% puts the body
 *            contrast at 11.4:1, which is a long-read number rather than a
 *            specification-sheet one.
 *
 * WHY THE TOKEN NAMES ARE THE APP'S. Every name below already exists in
 * themes.css and is already used by the runtime. That is the whole point:
 * a Choice Style that was never given a colour resolves to
 * `var(--surface-2-translucent)` and `var(--border)` (see
 * types/choiceStyles.ts), so it lands in the export already knowing how to
 * follow whichever ground the reader picked — without the export having to
 * special-case it, and without a second set of names for the CSS tab to
 * learn later.
 *
 * MEASURED, NOT EYEBALLED. Every pair below was run through WCAG contrast
 * and every border through an OKLab lightness gap before it shipped, and
 * the first pass FAILED: Night's --text-3 came in at 4.37:1 against the
 * choice fill, which is the text that carries a locked choice's reason —
 * the one thing a locked choice exists to tell the reader. The whole ramp
 * was lifted rather than that one token nudged over the line, because a
 * value chosen to just pass a threshold is a value that will fail the next
 * time anything around it moves.
 */

export type ReadingGround = "paper" | "night";

export interface ReadingGroundMeta {
  id: ReadingGround;
  label: string;
  /** The ground's own page colour, for the export dialog's preview swatch. */
  swatch: string;
}

export const READING_GROUNDS: ReadingGroundMeta[] = [
  { id: "night", label: "Night", swatch: "oklch(18.5% 0.009 75)" },
  { id: "paper", label: "Paper", swatch: "oklch(97.5% 0.007 85)" },
];

/**
 * The default a freshly exported story opens on.
 *
 * Night rather than "whatever the reader's device says". Following
 * `prefers-color-scheme` sounds more considerate and is, in practice, a way
 * of not deciding: the writer never knows what a stranger sees first, and
 * the first screen is the one a portfolio reader judges. The reader is one
 * click from Paper and their choice is remembered, so nothing is taken away
 * — the default only settles what the story looks like before anyone has an
 * opinion about it.
 */
export const DEFAULT_GROUND: ReadingGround = "night";

/**
 * The tokens each ground defines, as CSS text. Written as a literal table
 * rather than generated, because a reading ground is nine decisions that
 * want to be read side by side and argued with — the same reason themes.css
 * is a literal table.
 *
 * `--highlight` is the one token here that themes.css does not have: the
 * editor draws Tiptap's Highlight mark with its own default yellow, which
 * is fine on a panel and wrong on a page. Naming it means the future CSS
 * tab can change it like anything else.
 */
export const GROUND_TOKENS: Record<ReadingGround, string> = {
  paper: `
    --bg:                    oklch(93%   0.008 85);
    --page:                  oklch(97.5% 0.007 85);
    --text:                  oklch(22%   0.012 60);
    --text-reading:          oklch(27%   0.012 60);
    --text-2:                oklch(42%   0.010 60);
    --text-3:                oklch(52%   0.009 60);
    --accent:                oklch(43%   0.050 45);
    --accent-soft:           oklch(43%   0.050 45 / 0.10);
    --surface-2:             oklch(94.5% 0.008 85);
    --surface-2-translucent: oklch(90%   0.010 85 / 0.55);
    --surface-2-faint:       oklch(90%   0.010 85 / 0.22);
    --border-soft:           oklch(89%   0.009 85);
    --border:                oklch(82%   0.011 85);
    --border-faint:          oklch(73%   0.013 85);
    --highlight:             oklch(92%   0.105 95);
    --sheet-shadow: 0 1px 2px oklch(20% 0.02 70 / .07), 0 12px 32px -12px oklch(20% 0.02 70 / .18);
  `,
  night: `
    --bg:                    oklch(14.5% 0.008 75);
    --page:                  oklch(18.5% 0.009 75);
    --text:                  oklch(92%   0.006 75);
    --text-reading:          oklch(84%   0.007 75);
    --text-2:                oklch(70%   0.008 75);
    --text-3:                oklch(62%   0.009 75);
    --accent:                oklch(79%   0.050 70);
    --accent-soft:           oklch(79%   0.050 70 / 0.13);
    --surface-2:             oklch(22.5% 0.010 75);
    --surface-2-translucent: oklch(25%   0.011 75 / 0.55);
    --surface-2-faint:       oklch(25%   0.011 75 / 0.22);
    --border-soft:           oklch(24.5% 0.010 75);
    --border:                oklch(30.5% 0.011 75);
    --border-faint:          oklch(38.5% 0.013 75);
    --highlight:             oklch(46%   0.080 95);
    --sheet-shadow: 0 2px 6px oklch(0% 0 0 / .5), 0 18px 44px -14px oklch(0% 0 0 / .6);
  `,
};

/**
 * The page colour of each ground as a plain sRGB hex.
 *
 * The contrast check needs a number, and `oklch()` in a stylesheet is not
 * one — nothing can compare a writer's `#b4cde8` against a string. These
 * are the computed values of the `--page` tokens above; they exist ONLY for
 * that comparison, and the stylesheet keeps the oklch so a later tweak
 * stays in one perceptual space. A test asserts the two agree, because two
 * spellings of the same colour is exactly the kind of pair that drifts.
 */
export const GROUND_PAGE_HEX: Record<ReadingGround, string> = {
  paper: "#f9f6f2",
  night: "#15120e",
};

/** `--text` as sRGB, for the same reason — it is what a choice's label is
 *  painted in when the writer has not coloured the label themselves, so it
 *  is the foreground the check measures a custom fill against. */
export const GROUND_TEXT_HEX: Record<ReadingGround, string> = {
  paper: "#1f1915",
  night: "#e7e4e0",
};
