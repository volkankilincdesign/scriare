# Changelog

Every released version of Scriare, newest first.

Entries are one or two sentences. The reasoning behind the bigger decisions
is in [CASE_STUDY.md](CASE_STUDY.md); the long-form notes each release was
originally written with are preserved in this file's history.

Versions are not dated — the project was built in a continuous run rather
than on a release schedule, and inventing dates would be worse than
omitting them.

---

## v0.78.1 — The last place still using the old name

The slash-command menu said **Conditional Text** while the button, the
block's header and the Inspector all said **Conditional**. One string, and
the worst one to leave: the menu is where a writer meets the block for the
first time.

Counted before touching anything, because the note at the end of v0.78.0
called this a sweep and it is not one. The Story Graph never names the
block. The script export and the spreadsheet handle it by node type and
describe it by its **conditions** rather than by a block name, so neither
prints one anywhere. Everything else was comments.

**`text` kept as a keyword.** The menu matches on title as well as
keywords, so `/text` used to find this block. Renaming without that line
would have quietly broken a habit somebody may already have, with no error
to report — which is why it has a control of its own.

**The two mentions in `docs/` are left alone on purpose.** Both are dated
design records describing what was decided at the time; editing them to
match a later rename falsifies the record, for the same reason the
changelog is never rewritten.

**Three of the new controls would not go red, and every one was the test's
fault.** The slash-menu checks read every button on screen and filtered for
`/condition/i` — which always matched the toolbar's own Conditional button,
so they passed whatever the menu said. The menu has `data-slash-menu`,
`data-slash-item` and `data-slash-title` now, and the check reads the title
element rather than guessing at a line of `innerText`.

The third is the more interesting one. The caret-lands-inside control kept
passing because the fixture focused the editor first, and inserting at a
caret that is already in the prose puts the block in the right place by
itself. The bug only exists in the flow it was found in: open a scene,
reach for the button, having typed nothing. The fixture loads the document
and bounces scenes rather than focusing, and the control goes red.

## v0.78.0 — The third sibling

Conditional Text has existed since v0.30.0 and could only be made by typing
a slash command, so a writer had to already know it was there. Two block
types with buttons and a third without does not read as an oversight — it
reads as *the pair is the complete set*, which is worse than the third
being missing.

It is a button now, drawn as **exactly** the same control as the other two.
That is v0.67.4's rule stated a third time: making this one quieter would
say it is the lesser of three, which is the thing having no button at all
was already saying.

**The block had a beginning and no end.** It was drawn entirely in CSS — a
dashed left rule, a recessed ground, and the word `IF` in a `::before`.
Measured on three stacked: 18px between them, no closing edge, and a ground
at 20% alpha that does not register on screen. So **the gap between two
unrelated blocks was smaller than the gap between two paragraphs inside one
of them** — things that belong together looked further apart than things
that do not. A grouping failure, not a matter of taste, and the thing he
reported.

It has a real node view now, the same as its siblings: a header that names
it and counts its conditions, and a footer that closes it. A `::before`
cannot count anything, cannot say what the conditions are, and cannot end.

**Drawn as family, to the token — his call, overruling mine.** I drew it
lighter, with no fill, arguing that a Choice and a Dialogue are furniture
the reader meets while this is prose that happens to be gated. His answer
is the better one: the reason it was unreadable stacked is that it was
drawn as a *different kind of thing* from the two it sits beside, and
answering that with a third different weight keeps the same mistake in a
smaller size. What makes it the lightest is what it **does**, not what it
is painted. The mockup's lighter variants are parked, not cancelled.

**Where the difference does belong.** It offers no `+ Add` anything. A
Choice holds options and a Dialogue holds lines, so both offer a way to add
one; this holds prose, which you add to by typing. A "+ Add Condition" in
the footer would be a second door to the Inspector's own control, which is
exactly the growth he asked to stop.

**It is a place to write, and the first build of the button forgot that.**
Insert left the caret outside the block, so everything typed afterwards
went into the page *behind* the thing that had just been made — and nothing
said so. The caret lands inside now. One Conditional takes as many lines as
the writer wants; Enter makes another line inside it, and a double Enter at
the end gets back out.

**The Inspector stopped explaining.** Two rows saying "this passage appears
only when every condition below holds" existed because nothing else in the
app said what the block did. The block says it now, in its own footer, in
one line, naming the actual conditions — through the same `describeCondition`
phrasing Play Mode and the exported page use for a locked choice, so the
three cannot drift.

The label is **Conditional** in all three places: the button, the block's
header, and the panel. `IF` was the odd one out of `CHOICE` and `DIALOGUE`.

## v0.77.2 — As small as the finding

One unnamed variable on option 4 of a six-option Choice Block lit all six —
and sent the writer hunting inside the thing they had just been pointed at,
which is the same "somewhere over there" the reveal was built to end.

One field was answering two questions. The Inspector can only open on a
**block**; the mark should be as small as the fault. Those are different
ids, so they are different fields now: `blockId` for the panel, `anchorId`
for the mark. A choice finding anchors to its option, a Dialogue finding to
its line, a speaker finding to the paragraph that lost its name.

A finding that really is about the whole block — a conversation nothing can
close — leaves the anchor unset and the block is marked. That is not a gap.
There is no one line to blame, and pretending otherwise would point at an
innocent one.

**Two pieces of code deleted for doing nothing.** The first draft also
passed the anchor to the Inspector as a Dialogue `lineId`, so the panel
would open on the same line. Its negative control would not go red, and the
reason was that the reveal already puts the caret inside that line and
SceneEditor's ancestor walk sets the target with its id — the pass-through
changed nothing any test could see. Code that cannot be observed is code
that drifts, so it went, and the control was re-aimed at the walk that
actually does the work.

That is the third time this week a belt-and-braces line turned out to be
only braces: v0.77.0's `goTo` had one, and v0.77.1 found another. The
pattern is worth naming — a second mechanism added "to be safe" is
untestable by construction when the first one already works, and the only
way to find out is to try to break it.

Three controls, one of which had to be rewritten after it was caught being
unbreakable.

## v0.77.1 — A kind is not a place

Reported within the hour: clicking a finding inside a Dialogue lit the
conversation up in the editor and left the Inspector showing the scene.

v0.77.0 gave each finding an `inspect` field saying what its `blockId`
points at, and filled it from a table **keyed on the finding's kind**. That
works for every kind only one thing can raise. It is wrong for the four
that two things can: `unnamed-variable-shown`, `missing-variable-condition`,
`missing-variable-action` and `unlinked-choice` are raised from a choice
option **and** from a Dialogue line. The table filed them all as choices,
so a Dialogue's finding arrived at the Inspector claiming to be a choice
with a Dialogue block's id, `InspectorPanel` found no options on it, and
its v0.55.0 self-healing dropped back to Scene Properties. Everything
behaved exactly as written.

The kind cannot know; only the caller can. Every finding raised inside the
Dialogue pass now says so itself, and `reportUnnamed` takes it as an
argument rather than inferring it.

**The check that should have caught this was aimed one notch off.**
v0.77.0's test clicked a `dialogue-dead-gate` — a kind *only* a Dialogue
raises, so its kind alone was enough and the table was never asked the hard
question. It clicks an `unnamed-variable-shown` raised from a Dialogue line
now, which is the exact shape he hit. Same lesson as yesterday's speaker
anchor: a fixture that avoids the ambiguous case tests the easy half.

## v0.77.0 — Click a line to go there

The dialog has said that in its own subtitle since v0.36.0, and it has
never been true. It went as far as the **scene**, and in a two-hundred-word
scene with six choice blocks, "there" is a guess — so writers hovered the
rows instead, because hovering was cheaper than arriving somewhere vague.
The hover was never the design. It was the workaround people found.

