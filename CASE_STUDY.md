# Scriare — a case study

**A branching-narrative editor built on one bet: that the hard part of
writing interactive fiction is the writing, and every existing tool treats
it as the configuration.**

---

## The problem

Tools for branching narrative fall into two camps.

The **node editors** — Twine, articy:draft, Arcweave — are excellent at
showing you the shape of a story. You see the branches. What you don't
do is write in them: prose lives inside boxes on a canvas, each one a
small text field, and a scene of any length becomes a node you have to
open to read. The structure is beautiful and the writing is cramped.

The **scripting languages** — Ink, Yarn — are the opposite. The writing is
unconstrained, and the structure is syntax you have to hold in your head.
`-> knot.stitch` is a branch, but only to someone who already knows it is.

Both ask a writer to stop writing in order to do structure. Scriare's bet
is that they don't have to be separate activities, and that a writing tool
which happens to know about branches will beat a branching tool that
happens to allow text.

The test I held it to, from the start: **someone who has never heard of me
should be able to open it and have a good time.** That makes every dead
end a defect rather than a gap.

---

## Method

Three habits shaped more of the outcome than any individual decision.

**Bugs were reproduced by measurement before being fixed.** When the
toolbar was reported to "jump", the first commit measured it: 81px with
the caret in prose, 87px in a choice. That number made the cause findable
in minutes and gave the fix a test that fails if it ever returns. Every
bug reported during the build turned out to be real and subtler than it
first looked — and twice, the reported symptom had a different cause than
the obvious one.

**Every load-bearing test was negative-controlled.** The code was broken on
purpose and the test had to go red. This caught more than bugs. Once, a
control refused to fail: the Enter keybinding that carried a speaker
forward between lines had never done anything, because the framework was
already doing it. A keybinding, a priority override and a menu guard were
deleted and replaced by one declared line. The control removed code instead
of adding a test.

Twice more, controls came back green because the *test* was wrong, not the
code — a keyboard shortcut tested by calling the function behind it rather
than pressing the key, and a text-index map with no case that exercised it.
A test that has never been seen to fail proves nothing.

**Contested visual decisions were mocked up, not argued.** When the toolbar
"felt dull" and when a problem list "felt overwhelming", the answer was
two or three interactive directions built against real data, and a choice
made by looking. Prose about layout is a bad medium for deciding layout.

---

## Findings

### 1. Two hierarchies over the same objects will always drift

Scriare grouped scenes twice. Folders organised them in the Content
Browser; frames grouped them on the canvas. Neither knew the other
existed, and that was defensible — they answered different questions.

It doesn't hold. A scene could be in the Prologue folder and inside the
Ashfall frame simultaneously, and nothing was *wrong*, but every drag in
the graph made the two panels disagree a little more. Only the writer knew
which answer counted, and they were being asked to maintain both.

**The decision:** frames were deleted. A folder owns its box on the graph.
Renaming it on the canvas renames the folder; dragging a scene into a box
genuinely moves it into that folder, and the tree reorganises as you
rearrange the picture.

**Why it matters beyond this app:** the instinct to model two views of the
same thing as two objects is strong, because they *look* different. The
question that settles it isn't "are these different?" — it's "can these
ever disagree, and if they do, which one is right?" If you can't answer
the second part, you have one object.

### 2. There is a difference between text in the document and data about the document, and users can feel it without naming it

For most of the build, a choice's label was a string stored in a hidden
property of a sealed block. You typed it into a field in a side panel, and
what appeared on the page was a *preview* of that string.

The complaint, when it came, was that the toolbar didn't work on choices.
That reads like a UI oversight. It wasn't: formatting in a rich text
editor applies to text in the document, and a choice's label was not text
in the document. No amount of rearranging the interface could have fixed
it. The floor had to move.

**The decision:** each option became a real node in the scene with ordinary
inline content. The toolbar reached it with **no new code** — the toolbar
already knew how to style text, and a choice label was finally text. Undo,
search, and the playback renderer all came along for the same reason.

