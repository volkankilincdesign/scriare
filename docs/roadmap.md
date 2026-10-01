# Scriare — direction and roadmap

Agreed with Volkan, 13 Sep 2026. Updated after v0.78.1.

**No calendar dates in this file, on purpose.** Launch happens when the
launch list is done, which could be sooner than any date would suggest.
Everything is sized in *sessions* (one working block with Claude) so the
order stays honest when the pace changes.

## What Scriare is for

Short term: a portfolio piece, and a launch. Longer term, in his words —
**"at least one person who has no idea who I am must try it and have a
great time using it."** That north star makes UI dead ends defects rather
than gaps.

## Where it stands

- **v0.34.0 Choice Styles** — named styles in Project Settings, per-choice
  overrides, drawn while writing as well as in Play.
- **v0.34.1** — the Inspector no longer closes itself when you work in it.
- **v0.35.0 Entities** — Characters and Locations as one object with two
  kinds; pages, aliases, `@` mention and create-on-the-spot, backlinks
  derived from the documents. Mentions store the id, so a rename reaches
  every scene and the player.
- **v0.35.1** — mention hints scoped to the editor.
- **v0.36.0 Check Story** — reachability, dangling and broken links, gates
  on deleted variables, endings, route lengths, word count.
- **v0.36.1** — the graph minimap appears only when the graph overflows.
- **v0.36.2** — Check Story grouped by scene, counts as colour chips.
- **v0.37.0 Speaker attribution** + the mentions-in-choices graph bug.
- **v0.37.1** — Locations can no longer be set as speakers (`canSpeak`).
- **v0.37.2** — `@` at the head of an ALREADY-WRITTEN line attributes it.
- **v0.38.0 Find** — below.
- **v0.38.1** — the seven one-machine test failures: his collapsed panel
  layout leaking through Electron's shared `userData`. Fixed at the runner,
  which now states the layout instead of inheriting it.
- **v0.39.0** — entity delete, F2 rename, Group-name selection on the graph.
- **v0.39.1 Story Graph edge labels** — below (superseded by v0.43.0).
- **v0.39.2** — scenes inside the third group and beyond couldn't be
  clicked: a group's z-index was its place in the parents-first list while
  a scene's was the literal 1, so from the third box onward the container
  painted over its own contents. A box now always sits behind what it holds.
- **v0.40.0 Lifted** — the finish pass, below.
- **v0.40.1 / v0.41.0** — the status bar, the graph's dot field, a stronger
  elevation scale, and a Story Graph that can take the whole column.
- **v0.42.0 The canvas has lines** — the Story Graph is grid-based: movement,
  landing and resizing on the dot field's own 18px lattice, by four routes
  (drag, resize, Auto Layout, any write to the store). Alt suspends it.
- **v0.43.0 A map that reads left to right** — Auto Layout ranks scenes by
  story depth rather than by minimum edge length, so every choice out of a
  scene lands in one column and a spine runs straight; tighter columns and
  rows (108/36, both whole cells); wires say "Choice 1" always, and drop the
  label entirely below 0.7 zoom. Also: folding a chapter no longer resizes
  it, and moving a box no longer shaves pixels off it (corner-snapping is
  for resizes; a move keeps its size).
- **v0.44.0 Eight themes** — Daylight, Overcast, Lamplight, Deep Water,
  Nocturne, Phosphor, plus Dark and Light polished. `--page` is a token now,
  so the sheet is always lighter than the desk. Captions were under 4.5:1 in
  Light and in five of the six new palettes; all eight clear it.
- **v0.45.0 One dock control** — Content, Inspector and Story Graph fold away
  with the same bordered button, drawn (not typed) and spaced away from their
  neighbours. Fixed the v0.40.0 elevation rule that matched Tailwind's hover
  variant and permanently lifted every ghost button in the Content panel.
- **v0.46.0 Theme audit** — the app walked in all eight themes on every
  surface, looking for painted colours that aren't in the palette. Found
  Check Story's literal Tailwind amber (now a `--warning` token), the Play
  ending card painted with the modal scrim, two controls outlined in black,
  and a hand-written dark-theme shadow. The audit is now a standing test.
- **v0.47.0 Save safety** — a project file is replaced, never written into:
  temp file, fsync, atomic rename. A `.bak` of the version being replaced,
  on a five-minute cadence rather than on every autosave. A file that
  changed underneath us is not overwritten — the app asks. Full reasoning in
  `claude/save-safety.md`. Three defects surfaced during review that were
  not in the plan, including two saves generating the same temp filename in
  the same millisecond and losing the one the writer asked for.
- **v0.48.0 Export** — the disabled button since the beginning, and now the
  front door. One self-contained HTML file with no network requests, the
  `.scriare` extension, two purpose-built reading grounds the reader
  switches between, and an export-time contrast warning that never blocks.
  Full reasoning and the class contract in `claude/export.md`.
- **v0.49.0 A pass with the lights on** — no new features. A five-agent
  whole-app audit, every extraordinary claim reproduced by measurement
  before it was believed, then tiers 1 and 2 fixed in full: six ways the
  app could lose a writer's work (a scene swap that went into ProseMirror's
  undo stack, a conflict reload the editor ignored, a structural undo that
  ate character-page prose, a conflict backup that overwrote itself five
  minutes later, a close that discarded a pending autosave, and an export
  that could replace the project file with a web page) and ten features
  that did not work (Find could not match a query with a space in it;
  Delete and Ctrl+Z reached the story behind an open dialog; a scene made
  while a Character page was open landed in the wrong document; toasts
  rendered behind modals). Backups are a three-slot rotation now. Findings
  in `claude/audit-v0.48.md`, what was taken and what was left in
  `claude/audit-v0.48-outcome.md`.
- **v0.49.1 The fix that didn't** — two data-loss bugs found inside
  v0.49.0's data-loss fixes, by reading the diff back cold and then
  measuring. `closeProject`'s new flush returned without waiting, because
  `saveNow`'s "one is already on its way" branch hands back a resolved
  promise having written nothing — so closing during an in-flight save
  wrote V2 to disk while the store reported "saved". And the close
  handshake's four-second give-up timer was racing the one question the
  app asks, so reading "Close without saving?" carefully was the failure
  mode. `await saveNow()` now means the disk is current, and the timer is
  a liveness check the renderer keeps alive with a pulse. Full reasoning
  in `claude/close-safety-v0.49.1.md`.
- **v0.50.0 Getting around without a mouse** — the audit's tier 4. The
  Content panel's headers and character rows were bare `<div onClick>`, so
  a writer navigating by keyboard could collapse "Story" and never reopen
  it, and could never open a character page at all. The focus ring was
  being drawn in transparent — Tailwind's `focus:outline-none` at
  specificity (0,2,0) beating the global `:focus-visible` rule at (0,1,0) —
  and removing it was not the fix, because Chromium keeps matching
  `:focus-visible` after a click on a `div[tabindex]`, so the modality is
  tracked instead. Dialogs got `role="dialog"`, a focus trap and focus
  restore. The Inspector's two unresolved mention readers now agree with
  the graph about a renamed character. 33 section headers on three type
  ramps became one shared class at 10px. And the palette walk went from
  four surfaces to thirteen. Full reasoning in
  `claude/accessibility-v0.50.0.md`.
- **v0.51.0 Where the time actually goes** — the audit's tier 3, measured
  before anything was changed, and the measurement was most of the value:
  two of the three items it named do not cost what it said, and the thing
  that does was not on the list. One edit on a 300-scene story took
  80.6 ms; collapsing the Story Graph took it to 33.3, which is the
  two-frame floor — so the graph was 50 ms of it, because its memos are
  keyed on `project` and React Flow diffs by reference, handing it 300 new
  node objects for a title change. Unchanged nodes and edges keep their
  identity now. The Inspector colour input the audit reported does not
  exist; the sixteen-choice cost is noise; the choice walk is 0.2 ms, not
  24.8. The Content panel's 16 ms is real but the filter was never the
  cause, so that fix was reverted rather than shipped as one. Full
  reasoning in `claude/perf-v0.51.0.md`.
- **v0.52.0 Tidying up** — the audit's tier 5, and the repository itself. The
  only fully dead export gone; `26` written four times across three files
  for two quantities reduced to two names in the module whose header says
  they must agree; `CHOICE_OPTION_TYPE` declared twice, including once in
  the module that exists to stop exactly that. Snapping was implemented
  twice with each comment denying the other — the inner one removed after
  measuring that graph-auto-layout's 17 checks and graph-grid's 16 stay
  green without it. Cycle guards on the two tree walkers that would
  otherwise spin forever on a corrupt `parentId` loop. Two comments that
  sent readers to concepts the app no longer has, corrected. And the
  fifteen design documents are mirrored into the repo's `docs/` with an
  index, so a reader who clones it gets the reasoning as well as the
  result. **This closes the v0.48.0 audit: tiers 1 through 5, all taken.**

