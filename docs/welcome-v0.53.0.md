# The Welcome screen — v0.53.0

The first screen anyone sees, rebuilt. Three mockup rounds on a design
canvas before a line of app code was written, then the build. This is the
record of what was decided and why.

## The diagnosis

Not ugly — unfurnished. A 448px column dead centre in a 1280×800 window,
about 85% of the screen flat `--bg`. It used none of the app's own
vocabulary: no `--page` sheet, no elevation, and the loudest thing in each
recent row was a file path. With no projects it said "No recent projects
yet." — a report of an absence on the one screen where the north star
applies most directly.

## What the mockups settled

Three directions were drawn against real token values: **A · the Sheet**
(same layout, now standing on the app's own sheet), **B · the Desk** (brand
and actions left, stories right), **C · the Shelf** (the stories become the
screen). C was chosen: opening a story is 95% of what happens here, so it
gets the room.

Two sub-versions of C then turned out not to be two designs at all. **C2**
opened on the scene you were last in; **C3** was what a stranger sees. They
are the same screen with something on the shelf and with nothing on it —
so the final design, **D**, is one screen in three states, and the thing
that changes is what the hero slot *means*:

| Shelf | The hero slot says |
| --- | --- |
| 0 stories | See what this is |
| 1–8 | Keep writing — the scene you stopped in |
| 9+ | Which of these did you mean? — search in use |

**The frame does not move.** Wordmark, search, Open Project…, New Project:
identical position and size in all three. That is what makes this one
screen rather than three wearing the same paint, and a test measures the
header's box in each state, because the claim *is* the design.

**The search field is always there.** A control that appears once you
cross some number of stories is a control you have to discover twice.

## The maps, and what they cost

A writer with nine stories does not recognise one by its name. They
recognise it by whether it fans out early, runs as a spine, or loops. So
each card carries its story's shape, drawn in the Story Graph's own
vocabulary — scene cards left to right, choices as curves, the start scene
in the accent.

Drawing that needs scene positions and edges **without opening the
project**. Parsing every `.scriare` on this screen is the obvious answer
and the wrong one: a 300-scene story is megabytes of Tiptap JSON, eight of
them are read before the first frame, and the screen whose job is to get
out of the way becomes the slowest in the app.

Instead the recent-projects entry gains a **cached shape**, written at a
moment the app is already writing to disk:

- up to 20 node positions, normalised into the unit square, three decimals
- edges as `[fromIndex, toIndex]` pairs
- the start node's index, and the story's real scene count

**579 bytes** for a 30-scene story, against a 1 KB budget the test
asserts. No titles, no prose, no ids — which matters because
`recent-projects.json` lives in userData, where a writer has no reason to
expect their words to be. A test greps the serialized shape for strings
taken from the fixture's own scenes.

**The sample is breadth-first from the start scene.** Not the first twenty
scenes in the array: creation order is not story order. On a forty-scene
story where the writer left nineteen scenes unwired, a slice gives twenty
boxes with nothing between them — a map that says the story has no shape,
which is worse than no map. The fixture that separates the two is in
`welcome.spec.mjs`, and the negative control for it is the slice.

**A story with no cached shape** — anything last saved before this version
— shows the graph's own dot field at the same 18px spacing. An empty
canvas, not a grey box: the first says "nothing here yet", the second says
"this story is broken". It fills in on the next save.

**Writing it costs one extra file write, throttled.** Autosave fires 1.5s
after a change, so refreshing on every save would mean a second write
every 1.5 seconds for a whole session, to update a picture on a screen
that is by definition not open. Six-second floor, deduped on content, and
forced once when the project closes — so what you see next launch is where
you actually stopped.

## Where you left off

The hero names the **scene**, not the file, with the opening line of its
prose, the group it sits in, and when. It is the first thing the keyboard
reaches: launch, Enter, back in the scene.

The excerpt is deliberately the scene's **opening** rather than the
sentence you stopped in the middle of. Two reasons, and the second is the
real one: the opening is what identifies a scene a week later, and it does
not change while you type, so the cached snapshot does not churn.

With exactly one story the hero is the whole shelf, and the "Your other
stories" heading does not render — a heading standing over an empty list
reads as a section that failed to load.

## Nothing is dimmed

When a search splits the shelf, the first draft faded the non-matching
list to 50% opacity. Wrong twice over: it taxed the contrast of a third of
the screen for every reader, and it said "less important" about stories
that are only "not what you typed".

