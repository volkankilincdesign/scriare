# The Dialogue — M2, specified

Drawn as board M (four styles, live), 27 Sep 2026. M2 chosen. This records
what M2 *is*, so the board does not have to be re-read to build it.

## The premise, unchanged

An option that **adds a reply to the page instead of turning it** — Disco
Elysium / Narrat. The one thing on the list Twine structurally cannot do.

Not an engine: `ConditionalBlock` is already real and registered in the
runtime, and an option already carries `actions`, `conditions` and
`whenUnmet`. A writer can build this by hand today at the cost of one
invented variable per line. **The feature is writing those variables for
them.**

The block's own wording must say *a conversation that stays on this page*
— a scene already contains dialogue, so "where dialogue goes" is the one
phrasing that cannot be used.

## The three rules

1. **Said is spent.** A line said leaves the list, unless it is marked
   `can be said again`.
2. **Every line has an "after"**, and is exactly one of three:
   - `stay` — default; the reply appends, the conversation continues
   - `end` — the reply appends, then the conversation closes
   - `leave` — an ordinary exit; the scene turns
3. **The page waits.** Nothing below an open Dialogue is drawn until the
   conversation closes — by an `end` line, or because nothing is left to
   say. A `leave` line never closes it; it turns the page instead.

Everything else a line can do, it already does: conditions hide or lock it
exactly as on a choice today, actions change variables, and the reply can
be attributed to a different character from the line — which is how an
inner voice interrupts a conversation without costing a whole scene.

## Why rule 3 exists — measured, 27 Sep

The runtime today paints **all of a scene's segments at once**, top to
bottom (`splitDocumentIntoSegments` → PlayRuntime, and the same in the
exported page's `pageRuntime`). Prose written after a Choice Block is
already on screen before the reader has chosen anything, which is why a
Choice Block always ends up last in practice.

A Dialogue must not inherit that. Holding the page is one early exit in
each of the three renderers, and it is what turns a scene from "prose and
then a menu" into **beats**: prose, a conversation, more prose, a choice.

**This was his question** — "what if the user wants the rest of the text to
render after the dialogue in the same page?" — and the answer is that it is
the default, not an option.

## The node

A third node type beside `choiceBlock` and `conditionalBlock`. Lines reuse
the attributes an option already has, so conditions, actions, style and
speaker need no new code anywhere. New: `reply`, `replySpeaker`, `after`,
`repeatable`, `lineId`.

```json
{
  "type": "dialogueBlock",
  "attrs": { "blockId": "d1" },
  "content": [{
    "type": "dialogueLine",
    "attrs": {
      "lineId": "l4",
      "speaker": "@player",
      "reply": "Think at the table. It is warmer.",
      "replySpeaker": "e-nesrin",
      "after": "end",
      "targetSceneId": null,
      "repeatable": false,
      "conditions": [], "actions": [], "whenUnmet": "hide", "style": null
    },
    "content": [{ "type": "text", "text": "\"I have to think about it.\"" }]
  }]
}
```

**The reply is an attribute, not child content.** The one compromise: a
reply cannot carry a mention or a colour the way the line can. Making it
real inline content costs about half a session more. Ship it flat and see
whether it is missed — a reply that can be styled is also a reply you have
to select to edit.

## The Inspector

v0.65.0's grammar, unchanged: **The Line / Shown / Changes**, a heading only
once it has something under it, an unset rule stated in one grey line. The
Dialogue adds exactly one control — **After** — and a **Goes to** that
appears only when After is `leave`.

## Downstream

- **Graph** — one badge on the node, "5 in-page · 1 exit". Only `leave`
  lines draw wires. No self-loops, no silence.
- **Check Story** — from the restated rule *an option is an edge only if it
  leaves*: "this conversation cannot be left" (every line repeatable, none
  `end` or `leave`) and "this line can never be said". Reachability gets
  more accurate, because in-page lines stop counting as edges.
- **Script Export** — a third block kind beside `line` and `choices`.
  Prints as the conversation it is, with spent-ness and `after` noted in
  the margin where conditions already go.
- **Stable line IDs** — `lineId` here, and an id stamped on ordinary
  paragraphs in the same migration. This is what unblocks the spreadsheet
  export, which is why it is queued behind this.

## Not in scope

No nesting — a line cannot reveal more lines. That was M3; one level of it
can already be faked with a condition and an action today.

## Build order

1. Schema + migration (`dialogueBlock`, `dialogueLine`, `lineId` on every
   paragraph). One migration on open, the route v0.28.0's frames took.
2. The editor: node view + Inspector panel.
3. Play: runtime block, spent-set, held page. First place the feel can be
   judged.
4. The exported page: the same behaviour in plain JavaScript.
5. Graph badge, Check Story's two warnings, Script Export's third kind.

**2–3 sessions.** The risk is step 4, not step 1: the exported runtime is a
second implementation of the same rules, and its negative controls have to
break the export specifically rather than the app.

---

## Shipped as v0.66.0 — what the spec got right, and what it missed

All five build steps landed as written. 728 tests, 169 negative controls,
all caught. What is worth recording is where reality differed:

- **The badge reads `◆ 4 in-page · 1 exit`** — singular when there is one
  exit, and the diamond is there because the badge sits beside the node's
  other counts and needed something to mark it as a conversation rather
  than another tally.
- **A conversation resets when the reader leaves the scene and comes back.**
  Not decided on the board, and it had to be: the alternative is topics
  exhausted for the rest of the story, which means persisting a set of line
  ids in the save file. Since the block is sugar for a variable and a
  condition, a writer who wants permanence can still write it — the
  default should be the behaviour most conversations want, which is that a
  conversation is a thing that happens now.
- **Nothing left to say closes the conversation during render, not in an
  effect.** An effect would let the page below flash in a frame late. So
  the same pass that discovers there is nothing left is the pass that lets
  the rest of the scene through.
- **Rule 3 lives in the runtime, not the block.** A block cannot decide
  what is drawn after it. That means the rule exists twice — React and the
  export's plain JavaScript — which is what the design doc predicted as the
  risk, and it was right: both bugs the spec found were about *when* state
  is reset, and one of them existed only in the export.
  - Restart left the conversation exhausted: the reset was keyed on the
    scene id, which does not change when you restart a story that begins in
    that scene. There is a `playToken` now.
  - The exported page wiped the conversation it had just added to: the
    reset ran inside the scene render, which in a single-page export runs
    on every click.
- **One control came back green**, aimed at *a line is an edge only if it
  leaves* — because nothing asserted on the graph badge. The assertion was
  written rather than the control retired.
- **The flat reply held.** No mention or colour inside a reply, and nothing
  about building the block made it feel missed yet. Still the thing to
  watch first if a writer complains.
