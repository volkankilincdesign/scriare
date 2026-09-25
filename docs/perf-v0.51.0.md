# Tier 3 — where the time actually goes (v0.51.0)

The v0.48.0 audit's tier 3, re-measured before anything was changed. The
measurement is most of what this is worth: **two of the three items it
named do not cost what it said, and the thing that does cost was not on
the list.**

## The baseline

One edit on a 300-scene story, timed store-update to paint, median of nine
runs after warm-up:

```
everything open .................... 80.6 ms
Content panel collapsed ............ 66.8 ms   panel:      13.8
+ Inspector collapsed .............. 66.5 ms   inspector:  ~0
+ Story Graph collapsed ............ 33.3 ms   graph:      50.2
```

33 ms is the FLOOR — two animation frames, which the measurement waits
for. The Story Graph was about 50 ms of an 80 ms keystroke.

## Item by item

| Audit item | Claimed | Measured |
|---|---|---|
| **#22** Inspector colour input | "window stops responding during a colour drag" | **No such control exists.** The Inspector uses the shared `BoxControls`, rAF-throttled in v0.49.0 — fixing the Choice Styles half fixed this half. `claude/audit-v0.48-outcome.md` was wrong to list it as open. |
| **#23** ContentBrowser context + unmemoized rows | ~5,000 comparisons + ~300 renders per keystroke | **Real: ~16 ms.** But the filter was not the cause — see below. |
| **#24** `ChoiceOptionView` whole-project subscription | 16 options × 300 scenes = 4,800 steps per keystroke | **−3.0 ms — noise.** Not a real cost. |
| **#17/#18** the choice walk | 24.8 ms at 300 scenes | **0.20 ms** for 300 scenes and 450 real choices. Does not reproduce. |
| *(not in the audit)* FlowPanel node and edge rebuild | — | **50.2 ms of 80.6** — the actual bottleneck. |

## What shipped

**Identity reuse for graph nodes and edges.** FlowPanel's memos are keyed
on `project` and React Flow diffs by reference, so a title edit handed it
300 new node objects and several hundred new edges. `utils/reuseBySignature.ts`
hands back the previous object when a signature built from the primitives
it draws is unchanged. On a story with 450 choices: graph 81.9 → 58.3 ms,
with the node half worth about another 11.

Group nodes are deliberately excluded: their `data` carries a callback, and
returning a cached object returns the closure captured with it.

The cache is pruned against the live id set — without it, deleting two
hundred scenes leaves two hundred node objects reachable for the session.

## What was reverted, and why

**The Content panel index.** The audit blamed each folder row filtering and
sorting the whole node list, so that was replaced with a prepared index.
The cost did not move: **16.5 ms with the index, 16.7 ms without**. The
filter was never where the time went — 300 rows re-rendering is. The index
was reverted rather than shipped as a fix for something it does not fix.

**Memoizing the context and the rows is the real fix for #23, and it is not
done.** It needs stable callbacks for roughly a dozen handlers in
ContentBrowser — a real refactor with real regression risk. **This is the
one tier-3 item still open.**

**A per-scene choice cache** was also written and reverted: the walk it
avoided costs 0.2 ms.

## Three findings about measuring

**The harness lied twice before it told the truth.** The first version
measured everything-open, then collapsed a panel and measured again.
Across runs the same build gave −7.9 ms and then +17.2 for the same
difference — ±25 ms of drift on an effect worth 14. **Alternating the two
and taking the median of paired differences** cancels drift that is slow
compared to one pair; the spread went to ±1 ms.

**A toggle that silently misses makes everything after it meaningless.**
The expand controls are titled "Expand …", not "Show …". The clicks found
nothing, returned `false` into a variable nobody checked, and every later
measurement was taken with the panel still shut — reporting a tidy 0.1 ms
for a panel that had never been reopened. `clickTitled` throws now.

**Some things cannot be guarded by a clock.** The graph resolves to about
±10 ms over three paired runs and the fixes are worth 24 and 11, so no
threshold separates them: tight enough to catch the regression is tight
enough to fire on a busy box. Two consequences:

- The timings stay as documentation and a gross-regression check, and they
  **say so out loud when the machine is too loaded to judge** — a red build
  meaning "CI was busy" teaches people to ignore red builds.
- What the fix DOES — hand back the same object when nothing changed — is
  asserted directly, in its own module, where the answer is the same on
  any machine. That is what the negative controls guard.

## Still open

- **#23's real fix**: memoize ContentBrowser's context and `ContentTreeRow`.
  Worth ~16 ms of a keystroke on a 300-scene story.
- **Tier 5**, all of it.

473 tests, 55 negative controls.
