<div align="center">

# Scriare

**Write stories, not syntax.**

Interactive fiction tools make you choose: a node canvas that shows the
structure but cramps the prose, or a scripting language that frees the
prose and hides the structure in syntax. Scriare is a writing app that
happens to know about branches — a branching-narrative editor for people
who came to write.

[Changelog](CHANGELOG.md) · [Case study](CASE_STUDY.md) · [Design documents](docs/)

</div>

---

<!-- Replace with a real screenshot: the editor with a Choice Block and the
     Story Graph visible. 1600px wide or better, dark theme. -->
<!-- ![Scriare](docs/images/editor.png) -->

## What it is

You write a scene the way you'd write anything — a page, a cursor, a
toolbar. When the story branches, you type `/choice` and keep going. The
choice sits in the paragraph flow where you put it, its options are real
sentences you can bold and colour like any other, and the Story Graph
draws itself from what you wrote.

Nothing asks you to stop writing and go configure something. The three
things a branching story needs that prose doesn't — where a choice leads,
what it requires, what it changes — live in a panel beside the page, so the
page stays a page.

**The rule the whole interface follows:** if it's something you'd *say*,
you type it on the page. If it's something the choice *is*, you set it in
the Inspector. You never have to wonder which of two places a control
lives in.

## What it does

**Writing**

- A full rich-text editor — headings, lists, quotes, callouts, alignment,
  fonts, sizes, colour, highlight — with a toolbar drawn in the app's own
  icon set.
- **Choice Blocks** typed straight through with `/choice`. Each option's
  label is ordinary text, so everything the toolbar does to a sentence it
  does to a choice.
- **The Dialogue** (`/dialogue`, or the button beside Choice) is a
  conversation that happens on the page
  rather than turning it. A line said is spent unless it's marked as one
  that can be asked again, each line ends by staying, closing the
  conversation, or leaving for another scene — and whatever is written below
  the block waits until the talking stops. Asking someone three questions no
  longer costs three scenes.
- **Conditional Text** (`/conditional`) gates a passage on a variable,
  without branching into a separate scene for every combination.
- **Speaker attribution** — type `@` at the head of a line to say who's
  speaking. Enter carries the speaker into the next line; the name is shown
  in front of the line but isn't text you can break.

**Structure**

- A **Story Graph** built from the writing, with pan, box-select, nesting
  groups that fold, and Auto Layout that arranges the inside of every
  chapter in a single undoable step, on a dotted canvas that shows its own
  scale. Everything on it moves, lands and resizes on that dot field's own
  18px grid — hold Alt for the one card that has to sit between the lines.
  A **chapter runs down the page** and the chapters stand side by side like
  columns, so a story is a shape you can see at once rather than a ribbon
  twenty-three times longer than it is deep.
- **Wires that know what is in the way.** Each choice leaves from its own
  point on the card, in the order you wrote it, on the side it is actually
  heading for. Nothing is routed through a scene it has nothing to do with;
  crossing another wire at a right angle is cheap and reads as a plus,
  while running alongside one costs enough that a wire takes the next track
  over instead — and a wire stays a line while you drag the card it is
  attached to. A connection carries its choice's number. Select a scene and
  everything more than one step away fades out of the way — not to nothing,
  so the lit path still reads as a path through something. The splitter
  hands the graph as much of the window as you want, up to all of it.
- **One hierarchy.** The folder in the sidebar and the box on the canvas
  are the same object: rearrange the picture and the tree follows.
- **Characters and Locations** with pages, aliases and backlinks. `@` them
  in prose; rename one and every sentence follows, because no sentence ever
  stored the name.
- **Notes** — your own pages, in the same editor. A note can mention the
  story; the story can never mention a note, and none of it reaches the
  reader or the word count.

**What the story says it is**

- **Title, author and the language it is written in**, in Project Settings.
  The exported page carries the language on `<html lang>` so a screen
  reader reads Turkish as Turkish — and a story that has not said carries
  none, because a wrong tag is worse than no tag. The author reaches the
  page as metadata rather than as a byline over your first paragraph.
