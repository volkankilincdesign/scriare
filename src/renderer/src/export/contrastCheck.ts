import type { ExportStory } from "./buildStory";
import type { ChoiceBox } from "../types/choiceStyles";
import { GROUND_PAGE_HEX, GROUND_TEXT_HEX, READING_GROUNDS } from "./readingThemes";
import type { ReadingGround } from "./readingThemes";

/**
 * The export-time contrast check (v0.48.0) — warns, never blocks.
 *
 * The problem it exists for is a direct consequence of the decision that
 * the export inherits the rich text editor's changes. A colour a writer
 * picks is CONTENT: it lives in the story, it travels into the export, and
 * it arrives unchanged. That is correct and is not up for negotiation. But
 * the colour was chosen while looking at one ground, and the exported page
 * has two — so a pale blue picked in the Dark theme lands on Paper as pale
 * blue on off-white, and a line of the story is gone.
 *
 * Three things this deliberately does NOT do:
 *
 *   It does not block. An unreadable colour can be the point — text meant
 *   to be missed, a choice meant to be nearly invisible until you look for
 *   it. A tool that refuses to export a writer's deliberate effect has
 *   stopped being a tool. So this produces a list and the writer decides.
 *
 *   It does not fix. Nothing here rewrites a colour, nudges one toward the
 *   threshold, or offers to. The story's colours are the story's.
 *
 *   It does not check what it cannot see. Only literal colours are
 *   measured. A `var(--…)` fill is a theme reference that resolves against
 *   whichever ground the reader chose and is correct by construction —
 *   that is the whole reason DEFAULT_CHOICE_BOX is written in variables.
 *
 * 4.5:1 is the WCAG AA threshold for body text. It is used here as the
 * line between "worth mentioning" and "not worth interrupting for", not as
 * a standard the export claims to meet — the story's own colours decide
 * that, and the writer decides the story's colours.
 */

export interface ContrastFinding {
  /** Which scene it is in, by title, so the writer can go and look. */
  scene: string;
  /** What it is, in the writer's words: `Choice "Take the lantern"`. */
  what: string;
  /** The ground it fails on. Something can fail on one and pass the other. */
  ground: ReadingGround;
  /** The measured ratio, for the writer to judge how bad it is. */
  ratio: number;
}

/* ── colour parsing ─────────────────────────────────────────────────── *
 * Only the two spellings that can actually reach here. Tiptap's Color and
 * Highlight extensions both write whatever `<input type="color">` produced,
 * which is always `#rrggbb`; `rgb()`/`rgba()` is handled because a project
 * file is editable text and someone will eventually put one there by hand.
 * Anything else parses to null and is skipped — an unrecognised colour is
 * a colour this cannot judge, and guessing would produce a warning about
 * nothing, which is worse than silence.
 * ------------------------------------------------------------------- */

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function parseColor(value: string | null | undefined): Rgba | null {
  if (!value) return null;
  const text = value.trim().toLowerCase();
  if (text.startsWith("var(") || text === "transparent" || text === "inherit") return null;

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(text);
  if (hex) {
    const d = hex[1];
    const wide = d.length <= 4 ? d.split("").map((c) => c + c).join("") : d;
    return {
      r: parseInt(wide.slice(0, 2), 16),
      g: parseInt(wide.slice(2, 4), 16),
      b: parseInt(wide.slice(4, 6), 16),
      a: wide.length === 8 ? parseInt(wide.slice(6, 8), 16) / 255 : 1,
    };
  }

  const fn = /^rgba?\(([^)]+)\)$/.exec(text);
  if (fn) {
    const parts = fn[1].split(/[,/\s]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const channel = (raw: string): number =>
      raw.endsWith("%") ? (parseFloat(raw) / 100) * 255 : parseFloat(raw);
    const r = channel(parts[0]);
    const g = channel(parts[1]);
    const b = channel(parts[2]);
    if ([r, g, b].some((n) => !Number.isFinite(n))) return null;
    const alphaRaw = parts[3];
    const a = alphaRaw === undefined
      ? 1
      : alphaRaw.endsWith("%")
        ? parseFloat(alphaRaw) / 100
        : parseFloat(alphaRaw);
    return { r, g, b, a: Number.isFinite(a) ? Math.min(1, Math.max(0, a)) : 1 };
  }

  return null;
}