**The finding:** when a user says "X doesn't work on Y", check whether Y is
the kind of thing X operates on. Sometimes the answer is that your data
model is lying about what Y is, and the UI complaint is the only visible
symptom of it.

### 3. The split that organises the whole app: formatting belongs to text, properties belong to the thing

Once a choice's label was text, everything else about a choice — where it
leads, what it requires, what it changes, how its box looks — stayed in
the Inspector.

That line is drawn everywhere in Scriare now, and it makes the interface
predictable without documentation. If it's something you'd *say*, you type
it on the page. If it's something the choice *is*, you set it in the panel.
A writer never has to wonder which of two places a control lives in,
because the question answers itself.

It also settled arguments prospectively. When speaker attribution arrived,
"should there be a toolbar button for it?" answered itself: a toolbar
button would imply that dialogue is formatting, like bold. It isn't. It's
a fact about the line.

### 4. References beat copies, and it costs nothing to decide that early

A mention of a character stores her **id**, never her name. A line that
knows who's speaking stores an id too. The name on screen is looked up
every time it's drawn.

The payoff is that renaming a character updates every sentence she appears
in, every choice she's named in, every line she speaks, and everything the
player reads — with nothing rewritten and no migration, because nothing
ever stored the old name.

The subtlety is what *doesn't* follow that rule. A mention also stores the
text it was written with, because a writer who typed "the doctor" meant
"the doctor", not "Mara". A story where every alias silently collapses into
one canonical name is a worse story. So: the id is authoritative for
identity, the written text is authoritative for voice, and the stored text
is only overridden when it stops being one of her names at all.

**The finding:** "store the reference, not the value" is the easy half. The
hard half is noticing which of the things you'd normalise is actually the
writer's prose, and leaving that alone.

### 5. When six fixes each work and the feel is still wrong, the loop is the bug

Drag-reordering the choices list took six patch releases. Each one
identified a real defect and each one fixed it: an unreachable last slot,
dead zones, overshoot, oscillation, a jolt on release. The feel never
became right.

The cause was structural. The list physically reordered while you dragged,
which meant the geometry a swap decision read was being changed by that
same decision. Smooth motion and correct reordering had been made mutually
exclusive by the architecture, and every fix was tuning a threshold inside
a feedback loop.

**The decision:** freeze the layout for the whole gesture and move choices
by transform only. The loop becomes structurally impossible rather than
tuned around — and once geometry can't move mid-drag, the threshold rule
could be deleted entirely and replaced with "which landing position is
nearest". A pile of guessed pixel constants disappeared.

**The finding:** a run of individually-correct fixes that don't add up to a
working feature is diagnostic. It means the thing being fixed isn't the
thing that's wrong.

### 6. A modal earns its interruption only while the mistake is permanent

Scriare had five delete confirmations. They were all removed in the same
version that made deletes reversible, and replaced with a small toast —
*Deleted "The Ration Tin" · Undo* — for nine seconds.

The reasoning is a single sentence: a dialog that stops you to prevent a
mistake is worth its cost only while the mistake can't be taken back. Once
undo exists, the confirmation is a tax charged on every correct delete to
insure against the rare wrong one, and the insurance is now free.

What made the feature work rather than merely exist was refusing to let the
toast lie. Delete a scene, drag two nodes, then click Undo on the toast: a
naive implementation undoes the drag. So each toast records the identity of
the history step it was raised for and drops its button the moment that
step stops being the one undo would reverse — keeping its message, so it
never becomes a button that does something other than what it says.

The confirm-dialog machinery was kept, unused and documented as such. The
next thing that needs confirming — overwriting a file, discarding unsaved
work — probably won't be undoable, and that's exactly what it's for.

### 7. Undo has to know what it isn't allowed to undo

Project-wide undo is snapshot-based. Restoring a whole-project snapshot
would also revert every word typed since it was taken: delete a scene,
write two paragraphs somewhere else, press Ctrl+Z, lose the paragraphs.

That's not an edge case, it's the normal rhythm of writing. So scene
content is treated as belonging to the live project rather than to the
snapshot — for any scene present in both, today's prose wins. A scene that
exists only in the snapshot (because the undone action deleted it) keeps
its own text, which by then is the only copy of it anywhere.

