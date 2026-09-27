import { GROUND_TOKENS } from "./readingThemes";

/**
 * The exported page's stylesheet (v0.48.0).
 *
 * TWO RULES GOVERN EVERY SELECTOR BELOW.
 *
 * 1. THE CLASS NAMES ARE A CONTRACT. `.scriare-speaker`, `.scriare-mention`,
 *    `[data-type="callout"]`, `.scriare-choice`, `.scriare-choice.is-locked`
 *    are the names the editor and Play Mode already use — they come out of
 *    styles/index.css and runtime/, not from here. The planned CSS tab lets
 *    a writer restyle their own story, and it can only do that if the names
 *    it targets are the same in all three places and stay the same between
 *    versions. So: adding a class here is cheap, renaming one is a breaking
 *    change to somebody's stylesheet, and that is the reason this file
 *    invents as few as it can.
 *
 * 2. EVERY COLOUR COMES FROM A TOKEN. Nothing below names a colour
 *    directly. That is what makes the reader's ground switch work at all —
 *    and it is also what will make the CSS tab work, because overriding
 *    `--accent` in one line has to recolour everything that means "accent",
 *    not just the places someone remembered to make overridable.
 *
 * NO NETWORK. No font link, no stylesheet, no script, no image host: an
 * exported story is one file that makes zero outbound requests. It works
 * offline, it works from a USB stick, and nobody learns who read it. The
 * cost is that the reading face is a system stack rather than the app's
 * Manrope — the honest trade, since bundling a variable font would add a
 * few hundred kilobytes to every export and a webfont link would make the
 * typography depend on the network, which is precisely the bug themes.css
 * describes the app having had and fixing. Faces the WRITER chose from the
 * toolbar are unaffected: those are Georgia, Helvetica and Courier, which
 * are on the reader's machine already.
 */
