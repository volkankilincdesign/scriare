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
  18px grid — hold Alt for the one card that has to sit between the lines. A connection carries its choice's number; point at one — or select
  the scene — to read the choice itself. The splitter hands the graph as
  much of the window as you want, up to all of it.
- **One hierarchy.** The folder in the sidebar and the box on the canvas
  are the same object: rearrange the picture and the tree follows.
- **Characters and Locations** with pages, aliases and backlinks. `@` them
  in prose; rename one and every sentence follows, because no sentence ever
  stored the name.
- **Notes** — your own pages, in the same editor. A note can mention the
  story; the story can never mention a note, and none of it reaches the
  reader or the word count.

**Logic, with no syntax**

- **Variables** (number, boolean, text), set or toggled by choices.
- **Conditions** on any choice — hide it, or lock it with the reason shown.
- Everything is a dropdown or a toggle. There is no expression field
  anywhere in the app.

**Checking and finding**

- **Check Story** — unreachable scenes, choices that go nowhere, links to
  deleted scenes, gates that can never open, endings, route lengths, word
  count. Every line opens the scene with the Inspector pointed at what
  needs fixing.
- **Find** (Ctrl+F) across prose, choice labels and entity pages. Clicking
  a result opens the scene with the matched words selected.

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

**v0.60.0 — in active development, and usable.** The editor, graph,
runtime, entities, notes, variables, validation, search and **export** are
all real. Not yet built: a packaged installer, so today you run it from
source. See [CASE_STUDY.md](CASE_STUDY.md#whats-unresolved) for the honest
list of what is still missing.

**626 automated tests** run against the real packaged application, and
**131 negative controls**: each one breaks a specific line of the shipped
source on purpose and checks that a named assertion fails. A test that has
never been seen to fail proves nothing — and twice in the last week a
control failed to catch its sabotage, which was a finding about the test
rather than the app, and the test is what got rewritten.

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

## The writing

The [changelog](CHANGELOG.md) lists every release, and each entry is
written as the reasoning rather than as a line item — what was measured,
what it turned out to be, and what was deliberately not done. The
[case study](CASE_STUDY.md) is the part worth reading: findings from the
build, mostly about the moments when a user-interface complaint turned out
to be a data-model problem wearing a costume.