The result is two undo stacks that can't clobber each other: one moves
structure, the framework's own moves words, and Ctrl+Z routes between them
by focus. A writer never learns this rule. They just never lose a
paragraph.

### 8. "It feels dull" is a symptom, and the causes may not be taste

The palette is black and white on purpose: colour belongs to content the
writer assigns meaning to, and chrome that competes with it makes that
colour worthless. So when the app was reported as feeling dull, the
tempting fix — add colour — would have destroyed the thing the constraint
was protecting.

Three causes were found instead, and two of them were bugs:

- **The fonts had never loaded.** The app requested its typefaces at
  runtime while its own Content Security Policy blocked remote
  stylesheets. Every build, online or off, had been rendering in whatever
  the operating system supplied. A large share of "generic" was the
  intended typography simply never arriving.
- **The logo was broken.** The same policy had no `img-src`, so the brand
  mark rendered as a broken-image icon in the corner of every screen.
- **The greys were mathematically grey** — chroma zero, which reads as
  absence rather than as a decision — on a tonal ramp so even that every
  surface had identical weight and therefore no hierarchy. Borders sat
  three percent away from what they divided: mathematically present,
  visually absent.

**The finding:** subjective complaints deserve objective investigation
before they're treated as taste. "Dull" was three specific, fixable things,
and the constraint everyone would have blamed was innocent.

### 9. Repetition is an information-design problem, not a data problem

The story validator's first version listed every finding as its own row. A
choice block with six unlinked options produced six identical lines — same
scene, same sentence, six times. It was honest and it was unusable: the
panel read as a wall before it read as information.

Grouping by scene fixed it, and the grouping wasn't arbitrary. A branching
writer works scene by scene, and every one of those problems is repaired
*in* a scene — so the grouping that collapses the repetition is also the
grouping that matches the trip the writer is about to take.

