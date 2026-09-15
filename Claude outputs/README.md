<div align="center">

# Scriare

**A branching-narrative editor for people who came to write.**

Interactive fiction tools make you choose: a node canvas that shows the
structure but cramps the prose, or a scripting language that frees the
prose and hides the structure in syntax. Scriare is a writing app that
happens to know about branches.

[Changelog](CHANGELOG.md) · [Case study](CASE_STUDY.md)

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
  chapter in a single undoable step.
- **One hierarchy.** The folder in the sidebar and the box on the canvas
  are the same object: rearrange the picture and the tree follows.
- **Characters and Locations** with pages, aliases and backlinks. `@` them
  in prose; rename one and every sentence follows, because no sentence ever
  stored the name.

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

**Everywhere**

- Project-wide **undo** for every structural action, which never rolls back
  prose you typed after the thing being undone.
- Copy, cut, paste and delete on scenes and folders, routed by focus.
- Dark and light themes, monochrome by design — colour is reserved for
  things that mean something.
- Matching handles Turkish properly throughout: `ist` finds İstanbul,
  `aydin` finds Aydın.

## Status

**v0.38.0 — in active development, and usable.** The editor, graph,
runtime, entities, variables, validation and search are all real. Not yet
built: **Export** (the button is visible and disabled on purpose) and a
packaged installer. See [CASE_STUDY.md](CASE_STUDY.md#whats-unresolved) for
the honest list.

227 automated tests run against the real packaged application. Every
load-bearing one has been confirmed to fail on a deliberately broken build
— a test that has never been seen to fail proves nothing.

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
a fix, rather than waiting for all 227 — set `SPEC` to the start of its
filename:

```bash
SPEC=find npm test            # macOS / Linux
$env:SPEC="find"; npm test    # Windows PowerShell
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
  extensions/   Tiptap nodes and marks — ChoiceBlock, Mention, Speaker…
  runtime/      Play Mode, deliberately importing nothing from the editor
  state/        Zustand stores (project, inspector, editor ref, UI, toasts)
  types/        the data model: project, entities, variables, speakers
  utils/        pure logic — choice blocks, story checking, find, folding
tests/          *.spec.mjs, run against the real packaged Electron app
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

The [changelog](CHANGELOG.md) lists every release. The
[case study](CASE_STUDY.md) is the part worth reading: twelve findings from
the build, mostly about the moments when a user-interface complaint turned
out to be a data-model problem wearing a costume.
