# Changelog

Every released version of Scriare, newest first.

Entries are one or two sentences. The reasoning behind the bigger decisions
is in [CASE_STUDY.md](CASE_STUDY.md); the long-form notes each release was
originally written with are preserved in this file's history.

Versions are not dated — the project was built in a continuous run rather
than on a release schedule, and inventing dates would be worse than
omitting them.

---

## v0.65.0 — The choice editor says what a choice does

I2, finally applied where it was always meant to go, plus the page-density
fix v0.64.0 earned by being looked at.

**What was there:** six labelled fields at one weight — Display Text, Who
Says It, Appearance, Destination, Conditions, Actions — stacked in a 320px
column, inside an accordion, inside a list of accordions. The scene panel
got its headings in v0.59.0; this did not.

**Three groupings were drawn first** (board L, at the panel's real width,
with real choices out of The Blue Hour), and the one chosen is not the
most explicit. **The grouping was never the problem.** The problem was
that a choice with nothing set looked exactly as complicated as a choice
with a locked condition and two effects — and most choices have nothing
set. Four headings would have made that worse by adding a heading and a
divider to sections that are empty.

**So an unset rule is a sentence.** *Shown always.* *Changes nothing.*
One grey line with the way to change it beside it, instead of a heading
over an empty control. Those are facts about the choice, and they are
exactly the two facts a writer would otherwise open two sections to
confirm. It is the rule the status bar already follows when it counts
notes only if there are notes.

**Three headings, his words:** **The Line**, **Shown**, **Changes** — and
a heading only appears once it has something under it. Inside The Line the
labels moved beside their controls rather than above them: three stacked
label-over-control pairs cost six rows of height to say three words, in a
panel whose whole problem was height.

**The closed row keeps its chips**, his call. They are the only way to
read a block of six choices without opening six.

**And the script stopped starting a new page for almost every scene.**
v0.64.0 kept any scene of seven blocks or fewer whole, which in practice
meant nearly all of them — so 3,300 words printed as 29 pages, most of
them half empty. The threshold is three now: it catches only what it was
for, a scene of two lines and a choice block that would look absurd split.
The same story is 22 pages, and **13 of them carry two scenes or more**,
which is the assertion that replaced counting pages — a page count is
brittle, and "do scenes share a page" is the thing that actually changed.

The finer rules do the work his request was about and are untouched: a
heading is never last on a page, a cue is never parted from its line, a
choice block is never split.

**Two things the tests found about themselves.** The spec first built its
choice block straight into the store — but the Inspector patches a choice
through the mounted editor, so every read passed and every write silently
did nothing. And `[data-option-id]` matches the option's node view in the
editor as well as its row in the Inspector, so the unscoped selector
handed back the editor's copy, whose first button is the one that DELETES
the option: the spec removed the choice it was about to read. Both now
state themselves — the spec checks the editor is holding the block before
it asserts anything, and every query is scoped to the panel.

Six negative controls, all caught; one new spec (17 checks). 704 tests.

---

## v0.64.0 — The story, on paper

A script is linear. A branching story is not. This is the first of the two
honest ways to print one — the second, a proper spreadsheet for
localisation and VO, is a separate feature with a separate file type and is
committed to rather than cut.

**Two layouts, two formats, drawn before any of it was written** (board K,
rendered from the real fixture rather than from lorem ipsum, because the
question was about where conditions and locked choices land on a page and
lorem ipsum never locks a choice). **Screenplay** — slug lines, centred
cues, indented dialogue — for handing to a reader. **Production script** —
every line numbered `22.3`, `26.C1`, speakers in their own column,
conditions on their own rows — for handing to anyone who has to do
something with it. Each writes **PDF or .docx**.

**One model, two renderers.** The project is walked into a
`ScriptDocument` once and nothing downstream looks at a Tiptap document
again. Four ways to get the same story onto a page is four chances for
them to disagree, and a PDF and a Word file that differ by one line is the
kind of bug nobody finds until somebody records the wrong take. Even the
*wording* of a condition is shared: "locked unless resolve is at least 3"
is composed in one place, so the two files cannot phrase it differently.

**The order is the Content tree**, his call — chapters top to bottom, each
starting a fresh page. A walk of the graph reads closer to play order right
up until the first loop, and a story with loops has no correct linear
order, only a rule. The tree is a rule the writer can see and change, and
it has the property a script needs most: export twice, get the same
document. Scenes the tree does not mention are printed at the end under
their own heading rather than dropped.

**The page rules are the feature.** His words asking for it: *"some
branches could go off the page, make it seem organized regarding the pages,
don't wanna see it clutter in the page ends."* So a chapter always starts a
page; a scene short enough to fit is never split; a heading or a cue can
never be the last thing on a page; a choice block and a gated passage are
atomic. Word has no `break-inside`, so every one of those had to be rebuilt
out of `keepNext` and `keepLines` — which is why "is this scene short
enough to keep whole" is decided in the model rather than in the CSS: the
renderer that cannot express the rule still has to obey it.

**The PDF is printed, not generated.** An offscreen window loads the page
and Chromium's own paged-media engine decides the breaks. Writing a PDF by
hand with a library would mean re-implementing pagination, badly, in the
one place the writer will notice it.

**Hidden choices print.** A locked choice is shown to the player, so it
obviously prints. A hidden one the player never sees — but a translator
still has to translate it and an actor still has to record it, and leaving
lines out of a script is how lines go unrecorded. It prints marked.

### Three false greens, and what they cost to find

**The page-end assertions could not fail.** `pdftotext` returns the running
footer like any other text, so "the last line on the page" was always
"Blue screenplay full   7". Four assertions about what a page may end on
were describing the rules rather than testing them, and the two negative
controls aimed at them came back green.

**The real story was too well behaved to test the rules.** Every scene in
the fixture is short enough that the whole scene is wrapped as one
unbreakable block, which quietly subsumes the finer rules. A 40-scene
stress script had to be built inside the spec, with scenes deliberately
past that threshold.

**And the rules are now measured against a control**, the way a drug is:
the same script is printed twice, once with the page rules and once with
them neutered, and the difference is the assertion. The control render
states its own precondition — without the rules it splits seventeen choice
blocks, and if it ever splits none the spec says so rather than passing.

One control was **retired with its measurement**: printed through this same
path, a 17-page document of 40 headings strands one without
`break-after: avoid` and none with it, so the rule is real — but one in
seventeen pages is too rare for a suite to see reliably. A control that
comes back green because the event is rare is worse than no control,
because it reads as proof.

**And a bug the stress script found:** `break-after: avoid` keeps a heading
with what follows it and says nothing about a break *inside* it, so a page
could end between a slug line and its scene number — two halves of one
heading, split across a page.

Six negative controls, all caught; one new spec (29 checks). 686 tests.

---

## v0.63.0 — The installer wears the badge, and the app admits its version

Small things, all of them found by looking at the shipped product rather
than at the code.

**The setup wizard's sidebar is the badge now.** The finish page and the
whole uninstaller were still showing NSIS's stock blue graphic, which is
the last thing a stranger sees on the way in and on the way out.
`installerSidebar.bmp` and `uninstallerSidebar.bmp`, 164×314, straight
from the badge artwork — a separate image from the app icon, which is why
the wizard's header already looked right while its sidebar did not.

**The "who is this for?" page is gone.** Scriare installs per-user and
cannot do anything else, so that page offered a greyed-out option beside
the only real one — a page whose every control is already decided costs a
click to agree with itself. It also carried a wart nothing else could fix:
electron-builder appends the words "(must run as admin)" to the disabled
option with a literal `SendMessage` rather than through a translated
string, so on a Turkish Windows the page read as Turkish with one English
fragment inside it. Skipping the page removes the fragment along with the
page, through electron-builder's own `customInstallMode` hook rather than
a patch of its template.

**The app will now tell you which build it is.** Until now the answer
lived in the setup wizard, in Apps & features and in `package.json` —
three places a writer does not look — which is fine right up until
somebody says "the graph jumps when I drag a node" and the only useful
reply is "which version?". It sits beside the wordmark on the Welcome
screen, at the size of a footnote. Not in the status bar: that bar carries
the three things a writer glances down for *while writing*, and a build
number is something you go and look up once, on purpose.

**It copies more than it shows.** The visible tag is the number, because
that is what a writer can read; clicking it puts `Scriare 0.63.0 · win32
x64 · Electron … · Chromium …` on the clipboard, because that is what a
bug report wants and nobody is going to type it out. The line is composed
and copied in the main process — a renderer channel that can put arbitrary
text on somebody's clipboard is a wider door than this needs.

**Asked for, not baked in.** The number comes from `app.getVersion()` over
IPC rather than a constant compiled into the renderer, for the same reason
the boot timings live in `shared/`: two copies of a number are two
numbers, and the one the app prints has to be the one electron-builder
stamped on the file. The spec proves it by making the main process answer
`1.2.3-probe` and demanding the screen follow.

**Which immediately caught something.** Written the obvious way, the test
compared what the screen said against what the app said and passed — while
both were `"0.0"`. The suite launched Electron by handing it
`out/main/index.js`, a file, and an app started from a file has no
`package.json` to read, so `app.getVersion()` had been quietly answering
Electron's own default for twelve versions. Nothing noticed because
nothing asked. The suite now starts the app from the project directory,
the way dev and the packaged app both do, and there is an assertion that a
version has to *look* like one — a screen faithfully printing a fallback
is the exact failure a version display exists to prevent.

**And one blind spot in the negative controls.** Some controls wrap a line
rather than replace it, which leaves the original text in place — so the
pre-flight's "the source still contains that line, fine" said fine about a
file that was currently sabotaged. Two interrupted runs had left an
off-palette background in `ToastHost.tsx`, the pre-flight cleared it
twice, and the next full suite failed in `themes.spec` with a colour
nobody had written. A wrapping control is now recognised by its `to`, and
`--restore` peels off every layer instead of one.

Also: one stale control re-aimed at where its behaviour moved in v0.58.1,
and the About panel's copyright matched to `package.json`.

Five negative controls, all caught; one new spec (9 checks).

---

## v0.62.0 — The app opens on the screen you are going to

Reported with two screenshots: opening a `.scriare` flashed the empty
"no stories yet" Welcome before the story appeared, and so did an ordinary
launch before the shelf of stories arrived.

**One bug, twice.** The renderer painted its default state while the
answers were still coming over IPC — is a story waiting from a
double-click, and what is in Recent Projects — and the default state is
the one screen that tells a returning writer they have nothing.

**So the app works out what to draw before it draws anything.** A boot
phase, in one place instead of three components: ask for a pending story
and open it, or load the recent list, and only then let the shell render.
Until that finishes it shows a splash — the app's own ground, the
wordmark, and a line that travels rather than a spinner, because the app
has no other spinner and one control that spins would be the only thing in
Scriare that does.

**Most launches will never show it.** The window is held back for 350ms
while the renderer decides, so a fast boot arrives already showing the
story or the shelf and the splash is never seen. If the boot outlasts the
grace the window appears with the splash in it — because an app that does
nothing visible for half a second reads as an app that failed — and the
splash then stays at least 220ms, or a boot finishing at 360ms would flash
for ten milliseconds, which is the same bug in a different costume. **The
grace is also the fallback:** the window is shown when it elapses whether
or not the renderer reported, so a renderer that never reports cannot
leave an invisible app behind. Both numbers live in `shared/boot.ts`,
because a disagreement between the two sides is exactly the flicker this
removes.

**The launch path has one asker now.** The main process clears the pending
story as it hands it over, so `useOpenFromDisk` gave that route up and
keeps only the running-app one. Two askers would mean one of them gets a
story and the other gets null, and which one is a race.

**A flash cannot be tested by looking afterwards** — by then the wrong
screen has been and gone. The spec installs a recorder before the page's
own scripts run, watches every mutation, and asks what the app SHOWED:
`["booting", "welcome:stories"]` on an ordinary launch, `["booting",
"editor"]` when a story is waiting. The first version of that recorder
observed `document.documentElement`, which is null at document-start, so
`observe()` threw and it recorded nothing at all — it watches `document`.

**And the machine was too fast to catch its own bug.** The control for
"a boot that does not wait for the recent list" came back green, because
the list returns in about a millisecond here and the race never happened.
The spec now wraps the real handler in a 400ms delay — a large recent file
on a synced disk — and runs the whole boot again against it. The control
is caught, and the app is checked on the machine it will actually be slow
on rather than the one it was written on.

Four more negative controls, all caught; one new spec (9 checks).

---

## v0.61.0 — Double-clicking a story

The installer, and the half of it that is not configuration.

**Packaging.** electron-builder, a Windows NSIS installer and a portable
`.exe` beside it, built from the badge artwork into a proper multi-size
`.ico` (16 through 256). **Per-user, assisted, no elevation** — checked
against the rival first: Twine's own documentation says its installer
"will put Twine in your Program Files folder", which means a UAC prompt.
The reasoning for going the other way is that Twine is a decade old with a
known name and this is an unsigned executable from a stranger: machine-wide
would show a first-time reader *two* frightening dialogs instead of one,
and per-user installs on a locked-down work or university machine, which is
exactly where a studio lead might try it. Arcweave sidesteps the question
entirely by being a website.