- **v0.53.0 The Welcome screen** — the first screen anyone sees was the
  last one nobody had looked at: a 448px column dead centre in 1280×800,
  85% flat `--bg`, and a stranger's first thirty seconds ending at "No
  recent projects yet." Rebuilt from three mockup rounds as ONE screen in
  three states — the frame is identical at nought stories and ninety, and
  only what the hero slot MEANS changes. Each card carries its story's
  map, drawn from a shape cached on save (≈675 bytes, no prose, no ids)
  because a writer with nine stories recognises one by its shape, not its
  name. Full reasoning in `claude/welcome-v0.53.0.md`.
- **v0.53.1 / v0.53.2 / v0.53.3** — three rounds of him holding it up
  against the real thing. A `<button>` carries `align-items: center` from
  the UA stylesheet, so the map panel measured 0px and every map was drawn
  at its own size inside a card of a different size (and the hero's accent
  rail had no height at all). Then the harder one: **normalising x and y
  independently is not a smaller picture of the graph, it is a different
  graph** — a real 7.5:1 story in a 2.3:1 card gets every vertical
  distance multiplied by 3.2. Both axes share one scale now, and the test
  that should have existed first checks that the projection is a
  SIMILARITY transform, across every pair of scenes, off the rendered SVG.
  And the shelf stopped omitting the story in the hero from "your
  stories".
- **v0.54.0 Where you left off, whatever you were working on** — the hero
  read `selectedSceneId` and nothing else, so an afternoon on a character
  or a location ended with no "where you left off" at all. It names any
  page now, with the kind on its own line under the title — chosen from
  three mockups over a chip beside the name, because the app already has a
  way of saying what a thing is and a rectangular box against a 25px serif
  italic reads as pinned on.

- **v0.55.0 Three things a stranger can walk into** — no new features, and
  the last pass before the installer. Project Settings opened Choice
  Styles by closing itself and left no route back (the swap is right; the
  dead end was not, and Settings had to move out of TopBar's `useState`
  to fix it). The Welcome hero's "where you left off" opened the story's
  START SCENE rather than the page it named — a promise broken on the
  action every session begins with; the resume now carries the page's id,
  checked against the story that actually loaded. And the Choice Style
  colour picker pinned a theme variable to a hex in the story file,
  permanently and silently; it now says so at the moment it happens, once,
  with an Undo that restores the variable. One line of dead code found by
  a control that passed.

- **v0.56.0 The button that was never written** — the oldest visuals,
  found by measuring: every component's comments record the version its
  visuals were last revised in, and six mention none. `common/` held a
  Modal, a toast host and a whole icon set and NO BUTTON, so the primary
  action existed in nine spellings and the dialog title in four — the
  odd one out being New Project, the first dialog a new writer sees.
  `Button`, `Field` and `DialogHeader` now exist and invent nothing: the
  default is the spelling six places already used. The Variable Manager,
  the oldest surface anyone will actually see, was rebuilt in its
  sibling's shape from three mockups. A spec opens five dialogs, finds
  each primary action BY THE COLOUR IT IS PAINTED and measures it, so the
  claim is checked on the screen rather than in the imports.

- **v0.57.0 Play Mode reads on the reader's ground** — the export has
  refused to ship the writer's theme since v0.48.0, on the principle that
  a theme is chrome and a reading ground is content; Play Mode, written
  twenty versions earlier, shipped the theme anyway. Measured first: in
  Phosphor, Play painted the page terminal green. Play now reads on Night
  or Paper with the same switch the reader gets, remembered the same way,
  generated from the export's own token table so the two cannot drift.
  This breaks Play's v0.6.2 promise to read the way you wrote it, on
  purpose: Play answers what your reader will see. The themes walk was
  widened to audit that surface against the ground, and immediately found
  every container inside Play still inheriting the writer's ink.

- **v0.58.0 How it reads, at the moment you pick** — a colour is chosen on
  one page and lands on one of two, chosen by the reader; until now nothing
  said so before the export dialog. Measured first, and the measurement
  decided the shape: no colour clears 4.5:1 on both grounds (the band is
  empty; the best any literal colour manages is ~4.16:1), so the panel
  turns a late surprise into an early decision rather than promising a safe
  colour. The native picker and its eyedropper are untouched — the reading
  appears under the control, follows the drag through the v0.33.0 throttle,
  and stays after the OS dialog closes. Text colour, highlight and a
  choice's fill share one component; the numbers come from the export's own
  `checkStoryContrast` neighbour so the two can never disagree.

- **v0.59.0 The panel you are actually looking at** — the Inspector's
  scene state (the one a writer is in for hours, against the choice editor
  they are in for seconds) now names the scene and counts words, choices
  and how many of them go nowhere; a deleted destination is told apart from
  one nobody linked, both in the warning colour. The Content Browser gets
  one + New instead of a button per content type, Assets is cut and Notes
  says what it is for. Two word counts became one, exported from
  storyCheck: the status bar had been under-reporting any scene with a
  mention in it.

- **v0.60.0 Notes** — the writer's own pages, his spec: a note can mention
  the story and the story can never mention it. A third entity KIND rather
  than a new system, which is what the file format and `entities.ts` had
  both expected since v0.35.0 — so five of the six exclusions were already
  true and only the `@` menu needed a filter. "Appears in" turns around
  into "Points at", a note has no aliases, and the placeholder mechanism is
  deleted rather than extended: three kinds, one list, one shape.

- **v0.61.0 Double-clicking a story** — the installer: electron-builder,
  an NSIS installer and a portable .exe, per-user and assisted with no
  elevation (checked against Twine, whose own docs say it installs into
  Program Files — the difference is that this one is unsigned and from a
  stranger, so it shows one frightening dialog instead of two). And the
  half that makes the `.scriare` association worth registering: a
  single-instance lock, the second-instance handler, the macOS open-file
  event, and a launch-time path the renderer asks for. The story already
  open closes through `closeProject()` so nothing is lost; an unanswered
  save conflict refuses and says why.

- **v0.62.0 The app opens on the screen you are going to** — his report,
  with screenshots: opening a `.scriare` flashed the empty Welcome before
  the story, and so did an ordinary launch before the shelf. The renderer
  was painting its default while the answers were in flight. A boot phase
  now decides first, behind a splash; the window is held back 350ms so a
  fast launch never shows one, and the grace doubles as the fallback that
  cannot leave an invisible window. The spec records every frame from
  before the page's own scripts run, and slows the recent-list handler to
  400ms so the race is real on a machine too fast to have it.

- **v0.63.0 The installer wears the badge, and the app admits its
  version** — his badge artwork, made to the NSIS sidebar's exact
  164×314, replaces the stock blue graphic on the finish page and through
  the whole uninstaller. The "who is this for?" page is skipped
  altogether: Scriare installs per-user and cannot do otherwise, so the
  page offered a greyed option beside the only real one — and carried an
  untranslatable English "(must run as admin)" inside an otherwise Turkish
  wizard. The app also says which build it is now, beside the wordmark on
  the Welcome screen, and clicking it copies version, platform and engine
  for a bug report. Writing the test for that found that
  `app.getVersion()` had been answering Electron's default `"0.0"` in the
  suite for twelve versions, because the harness started the app from a
  file rather than a directory.

- **v0.64.0 Script Export** — the story on paper. Two layouts drawn on
  board K against the real fixture before any code: **Screenplay** for a
  reader, **Production script** (numbered lines, speakers in a column) for
  anyone who has to work from it; each as **PDF or .docx**. One
  `ScriptDocument` model, two renderers, one phrasing for conditions
  shared by both. Order is the Content tree, his call. The page rules are
  the feature — chapters open a page, short scenes never split, headings
  and cues never end one, choice blocks are atomic — and Word's lack of
  `break-inside` is why "keep this whole" is decided in the model rather
  than the CSS. **The third layout he saw, a dialogue table, was cut on
  purpose and is not cancelled:** it comes back as a real spreadsheet
  export for localisation and VO, which is a different feature with a
  different file type.

- **v0.65.0 The choice editor says what a choice does** — I2 applied to
  the choice editor, chosen from three groupings drawn at the panel's real
  320px width (board L). The chosen one is not the most explicit: the
  panel's problem was never that fields were unlabelled, it was that a
  choice with nothing set looked as complicated as one with a locked
  condition and two effects. So an unset rule is one line — *Shown
  always*, *Changes nothing* — with the way to change it beside it.
  Headings are **The Line / Shown / Changes**, his words, and each appears
  only once it has something under it; the closed row keeps its chips, his
  call. Also: the script's keep-whole threshold dropped from 7 to 3, so
  scenes share pages again — 29 pages became 22, with 13 of them carrying
  two scenes or more.

- **v0.66.0 The Dialogue** — a conversation that happens on the page
  instead of turning it, chosen from four drawings (board M) as M2. Three
  rules and nothing else: **said is spent** unless a line is marked
  repeatable; **every line has an after** — stay, end, leave, and only
  *leave* draws a wire in the Story Graph; **the page waits**, so anything
  written below an open conversation is not drawn until it closes. His
  question during the review — *what if the writer wants the rest of the
  text after the conversation?* — is answered by rule 3 rather than by a
  setting: they always do. A conversation is **not remembered between
  visits**, on purpose; exhausting topics for the whole story is a variable
  and a condition, which is what this block is sugar for. Rule 3 lives in
  the runtime rather than the block, which means it lives there **twice** —
  React in the app, plain JavaScript in the exported page — and that second
  copy is why most of the new negative controls break the export. Also:
  two new Check Story warnings (a conversation nothing can end; a line
  whose condition can never be met), a third block kind in Script Export,
  one badge per scene in the graph (`◆ 4 in-page · 1 exit`), and **a stable
  id on every paragraph**, stamped in while the schema change was open.

