# Auto Layout — the measurement, before anything is changed

Measured 1 Oct 2026, on The Blue Hour (32 scenes, 5 chapters, 70 choice
options with destinations) — the story he said Auto Layout "started to
shatter" on, and therefore the only honest subject. The harness is
`tests/graph-layout-quality.spec.mjs`; it moves nothing and fixes nothing.

The roadmap has carried "we will need to investigate the behaviour of the
Auto Layout further" since September with three named suspects and no
number attached to any of them. These are the numbers.

## The headline: none of the three suspects reproduces

| Suspect (roadmap wording) | Measured |
| --- | --- |
| Merges dragged far right by dagre's longest-path ranking | No escaped scene, no stacked card. Longest wire 2121 px on a 2946 px-wide story — long, but the story is wide. |
| Loops placed as if they were forward edges | **14 of 70 wires run right-to-left.** Real, countable, and not a defect on its own — a story that sends you back has to be drawn somehow. |
| A chapter box sized after its contents, overlapping its neighbour | **Zero overlaps**, both as the story stands and starting from five hand-dragged overlapping boxes. |

Also measured and clean: every one of the 32 scenes lands inside the
chapter that owns it; no two cards overlap; and the layout is **idempotent
with respect to its input** — started from a deliberately overlapping mess,
it produces the identical result to the pixel (38 crossings, 2946×1078).
Where the writer left the boxes does not decide where the button puts them.

What is left as a quality number rather than a defect: **38 crossings
across 70 wires**, total wire length 32,638 px, extent 2946×1078 (2.73:1,
which fits a screen — v0.73.0's stacked layout is doing its job).

## The performance finding, which was not on the list

| | Median |
| --- | --- |
| `computeGraphLayout` (dagre, ranking, straightening, group sizing) | **15–24 ms** |
| `autoLayoutScenes` — the button, including history, grid snap and the store write | **~20 ms** |
| `routeWires` — v0.73.0's A* wire router on the result | **91.5 ms** |

**The layout is not the expensive part. The router is, by about five
times.** It routes all 70 wires successfully, 0 failures, using all four
rip-up-and-retry passes within its 400 ms budget. The passes are not waste:
each one re-routes the worst 25% of wires by how much they run *along*
another wire, which is the distinction the whole router exists to make.
Cutting passes would make it faster by making the picture worse, and that
is a functional change.

So the optimisation is not in the router's algorithm. It is in **how often
it runs**. `FlowPanel`'s `routes` memo is keyed on `[project, edgesBase]`,
and `project` is a new object after every store write — so typing a scene
title re-routes all 70 wires. That is the same shape as the v0.51.0
finding (memos keyed on `project` while React Flow diffs by reference), one
layer further out, and it matches perf.spec's standing measurement that
collapsing the Story Graph took an edit from 80.6 ms to 33.3.

**The fix changes no output.** The routes depend on box geometry and link
endpoints; prose does not enter the calculation. Keying the memo on that
geometry means identical wires, computed when they can actually have
changed. Nothing moves, nothing is drawn differently — which is the brief.

## What the harness asserts, and what it only reports

Asserted, because they are defects at any magnitude: a scene outside its
own chapter, two chapter boxes overlapping, two cards overlapping, a wire
that outran the router's budget, and idempotence against a messy start.

Reported and explicitly not asserted, on perf.spec's precedent: every
timing, the crossing count, the wire lengths, the extent. A number with no
agreed threshold is documentation, and `check(name, true)` beside one would
be a pass dressed as an assertion.

## Two findings about the harness itself, both the same mistake

Worth recording because this file exists to look for exactly this kind of
thing and still made it twice.

1. **The first run reported three green chapter-box checks against a story
   with "0 drawn chapters".** The count read `content[].rect`, which is the
   *stored* rectangle; a folder is drawn when it has one **or when it holds
   at least one scene** (v0.31.0), with a box derived from those scenes. All
   five chapters were drawn the whole time and the checks were measuring
   nothing.
2. **The second pass, written to fix that, changed nothing** — it "drew"
   chapters that were already drawn, and reported numbers identical to the
   first pass to the pixel. The identical numbers are what caught the
   first mistake. It now gives every chapter a stored, overlapping box,
   which is the state suspect 3 needs and a state a writer actually reaches.

Both checks now state what they looked at in their own detail line — `5
drawn chapters, 32 of 32 scenes inside one` — so a vacuous pass is visible
without reading the fixture.

## Next

One session: key the route memo on geometry, measure the edit cost before
and after with perf.spec's interleaved method, negative-control it, ship it.
No node moves and no wire is drawn differently; the merges, loops and
chapter boxes stay exactly where they are, reported rather than touched.