**An association nobody answers is a lie.** Registering `.scriare` changes
the icon; what makes it worth anything is that the app then opens the file.
Windows launches the app with the path on its command line, and when a copy
is already running it launches a SECOND copy with that path rather than
telling the first. Both are handled now: a single-instance lock, a
`second-instance` listener that brings the window forward and hands over
the path, the macOS `open-file` event registered before `whenReady` where
it has to be, and a launch-time path the renderer asks for once when it is
ready to act on it.

**The rule that reads a command line lives in `shared/`** and is a pure
function, because both the main process and the spec need the same answer
and a second copy would be a second set of rules. It scans from the END
(a portable build sits in a folder that may hold a story of its own),
skips anything starting with `-` (Chromium passes switches, and one of them
will eventually end in something that looks like a path), and never
considers `argv[0]`, whatever the executable is called.

**The story already open is closed the way every close closes it** —
`closeProject()`, which flushes what autosave had not written yet. Not a
new path but the same one, because a second way to put a project down is a
second way to lose the last second and a half of it (v0.49.0). One request
is refused: an unanswered save conflict, where flushing is impossible by
definition and closing would discard everything written since. The writer
is told why, because they just double-clicked something and nothing
happened.

**The suite caught a real bug in this, and it was the same bug as v0.53.1.**
The handler took `BrowserWindow.getAllWindows()[0]`, which is correct
whenever one window exists — and the export spec opens a second window to
read an exported story, so from then on index 0 was the wrong one and the
double-click went to a page with no renderer to hear it. It reads the
window the app itself made. **The spec now opens a second window on
purpose**, so it fails on its own rather than depending on the order the
suite runs in.

**What could not be tested here:** the installer itself. Building a Windows
target needs Windows or wine; on this machine electron-builder packages the
app and then stops at the signing step. So the argv rule, the lock, the
handler and the renderer's side are covered by the spec, and the artifact —
that it installs, that the Start-menu entry works, that double-clicking a
`.scriare` really does open it, and exactly what SmartScreen says — is
verified by hand on Windows.

Eight more negative controls, all caught; one new spec (13 checks).

---

## v0.60.1 — The documents catch up

No code. The four documents a stranger actually reads had drifted, and one
of them was selling the app short.

**The README was thirteen versions stale.** It said *"Not yet built:
Export (the button is visible and disabled on purpose)"* — Export shipped
in v0.48.0 — and *"344 automated tests"*, which is now 626 plus 131
negative controls. The front door of a portfolio piece was telling visitors
the app could not do the thing that is its front door.

It now also describes what it gained since v0.47.0: the export and its two
reading grounds, Play Mode on those grounds, Notes, and the pick-time
colour reading. The **negative controls get a paragraph of their own**,
including the part worth admitting — twice in the last week a control
failed to catch its sabotage, and each time that was a finding about the
test rather than the app.

**The tagline is settled.** The Welcome screen has said *"Write stories,
not syntax."* since v0.53.0 and the README never carried the line at all.
It leads with it now, and the project brief does too.

**The case study's "what's unresolved" list was lying in the app's
favour.** It opened with "Export doesn't exist". That item is gone;
the installer and the empty-colour-band finding took its place — the latter
being the honest limit of v0.58.0: no colour clears 4.5:1 on both grounds,
the best any single literal colour manages is about 4.16:1, and the app can
turn that surprise into a decision but cannot offer a colour that works.

**`docs/architecture-plan.md` is frozen rather than rewritten.** It carries
a header saying so. It was the Sprint 1–8 planning document; its module
boundaries and its "Known pitfalls" section are still cited by code
comments, and its "next candidates" list still proposes Variables, an
entities editor and electron-builder as future work — two of which shipped
long ago. Rewriting nine hundred lines of superseded planning would produce
a fourth document worse than the three that replaced it: the roadmap for
what is next, the changelog for what each release decided, the case study
for what the build taught.

The per-version reports in `docs/` are left exactly as they are. They are
records of what was true in v0.48, v0.50, v0.51 and v0.53, and a record
that gets updated is not a record.

---

## v0.60.0 — Notes

A note is the writer's own page: **it can mention the story, and the story
can never mention it.** That one asymmetry is the whole definition, and
everything else about a note — its page, its rename, its drag, its search,
its backlinks — is what being an entity has meant since v0.35.0.

**Which is why this is small.** `ContentCategory` has included `"notes"`
since the file format was written, and `entities.ts` said in its own
header that Notes were expected to arrive as a further KIND rather than a
new system. Five of the six exclusions were already true before a line was
written: a note cannot be a speaker (`canSpeak` has been character-only
since v0.37.1), cannot reach the export (built from scenes; no entity page
ships), cannot touch the word count or Check Story (both walk scenes), and
is found by search (which already walked entity pages — deliberately: a
note you cannot find again is a note you stop writing).

**The one exclusion that needed writing is the `@` menu.** It filters on
`isMentionable(entity)` rather than on `kind !== "note"` at the call site,
because the next kind will have to answer the same question and a rule
spelled out twice is a rule remembered once. The filter sits at the
SOURCE list, so nothing downstream — matching, best-name, the menu's
keyboard handling — can offer one by accident.

**"Appears in" turns around into "Points at".** A character's page lists
where she is mentioned. A note is never mentioned, so that list would be
empty for as long as the note existed, and a permanently empty section is
worse than none. It shows what the note points AT instead: the same walk
read backwards, counted once per thing named rather than once per mention,
because a note that says "Yseide" four times has one relationship with
Yseide. It also makes a note a place you navigate FROM.

**And a note has no aliases.** An alias exists for exactly one job —
matching what a writer types after an `@`. On a note it is a control for
something that cannot happen, and a field that does nothing teaches a
writer to distrust the ones that do.

**The placeholder mechanism is deleted, not extended.** Assets was cut in
v0.59.0 and Notes was the only thing left using it, so the Content Browser
ends up with LESS machinery than it had: three kinds, one list, one shape.
The status bar counts notes only when there are any — the same restraint
as "goes nowhere" in the scene panel: a writer who keeps no notes should
not be told twice a day that they have none.

**One conditional was a bug waiting for a third kind.** `kind ===
"character" ? "character" : "location"` appeared in two places, and every
note would have been drawn with a location's pin. There is one
`ENTITY_ICON` table now. The `@` menu keeps its two-way version, with a
comment saying why it is correct by construction: a note can never appear
in that menu.

**Two tests were re-aimed rather than deleted.** v0.59.0 checked that
+ New could make "all four things the tree holds" — it is five now, and the
claim is that ONE menu makes everything the tree holds, so the check grows
with the tree. And the placeholder's "says what it is for, not when it is
coming" moved to the category's own empty state, which is where that rule
now lives; its negative control moved with it.

**A spec crash, found by a control.** The check for "+ New can make a
note" clicked the menu item without checking it existed, so sabotaging the
item CRASHED the spec instead of failing it — and a crash tells a negative
control nothing. It reports now.

Seven more negative controls, all caught; one new spec (16 checks).

---

## v0.59.0 — The panel you are actually looking at

Two surfaces the v0.56.0 kit never reached, measured before anything was
drawn: `InspectorPanel.tsx` is 1,999 lines — the largest file in the app —
with nine distinct radius-plus-padding spellings, five spellings of a
label and **zero imports from the kit written for exactly this**.

**But the drift was not the finding.** All 1,999 of those lines went into
the state a writer is in for a few seconds at a time — a Choice Block
selected. The state they are in for HOURS is a scene selected, and it
showed a checkbox, a read-only list of the choices already visible in the
document three inches to the left, and a sentence explaining that the
panel does something else when you click elsewhere.

**So the scene panel now names the scene and says three things about it.**
Words, choices, and how many of those choices go nowhere. None of it is
new data: words is the status bar's own count, choices is the list below
it, and "goes nowhere" is what Check Story would tell you — if you thought
to run it. Naming the scene also settles a quieter problem: the panel
never said which of its two states you were looking at, and "Choices" and
"Outgoing Choices" are not two different enough words for a full editor
and a read-only list.

**There were two word counts.** `StatusBar.tsx` walked text nodes;
`storyCheck.ts` counts mention labels too, because a mention has no text
of its own. So a scene with three characters mentioned in it was reported
three words short in the status bar and correctly in Check Story — same
scene, same screen. One implementation now, exported and read by both, and
the spec asserts the two agree. Same rule as the reading grounds in
v0.57.0 and the contrast check in v0.58.0.

**A deleted destination is no longer called one nobody linked.** "Not
linked yet" used to cover both, and they are different repairs — Check
Story has named them `unlinked-choice` and `broken-link` since v0.36.0.
The unlinked case keeps the words the Choice Block in the document already
uses rather than inventing a fresh phrase for the same state, and both are
painted in `--warning` rather than told by wording alone, which is
v0.50.0's rule arriving somewhere new.

**One place to make a new thing.** It was two: "+ Scene" and "+ Group" in
the header, and a "+" that appeared on the Characters and Locations rows —
so where the button was depended on what you were making, and the header
grew a button per content type as the app gained them. One **+ New** menu
now offers all four, built from the same component the right-click menu
uses, and it opens the section a new character lands in, which the old "+"
did on its way.

**Assets is cut. Notes stays.** A section for a feature that will not be
built is furniture a stranger opens and finds empty — the north star
counts that as a defect rather than a gap. Notes is work not yet written
rather than work that will never be, so it keeps its place and now says
what it is FOR instead of "Coming soon.", which tells a writer when it
arrives and nothing about whether they want it.

**And one test was re-aimed rather than deleted.** v0.45.0's elevation
check watched "+ Scene" to prove a ghost button stays flat; its
replacement draws the border token, and index.css is explicit that
anything drawing that border is a made object and gets the lift — so the
button rising is the rule working, not the bug returning. The check now
probes one control of each kind against the real stylesheet, which is what
it was always claiming.

**Not done, on purpose:** the choice editor's own layout. It is drawn
(I2 on the design canvas, four headings — Text, Destination, Conditions,
Actions) and it is still the wrong thing to build before the installer:
the largest file in the app, rewritten for no new capability, before
anyone outside the project has judged it.

Eight more negative controls, all caught; one new spec (13 checks).

---

## v0.58.1 — The reading moves to the bottom of the page

v0.58.0 drew it directly under the colour control, which is the obvious
place and the one wrong place: that is where the browser opens the colour
picker. So the reading sat **behind the picker** for the whole of the
pick and only came out once the writer had already chosen — which is the
"reports instead of prevents" failure the feature exists to avoid.
Reported with a screenshot of the picker sitting on top of it.

**It is now drawn in the writing pane's bottom corner** — out of the
picker's way wherever the picker opens, and the corner the app already
uses for a floating instrument (the Variable Readout sits in the same one
during Play). Visible the whole time the writer is dragging.

**Which meant the pane has to draw it, not the toolbar** — a child cannot
render into its parent's corner — so the subject travels through
`uiStore`, which exists for exactly this shape of problem.

**And that exposed a second bug.** The subject was being captured inside
the colour input's own event handler, where it is always one frame stale,
because every commit on this bar is throttled to one a frame. On the FIRST
event of a pick that value is the colour the writer had *before* they
started — so the panel opened every pick by reporting "follows it" and
"Reads on both grounds" about a colour nobody had chosen yet. It is read
from the editor on each render now. Both have controls.

The placement is asserted rather than described: the spec measures that
the panel is not inside the control, is in the bottom half of the pane and
is pinned to its bottom edge. Nothing here can measure a browser popup, so
what is checked is the design, at whatever window size the suite runs.

Two more negative controls, both caught.

---

## v0.58.0 — How it reads, at the moment you pick

A colour is chosen while looking at one page — whichever of the eight
themes the writer works in — and lands on one of two, chosen by the
reader. Nothing in the app said so until the export dialog, which may be
weeks later.

**The measurement that decided what the fix could be.** `#7a1f1f`, a dark
red picked on a light theme, is 9.54:1 on Paper and **1.82:1 on Night**.
`#bcd6f0`, a pale blue picked in Dark, is 12.46:1 on Night and **1.39:1
on Paper**. And the set of colours that clear 4.5:1 on *both* grounds is
**empty**: the best any single literal colour can manage is about 4.16:1,
just under the line. So "warn them and let them choose a safer colour" is
advice that sometimes has no answer, and this panel does not pretend
otherwise. What it does is turn a surprise at export time into a decision
at pick time.