export function pageStyles(): string {
  return `
:root {
  color-scheme: dark;
${GROUND_TOKENS.night}
}
:root[data-ground="paper"] {
  color-scheme: light;
${GROUND_TOKENS.paper}
}

*, *::before, *::after { box-sizing: border-box; }

html, body { margin: 0; padding: 0; background: var(--bg); }

body {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI Variable Text",
    "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--text-reading);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  min-height: 100%;
}

/* ── The bar ────────────────────────────────────────────────────────
   Restart, Back and the ground switch stay on screen for the whole
   story, including on a scene that offers no way forward. Play Mode
   lets a writer press Esc out of that situation; a reader has no Esc,
   so the way out lives somewhere that is always there. */
.scriare-bar {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  padding-top: calc(10px + env(safe-area-inset-top, 0px));
  /* Two declarations, not one. The app runs on a Chromium it ships with;
     an exported story runs on whatever the reader has. A browser without
     color-mix() would otherwise give the bar no background at all and let
     the prose scroll underneath the buttons. */
  background: var(--bg);
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border-soft);
}
.scriare-bar .scriare-story-name {
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: .01em;
  color: var(--text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1 1 auto;
  min-width: 0;
}
.scriare-bar nav { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; }
.scriare-bar button {
  appearance: none;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  padding: 7px 11px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
  transition: color .14s, border-color .14s, background-color .14s;
}
.scriare-bar button:hover:not(:disabled) {
  color: var(--text);
  border-color: var(--border-faint);
  background: var(--surface-2-faint);
}
.scriare-bar button:disabled { opacity: .38; cursor: default; }
.scriare-bar button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

/* ── The page ───────────────────────────────────────────────────────
   The same sheet-on-a-desk the editor draws (.scriare-page in
   index.css), minus the editor's furniture. Same measure too: the
   column is widened by exactly the padding the sheet adds, so the line
   length a reader gets is the line length the writer wrote to. */
.scriare-reader {
  padding: 34px 16px 72px;
  padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  align-items: center;
}
.scriare-page {
  width: 100%;
  max-width: calc(42rem + 80px);
  background: var(--page);
  border: 1px solid var(--border-soft);
  border-radius: 8px;
  box-shadow: var(--sheet-shadow);
  padding: 34px 40px 40px;
  font-size: 16.5px;
  line-height: 1.72;
}
@media (max-width: 720px) {
  .scriare-page { padding: 24px 20px 30px; border-radius: 0; border-inline: 0; font-size: 16px; }
  .scriare-reader { padding-inline: 0; padding-top: 20px; }
}

.scriare-scene-title {
  margin: 0 0 1.1rem;
  font-size: 1.62em;
  line-height: 1.25;
  font-weight: 700;
  letter-spacing: -.012em;
  color: var(--text);
  text-wrap: balance;
}

/* ── Prose ──────────────────────────────────────────────────────────
   Deliberately plain. Everything a writer applied is already in the
   markup as marks and inline styles; what this has to do is give those
   marks a ground to sit on and get out of the way. */
.scriare-prose > :first-child { margin-top: 0; }
.scriare-prose > :last-child { margin-bottom: 0; }
.scriare-prose p { margin: 0 0 1.05em; }
.scriare-prose h1, .scriare-prose h2, .scriare-prose h3 {
  color: var(--text); line-height: 1.3; margin: 1.6em 0 .6em; text-wrap: balance;
}
.scriare-prose h1 { font-size: 1.45em; }
.scriare-prose h2 { font-size: 1.24em; }
.scriare-prose h3 { font-size: 1.08em; }
.scriare-prose strong { color: var(--text); font-weight: 700; }
.scriare-prose u { text-underline-offset: .18em; }
.scriare-prose a { color: var(--accent); }
.scriare-prose hr { border: 0; border-top: 1px solid var(--border-soft); margin: 2em 0; }
.scriare-prose blockquote {
  margin: 1.4em 0; padding-left: 1.1em;
  border-left: 3px solid var(--border);
  color: var(--text-2); font-style: italic;
}
.scriare-prose ul, .scriare-prose ol { margin: 0 0 1.05em; padding-left: 1.35em; }
.scriare-prose li { margin: .3em 0; }
.scriare-prose li::marker { color: var(--text-3); }
.scriare-prose mark {
  background: var(--highlight); color: var(--text);
  padding: 0 .12em; border-radius: 2px;
}
.scriare-prose code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: .9em; background: var(--surface-2); padding: .08em .3em; border-radius: 3px;
}
.scriare-prose pre {
  background: var(--surface-2); padding: .9em 1.1em; border-radius: 6px; overflow-x: auto;
}
.scriare-prose pre code { background: none; padding: 0; }

/* The reader's half of the speaker system (v0.37.0): in the editor a
   speaker is a chip, because there it is a decoration over an attribute.
   Here it is prose — "Mara:" is how the story reads — so it is typography
   and nothing about it suggests a control. */
.scriare-speaker { color: var(--accent); font-weight: 600; }

/* A mention must be indistinguishable from the words either side of it.
   Everything the editor draws on one is a note to the writer. */
.scriare-mention { border-bottom: 1px solid transparent; color: inherit; }

[data-type="callout"] {
  position: relative;
  margin: 1.35em 0;
  padding: .78rem 1rem .78rem 2.75rem;
  border-radius: .5rem;
  background: var(--accent-soft);
  border-left: 3px solid var(--accent);
}
[data-type="callout"]::before {
  content: "💡";
  position: absolute; left: .85rem; top: .78rem;
  font-size: .95rem; line-height: 1;
}
[data-type="callout"] > :first-child { margin-top: 0; }
[data-type="callout"] > :last-child { margin-bottom: 0; }

/* ── Choices ────────────────────────────────────────────────────── */
.scriare-choices { display: flex; flex-direction: column; gap: 8px; margin: 1.6em 0 .4em; }
.scriare-choice {
  display: block; width: 100%; text-align: left;
  font: inherit; font-size: .93em; line-height: 1.5;
  padding: 9px 16px;
  color: var(--text);
  border-style: solid;
  cursor: pointer;
  transition: filter .14s;
}
.scriare-choice:hover { filter: brightness(1.08); }
.scriare-choice:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
/* A locked choice keeps its style's corner radius so it still reads as one
   of the choices around it, but takes its own dashed, drained treatment:
   that difference IS the information. */
.scriare-choice.is-locked {
  cursor: not-allowed; filter: none;
  background: transparent;
  border: 1px dashed var(--border-faint);
  color: var(--text-3);
}
.scriare-choice .scriare-lock-x { margin-right: .5em; }
/* The reason is the entire point of showing a locked choice. Without it a
   reader learns only that they failed at something unnamed. */
.scriare-choice .scriare-lock-why {
  display: block; margin-top: .15em; padding-left: 1.25em;
  font-size: .8em; color: var(--text-3);
}

/* ── The last screen ────────────────────────────────────────────── */
/* ── the Dialogue (v0.66.0) ────────────────────────────────────────
   A conversation that stayed on the page. The transcript is set in the
   reading face like the prose it is; the player's own lines are italic so
   a reader can tell at a glance which half of the exchange was theirs. */
.scriare-dialogue { margin: 2rem 0; }
.scriare-dialogue .scriare-said { margin-bottom: 0.9rem; }
.scriare-dialogue .scriare-said p { margin: 0; }
.scriare-dialogue .scriare-said-you { font-style: italic; color: var(--text-2); }
.scriare-dialogue .scriare-choices { margin-top: 1.2rem; }

.scriare-ending {
  margin-top: 2.4em;
  display: flex; flex-direction: column; align-items: center; gap: 16px;
  padding: 34px 28px; text-align: center;
  background: var(--surface-2);
  border: 1px solid var(--border-soft);
  border-radius: 8px;
}
.scriare-ending .scriare-ending-label {
  font-size: 1.06em; font-weight: 600; letter-spacing: .04em; color: var(--text-2);
}
.scriare-ending button {
  font: inherit; font-size: .88em; font-weight: 600;
  padding: 8px 16px; border-radius: 6px; cursor: pointer;
  background: var(--accent); border: 1px solid var(--accent); color: var(--page);
}
.scriare-ending button:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }

/* ── Picking up where they left off ─────────────────────────────── */
.scriare-resume {
  width: 100%; max-width: calc(42rem + 80px);
  margin-bottom: 14px; padding: 14px 18px;
  display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
  background: var(--surface-2); border: 1px solid var(--border-soft); border-radius: 8px;
  font-size: 13.5px; color: var(--text-2);
}
.scriare-resume span { flex: 1 1 200px; }
.scriare-resume button {
  font: inherit; font-size: 12.5px; font-weight: 600;
  padding: 6px 13px; border-radius: 6px; cursor: pointer;
  border: 1px solid var(--border); background: transparent; color: var(--text-2);
}
.scriare-resume button.scriare-resume-yes {
  background: var(--accent); border-color: var(--accent); color: var(--page);
}

/* A scene change is a fade and nothing else — the same transition Play
   Mode uses, for the same reason: anything more elaborate is a thing the
   reader has to sit through once per choice. */
@keyframes scriare-scene-in { from { opacity: 0; } to { opacity: 1; } }
.scriare-scene { animation: scriare-scene-in 180ms ease; }
@media (prefers-reduced-motion: reduce) {
  .scriare-scene { animation: none; }
  .scriare-bar button, .scriare-choice { transition: none; }
}
`;
}
