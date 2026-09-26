# Scriare — project brief

Paste this into any new chat to bring it up to speed on what Scriare is,
why it exists, and where it stands. Written to be short enough to read
whole.

## What it is

**Scriare is a desktop editor for branching narrative.** It's a writing app
that happens to know about branches — not a node canvas you also type into.

One line: *a branching-narrative editor for people who came to write.*

## Why it exists

Every tool in this space makes you choose between two bad halves:

- **Node canvases** (Twine, articy:draft, Arcweave) show the structure, but
  the prose lives in small boxes. You are laying out a diagram, and the
  writing suffers for it.
- **Scripting languages** (Ink, ChoiceScript) free the prose, but hide the
  structure inside syntax. You can't see the shape of your story, and a
  writer who doesn't code is locked out of half the tool.

Scriare's bet: **the page is the primary surface, and the structure is
derived from it.** You write a scene the way you'd write anything. When the
story branches, you type `/choice` and keep writing. The map draws itself
from what you wrote.

## Who it's for

Narrative designers and game writers — people who write branching dialogue
and interactive fiction for a living or want to. Specifically the ones who
are writers first and technical second.

## How it works — the five things that matter

1. **Choice Blocks live in the paragraph flow.** You type `/choice` where
   the branch happens. Each option's label is *ordinary text* — so
   everything the toolbar does to a sentence (bold, colour, a character
   mention) it does to a choice. No separate editor, no modal.
2. **The Story Graph is derived, never drawn.** It's built from the
   documents. Scenes, groups (which are the same objects as the folders in
   the sidebar — one hierarchy, not two), connections labelled by choice
   number, with the text on hover.
3. **Characters and Locations are references, not copies.** Type `@` to
   mention one. Nothing stores her name — only who she is — so renaming her
   rewrites nothing and changes everything. `@` at the head of a line says
   who is *speaking*.
4. **Logic with no syntax anywhere.** Variables, conditions on choices
   (hide it, or lock it with the reason shown), effects. Every one is a
   dropdown or a toggle. There is no expression field in the entire app.
5. **Play Mode and Check Story.** Play renders the scene exactly as
   written, with live variables and real endings. Check finds unreachable
   scenes, dead links, gates that can never open, and takes you to the one
   that broke.

## The rules the interface follows

These are the decisions worth quoting if anyone asks what makes it
different:

- **If it's something you'd *say*, you type it on the page. If it's
  something the choice *is*, you set it in the Inspector.** You never have
  to wonder which of two places a control lives in.
- **One hierarchy.** The folder in the sidebar and the box on the canvas
  are the same object.
- **Colour is reserved for the writer.** The interface is monochrome; hue
  belongs to the story (Choice Styles), not the chrome. Depth does the work
  instead — the page is a sheet on a desk, controls carry a lit edge.
- **Nothing asks you to stop writing and go configure something.**

## Where it stands

**v0.53.0 — in active development and genuinely usable.** The editor,
graph, runtime, entities, variables, validation, search, export and the
Welcome screen are all real and in daily use.

**514 automated tests** run against the real packaged application, and
every load-bearing one has been confirmed to fail on a deliberately broken
build — a test that has never been seen to fail proves nothing.

**Not built yet:** a packaged installer, and the demo story itself.

## Built with

Electron · React · TypeScript (strict) · Tiptap/ProseMirror · Zustand ·
React Flow · Playwright. Single developer, built with Claude as a pair.

## Lines you can use when teasing it

- "A branching-narrative editor for people who came to write."
- "Type `/choice` and keep going. The map draws itself."
- "Every branching tool makes you stop writing to do structure. This one
  doesn't."
- "No syntax anywhere. Where a choice goes, what it requires, what it
  changes — all dropdowns."
- "Rename a character once. Every sentence follows, because no sentence
  ever stored her name."

## Honest caveats to keep in mind while teasing

- No installer yet — it runs from source. That is the next build item.
- No demo story yet, so there is nothing to hand someone to play. It is the
  one launch item nobody else can do.
- It's a portfolio project by one person, not a company. That's a strength
  in how it's framed (a designer who builds his own tools), not something
  to hide.
