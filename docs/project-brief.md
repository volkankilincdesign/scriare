# Scriare — project brief

Paste this into any new chat to bring it up to speed on what Scriare is,
why it exists, and where it stands. Written to be short enough to read
whole. For how it compares to Twine, articy:draft and Ink, read
`positioning.md` alongside it.

**Current as of v0.88.5.** Two earlier copies of this brief had drifted —
one stuck at v0.40.x, one at v0.60.0 — and both were wrong about export,
which has shipped. If you find a copy saying either, it is stale.

## What it is

**Scriare is a desktop editor for branching narrative.** It's a writing app
that happens to know about branches — not a node canvas you also type into.

One line: *write stories, not syntax* — a branching-narrative editor for
people who came to write.

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

## How it works — the six things that matter

1. **Choice Blocks live in the paragraph flow.** You type `/choice` where
   the branch happens. Each option's label is *ordinary text* — so
   everything the toolbar does to a sentence (bold, colour, a character
   mention) it does to a choice. No separate editor, no modal.
2. **Dialogue Blocks hold a whole conversation as one object.** Player
   lines with the reply under each, who answers, whether the conversation
   stays open or ends, conditions and effects per line — all on the page,
   all editable in place. This is the thing Twine's data model has no
   room for, and it is the headline feature.
3. **The Story Graph is derived, never drawn.** It's built from the
   documents. Scenes, groups (which are the same objects as the folders in
   the sidebar — one hierarchy, not two), connections labelled by choice
   number, with the text on hover. Auto Layout tidies it; folding a chapter
   shows the story's shape.
4. **Characters and Locations are references, not copies.** Type `@` to
   mention one. Nothing stores her name — only who she is — so renaming her
   rewrites nothing and changes everything. `@` at the head of a line says
   who is *speaking*.
5. **Logic with no syntax anywhere.** Variables, conditions on choices and
   dialogue lines (hide it, or lock it with the reason shown), effects.
   Every one is a dropdown or a toggle. There is no expression field in the
   entire app.
6. **Play Mode, Check Story, and three exports.** Play renders the scene
   exactly as written, with live variables and real endings, on the same
   reading grounds the export ships — so a rehearsal is a rehearsal of the
   finished file. Check finds unreachable scenes, dead links and gates that
   can never open, and takes you to the one that broke. Export produces a
   self-contained single-file HTML build with a documented class contract
   and a writer-editable stylesheet, a Script export for read-throughs, and
   a spreadsheet export for translation and VO.

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
- **The siblings rule.** Anything drawn for the Dialogue block is drawn for
  the Choice block, and the reverse, unless the difference is behavioural.
- **A theme is the writer's room; a ground is the reader's page.** Eight
  themes for the editor, two grounds (Paper and Night) for the story.
- **Nothing asks you to stop writing and go configure something.**

## Where it stands

**v0.88.5 — in active development and genuinely usable.** The editor, the
Dialogue and Choice blocks, graph with auto layout and folding, runtime,
entities, notes, variables, validation, search, all three exports, the
stylesheet, preferences and the Welcome screen are real and in daily use on
a 32-scene demo story.

**1130 automated tests** run against the real packaged application, and
**348 negative controls** — each breaks a specific line of the shipped
source on purpose and checks that a *named* assertion fails. A test that
has never been seen to fail proves nothing, and a control that passes is a
finding about the test, not a clean bill of health.

**Not built yet:** a packaged installer (the app runs from source or an
unpacked build), and images in scenes — postponed past launch on purpose,
to be decided on evidence from real use rather than because a list says so.

**The known gap before the launch video:** the committed fixture the test
suite and screenshot tool load has no Dialogue blocks in it. Three real
conversations exist in the working copy of the demo story and are not yet
the fixture, so every screenshot currently shows a story without the
headline feature in it.

## Built with

Electron · React · TypeScript (strict) · Tiptap/ProseMirror · Zustand ·
React Flow · Playwright. Single developer, built with Claude as a pair.

## Lines you can use when teasing it

- "Write stories, not syntax."
- "A branching-narrative editor for people who came to write."
- "Type `/choice` and keep going. The map draws itself."
- "A whole conversation, on the page, as one thing."
- "No expression field in the entire app."
- "Rename a character once. Every sentence follows, because no sentence
  ever stored her name."

## Honest caveats to keep in mind while teasing

- No installer yet — it runs from source or an unpacked build. Export
  shipped, so the front door is a playable HTML file that needs nothing
  installed, but the app itself still does.
- The demo story exists and is written; what is missing is the video, the
  case-study page and the dialogue-bearing fixture. Those are the launch
  items nobody else can do.
- It's a portfolio project by one person, not a company. That's a strength
  in how it's framed (a designer who builds his own tools), not something
  to hide.