Two smaller rules kept a line a line: counts became colour chips rather
than prose ("6 unlinked" doesn't wrap; "6 choices go nowhere and nothing
leads here" does), and a scene with one finding is one row rather than a
group of one you have to open.

And the row labels changed. "Untitled choice" was the panel repeating the
editor's own placeholder back at the writer — in a list of six, every row
claimed to be the same choice. An unwritten choice is now named by where it
is: **choice 3**. True, different on every row, and how you'd say it out
loud.

### 10. One box, two questions — rather than two boxes

Scriare already had a search box that filtered the scene tree by name. When
story-wide search was added, the obvious shape was a second search: its own
box, its own shortcut, its own panel.

That would have produced an app where "search" means two things and the
writer has to know which one they wanted *before they start typing*.

**The decision:** one box answers both. The list above says which scenes
are *called* this; sections below say where the words actually *appear*. It
costs a little layout complexity and removes an entire concept from the
thing a new user has to learn.

**The finding:** when a new feature overlaps an existing one, the cheapest
implementation is a parallel system and the cheapest *product* is usually
one that absorbs it. The cost of a second concept is paid by every user,
forever; the cost of merging is paid once, by you.

### 11. One object with two kinds is not the same as two kinds of thing

Characters and Locations are one object with a `kind` field. That economy
is real — Locations got pages, aliases, mentions and backlinks for free.

It also produced the most instructive bug in the project. When lines gained
speakers, the speaker picker listed every entity, because they were all in
the same array. So a city turned up in a story announcing a line of
dialogue.

That's a category error, not a missing filter, and the difference matters
for the fix. A filter gets added in the three places someone remembers. A
category error gets a name — `canSpeak` — asked at every door, so the next
entity kind is silent by default rather than silent by luck.

**The finding:** sharing an implementation is not the same as being the
same kind of thing. Unifying objects is usually right; unifying their
*affordances* is usually wrong, and the second follows from the first
unless you stop it.

### 12. Design for the order people actually work in

`@` at the start of a line sets who's speaking. The first version required
the line to be *empty* — reasoning that a line with words after it meant
the writer was mid-sentence, reaching for a mention.

That got the commonest gesture backwards. **You write the line, then say
who said it.** Typing a choice and going back to its head to name the
speaker isn't being mid-sentence; it's the normal order of work, and it was
the one order the feature didn't support. The rule became "the `@` is the
first character", whatever follows it, with a modifier key as the way back
to the rarer case.

**The finding:** a rule that sounds principled in the abstract can encode
an assumption about sequence that nobody checked. The question to ask of
any input rule is not "is this unambiguous?" but "what order do people do
this in?"

---

## What was deliberately not built

Restraint was a design tool here, and most of these were harder to hold
than they look.

- **No scripting syntax, anywhere.** Variables, conditions and actions are
  all name boxes, dropdowns and toggles. A writer never types an
  expression.
- **No AND/OR nesting in conditions.** Nestable any/all groups turn a
  writing tool into a query builder, and the overwhelming majority of real
  branching is a list of things that all have to be true. A per-row NOT
  toggle covers the inverse without doubling every comparator.
- **No find-and-replace.** Replace across a whole project is destructive
  and needs its own undo story and a preview. Find-only shipped in a week
  and is most of the value; the other half will wait until it can be done
  properly.
- **No editable variable readout in Play Mode.** Being able to poke values
  would make playtesting faster, and would mean the thing you tested isn't
  the thing a player gets.
- **No block-based editor.** Choice blocks, callouts, quotes and dividers
  are all typed straight through. Paragraphs are still paragraphs. The
  moment writing becomes card-shuffling, the bet is lost.
- **No images in scenes**, and the reason is the useful part. It was costed,
  found cheap, and postponed anyway — because the question is whether a
  writer wants them, and nobody has used the app on a real story long enough
  to say. The position it set is the one that governs everything after
  launch: *features are decided on evidence, not on the list.* The single
  exception is a defect found by measurement, which gets fixed whatever the
  list says.

---

## What's unresolved

Honesty is more useful than a clean ending, so:

- **The player's name is hard-coded.** A line spoken by the player prints
  "You". Some stories want "Detective", or the protagonist's real name.
  That's a story setting, and it isn't built yet.
- **Entity variables** (`Mara.Trust`) are designed and deferred. Arcweave
  ships the same idea as component attributes and articy:draft as template
  properties, so the concept is familiar; Scriare's contribution would be
  that it needs no syntax, just two dropdowns. It's deep, and it pays off
  at a scale the demo story won't reach.
- **Validation doesn't know about speakers.** A line attributed to a
  deleted character quietly becomes narration. That's the right runtime
  behaviour and arguably something the story checker should mention.
- **There is no installer yet.** Export shipped, so the front door is a
  playable HTML file that needs nothing installed — but a writer who wants
  the app itself still runs it from source.
- **No colour reads well on both reading grounds.** Measured while building
  the pick-time warning: the set of colours clearing 4.5:1 on Night *and*
  Paper is empty, and the best any single literal colour manages on both is
  about 4.16:1. The app now says so at the moment you choose a colour, which
  turns a surprise into a decision — but it cannot offer you a safe colour,
  because there isn't one. The real fix is a colour that can say what it is
  on each ground, and that isn't built.

---

## What I'd tell someone starting the same project

**Decide what the thing *is* before you decide what it looks like.** Half
the expensive reworks here — the choice label, the two hierarchies, the
drag loop — were cases where a UI problem turned out to be a modelling
problem wearing a costume. The interface was never going to be fixable
until the data underneath it was true.

**Treat "it feels wrong" as a lead, not a verdict.** It was right every
single time, and it was never about the thing it named.

**Build the way out before you build the thing.** Undo before deletes got
easier. A visible escape hatch before a clever input rule. It's much
cheaper than confidence.

---

*Scriare is built with Electron, React, TypeScript, Tiptap/ProseMirror and
React Flow. 1124 automated tests run against the real packaged application,
with 346 negative controls — each one breaks a specific line of the shipped
source and checks that a named assertion fails. Every load-bearing
assertion has been seen to fail on a deliberately broken build. The full
release history is in [CHANGELOG.md](CHANGELOG.md).*
