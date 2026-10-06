# Scriare — positioning against the alternatives

Written 1 Oct 2026, current at **v0.88.5**. Companion to
`project-brief.md`: the brief says what Scriare *is*, this says what it is
*instead of*. Paste this into a branding or marketing chat — it is the one
input that chat cannot reconstruct from the repo.

> **Note, kept because it is the reason this file exists:** when this was
> written the brief was three versions stale and still said "no export
> yet". It was rewritten the same day and both now carry their version at
> the top, so a stale copy can be spotted rather than believed. The brief
> used to live loose as `SCRIARE_BRIEF.md`; it is `project-brief.md` here.

---

## The field, in one pass

Five tools get named when anyone asks what this competes with. They fail
the writer in two different ways, and the two failures are the whole
argument.

**The node canvases** — Twine, articy:draft, Arcweave. The structure is
visible and the prose lives in small boxes. You are laying out a diagram
and typing into it.

**The scripting languages** — Ink, ChoiceScript. The prose is free and
the structure is hidden inside syntax. The shape of the story is not
visible anywhere, and a writer who doesn't code is locked out of half
the tool.

Scriare's bet is that neither trade is necessary: **the page is the
primary surface and the structure is derived from it.** The map is
drawn from the documents, never drawn by hand. That is one sentence and
it is the whole product.

---

## Against Twine

Twine is free, enormously popular, and the thing most people have
actually tried. Three differences, in descending order of how much they
matter.

### 1. The Dialogue block — the structural one

Twine's unit is the passage. A conversation of twelve lines is twelve
passages, or one passage full of macro calls, and either way **the shape
of the conversation is not on screen.** It isn't that Twine lacks a
feature; its data model has no place to put one.

Scriare's Dialogue block holds a whole exchange as one object *inside
the prose* — player lines with the reply underneath each, conditions,
effects, whether the conversation stays open or ends, all visible at
once and all editable in place. This is the one thing in the roadmap
described as something Twine structurally cannot do, and that is still
accurate.

### 2. No syntax, anywhere

Twine's conditional is `(if: $trust > 2)[`, in Harlowe or SugarCube,
chosen at project creation and lived with afterwards. From then on the
writer is debugging brackets.

Scriare has **no expression field in the entire application.** A
condition is a row in the Inspector; a variable is an entry in the
Variable Manager; an effect is a dropdown and a number. "Write stories,
not syntax" is aimed exactly here.

### 3. The text layer

- **Diacritic-folded search.** `ist` finds İstanbul, `aydin` finds
  Aydın. Twine's Find cannot, and for a Turkish writer that is not a
  nicety — it is the difference between search working and not.
- **Entities are references, not copies.** Nothing stores a character's
  name, only who she is. Rename her once and every sentence follows.
- **Exports a writer can use.** A self-contained single-file HTML build
  with a documented class contract and a writer-editable stylesheet;
  plus Script export for read-throughs and spreadsheet export for
  translation and VO. Twine exports a playable HTML you cannot
  reasonably restyle, and nothing for the people downstream of the
  writer.

---

## Against articy:draft

Different animal, and the honest answer is a smaller claim.

articy is a **pipeline tool.** Graph-first: you build the flow in nodes
and the text lives in side panels. It is built for a studio shipping
into Unity or Unreal — asset management, entity databases, localisation
pipelines, multi-user editing, a licence and a project server. It is
good at that, and **Scriare does not compete there and should not
pretend to.**

What Scriare has is the inverted priority:

- **The prose is the primary surface, the graph is a second view.** The
  Story Graph opens at a third of the column, not half, on purpose.
- **Nothing to set up.** One writer, one `.scriare` file, no account, no
  licence, no server, no project configuration before the first
  sentence.
- **The hierarchy is one hierarchy.** The folder in the sidebar and the
  box on the canvas are the same object — not two trees kept in sync by
  the writer.

The line that holds up: **articy is where a studio's narrative pipeline
lives; Scriare is where the writing happens.**

---

## Against Ink and ChoiceScript

Mentioned because narrative designers will raise them. Ink is excellent
and genuinely loved, and a writer who is comfortable in it is not
Scriare's customer. The argument is only that **Ink's structure is
invisible** — there is no view in which you see the shape of what you
wrote — and that it asks the writer to be a programmer in a small
language. Scriare's answer is the derived graph plus the no-syntax rule.
Say this without condescension; Ink's users chose it for good reasons.

---

## What we do not claim

Keeping this list honest is what makes the rest credible.

- **No engine integration.** No Unity or Unreal plugin, no runtime
  library. Export is HTML, script and spreadsheet.
- **No collaboration.** One writer, one file. No multi-user editing, no
  comments, no review flow.
- **No asset management.** Images in scenes are postponed past launch
  deliberately — the decision is to add it on evidence from real use,
  not because a list says so.
- **Not a company.** A portfolio project by one designer. Frame that as
  a strength — a narrative designer who builds his own tools — not
  something to bury.

---

## Lines that are true and usable

- "A branching-narrative editor for people who came to write."
- "Write stories, not syntax."
- "Type `/choice` and keep going. The map draws itself."
- "A whole conversation, on the page, as one thing."
- "No expression field in the entire app."
- "articy is where a studio's pipeline lives. This is where the writing
  happens."
- "Rename a character once. Every sentence follows, because no sentence
  ever stored her name."

---

## The caveat that affects the video

The demo story's committed fixture — `tests/fixtures/the-blue-hour.scriare`,
the one the screenshot tool and the test suite load — has **28 scenes
with a Choice, 15 Conditionals, and zero Dialogue blocks.** The
strongest differentiator in this whole document is the one the current
screenshots cannot show.

The working copy is further along: `other_materials/test-stories/The
Blue Hour — With Conversations.scriare` has **three real conversations**
— s11 *Deniz In The Yard* (4 lines), s15 *The Big Table* (6), s20
*Hikmet's Office* (5) — with conditions, variable effects on
`v-warned` / `v-resolve` / `v-voices`, one repeatable line, and
`stay` / `end` continuations. That is enough to shoot the Dialogue
block honestly.

**The gap is that this version is not the fixture.** Until the file
with conversations becomes the one the tooling loads, every screenshot
and every test runs against a story with no dialogue in it. Three
conversations in 32 scenes is also still thin for the thing we call the
headline feature.

---

## Standing positions worth not re-litigating

- **Features after launch are decided on evidence, not on a list.** One
  exception: a defect found by measurement gets fixed whatever the list
  says.
- **Colour belongs to the story, not the chrome.** The interface is
  monochrome; hue is the writer's (Choice Styles).
- **No UI translation.** Scriare competes on the writer's-text layer —
  the search folding, the entity references, the exports — not on being
  localised itself.
- **The siblings rule.** Anything drawn for the Dialogue block is drawn
  for the Choice block, and vice versa, unless the difference is
  behavioural.