- **A named protagonist.** The player is printed as "You" until you say
  otherwise; call them Detective and every line they speak says so, in the
  editor, in Play Mode, on the exported page, in the script and in the
  translator's spreadsheet.
- **Preferences is a separate dialog**, because the theme is not part of
  your story: it lives on this computer and never travels with the file.

**Logic, with no syntax**

- **Variables** (number, boolean, text), set or toggled by choices.
- **Conditions** on any choice — hide it, or lock it with the reason shown.
  A variable can be given the name a **reader** sees, so a locked choice
  says "Requires The Roster" rather than `knows_roster is true`, and a
  choice can carry its own sentence instead. Check Story reports any
  variable a reader can see that nobody has named.
- Everything is a dropdown or a toggle. There is no expression field
  anywhere in the app.

**Checking and finding**

- **Check Story** — unreachable scenes, choices that go nowhere, links to
  deleted scenes, gates that can never open, endings, route lengths, word
  count. Every line opens the scene with the Inspector pointed at what
  needs fixing.
- **Find** (Ctrl+F) across prose, choice labels and entity pages. Clicking
  a result opens the scene with the matched words selected.
- **Replace**, in the same panel. Every hit shows what it would become
  before anything is pressed, with a tick per hit, and the whole thing is
  one undo step however many scenes it touched. Mentions are left alone
  and the panel says so: a mention stores a character's id and renders
  whatever she is currently called, so it changes when you rename her,
  not when you replace text.

**Playing**

- **Play Mode** renders the scene exactly as written, in document order,
  with a live read-only variable readout and a proper ending screen. Escape
  returns you to the same scene, scroll position and graph view.
- It plays on a **reading ground — Night or Paper — not on your theme**,
  with the same switch your reader gets, so a rehearsal is a rehearsal of
  the finished file rather than a preview of the draft.

**Sharing it**

- **Export** writes the whole story as one self-contained HTML page. No
  network requests of any kind: it works offline, from a folder or a USB
  stick, and nobody learns who read it. Formatting, choices, variables and
  conditions arrive intact, the reader keeps their place, and they can
  switch between the two reading grounds.
- Those grounds — **Night and Paper** — are built for reading rather than
  for sitting beside panels, which is why the app's eight themes are
  deliberately not among them: a theme is the room you write in, a ground
  is the page a stranger reads.
- Colours you pick yourself say how they read on both grounds **at the
  moment you pick them**, measured, rather than at the export dialog weeks
  later.
- **Three kinds of block** make a story branch, and each says what it is
  wherever you meet it — in the toolbar, on the “/” menu, and in its own
  header. **How Scriare works**, in the top bar, explains all three with
  the questions a newcomer actually has underneath. It is a place rather
  than a tour: nothing fires it at you, and it is still there in week
  three.
- **Your own stylesheet**, kept in the story file, applied in Play Mode so
  you can see it, and shipped with the page. Your rules win over the app's
  without `!important` — plain `.scriare-choice { background: … }` is
  obeyed even where the app's own selector is the more specific one. If
  your CSS fetches anything, the export names it and holds the button
  until you say you meant it: one file with no requests is a promise, and
  breaking it is your decision rather than a surprise.
- **A script**, as a PDF or a Word file, in two layouts — one to hand a
  reader, one to hand a studio.
- **A spreadsheet of every string a reader sees** — scene titles, prose,
  choices, dialogue and replies, one row each, in reading order from your
  first scene. A workbook for the translator, with the header frozen, the
  filters on and everything locked except the column they fill; and a CSV
  for the engine beside it, comma-delimited UTF-8 with the line's own name as
  the RowName — `t_indigo-does-not-look`, readable in a sheet and in an
  engine's row list — because "Save As CSV" on a Turkish Windows writes semicolons
  and CP1254 and quietly mangles both.

**The shelf**

- The Welcome screen draws every recent story's **map** — the exact
  arrangement you made, every scene and every connection up to fifty, with
  the wires routed by the same router the canvas uses. You recognise a
  story by whether it fans out early, runs as a spine or loops, long before
  you recognise its file name. Routed once when the story is saved, so the
  screen whose job is to get out of the way stays as fast as it was.