**The native colour dialog is untouched.** Drawn three ways first. Owning
the picker would have bought a swatch list and cost the eyedropper, the OS
palette and every colour the writer used in every other app that week —
so `<input type="color">` stays exactly as it was, first press still opens
Windows' own dialog, no extra click, and the reading appears underneath
it. That input fires on every pixel of a drag and the toolbar has thrown
those events into a one-per-frame throttle since v0.33.0, so the readings
follow the drag for free. The panel stays after the dialog closes, because
it cannot depend on being seen during it: Windows places that dialog where
it likes and may sit over the toolbar.

**Three controls, one component.** Text colour, highlight and a choice's
fill are all "a colour that has to survive two grounds", so they share
one panel rather than three near-copies — v0.56.0's lesson about the
button. What each one is measured against differs and the differences are
the point: ink is measured on the page, a highlight is measured as the
ground's own text ON it, and a choice's fill is measured as the thing its
label has to be legible against. The border is deliberately left
unmeasured: it carries no text and the export enforces no threshold on
it, and inventing one here would be a second rule to disagree with the
first.

**The numbers come from the export's own function.** `readColorOnGrounds`
lives beside `checkStoryContrast` and shares its parsing, compositing and
threshold, so the number in the picker and the number in the export
warning cannot disagree. The spec does not ask the app what the ratio is:
the three expected values were computed independently and written down,
because a test that reads a number out of the app and checks the app
printed it is a test of nothing.

**It says what the number means.** "1.8:1" is nothing to a narrative
designer; "Nearly invisible on Night" is everything. Graded rather than
binary, because 4.4:1 and 1.1:1 are not the same news.

**And it does not replace the notice it sits beside.** Picking a colour on
a Choice Style that still follows the theme has raised an undoable notice
since v0.55.0. The panel answers a different question — how it reads on
each ground — and a control asserts the notice still fires, because a new
thing quietly swallowing an old one is how a fix becomes a regression.

The previews are marked `data-content-colour`: Night must look like Night
in all eight themes, so those are literal values, and the palette audit
skips them the way it skips the toolbar's own swatch.

Eight more negative controls, all caught; one new spec (14 checks).

---

## v0.57.0 — Play Mode reads on the reader's ground

Since v0.48.0 the export has refused to ship the writer's theme, on a
stated principle: **a theme is chrome and a reading ground is content.**
Eight themes tune a room full of panels and borders; the two reading
grounds tune one column of prose for a stranger on a phone. Play Mode
shipped in v0.8.0 and did the thing the export refuses to do — it wore
whichever theme the writer happened to be in. Nobody decided that; the
two features were written twenty versions apart and never met.

**Measured before it was fixed.** With the app in Phosphor, Play painted
`--page` at `oklch(15% 0.016 150)` — the theme's own value, terminal
green — and `--accent` at `oklch(82% 0.17 145)`. A writer rehearsed their
story in green and then exported something they had never seen.

**Play now reads on Night or Paper, with the same switch the reader
gets.** One button in the Play bar, labelled with the ground you would
move to, with the same accessible name the exported page's bar uses. The
choice is remembered on this machine, exactly as the reader's choice is
remembered in their browser: press Play tomorrow and you are on the
ground you were reading on.

**This breaks a promise on purpose.** Play Mode has said since v0.6.2
that it reads the way you wrote it — same column, same typography. That
was right when there was no export and wrong the day there was one. Play
answers *what will my reader see*, not *what does my draft look like*.
The column and the typography are unchanged; only the ground is.

**One table, two renderers.** The grounds are generated from
`GROUND_TOKENS` — the same constant the exported stylesheet is built from
— rather than copied into the app's CSS, because two implementations of
one look is the pair that always drifts, and the only defence is that
there is one table and both read it. The spec asserts token for token
against that table, read out of the running app rather than restated in
the test.

**Five tokens a reading ground has no opinion about.** An exported page
has no raised panel and no hover state, so a ground defines neither.
Play has both, so `--surface`, `--surface-translucent`, `--shadow-raised`,
`--accent-text-on` and `--accent-hover` are derived from the ground
rather than left to fall through to the theme — which would have been the
same leak through a back door, visible as the Restart button's label in a
dark theme's ink on a Paper page. `--accent-text-on: var(--page)` is not
a guess: it is what the exported page already paints on an accent fill.

**And a highlight is no longer the browser's yellow.** Tiptap's Highlight
mark renders in the user agent's own colour unless something says
otherwise. The export says otherwise; Play did not, so a highlighted line
was the one piece of a story that looked different in the rehearsal and
in the finished file.

**The ground stays inside Play.** The editor and graph are only CSS-hidden
underneath while playing, so a ground scoped one selector too wide would
repaint the room behind the page. That is asserted while Play is on
screen — the only moment an escaped ground is visible, since the style
block leaves with the runtime — and the negative control that widens the
selector is caught there.

**The audit found one more thing on its first run.** The themes walk now
measures the Play surface against the GROUND rather than against the
theme — a stronger check than before, since the ground is deliberately
not in any theme's palette — and it immediately reported five elements
per theme still painted in the writer's ink. Redefining `--text` on the
Play surface does not change the `color` that `body` already resolved
from it, so every container inside Play was inheriting the editor's text
colour. Nothing visible was wrong today, because each piece of text
happens to set its own colour; that is the kind of luck that stops
holding the next time someone adds a line.

Nine more negative controls, all caught; one new spec (14 checks).

---

## v0.56.0 — The button that was never written

The app's oldest visuals were found by measuring rather than by looking:
every component's own comments record the version its visuals were last
revised in, and six mention none at all. What that turned up was not a
taste problem.

**`common/` held a Modal, a toast host, a dialog back-link and a whole
icon set — and no button.** So every dialog re-typed its own Done and its
own Cancel from memory, and the primary action existed in nine spellings:
`px-3 py-1.5 text-sm` six times, `px-3.5 py-1.5` twice, plus `px-3 py-2`,
`px-4 py-2`, `px-5 py-3`, and one at `text-xs`. Nobody can name a
two-pixel disagreement when they look at an app, and it is most of why
the older dialogs felt unsettled beside the newer ones. Downstream of the
same absence: 19 distinct rounded-class strings in the Inspector, 10 in
the Content Browser, 9 in the Variable Manager.

**The dialog title was written four ways.** The serif italic in five
dialogs, `text-base font-semibold` in three, and `text-sm font-semibold`
in exactly one — New Project, the first dialog a new writer ever sees.
That file's own comment gives it away: Sprint 8D moved it onto the shared
`<Modal>` because it had a hand-rolled backdrop, and never looked at its
type.

**`Button`, `Field` and `DialogHeader` now exist, and they invent
nothing.** The default size is `px-3 py-1.5 text-sm` — the spelling six
places already used. Every colour is the token that was already there.
This is the language v0.40.0 and v0.44.0 chose, written down once instead
of retyped forty times. `intent` says what a button MEANS rather than what
it looks like, which is what makes "danger" survive a palette change when
`text-red-500` would not — the mistake v0.46.0 had to go and find in Check
Story.

**Two variants drawn in the mockups are not in the code.** An outlined
danger button, because the confirm dialog's filled one was already right
and nothing needed the other; and an `lg` size, drawn for the Welcome
hero's Continue, which turned out to be a `<span>` inside a larger button
— a button inside a button is invalid markup, so the size had no caller.
A variant nothing uses is a decision made in advance of the question.

**The Variable Manager was the oldest surface anyone will actually see.**
No version note, no section labels (the only manager without them), a
delete drawn as a bare ✕ at `text-xs`, and the word "Default" repeated on
every row; three of six variables fitted the dialog. It has its sibling's
shape now — Choice Styles has done the same job since v0.34.0 — chosen
from three mockups against a real story's variables. The collapsed row
answers the question you actually have: what it is called, what kind it
is, what it starts as. The type is spelled out rather than drawn as a
glyph, because a chip reading "01" is a thing a writer has to be taught
and this dialog is where most people meet the type system.

**Move To was checked and left alone.** Clicking a folder moves
immediately with no confirm step, which looks like a gap and is the app's
own rule — the action happens, the way out is Ctrl+Z, and `toastStore`'s
header argues the case at length. Only its title and its Cancel changed.

**And the claim is measured, not asserted.** `kit.spec.mjs` opens five
dialogs for real, finds each one's primary action by the colour it is
painted, and reads the computed padding, size and radius back off the
element — because a test that checks the source imports `Button` would
pass the day someone imports it and overrides its padding, which is
exactly how the drift happened the first time.

Eight more negative controls, all caught; two new specs.

---

## v0.55.0 — Three things a stranger can walk into

No new features. Three defects with nothing in common except that each one
is reachable by someone who has never been told anything.

**Settings opened Choice Styles by closing itself, and left no way back.**
The swap is deliberate — two dimmed backdrops stacked over each other is
how a settings screen starts feeling like a maze, and the styles manager
is a place you go rather than a detail of the dialog you left. But it
meant changing the Start Scene after looking at a style required
dismissing the manager and reopening Settings from the top bar. The
relationship is drawn instead of stacked now: one line at the top of the
child dialog naming the parent. Project Settings moved out of TopBar's own
`useState` into the UI store to make it possible at all — which is exactly
the limitation that store's own header describes.

Escape still closes everything rather than stepping back one level.
Stepping back is the other defensible rule, and it was considered: it is
what a nested settings screen does elsewhere. But Escape and the backdrop
are the same gesture in this app — "I am done here" — and turning that
into "up one level" would land a writer who clicks well outside the card
in a dialog they did not ask for. The way back is visible; nobody has to
guess it from a key.

**"Where you left off" took you somewhere else.** The hero names a scene,
a character or a location, and `Continue` opened the story at its start
scene — a promise broken on the action every session begins with. The
resume record now carries the page's id, and the id is checked against the
story that actually loaded rather than trusted: a page can be deleted
between two launches, and landing on nothing is worse than landing on the
start scene. Opening a story from its **card** still lands on the start
scene, and the distinction is the point — a card says "open this story",
the hero says "go back to this page".

**The colour picker pinned a theme colour without a word.** Opening it on
a style whose fill is `var(--surface-2-translucent)` and moving the
pointer at all writes a hex into the story file, permanently; the style
stops following light and dark for good. The "Theme" button beside it has
always been the way back, but an affordance nobody knows they need is not
a way back. The app now says so at the moment it happens, once — not once
a frame, which is what a native colour input would otherwise produce — and
the notice carries an Undo that restores the variable. The swatch also
borders itself in the accent while a fixed colour is set. Raising the
notice correctly meant committing that one edit outside the per-frame
throttle: a toast can only carry the history step that already exists when
it is raised.

**And one line of dead code, found the way this project finds them.** The
"came in another door" control passed: clearing the dialog's origin on
close could not matter, because the open path already sets it every time.
The line went, not the control — which now sabotages the open path and is
caught.

Six more negative controls; a new `settings-navigation` spec.

---

## v0.54.0 — Where you left off, whatever you were working on

The hero read `selectedSceneId` and nothing else. So an afternoon spent
on a character or a location ended with a Welcome screen that had no
"where you left off" at all — the app quietly deciding those hours were
not work. A Character and a Location are the same object as a Scene with
a different `kind`, each with a page written in the same editor, so there
was nothing to build for them but the decision to look. Only one of the
two ids is ever set, because selecting a scene clears the entity and vice
versa, so "what was open" is a question the store could already answer.

**Which forces the hero to say what it is naming.** "Yseide" on its own
could be a scene called Yseide. The kind now sits on its own line between
the title and the prose, a small icon and a word.

Beside the name was the other candidate and lost on two counts. A
bordered chip is a component that exists nowhere else in Scriare, and the
app already has a way of saying what a thing is — the small uppercase
label, on its own line, used throughout the Inspector and the panels.
And setting a rectangular uppercase box against a 25px serif italic — the
one place on that screen where the type is doing the work — reads as
pinned on however well it is drawn. Under the name also leaves the
title's line to the title, which matters when a name is long.

**Resumes written by v0.53.x are read, not discarded.** They have
`sceneTitle` and `groupName` and no `kind`, and they described a scene,
because a scene was the only thing they could describe. Unlike the cached
story shape, nothing about the old fields is *wrong* — only narrower — so
they are read as scenes and the next save writes the current shape over
them.

Four more negative controls, all caught.

---

## v0.53.3 — The shelf is the whole shelf

The story you were last in was cut out of the grid, because it was
already in the hero above it. So the one story you could not see on a
screen headed "your stories" was the one you had worked on most recently,
under a heading that had to apologise for the omission — "your **other**
stories".

The hero and the card are not two listings of the same thing: the hero is
a shortcut back to a scene, the card is that story taking its place on the
shelf. Both belong. One heading now, saying what is under it.

---

## v0.53.2 — The map is a scale model now

Held a thumbnail up against the graph it claimed to be a picture of, and
they were not the same graph. Neither v0.53.0 nor v0.53.1 drew a story's
shape; both drew a different story's shape, confidently, and every test
in the suite passed while they did — because every test asked whether
something had been *drawn* and none asked whether it had been drawn in
the right *place*.

