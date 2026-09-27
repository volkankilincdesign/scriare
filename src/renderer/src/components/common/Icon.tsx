/**
 * The app's icon set (v0.24.0).
 *
 * These replace the emoji that previously marked content categories and
 * tree rows. Emoji are the wrong material for this interface for two
 * reasons: they arrive in full colour, which fights a deliberately
 * monochrome chrome and competes with the colour the writer assigns to
 * their own content; and they're drawn by the operating system, so the
 * same row renders in a different illustrative style on Windows, macOS
 * and Linux — the one part of the UI whose look the app doesn't control.
 *
 * Every icon here is a single stroked path on a 16-unit grid, inheriting
 * `currentColor` and sized by the caller, so they take the text colour of
 * whatever row they sit in and shift with the theme for free.
 */
interface IconProps {
  name: IconName;
  className?: string;
}

export type IconName =
  | "story"
  | "character"
  | "location"
  | "note"
  | "asset"
  | "folder"
  | "scene"
  | "undo"
  | "redo"
  // v0.33.0 — the editor toolbar. Until this version the toolbar was
  // drawn in plain characters (H1, •, ⟸, ⌫) while the rest of the app
  // spoke in these stroked icons, which is most of why it read as a
  // different piece of software bolted to the top of the page.
  | "heading1"
  | "heading2"
  | "bulletList"
  | "orderedList"
  | "quote"
  | "rule"
  | "alignLeft"
  | "alignCenter"
  | "alignRight"
  | "alignJustify"
  | "fontFamily"
  | "fontSize"
  | "textColor"
  | "highlight"
  | "colorReset"
  | "clearFormat"
  | "branch"
  // v0.66.1 — the Dialogue's own mark in the toolbar. A branch says the
  // scene splits; this one has to say the opposite, that the talking
  // happens here and the page stays put.
  | "dialogue"
  | "plus"
  | "properties";