They differ by **form** instead — a rule-separated row, no map, no card,
no shadow — at full text contrast. A map is for recognising the story you
are hunting, not for decorating the ones you are not. The same rule
settles a story whose file has moved: an icon and its own words ("Can't
find this file"), never colour alone.

The filtered count is announced (`aria-live`), because filtering a list by
typing changes the page under someone who cannot see it change.

## Two bugs found on the way

**Opening a story erased the map it had cached.** `addRecent` moves an
entry to the front, and did it by replacing the record with a freshly
built `{name, filePath, lastOpened}`. With nothing else on the record that
was the same object; with a cached shape on it, the app forgot the picture
of the story you just opened — the one moment it most obviously knows it.

**The logo swapped on `theme === "light"`.** Three of the eight themes
have light grounds, so daylight and overcast were handed the mark drawn
for dark rooms: pale on pale, on the app's first screen. Each theme now
records its ground, because `overcast` — a mid slate, lighter than every
dark theme and darker than every light one — is exactly the case a guess
gets wrong.

## Deliberately not shipped

**The demo story card.** The empty shelf's left card shows a story's shape
and is *not* a button. Scriare has no demo project yet — it is a launch
item, and its prose belongs to the writer, not to Claude. A card that
looks openable and opens nothing is worse on a stranger's first screen
than a card that is plainly an illustration. When the demo exists this
becomes its card with its real cached shape; the drawing and the layout
are already right, and only the click changes.

## Tests

`tests/welcome.spec.mjs` — 40 checks across the shape builder, the stored
record, an end-to-end save→cache round trip against a real file in the OS
temp directory, and all three rendered states. Every UI assertion reads
the rendered screen rather than the utility behind it, for the reason
v0.50.0 learned the hard way.

15 negative controls in `tests/negative-controls.mjs`, all caught. One of
them was NOT CAUGHT on the first run — not because the assertion failed to
fire, but because the control's `expect` string used a curly apostrophe
where the check's name has a straight one. Same stale-`expect` mistake
v0.49.0 made, found the same way.

---

# v0.53.1 — what the first build got wrong

Shipped, opened on a real machine, and three things were visibly wrong.
Recorded here because two of them were the same bug and it is one worth
knowing.

## A `<button>` centres its children

The UA stylesheet sets `align-items: center` on `button`. A flex button's
block child is therefore sized to its **content**, not stretched to the
button — so the map panel measured 0px wide, the `<svg>` fell back to its
own 372×104 viewBox, and every map was drawn at a fixed size inside a
card of a different size. On a wide window that is a stripe of drawing
with the rest of the card empty, which is what "the layout when the
window is resized looks terrible" meant.

The same line is why the resume hero's accent rail never appeared: a
4px-wide flex child, centred, with no intrinsic height, is nothing.

`items-stretch` on both. The lesson generalises: inside a `<button>`,
flex behaves differently than it does anywhere else in the app, and
nothing about the markup says so.

## Measured, not scaled

`StoryMap` now measures the element it is in (ResizeObserver) and lays
out at real pixel size, with node cards staying the size they should be.
Handing a fixed viewBox to the browser gives you two choices and both are
wrong: `meet` letterboxes the drawing, `none` smears every scene card.
The Story Graph itself re-lays-out rather than scaling when its panel
changes size; the thumbnail should behave like the thing it is a picture
of.

## The column

Everything — the frame's contents included — sits in a centred 1240px
column, and cards fill the row with `repeat(auto-fill, minmax(272px,
1fr))`. Before, the header was pinned to the window's edges while the
content was not, the hero ran the full 1900px from "Where you left off"
to "Continue", and a single card sat marooned at the left. Cards now
carry the graph's own `--lift-node` and lit top edge and respond to the
pointer.

`--welcome-column` is declared on `.scriare-welcome`, **not** `:root`.
`:root` in this app is the theme token contract — themes.css defines
every token there and a test holds all eight themes to the same list — so
a layout constant put there is reported as missing from seven themes.

## Maps that arrive too late

The first build wrote a story's shape on save and only on save. Every
card showed the dot field on the first launch after updating, and a map
appeared only once the writer had opened that story and saved it: the
picture that exists to help you *find* a story arriving after you had
already found it.

`useShapeBackfill` fills them in on the screen itself — one story at a
time, after the first paint, yielding between each, never twice for the
same path, skipping anything unreadable or over 12MB, and using
`project:readForShape`, which deliberately does **not** move the story to
the top of Recent Projects. Reading a file to draw its thumbnail is not
opening it.

## The excerpt welded its paragraphs

`sceneExcerpt` concatenated every text node it found, so a
three-paragraph scene read `...But I know... We're in scene 2We are sooo
in scene 3` — on the most prominent line of the screen. Block boundaries
are a space; only inline runs (a bold word mid-sentence) join with
nothing.

## And the suite caught itself

The new resize check took `BrowserWindow.getAllWindows()[0]`. That is the
app window when the spec runs alone, and the export spec's hidden window
when the whole suite runs — so it resized a window nobody was looking at,
then compared two measurements of an app window that had never moved, and
passed. It now takes the window from the page it is showing and throws if
the window did not actually resize.

It was green in `SPEC=welcome` and caught on the first full run. Which is
the argument for the full run.