**Each axis was stretched to fill the card.** Normalising x and y
independently into the unit square is the obvious thing to do and it
quietly destroys the drawing. A story laid out left to right is wide and
flat: a real 13-scene project measures about 1108 × 148 canvas units, or
7.5:1, and the card it is drawn in is 2.3:1. Fitting each axis
separately multiplies every vertical distance by 3.2 relative to every
horizontal one, so a tidy spine with two short branches arrives as a
vertical scatter of blobs.

Both axes now divide by one number — the longer side of the story's own
bounding box — and the scene cards divide by it too. What is cached is a
scale model: every distance, every angle, and the cards themselves in the
proportions the writer laid out. The renderer multiplies by one number
and centres the result.

**The cost is honest empty space,** and it is drawn as what it is. A 7.5:1
story fills the card's width and about a third of its height; the rest is
canvas, so the panel draws the graph's own dot field at the graph's own
18px spacing behind every map. A story whose shape is not known yet is
then the same picture with the scenes left out, rather than a special
case.

**Old cached shapes are not migrated.** A shape written by v0.53.0 has
these very field names and different meanings, which is the worst kind of
incompatibility — it draws, and it draws the wrong picture. Shapes now
carry a format version, an unrecognised one reads as no shape at all, and
the backfill redraws it from the story. That is one file read, once, and
it is also why the backfill now asks whether a shape is *usable* rather
than whether one is *there*.

**And the test that should have existed from the start.** A faithful
miniature is a similarity transform, so the ratio between drawn distance
and source distance must be the same for every pair of scenes. It is now
measured across every pair, off the rendered SVG, against a fixture with
a real story's proportions — currently agreeing to within 0.5%. Under the
old code the horizontal and vertical pairs disagree by that 3.2×, which
no tolerance hides. The drawn scene card is checked against the graph's
own 180 × 56 as well.

Four more negative controls, all caught; two retired because the code
they sabotaged no longer exists. 525 tests.

---

## v0.53.1 — The Welcome screen, actually fitting the window

Three visual bugs in v0.53.0, two of them the same bug wearing different
clothes, plus the piece of the feature that only arrived after you no
longer needed it.

**A `<button>` centres its children.** The UA stylesheet sets
`align-items: center` on `button`, so a block child of a flex button is
sized to its *content* instead of being stretched. The map panel
therefore measured 0px wide, the `<svg>` fell back to its own 372×104
viewBox, and every story map was drawn at a fixed size inside a card that
was a different size — a stripe of drawing with the rest of the card
empty, worse the wider the window. The same line is why the resume
hero's accent rail was invisible: a 4px-wide flex child with no height is
nothing at all. One `items-stretch` on each, and a test that measures the
drawing against the card, then resizes the window and measures again,
because a map that looks right at one width is exactly what shipped.

**The map is measured, not scaled.** It now lays itself out at the real
pixel size of the element it is in, with the scene cards staying the size
they are meant to be — the same thing the Story Graph does when its panel
is resized. Letting the browser fit a fixed viewBox either letterboxes
the drawing or smears every scene card, and this screen had the first.

**The shelf has a column.** Content — the frame's contents included —
sits in a centred 1240px column, and the cards fill the row with
`auto-fill` rather than three fixed thirds. On a 1900px monitor the old
layout pinned the header to the window's edges, stretched the hero from
one side to the other, and left a single card marooned at the left: two
unrelated screens stacked. Cards are also lifted now with the Story
Graph's own `--lift-node` and lit top edge, and respond to the pointer,
because a card here is a picture of a scene card there.

**Maps arrive without opening the story.** v0.53.0 wrote a story's shape
on save and only on save, so the first launch after updating showed the
dot field on every card, and a map appeared only once you had opened that
story and saved it — the picture that exists to help you *find* a story
turning up after you had found it. The screen now fills them in itself:
one story at a time, after the first paint, yielding between each, never
twice for the same file, and without moving anything in Recent Projects.
Once per story, ever.

**Two paragraphs are no longer welded into one word.** The excerpt
concatenated every text node it found, so a three-paragraph scene read
"...But I know... We're in scene 2We are sooo in scene 3" on the most
prominent line of the screen. Block boundaries are a space; only inline
runs join with nothing.

**And one finding from the suite itself.** The new resize check drove
`BrowserWindow.getAllWindows()[0]`, which is the app window when that
spec runs alone and the export spec's hidden window when the whole suite
runs — so it resized a window nobody was looking at and then compared two
measurements of an app window that had never moved. It passed. It now
takes the window from the page it is showing, and throws if the window
did not actually resize.

Six more negative controls, all caught; 520 tests.

---

## v0.53.0 — The Welcome screen

The first screen anyone sees was the last one nobody had looked at. A
448px column dead centre in a 1280×800 window, about 85% of it flat
`--bg`, using none of the app's own vocabulary — no sheet, no elevation,
and the loudest thing in each recent row was a file path. A stranger's
first thirty seconds ended at "No recent projects yet.", which is a dead
end on the one screen where *write stories, not syntax* applies most
directly. (That line also stopped saying *build*.)

**One screen in three states, not three screens.** The frame — wordmark,
search, Open Project…, New Project — is identical whether you have nought
stories or ninety, and only the area below it changes. What changes is
what the hero slot *means*: on an empty shelf the next thing is "see what
this is"; after that it is "keep writing". A test measures the header's
box in all three states, because that claim is the design.

**The cards carry maps.** A writer with nine stories does not recognise
one by its name — they recognise it by whether it fans out early, runs as
a spine, or loops. Drawing that needs scene positions and edges without
opening the project, and parsing every `.scriare` on this screen is the
obvious answer and the wrong one: a 300-scene story is megabytes. So the
recent-projects entry gains a cached shape, written at a moment the app
is already writing to disk. Up to twenty node positions normalised into
the unit square plus their edges as index pairs — 579 bytes for a
30-scene story, and no titles, no prose, no ids, which matters because
that file lives in userData, where a writer has no reason to expect their
words to be.

**The sample is breadth-first from the start scene, not the first twenty
scenes in the array.** That difference is the whole value of the picture.
Creation order is not story order: on a forty-scene story where the
writer left nineteen scenes unwired, a slice gives twenty boxes with
nothing between them — a map that says the story has no shape. A story
last saved by an earlier version has no cached shape at all, and shows
the graph's own dot field: an empty canvas rather than a grey box, filled
in the first time the story is saved.

**"Where you left off" names the scene, not the file.** Every editor
worth the comparison opens on the thing you were doing. Scriare already
knew which scene was selected when it last saved, so the hero shows it,
with the opening line of its prose, and it is where the keyboard lands —
launch, Enter, back in the scene. The excerpt is deliberately the scene's
OPENING rather than the sentence you stopped in the middle of: the
opening is what identifies a scene a week later, and it does not change
while you type, so the cached snapshot does not churn on every save.

**Nothing is dimmed.** When a search splits the shelf, the first draft
faded the non-matching stories to 50% opacity. That was wrong twice over:
it taxed the contrast of a third of the screen for every reader, and it
said "less important" about stories that are only "not what you typed".
They differ by form instead — a rule-separated row, no map, no card, no
shadow — at full text contrast. The same rule settles the story whose
file has moved: an icon and its own words, never colour alone.

**Two bugs found on the way.** Re-opening a story erased the map it had
cached, because moving an entry to the front of Recent Projects replaced
it wholesale — the app forgetting the picture of the story you just
opened, which is the one moment it most obviously knows it. And the logo
swapped on `theme === "light"`, so daylight and overcast — two light
grounds — were handed the mark drawn for dark rooms, pale on pale. Each
theme now records its ground, because `overcast` is exactly the case a
guess gets wrong.

Fifteen negative controls, all caught.

---

## v0.52.0 — Tidying up

No behaviour changed. The audit's tier 5, plus the repository itself.

**The dead code that was actually dead.** `stripChoiceBlocks` was the only
fully dead export in the codebase — grepped across source, tests and docs,
its definition line was the sole occurrence. Gone.

**`26` was written four times, in three files, for two quantities.** How
much air a group keeps around its contents, and how tall its title bar is,
existed as `FOLDER_PADDING`, `DERIVED_PADDING`, `DERIVED_HEADER` and
`GROUP_HEADER_HEIGHT` — in the module whose own header says these values
all have to agree. Two names now, in that module, imported by the other
two files. Changing the padding in the obvious place used to silently
disagree with the layout engine and with the derived-rect maths.

**`CHOICE_OPTION_TYPE` was declared twice.** `types/nodeTypes.ts` exists to
stop node names drifting, and says so — and the literal was written a
second time in `ChoiceOption.ts`. The extension re-exports the name now
instead of minting its own.

**Snapping was implemented twice, and each comment denied the other.** The
layout algorithm snapped its output to the grid; `projectStore` snapped
again at the end, under a comment stating flatly that snapping happens
"here rather than inside the layout algorithm". Both were true and the
comment was not. The inner one was also doing nothing — groups are resized
and their contents re-based afterwards by offsets that are not whole cells,
so its output was overwritten before anything saw it. **Verified rather
than assumed**: removed, and graph-auto-layout's 17 checks and graph-grid's
16 all stay green, which is the claim that the last snap is the one that
decides.

**Two tree walkers could hang the renderer.** `isDescendant` and
`ancestorsOf` follow `parentId` upward with no cycle guard, and
`ancestorsOf` grows an array while it does it. Not reachable from the UI —
`isDescendant` IS the guard that prevents the cycle — but a corrupt or
hand-edited project file is an input this app treats as untrusted
everywhere else, and every other tree walker here already had one.

**Two comments that sent readers the wrong way.** `autoLayout.ts` described
Frames and pointed at `projectStore.autoLayoutScenes` for the collapsing;
Frames were replaced by content-tree groups in v0.28.0 and the collapsing
moved to `autoLayoutGraph.ts`, so the file whose whole job is layout
explained itself in terms of a concept the app no longer has.
`choiceBlocks.ts` opened with "`conditions` is intentionally NOT a field
yet" fourteen lines above the field, with the correction underneath —
a reader met the stale claim first and the truth second. Both reordered so
the current fact leads.

Two items from the audit's tier 5 turned out not to exist: the claim that
`textFold.ts` says "ß lowercases to two" is not in the file, and the
Inspector colour input reported in tier 3 was already corrected in v0.51.0.

**The repository carries its own history now.** The fifteen design
documents lived only in the project workspace; they are mirrored into
`docs/` with an index, so a reader who clones this gets the reasoning as
well as the result. `README.md` and `CHANGELOG.md` stay at the root where
every convention expects them, and `CHANGELOG.md` is the narrative
companion to `docs/` rather than a duplicate of it. A prototype page and a
mockup folder left over from earlier work are gone.

473 tests, 55 negative controls.

---

## v0.51.0 — Where the time actually goes

The audit's tier 3. Measured first, and the measurement is most of what
this release is worth: **two of the three items it named do not cost what
it said, and the thing that does cost was not on the list.**

One edit on a 300-scene story, timed to paint, median of repeated runs:

```
everything open .................... 80.6 ms
Content panel collapsed ............ 66.8 ms   panel:      13.8
+ Inspector collapsed .............. 66.5 ms   inspector:  ~0
+ Story Graph collapsed ............ 33.3 ms   graph:      50.2
```

33 ms is the floor — two animation frames, which the measurement has to
wait for. So **the Story Graph was about 50 ms of an 80 ms keystroke**,
more than everything else put together, and nothing in the audit pointed
at it.

**The graph rebuilt every node and edge on every edit.** FlowPanel's memos
are keyed on `project`, and React Flow diffs by reference — so renaming one
scene handed it 300 new node objects and, on a story with choices, several
hundred new edge objects, every one of them reconciled. Unchanged nodes and
edges keep their identity now, decided by a signature built from the
primitives each one draws. On a story with 450 choices in it the graph went
from 81.9 ms to 58.3, with the node half worth about another 11.

**Item #22 does not exist.** The audit reported an unthrottled
`<input type="color">` in the Inspector. There is no colour input in the
Inspector: it uses the shared `BoxControls`, and that component was already
rAF-throttled in v0.49.0 — so fixing the Choice Styles half fixed this half
too, and the note in `claude/audit-v0.48-outcome.md` saying otherwise was
wrong.

**Item #24 costs nothing measurable.** Sixteen choice options on screen
were reported as 4,800 scan steps per keystroke. Measured as a delta
against the same scene without them: **−3.0 ms**, which is noise. The
related claim that walking every scene's choices costs 24.8 ms at 300
scenes does not reproduce either — it is **0.2 ms** for 300 scenes and 450
real choices.

**Item #23 is real, and the fix for it was aimed at the wrong half.** The
Content panel does cost about 16 ms of a keystroke. The audit blamed each
folder row filtering and sorting the whole node list, so that was replaced
with a prepared index — and the cost did not move: 16.5 ms with the index,
16.7 ms without. The filter was never where the time went; 300 rows
re-rendering is. The index was reverted rather than shipped as a fix for
something it does not fix. **Memoizing the context and the rows is the real
fix and it is a bigger refactor — it is not done, and it is the one tier-3
item still open.**

