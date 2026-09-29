# The Story Graph's wires (v0.73.0)

## What was reported

> B, but truth to be told is about multiple outings mostly, they overlap too
> much and it is almost impossible to read which node is connected to which.

Then, on the first proposal — which moved the cards:

> I am not sure if this change is clear enough, can we have a cleaner method?

Then, on the second — which stacked the chapters:

> Seems quite good but with a twist: […] it is logically true, the vertical
> stack and top alignment. But it is not pleasing to look at, and it is
> still confusing in some exits and entrances.

Three reports, and each one turned out to be pointing at something
measurable rather than at a matter of taste. That is the shape of this whole
release: every time it sounded like an aesthetic complaint, there was a
number underneath it.

## What was measured

On The Blue Hour — 32 scenes, 72 connections, in five chapters — as the app
drew it before this release:

| | before |
| --- | --- |
| pairs of wires leaving the same pixel | 66 |
| pairs arriving at the same pixel | 104 |
| wires crossing a card they have nothing to do with | 60 |
| pairs running shoulder to shoulder | 63 (8,610px of wire) |
| crossings | 92, of which **67 shallow** |
| shape | 7,352 × 314 — **23.4 : 1** |

The last two rows are the ones that matter most and are easiest to
misread. A *crossing* is not the problem: two lines meeting at a right angle
make an unmistakable plus, and you can follow both. A *shallow* crossing —
two lines grazing at fifteen degrees — is a shape the eye has to guess at,
and a guess is what "impossible to read which node is connected to which" is
made of. Sixty-seven of ninety-two were that kind.

And 23.4 : 1 is not a layout, it is a ribbon. A story that long and that thin
cannot be seen at once at any zoom that lets you read a card, so it has no
shape at all.

## The four changes

### 1. One anchor per choice, on the side it is going to

Every exit used to leave from the middle of the card's right edge and every
arrival landed in the middle of its left edge. Four choices out of one scene
were therefore, for their first stretch, *the same line* — and no routing is
clever enough to separate two lines that start at the same place.

Each choice now gets its own slot, in the order it sits on the page, on
whichever side the wire is actually heading for. `sideFor` picks the side by
the widest clear gap between the two cards, with ties falling to `right`
then `bottom`, so a story that could be read either way is read the way
stories are read.

Slots are measured outward from the card's centre on the canvas's own 18px
dot pitch rather than spread at even fractions of the edge. The reason is
narrower than the first version of this document claimed: **both schemes give
an odd count the centre line** — that claim was wrong and the negative
control for it is what said so. What actually differs is that a fixed pitch
makes the spacing a constant of the design instead of a function of how many
choices a scene happens to have, so two neighbouring scenes hand their wires
out on the same rhythm.

### 2. A chapter runs down the page

Everything ran left to right at every level. Now the scenes inside a chapter
run top to bottom and the chapters themselves stand side by side with their
tops aligned, like columns of a page — which is a thing a reader already has
a model for, because it is what a chapter is.

The tops only align when *every* root member is a chapter. A loose scene at
the top level is a step in a flow and its rank is telling the truth about
where it belongs.

Gaps for the stack are not the sideways pair with the names swapped. Running
down, the gap between one scene and the next is where a wire turns, and 36px
is not enough room to turn in — a router with no lane to change into puts the
wire through the card. Five cells gives it somewhere to go.

### 3. The straightening pass learned the other axis

`straightenRuns` has pulled a scene onto its feeders' line since v0.43.0 —
on the vertical axis, because until now there was only one direction to pull
on. Nobody had taught the function the general rule, only the single case
that existed.

Stacked, the axis across the flow is the horizontal one. Left alone, a spine
that comes out as one clean line sideways comes out as a staircase sliding
downhill, and **that is most of what "logically true but not pleasing"
was.** It read as an aesthetic objection and it was a missing generalisation.

### 4. The canvas is a place with things in it

This is the part that was asked for directly:

> How about we also calculate if there is a Node and/or a Connection in the
> path? If there is a node, the connection might want to find another way.
> If there is a Connection, it offsets itself like couple of pixels in order
> to not to overlap, like all the connections and nodes are sitting
> physically in the same canvas like objects.

That is the right model, and it is what a PCB autorouter does — which is
also why the result looks like a board. Three amendments were needed before
building it:

- **A crossing is not an overlap.** Priced the same, a router ties itself in
  knots buying something the reader never wanted. Crossing costs 14; running
  along another wire costs six times empty canvas per pixel; a card costs
  infinity.
- **"A couple of pixels" is too little.** Two 1.4px lines 3px apart read as
  one smudged thick line, which is worse than an honest overlap because it
  looks like a rendering fault. The offset is a whole lane — 18px, the grid
  the cards already snap to.
- **It stops being first-fit and becomes a cost search.** A* over a lane
  grid whose lines are the card edges, a margin outside them, every anchor,
  and fill lines a cell apart across any gap wide enough to hold them.

Then rip-up-and-retry, because this is order-dependent and one pass cannot
fix that: the wire routed first takes the good track and can force a later
one into a detour that makes no sense to look at. Everything is routed, the
worst quarter torn out and routed again with the rest of the picture in
place, under a hard time budget — Auto Layout is one button press with an
undo behind it and has to feel instant rather than converge beautifully.