**Reported as three things, and they were one thing.** A scene with a
single finding was drawn as a different component — no disclosure, no line
underneath, its sentence only in a `title` attribute. On The Blue Hour's
report that was nine scenes out of twelve, unreadable without a pointer.
The rule read like tidiness in v0.36.2 ("no disclosure to open for one
thing") and was a dead end. Every scene opens now.

**A row says what is wrong, in the writer's words.** It used to be the
thing's name and `what` on the right — *"And if it fails?" … unnamed
variable* — which is the app's vocabulary, not theirs, and says nothing
about what their **reader** will see. It reads *The reader is shown
"resolve"* now, under the name. Thirteen of these, one per kind, written to
be short and true in that order of difficulty.

**And `what` came off the row.** Drawn as a mockup first, three directions
against the real report, and the version with all three texts read as
crowded — because two of them were the same job. `what` still earns the
scene header, where it counts ("3 unnamed variable") instead of repeating.
The row number went the same way, replaced by a severity dot: a number said
only where a row sat among four, while inside a group mixing a problem with
two warnings the colour is what the width is worth.

**The arrival is the feature.** The editor scrolls to the line, centres it
and marks it for under two seconds. Find has selected its match since
v0.38.0 and this deliberately does not: a finding is something to look at
before deciding, and a whole Choice Block arriving selected means one
keystroke deletes it. So the caret lands collapsed and a decoration does
the pointing — a decoration rather than a class on the element, because
ProseMirror re-renders that element on the next keystroke and takes any
hand-added class with it.

**Two defects found by building on top of v0.76.0, both shipped yesterday.**

`speakerReferences` read each node's id from `attrs.id` — and **no node
type in this app stores it there**: a paragraph and a Dialogue line use
`lineId`, an option `optionId`, both block kinds `blockId`. So every anchor
was null in every real story, and the row that was supposed to point at the
first affected line pointed at the scene. Its test passed because the
fixture wrote `attrs.id` by hand: it was measuring itself. `contentIds.ts`
has held the mapping since v0.69.0 under a comment calling it "one
namespace for all five".

And `goTo` told the Inspector that everything carrying a blockId was a
choice, which was true until v0.76.0 started passing paragraph ids. Each
finding says what its own id refers to now.

**An honest note on that second one.** The first control written for it
would not go red, and the reason was the app rather than the test:
`InspectorPanel` has cleared a target whose choice block does not exist
since v0.55.0, so the wrong answer was being corrected a frame later and
nothing visible changed. The check was re-aimed at a **Dialogue** finding,
where the difference survives — told "choice", the panel finds no options
and falls back to the scene; told the truth, it opens the conversation.
The defect was real and less severe than first described.

Six controls, including the two that were wrong on the first attempt: one
sabotage stored a timer in a different variable and left it firing, so it
never reproduced the bug it was named after.

## v0.76.0 — Who said that

The last of the five gaps the v0.63.0 audit found, and the one that had
been hiding in plain sight: `storyCheck.ts` did not contain the word
"speaker".

`speakerName` returns null for an id that resolves to nobody, and a line
with no name in front of it **is** narration. So deleting a character does
not break the story — it rewrites it. A speech becomes the narrator's,
silently, in whatever scene it was in, and nothing anywhere says so. The
writer finds out by reading the whole story again.

**A speaker lives in four places, and nothing had ever counted them.** A
paragraph's attribute and a choice option's arrived in v0.37.0; a Dialogue
line's own and its **reply's** arrived in v0.66.0. The reply is the one
that gets missed, because it is a second speaker on a node that already
has one — a walk written per node rather than per slot finds three of the
four and looks entirely correct. There is now one list, `speakerReferences`,
and the negative control that matters most deletes exactly that line.

The siblings rule applies to what the app **knows**, not only to what it
draws: a check that finds a broken speaker in a choice and not in a
conversation is the same defect wearing a different coat.

**Two kinds, not one.** A deleted character and a Location set as a
speaker end the same way and are not the same mistake — "İstanbul was
deleted" is a lie about something still sitting in the Content panel. The
second is only reachable in a story written against the first build of
v0.37.0, before `canSpeak`, when every entity was offered.

**One row per speaker per scene,** his call: a character deleted mid-draft
is one mistake, not thirty. Counted in references rather than lines,
because a line whose reply is spoken by the same missing character loses
two names, and the report must not be tidier than the truth.

**And a warning at the moment it happens — in the toast, not a dialog.**
He asked for a delete-time warning; the app has had a written rule against
one since v0.26.0, in `confirmDialogStore`'s own note: a modal earns its
interruption only while the mistake is permanent, and deleting a character
has been undoable since v0.25.0. So the undo toast says what it cost
instead — *Deleted "Mara" — 12 lines in 3 scenes now read as narration* —
which is the part a writer cannot see, since an attribution is an id on a
paragraph rather than words on the page. Both delete paths carry it; the
file's own comment already said no way of deleting something should be
quieter than another.

Two things the first draft got wrong and the tests caught. The report said
*"1 line here **are** spoken by"*, because counting and conjugating were
written separately. And the row carried no `blockId` — which is not only
navigation: StoryCheckDialog reads that field to decide a row's **shape**,
so the row drew a 90-character sentence truncated at "It rea…" beside
neighbours showing a short name and a chip. It points at the first line
that lost its speaker now.

One check in the new spec looked up a character to attribute lines to and
skipped itself when the seeded project turned out to ship `entities: []` —
silently, which is the worst thing a check can do. It makes the cast now,
and asserts it exists.

## v0.75.2 — A dialog covers the window

Reported: open Project Settings or Preferences and the status bar along the
bottom stayed bright and clickable while the rest of the app went behind
frosted glass. Choice Styles had always dimmed it properly. "Show Story
Graph" sat there, lit, offering to do something to a canvas nobody could
see.

`z-index: 100` only outranks what shares a stacking context, and the app's
chrome makes several — the top bar and the status bar are both
`position: relative; z-index: 3`, the side panels `z-index: 2`, all of it
from the lift-and-shadow pass. Those two dialogs were written inside the
top bar's `<header>`, because that is where the button that opens them
lives. So their backdrop's 100 was spent **inside a box worth 3**, and the
status bar — worth the same 3, and later in the document — went on painting
over it. Every other dialog is mounted at the app's root and was fine.

**Measured before it was touched, and the obvious check would have missed
it.** The backdrop's rectangle *did* span the status bar, for all three
dialogs: a geometry test says everything is covered. What told the truth
was `elementFromPoint` over the button — which still returned the button.
Legible, clickable, behind glass.

**The fix is a portal, not two moved lines.** Moving those two mounts to
the app root fixes the two dialogs that exist and not the next one written
inside a panel. `Modal` now renders into `document.body` wherever its JSX
happens to sit, so where a dialog is written is a detail of who owns its
open flag and can no longer decide what the dialog is able to cover. React
events bubble through the React tree, not the DOM one, so nothing above a
dialog notices.

**One thing changed on purpose.** The stylesheet gives `.scriare-topbar`'s
selects and bordered controls a raised cast, meant for toolbar controls.
Project Settings' fields were collecting it by descent alone — measured,
a two-layer shadow no other dialog's fields carry. Out of the header they
are flat, like every field in every other dialog.

Two negative controls: one puts the dialog back inside the bar that opened
it, one keeps the rule for the two dialogs that were complained about and
lets the others drift. The check runs against every dialog, by hit test.

**A correction.** v0.75.1's README said 922 tests. A temporary spec had
been left in `tests/`, and its checks were counted. The real figure is 917,
and the temp files are gone. The control count is now stated as what it is:
253 that apply, 252 of them verified to catch their sabotage, one that does
not and is on the list.

## v0.75.1 — The way back, in one place

Preferences shipped with its "Back to Project Settings" drawn as a ghost
button in the footer, beside Done. Choice Styles — the only other dialog in
exactly that relationship, opened from Settings and told where it came from
— has drawn the same link as a line above its own heading since v0.55.0.
Two answers to one question, twenty versions after the question was
settled, with the component that settles it one import away.

The header is right on its own merits, not merely because it came first. A
footer holds a dialog's **commitments** — what becomes of what you changed
— and this is not one: a theme applies the instant you click a swatch, so
there is nothing to commit or cancel, and a third button in that row
invites you to weigh "go back" against "done" as though they were
alternatives. A breadcrumb is a statement of **where you are**, and that
has to be legible on arrival rather than after scrolling to the end —
Project Settings is 713px tall, so a footer link can be off-screen at
precisely the moment somebody looks for it. A title says what a dialog
*is*; a breadcrumb says what it is *part of*. `DialogHeader` takes both
because they are one sentence.

The real defect was that the rule had no enforcement point. It lived in a
comment, so it drifted the first time a new dialog was written. It is now
checked on **every** child dialog: the link exists, it sits above the
heading, no stray back-button hides among the footer's buttons, and that
footer holds exactly one. Two negative controls hold it there — one moves
the way out back among the buttons that commit, one keeps the rule for a
single dialog and lets the other drift.

## v0.75.0 — The story says what it is

Three of the five gaps the v0.63.0 audit found were one gap wearing three
hats. Project Settings held a theme, a start scene and a list of choice
styles, so there was nowhere to put a **title**, an **author**, a
**language** or the **protagonist's name** — and the two visible
consequences had each been living in a comment for a year.

**The player was hard-coded "You".** The constant's own note said a
project-level setting "is the obvious next step and deliberately isn't
here yet". It was the obvious next step for fifteen versions. A story can
name its protagonist now, and the name reaches every place the old label
did: the `@` menu, the speaker picker, the choice editor, the editor's own
decoration, Play Mode, the exported page, the script and the spreadsheet.
Blank still means "You", which is what a second-person story wants.

**The exported page shipped with no `lang` attribute,** and the comment
there was right about why: `lang="en"` on a Turkish story is worse than
nothing, because a screen reader reads the whole thing in English rather
than falling back to the reader's own setting. The fix was never a default,
it was a field. **A story that has not said still ships no `lang`** — that
has a negative control of its own, because the tempting mistake here is to
guess.

**The author reaches the page as metadata, not as furniture.** It belongs
to the file — a browser's Reader view, a bookmark, a share card — and
printing a byline over somebody's first paragraph is a decision about their
story that this app does not get to make.

**And Appearance moved out.** It had been in Project Settings since
v0.12.0 and was never a project setting: the theme is remembered in this
machine's storage and never written to the file, so a story opened on
another computer keeps its title and its author and loses its theme. Every
other setting in that dialog travels with the story and several of them
reach the reader. Filing the two together said they were the same kind of
thing — the same confusion between the writer's room and the reader's page
that the app has argued against since v0.48.0. There is a **Preferences**
dialog now, reached from a row at the foot of Project Settings, which is
where a writer will look for it out of habit; it remembers where it came
from and offers the way back, the arrangement Choice Styles has had since
v0.55.0.

Three small things that are only obvious once written down. An emptied
field is stored **absent, not as an empty string**, so no reader of these
fields ever has to know two spellings of "unset". A **title cannot be
emptied** — the other three are facts a story may simply not have, but the
title is what the top bar, the shelf and the page's `<title>` all print,
and "Untitled story" chosen by the app beats an empty bar chosen by a
stray Backspace. And opening the dialog and changing nothing **is not an
edit**: no step on the undo stack, no dirty file.

Two findings from the tests, both of them about the tests. A check that the
author is never printed over the first paragraph searched the whole page
body — which contains the story as embedded JSON, author included, so it
would have passed a build that printed a byline in 48-point type. It
measures the markup with the data stripped out now. And this spec passed
alone and failed in the full run, because specs share one application and
a dialog left open by the spec before renders its own scrim over this one;
it closes every dialog first and then checks that it did.

---

## v0.74.0 — The shelf draws the story you actually arranged

The Welcome screen carries a picture of every recent story, because a
writer with nine of them does not recognise one by its name. Two things
were wrong with that picture, and the first is worse than it sounds.

**It was not your story.** `buildStoryShape` capped at **twenty scenes**
and sampled them by walking out from the start. A thirty-two scene story
was therefore drawn with twelve scenes missing and whichever connections
went with them — not a less detailed picture of the story, a picture of a
different one. The comment defending that cap argued about legibility:
that forty scenes "reads as static". That was the wrong thing to optimise.
A shape that is not yours cannot do the one job the picture exists for,
however clean it looks.

**The cap is now fifty**, which for most stories means every scene and
every connection. Past fifty it stops being exact and becomes the opening
of the story — the walk still starts at your start scene, so a long story
shows the part it begins with, connected, rather than fifty scenes
scattered across the canvas.

**And the wires are routed now,** by the same obstacle-aware router the
Story Graph uses since v0.73.0, so the card is the picture the canvas
draws seen from further away rather than a picture of a graph the app no
longer produces.

**Where that cost is paid took measuring.** Routing in the card's own
pixels is the obvious thing and it is wrong twice over: a scene card there
is about **twenty pixels by six**, so the margin the router keeps around an
obstacle is three times the height of the obstacle. That costs 195ms a card
and cannot place a third of the wires at all. Routed in canvas coordinates
and multiplied by one number, the same router costs 32ms and places every
one — which is also the rule the map has followed since v0.53.2: it is a
scale model, not a diagram.

**The routes are cached at save time,** not worked out on the Welcome
screen. A fifty-scene map costs 64ms to route, and a shelf of eight would
have been half a second added to every launch for a picture that does not
change between launches. The story is already in memory at a save and the
app is already writing to disk; that is the moment to pay. A shape is now
around 5KB instead of 700 bytes, which is a file in userData read once per
launch and parsed in under a millisecond.

**Two things the drawing did not know about itself.** A routed wire that
goes around the outermost scene travels outside the box the cards sit in,
so a drawing measured by its cards clips that wire against the panel edge —
the extent now covers every corner of every route. And the drawing was
scaled to fill the panel exactly, which put the outermost card flush
against the border. Reported as *"it does not look premium"*, which is
exactly right.

The Welcome screen's own illustration — the story drawn on a first launch,
before there is anything on the shelf — used to be a hand-written shape
with its extent and card size worked out by hand. Its comment has claimed
since v0.53.0 that it is "drawn by exactly the code that draws a real
story"; that was true while a shape was only positions and would have
become a lie the moment shapes carried routes. It is now a real layout
handed to the real builder.

Every cached shape written before this is treated as no shape at all and
redrawn from the story file — the same migration the v2 format went
through, using the backfill that already exists for it.

---

## v0.73.1 — A wire follows the card you are holding

Reported within the hour of v0.73.0: picking a scene up turned its
connections back into curves until you let go.

That was deliberate and it was the wrong call. The reasoning had been that
the obstacle-aware router costs about a tenth of a second, which is fine
once per edit and impossible sixty times a second — both true — and the
conclusion drawn from it was "no router during a drag". The right
conclusion was "the cheap router during a drag": one turn, first free lane,
still refusing to cross a card, and only for the handful of wires whose ends
actually moved. Everything else keeps the path the real router already gave
it, because dragging one scene has never been a reason to redraw the other
sixty. **0.28ms a frame** for the wires of a busy card.

A wire the cheap router cannot place mid-drag gets a plain one-turn path
anyway — the only place in the file that draws a wire without checking what
is under it. Mid-drag the cards are being pulled over each other on purpose,
so "no legal route" is common and means nothing about the arrangement
anybody will keep; a line briefly crossing a card while you hold it is a far
smaller lie than the wire turning into a curve, and the real router redraws
it the moment the drag commits.

The check for this asserts that the wire's start point **moved with the
card**, not that it is not a curve — a stale path is a straight line too,
and just as wrong. Its negative control restores exactly the shipped bug and
that is what goes red.

---

## v0.73.0 — A wire that knows what is in its way

Reported as *"they overlap too much and it is almost impossible to read
which node is connected to which"*. Three separate facts turned up, and
only one of them was the layout.

**Every exit left from the same pixel.** One anchor in the middle of the
right edge, out, one in the middle of the left edge, in — so four choices
leaving a scene were, for their first stretch, the same line. Measured on
The Blue Hour: 66 pairs of wires shared a starting point and 104 shared a
finishing one. No routing separates two lines that begin at the same place,
so every choice gets its own slot, in the order it sits on the page.

**A chapter now runs DOWN the page.** Everything ran left to right at every
level, which made the story 7,352px wide and 314px tall — a ribbon
twenty-three times longer than it is deep, that you can never see at once
and so can never read as a shape. Stacked, with the chapters lined up along
the top like columns of a page, the same story is 2,952×1,082. Which
immediately exposed the second fact:

**A wire still left sideways to reach the scene directly below it,** swung
out into empty canvas, turned and came back — so for its first forty pixels
it pointed at the wrong scene. 64 of 72 wires were that shape. A wire now
leaves the side it is heading towards: down the page it leaves the bottom
and lands on the top, across it leaves the right, backwards it leaves the
left, because that is where it goes. *This is the part that was not a
matter of taste, and it was reported as one — "logically true but not
pleasing".*

**And the straightening pass only knew one direction.** It had pulled a
scene onto its feeders' line since v0.43.0, on the vertical axis, because
until now there was only one direction to pull on. Stacked, the axis across
the flow is the horizontal one, and without that a chapter is a staircase
sliding downhill rather than a spine.

**Then the third fact: sixty wires passed underneath cards they had nothing
to do with.** That is the worst of the three — a line crossing a scene
looks like it *ends* there. So the canvas is now a place with things in it:

- **A card is a hard obstacle.** Nothing routes through one, and there is no
  code path that can draw a wire without asking. The forbidden rectangle is
  the card *plus a pixel* — a line lying exactly along a border is legal by
  the geometry and wrong by the eye.
- **Another wire is a soft one,** and the two ways of meeting one are priced
  very differently. Crossing at a right angle is nearly free, because a plus
  sign is not ambiguous; running *along* the same line costs six times empty
  canvas, so a wire takes the next 18px track rather than share. Since every
  segment is axis-aligned, every crossing is exactly ninety degrees: two
  parallel lines that read as one line are not reduced here, they are
  impossible.
- **Then rip-up-and-retry.** The wire routed first takes the good track and
  can force a later one into a detour that makes no sense to look at, so the
  worst quarter is torn out and routed again with the rest of the picture in
  place, under a hard time budget — Auto Layout is one button press with an
  undo behind it, and has to feel instant rather than converge beautifully.

**It does not scale, and the limit is in the code rather than in a comment.**
Measured on generated stories: 111ms at 32 scenes, 355ms at 100, 589ms at
250 — and then 4.1 seconds at 500 and 39 at a thousand, because the grid
grows on both axes at once and the search window stops helping once one
chapter is bigger than the window. Past 300 boxes a cheap one-turn router
runs instead. A wire *neither* can place comes back as nothing and is drawn
the old way, which is the opposite of what the first attempt did: it had a
give-up path that drew the wire anyway, unchecked, and that is exactly how a
connection ended up running under two scenes.

**And the cheapest part, which is not geometry at all:** select a scene and
everything that is not it or one step from it fades to a quarter. Not to
nothing — the point is that the rest of the story is still *there*, out of
the way, so the lit path reads as a path through something.

Two of the nine new negative controls failed first time, and both were
findings about the control rather than the app. One asserted that spreading
slots at even fractions costs you the card's centre line; it does not, an
odd count owns the centre either way, and the comment in the source that
claimed otherwise has been corrected rather than quietly deleted. The other
aimed the straightening pass at the wrong axis and *collapsed* the chapter
instead of tilting it, so a different assertion went red and the control
reported nothing caught while having found a worse bug than it was looking
for.

---

## v0.72.0 — What a locked choice is allowed to say

A locked option is shown to the player on purpose. The runtime's own
comment has argued since v0.36.0 that a crossed-out row with no reason is
worse than no row at all — and that decision quietly made the variable's
name into prose. A player met this, in the middle of a story:

> Requires knows_roster is true

An internal identifier, an English comparator and a raw value, none of
which anybody wrote.

**A variable gains a display name.** Optional, because most variables are
never seen: only one gating an option whose `whenUnmet` is "lock" ever
surfaces. `resolve` becomes **Courage**, `knows_roster` becomes **The
Roster**.

**The value never reaches the reader.** "Requires Courage is at least 3"
hands a player an integer out of the design document; what they can act on
is which thing they lack, and the threshold only says how the machine is
built. Dropping it also rescues every boolean, which cannot be phrased with
its value at all.

**Which meant getting negatives right, or saying the opposite.** Drop the
comparator from `lamp_lit is false` and you get "Requires The Dark", which
is not clumsy, it is wrong. A boolean carries its polarity in its value as
well as its comparator, so `eq false` and `neq true` are both negative and
`negate` flips whatever the rest worked out to. Those read "Requires not
The Dark" — still not a sentence anybody would write, which is what the
next part is for.

**A choice can carry its own sentence,** and it replaces ours entirely with
no "Requires" bolted onto the front, because a sentence somebody wrote is a
whole sentence rather than the tail of one of ours. That also took the last
hard-coded English out of the exported page's runtime: the reason is
finished at export time now, so a writer's Turkish sentence never arrives
with an English word in front of it.

**Check Story reports the gap rather than the app hiding it.** A variable
with no display name still falls back to its internal name, exactly as
before, so nothing regresses — but every place a reader can see one is now
a findable warning, beside unreachable scenes and dead gates. It fires only
where it can actually be read: never on a hidden option, never on one whose
reason the writer has written.

**And the sheet gains two row types, no new column.** A `Variable` row per
display name, in a V block after the scenes because they belong to no
scene; a `Reason` row per written sentence, hanging off its option the way
a reply hangs off its line — `1.C3w`, keyed `c_force-the-lock-why`, so
deleting the choice takes the reason with it. An UNNAMED variable gets no
row at all: asking a translator to localise `hikmet_offer` is worse than
asking them nothing.

Both panels got the field, under the siblings rule — a locked dialogue line
reads to a player exactly as a locked choice does.

**Ten negative controls, one of them aimed at the wrong thing twice.** The
"an unnamed variable reaches a translator" sabotage kept passing, because
it attacked the label rather than the filter — and the filter is the whole
guard. Two existing specs had to change: the export spec asserted the old
phrasing verbatim, and the Variable Manager's "the four things a variable
is" is five things now.

## v0.71.2 — Nothing in the file fences its reader

**The dark rule between Ref and Where was a frozen-pane split.** v0.70.1
froze both axes so Key and Ref stayed in view while scrolling right to
Translation; a spreadsheet draws that split as a solid rule down the
sheet, and the file does not get to opt out of it. He measured it before I
did — a column of pixels a quarter darker than any gridline, running the
full height of the table. The header row is still frozen. The columns are
not. A rule through the middle of the table is a worse price than
scrolling.

**And every cell of the Lines sheet is writable, with nothing drawn to
suggest otherwise.** The last lock flags are gone, and so is the rule that
outlined the editable pair. His argument, and it is the right one: the
sheet says plainly which two columns are the ones to write in, and a
person who types over a generated column has only overwritten something
the next export puts back. A file that fences its own reader is solving a
problem it does not have.

What marks those two columns now is colour and only colour — two warm
columns in a sheet of white and pale grey — which was doing most of the
work from the start. The Read me stays protected: reference, not a
surface.

Three new controls, one for each thing that could come back: the vertical
split, a lock flag, a rule down a column's side.

## v0.71.1 — Unlocking the sheet everyone works on

**The Lines sheet shipped protected, and he could not type in his own
export.** The protection was there to guard a translator against the one
accident that silently ruins a localisation file — a sort that moves one
column and not the rest — and it was aimed at entirely the wrong person.
The writer owns the story. The Lines sheet is the working surface, for the
writer as much as for anyone it is sent to, and locking the surface people
work on is not a guard rail, it is a door with no handle. It was never
security either: Excel's sheet protection comes off in two clicks, so all
it really bought was friction for the one person guaranteed to hit it.

Lines is open. The **Read me stays protected**, which is his split and the
right one — it is reference text, the schema version and the fingerprint
and what each column is for, not a surface anyone works on.

The shading still says where to type, which was always doing most of the
work, and `locked="0"` stays on Translation and Notes so that a studio
protecting the sheet before sending it out gets the right two columns open
without setting it up.

**And one typeface.** The Key, the Scene ID and the hash were set in
Consolas, on the argument that a monospaced id makes a mistyped character
visible. That was true while a key was `xU40lTnJ8JVN16hgSPB2I`. It stopped
being true the moment a key became `t_indigo-does-not-look` — you do not
need a grid to read words — and what was left was three columns in a
different face for no reason anyone opening the file could see.

The typeface check had to be rewritten before it meant anything. Sampling
each column's font was a test nothing could fail, because with one family
declared there is no single edit that gives one column a different face;
the negative control said so by staying green. It asserts over the font
table now — the workbook declares one family — which is the property that
can actually break.

## v0.71.0 — A key is a name

Third attempt at column A, and the first two were wrong in the same way:
they kept asking what an id should LOOK like instead of who reads it.

**What the audit actually established was narrower than what it
concluded.** `docs/spreadsheet-export.md` argues that identity and address
pull apart — "is this the same line I sent you last week" must never
change, "scene 15, dialogue 2" must change the moment the story does — and
from that concludes the Key is opaque. But it weighed only the translator.
Column A is also the CSV's RowName, which is the `FName` an engine looks a
row up by and the string shown in a DataTable's row list; gibberish there
is gibberish in the editor and in every reference to a specific line. The
requirement is only this:

> a key must never change, and must not be positional

`t_indigo-does-not-look` satisfies both. Opacity was never the
requirement — it was what the only stable option happened to look like.

**So a key is named once and frozen.** A line is born empty and takes a
provisional random id; the first time it has words it takes its name, and
after that nothing renames it — not a rewrite, not a move, not a
reordering. `s_the-blue-hour`, `t_indigo-does-not-look`,
`c_go-and-find-nesrin`, `d_why-did-you-wait`. The cost, which is the whole
cost: a key can outlive its words. Rewrite the line and the key still says
what it used to say. That is correct — the columns beside it carry the
current truth — but the name is a birthmark, not a description.

**Ordinary English repeats, and that was the hard part.** The sweep walks
the mounted document and nothing else, which was fine while keys were
random — two nanoids do not collide — and stopped being fine the moment a
key was made of words. "Keep working." opens a line in two different scenes
and both claimed `c_keep-working`. Measured on The Blue Hour: **eleven
collisions in two hundred and fifty-two rows**, every one a row an engine
drops on import. Naming now asks the project what is already spoken for,
through a provider the app installs at startup, and the second line becomes
`c_keep-working-2`. Ten rows in The Blue Hour take a suffix; none collide.

**A scene's title row carries its own stored key.** Deriving it from the
title would rename it whenever the scene was renamed — precisely the
failure the design document warns about one level up, where an engine
grouping by title decides a rename created a new scene full of new lines.

**Two bugs found by the tests rather than by me.** A scene's own keys were
counted against it while it was being processed, so every key came back as
`-2` the second time a project was opened — caught by the idempotency
check in the choice schema, which exists for exactly that. And the live
sweep was reshaping legacy ids mid-session, which renamed an option out
from under the Inspector that was editing it; reshaping belongs to the
open-time pass, where the whole project is in view and it happens once.

**Five negative controls started green, and three were weak assertions.**
The strongest lesson: a key's SHAPE proves nothing. `t_tr9tmhw8` is lower
case, prefixed and hyphen-free, so it satisfies every pattern a name does —
emptying the slug function left the suite green. The check is now "the key
is made of THESE words", computed by the spec's own slug so the app cannot
blind it. One control had to be retired outright and said so in the file:
since the rule now lives in a two-pass walk, every single-line inversion
makes the sweep fault one position twice, which kills the spec instead of
reddening it, and a control that crashes proves nothing.

## v0.70.1 — Two things he saw the moment he opened the file

**The Keys looked like ciphertext.** `xU40lTnJ8JVN16hgSPB2I`, down the
whole of column A. That was `nanoid()` — twenty-one characters of mixed
case with dashes and underscores — and it had never been a decision. It was
the library's default, taken in the first hour of the project and never
revisited, because for sixty-nine versions nothing outside the app ever
read an id. The design document had been writing the Key as `ln-1q` the
whole time, which is what somebody imagines an id looks like when they have
not looked at one.

A content id is now `t_g99y4z6p` — a letter for its kind, then eight
characters from an alphabet with no `0`/`o` and no `1`/`l`/`i`, because a
key gets retyped and every removed character is a class of mistake that can
no longer be made. `t_` a paragraph, `d_` a spoken line, `c_` a choice,
`b_` a block, so column A says what the row is before the Type column
repeats it. Twelve characters at the longest, against twenty-one.

**Opening a project rewrites the ids it is carrying**, once, in the same
pass that already repairs a missing or repeated one. That breaks the
attachment between any sheet already exported and the story it came from —
which is free exactly now, and never again.

**Scene ids, entity ids and variable ids are deliberately untouched.** His
call and the right one: they are pointed at by choices, by every mention,
by every condition and by the content tree, so reshaping them is a
project-wide remap for a column nobody objected to. A scene title's Key is
still its scene's own id, so in a story whose scenes are `s01` it reads
`s01:title` and in one whose scenes came from the app it will still be
long. That is a separate decision, not an oversight.

**The headings could not be read.** Bold on a near-black fill, with no font
colour, so they inherited black and the header band was black on black. The
spec asserted the band existed and that it was frozen. It never asserted
that anybody could read it — which is the only thing the band is for, and
is now measured as a contrast ratio between the ink and the ground rather
than as the presence of a fill.

**And the rest of the formatting, while the file was open.** Rows are
banded, because seventeen columns is wider than a screen and following one
row past the edge of the window and back is what stripes have always been
for. The two columns a translator types into keep one constant colour
through that banding, which is what makes them read as a block rather than
as two more stripes. The freeze is on both axes now — the columns needed in
view while typing into Translation are Key and Ref, and they are the two
furthest from it. Chars is centred, the Read me has real headings, and the
column widths follow the shorter keys.

**Verified by opening the file rather than by reading the XML.** The
workbook was converted with LibreOffice and photographed: it opens with no
repair prompt, the header is white on slate at 14.8:1, and the Translation
column is the one warm stripe down the page.

Four tests had to change, and all four were encoding the old behaviour: two
in the choice schema that asserted a legacy id survived a migration, and
two in the id spec whose fixtures used ids no real project would now hold.
One of them came back stronger — "loading an already-current document
changes nothing" now proves the reshaping SETTLES, rather than rolling
round again on every open.

## v0.70.0 — The third door: every string a reader sees

Export has a third tab. A page to play, a script to read, and now a
spreadsheet to work from — the one the Script panel deferred on purpose
two versions ago, with its own comment saying why: a Word table of nine
hundred rows is a worse spreadsheet than a spreadsheet.

**Every string, not only the spoken ones.** Scene titles, prose, choices,
dialogue and replies, one row each. A sheet without prose cannot localise a
story, and adding prose later would renumber rows a translator has already
worked in. The Blue Hour comes out as 252 rows: 32 titles, 122 paragraphs,
70 choices, 15 dialogue lines, 13 replies.

**Three identifiers, because an id does two jobs that pull apart.**
Identity — "this is the same line I sent you last week" — requires it never
to change. Address — "scene 15, dialogue 2" — requires it to change the
moment the story does. So the Key is the app's own opaque id, the Ref is
`15.D2` and is recomputed on every export, and neither pretends to be the
other. Changing the Start Scene renumbers the whole sheet, and it should:
the initial passage really is the initial passage.

**Scene numbers come from reachability**, outward from the start along the
choices in the order a reader meets them. A scene nothing leads to gets a
U block — `U1`, `U2` — after the numbered ones, because Check Story already
reports those scenes and the sheet must not quietly imply an orphan is part
of the flow. It is still translated.

**Two files, from one save dialog, side by side.** The workbook is the
translator's document: seventeen columns, header frozen, filters on, a live
`LEN` formula so a character budget can be watched while it is spent, and
everything locked except Translation and Notes. That locking is not
security — it is removable in two clicks and meant to be — it is a guard
rail against the one accident that silently ruins a whole file, which is a
sort that shifts one column out of step with the rest.

**The CSV is written by hand, and that is the whole point of it.** On a
Turkish Windows, "Save As CSV" gives semicolons and CP1254: Unreal reads
commas and UTF-8, and the İ and the ş arrive as mojibake in a file that
opens perfectly in the application that broke it. This one is
comma-delimited, quoted, UTF-8, with no byte order mark — Unreal takes a
BOM as part of the first column's name — and newlines escaped as `\n`,
because a DataTable row cannot span lines. Six columns rather than
seventeen: every column is a struct field somebody has to declare.

**An .xlsx is a zip of XML, and this writes the XML.** A spreadsheet
library would have brought a megabyte of code and its own opinions about
types and dates to produce two sheets and one formula. The risk it trades
for is real and is the one the tests are pointed at: a hand-written
workbook does not fail by putting a wrong number in a cell, it fails by
Excel refusing to open the file — and the commonest cause is one unescaped
ampersand in a story that mentions Dogs & Daughters.

**Exporting the same story twice gives the same bytes**, so a writer can
tell a stale sheet by comparing it rather than by remembering.

**Found on the way: dialogs ran off the top of a short window.** Every one
of them is centred, so a dialog taller than the window overflows at both
ends and nothing scrolls — at a 620px window the Export dialog's own frame
started at −9px and its buttons could not be reached. Fixed on the Modal
rather than on the panel that exposed it: every dialog in the app was one
long panel away from the same fault, and none of them can see the window's
height.

**Fifteen negative controls, and three of them started out not catching
their sabotage.** Removing the XML escaping left the suite green, because
the test fixture contained no ampersand — a fixture with nothing hostile in
it cannot notice that hostility stopped being handled. Replacing the fixed
zip timestamp with `new Date()` left it green too, and that one was more
interesting: two exports a second apart match byte for byte anyway, because
a zip stores DOS time at two-second resolution. The identical-bytes check
was true and silent about the guarantee; the assertion moved to where the
guarantee lives, which is the date on the entries. And capping the dialog's
height pinned Playwright's viewport, which stopped the Welcome spec's
window resize from doing anything two specs later — a trap whose own
comment, written a dozen versions ago, warns about exactly that.

Known and unchanged: a locked choice still prints `Requires ` plus the
variable's internal name, so an identifier can reach a reader. Variables
gain an optional display name in their own small version, and the sheet
then grows a row type rather than a column.

## v0.69.0 — The ids under column A

The spreadsheet export makes a line's id the CSV's RowName. Before writing
the exporter, the id was audited against every way a writer can disturb a
line — and it did not hold. **Pressing Enter in the middle of a sentence
gave both halves the same id.** Measured with a real keypress: two
paragraphs, one id, permanently.

**`keepOnSplit: false` was declared on the attribute and had been doing
half a job for two versions.** Tiptap consults the flag in the one branch
of `splitBlock` that passes node types to `tr.split`, which is the branch
where the caret is at the END of the block. Split anywhere else and
ProseMirror's own default copies every attribute to both halves. So Enter
at the end of a paragraph was correct and Enter mid-sentence was not, which
is the worse of the two possible failures: the common case looked fine.

**Underneath it, one reason all of this survived.** Three separate pieces
of code looked after ids — an open-time pass, a live sweep, and the
reissue that runs when a scene is copied — and every one of them only ever
filled in a MISSING id. None could see a repeated one. So copy-and-paste
cloned all five id-bearing kinds, because each round-trips through a
`data-*` attribute that `parseHTML` reads straight back; and duplicating a
scene reissued the choices while leaving the prose and the Dialogue
carrying the original's. The three pieces are now one file that can see all
five kinds at once, and it repairs a repeat as well as a blank.

**Which copy keeps the id is decided by document order,** so splitting a
sentence leaves the id on the half that starts it, and an existing
translation stays attached to the opening clause rather than being
orphaned by an ordinary edit.

**A pasted line is a new line.** Ids are cleared at the paste boundary,
which is the only moment the editor can tell an arriving node from the one
it was copied from — afterwards nothing can. The cost is that cutting a
line and pasting it elsewhere reissues its id, because ProseMirror cannot
distinguish a move from a copy. That was chosen deliberately: a duplicate
id is fatal, and a moved line costs a translation memory one fuzzy match
on its own text, which is what those tools do anyway.

**None of this appeared in any test story,** because the test stories were
generated by a script rather than typed. Both real copies of The Blue Hour
were checked — 122 paragraphs, 15 dialogue lines, 70 options, not one
repeat. The file on disk was clean because nobody had written in it.

**Seven negative controls, and three of them started out not catching
their sabotage.** Two were findings about the tests. The first: breaking
the paste strip entirely left the suite green, because the live sweep
repairs a duplicate wherever it came from — so no paste inside one scene
can tell the two designs apart. What the sweep cannot do is look at a scene
that is not open; it makes a document internally consistent and says
nothing about the project. Copy a line out of scene 3, open scene 20,
paste, and two scenes claim one id forever. That is the case the strip
exists for, and it is the case now asserted. The second: the spec asked the
app's own table which attributes to look at, so deleting a row from that
table made the code stop stamping a node type and the test stop looking at
it, both at once. The spec carries its own table now — a test that asks the
code under test what to check cannot catch the code forgetting something.

Nothing about the file format changed. Opening a project written by an
earlier version heals any duplicates it is carrying, keeping the id on the
first of each pair.

## v0.68.0 — The mark takes the theme

The logo in the top bar was the one coloured object in the app that could
not follow the palette: two baked SVG files, chosen by whether the theme's
ground was light or dark. It is drawn inline now and filled with
`currentColor`, so it takes the accent the way every other coloured thing
does — and a ninth theme would cost nothing rather than a ninth decision.

**The letterform is a hole, not a shape in a second colour.** Cut with a
mask, so whatever is behind the mark shows through it: the bar's surface,
the Welcome screen's page, anything later. Painting the letter would be a
guess about what is behind it, and it would be wrong on exactly the
surfaces it was not guessed for.

**It sat 2.5px low, measured.** A 24px disc beside an 11px cap band cannot
be centred as boxes and look level — the row was aligned on boxes, so the
mark's box centre met the text's line-box centre instead of the letters.
It is on the cap band now, 0.5px out.

**And the thing he actually saw: "the top and bottom look cut off."** The
artwork inscribes its circle exactly in a 900×900 box, so the disc was
tangent to the edge of its own element. At 24px the top row of that circle
is a flat run about 6px wide, pressed against the boundary — and a tangent
reads as a cut. The viewBox carries 6% of air now; the same flat row reads
as curvature. **The nudge is a whole pixel for the same reason:** −2.5px
lands the disc on a half-pixel grid and smears it across two rows at 100%
zoom, which is the thing the nudge was supposed to fix.

**The assertions are the three complaints, not the three fixes:** the
mark's pixels are the accent in all eight themes; its optical centre is on
the cap band; and the disc does not reach the edge of its element. All
three controls caught.

**One test was rewritten rather than repaired.** v0.53.0's welcome-screen
check asked *which file* the mark loaded, and there is no file now. It
asks whether the mark moves with the palette at all, measured on its
pixels — eight themes, eight colours.

---

## v0.67.4 — The two toolbar buttons are one button

The Dialogue shipped in v0.66.1 as the outlined half of the pair, on a
"one primary per bar" argument. That is a rule about bars in general and
not about these two: they insert the two block types, a writer reaches for
them equally, and drawing one as the lesser control said the same thing
about the Dialogue that having no button at all had said.

Every value is the Choice button's now — the accent fill, the text colour
on it, the height, the radius, the padding, the type, the gap. The icon
and the word are the difference, and they are the only difference.

The parity spec reads both buttons' computed styles in all eight themes
and compares them field by field, which is the same shape as the rows and
the panels: not "this is the right colour" but "these two are the same
thing, whatever the theme makes of it."

---

## v0.67.3 — The Inspector follows a click into a reply

Reported with a screenshot: editing line 2's reply while the Inspector sat
open on line 3.

**The Inspector follows the ProseMirror caret**, and three quarters of a
Dialogue line is not content. The reply is a flat attribute — the
compromise argued in the block's own notes — so the node view draws it as a
textarea inside `contentEditable={false}`, and the after-mark, the ✕ and
the destination label are chrome. Clicking any of them moves DOM focus and
leaves the PM selection exactly where it was, so no selection event fires
and the panel goes on showing whichever line the caret was last really in.
Nothing failed to notice; nothing was asked to.

**One `pointerdown` on the line's node view** aims the Inspector at that
line, which covers all four. `pointerdown` rather than `focus` because
three of the four are not focusable, and the block id is read by resolving
the node's own position rather than passed down, the way the row's number
already is.

**The guard is not an optimisation.** Without it, every click inside an
already-targeted reply writes a new object to the store and the panel
re-renders under the writer's hands while they are typing in the field it
is re-rendering. The spec clicks the same reply three times and asserts
**zero** store writes; the control that removes the guard turns that red.

The block level never had this problem: `ChoiceBlockView` and
`DialogueBlockView` have carried a header handler for the same reason since
v0.34.1. The per-line chrome is what never got one.

---

## v0.67.2 — The whole panel, compared corner to corner

v0.67.0 matched the editor's rows. v0.67.1 matched the Inspector's rows.
Both times he found the next difference within the hour, because both
times I fixed what he pointed at instead of comparing the component. This
one went through the panel end to end first and fixed everything the
comparison turned up.

**The header.** `Dialogue` in mixed case at text weight, with a line count
where the choices panel keeps its add button, and **+ Add Line** parked at
the foot of the list. Three differences in a header of two elements. It is
the section label now, the add button sits beside it, and the count is
gone — a conversation's size is already on the block in the editor and on
its badge in the graph, and the choices panel does not count itself.

**Two controls that had been copied by hand.** The speaker select and the
appearance control were written for the choice panel and then written
again, slightly differently, inside the Dialogue's. That is how two panels
meant to be one component drift: not in a decision, but in a `<select>`
copied with a different class string. They are one component each now,
in `choiceControls.tsx`, and neither takes a choice or a line — only the
value it edits, because neither ever needed more.

**Things the Dialogue simply did not have**, all of which the choice had:
a **Style** row (a line has carried a style since v0.66.0 and both the
editor and Play Mode paint it — the panel was the one place a writer could
not reach it), **+ Create New Scene** in the destination select (a line
that leaves usually leaves for a scene that does not exist yet), and the
disabled state on **+ Add Condition / + Add Action** when the story has no
variables.

**And one thing it had twice.** An open line offered two ways to remove
itself — the ✕ in the header and a "Remove line" button at the foot. The
choice offers one.

**Two fixes that touch the Choice panel**, which the sibling rule allows
when the choice is the one that is wrong: the dragged card's ring and
shadow traced a 6px silhouette around an 8px card, and the Dialogue's
landing zone was 6px against its own 8px row. Both are 8 now.

**The spec compares the panels rather than a list of colours.** Header
metrics, the open card's padding, rule, heading style and label column,
how many remove controls a row has, and that both panels contain the same
two shared controls — asked of each panel in turn, because the Inspector
only ever shows one at a time. Three new controls, all caught: put the
mixed-case title back, change the open row's padding, take the Style row
out.

---

## v0.67.1 — The Inspector's rows, which is where he was looking

v0.67.0 made the two blocks match **inside the scene editor** and left the
Inspector alone. The Inspector is the panel he was pointing at, and there
the Dialogue row was not a choice row with different words in it — it was a
different component: a 6px card with **no fill of its own** and a filled
strip across its top, beside the choice's 8px card filled with `--bg`.
Seven differences, in eight themes.

**The missing fill was also the "transparency" during a drag.** A card
with no background has nothing to hide what is behind it; against the
panel that nearly passes, and the moment the row lifts out of flow it is
obviously see-through. Nothing about the gesture was wrong — the gesture
was the part that worked.

**The row is now the choice row**, value for value rather than by
resemblance: the card's fill, the 8px radius, the 14px title, the handle's
padding, the ✕ in the header. Its second line carries what a choice's
carries in the same slot — a choice says where it goes, a line says what
happens after it: *Stays in the conversation*, *Ends the conversation*,
*↪ The Tea Runs Out* in the accent when it leads somewhere. The row number
went with it; a choice does not number itself either, and that number was
half of what made the two lists look unrelated.

**The after-mark stays in the header**, in the place a choice leaves empty,
because it is the one fact a conversation has and a choice does not.

**The mockup came before the code**, which is the rule for anything
contested in this project and was skipped last time. Three columns — the
choice row as shipped, the Dialogue row as it was, the Dialogue row as
proposed — in all eight themes, switchable, with the drag state as its own
view. He picked the third column and the build followed it.

**The parity spec now asks the same question one panel to the right**, in
all eight themes, and separately that a row has a fill of its own — the
complaint stated as an assertion rather than the fix stated as one.

---

## v0.67.0 — The Dialogue and the Choice are siblings

Volkan's rule, in his words: the two blocks are related, like brothers.
Same palette, same principles, and only the behaviour is allowed to
differ. Three things followed from it.

**The row is the same box now.** v0.66.0 drew a Dialogue line on
hard-coded `--surface` and `--border-soft` while a choice row painted the
writer's own **Choice Style** — so the two blocks disagreed in every one of
the eight themes, and worse, a writer who restyled their choices found
their conversations had not moved with them. The line already carried a
`style` attribute and Play Mode had always honoured it; the editor simply
was not asking. It asks now, through exactly the call a choice row makes.

**The test for it does not name a colour.** A colour is a thing a theme
decides and a writer can override, so `dialogue-parity.spec` walks all
eight themes and asserts only that the two rows ARE THE SAME — fill,
border, width, radius, padding — whatever that same happens to be. Then it
restyles the choices and checks the conversation moved with them. A
hard-coded expectation would have passed on the day it was written and
said nothing afterwards.

**Lines can be dragged into order.** The gesture is not a second
implementation: the Choices panel's own drag — the one rebuilt around
"the list's layout does not change while a drag is in progress", with its
frozen geometry, its landing zone and its drop glide — moved into
`useReorderableList` and both panels use it. That is the sibling rule
applied to behaviour: if the two lists drag differently, one of them is
wrong. `reorderDialogueLines` is the twin of `reorderChoiceOptions`, down
to the safeguard that a reorder which cannot return every line it started
with does nothing at all.

**That gesture had never had a test.** It was covered at the document
level — `reorderChoiceOptions` with an array — and by eye above that. A
shared implementation with no test is one that breaks both lists at once,
so `reorder.spec` now performs a real drag with real pointer events, in
both panels, and asks the DOCUMENT what happened rather than the panel,
which is a picture of the document and could agree with itself while being
wrong.

**The replies stopped reserving a line they do not use.** His third
report, and the measurement is the whole story: a reply's height is
written in pixels, which is an answer to "how many lines does this wrap
to", and that answer expires the moment the column changes width.
Collapse a dock or widen the window and a reply that now fits on one line
kept two lines' worth of height — **33px drawn against 17px needed**. A
ResizeObserver re-measures it; a window listener would not have, because
the editor column changes width when the docks move and the window never
hears about it.

**One bug of my own, found by the suite.** The reorder hook went in below
Dialogue Properties' early return, which makes it a hook that runs on some
renders and not others — so the first time the block went away, which is
every time the writer presses Play, React tore the whole tree down and the
app went blank with no error in the console. The Dialogue's own spec
caught it one file later: `isPlaying: true`, and `#root` empty. Hooks
above the return, and a note saying why.

---

## v0.66.1 — Where a speaker's name sits, and a button for the Dialogue

Two things Volkan found within an hour of opening v0.66.0, plus one the
fix for them turned up.

**The Dialogue had no button.** It was a slash command and nothing else,
sitting next to a Choice Block that has had a filled button on the toolbar
since v0.33.0 — which said, to anyone who had not read the changelog, that
one of them was a real feature and the other was a trick. It is beside the
Choice now, outlined rather than filled: one primary per bar, and the
Choice is still what most scenes end with. The icon is a speech shape with
the lines left inside it, because a branch says *the scene splits* and this
block's whole claim is the opposite.

**The speaker chip was hung off the baseline.** His word was
"misalignment" and he was right, but the code was not obviously wrong: the
chip's own text was exactly on the line's baseline, to the pixel. That is
the correct answer to the wrong question. **A pill is not a word.** What
the eye lines up is the box against the band the letters occupy — cap
height down to baseline — and a box whose *text* is baselined hangs below
the line by its descender space and its padding. Measured at 16px prose:
the pill fell **5.8px below the baseline** and its centre sat **1.63px
under** the centre of the cap band.

`vertical-align: middle` does not fix this, which is worth recording
because it is the obvious thing to try: measured, it moved the pill
**0.05px**, since it aligns to the parent's x-height midpoint rather than
to any optical centre. The fix is a shorter box and a nudge in `em` so it
scales with whatever the writer sets the prose to. Now **0.24px** off
centre, and it dips 3px rather than 5.8.

**The reply's name was on a hand-picked padding** — `pt-[3px]`, chosen by
eye at one font size — so it sat below the words it introduces. It cannot
be fixed with `align-items: baseline` either: a textarea reports its
*bottom edge* as its baseline, so a two-line reply would drag the name
down with it. Both sides get the same line box instead, and the smaller
type centres itself in it. 0.5px apart now.

**And while photographing that fix: a reply that could not be seen.** The
textarea grows to its content, and the code that grew it was a ref
callback — which is the one place it cannot work, because ProseMirror
builds a node view's DOM *before* putting it in the document. The callback
measured `scrollHeight` on a detached element, got 0, wrote `height: 0px`,
and nothing ever recomputed it. The reply was in the file and in the
field's value the whole time. Measured height on a freshly built block:
**zero**. It is a layout effect now, re-run when the reply changes, and it
refuses to write a height of nought.

**Five new negative controls**, and one of them had to be rewritten twice
before it caught anything — removing the auto-grow effect still left the
field tall enough to pass, because the assertion had been written as "not
zero" and a CSS floor satisfies that. The reply in the spec is long enough
to wrap now, and the assertion is that you can read all of it.

---

## v0.66.0 — The Dialogue

A conversation that happens on the page instead of turning it. Four
drawings were made (board M); M2 won, and what shipped is M2 with one
question answered that the drawings did not cover.

**What was missing:** a choice block is a door. Every option leads
somewhere, and asking a bartender three things in a row meant three scenes
that exist only to be left. Writers were making scenes as a workaround for
not having a conversation, and the Story Graph filled with nodes that
weren't places.

**Three rules, and they are the whole feature:**

1. **Said is spent.** A line said leaves the list, unless it is marked as
   one that can be asked again. This is what makes a conversation feel like
   one: the list shortens as you talk.
2. **Every line has an after** — *stay*, *end*, or *leave*. Stay is the
   default and the point. End closes the conversation where it stands.
   Leave is the old behaviour, a door, and it is the only one of the three
   that draws a wire in the Story Graph, because it is the only one that
   goes anywhere.
3. **The page waits.** Anything written below an open conversation is not
   drawn until the conversation closes. This is the rule his question was
   about — *what if the writer wants the rest of the text to render after?*
   — and the answer is that they always do, so it isn't a setting. Prose
   after a Dialogue reads as what happens once you stop talking, which is
   what a writer means by putting it there.

**A conversation is not remembered between visits, on purpose.** Leaving
the scene and coming back starts it fresh. The alternative — topics
exhausted for the rest of the story — is already available with a variable
and a condition, which is what this block is sugar for; making it the
default would mean persisting a set of line ids in the save file to buy a
behaviour half of all conversations don't want.

**Rule 3 cannot live in the block.** A block cannot decide what is drawn
after it. So it lives in the runtime — twice, because there are two
runtimes: React in the app, and plain JavaScript in the exported page,
which has no framework and no network. **That second implementation is the
honest risk in this feature,** and it's why most of the new negative
controls break the *export* rather than the app. A control that only broke
the app would have left the riskier half untested while looking thorough.

**The spec found two bugs, both of them the same bug in different
clothes** — state that survived when it shouldn't and state that died when
it shouldn't:

- *Restart left the conversation exhausted.* The reset effect was keyed on
  the scene id, and restarting a story that begins in that scene doesn't
  change the scene id. There is now a `playToken` that a restart bumps, so
  "the same scene again" and "this scene, again from the top" are
  distinguishable.
- *The exported page wiped the conversation it had just added to.* The
  reset ran inside the scene render, which in a single-page export runs on
  every click. Guarded on the scene actually having changed.

**One control came back green and that was a finding about the test.** The
sabotage aimed at "a line is an edge only if it leaves" — and nothing
asserted on the Story Graph badge, so nothing noticed. The badge now has
its own assertion (`◆ 4 in-page · 1 exit`) rather than the control being
retired, which is the third time this project has chosen that way round.

**Also:** Check Story gained two warnings — a conversation nothing can end
(the reader would be held there forever) and a line whose condition can
never be met. Script Export prints a conversation as its own third kind of
block, beside prose and choices, and says in words what happens after a
line that ends one. Every paragraph now carries a stable id, stamped in
while this schema change was open — that is what unblocks the spreadsheet
export, which is the next thing.

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