**Three findings about measuring.**

*The harness lied twice before it told the truth.* The first version
measured everything-open, then collapsed a panel and measured again. Across
runs the same build gave −7.9 ms and then +17.2 for the same difference:
±25 ms of drift on an effect worth 14. Alternating the two and taking the
median of paired differences cancels drift that is slow compared to one
pair, and the numbers went from that spread to ±1 ms.

*A toggle that silently misses makes everything after it meaningless.* The
expand controls are titled "Expand …", not "Show …". The clicks found
nothing, returned false into a variable nobody checked, and every later
measurement was taken with the panel still shut — reporting a tidy 0.1 ms
for a panel that had never been reopened. It throws now.

*Some things cannot be guarded by a clock.* The graph resolves to about
±10 ms over three paired runs, and the fixes are worth 24 and 11, so no
threshold separates them: tight enough to catch the regression is tight
enough to fire on a busy box. The timings stay as documentation and as a
gross-regression check — and they say so out loud when the machine is too
loaded to judge, because a red build meaning "CI was busy" teaches people
to ignore red builds. What the fix actually *does* — hand back the same
object when nothing changed — is asserted directly instead, and that has
the same answer on any machine.

473 tests, 55 negative controls.

---

## v0.50.0 — Getting around without a mouse

The v0.48.0 audit's tier 4. Every claim in it was reproduced against the
running app before anything was touched, and two of them turned out to be
worse than reported.

**The Content panel answers to a keyboard now.** The "Story" header, both
category headers and every character row were bare `<div onClick>` — no
role, no tab stop, no key handling. Measured: `{"tag":"DIV","tabIndex":-1,
"role":null}`. A writer navigating by keyboard could collapse "Story" and
then **never reopen it**, and could never open a character page at all.
That is a dead end rather than a rough edge, which is why this went before
the remaining performance work.

They stay divs, because they are drag handles and a native `<button>`
inside a draggable ancestor can swallow the mousedown Chromium needs to
recognise a drag. What was missing was everything else, and it is one
shared helper now rather than four hand-rolled copies.

**The focus ring was being drawn in transparent.** Tailwind's
`focus:outline-none` compiles to a 2px outline coloured `transparent` at
specificity (0,2,0); the app's global `:focus-visible` rule is (0,1,0). So
both matched and the invisible one won. Measured on a focused tree row:
matches `:focus-visible`, `outline-width: 2px`, `outline-color: rgba(0, 0,
0, 0)`. A ring, at full width, in nothing.

Removing the class was not the fix, and the test said so: a real click then
painted a ring on every row. `:focus-visible` settles this by itself for
native controls, but Chromium keeps matching it after a pointer click on a
`div[tabindex="0"]` — so the app had been choosing between a ring on every
click and no ring at all, and had chosen none. The modality is tracked
instead, which is what was always meant: pointer in use, no rings; a key
that moves focus, rings.

**Dialogs are dialogs.** `role="dialog"`, `aria-modal`, an accessible name,
focus moved in on open, Tab kept inside, and focus returned to whatever
opened it on close. Before this, opening a dialog left focus on the button
underneath the backdrop and Tab walked the application behind the scrim —
every control reachable, none of them visible.

**The Inspector agrees with the canvas about who is in the scene.** A
mention stores the label that was TYPED, and every reader is supposed to
resolve it through the entity list. Two in the Inspector did not, so a
renamed character kept her old name there while the graph, Check Story and
the export all showed the new one. The audit named one of them; measuring
that one found the second.

**Section labels settled on one spelling.** There were three type ramps
doing the same job across 33 headers, with the weight drifting between
semibold, medium and unset. They are one class now, at 10px with wider
tracking — chosen on the argument that a section label is not content, and
at 12px it is the same size as the values underneath it and competes with
them. Four inline tags that sit BESIDE text rather than above a group were
deliberately left alone, as were the vertical rail labels and the canvas
group-name input.

**The palette walk covers thirteen surfaces, up from four.** Export,
Project Settings, entity pages, Find results, the context menu, toasts, the
conflict dialog, Play Mode and the Welcome screen had never been looked at
by the audit that exists to look at them — which is why the `--overlay`
misuse on the writing surface survived four versions. Two things came out
of switching it on: the theme picker and the export's ground swatches are
now marked as content colour, because painting colours that are not the
current palette is precisely their job; and the walk learned that a palette
token at reduced opacity is still that token.

**Three findings about the tests, all of them mine.**

The walk's first attempt at "this colour without its transparency" painted
the colour over itself forty times and let it converge. Every pass
quantises to 8 bits, the error accumulates, and it settled two to four
units off per channel — nine units of distance against a tolerance of
eight. It passed on six themes, because their accent is near-white and sat
within tolerance of `--text`, and failed only on the two themes whose
accent is a distinctive colour. **A check that agrees with you except where
it is actually being tested is worse than no check.** It solves the alpha
from two composites now, with no accumulated rounding.

The two Inspector checks called the shared utility directly and passed the
resolver themselves — testing that the resolver works, which was never in
doubt, and saying nothing about whether the Inspector passes one. Both
negative controls went uncaught. They read the rendered panel now.

The section-label check queried the class it had just applied, so the
control that stripped the class from one header simply removed it from the
sample and the survivors still agreed. **A drift detector that only looks
at things which have not drifted cannot detect drift.** It measures every
uppercase micro-label on screen.

And one about how specs share an application: this one collapses sections,
and the Content Browser remembers which are open. Leaving them open made
the next spec — which clicks to open its own — close them instead and
report no cast. It hands the panel back the way it found it.

Two more controls were removed for passing honestly: the starting value of
the pointer-modality flag is a sensible default rather than a guarantee,
and both comments were reworded to stop claiming more than the tests show.

464 tests, 53 negative controls.

---

## v0.49.1 — The fix that didn't

Two data-loss bugs, both of them shipped **inside v0.49.0's fixes for data
loss**. Neither was found by the suite; both were found by reading the code
back afterwards and then measuring what it actually did.

**Closing the project did not flush what was pending.** v0.49.0 added
`await saveNow()` to `closeProject`, which reads exactly like a flush. But
`saveNow` begins with "a save is already on its way — queue and return",
and that branch returns an already-resolved promise having written nothing.
So the `await` waited for nothing; `closeProject` then cleared `saveQueued`
— the flag that call had just set — and nulled `filePath`; and the real
save landed afterwards, found the path had changed, and dropped the queue
too. Measured against a real file: save V2 in flight, type V3, close, and
the file holds **V2** while the store reports **"saved"**.

The window is ordinary, not exotic. Autosave fires 1.5 seconds after a
change, a write to a synced folder is not instant, and typing during that
second is what typing is.

The fix is `saveRun`: the promise of the save on its way *including* the
re-run it queues for anything typed while it was in flight. Returning that
from the early branch is what makes `await saveNow()` mean "the disk is
current" — which is what closing, quitting and Ctrl+S all assumed it
already meant, and what nothing had ever guaranteed.

**The close handshake gave the writer four seconds to answer a question.**
The main process destroyed the window four seconds after asking the
renderer to get ready. That clock was racing two things it had no business
racing. The one question this app asks — *"Close without saving?"*, about
an hour of work — resolves when the writer clicks it, so **reading it
carefully was the failure mode**. And a flush on a synced folder can exceed
four seconds by itself; v0.47.0 added EPERM/EBUSY retries precisely because
sync clients and scanners hold files open.

The timer is a liveness check now, not a deadline. The renderer sends a
pulse while it is working and the timer restarts on each one, so what it
measures is what it was always for: a renderer that has stopped responding
cannot make the window unclosable. A renderer that is busy, or waiting on a
person, is not that. The listeners are also removed by name rather than
left registered when the timer wins a race.

**What this says about v0.49.0**, which is the part worth keeping: that
release fixed six ways to lose work and added a regression test for each,
and two new ones went out in the same diff. Tests written alongside a fix
tend to test the shape the fix has, not the shape the bug had — v0.49.0's
save tests exercised the *stamp* during a save in flight, and never the
*close*. Reading the diff back, cold, found both of these in an afternoon.

**And three findings about the tests.** One negative control passed because
its sabotage was overwritten a line later, which meant the ordering it was
defending in `closeProject` is not the mechanism — `saveRun` is — so the
control is gone and the comment that claimed otherwise is corrected. And
the new close spec's own fixture spread a *closed* project's `null` into a
new one, leaving a project with no scenes: the checks still passed, because
saving nonsense is still saving, while the app rendered over something that
could not exist. That fixture made a whole half of the spec unreachable —
zero heartbeats, no error — and broke every spec that ran after it, since
specs share one application. A spec that leaves the app in a bad state
doesn't fail; the next one does, somewhere else, for reasons that look
nothing like it.

449 tests, 39 negative controls.

---

## v0.49.0 — A pass with the lights on

No new features. Five agents read the whole app looking for things that
were wrong, every extraordinary claim was checked by measurement before it
was believed, and the confirmed ones were fixed. The findings are in
`claude/audit-v0.48.md` in full; what follows is the part a writer would
notice.

**Six ways the app could lose work.** They share a shape, which is why
they survived seventeen versions: each one is a correct-looking line whose
failure needs two ordinary things to happen in the wrong order.

Switching scenes used Tiptap's `setContent`, which is a *transaction* on
the editor — so the swap went into ProseMirror's undo stack, and Ctrl+Z
after clicking a scene rebased the previous document's steps through the
new one. The fix replaces the whole `EditorState` rather than editing the
one that is there (`utils/loadDocument.ts`), which is the only operation
that has no history to rebase. The same effect reached the load itself:
the effect was keyed on `scene.id`, so a conflict reload that replaced
every scene in place left the open editor showing the old prose and the
next keystroke wrote it back over the file that had just been recovered.
It is now keyed on `${documentToken}:${scene.id}`, and the token moves on
every open, new, close and reload.

Structural undo restored `scenes` but not `entities`, so undoing a scene
delete also discarded everything typed on a Character page since. A late
save stamped whichever project was open when it *finished* rather than
the one it was written for, so switching projects during a save left the
new project holding the old one's file stamp — and the next save's
conflict check compared against a stranger. Closing a project cancelled
its pending write outright: 1.5 seconds of typing, gone, silently, at the
one moment a writer has most reason to assume everything is on disk.
`closeProject` now flushes first.

**The backup is a rotation, not a single file.** The one that mattered
most: "overwrite it with my version" wrote its backup to the same single
`.bak` that the routine five-minute cadence uses, *and* reset the cadence
clock — so the next autosave, triggered by nothing but continued typing,
copied the writer's own file over the other machine's work. The one undo
of last resort deleted itself on a timer. Three slots now (`.bak.1` newest),
so a version has to be pushed out by three later ones rather than replaced
by the next.

**Export can no longer land on the project file.** The export dialog opens
in the project's own folder, so the `.scriare` is right there in the list,
and clicking a file in a native Save dialog fills the name box with it.
Any extension was honoured verbatim, with no conflict check and no backup;
the story was replaced by a web page, atomically and completely, and the
app's next act was to offer "Open it". A project extension is never
honoured now, and anything that is not already a web page gains `.html` —
which also fixes `My Story v1.2`, whose `path.extname` is `".2"`, saving
with no extension at all under the old guard.

**Ten things that did not work.** Closing the window discarded unsaved
work with no prompt at all — there was a handler, but `beforeunload` in
the renderer is not what Electron asks; it is a main-process `close` event,
and the main process was not listening. Delete and Ctrl+Z reached the
story behind an open dialog. Creating, duplicating, pasting or deleting a
scene while a Character page was open left both selections set, and the
tree switched to the new scene while everything typed still went into the
character. Find could not match a query containing a space, because the
folding that makes search accent- and case-insensitive trimmed each
character individually and deleted the space between words. A folded
chapter only hid the scenes inside it if its box had been dragged by hand.
Escape did not close the slash-command or mention menus. Toasts rendered
*behind* modals. Opening Export twice showed the previous export's success
screen, one click away from opening a stale file.

**Eight measured performance findings, four taken.** The graph rebuilt
every edge on every selection change and did a linear scan per scene to
find its group — both now derive from one memo over the project. The
minimap re-rendered on every React Flow store tick because its selector
returned a fresh object literal. Dragging a choice's padding slider
re-serialised the document on every pointer event; it is throttled to a
frame now. The rest are in the audit doc with their measurements, deferred
rather than forgotten.

**What this version deliberately did not do** is change any behaviour a
writer chose. Every fix above restores something the app already claimed
to do. Tiers 3 to 5 of the audit — the remaining performance work, the
keyboard and screen-reader gaps, and the dead code — are recorded and
untouched.