## The result

| | before | after |
| --- | --- | --- |
| leaving / arriving at the same pixel | 66 / 104 | **0 / 0** |
| crossing a card it doesn't touch | 60 | **0** |
| running shoulder to shoulder | 63 pairs | **2 pairs (82px)** |
| crossings | 92 (67 shallow) | 52 — **0 shallow** |
| shape | 23.4 : 1 | **2.7 : 1** |
| routing time | — | **~110ms** |

"Zero shallow crossings" is not a number that came out well. Every segment
is axis-aligned, so every crossing is exactly ninety degrees: two parallel
lines that read as one line are not *reduced* here, they are impossible.

## What this does not do

It does not scale, and the limit is in the code rather than in a comment.
Measured on generated stories with a plausible branch shape:

| scenes | wires | grid | total |
| --- | --- | --- | --- |
| 32 | 67 | 77×60 | 95ms |
| 100 | 230 | 241×94 | 355ms |
| 250 | 595 | 340×171 | 589ms |
| 500 | 1,196 | 546×221 | **4.1s** |
| 1,000 | 2,431 | 1,350×364 | **39s** |

The grid grows on both axes at once, and the per-wire search window stops
helping once a single chapter is bigger than the window. Past 300 boxes a
cheap one-turn router runs instead — first-fit, no search, no rip-up, and
still obstacle-checked.

Other things that will bite, stated now rather than discovered later:

- **Unroutable wires degrade to a curve.** That is the right fallback — the
  old drawing for that one connection, not a missing one and not a lie — but
  it is silent, and on a very large story enough of them would read as a
  rendering fault rather than as a graceful degradation.
- **Instability under editing.** Move one card and the rip-up pass may
  re-route wires that did not need it. A layout that reshuffles when you
  nudge something is worse than a slightly worse layout that holds still.
  Nothing here solves that.
- **Still order-dependent.** Rip-up narrows it; it does not remove it. Two
  runs on the same story agree, but a small edit can give a noticeably
  different picture.
- **The heuristic is 15% greedy,** so routes are not provably cheapest. In
  practice the difference is a wire one lane over; it bought roughly half
  the search.

The obvious next move, unmeasured and therefore not claimed: route each
chapter against its own local grid and only the cross-chapter hand-offs
against the global one, so cost grows with the biggest chapter rather than
with the whole story.

## Where it lives

| file | what it owns |
| --- | --- |
| `utils/wireAnchors.ts` | which side a wire leaves by, and which slot |
| `utils/wireRouter.ts` | the lane grid, the A\* search, rip-up, the cheap fallback |
| `utils/autoLayout.ts` | `rankdir`, and straightening on whichever axis is across the flow |
| `utils/autoLayoutGraph.ts` | chapters run down, chapters line up along the top |
| `components/graph/RoutedEdge.tsx` | draws the routed path — or a bezier while a scene is dragged |
| `components/graph/FlowPanel.tsx` | runs the router once per committed edit; dim-on-select |

Routing is keyed on the *committed* geometry and deliberately not on the
drag overlays beside it: a tenth of a second is nothing once per edit and
impossible sixty times a second.

**v0.73.1 — what a drag gets instead.** The first release concluded from
that "no router during a drag", and a scene's wires fell back to the bezier
until you let go. Reported within the hour, and rightly: watching four
connections turn back into curves the moment you pick a card up says the
lines were a decoration rather than what a connection is. The right
conclusion was "the *cheap* router during a drag" — one turn, first free
lane, still refusing to cross a card, and only for the wires whose ends
moved. Everything else keeps the path it already had, because dragging one
scene has never been a reason to redraw the other sixty. Measured at
**0.28ms a frame**.

One wire in that path is drawn without checking what is under it: the
mid-drag fallback for a wire the cheap router cannot place. It is the only
such line in the file and it is narrow — mid-drag the cards are being
pulled over each other on purpose, so "no legal route" is common and says
nothing about an arrangement anybody will keep. Nothing from it is ever
saved or shown at rest.

The check asserts that the wire's start point **moved with the card**,
rather than that it is not a curve: a stale path is a straight line too,
and just as wrong.

## The two controls that failed first

Both were findings about the control rather than about the app, which is the
usual outcome and the reason the controls exist.

**"Slots spread at even fractions" stayed green.** The assertion it was
aimed at — that the middle slot sits on the card's centre line — is true of
*both* schemes, because an odd count owns the centre either way. The comment
in the source claimed otherwise and the comment is what got rewritten; the
check now asserts the property that is actually real, that spacing is a
constant rather than a function of the choice count.

**"The straightening pass aimed at the wrong axis" reported nothing caught.**
Aiming it at the flow axis *collapsed* the chapter — every scene landed on
one line, on top of each other — so what went red was the ordering check
rather than the column one. The control had found a worse bug than the one
it was looking for and reported a failure. It now switches the pass off for
the stack instead, which is the failure the column check actually exists
for: a spine that slides downhill, in the right order, one card at a time.