- **v0.66.1 Where a speaker's name sits** — his first hour with v0.66.0.
  The Dialogue got a toolbar button beside the Choice (it had been a slash
  command only, which said it was the lesser of the two block types), and
  the speaker chip stopped hanging off its line: it was baselined, which
  is right for a word and wrong for a pill — what the eye aligns is the
  box against the cap band, and the box was 1.63px low and dipped 5.8px
  under the baseline. `vertical-align: middle` moves it 0.05px, measured,
  so it is a shorter box and an `em` nudge instead. The reply's
  attribution came off a hand-picked 3px padding onto a shared line box.
  The fix's own photographs then turned up a reply that could not be
  seen at all: the textarea's auto-grow ran as a ref callback, which
  ProseMirror calls before the node view is in the document, so it
  measured zero and wrote it.

- **v0.67.0 The Dialogue and the Choice are siblings** — his rule, stated
  on 28 Sep and now the standing one for these two blocks: **same palette,
  same principles; only the behaviour differs.** The Dialogue's row takes
  the writer's Choice Style exactly as a choice row does (it was on
  hard-coded surface tokens, so the two disagreed in all eight themes and
  a restyle of the choices left the conversations behind). Lines can be
  dragged into order, using the choice panel's own gesture lifted into
  `useReorderableList` rather than a second copy — and that gesture, which
  had never had a test above the document level, now has one that performs
  a real drag in both panels. Replies re-measure when the column changes
  width, which is the "two-line gap on a one-line reply" he spotted (33px
  drawn against 17px needed).

  **The standing rule for future work:** anything drawn for one of these
  two blocks is drawn for both, unless the difference is behavioural —
  **and "both" includes the Inspector**, which v0.67.0 missed.

- **v0.67.1 The Inspector's rows** — the half v0.67.0 left out, and the one
  he was actually looking at. The Dialogue's folded row was a different
  component from a choice's: 6px against 8px, a filled header strip, a
  smaller title, no ✕, a row number where the choice names its
  destination — and **no fill on the card at all**, which is also why a row
  being dragged was see-through. It is the choice row now, value for value,
  with the conversation's own facts in the second line. A mockup of the
  three options in all eight themes went first this time, and he chose from
  it before any code was written.

- **v0.67.2 The whole panel, compared corner to corner** — the third pass
  at the same rule, and the first one that started from a comparison
  instead of from something he pointed at. Fixed: the panel header (section
  label, add button beside it, line count deleted), the speaker and
  appearance controls now one shared component each instead of two
  hand-copies, a Style row the Dialogue never had, + Create New Scene in
  its destination select, the disabled state on its add buttons, and one
  remove control per row instead of two. Two of the fixes were in the
  Choice panel, which the rule allows when the choice is the one that is
  wrong. The parity spec now compares headers, open cards and control
  counts, not only colours.

- **v0.67.3 The Inspector follows a click into a reply** — it follows the
  caret, and a line's reply is a textarea in a non-editable wrapper, so
  clicking it never moved the caret and the panel kept the last line the
  writer was really in. One pointerdown handler on the line covers the
  reply, the after-mark, the ✕ and the destination label; a guard keeps a
  second click in the same line from re-rendering the panel while it is
  being typed into.

- **v0.67.4 The two toolbar buttons are one button** — the Dialogue's
  insert button was the outlined half of the pair; it is the Choice button
  now, down to the fill, the text colour and the padding, with only the
  icon and the word different. Checked in all eight themes.

  **Still to do under this heading:** the same sweep across the rest of the
  app, against the set we have settled — section labels, the accent text
  button, the row card, v0.65.0's I2 grammar, FieldRow and QuietRule. Not
  started, at his instruction.

- **v0.68.0 The wordmark in the top bar** — drawn inline and filled with
  `currentColor` so it takes the theme's accent; the letterform cut through
  as a hole, aligned to the cap band of the word beside it, and the viewBox
  padded by 6% because the artwork's circle was tangent to its own edge.

### The spreadsheet, and what auditing an id first turned up

- **v0.69.0 The ids under column A** — before writing the exporter, the
  line id was audited against every way a writer can disturb a line, and
  it did not hold: **Enter in the middle of a sentence gave both halves
  the same id**, permanently. `keepOnSplit: false` only bites at the end
  of a block; ProseMirror's default copies every attribute on the other
  path. Two mechanisms now — `transformPasted` clears ids on the way in,
  because that is the only moment the editor can tell an arriving node
  from the one it was copied from, and a sweep repairs whatever is left.
- **v0.70.0 The third door** — Export's third tab. Every string a reader
  sees, not only the spoken ones: titles, prose, choices, conditions.
- **v0.70.1 / v0.71.0 / v0.71.1 / v0.71.2 — four passes at one column.**
  The Keys read as ciphertext (`nanoid()`'s default, taken in the first
  hour of the project and never revisited, because for sixty-nine
  versions nothing outside the app ever read an id). The first two
  attempts were wrong the same way: they asked what an id should LOOK
  like instead of **who reads it**. Then the Lines sheet shipped
  protected — aimed at guarding a translator from a bad sort, and locking
  the writer out of their own export. Then a frozen-pane split drew a
  dark rule down the file that the file does not get to opt out of.
- **v0.72.0 What a locked choice is allowed to say** — a locked option is
  shown on purpose, which quietly made the variable's NAME into prose: a
  player met "Requires knows_roster is true" in the middle of a story.
  Variables have display names now, and Check Story reports a locked
  option whose reader-visible variables are unnamed.

### The Story Graph's wires

- **v0.73.0 A wire that knows what is in its way** — his report: with
  several exits the wires overlapped so badly you could not tell which
  node joined which. Replaced curves with an **A\* router over a lane
  grid** — card edges, margins, anchors and fill lines every 18px, state
  of (node, axis) so a turn can be priced, rip-up-and-retry under a time
  budget. Crossing at a right angle is cheap; running ALONG another wire
  is expensive, which is the distinction he drew: parallel lines that
  overlap read as one line.
- **v0.73.1 A wire follows the card you are holding** — the drag
  regression, and my own wrong conclusion from a correct premise.
- **v0.74.0 The shelf draws the story you actually arranged** — the
  Welcome screen's cached map routes its wires too, in graph space and
  then scaled, because a card there is 20.6×6.4px and the router's
  margins assume a real one.

### The story's own facts, and the report that reads them

- **v0.75.0 The story says what it is** — title, author, language and
  the protagonist's name. Three of the five v0.63.0 audit gaps were one
  gap: there was nowhere to put them. The player is no longer hard-coded
  "You"; the exported page carries a `lang` only when the story has said
  one, because `lang="en"` on a Turkish story is worse than nothing.
- **v0.75.1 / v0.75.2** — a child dialog's way out moved from the footer
  to the header, where Choice Styles had drawn it since v0.55.0; and
  every dialog's backdrop moved to a portal, because `z-[100]` inside
  `.scriare-topbar` (`z-index: 3`) is spent inside a box worth 3 — the
  status bar stayed bright and clickable over the glass.