**And a finding about the tests.** Three of the new negative controls did
not turn anything red. One sabotage was a no-op, one assertion was still
looking for the old single `.bak` name that the rotation no longer writes
under any circumstances, and one spec threw instead of failing when the
file it read was missing. All three were the test's fault, not the app's,
and all three were rewritten. The negative-control runner also now checks,
before it sabotages anything, that no earlier interrupted run left the
source broken — which had happened, and which nothing would otherwise have
noticed.

---

## v0.48.0 — The story as a page anyone can read

Export. One HTML file, playable in any browser, carrying everything the
writer formatted — and, first, a project file that finally says whose it is.

**Projects are `.scriare` now.** `.json` was honest about the format and
wrong about everything else: it sorts with config files, Explorer draws it
as a generic text document, and nothing about it says "this is my story".
The format has not changed and is not hidden — a `.scriare` file is still
JSON and still opens in any text editor. `.scri` was the shorter candidate
and lost on the argument that three letters save nothing anyone ever types:
the name is typed once, in a save dialog, and read a thousand times in a
file list. Every existing `.json` project still opens, permanently, and a
new story is offered a folder of its own in Documents — because a story is
not one file, it is the project, its `.bak`, and now the page exported
beside it.

**The export inherits the rich text editor's changes**, and that is not a
feature so much as a consequence of refusing to build a second renderer.
Prose goes through the same `resolveMentions` → speaker pass → Tiptap
pipeline Play Mode uses, so bold, italic, underline, headings, lists,
quotes, alignment, font family and size, hand-picked colour, highlight,
callouts, mentions resolved to their current names and speaker attributions
all arrive because it IS the renderer the writer was looking at. Choices
carry their styles, their conditions, their actions and their locked
reasons — the last of those written by the app's own `describeCondition`.

**Two reading grounds, not the app's eight themes.** A theme in Scriare is
chrome: forty-seven tokens tuned for a room with panels, borders and a
docked graph — "a theme tints the room, not the content". An exported page
has no room, and most of those tokens have nothing to refer to in it.
Shipping the writer's editor theme would publish whatever they found restful
at 2am to a stranger reading on a phone at lunchtime. So the export gets
**Paper** and **Night**, built for reading rather than for sitting beside
panels: Paper is a warm off-white rather than the Light theme's near-white
sheet, which only needs to out-bright a desk; Night is lifted well off black
because white on near-black at 15:1 halates on an OLED phone, and its body
text sits at 11.4:1, a long-read number rather than a specification-sheet
one. The reader switches between them and their choice is remembered; before
they have an opinion, the story opens on Night.

Every pair was measured before it shipped, and the first pass failed: Night's
tertiary text came in at 4.37:1 against a choice's fill — which is the text
carrying a locked choice's *reason*, the one thing a locked choice exists to
say. The whole ramp was lifted rather than that token nudged over the line,
because a value chosen to just pass a threshold fails the moment anything
around it moves.

**Colours the writer picked are content, so they travel unchanged — and the
export says so rather than fixing it.** A pale blue chosen in the Dark theme
lands on Paper as pale blue on off-white. The export dialog lists what may
not read, on which ground, with the measured ratio, and exports anyway: an
unreadable colour can be the point, and a tool that refuses to export a
deliberate effect has stopped being a tool. A choice style that was never
given a colour is written in theme variables, so it follows whichever ground
the reader chose and is never flagged.

**The reader gets Back, Restart, and their place kept.** Back undoes what a
choice did to the variables, not only where it went — otherwise you walk
back through a door keeping the key you picked up on the way out. A returning
reader is *offered* their place rather than dropped into it, because someone
reopening the file may have wanted to show a friend the opening.

**One file, no requests.** No font link, no stylesheet, no script, no image
host. It works offline, from a folder or a USB stick, and nobody learns who
read it. The cost is a system reading face instead of the app's Manrope —
the honest trade, since a webfont link would make an exported story's
typography depend on the network, which is the exact bug the app fixed in
itself by bundling its fonts.

Two things could not reuse the app's code, because a save dialog cannot ship
TypeScript to a browser: deciding whether a condition passes, and applying a
variable action. Those are transliterated by hand, and hand-transliterated
logic drifts into the worst failure this app has — a door that opens in Play
Mode and stays shut in the export, with nothing on screen to say so. They are
held to the originals by enumeration rather than by care: 966 condition cases
and 93 action cases, every type, every comparator, both polarities of
`negate`, every operation and a spread of wrong-typed values, run through
both implementations and required to agree. The exported file is written to
disk and opened in a real browser window to answer them, because the first
version ran it in a frame inside the app, where the app's own CSP blocked the
inline script and every assertion passed against a page whose behaviour did
not exist.

Three things review caught that the tests did not:

- **Export reused the project save path and brought the backup with it**, so
  exporting twice would have left a `My Story.html.bak` in the folder — a
  backup of a file that is itself a derivative.
- **The injection test was guarding a door that was never open.** It put
  `</script>` in a paragraph, where Tiptap had already escaped the `<`. The
  real hole is a scene *title*, which is copied into the embedded story data
  exactly as typed. Removing the escaping broke nothing until the test looked
  where it mattered.
- **A scene title with `</script>` in it, and two spellings of the same
  colour.** Each ground's page and text colour exists twice — as `oklch` in
  the stylesheet and as sRGB for the contrast check — so both are now painted
  onto a canvas and compared pixel to pixel rather than trusted to stay in
  step.

411 checks, and nineteen deliberate sabotages — a comparator off by one, an
action that subtracts, a Back that keeps the key, a ground switch that
changes the attribute and nothing else — each confirmed to turn the right
check red.

---

## v0.47.0 — Saving a project without destroying it

The save was one line: `fs.writeFile(filePath, json)`. That opens the
writer's real file, truncates it, and then writes — so from the first byte
until the last, what is on disk is neither the old version nor the new one.
Anything that interrupts it costs the file. Reproduced before touching
anything, on a filesystem with no room left:

```
before:  16719 bytes, parses: true
write failed: ENOSPC
after:  409600 bytes, parses: false
```

A 16KB story became 400KB of half-written JSON, and the last good version
was already gone. A full disk, a quota, a synced folder out of room, a
laptop losing power, a process killed mid-save — the same accident wearing
different clothes.

**A project file is now replaced, never written into.** The new version goes
to a temp file beside it, is flushed to the platter, and is renamed over the
target. A rename inside one directory is atomic: readers see the old file or
the new one, and a failure at any earlier step leaves the old one exactly as
it was.

**The version being replaced is kept**, as `<project>.bak` — but on a
cadence, not on every save. Autosave fires 1.5 seconds after every change,
and a backup from 1.5 seconds ago is the same mistake you just made; every
five minutes gives you a version from before the thing you regret. The one
exception is overwriting a conflict, which always keeps what it destroys.

**A file that changed underneath us is not overwritten.** The app remembers
which version it opened and asks before replacing anything else: reload,
save yours as a copy, or overwrite deliberately. Nothing is written while
the question stands, and no save is even attempted behind the dialog.

Three more defects turned up while reviewing this work, none of them in the
original plan:

- **Two saves could run at once** — Ctrl+S while autosave was in flight —
  and they collided. Both generated the same temp filename (same process,
  same millisecond), so one rename took the file and the other failed with
  ENOENT; the save the writer asked for was the one that lost. Temp names are
  now unique per write, and saves are serialised, with a single re-run queued
  if anything changed while one was in flight. Without that, the older save
  could also land last and quietly put back a chapter you had just cut.
- **A failed save said nothing.** The status stopped at "Saving…" and stayed
  there — the one moment a writer most needs to be told something, told
  silently. It now names what happened ("there is no room left on the disk")
  and says plainly that the work is still open and the last saved version is
  intact. Once, not once per autosave.
- The fallback file size counted characters rather than bytes, which is
  wrong the moment a story contains a single Turkish character.

28 tests, every one of them confirmed to fail on a build with the old
behaviour put back — including three assertions that had to be rewritten
because they passed against the bug they were written for. The first watched
a save in flight and asserted it never saw a half-written file; what it was
actually measuring was how long the JSON takes to cross the IPC bridge.

---

## v0.46.0 — A theme audit, and the four things it found

No new features. The app was walked in all eight themes, on every surface it
can open, looking for colours it paints that do not come from the palette —
because a hardcoded colour is theme-blind by definition: it looks deliberate
in whichever theme it was written against and wrong in the other seven.

**Check Story's warnings were Tailwind's amber**, a literal colour with no
relation to the palette. On a dark ground it reads; on the four light and mid
grounds it is nearly invisible — so on half the themes the app's own "look at
this" mark was the hardest thing on screen to see. There is now a `--warning`
token, the third of the meaning colours beside `--danger` and `--success`,
tuned per ground the way those are.

**The ending card in Play Mode was painted with `--overlay`** — the scrim
drawn *behind* a dialog, used as a surface. On the dark themes that passes for
a slightly darker panel; on the light ones it is a heavy grey slab across the
page. An ending is a panel on the page, and panels are surfaces.

**Two controls outlined themselves in black** regardless of theme — the
toolbar's colour chip and the theme swatches in Settings — and **a drag
preview in the Inspector carried the dark theme's shadow written out by
hand**, which on a light ground reads as dirt on paper. All three now use the
tokens that exist for exactly this.

Also removed: opacity modifiers on `var()` colours (`border-[var(--danger)]/50`
and friends), which Tailwind cannot compute and silently discarded — a fade
that was never on screen in the first place.

**The audit is now a test**, run on every surface in every theme, with the
two things that are legitimately off-palette marked as such: the toolbar's
colour and highlight bars, which *are* the colour they show. Confirmed by
putting the amber back — all eight themes report it.

One thing deliberately not fixed: the Story Graph's connection handles are
drawn by React Flow in its own navy-and-white, but they are `opacity: 0` in
this app — nobody drags a wire here, connections come from the writing — so
theming something invisible would have been a fix for nothing.

---

## v0.45.0 — One control for folding a panel away

**The dock toggles are the same control now, in all eight themes.** Reported,
and it was two faults wearing one symptom. The three dockable panels —
Content, Inspector, Story Graph — had each grown their own version of the
same button: three different glyphs at three different sizes, one of them
baked into a header label that was itself the button. On top of that, the
Content panel's ghost buttons were being drawn as raised boxes while the
identical control one panel over stayed flat text, so the two did not even
look like the same KIND of thing.

That second half was a CSS bug from v0.40.0's elevation pass. The rule that
lifts a selected row matched the Tailwind class that paints it — and a
Tailwind variant's class name contains the base name, so
`hover:bg-[var(--surface-2)]` matched too, and every ghost button in that
panel that merely lit up on hover was permanently drawn as a raised object.
The rule now keys on a class the row sets for the purpose.

The toggle itself is one component: a real bordered button, 22px square, same
radius, border and fill everywhere, with the chevron DRAWN rather than typed
— a glyph like ◂ is a font's opinion, and its weight and baseline differ
between the faces the app falls back to, which was half of why the three
never matched. A collapsed strip shows the same box, because the control you
click to fold a panel away and the one you click to bring it back should be
recognisably the same control.

**And it has room.** The Content toggle was the third item in a row of three,
hard against "+ Group"; it now sits apart from them, because folding a panel
is a different kind of act from making a scene. The Story Graph's sat
directly under the splitter, all but touching the editor above it, and now
has a proper margin.

The tests measure the three against EACH OTHER, in every one of the eight
themes, rather than against numbers written into the test — so this cannot be
satisfied by three controls that happen to match on the day they were
written.

---

## v0.44.0 — Eight themes, and a page that behaves like paper

**Six new themes.** Daylight (paper and sepia ink, the lightest), Overcast
(a mid slate, where the page is the only bright thing in the window),
Lamplight (dark and warm, amber), Deep Water (dark and cold, cyan), Nocturne
(violet and rose) and Phosphor (terminal green). Colour lives in the ground,
not in the content: a theme tints the room, and the accent — which only ever
marks selection, focus and the primary action — is the one piece of chrome
that carries a hue of its own. The picker in Settings shows all eight at
once, each swatch drawn in its own theme's tokens, because a theme is chosen
by looking and a list you scroll turns that into a memory test.

**Dark and Light are polished rather than replaced.** Dark gets a deeper
floor (9.5%, from 11%) so panels and the page have something to sit above;
its --border-soft now sits above --surface-2 instead of below it, so a soft
border actually divides rather than disappearing into what it divides; and
the warmth the theme has always claimed in its own comments is finally
perceptible rather than a rounding error away from pure grey. Light's desk
steps back so the page can be the brightest thing on screen.

**The page is a sheet on a desk again.** It was drawn in --surface, which on
a light theme is DARKER than the ground it lies on — so the paper was dimmer
than the desk, backwards for the one metaphor the whole elevation pass is
built on. Every theme now sets --page, a step from --bg toward the light.

**Captions got legible.** Measuring the palettes rather than looking at them
turned up that --text-3 — the status bar, every hint and caption, at eleven
pixels — was under 4.5:1 in the shipping Light theme and in five of the six
new ones. All eight now clear it where they are read, and the suite measures
the real ratios from what the browser paints rather than trusting the
numbers in the stylesheet.