/** A translucent colour is not a colour until you know what is behind it. */
function over(top: Rgba, bottom: Rgba): Rgba {
  const a = top.a;
  return {
    r: top.r * a + bottom.r * (1 - a),
    g: top.g * a + bottom.g * (1 - a),
    b: top.b * a + bottom.b * (1 - a),
    a: 1,
  };
}

function relativeLuminance(c: Rgba): number {
  const channel = (v: number): number => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

export function contrastRatio(a: Rgba, b: Rgba): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const THRESHOLD = 4.5;

/** Every `color:` and `background-color:` an inline style in this HTML sets,
 *  in document order. Regex rather than DOM parsing on purpose: this runs
 *  over every scene of a story that may be hundreds of scenes long, during
 *  a save dialog, and the input is HTML this app generated one function call
 *  ago — not arbitrary markup whose edge cases need a parser. */
function inlineColors(html: string): { color: string[]; background: string[] } {
  const color: string[] = [];
  const background: string[] = [];
  const styles = html.matchAll(/style="([^"]*)"/g);
  for (const [, body] of styles) {
    for (const [, value] of body.matchAll(/(?:^|;)\s*color\s*:\s*([^;]+)/g)) color.push(value.trim());
    for (const [, value] of body.matchAll(/background-color\s*:\s*([^;]+)/g)) {
      background.push(value.trim());
    }
  }
  return { color, background };
}

/** The label's plain text, for naming a choice in the warning. Long labels
 *  are cut at a word boundary — the writer needs to recognise it, not read
 *  it again. */
function labelSummary(html: string): string {
  const text = html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  if (text.length <= 42) return text || "an untitled choice";
  // Cut at a word boundary — unless there isn't one in the first 42
  // characters, in which case cutting there would leave nothing but an
  // ellipsis and the writer would have no idea which choice was meant.
  const trimmed = text.slice(0, 42).replace(/\s\S*$/, "");
  return `${trimmed || text.slice(0, 42)}…`;
}

/* ── one colour, read on both grounds (v0.58.0) ─────────────────────── *
 * The export's warning arrives at the door. This is the same question
 * asked at the moment a colour is chosen, and it lives HERE, beside
 * `checkStoryContrast`, running the same parse, the same compositing and
 * the same threshold — so the number in the picker and the number in the
 * export warning cannot disagree. Two implementations of one measurement
 * is the pair that drifts; there is one, and both read it.
 * ------------------------------------------------------------------- */

/** What the colour IS, which is what decides what it is measured against. */
export type ColorSubject =
  /** Text painted in this colour, on the page. */
  | { kind: "ink"; color: string }
  /** A highlight BEHIND text — so what is measured is the ground's own ink
   *  on this colour, not this colour on the page. */
  | { kind: "wash"; color: string }
  /** A choice box: the fill is what decides whether its label can be read.
   *  A null or `var(…)` fill still follows the ground and cannot be wrong. */
  | { kind: "box"; fill: string | null };

export interface GroundReading {
  ground: ReadingGround;
  label: string;
  /** null when there is nothing literal to measure — the colour follows the
   *  ground, which is correct by construction. */
  ratio: number | null;
  passes: boolean;
}

export const CONTRAST_THRESHOLD = THRESHOLD;

export function readColorOnGrounds(subject: ColorSubject): GroundReading[] {
  return READING_GROUNDS.map((ground) => {
    const page = parseColor(GROUND_PAGE_HEX[ground.id]);
    const ink = parseColor(GROUND_TEXT_HEX[ground.id]);
    const picked = parseColor(subject.kind === "box" ? subject.fill : subject.color);

    let ratio: number | null = null;
    if (page && ink && picked) {
      // Composited exactly the way checkStoryContrast composites them,
      // translucency included: a highlight and a choice fill both put
      // themselves between the page and the text, and ink does not.
      const backdrop = subject.kind === "ink" ? page : over(picked, page);
      const foreground = subject.kind === "ink" ? picked : ink;
      ratio = contrastRatio(over(foreground, backdrop), backdrop);
    }

    return {
      ground: ground.id,
      label: ground.label,
      ratio,
      // Nothing to measure reads as fine, because it IS fine: a colour that
      // follows the ground resolves against whichever one the reader chose.
      passes: ratio === null || ratio >= THRESHOLD,
    };
  });
}