- **v0.76.0 Who said that** — the fifth audit gap. A speaker lives in
  **four** places (a paragraph, a choice option, a Dialogue line and that
  line's REPLY), and nothing had ever enumerated them. Deleting a
  character silently turned their speeches into narration.
- **v0.77.0 → v0.77.2 Click a line to go there** — the dialog had
  promised that in its own subtitle since v0.36.0 and went as far as the
  scene. Every scene group opens now, each finding carries a one-line
  explanation at rest, and clicking scrolls the editor to the exact
  node and marks it. Three follow-ups in one day, each finding the
  previous one's blind spot: a finding's KIND cannot say which block
  raised it, and the mark must be as small as the fault.

### The third block type

- **v0.78.0 / v0.78.1 The third sibling** — Conditional Text had existed
  since v0.30.0 reachable only by a slash command, so a writer had to
  already know it was there. It is a button now, drawn as exactly the
  same control as the other two, with a real node view: a header that
  names it and counts its conditions, and a footer that closes it and
  says WHEN in words. **His call, overruling mine:** I drew it lighter,
  and he was right that the reason it read badly stacked was that it was
  drawn as a different KIND of thing from its neighbours — a third
  different weight keeps the same mistake in a smaller size. What makes
  it the lightest is what it DOES: it holds prose, so it offers no
  `+ Add` anything, only a way out.


### The stylesheet, and the cascade underneath it

- **v0.79.0 Find & Replace** — a preview of every hit before anything is
  pressed, one undo step across every scene it touched, and mentions left
  alone with the panel saying why. **His wording, twice over:** he
  rejected "will not change" for mentions because they *do* change — by
  renaming the character, which is the only thing that changes one and
  changes all of them at once.
- **v0.79.1** — the Replace preview struck the old words through in
  `--danger`. He asked whether that was right; it was not. `--danger` is
  spoken everywhere else in the app by things that destroy something, and
  a preview destroys nothing.
- **v0.80.0 The story's own stylesheet.** The feature is one promise —
  your rules win, and you never type `!important` — and the rest is what
  it took to make that true.

  **Cascade layers are the mechanism, and the reason is specificity, not
  order.** The app writes `.scriare-prose h2`; a writer writes `h2`. An
  unlayered rule beats a layered one whatever its specificity, so the
  app's stylesheet and the generated Choice Style rules go in layers and
  the writer's CSS does not. Both halves of that are measured in the spec
  before anything is built on them.

  **Choice Styles had to stop being inline styles.** An inline
  declaration beats every stylesheet there is, so while a choice's box
  was written onto the element no writer CSS could have reached it. It is
  a generated rule now, keyed by a class derived from the box's own
  values — a hash rather than a counter, because the export and Play Mode
  collect boxes by different routes and two counters walking a story in
  different orders is the pair that drifts.

  **Tailwind's preflight moved into a layer, and a test sent it there.**
  It sets `background-color: transparent` on every button, unlayered, so
  it outranked the generated rules and a styled choice in Play came out
  with no fill. The whole suite was run against that change alone.

  **The class contract had been claiming something untrue since
  v0.48.0** — that the names are the same in the editor, in Play Mode and
  in the export. Play carried three of them. The claim cost nothing for
  two years and was wrong the moment it was load-bearing.

  **Two decisions he made, both against my first draft:** the stylesheet
  is a door out of Project Settings rather than a document in the Content
  Browser, and Play Mode gets a switch to take it off rather than wearing
  it unconditionally — because the first question when something looks
  wrong is whether it is your stylesheet or your story, and the only
  honest answer is a way to look again without it.

  **The export holds its button** for a stylesheet that fetches anything.
  It is the one place the export stops rather than warns, and the
  distinction is that this changes a factual claim about the file rather
  than a judgement about the story.

### First-run teaching, and the shape it is not

- **v0.81.0 — the three blocks explain themselves.** His question was FAQ
  or step-by-step; the answer was neither, and the research supports it.
  **Arcweave** opens a new account onto a built-in example project ("The
  Castle") with a Blank Project beside it, and sends everything else to
  docs and a YouTube series — no in-app tour at all. **Twine** ships one
  line inside the default passage. Both teach at the point of use and let
  an example carry the rest. A tour teaches procedure to somebody who does
  not yet know why, and is the shape most people dismiss unread.

  **The real defect was that the app said three different things about one
  block.** The toolbar tooltip, the slash-menu description and the block's
  own header were typed separately and disagreed — the Conditional had two
  near-enough sentences, and the Choice button said "Insert a Choice
  Block", which is the app repeating its own noun at the one person who
  does not know it. All four surfaces read from the catalog now.

  **The Choice was behind its siblings again.** No tagline, its count in
  the wrong place, and no `data-choice-block` handle — so the oldest of
  the three was the only one a test could not point at. All three gaps
  were age rather than behaviour.

  **"How Scriare works" is a place, not an event.** Nothing fires it and
  nothing dismisses it: the question is asked more often in week three
  than in minute one.

  **Two placements the app refused, and both refusals were right.** The
  editor toolbar wrapped a row (v0.33.1's reported bug, still guarded);
  the Welcome header holds exactly two actions and a frame asserted across
  three states. The door went to the top bar and to a line under the empty
  shelf.

- **v0.81.1 – v0.81.3 — three things a thousand tests could not see.** A
  dead link on the one screen built for newcomers (the help dialog was
  mounted only inside the project branch, so the Welcome screen's own
  door opened nothing); a stylesheet placeholder that read as real
  content and a HUD printing the literal word "undefined"; then the
  first COMPLETE negative-control sweep since v0.78.2 — 309 controls, all
  caught, nothing found. Finding nothing was the result; every previous
  look had found something. Two of the three defects were found by
  looking at a screenshot, which is the standing argument for a looking
  pass beside the suite.

### The app-wide UI sweep — one walk, two verdicts

His instruction, 30 Sep: merge the UI sweep and the visual sweep into one
pass. **One walk, two verdicts** — each surface is brought onto the kit
and photographed in the same visit, so the structural fix and the
aesthetic note come out of one look rather than two.

- **v0.82.0 One floating panel, and five shadows that were never there.**
  Four menus, three spellings of the same panel. The finding underneath
  was a Tailwind trap: `shadow-[var(--token)]` compiles to
  `--tw-shadow-color`, which is a COLOUR, so five surfaces across the app
  had been painting no shadow at all. `shadow-[shadow:var(--token)]` is
  the spelling that works, and a control proves the unhinted one still
  paints nothing. Also reverted: `.scriare-section-label` on `GroupNode`'s
  rename input, which breaks drag-to-select — kept as an inverse control.
- **v0.83.0 A door is not a field.** His complaint, and the cause was
  shape rather than spacing: a door out of Project Settings and a text
  field were the same object. The three doors are a list at the foot now,
  and the dialog came out shorter than the version it replaced.
- **v0.84.0 The Inspector, counted.** The largest surface in the app.
  Eleven field spellings, one of them painted the colour of the panel
  behind it — a field with no fill, in every theme, since the panel was
  built; three more of the same in the Dialogue's half, found by the
  siblings rule. Fourteen hand-written copies of one small accent button
  across five files. And the count nobody asked for: of twenty-one fields
  with a placeholder, eleven were in Tailwind preflight's `gray-400`
  rather than the app's hint colour — a fixed value that does not move
  when the theme does. The kit owns the placeholder colour now.

- **v0.88.1 The bump that arrived as a reduction.** Retaking the screenshots
  after shipping caught it: v0.88.0's 30% share gave 215px on the window the
  app actually opens at (1280×800 → a 716px column), nine pixels SMALLER
  than the fixed 224 it replaced. The check could not have caught it — it
  asked about columns of 996, 966 and 816, the sizes with room to spare. 33%
  now, and every launch size gains. The launch window is a named case in the
  spec with its own control. Also worth knowing: the share is decided on the
  frame the app opens on and does not chase the window afterwards.
- **v0.88.0 Four verdicts, 1 Oct.** His answers to the visual sweep.
  **The variable readout stays on camera** (it proves the conditions are
  real). **The block buttons stay as they are** — his reasoning better than
  the question: the contrast difference IS the hierarchy, and an insert
  control louder on a pale ground is the control saying what it is for.
  **A stranger lands on Daylight**, decided rather than inherited — the
  default had been `"dark"` since dark was the only theme the app had.
  **The graph opens at 30% of the column**, never more than 40%, his premise
  stated as a rule: write stories, not syntax. The fixed 224px it replaced
  was backwards — 22% of the column at 1920×1080 and 35% at 1024×720, so the
  graph took most space exactly where space was tightest. Default only: a
  dragged splitter is kept, including past 40% (v0.41.0 settled that). The
  floor yields to the ceiling on a very short window, because a rule that
  bends on the hard case cannot be checked. **It shipped as two numbers and
  a control deleted one**: a 40% ceiling clamping a 30% share never fired,
  which is v0.77.x's untestable-second-mechanism pattern for the third time.
- **v0.87.0 Fold the story and it was gone.** The visual sweep's half that is
  Claude's: every surface photographed from the shipped build with the REAL
  Blue Hour loaded. Two bugs, both found by looking at a picture rather than
  by a test, and 1108 tests were green over the first.
  **(1)** Fold every chapter and the graph showed an empty canvas — five
  blocks and eleven bundled wires existed, drawn where their chapters had
  been, while the camera went on framing the area thirty-two cards used to
  fill. Fixed with a deliberately narrow rule (re-frame ONLY when the fold
  left nothing visible), after a first version using `requestAnimationFrame`
  changed nothing because React Flow measures the new node set after the
  frame callback runs.
  **(2)** `tools/shots.mjs` was photographing a three-scene fixture of its
  own, also called The Blue Hour, and injecting empty blocks into the open
  scene — so the first Play Mode shot showed a blank fourth option under the
  three he wrote, a defect that existed only in the photograph.
  **Four judgements were NOT decided** and are recorded in
  `claude/visual-sweep-findings.md`: the graph's default height, the block
  buttons inverting to the heaviest control in the toolbar on light themes,
  the variable readout on camera, and the theme a stranger lands on. Also
  recorded there: his story uses 28 Choices, 12 Conditionals and **zero
  Dialogue blocks** — the one thing Twine structurally cannot do is the one
  thing the demo story does not demonstrate.
- **v0.86.0 Crash-recovery drafts: MEASURED, AND DECLINED — and the hole the
  measurement found instead.** The condition this item carried since v0.47.0
  ("only worth it if something is ever lost to a power cut the atomic write
  couldn't catch") was finally measured. An ordinary edit reaches disk in
  **1.53 s**; a save the filesystem refuses already says so once, names the
  cause, keeps the work, leaves the last good file intact, and heals on the
  next keystroke **1.4 s** after the folder returns. So a journal insures a
  window a second and a half wide — and for a full disk, the commonest cause,
  it could not have been written either, being on the same disk. Declined on
  the record rather than dropped.
  **What the same measurement found:** closing a project after a failed save
  cleared it with no question, while the notice on screen said the work was
  still open. The existing behaviour was a DECISION ("a failed save is not a
  reason to trap the writer in a window they asked to close") that was right
  about the window and wrong about the project. Shipped: one question with
  three answers, every one an exit, including `saveCopyElsewhere` — the
  escape route that already existed and refused to run unless a conflict was
  set. The guard went into `closeProject` rather than beside the close
  button, because a test that called the action directly walked past it and
  so does `useOpenFromDisk`.
  Three mistakes in the measurement, each recorded: `window.api` is a frozen
  contextBridge object so the first failure injection did nothing; `chmod`
  does not stop root, so the second did nothing either; and the new flag was
  set before being read, which would have silenced the app's most important
  notice permanently.
- **v0.85.0 The ✕ that removes a row.** Thirteen copies of one button in
  seven spellings, and the two that most had to agree did not: the ✕ on a
  choice row had NO hover fill while its sibling on a dialogue line used
  `--surface-3`, the colour the same version reserves for the row the
  keyboard is on. Twelve took the kit's new `quietDanger` intent and `icon`
  size — the latter promoted from the Variable Manager, the one site with a
  recorded argument for its target size ("the smallest destructive control in
  the app"). The thirteenth, an entity's alias ✕ inside a `rounded-full`
  pill, keeps its own spelling: a square hover fill inside a round border,
  which makes it the THIRD surface this sweep has found the kit wrong about.
  Four findings about the checks, all four surfaced by controls — a fixture
  with no dialogue block in it, a uniformity check that survives shrinking
  everything, a threshold one pixel too generous, and a height measured
  through React Flow's canvas zoom.
- **v0.85.0 The menu row.** v0.82.0 counted the four floating panels and
  left the rows inside them: four spellings, and one difference that was not
  cosmetic — the row the keyboard is on was `--surface-2` in the slash menu
  and `--surface-3` in the mention menu, so "the row Enter takes" was two
  colours depending on which menu was open, and the speaker menu had it
  inverted (its HOVER used the selection value). Settled by argument rather
  than taste, which is why it needed no verdict: hover and keyboard
  selection can be on screen at once, so they must be two steps of one ramp.
  Measured in all eight themes.
- **v0.85.0 The wires were re-routed on every keystroke.** His brief for
  Auto Layout was faster and smoother with no functional change, and the
  measurement moved the work. **The three suspects this file has carried
  since September are not there**: zero chapter-box overlaps (including
  from five hand-dragged overlapping boxes), zero escaped scenes, zero
  stacked cards, and the identical result to the pixel whatever mess it
  starts from. 14 of 70 wires run right to left, which is the loops. And
  the layout is not the slow part — it is 15–24 ms against the wire
  router's 86–92, which nobody had ever put a number on. The router's four
  rip-up passes are not waste (each re-routes the worst quarter by how much
  they run ALONGSIDE another wire, which is the v0.73.0 distinction), so
  what was wrong is how OFTEN it ran: the route memo was keyed on
  `project`, a new object after every store write, so every letter of prose
  re-routed every wire. Its own comment said "keyed on the COMMITTED
  geometry", which is what it meant and not what it did — word for word the
  comment v0.51.0 found on the nodes memo. Fixed with a stated signature
  and v0.51.0's own reuse mechanism. **The claim could not be checked by
  looking at the wires**, because re-routing unchanged geometry produces
  byte-identical paths, so the first version of that check passed on a
  broken build; the router counts its own calls now, and the spec reports 0
  routes for a rename and 1 for a move.

**The spreadsheet export's schema is settled** — see
`docs/spreadsheet-export.md`, decided 28 Sep: three identifiers (an opaque
Key, an opaque Scene ID, and a readable Ref like `15.D2` recomputed at
export from reachability), seventeen columns, one file per language, an
xlsx for people and a UTF-8 CSV for Unreal's DataTable with the Key as its
RowName. Nothing in the `.scriare` file changes. **A variable's display
name** — so a player stops reading "Requires resolve is at least 3" — is
its own small version straight after.

~~**Next, agreed 27 Sep:** the spreadsheet export.~~ **Shipped as
v0.70.0**, and it took four more versions to get column A right. A
variable's display name — so a player stops reading "Requires resolve is
at least 3" — shipped with it as v0.72.0.

**Where it actually stands, 30 Sep.** There is **no launch-blocking
software left that is Claude's to build.** Of the five launch items,
Export shipped in v0.48.0 and the installer in v0.61.0; the remaining
three — the demo story, the video, the case study — are all his. What is
left on Claude's side is Find & Replace, Custom CSS on export, the
app-wide UI sweep and a short list of housekeeping, none of which blocks
a soft launch. The full list, with effort and trade-offs, was drawn up on
30 Sep.

**The demo story and the example story are the same thing,** his call —
it ships beside the app so a stranger's first ten seconds contain
something rather than an empty Welcome screen. He is writing it here,
migrating from Twine, which is a better case-study line than a Twine
importer would be.

**Opening the example gives a stranger a REAL PROJECT, not a read-only
view** — his call, 30 Sep, and it settles the one open question that item
had. They can write in it, rename it, break it, keep it. So the Welcome
screen's card copies the `.scriare` into their own documents and opens
that copy; the shipped file is never the one they edit, and opening the
example twice gives them two projects rather than one they have already
changed.

The reasoning is the same one behind everything else on that screen: a
story you cannot touch teaches you that this is a demo, and the thing the
example exists to prove is that writing here is easy. The whole feature is
now unblocked except for the file itself.

**Images in scenes: AFTER LAUNCH,** his call on 1 Oct, and the reason is
evidence rather than effort. He wants to see what real use turns up before
deciding what to add or discard. It is the last of the five v0.63.0 audit
gaps still open; the other four are built.

His earlier constraint stands: if they ever land they will not appear in the
Story Graph — it is already tight and the map would have loading problems.

**The file-format call is upstream of everything and is still unmade**,
which is a second reason to wait, because it is exactly the kind of decision
real use informs. Embedded in the `.scriare` means a story file that carries
megabytes; referenced on disk means every export can break when a file
moves. And an image lands differently in all four exports: the HTML export
must inline it as base64, so a 2 MB photo becomes ~2.7 MB of text in a file
whose whole promise is one request; PDF is fine; .docx is awkward, because
Word has no `break-inside` and an image is an unsplittable block of unknown
height against v0.64.0's page rules; and the spreadsheet exports the strings
a reader sees, which an image has none of — so **alt text stops being
optional** and becomes the only translatable thing about it. Play Mode needs
it too, or a writer places images blind.

### The standing position from here, stated 1 Oct

**Features after launch are decided on evidence, not on the list.** His
words: he wants to see the results of real testing before adding or
discarding anything. Everything in the After-launch group is a guess about
what a writer will want, and the launch is about to start answering that for
free — so this file's remaining feature items are candidates waiting on
evidence rather than a queue waiting on time.

The one exception is the one it has always been: **a defect found by
measurement gets fixed whatever the list says.** That is what v0.86.0 did —
crash-recovery drafts were declined on the measurement and the hole the
measurement found next door was fixed the same day.

1117 tests, 342 negative controls (as of v0.88.1).

**An honest note about v0.42–v0.46, kept because it was right.** Five
versions, none of them on the launch list. They were real improvements and
the themes in particular buy a lot for a video and a portfolio page, where
the app is judged on a still frame. But the Export button had been disabled
since the beginning, and until it wasn't, nobody could try this without
installing an unsigned .exe from a stranger. v0.47.0 and v0.48.0 were both
launch-list work, and the button is live.

## v0.37.0 — the decisions, for whoever picks this up next

His answers set the shape; the mechanism was left to Claude.

- **A spoken line is a PARAGRAPH WITH AN ATTRIBUTE**, not a new block and
  not a scene mode. A block would make every speech an island the toolbar,
  find, undo and the runtime's prose pass each need a second version of —
  the trap v0.32.0 dug the Choice Block out of.
- **`Speaker` is `null` | an entity id | `"@player"`.** One attribute, no
  `{kind, id}` pair: the `@` can't collide with a nanoid. The player exists
  because he asked for it — "the player might be the speaker so the
  designer doesn't have to assign a character with a name all the time."
- **Only a Character can speak** (v0.37.1, `canSpeak` in types/speaker.ts).
  Locations were offered purely because they shared a list, and İstanbul
  turned up announcing a line. Asked as a function at every door, so Notes
  and Assets will be silent by default when they arrive.
- **Authoring is `@` at position 0 of the line or choice** — whether or not
  the line already has words in it (v0.37.2; requiring an empty line was
  the bug he reported, since you normally write the line THEN say who said
  it). Shift on confirm writes the name instead, for "Mara had been
  waiting." Enter carries the speaker via `keepOnSplit`; Backspace at the
  head drops it; clicking the name changes it. No toolbar control.
- **The name in the editor is a DECORATION, never document text**, so it
  can't be half-deleted and it re-reads the current name on every draw.
- **Play Mode prints the name only when the speaker changes.** Choices
  always announce theirs.

One negative control refused to go red: the Enter keybinding that carried
the speaker forward had never done anything — Tiptap's `keepOnSplit`
already did it. A keybinding, a priority override and a suggestion-menu
guard were deleted and replaced by one declared line. It removed code
rather than adding a test.

## v0.38.0 — Find

- **One box, not two.** The Content panel's existing "Search Story" filter
  became the search: the tree above answers "which scenes are CALLED this",
  new sections below answer "where do these words APPEAR". A second search
  box would have made "search" mean two things you must choose between
  before typing.
- **Sections, not a flat list**: `In the story` / `On pages`. A line a
  character speaks and a note on that character's page are different kinds
  of answer.
- **Clicking a hit selects the words**, not just the scene — so the next
  keystroke replaces them. Positions are computed from the STORED JSON by
  duplicating ProseMirror's node-size arithmetic (text = length, atom = 1,
  block = 2 + content) and verified against the live editor in a test,
  because a mention reads as eight characters and occupies one.
- **`utils/textFold.ts`** now holds the one Turkish-aware folding used by
  both the `@` menu and Find, plus `foldWithMap`/`foldedMatches` — folding
  isn't length-preserving, so a folded index is not an original index, and
  decomposed text (pasted from anywhere) is where that bites.
- **Entity names and aliases are findable** — nothing else searched them,
  since the tree filter is scoped to the Story category.
- Panel stays open after a click; Escape clears. 200-hit cap, reported.

Two negative controls came back green and were gaps in the TESTS, not the
code: a shortcut tested by poking the store behind it, and an index map
nothing decomposed was exercising. Both now tested by the key and the text.

## The Story Graph's map — v0.39.1 through v0.43.0

Three answers to one question, and the history is the useful part.

- **v0.39.1** replaced full sentences on every wire with a bare ordinal, a
  sentence on hover drawn at a fixed SCREEN size, and the sentence on a
  selected scene's wires above 0.8 zoom. Held at screen size for selection
  instead, three labels on one scene's wires are three banners across a
  zoomed-out map; that was built, looked at, and rejected on the screenshot.
- **v0.43.0** cut it back to one label that always says the same thing,
  "Choice 1", hidden below 0.7 zoom. A label that rewrites itself as the
  pointer moves is a label you have to chase, and the sentence is one
  double-click away in the scene. His words: "get rid of the labels, just
  using choice 1 or choice 2 over the links seems beneficial."
- **v0.43.0's layout** was the deeper fix. dagre minimises total edge
  length, which is right for a flowchart and wrong for a story: it put each
  of a scene's three choices in a different column so the long branch and
  the short one met neatly at the merge — a staircase. Ranking by story
  depth puts them in one column. A straightening pass then pulls a scene
  onto its feeders' line when they all share one, which is what fixes the
  spine-with-skip-links shape his own story has. **He wants to look at Auto
  Layout again** — this is not finished business, and the demo story at full
  size is the honest test case for it.

## v0.40.0 — the look, and v0.44.0 — the themes

Chosen from mockups, in three rounds: three whole-app directions, five
colour overlays, then four *finishes* on the winner. He picked **A · Quiet**
(structure and craft, no hue) and then **A1 · Lifted** (depth) — so the
interface stays monochrome and the elevation does the work.

- **Elevation is a token set with per-theme values.** A dark-theme black
  shadow on a light-theme page reads as dirt, so light has its own.
- **The writing surface is a page** — a sheet with an edge, a shadow and a
  lit top edge. Its width is the reading column *plus* the margin it adds,
  so the measure a writer sees never changed. As of v0.44.0 it is painted
  with its own `--page` token: it was drawn in `--surface`, which on a light
  theme is darker than the ground, so the paper was dimmer than the desk.
- **Ghost controls stay flat; bordered controls lift.** The contrast is
  what makes the treatment legible at all.
- **The side panels do NOT cast inward.** Tried, reported, measured and
  removed.
- **A theme tints the room, not the content** (v0.44.0). Colour stays
  reserved for what the writer assigns meaning to; the eight themes put hue
  in the ground, and the accent — selection, focus, primary action — is the
  one piece of chrome that carries one. `--danger`, `--success` and
  `--warning` mean the same thing in all eight and are tuned per ground.
  **This rule is also why the export does not ship the writer's theme** —
  see `claude/export.md`.
- **Palettes are measured, not eyeballed.** The suite paints each token and
  reads the pixel back: contrast floors where text is read, perceptual
  lightness gaps for borders, and a walk of every surface for colours that
  aren't in the palette at all.

## Mobile and cloud — explored, and mostly declined

Asked 17 Sep: would Scriare work on Android, would a lite version help,
should there be cloud storage. Explored in full; the conclusion is short.

- **A port is a second product.** Electron doesn't run on Android at all;
  a WebView shell (Tauri 2, Capacitor) could host the renderer, but the
  four-region layout IS the product, every graph gesture is mouse-shaped
  (right-click pan, box select, Alt to bypass the grid, resize handles),
  and Tiptap on a soft keyboard is where this kind of port usually dies.
  6–10 weeks, competing with the launch.
- **The phone audience is READERS, not the writer.** Which means the mobile
  story was always a launch-list item, and it landed in v0.48.0: the HTML
  export is responsive, because someone taps his portfolio link on a train.
  Nothing else needed.
- **A lite companion** (read + append prose, or a status view) is plausible
  and unnecessary. Nothing is running that needs controlling — no builds, no
  server, no collaborators.
- **A sync service is a business, not a feature.** Live collaboration is a
  CRDT rewrite of how the editor writes to the store.
- **A synced folder already IS the cloud storage** — and it is what he
  already uses. Making it safe was the one real piece of work, and it
  shipped as v0.47.0.

## Milestones

No dates. Sizes are sessions; the order is what matters.

### Next — agreed

- ~~**Installer.**~~ **Built in v0.61.0**, and the last piece of software
  on the launch list. What remains is not building but CONFIRMING: the
  packaged artifact can only be produced on Windows. **He ran it on 27 Sep
  and it built.** What the build turned up was not the installer but the
  boot: opening a story flashed the empty Welcome first, fixed in v0.62.0.
  Still worth confirming when convenient: the uninstaller, and exactly
  what SmartScreen says so the README can quote it rather than guess.

- **Three ideas of his own, mocked up before any code** (the G boards on
  the design canvas), in this order:
  1. ~~**Play Mode on a reading ground**~~ — shipped as v0.57.0. His
     words, choosing it: "Idea 2 is the easiest one but if I wanted it to
     be easy I wouldn't want to build an app."
  2. ~~**In-place choice options — the Dialogue.**~~ — shipped as
     v0.66.0, built as M2 of four drawings. The notes below are kept as
     they were written; the one thing they got wrong is the estimate of
     what the graph badge would say (`◆ 4 in-page · 1 exit` — the count is
     of exits, singular when there is one). An option that adds a
     reply to the page instead of turning it, Disco Elysium / Narrat
     style. The one thing on this list Twine structurally cannot do.
     SMALLER THAN FIRST ESTIMATED: `ConditionalBlock` already exists and
     is registered in the runtime, and an option already carries
     `actions`, `conditions` and `whenUnmet` — so the shape is already
     buildable by hand at the cost of one invented variable per line. The
     feature is therefore "remove the bookkeeping", not "build an
     engine". Two directions were drawn (G5): sugar that writes the
     hidden variables for the writer (~1 session, and the Variable
     Manager tells on it), or a block of its own (recommended, 2–3
     sessions). **Named the Dialogue on 27 Sep**, his call — the word the
     field already uses, and a block a narrative designer meets for the
     first time should be a word they already own. One thing to settle
     while building it, since the word now does two jobs: a scene already
     CONTAINS dialogue, so the block's wording has to say it is a
     conversation that stays on the page rather than "where dialogue
     goes". The two decisions that are not code are settled on G6 —
     the graph draws ONE BADGE on the node ("4 in-page · 2 exits"), not
     silence and not a self-loop; and Check Story re-states one rule, *an
     option is an edge only if it leaves*, which yields two new warnings
     ("this conversation cannot be left", "this line can never be said")
     and leaves reachability more accurate than before.
  3. **Custom CSS on export.** Committed to — his words, "now or later,
     we are going to implement a custom CSS" — and deliberately last,
     because it is the only one of the three where the honest sentence is
     "Twine already does this". Three things it commits us to (G2): the
     class names become a published contract; the contrast check has to
     start sampling the finished file instead of checking tokens, or the
     one safety net is aimed at a page we do not ship; and the resolution
     order — ground, then the story's Choice Style, then the writer's CSS,
     which wins — has to be stated rather than discovered.

**Done since this section was last written:** save safety (v0.47.0),
Export (v0.48.0) — both from the launch list — the audit pass
(v0.49.0), its own two data-loss bugs (v0.49.1), tier 4 (v0.50.0),
tier 3 (v0.51.0), tier 5 plus the repository tidy (v0.52.0), and the
Welcome screen (v0.53.0–v0.54.0). **The v0.48.0 audit is closed.**
Everything left is the launch list — and of the five items on it, only
the installer is Claude's to build.

### The colour question, settled

He asked whether the eight themes mislead a writer about what a reader
sees — a dark colour picked in Overcast being unreadable on Night. The
answer, and it is now the app's stated position:

- **The two stay split.** A theme is the writer's room; a ground is the
  reader's page. Merging them would make a colour survive EIGHT grounds
  instead of two, and the reader still chooses which one they read on, so
  the writer would control less, not more.
- **The split costs nothing until you colour something.** Prose with no
  colour mark carries no colour in the file: it is painted in the ground's
  own `--text-reading`. A writer who never picks a colour never meets a
  ground, a theme question or a warning.
- **The one place they meet is the moment a literal colour is chosen**, so
  that is the only place the app mentions it — one glance, not a lecture.
  That is v0.58.0.
- **Custom CSS stays the writer's own responsibility**, his call: one
  warning, and then the app gets out of the way. The G2 commitment holds —
  that warning has to sample the finished file's real pixels, since
  checking tokens while a stylesheet overrides them is a safety net aimed
  at a page we do not ship.

Not built, and drawn only when the need is real: a colour that says what
it is on EACH ground, or a story that pins the ground it is read on.
Either would resolve the empty 4.5:1 band; neither is worth inventing
before a story exists that needs it.

### Also in flight

- **His verdict on the eight themes.** All eight ship; the picker is in
  Settings. Open questions he raised: whether **Overcast** reads as the
  mid-tone it was meant to be (it comes out closer to "light app with a
  slate frame"), and which theme the app should DEFAULT to for a stranger.
- **His verdict on Paper and Night.** New with v0.48.0, and the two things
  worth his eye: whether Night's body text at 11.4:1 reads washed (it was
  pulled down from 15:1 deliberately, to stop halation on a phone), and
  whether the accent doing double duty as the speaker-name colour is enough
  of a signal or whether speaker names want weight instead.
- **Auto Layout, round two.** His words in September: "we will need to
  investigate the behaviour of the Auto Layout further." v0.43.0 fixed the
  ranking; what to look at next is how it handles merges, loops, and
  chapter boxes whose contents are laid out before the box is sized.
  **Now confirmed at scale, 28 Sep:** it holds on small stories and
  "started to shatter" on The Blue Hour's 32 scenes, five groups and 70
  choice options — which is the story that was built to judge it on, so
  the condition for doing this work is met. The likely suspects, in the
  order worth measuring: dagre ranks a merge (several scenes leading to
  one) by its longest path, which drags the merge point far right and
  stretches every wire into it; loops back to an earlier scene have no
  rank at all and get placed as if they were forward edges; and a group's
  rectangle is sized after its contents are placed, so a chapter box can
  end up overlapping its neighbour. **A rewrite is not the first move** —
  the first move is a measurement: lay the demo story out, record edge
  crossings, total wire length, and how many nodes land inside a box they
  do not belong to, so "better" has a number rather than an impression.

### Launch — the list that decides when it ships

1. ~~**Export.**~~ **Shipped in v0.48.0.** One self-contained HTML file, no
   network requests, responsive. The class contract is real and documented
   (`.scriare-scene-title`, `.scriare-prose`, `.scriare-choice`,
   `.scriare-choice.is-locked`, `.scriare-speaker`, `.scriare-mention`,
   `[data-type="callout"]`, `.scriare-ending`), and the page ships tokens
   rather than baked colours precisely so the CSS tab can override one line
   and recolour everything. The theme question was answered **two
   purpose-built reading grounds, not the app's eight themes**; the full
   argument is in `claude/export.md`. The project JSON was always the save
   file, and as of v0.48.0 it is `.scriare`. **The export is the front
   door**, not the installer: a link that plays in a browser has no
   SmartScreen warning and needs no install.
2. ~~**Installer.**~~ **v0.61.0.** electron-builder, Windows NSIS plus a
   portable build, unsigned, per-user and assisted with no elevation. The
   `.scriare` association is registered AND answered: single-instance lock,
   second-instance handler, macOS open-file, and a launch-time path the
   renderer asks for. The README states the SmartScreen warning rather than
   pretending it will not appear. Still positioned behind the playable
   export link, which needs no install and raises no warning. **Awaiting
   his run on Windows** — the artifact cannot be built on this machine.
3. **The demo story** — a **vertical slice**, 30–40 scenes, decided 17 Sep;
   full scope and the two risks it carries in `claude/demo-story.md`. He
   writes it; Claude supplies a structural scaffold at most, never prose.
   The two things that decide whether it reads as a slice or as abandoned:
   a written ending (*End of Act One*, not a scene that ran out of choices)
   and a clean Check Story report. Film the graph FOLDED — four chapter
   boxes, then one unfolds — or a 35-scene map is noise on video.
   `other_materials/what-the-ledger-says.json` is a 13-scene reference for
   voice and structure, not a replacement.
4. **The video.** Script and shot list are written; this is recording time.
   The theme picker is now a good ten seconds of it, and so is exporting
   the story and opening it in a browser — which is the shot that explains
   what the app is for faster than any narration.
5. **Case study finishing** — screenshots from his own story, the README
   image, and the AI-credit line, which is his call.

**Optional, if 2 lands cleanly:**

- **CSS tab** (SugarCube-style stylesheet for the exported build). *~2
  sessions*, and now unblocked: the class contract exists and is documented
  in `claude/export.md`, and the exported page is built from tokens
  specifically so one override recolours everything. It must apply to Play
  Mode too, or a writer is styling blind.
- ~~**Script export**~~ — **shipped in v0.64.0**, and it took rather more
  than the half session it was sized at, most of it spent finding three
  ways the tests were passing for the wrong reason.

### Post-Launch

Nothing here blocks the launch, and nothing here gets started before it.

- **Engine integration.** Three honest tiers, and the first is the one to
  do: a **documented JSON schema plus a reference Unity runtime** (one C#
  file that reads the export and runs conditions, variables and routing,
  with a demo scene) — *~1 week*. A proper Unity package with an editor
  window is *+2–3 weeks*. An **Unreal plugin** (C++/Blueprint, built per
  engine version, needs UE installed) is *3+ weeks minimum* and largely his
  own hands, since Claude can't compile or test it from here. The schema is
  `claude/file-format.md` and the `.scriare` file already is it.
- **Entity variables** — `Mara.Trust` from a per-category template, edited
  in the Variable Manager as sections, picked in two steps (who, then
  what). Design settled. Deep, invisible in a 90-second video, and pays off
  at a scale the demo won't reach.
- **Ink / Twine export.** *1–2 sessions each*, and lossy — which means
  documenting what doesn't survive the trip.
- **Find & Replace.** Needs its own undo story and a preview first.
- **A named player.** The printed name is hard-coded "You"; a project
  setting ("Detective", "Ben") belongs with the other story settings.
- **A story's language.** The exported page ships with no `lang`, because
  `lang="en"` would be wrong for a story in any other language and a wrong
  one is worse than none. A project setting solves it in one line.
- **Check Story and speakers.** A line attributed to a deleted character
  silently becomes narration.
- ~~**Choice Style defaults are dark-theme colours.**~~ **Corrected while
  building Export.** `DEFAULT_CHOICE_BOX` was never a hex: it is
  `var(--surface-2-translucent)` / `var(--border)`, written in variables in
  v0.34.0 exactly so an untouched choice follows the theme. The `#2a2a28` /
  `#3a3a37` are only the fallback SWATCHES the colour picker shows. The
  narrower trap underneath it — opening that picker converts the variable
  to a hex permanently, in the story file — is **closed**: v0.55.0 says so
  at the moment it happens, with an Undo that restores the variable, and
  v0.58.0 adds the reading on both grounds beside it. Nothing left here.
- **A UI pass on the oldest surfaces** — ~~Welcome screen~~ (v0.53.0–
  v0.54.0), ~~the dialog kit, Project Settings, New Project, Move To,
  the confirm dialog and the Variable Manager~~ (v0.56.0), ~~the four
  floating menus~~ (v0.82.0), ~~Project Settings' doors~~ (v0.83.0),
  ~~the Content Browser's buttons~~ and ~~the Inspector's field stack,
  its accent buttons and the app's placeholder colour~~ (v0.84.0).
  WHAT IS LEFT: the content context menu (v0.18.0, the oldest version
  note in the codebase), the slash-command menu, `GroupNode` (v0.28.0),
  and the editor's three block views — which share a button with the
  Inspector and so were half-swept by v0.84.0 already.

  **The line this sweep keeps proving:** "bring it onto the kit" is not
  the same instruction as "apply the kit's class". Three surfaces so far
  were RIGHT to differ — `GroupNode`'s rename input (the shared label
  class breaks drag-to-select), the Content Browser's search field, and
  an entity page's empty alias pill — and finding where the kit is the
  wrong answer is part of the job. The sentence to beware of is one the
  previous version left behind: v0.81.2 called `--text-3` "the colour
  every other placeholder in the app uses" and it was untrue of eleven
  of the twenty-one.

  **And the sweep keeps paying beyond its scope.** v0.82.0 found five
  shadows that painted nothing; v0.81.1 a dead link on the Welcome
  screen; v0.84.0 four fields with no fill across two panels and eleven
  placeholders in Tailwind's grey rather than the app's.
- ~~**The wordmark in the top bar**~~ — **done in v0.68.0.** Drawn inline
  and filled with `currentColor` so it takes the theme's accent, the
  letterform cut through as a hole, aligned to the cap band of the word
  beside it (it sat 2.5px low), and the viewBox padded by 6% because the
  artwork's circle was tangent to its own element's edge — which at 24px
  is what read as "the top and bottom are cut off". The two baked SVG
  variants are gone from the renderer; the OS icon is still a fixed asset,
  as it must be.
- **Crash-recovery drafts** — the autosave journal deliberately left out of
  the save-safety work. Only worth it if he ever loses something to a power
  cut that the atomic write couldn't catch.

## The launch itself

Non-negotiable, his words: **the video**, **the written case study**, and
**the demo story written and playable**. The installer can move; "the
application must at least look solid" is the bar for everything else.

Most of the case study is already written, in the changelog entries: each
one is a decision plus the reasoning behind it, which is what a case study
is. Assembling rather than inventing is the job. The strongest entries are
the ones where a reported symptom had a different cause than the obvious
one, and the strongest single idea is v0.43.0's: a layout engine that
minimises edge length is correct for a flowchart and wrong for a story.
That is a game-studies argument — authoring tools shape what gets authored
— and it is the thread to pull if the app ever needs to carry a research
angle for a Master's application.

v0.48.0 adds a second thread of the same kind: a theme is chrome and a
reading ground is content, and a tool that ships the author's working
environment as the reader's has confused the two. That is the same argument
about authoring tools, pointed at typography instead of at graphs.

Worth saying out loud in the case study: 567 tests against the real packaged
app, every load-bearing one confirmed to fail on a deliberately broken
build. Most solo projects can't claim that; most professional ones can't
either — and v0.49.0 is the honest footnote to it, because a green suite of
411 checks had nothing to say about six different ways the app could lose a
writer's work.

A one-page brief for talking about the app publicly — what it is, why it
exists, lines that can be used in a tease — lives in
`claude/project-brief.md`.

## Standing preferences

- Ask with multiple-choice questions rather than long prose ("ask me like
  ASK"). He picks or redirects.
- Precise code first, brainstorming second (~80/20 by his own split).
- Every version: negative-controlled tests, a changelog entry written as
  reasoning rather than a one-liner, version bump, delivered to his machine.
- Reproduce reported bugs by measurement before fixing them. Every bug
  reported this month was real and subtler than it first looked — and more
  than once the reported symptom had a different cause than the obvious one
  (the dock toggles were a CSS substring match; the folded group was the
  drag commit, not folding).
- When a UI decision is contested, build an interactive mockup artifact of
  2–3 directions against real data rather than arguing in prose. Cheaper
  version of the same rule: screenshot the candidate against the real story
  before committing to it.
- A negative control that passes is a finding about the TEST. Examples
  worth keeping: a "far edges on the grid" assertion that couldn't tell
  corner snapping from size snapping; a "reads as a button" check that
  accepted a transparent border; a palette audit that only ever looked at
  one screen; and, in v0.48.0, an injection test that put `</script>` in
  prose, where Tiptap had already escaped it, while the real hole — a scene
  *title* — stood unwatched.
- **A FIXTURE THAT AVOIDS THE AMBIGUOUS CASE TESTS THE EASY HALF.** The
  sharpest lesson of the v0.75–v0.78 run, hit four times in a week, and
  worth the case study on its own. A speaker-anchor check wrote
  `attrs.id` in its own fixture — an attribute no node type in this app
  uses — so the walk and the fixture agreed with each other and with
  nothing else, while every anchor in every real story was null. A
  Dialogue check clicked a `dialogue-dead-gate`, a kind only a Dialogue
  can raise, so the table it was meant to test was never asked the hard
  question. A slash-menu check read every button on screen and matched
  the toolbar's own button. And a caret-lands-inside check focused the
  editor first, where inserting at a caret already in the prose lands
  correctly by accident. Every one passed. Every one guarded nothing.
- **A SECOND MECHANISM ADDED "TO BE SAFE" IS UNTESTABLE BY
  CONSTRUCTION.** Three times in v0.77.x a belt-and-braces line turned
  out to be only braces: its negative control would not go red, because
  the first mechanism already produced the result. Code that cannot be
  observed is code that drifts, so it was deleted rather than kept. The
  only way to find out is to try to break it.
- **A control can be wrong in a FOURTH way: its own `expect` string.**
  "A + New that cannot make everything the tree holds" reported NOT
  CAUGHT for eighteen versions while its sabotage worked perfectly and
  the check caught it every time — the check had been reworded in
  v0.60.0 and the control was still looking for the old sentence. The
  runner now tells "nothing failed" apart from "something failed, but
  not the thing you named", because they are different problems.
- **A skip that is implemented as a pass is a lie the suite tells
  itself.** perf.spec's two timing thresholds were written as
  `check(name, !quiet || cost < threshold)`, which passes on a loaded
  machine. This container's floor measures ~480 ms against a QUIET_FLOOR
  of 45, so they had never once asserted anything here and the README
  counted them. They are logged rather than checked when the clock
  cannot resolve them (v0.78.2).
- **Reviewing the diff finds things the tests do not.** v0.47.0 turned up
  three defects that way and v0.48.0 three more, including an export that
  reused the save path and brought a `.bak` along with it.
- `SPEC=<name> npm test` runs one spec file, for negative controls;
  `node tests/negative-controls.mjs` (with `ONLY=<spec>`) runs the sabotages
  themselves. CI still runs everything.
- A negative control can be wrong in three ways, and v0.49.0 hit all
  three: a sabotage that changed nothing (a comment inserted above the
  fixed line instead of the line being removed), an assertion still
  looking for a filename the code no longer writes under any
  circumstances, and a spec that threw instead of failing when the file
  it read was missing. The runner now pre-flights every control's "before"
  text before it sabotages anything — which also catches a previous run
  killed mid-control and leaving the shipped source broken, as happened
  once this round.
- `node tests/negative-controls.mjs --restore` puts back anything an
  interrupted run left sabotaged; `SKIP=` and `TAKE=` split a long
  control run into pieces that finish inside a shell's time limit.
- **Reading the diff back cold finds what tests written alongside the fix
  cannot.** v0.49.0 added a regression test per fix and still shipped two
  new data-loss bugs; its save tests exercised the stamp during an
  in-flight save and never the close. A test written from the same
  understanding as the fix tests the shape the fix has, not the shape the
  bug had.
- **A spec that leaves the app in a bad state does not fail — the next one
  does**, somewhere else, for reasons that look nothing like it. Specs
  share one application instance, so any spec that mutates global state
  hands it back seeded. A fixture built by spreading a closed project's
  `null` cost most of an afternoon this way.
- **Assert what is painted, not what the browser matches.** v0.50.0's
  focus-ring checks first asserted `:focus-visible`, which is Chromium's
  heuristic rather than the app's behaviour — and a synthetic
  `new MouseEvent(...)` does not reproduce a real click at all, because
  untrusted events make the focus that follows score as programmatic. A
  check built on either would have sent me to fix an app that was
  behaving correctly.
- **A test that calls the utility is not testing the caller.** Two
  Inspector checks passed the mention resolver in themselves, so both
  negative controls reverting the Inspector's own call sites went
  uncaught. Read the rendered surface when the bug is in a call site.
- **Measure before optimising, and be ready for the audit to be wrong.**
  v0.51.0's tier 3 named three hot paths: one control did not exist, one
  cost nothing measurable, and the third was real but blamed on the wrong
  cause. The actual bottleneck — the Story Graph rebuilding every node and
  edge — was not on the list at all.
- **A/B measurements must be interleaved, not run one after the other.**
  Measuring open-then-collapsed gave −7.9 ms and +17.2 ms for the same
  build on the same day; alternating and taking the median of paired
  differences cut the spread to ±1 ms.
- **When the clock cannot resolve the effect, assert the mechanism.** The
  graph resolves to ±10 ms and the fixes were worth 24 and 11, so no
  threshold separates them. Identity reuse has the same answer on any
  machine, so that is what the tests and controls check; the timings stay
  as documentation and say out loud when the machine is too loaded to
  judge.
- **When a test refuses a placement, the test is usually holding
  something somebody already paid for.** Two of this feature's three
  doors were rejected by checks that existed because of an earlier bug
  report and an earlier design decision. Moving the control was cheaper
  and more correct than loosening either.
- **A claim nobody depends on is a claim nobody checks.** The class
  contract said its names were the same in three places, and for three of
  them it had been false since the day it was written. Nothing caught it
  because nothing rested on it — and the moment something did, it was
  wrong. Documentation that states a property no test asserts is a note
  about intentions, not about the code.
- **A control that only breaks the whole arrangement passes while most of
  it is broken.** The cascade here has three independent parts, so there
  are three sabotages rather than one. Two of the first drafts named
  changes that did not actually break the claim, and went uncaught
  correctly.
- **Some properties remove a failure mode rather than create a testable
  one.** "The box class is derived from the values rather than a counter"
  cannot be watched to fail, because both surfaces call the same
  function; what CAN be watched is two different styles collapsing into
  one class. If a control will not go red, ask whether the property it
  names is observable at all before assuming the test is at fault.
- **The design documents live in two places now**, and the project
  workspace is the source of truth. The repo's `docs/` is a snapshot
  mirrored at release time — so a doc edited here is stale there until the
  next version ships, and refreshing the mirror is part of shipping.