The eight themes and their contrast floors are covered by tests: every theme
must define every token the default one does (a missing one silently
inherits and nothing says so), must paint a different ground, must keep its
page lighter than its desk, and must keep its borders far enough from what
they divide to be visible at all.

---

## v0.43.0 — A map that reads left to right

**Auto Layout arranges the story, not the diagram.** Reported as "it tidies
up the space but seems like not enough", and the cause was the ranking: dagre
minimises total connection length, which is right for a flowchart and wrong
for a story. Given a scene with three choices it was free to put each option
in a different column so the long branch and the short one met neatly at the
merge — three options from one moment marching down and to the right, with
not one of their connections horizontal.

A scene now sits one column past the scene that leads to it, so every choice
out of a scene lands in the same column: the trunk runs straight across, a
branch is a vertical fan at the moment it happens, and a column means
something you can read — how far into the story this is. On top of that, a
scene whose feeders all sit on one line joins that line, which is what turns
a spine of four scenes from a gentle zig-zag into one straight row. A merge
point is deliberately left where it is, between the branches it merges,
because a merge that snaps onto one branch lies about the others.

Columns and rows are also closer together — 108px and 36px, both whole cells
of the canvas grid.

**A connection says which choice it is.** Every wire now carries "Choice 1",
always, instead of a bare ordinal that turned into the choice's full sentence
under the pointer or on a selected scene. The sentence is one double-click
away in the scene itself, and a label that rewrites itself as the pointer
moves is a label you have to chase. Pulled far enough out that the text would
be a smear along the wires, it is left off entirely.

**Folding a chapter no longer resizes it.** Reported: fold a group, move it,
unfold it, and the box came back the size of the little folded block with its
own scenes sitting outside it. A box's drag was writing the size it was DRAWN
at, and a folded box is drawn as a fixed small block while still owning the
dimensions it will unfold to. A drag moves a box; only a resize resizes one.

**And a box no longer shrinks by a pixel or two every time it is moved.** The
grid snapped every rectangle by its corners, which is right for a resize and
wrong for a move: the origin and the far edge round independently, so sliding
a 620x300 chapter sideways quietly made it 612x306. Whichever gesture is
happening decides the rule.

---

## v0.42.0 — The canvas has lines

**The Story Graph is grid-based.** Movement, landing and resizing all obey
an 18px lattice — the same spacing as the canvas's fine dot field, so a
card comes to rest on a dot rather than on an invisible rule. A story laid
out by hand now lines up the way one laid out by Auto Layout does, without
anyone nudging anything by a pixel.

Four routes reach the canvas and all four had to agree, or the grid would
read as a rendering bug rather than a rule: a dragged card (which steps
from cell to cell while the mouse is still down, not on release), a resized
box, Auto Layout's output, and any position written straight to the store —
which is how a pasted scene or a project file from before the grid arrives.
A box is snapped by its corners rather than by its origin and size, so the
edge you dragged lands on the line nearest where you left it.

**Holding Alt suspends it**, for the one thing a grid cannot do: put a card
exactly where the grid has no line.

**Also fixed:** a scene that left the canvas — deleted from the Content
Browser, or carried off with a project that was closed — stayed selected,
with nothing on screen saying so and Delete still pointed at it. Found while
testing the grid; what is selected is now always a subset of what exists.

---

## v0.41.0 — A bar at the bottom, a floor under the graph

Five things, all reported while using v0.40.0, and none of them changes how
anything behaves.

**The window closes the way it opens.** The top of the three columns is a
single unbroken line; the bottom was three different edges at three
different heights, because each column ran out of content wherever it
happened to. There is now one bar across all three. It carries what a
writer glances down for: how big the story is, which scene is open and how
long it is, and whether the map is showing. The word count is the open
scene only — a project-wide count would mean walking every document on
every keystroke.

**The Story Graph has a floor.** Two dot fields instead of one flat grid: a
fine one that gives the canvas a surface, and a coarser, brighter one that
gives it a scale. Reported as "the graph feels infinite and hard to read",
which is exactly what a canvas with no measurable spacing feels like —
without the second field, panning reads as texture sliding past rather than
as movement over something.

**The Story Graph can take the whole column.** The splitter's ceiling was a
hard-coded 640px, so the map stopped at roughly two thirds of the window.
It is now the column's own height, measured at drag time: drag all the way
up and the editor retracts completely.

**More lift.** Every elevation token is heavier and two-layer, controls went
up a step — they were the half still reading as flat — and a selected row
or the active scene card now catches a faint ring of the accent as well as
casting a shadow. The page gained a third shadow layer and a lit top edge,
so the sheet has a rim rather than sitting on a dark rectangle.

**The side panels separate by light, not by shadow.** They now carry a
single lit pixel down their inner edge instead of casting into the editor —
the same reason the inward cast was removed in v0.40.0, applied as a
replacement rather than an absence.

## v0.40.0 — Lifted

A finish pass, chosen from four mockups. Nothing moves, nothing is added,
nothing behaves differently: every change is a shadow, a lit edge, or the
padding of the new page.

**The writing surface is a page.** A sheet with its own edge and shadow,
sitting on the desk, rather than text lying directly on the background. Its
width is the reading column plus exactly the margin it adds, so the line
length a writer sees is unchanged — and on a narrow window the margin
narrows rather than shortening the lines.

**Controls read as made objects.** Anything that already drew a border —
the font and size pickers, the Choice group, the top bar's buttons, the
Inspector's fields — gets a single lit pixel along its top edge and a
shadow beneath. Ghost icon buttons stay flat on purpose: that contrast is
what makes the difference legible.

**Selected things rise.** A selected row in the Content Browser lifts
instead of only brightening, and a scene on the graph is a card on a table.
Group boxes stay flat — a container that casts a shadow looks like it is
sitting *on* what it is supposed to hold.

Elevation is a token set with separate values per theme, because a
dark-theme black shadow on a light-theme page reads as dirt.

One thing was tried and removed: the side panels casting inward onto the
editor. It was worth about two levels of grey, and it dimmed the first
thirty pixels of the toolbar's bottom border, so the border stopped
visibly short of the Content Browser's edge and that corner read as
unfinished. Reported, measured (3/255 against 5/255 across the rest of the
line), and deleted. A wall is defined by its line, not by its shadow.

## v0.39.2 — The third group on the canvas stopped eating clicks

Reported: the scenes inside the **Endings** group couldn't be opened — a
click selected the group instead — while the other two groups and
everything in them behaved.

Nothing about that group was special. A group's stacking order was its
place in the parents-first group list, so that a box nested inside another
paints above the one that owns it; a scene's was the literal 1. The first
box (0) sat behind its scenes, the second (1) tied and lost to them, and
the **third (2) and everything after it** was drawn over its own contents
and swallowed every click. A box is a container, so it now always sits
behind what it contains, whatever order it was made in.

Four tests, two of them measuring the reported sentence directly: what is
under the pointer at a scene's centre, and which object a real click
selects. Both come back naming the group on a build with the fix removed.

## v0.39.1 — The Story Graph's connections are visible again

Every connection printed its choice's full sentence across the curve. On a
thirteen-scene story that made the map unreadable: the sentences overlapped
each other and sat on top of the wires they belonged to, so the one thing
the graph exists to answer — which scene leads where — was the one thing
you couldn't trace.

A wire now carries its choice's **number** instead, a small bead on the
cable, numbered by the option's place on the page — so an unlinked option
keeps its number rather than silently renumbering the rest. The text
appears where you are already looking: **point at a wire** and that one
choice is named, at any zoom, drawn at a fixed size on screen so it is
readable even when the whole story is on the canvas; **select a scene** and
its own wires carry their text, once the camera is close enough for an
11px label to be legible. Nothing was removed; it just stopped all being
shown at once. Bundled connections between folded groups read `×3` at rest
and `3 links` when pointed at.

Also: the test runner now resets the editor/graph splitter along with the
panel layout. The graph fits its camera to the panel it is given, so a
splitter position left over from writing decided the zoom, and the zoom
decided how many screen pixels a node occupied — which quietly changed what
the Group-rename drag test was measuring. Same leak as the seven
one-machine failures in v0.38.1, one key further along.

## v0.39.0 — Deleting, renaming, and a Group name you can select

Three things found by using the app. All the same shape: something built
and then not connected to the way a person actually reaches it.

**Characters and Locations can be deleted.** Right-click a row for Rename
and Delete, with the same undo toast a deleted scene raises. `deleteEntity`
had been in the store since v0.35.0, correct and undoable — its row simply
had no menu, so nothing in the interface ever called it. Deleting someone
still leaves every mention of her in the prose: the words stay as written,
the app just stops claiming they point anywhere.

**F2 renames.** A scene, a group, a character or a location — whichever the
Content Browser has selected. Focus decides whether the key is yours or the
text field's, the same rule Ctrl+Z and Ctrl+C already follow, so F2 with
the caret in a sentence does nothing. Delete now removes a selected
character too, and the panel holds one selection at a time rather than
leaving a scene lit up while a character row is the one you're acting on.

Renaming a character renames her *everywhere*, and there is no second
option, because there is nothing for one to mean: no sentence ever stored
her name. If she should be called something else in one place, that is an
alias, which the app has had since v0.35.0.

**A Group's name on the Story Graph can be selected with the mouse.**
Dragging across it moved the whole group. The field guarded `mousedown`;
React Flow drags from `pointerdown`, so the guard never saw the gesture —
and a plain click worked fine, which is what made it look like a
text-selection quirk rather than a drag. It uses React Flow's own `nodrag`
opt-out now, which checks the whole target chain.

Sixteen new tests. Two of them are the interesting ones. The first version
of the drag test dispatched its own PointerEvents, and both the assertion
and its control reported "nothing moved" — the drag had never started, so
the test passed for the wrong reason; it now uses a real mouse. The second
version then landed on a scene node sitting over the group, which looked
exactly like the bug, so the test now asserts what is under the pointer
before it presses. A hand-written `pointerdown` guard added along the way
was deleted when the control showed `nodrag` alone was doing the work.
244 tests.

## v0.38.1 — Fixed: the test suite measured the writer's own workspace

Seven tests failed on one machine and passed on every other. The cause
wasn't in the app: Electron gives an app one `userData` directory per app
name, so the test build and a real installed copy of Scriare share the
localStorage key that remembers which panels you collapsed. A writer who
had folded away the Inspector and the Story Graph to write ran a suite in
which seven assertions measured panels that were not on screen.

The runner now states the layout instead of inheriting it, before the app
mounts. But the seven failures were the *smaller* half of this. Three other
assertions had been passing **because** the panels were missing —
`.every()` over an empty list is true, so "every row is still" and "the
open row has its controls" were both satisfied by an Inspector that wasn't
rendered, and "a story that fits has no minimap" was satisfied by there
being no graph. Those now assert their own preconditions: four rows, one
open row, a visible graph.

A test that cannot tell "correct" from "absent" is worse than a missing
test, because it reports success. 228 tests.

## v0.38.0 — Find

Searching the Content panel now searches the writing: every line of prose,
every choice label, and every character and location page, grouped as
**In the story** and **On pages**. Clicking a result opens that scene with
the matched words selected. Turkish-aware matching, shared with the `@`
menu so the two can't disagree.

## v0.37.2 — Fixed: attributing a line you've already written

`@` at the head of a line now sets the speaker even when the line already
has words in it. The old rule required an empty line, which got the
commonest order of work backwards — you write the line, then say who said
it. Shift on confirm still writes the name into the line instead.

## v0.37.1 — Fixed: places were offered as speakers

A Location could be set as a line's speaker. Only a Character can speak
now, asked through one function (`canSpeak`) at every door. The `@` menu
still offers a place at the head of a line, marked as a mention.

## v0.37.0 — Speaker attribution

A line can know who is saying it: `@` at the head of a line attributes it,
Enter carries the speaker forward, Backspace drops it, clicking the name
changes it. Play Mode prints the name when the speaker changes. Choices can
carry a speaker too. Also fixed: a character mentioned inside a choice
label was invisible to the Story Graph, Check Story and the Inspector.

## v0.36.2 — Check Story, grouped by scene

Findings are grouped by the scene they're repaired in, with counts as
colour chips rather than prose. Unwritten choices are named by position
("choice 3") instead of repeating the editor's own placeholder.

## v0.36.1 — The minimap knows when to leave

The Story Graph's minimap now appears only when part of the graph is off
screen, and sits at a low opacity until the pointer reaches it.

## v0.36.0 — Check Story

A report of the story from the outside: unreachable scenes, choices that go
nowhere, links to deleted scenes, gates on deleted variables, endings,
route lengths and word count. Every line is a button that opens the scene
with the Inspector already pointed at what needs fixing.

## v0.35.1 — Fixed: the cursor giving away where the characters are