/**
 * The worst contrast a label reaches inside its own box, or null when the
 * box has no literal fill to be wrong about.
 *
 * Factored out in v0.66.0 when the Dialogue arrived: its lines are painted
 * exactly as choices are, and two copies of this arithmetic would be two
 * places for the next fix to miss.
 */
function worstOnBox(
  label: string,
  box: ChoiceBox,
  page: Rgba,
  defaultText: Rgba,
): number | null {
  const fill = parseColor(box.fill);
  // A variable fill resolves against this ground and is fine by
  // construction. Only a literal one can be wrong.
  if (!fill) return null;
  const solid = over(fill, page);
  // The label is painted in --text unless the writer coloured it
  // themselves, in which case THAT is the foreground that matters.
  const labelColors = inlineColors(label).color
    .map(parseColor)
    .filter((c): c is Rgba => c !== null);
  const foregrounds = labelColors.length > 0 ? labelColors : [defaultText];
  return Math.min(...foregrounds.map((fg) => contrastRatio(over(fg, solid), solid)));
}

export function checkStoryContrast(story: ExportStory): ContrastFinding[] {
  const findings: ContrastFinding[] = [];

  for (const ground of READING_GROUNDS) {
    const page = parseColor(GROUND_PAGE_HEX[ground.id]);
    const defaultText = parseColor(GROUND_TEXT_HEX[ground.id]);
    if (!page || !defaultText) continue;

    for (const scene of story.scenes) {
      for (const segment of scene.seg) {
        if (segment.k === "c") {
          for (const choice of segment.o) {
            const worst = worstOnBox(choice.l, choice.b, page, defaultText);
            if (worst !== null && worst < THRESHOLD) {
              findings.push({
                scene: scene.title,
                what: `Choice “${labelSummary(choice.l)}”`,
                ground: ground.id,
                ratio: worst,
              });
            }
          }
          continue;
        }

        // v0.66.0 — a Dialogue's lines are checked as choices are, because
        // on the page they are the same thing: a box of text the writer
        // may have coloured by hand. The reply is not checked: it is a
        // flat string and carries no colour of its own by construction.
        if (segment.k === "d") {
          for (const line of segment.o) {
            const worst = worstOnBox(line.l, line.b, page, defaultText);
            if (worst !== null && worst < THRESHOLD) {
              findings.push({
                scene: scene.title,
                what: `Dialogue line “${labelSummary(line.l)}”`,
                ground: ground.id,
                ratio: worst,
              });
            }
          }
          continue;
        }

        // Prose, and the prose inside a conditional block — both are text on
        // the page, and both can carry a colour the writer set by hand.
        const { color, background } = inlineColors(segment.h);
        // A highlight mark is the only thing that puts a backdrop between
        // the text and the page. First one wins: a segment with two
        // different highlights is measuring an approximation either way, and
        // the point is to raise a flag, not to render the paragraph twice.
        const highlight = background.length > 0 ? parseColor(background[0]) : null;
        const backdrop = highlight ? over(highlight, page) : page;

        let worst = Number.POSITIVE_INFINITY;
        for (const raw of color) {
          const fg = parseColor(raw);
          if (!fg) continue;
          worst = Math.min(worst, contrastRatio(over(fg, backdrop), backdrop));
        }
        if (worst < THRESHOLD) {
          findings.push({
            scene: scene.title,
            what: "Coloured text",
            ground: ground.id,
            ratio: worst,
          });
        }
      }
    }
  }

  // One row per thing per ground, keeping the worst. A scene whose every
  // paragraph carries the same bad colour is ONE problem with one fix, and
  // listing it eleven times would push everything else out of the dialog —
  // at which point the writer learns to scroll past the warnings, which is
  // the same as not having them.
  const worst = new Map<string, ContrastFinding>();
  for (const finding of findings) {
    const key = `${finding.scene}\u0000${finding.what}\u0000${finding.ground}`;
    const existing = worst.get(key);
    if (!existing || finding.ratio < existing.ratio) worst.set(key, finding);
  }

  // Sorted worst-first: a writer scanning this list wants the thing that
  // vanished before the thing that merely dimmed.
  return [...worst.values()].sort((a, b) => a.ratio - b.ratio);
}
