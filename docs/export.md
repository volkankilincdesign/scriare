# Export — the decisions, and the class contract

Shipped v0.48.0. This is the reference for anything that touches the
exported page later — the CSS tab above all, which depends on the contract
below not moving.

## The question that was actually asked

"Should the THEME affect the HTML?" It is two questions wearing one coat:
should the exported page have a visual identity at all, and if so should it
be *the one the writer happened to be sitting in* when they pressed Export.

**Answer: yes to the first, no to the second.**

The eight themes in `styles/themes.css` are chrome. Forty-seven tokens
tuned for a room with panel surfaces, three border weights, a docked graph
and three levels of text hierarchy — "a theme tints the room, not the
content", as that file puts it. An exported page has no room. It is one
column of prose on a ground, and most of those tokens have nothing in it to
refer to. What survives — `--page`, `--text`, `--accent` — was chosen to sit
*beside* panels, not to be read for forty minutes on a phone.

Phosphor is a good editor theme and a punishing one to read a chapter in.
A writer picks Nocturne at 2am because it is kind to *their* eyes during a
four-hour session; that is not a statement about what a stranger wants at
lunchtime. The editor theme is a private comfort setting and the export is a
published artifact, and shipping the first as the second is publishing a
novel in whatever font the author's word processor was set to.

The counter-argument is real and was not dismissed: a horror piece *wants*
Nocturne, and for a portfolio piece the export is the thing a stranger
judges. Which is why the answer is not "no theme" but "a theme decided
deliberately at export time, rather than inherited from 2am".

## Paper and Night

Two grounds, built for reading rather than for sitting beside panels.
Values in `src/renderer/src/export/readingThemes.ts`.

- **Paper** — warm off-white. Deliberately *not* the Light theme's sheet,
  which is near-white because it has to out-bright a desk; a page with no
  desk around it only needs to stop glaring.