Mentions carried an unscoped text cursor, so the pointer changed as it
crossed a name in Play Mode. Every hint a mention gives is now scoped to
the editor; in Play Mode it inherits whatever surrounds it.

## v0.35.0 — Characters and Locations

Both are one object with two kinds: a name, the other names it answers to,
and a page written in the same editor as a scene. `@` mentions them by any
of their names, offers to create one that doesn't exist yet, and stores the
id — so renaming reaches every sentence, including in Play Mode. Matching
handles Turkish properly. Also: Play Mode's duplicate Exit button removed.

## v0.34.1 — Fixed: the Inspector closing while you use it

Reordering a choice threw the Inspector back to Scene Properties on mouse
release. A selection inside a choice now always opens it; a selection in
nothing only closes the panel when the writer moved it there themselves.
The same wrong assumption was also making a header click open and shut the
panel within one click.

## v0.34.0 — Choice Styles

Named styles — fill, border, thickness, radius — defined once in Project
Settings and worn by any choice, with per-choice overrides and a reset.
Choices are drawn in their style while writing, not only in Play Mode. A
colour set back to "Theme" follows light and dark mode.

## v0.33.2 — Fixed: choices flying in from the bottom of the Inspector

Opening choices top-down animated each one racing up the panel. The
animation now distinguishes a row that moved because something else resized
from a row that merely opened or closed.

## v0.33.1 — The panel follows the caret

The toolbar no longer grows six pixels when the caret enters a choice, and
the Inspector opens on the choice being typed in — on the option the caret
is in, not a list of summaries. A stale captured scene id in the selection
handler was the cause of the second half.

## v0.33.0 — The toolbar learns the language

Nineteen toolbar controls redrawn in the app's own icon set on the same
grid as the rest of the UI. B/I/U stay as letterforms; the colour controls
wear the colour they'd apply; a Choice group appends when the caret is
inside a choice. Nothing moved and nothing was removed.

## v0.32.0 — Choices are written, not configured

A choice's label became real inline content in the document rather than a
string in a hidden property, so the toolbar, undo, find and Play Mode all
reach it with no new code. Old projects convert on load, across two
generations of the previous shape.

## v0.31.1 — Folded means folded

A folded group no longer catches scenes dropped in the empty space it used
to occupy — hit-testing uses the rectangle actually drawn. Folding a group
now hides its sub-groups too.

## v0.31.0 — One word, both ways

A group created in the Content Browser now appears on the graph once it
holds a scene, and follows its scenes until first moved. "Folder" is called
"Group" everywhere a person can read it.

## v0.30.0 — Conditions

A choice can require a variable's state — variable, comparator, value, all
of which must hold, with a NOT toggle and no expression field. A failed
condition can hide the choice or lock it with the reason shown. Adds
Conditional Text for gating prose, and a read-only variable readout in Play
Mode.

## v0.29.0 — Auto Layout, all the way down

Auto Layout now arranges the inside of every group and resizes each one to
fit, running innermost-first so a nested chapter lands inside its parent.
One Ctrl+Z puts every position and box size back.

## v0.28.0 — One hierarchy

Frames were removed; a folder now owns its box on the graph. Renaming,
deleting, dragging and dropping on the canvas all reorganise the tree,
because they are the same object. Groups fold, bundling crossing links into
one labelled edge, and nest to any depth. Old projects convert on open.

## v0.27.0 — Keys that work everywhere

Ctrl+C / X / V and Delete work on scenes and folders, routed by focus the
same way Ctrl+Z is. The panel touched last owns the keyboard. Copying
linked scenes gives you the branch — the copies link to each other, while
links out of the copied set still point where they did.

## v0.26.0 — Undo, out loud

All five delete confirmations replaced by an undo toast, since a modal
earns its interruption only while the mistake is permanent. The toast drops
its button the moment its history step stops being the one undo would
reverse. Tests became a first-class part of the project (`npm test`).

## v0.25.0 — Undo

Project-wide undo/redo for every structural action, snapshot-based and
cheap because the store never mutates in place. Undo never rolls back
prose: structure and words have separate stacks, routed by focus. One
gesture is one step.

## v0.24.0 — A quieter, better-built monochrome

Three causes behind "it feels dull", two of them bugs: the Content Security
Policy had been silently blocking Google Fonts and the logo in every build,
and the greys were chroma-0 with a tonal ramp too even to read as
hierarchy. Also: emoji removed from the chrome, minimap muted, light
theme's editor made readable.

## v0.23.4 — Fixed: measurements taken mid-animation

In-flight animations are settled before measuring; mid-transition reads
were producing negative spacing and wrong drops.

## v0.23.3 — Fixed: choices sliding behind the landing zone

Paint order corrected so choices always render above the landing
placeholder.

## v0.23.2 — The dragged choice looks as lifted as it is

A border and layered shadows on the floating card.

## v0.23.1 — Fixed: the jolt at the moment of release

A stale baseline made a dropped choice replay an animation of a move that
had already happened.

## v0.23.0 — Drag reordering rebuilt on a layout that doesn't move

The list is frozen for the whole gesture and choices move by transform, so
the geometry a swap decision reads can no longer be changed by that
decision. Threshold tuning replaced by nearest-landing-zone matching.

## v0.22.12 — Fixed: downward-drag overshoot

Overshoot fixed by comparing cursor edges; a visible landing zone and a
commit delay added.

## v0.22.11 — Fixed: reorder dead zones

Dead zones fixed by comparing near edges; sibling positions frozen at
drag-start to stop oscillation.

## v0.22.10 — Removed the drop catch-up animation *(superseded)*

An unconfirmed guess at a reported collapsing-choices bug. The bug survived
the release.

## v0.22.9 — Scroll-anchoring disabled *(superseded)*

Browser scroll-anchoring was blamed for sliding choices. The premise was
wrong and the fix did nothing.

## v0.22.8 — Choice spacing made structural *(superseded)*

Margins replaced by flex gap — a real structural improvement that didn't
touch the reported symptom.

## v0.22.7 — Content-aware drag bounds *(superseded)*

Fixed clearance replaced by one derived from live sibling edges. Fixed that
issue, not the one reported next.

## v0.22.6 — Fixed: last slot unreachable when dragging

A full-card-height clearance replaced by a small fixed one, so every slot
can be reached.

## v0.22.5 — Smooth drop and bounded drag

A stale-state jolt on drop fixed with refs; dragging clamped to the panel's
bounds.

## v0.22.4 — Top-edge drag reordering

The reorder trigger compares top edges rather than card centres, so the
swap point stops shifting with what's expanded.

## v0.22.3 — Fixed: stuck gaps between choices

Transforms reset before measuring; drag cleanup hardened against
interrupted gestures.

## v0.22.1 — Choice Block Inspector refinement

Drag overlay made purely cursor-based, inline "Create Scene / Variable"
added, choice creation restored to the block editor.

## v0.22.0 — Choice Block Inspector refactor

Every choice edit, from the Inspector or the editor, now goes through one
real ProseMirror transaction — the previous path wrote to the saved project
without the live editor seeing it.

## v0.21.0 — Runtime foundation and variables

Typed variables and an Inspector-driven Actions system, so a choice can set
or toggle a variable with no syntax anywhere. Scene Details became the
adaptive Inspector.

## v0.20.3 — Bold and code no longer hide text colour

Tailwind Typography's hardcoded colours forced to inherit.

## v0.20.2 — Text-colour reset inside lists

Resetting colour inside a list no longer strips font and size with it.

## v0.20.1 — Toolbar selection-loss fix

Toolbar clicks were stealing the editor's selection, so controls read a
stale, collapsed cursor.

## v0.20.0 — Styled list markers

Bullets and numbers take the list item's colour, font and size.

## v0.19.2 — Reset text colour and highlight

Reset buttons beside each picker, so either can be cleared without Clear
Formatting.

## v0.19.1 — Colour picker drag performance

Per-pixel change events coalesced into one editor update per frame.

## v0.19.0 — Existing features evaluation

The New Project dialog rebuilt on the shared Modal shell; fifteen other
systems evaluated and deliberately left unchanged.

## v0.18.0 — Desktop identity

Electron's default menu and branding removed, the app's real name set, and
destructive-button colours matched to the theme token.

## v0.17.0 — Story Graph interaction feel

Eased drag lift, a crosshair over empty canvas, hover on resize handles,
and selection-driven edge highlighting.

## v0.16.0 — Frames in Auto Layout

Frames participate in Auto Layout as their own node, moving as a unit while
their contents keep their arrangement.

## v0.15.1 — Story Graph interaction fixes

Multi-selected nodes move together; a redundant bounding box removed;
laggy top and left resize handles fixed.

## v0.15.0 — Story Graph interaction polish

Right-drag to pan, left-click to select, box-select — the scheme node
editors use. Live frame resizing, and a selection ring distinct from
opening a scene.

## v0.14.2 — Frame selection fix

Frames lost selection on every redraw; selection became explicit app state.
Connectors switched to bezier curves.

## v0.14.0 — Graph interaction evaluation

Frames given the lift, selection border and hover feedback scenes already
had; edges highlight with the selected scene.

## v0.13.0 — Real logo

The typographic placeholder replaced by the finished mark — theme-aware in
the app, fixed dark for the OS taskbar.

## v0.12.1 — Lighter light mode

Light mode's background and surfaces shifted from near-white to a light
grey, with every contrast step unchanged.

## v0.12.0 — Minimal

Four colourful themes replaced by black/white/grey Dark and Light, with
colour reserved for meaning. UI font switched to Inter.

## v0.11.2 — Dockable panels polish

Collapsed-strip labels unified with the Story Graph's styling.

## v0.11.1 — Dockable panels polish

The collapsed bar clickable anywhere, collapse icons unified, Scene
Details' toggle moved beside the page.

## v0.11.0 — Dockable panels

All three panels collapse to thin strips, and the layout is remembered
across relaunches.

## v0.10.6 — Minimap refresh fix, part 2

v0.10.5's fix had a missing dependency, so the counter never forced the
recompute it existed for.

## v0.10.5 — Minimap refresh fix

The minimap showed colourless boxes until something was dragged.

## v0.10.4 — Drag freeze fix

Each node's measured size is cached, so it survives being rebuilt as a new
object every frame.

## v0.10.3 — Drag performance fix

Choice counts and edges memoized on content alone, making per-frame drag
updates pure arithmetic.

## v0.10.2 — Drag fix, part 2

Scenes follow the cursor via a live drag offset, the mechanism frame
dragging already used.

## v0.10.1 — Drag fix

Drag lift and drop-target highlights moved to CSS classes, so dragging a
scene no longer snapped back to its start.

## v0.10.0 — Graph interaction polish

A drop preview and lift state while dragging, eased hover and select
transitions, smoothed edge and camera-fit animations.

## v0.9.1 — Brand mark

The logo image replaced by a rendered letterform, so the mark re-themes
with the accent colour instantly.

## v0.9.0 — Premium redesign

Theming rebuilt on oklch CSS custom properties instead of hardcoded colour
classes, so a theme changes in one file. Newsreader paired with Manrope.

## v0.8.3 — Drag and drop fix

A `preventDefault` on nested buttons had been breaking Content Browser drag
and drop since v0.6.1.

## v0.8.2 — Regression audit

v0.8.0/v0.8.1 traced across drag and drop, selection, favourites, search
and graph sync. No functional regressions — though the audit traced code
rather than gestures, and missed the drag bug fixed in v0.8.3.

## v0.8.1 — Start Scene management

The Start Scene can be set from the Content Browser and the Inspector, with
exactly one kept in sync everywhere.

## v0.8.0 — Runtime polish

A settable Start Scene, an ending screen, Escape to exit, scene fades, and
Play Mode split into its own runtime layer with a per-block registry.

## v0.7.0 — Narrative blocks

Multi-option Choice Blocks, slash commands, and a Callout block — all
typed straight through, so paragraphs are still paragraphs. Play Mode
renders every block in document order.

## v0.6.2 — Play Mode reading-width fix

Play Mode shares the editor's reading-column definition, so text width,
wrap and typography match between writing and playing.

## v0.6.1 — Selection and layout fixes

A stray focus highlight on Shift+Click removed; scene connection points
moved to left and right so Auto Layout's edges route straight.

## v0.6.0 — Multi-selection and confirm dialogs

Ctrl/Shift multi-selection, multi-item drag and bulk actions in the Content
Browser, and in-app confirmation dialogs.

## v0.5.0 — Content Browser

A hierarchical drag-and-drop Story tree with folders, favourites and
search, built on a generic `ContentNode` so future content types need no
changes to the tree.

---

## Before v0.5.0

The project's written history begins at v0.5.0. Earlier versions are known
from references elsewhere in the notes rather than from entries of their
own: **v0.4.0** brought the writing toolbar and the resizable editor/graph
split, and **v0.3.0** brought Play Mode. They are listed here for
completeness rather than reconstructed in detail.