**Everywhere**

- Project-wide **undo** for every structural action, which never rolls back
  prose you typed after the thing being undone.
- **Saving that cannot eat your project.** The file is replaced by an atomic
  rename rather than written into, the version before last is kept beside it,
  and a project that changed underneath you — the other machine, through a
  synced folder — is never overwritten without asking.
- Copy, cut, paste and delete on scenes and folders, routed by focus.
- **Eight themes** — two monochromes and six that tint the room rather than
  the content: Daylight, Overcast, Lamplight, Deep Water, Nocturne and
  Phosphor. Colour is still reserved for things that mean something, so a
  theme colours the ground and leaves the writing alone. Depth does the
  rest: the page is a sheet on a desk, controls carry a lit edge, and a
  selected scene rises rather than only brightening.
- A status bar across the foot of the window: story size, the open scene and
  its word count, and whether the Story Graph is showing.
- Matching handles Turkish properly throughout: `ist` finds İstanbul,
  `aydin` finds Aydın.

## Status

**v0.88.5 — in active development, and usable.** The editor, graph,
runtime, the Choice and Dialogue blocks, auto layout and folding, entities,
notes, variables, validation, search, the stylesheet and all three
**exports** are real, and the app builds a Windows installer. See
[CASE_STUDY.md](CASE_STUDY.md#whats-unresolved) for the honest list of what
is still missing.

The installer is **unsigned**, so Windows SmartScreen will warn you the
first time — "Windows protected your PC", with the real path being *More
info → Run anyway*. Signing costs money a portfolio project does not have,
and saying so is better than pretending the warning is a fault in your
machine. It installs for the current user only, needs no administrator
rights, and registers `.scriare` so double-clicking a story opens it. A
**portable .exe** is built alongside for anyone who would rather not
install anything at all.

**Reporting something?** The version is beside the wordmark on the Welcome
screen. Clicking it copies the version, your platform and the engine
underneath — paste that into the report and neither of us has to guess
which build you were on.

**1130 automated tests** run against the real packaged application, and
**348 negative controls**: each one breaks a specific line of the shipped
source on purpose and checks that a named assertion fails. Two that had
been reporting green were fixed in v0.78.2. One was a **false alarm since
v0.60.0** — the sabotage worked and the check caught it every time, but the
check had been reworded and the control was still looking for the old
sentence. The other was **real, and had been open since v0.49.1**: a save
that resolves before its queued re-run could not be caught by reading the
file afterwards, because the queued save lands a moment later and the read
is itself an await. It is asserted on the store's own status now, at the
instant the promise resolves.

**Every one of them has been watched to fail**, and that sentence is
current rather than historical: a full sweep finished at v0.81.3 with all
309 caught, no stale controls and nothing found. It is the first complete
pass since v0.78.2, and it took about two and a half hours in groups
because each control is a full production rebuild plus a spec run. The
thirty-three added since were watched individually as they were written, which
is the standing rule — a control nobody has seen fail is not evidence of
anything.

Finding nothing is the result. Every previous look found something — two
controls reporting green in v0.78.2, four gone stale in v0.80.0, one of
which turned out to be watching a check that read the colour an element is
*told* to use rather than the one it paints.

A control that stays green is a finding about the test rather than about
the app, and it has happened often enough to be the most useful thing the
suite does. The sharpest: a spec that asked the code under test which
attributes to check, so deleting one made the code stop maintaining it and
the test stop looking for it, both at once, in silence. One stayed green
because the *comment* it was defending made a claim that was not true, and
the comment is what got rewritten. Four in one week stayed green because
the fixture avoided the ambiguous case — a speaker check that wrote an
attribute no node type in the app uses, so the walk and the fixture agreed
with each other and with nothing else.

Counts are honest rather than flattering. v0.75.1's README said 922 tests
because a temporary spec had been left in `tests/` and its checks were
being counted. And v0.78.2 removed three more: `perf.spec` wrote two
timing thresholds as `check(name, !quiet || cost < threshold)`, which is a
pass rather than a skip on a loaded machine — this container's floor
measures around 480 ms against a threshold of 45, so they had never once
asserted anything here. They are logged, not counted, when the clock
cannot resolve them.

## Running it

You need [Node.js](https://nodejs.org) (LTS).

```bash
npm install
npm run dev
```

Other commands:

| Command | What it does |
| --- | --- |
| `npm run build` | Compiles a production build into `out/` |
| `npm run preview` | Runs that production build |
| `npm test` | Builds in test mode and runs the full suite |
| `npm run dist` | Builds, then packages the Windows installer and the portable .exe into `release/` |
| `npx tsc --noEmit -p tsconfig.web.json` | Type-check without writing files |

To run a single spec file — which is what you want while negative-controlling
a fix, rather than waiting for the whole suite — set `SPEC` to the start of
its filename:

```bash
SPEC=find npm test            # macOS / Linux
$env:SPEC="find"; npm test    # Windows PowerShell
```

The controls themselves are a script rather than part of the suite, run
while a feature is being built:

```bash
node tests/negative-controls.mjs          # all of them — about a quarter of an hour
ONLY=notes node tests/negative-controls.mjs   # just one spec's
```

> **Don't run `tsc -b` on this project.** Its build mode writes compiled
> `.js`/`.jsx`/`.d.ts` files next to the TypeScript source, where they can
> silently shadow the real files.

## Built with

Electron + electron-vite · React 18 · TypeScript (strict) · Tailwind ·
Tiptap / ProseMirror · Zustand · React Flow + dagre · Playwright

## How the project is laid out

```
src/renderer/src/
  components/
    editor/     the writing surface, toolbar, and the views for each block
    layout/     top bar, Content Browser, Inspector, Find results
    graph/      the Story Graph, its nodes, groups and minimap
    story/      Check Story
    welcome/    the Welcome screen, and the map each story draws of itself
    common/     the shared kit — Button, Field, Modal, DialogHeader, Icon
  export/       the exported page: its stylesheet, runtime and contrast check
  extensions/   Tiptap nodes and marks — ChoiceBlock, Mention, Speaker…
  runtime/      Play Mode, deliberately importing nothing from the editor
  state/        Zustand stores (project, inspector, editor ref, UI, toasts)
  types/        the data model: project, entities, variables, speakers
  utils/        pure logic — choice blocks, story checking, find, folding
tests/          *.spec.mjs, run against the real packaged Electron app
docs/           the design documents — the reasoning behind the decisions
```

Three boundaries are load-bearing and worth knowing before changing
anything:

- **`runtime/` never imports the editor.** Play Mode consumes the same
  document *model* and renders it through a registry that maps a block's
  node type to its own renderer — so a new block type is one registry entry
  rather than a change to the player.
- **`utils/` and `types/` are pure.** No React, no stores. Everything the
  graph, the validator and the search agree about lives there, which is why
  they can't disagree.
- **Every edit to a document goes through a ProseMirror transaction**, even
  the ones the Inspector makes. The mounted document and the saved project
  can never drift apart.

## Licence

Scriare is **MIT licensed** — see [LICENSE](LICENSE). In plain words: use it,
change it, build on it, ship it, commercially or not. The one condition is
that the copyright notice travels with any copy, so whoever ends up with the
code can see where it came from.

The licence covers the **code**. The name *Scriare*, the wordmark and the logo
are not part of it — fork the software freely, but please give your version
its own name, so a reader can tell which one they are looking at.

Scriare bundles Electron, Chromium, Node and a number of open-source
libraries, each under its own licence; those are listed in
[THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt) and travel with the
application.

Built by Volkan Kılınç — [volkankilinc.com](https://volkankilinc.com).

## The writing

The [changelog](CHANGELOG.md) lists every release, and each entry is
written as the reasoning rather than as a line item — what was measured,
what it turned out to be, and what was deliberately not done. The
[case study](CASE_STUDY.md) is the part worth reading: findings from the
build, mostly about the moments when a user-interface complaint turned out
to be a data-model problem wearing a costume.