- **Night** — lifted well off black (18.5% against the Dark theme's 9.5%),
  with body text pulled down to 84%. White on near-black at 15:1 halates
  badly on an OLED phone; this lands at 11.4:1, which is a long-read number
  rather than a specification-sheet one.

**The reader picks, and their choice is remembered. Before they have an
opinion, the story opens on Night.** Following `prefers-color-scheme`
sounds more considerate and is in practice a way of not deciding — the
writer never knows what a stranger sees first, and the first screen is the
one that gets judged.

**Measured, not eyeballed, and the first pass failed.** Night's `--text-3`
came in at 4.37:1 against a choice's fill — the text that carries a locked
choice's *reason*, the one thing a locked choice exists to say. The whole
ramp was lifted rather than that token nudged over the line, because a
value chosen to just pass a threshold fails the moment anything near it
moves.

Each ground's page and text colour exists **twice** — as `oklch` in the
stylesheet and as sRGB in `GROUND_PAGE_HEX` / `GROUND_TEXT_HEX` for the
contrast check, which needs numbers. A test paints both onto a canvas and
compares the pixels, because two spellings of one colour is exactly the
pair that drifts.

## What travels, and what does not

The export runs the **same renderer Play Mode does**:
`resolveMentions` → `applySpeakerPrefixes` → `splitDocumentIntoSegments` →
`generateHTML(RUNTIME_EXTENSIONS)`. "The export inherits the rich text
editor's changes" was therefore not a feature that had to be built — it is
a consequence of refusing to build a second path.

**Travels (content):** bold, italic, underline, headings, lists, quotes,
alignment, font family and size, hand-picked text colour, highlight,
callouts, conditional passages, mentions resolved to current names,
speaker attributions as prose, and every Choice Style property (fill,
border, thickness, radius) plus conditions, actions and locked reasons.

**Does not travel (chrome):** the editor theme, panels, the toolbar, the
Story Graph, the `IF` rule drawn around conditional text, and the speaker
*chip* — a reader gets the name as prose, never as a control.

## Colour is content, so the export warns instead of fixing

A colour the writer picked lives in the story and arrives unchanged. But it
was chosen against one ground and the export has two, so a pale blue picked
in Dark lands on Paper as pale blue on off-white.

The export dialog lists what may not read, on which ground, with the
measured ratio — and exports anyway. An unreadable colour can be the point
(text meant to be missed, a choice meant to be nearly invisible), and a
tool that refuses to export a deliberate effect has stopped being a tool.
Nothing here rewrites a colour or offers to.

Only **literal** colours are measured. A `var(--…)` fill resolves against
whichever ground the reader chose and is correct by construction — which is
the whole reason `DEFAULT_CHOICE_BOX` is written in variables.

**The related trap, still open:** opening the colour picker on a Choice
Style converts its variable to a hex permanently, in the story file. The
dialog has a "Theme" button back and Export now warns when the result does
not read, but nothing marks the conversion at the moment it happens.

## The class contract

These names are the same in the editor, in Play Mode and in the export.
**Adding one is cheap; renaming one is a breaking change to somebody's
stylesheet.** The planned CSS tab can only work if they hold.

| Class | What it is |
| --- | --- |
| `.scriare-page` | The sheet a scene is printed on |
| `.scriare-scene` | The scene wrapper (carries the fade) |
| `.scriare-scene-title` | The scene's title |
| `.scriare-prose` | A run of ordinary content |
| `.scriare-speaker` | A speaker's name, as prose |
| `.scriare-mention` | A mention, deliberately indistinguishable from text |
| `[data-type="callout"]` | A callout block |
| `.scriare-choices` | The column a Choice Block renders as |
| `.scriare-choice` | One choice |
| `.scriare-choice.is-locked` | A choice whose conditions failed |
| `.scriare-lock-x` / `.scriare-lock-why` | Its mark and its reason |
| `.scriare-ending` | The last screen |
| `.scriare-bar` | Back / Restart / ground switch |
| `.scriare-resume` | The "you were partway through" offer |

**Every colour in the exported stylesheet comes from a token**, never a
literal. That is what makes the ground switch work at all, and it is what
will make the CSS tab work: overriding `--accent` in one line has to
recolour everything that means "accent", not only the places someone
remembered to make overridable.

## One file, no requests

No font link, no stylesheet, no script, no image host. It works offline,
from a folder or a USB stick, and nobody learns who read it. The cost is a
system reading face instead of the app's Manrope — the honest trade, since
a webfont link would make an exported story's typography depend on the
network, which is exactly the bug the app fixed in itself by bundling its
fonts. Faces the *writer* chose from the toolbar are unaffected: those are
Georgia, Helvetica and Courier, already on the reader's machine.

## The reader's controls

Back, Restart, and their place kept in their own browser. **Back undoes
what a choice did to the variables**, not only where it went — otherwise a
reader walks back through a door keeping the key they picked up on the way
out. A returning reader is **offered** their place rather than dropped into
it, because someone reopening the file may have wanted to show a friend the
opening.

Restart and Back live in the bar rather than only on the ending card, on
purpose: a scene whose every choice is currently gated renders its locked
options and no ending card — which matches Play Mode exactly, and is why
the reader needs a way out that does not depend on the story providing one.

## The one duplication, and how it is held

`evaluateCondition`, `evaluateConditions` and `applyVariableAction` are
transliterated by hand in `export/pageRuntime.ts`, because a save dialog
cannot ship TypeScript to a browser. Everything else reuses the app's code.

Hand-transliterated logic drifts into the worst failure this app has: a
door that opens in Play Mode and stays shut in the export, with nothing on
screen to say so. So it is held by enumeration, not care —
`tests/export-evaluator.spec.mjs` runs 966 condition cases and 93 action
cases (every type, every comparator, both polarities of `negate`, every
operation, and a spread of wrong-typed values a hand-edited project file can
produce) through both implementations and requires them to agree.

**If you add a comparator or an operation to `types/variables.ts`, this
file is the other half of that change.**

## A note on how the export is tested

The first version ran the exported page in an `srcdoc` iframe inside the
app. Every assertion passed — against a page whose script had never
executed, because the app's own `script-src 'self'` CSP is inherited by the
frame. A test that measures its own harness reports a completely dead
export as working.

The specs now write the real file to disk and open it in a `BrowserWindow`
of its own (`openExported` in `tests/run.mjs`), which is how a reader opens
it and which also proves it works *as a file*.

## Deliberately left out

- **A theme baked from the writer's current editor theme.** Offered as an
  option and not taken; if it ever comes back, it belongs as an export
  setting with a warning, not as the default.
- **A scene counter.** Considered, declined — a branching story's length
  is not a number the reader benefits from.
- **`lang` on the exported `<html>`.** The obvious thing to write is
  `lang="en"` and it would be wrong for a story in any other language; a
  wrong `lang` is worse than none, because a screen reader pronounces the
  whole story with it. Scriare has nowhere for a writer to declare their
  language yet. When it does, `pageTemplate.ts` is where it goes.
