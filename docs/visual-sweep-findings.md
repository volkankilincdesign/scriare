# The visual sweep — findings, 1 Oct 2026

My half of the sweep, taken from the shipped build at v0.86.0 with **The
Blue Hour loaded** (32 scenes, 5 chapters, 70 choices) rather than a
stand-in. The screens are on their own page; this is the list.

**Seven findings: two bugs, four decisions, one fact about the story.**

---

## Bugs — fixed in v0.87.0

### 1. Fold every chapter and the graph goes blank

The folded blocks exist; the camera does not move to them. Measured from the
DOM, not from the picture:

```
open   : 37 nodes · 32 scenes · 70 edges · 5 groups
folded :  5 nodes ·  0 scenes · 11 edges · 5 collapsed
on screen after folding: 0 of 5
```

A writer folds a story to see its shape and gets an empty canvas. The shot
the roadmap plans for the video — four chapter boxes, then one unfolds —
could not be taken without hunting with the fit-view button first.

**Fixed with a deliberately narrow rule**, for `straightenRuns`' reason: the
camera re-frames ONLY when the fold left nothing visible, so folding a
chapter you are looking at moves nothing. A camera that re-framed on every
fold would be a worse fault than the one being fixed, because it would
happen constantly instead of occasionally.

Two things the controls taught while fixing it. The first version used
`requestAnimationFrame` and changed nothing: React Flow replaces the node
set and then measures it, and a frame callback runs **before** that
measuring pass, so it re-frames the nodes being replaced. And the comment
first claimed the 120ms timer was necessary — a control proved otherwise by
refusing to go red at `0`, so the number is slack and the mechanism is being
a task rather than a frame. The control now points at the mechanism.

### 2. The screenshot tool was photographing a story that did not exist

`tools/shots.mjs` built its own three-scene fixture, also called The Blue
Hour, while the real one sat in `tests/fixtures` where the script-export
spec has loaded it since v0.64.0. Every screen in the previous set was a
picture of a story with two wires in it.

It also inserted an empty Choice, Dialogue and Conditional into whatever
scene was open, so the first Play Mode shot showed the opening page with a
fourth, blank option under the three he wrote — **a defect that existed only
in the photograph**. Both fixed; the tool now loads the real story, falls
back to the stub only if that file moves, injects nothing into a story that
already has blocks, and photographs the Story Graph, which it never did.

---

## Decisions — Volkan's, and open

### 3. The Story Graph's default height

Thirty-two cards fit to width are slivers with no readable title, and the
minimap is as visually heavy as the map. This is the first thing a stranger
sees in the video. **The question: should the graph open taller when a story
has more than a handful of scenes, and by how much?**

### 4. The block buttons invert on light themes

Choice / Dialogue / Conditional are the quietest controls in the toolbar on
the dark themes and the heaviest on Light — a dark fill on a pale ground.
Token-correct, and it looks wrong to me. **The question: one weight across
all eight themes, or is a louder insert control right on a pale ground?**

### 5. The variable readout in Play Mode

It proves the conditions are real, and it tells a stranger this is a tool
rather than a story. **The question: on or off for the video?**

### 6. The theme a stranger lands on

Still unmade, and it is a design decision nobody has made on purpose. One
vote from me, which is worth exactly one vote: **Daylight, not Dark** — the
prose sits best on it of the three light themes photographed.

---

## Neither — a fact about the demo story

### 7. The story uses no Dialogue blocks

28 scenes with a Choice, 12 with a Conditional, **0 with a Dialogue**.
Nothing is broken. But that is the block the roadmap calls the one thing
Twine structurally cannot do, it took several versions to build, and the
demo story currently does not demonstrate it — so the video would have to
invent a scene to show it.

---

## A number, not a finding

The editor toolbar is **81px from 1280px wide upward and 113px at 1152 and
below** — a third row taken out of the writing area on a small laptop. Two
rows is the design. v0.33.1 reported an extra row as a bug once, which is
why it is worth a number rather than a shrug, but I do not think it is
wrong.

```
1680 → 81px   1440 → 81px   1366 → 81px
1280 → 81px   1152 → 113px  1024 → 113px
```

---

## Standing note

Both bugs were found by **looking at a picture**, not by a test — the second
time that has happened on the Story Graph. 1108 tests were green over the
folded-graph defect. A test asserts what somebody thought to assert; a
screenshot shows what is there. The looking pass keeps earning its place.