const PATHS: Record<IconName, JSX.Element> = {
  // An open book — the Story root.
  story: (
    <>
      <path d="M8 4.2c-1.3-.9-2.9-1.3-4.5-1.2a.6.6 0 0 0-.5.6v7.6c0 .35.3.62.65.6 1.5-.1 3 .3 4.35 1.2" />
      <path d="M8 4.2c1.3-.9 2.9-1.3 4.5-1.2a.6.6 0 0 1 .5.6v7.6a.6.6 0 0 1-.65.6c-1.5-.1-3 .3-4.35 1.2" />
      <path d="M8 4.2V13" />
    </>
  ),
  // A head and shoulders.
  character: (
    <>
      <circle cx="8" cy="6" r="2.6" />
      <path d="M3.4 13.2a4.9 4.9 0 0 1 9.2 0" />
    </>
  ),
  // A map pin.
  location: (
    <>
      <path d="M8 2.8c2.2 0 4 1.75 4 3.9 0 2.85-4 6.5-4 6.5s-4-3.65-4-6.5c0-2.15 1.8-3.9 4-3.9Z" />
      <circle cx="8" cy="6.6" r="1.4" />
    </>
  ),
  // A page with ruled lines.
  note: (
    <>
      <path d="M4 2.9h5.2L12 5.7v7.4H4Z" />
      <path d="M9.1 2.9v2.9H12" />
      <path d="M6 9h4M6 11h2.6" />
    </>
  ),
  // Image frame with a horizon.
  asset: (
    <>
      <rect x="3" y="3.6" width="10" height="8.8" rx="1.3" />
      <path d="M3.4 10.4 6 8.2l2.2 1.9 2-1.7 2.4 2" />
      <circle cx="6.2" cy="6.3" r=".9" />
    </>
  ),
  folder: <path d="M2.9 12.4V4.5c0-.35.28-.63.63-.63h2.3l1.4 1.5h4.25c.35 0 .62.28.62.63v6.4c0 .35-.27.63-.62.63H3.53a.63.63 0 0 1-.63-.63Z" />,
  // A document, deliberately plainer than the Notes icon so a scene row
  // and a notes category never read as the same thing.
  scene: (
    <>
      <path d="M4.2 2.9h4.9L11.8 5.6v7.5H4.2Z" />
      <path d="M9 2.9v2.8h2.8" />
    </>
  ),
  // An arrow curving back on itself. Mirrored for redo rather than drawn
  // twice, so the pair can never drift apart visually.
  undo: (
    <>
      <path d="M3.2 6.4h6.1a3.4 3.4 0 0 1 0 6.8H6.2" />
      <path d="M5.7 3.9 3.2 6.4l2.5 2.5" />
    </>
  ),
  redo: (
    <>
      <path d="M12.8 6.4H6.7a3.4 3.4 0 0 0 0 6.8h3.1" />
      <path d="M10.3 3.9l2.5 2.5-2.5 2.5" />
    </>
  ),

  /* ── Toolbar (v0.33.0) ───────────────────────────────────────────────
   * Same grid, same stroke, same joins as everything above. Two rules
   * hold the set together: an icon that acts on TEXT carries a letterform
   * (the headings, the two font pickers, the colour control), and an icon
   * that acts on a BLOCK is drawn as the shape of that block (lists, the
   * quote, the rule, the alignments). So the bar reads in two registers
   * that match what the controls actually do.
   */

  // "H" with a numeral, rather than an H of a different size — the level
  // is the information, and drawing it as scale means H1 and H2 differ by
  // a few pixels and nothing else.
  heading1: (
    <>
      <path d="M3 3.6v8.8M8.4 3.6v8.8M3 8h5.4" />
      <path d="M11 6.4l1.8-1v7" />
    </>
  ),
  heading2: (
    <>
      <path d="M3 3.6v8.8M8.4 3.6v8.8M3 8h5.4" />
      <path d="M10.8 6.2a1.6 1.6 0 0 1 2.7 1.1c0 1.4-2.7 2.4-2.7 4.1h2.8" />
    </>
  ),
  bulletList: (
    <>
      {/* Filled, not stroked: a 1.8px ring at this size reads as a smudge
          rather than as a bullet. */}
      <circle cx="3.5" cy="4.6" r="1" fill="currentColor" stroke="none" />
      <circle cx="3.5" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="3.5" cy="11.4" r="1" fill="currentColor" stroke="none" />
      <path d="M6.6 4.6h6.4M6.6 8h6.4M6.6 11.4h6.4" />
    </>
  ),
  orderedList: (
    <>
      <path d="M2.6 3.9l1.1-.6v3.1M2.6 6.4h2.2" />
      <path d="M2.6 9.5a1 1 0 0 1 1.7.7c0 .9-1.7 1.4-1.7 2.5h1.9" />
      <path d="M6.8 5h6.2M6.8 11.2h6.2" />
    </>
  ),
  // A real pair of quotation marks — the old control used a straight
  // typewriter quote, which is the one punctuation mark a writing tool
  // should never show. Filled rather than stroked: an outlined curl at
  // 16px collapses into the digits "66", which is what the first draft
  // of this icon actually looked like on screen.
  quote: (
    <g fill="currentColor" stroke="none">
      <path d="M6.7 4.3c-2.2 1-3.7 2.9-3.7 5.1 0 1.6 1 2.6 2.3 2.6 1.2 0 2.1-.85 2.1-2 0-1.15-.85-2-1.9-2-.2 0-.4.02-.6.08.3-1.15 1.05-2.1 2.2-2.75Z" />
      <path d="M12.3 4.3c-2.2 1-3.7 2.9-3.7 5.1 0 1.6 1 2.6 2.3 2.6 1.2 0 2.1-.85 2.1-2 0-1.15-.85-2-1.9-2-.2 0-.4.02-.6.08.3-1.15 1.05-2.1 2.2-2.75Z" />
    </g>
  ),
  // A full-width rule with text pulled back above and below it, so it
  // reads as a break in a page rather than as two equal lines.
  rule: (
    <>
      <path d="M2.4 8h11.2" />
      <path d="M5.2 4.1h5.6M5.2 11.9h5.6" opacity=".3" />
    </>
  ),
  alignLeft: <path d="M2.8 4.3h10.4M2.8 7.2h6.6M2.8 10.1h9M2.8 13h5.4" />,
  alignCenter: <path d="M2.8 4.3h10.4M4.7 7.2h6.6M3.5 10.1h9M5.3 13h5.4" />,
  alignRight: <path d="M2.8 4.3h10.4M6.6 7.2h6.6M4.2 10.1h9M7.8 13h5.4" />,
  alignJustify: <path d="M2.8 4.3h10.4M2.8 7.2h10.4M2.8 10.1h10.4M2.8 13h10.4" />,
  // An A beside an a: the two letterforms are what distinguishes one
  // typeface from another at a glance.
  fontFamily: (
    <>
      <path d="M2.4 11.6L5.3 4l2.9 7.6M3.3 9.4h4" />
      <path d="M9.6 8.2a1.7 1.7 0 0 1 2.9 1.2v2.2M12.5 10.2c-1.9 0-2.9.5-2.9 1.3 0 .5.4.9 1.1.9.9 0 1.8-.7 1.8-1.6" />
    </>
  ),
  // The same letter at two sizes — size, not family.
  fontSize: (
    <>
      <path d="M1.9 11.6L4.6 4.6l2.7 7M2.8 9.5h3.6" />
      <path d="M9.4 11.6l1.9-4.6 1.9 4.6M10 10.2h2.6" />
    </>
  ),
  // Drawn without the bar underneath: the swatch that carries the colour
  // is a separate element in the toolbar, so the icon stays monochrome
  // and inherits the button's text colour like every other icon here.
  textColor: <path d="M3.4 11.4L6.9 3l3.5 8.4M4.6 9.2h4.6" />,
  highlight: (
    <>
      <path d="M6.2 9.8L4 12l-1.4-.5.9-2 4.9-4.9a1.3 1.3 0 0 1 1.9 0l.9.9a1.3 1.3 0 0 1 0 1.9l-3 3Z" />
      <path d="M8.4 5.6l2 2" />
    </>
  ),
  // The universal "none", sitting beside each colour control as its
  // reset — the two anonymous ✕ buttons this replaces gave no clue which
  // of them cleared what.
  colorReset: (
    <>
      <circle cx="8" cy="8" r="5.2" />
      <path d="M4.3 11.7 11.7 4.3" />
    </>
  ),
  // A T with an x — the convention for "clear formatting". The first
  // draft drew an eraser, which at this size read as an unidentifiable
  // blob with a tail.
  clearFormat: (
    <>
      <path d="M3 4.3h7.4M6.7 4.3v7.4" />
      <path d="M10.2 8.8l3.2 3.2M13.4 8.8l-3.2 3.2" />
    </>
  ),
  // One path splitting into two — the same gesture the Story Graph draws
  // when a scene branches, which is exactly what inserting a Choice does.
  // The ends are dots rather than arrowheads: at the 15px this is drawn
  // at inside the Choice button, arrowheads turned the whole glyph into
  // an unreadable squiggle.
  branch: (
    <>
      <path d="M2.6 8h2.4c1.1 0 1.7-.6 2.3-1.5l.8-1.1c.6-.9 1.2-1.2 2.2-1.2h1.3" />
      <path d="M2.6 8h2.4c1.1 0 1.7.6 2.3 1.5l.8 1.1c.6.9 1.2 1.2 2.2 1.2h1.3" />
      <circle cx="12.6" cy="4.2" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12.6" cy="11.8" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  // A speech shape with the lines still inside it. Drawn as one closed
  // outline rather than two overlapping bubbles: at 15px two bubbles
  // become a grey blob, and one bubble with two lines survives the size.
  dialogue: (
    <>
      <path d="M2.7 4.4c0-.55.45-1 1-1h8.6c.55 0 1 .45 1 1v5.2c0 .55-.45 1-1 1H6.6L3.6 13v-2.4h-.9V4.4Z" />
      <path d="M5.4 6.1h5.2M5.4 8.2h3.2" />
    </>
  ),
  plus: <path d="M8 3.4v9.2M3.4 8h9.2" />,
  // Sliders — the Inspector's own gesture.
  properties: (
    <>
      <path d="M3 4.6h10M3 8h10M3 11.4h10" />
      <circle cx="6.2" cy="4.6" r="1.5" />
      <circle cx="10.2" cy="8" r="1.5" />
      <circle cx="5.4" cy="11.4" r="1.5" />
    </>
  ),
};

export function Icon({ name, className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}
