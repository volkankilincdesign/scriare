# Changelog

Every released version of Scriare, newest first.

Entries are one or two sentences. The reasoning behind the bigger decisions
is in [CASE_STUDY.md](CASE_STUDY.md); the long-form notes each release was
originally written with are preserved in this file's history.

Versions are not dated — the project was built in a continuous run rather
than on a release schedule, and inventing dates would be worse than
omitting them.

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
