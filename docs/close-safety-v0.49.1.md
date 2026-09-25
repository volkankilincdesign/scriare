# Closing the window — what v0.49.0 got wrong, and how it was found

v0.49.0 was a release about data loss. Two data-loss bugs shipped inside
its fixes. Neither was caught by the suite; both were found by reading the
diff back cold, afterwards, and then measuring what the code actually did.

This file exists because the *way* they were found is the reusable part.

## 1. The flush that did not flush

`closeProject` gained `await get().saveNow()`. That reads like a flush.
`saveNow` opens with:

```js
if (saveInFlight) { saveQueued = true; return; }
```

which returns an **already-resolved promise having written nothing**. So
the await waited for nothing. `closeProject` then cleared `saveQueued` —
the flag that call had just set — and nulled `filePath`. The real save
landed afterwards, saw `get().filePath !== filePath`, and dropped the queue
as well.

Measured against a real file on disk:

```
save V2 starts (not awaited)   ← the autosave already on its way
type V3                         ← status: "unsaved"
closeProject()
  on disk: V2        (expected V3)
  store says: "saved"
```

The window is ordinary. Autosave fires 1.5s after a change, a write to a
synced folder is not instant, and typing during that second is typing.

**Fix.** `saveRun` holds the promise of the save on its way *including* the
re-run it queues, and the early branch returns it. `await saveNow()` now
means "the disk is current" — what closing, quitting and Ctrl+S all assumed
it meant, and what nothing had guaranteed.

It is settled in an outer `finally`, because two early returns inside the
body would otherwise leave every awaiting caller hanging forever — a worse
failure than the one being fixed.

## 2. Four seconds to answer a question

The main process destroyed the window 4s after asking the renderer to get
ready. That clock raced two things it had no business racing:

- **The one question the app asks.** "Close without saving?" is about an
  hour of work and resolves when the writer clicks. Reading it carefully
  was the failure mode.
- **A slow legitimate flush.** v0.47.0 added EPERM/EBUSY retries precisely
  because sync clients and scanners hold files open.

**Fix.** The timer is a liveness check. The renderer pulses once a second
while handling the close; each pulse restarts the timer. It now measures
what it was always for — a renderer that has stopped responding cannot make
the window unclosable — and a renderer that is busy, or waiting on a
person, is not that. Listeners are removed by name rather than left
registered when the timer wins the race.

One consequence worth knowing: an unanswered question pulses indefinitely,
so the window stays open until someone answers. That is right for a person
and fatal for an unattended harness — any test that opens the question must
answer it.

## Why the suite missed both

v0.49.0 added a regression test per fix. **Tests written alongside a fix
test the shape the fix has, not the shape the bug had.** Its save tests
exercised the *stamp* during a save in flight and never the *close*.

The general rule this supports: a diff read back cold, by someone asking
"what does this line actually do", finds a class of thing that tests
written from the same understanding cannot.

## Three findings about the tests

- **A control that passed.** The sabotage moved `closeProject`'s flag reset
  above the flush; `saveNow` sets the flag itself a line later, so it
  changed nothing. That means the ordering was never the mechanism —
  `saveRun` is. The control was removed and the comment claiming otherwise
  was corrected. A passing control is a finding about the test, and
  sometimes about a comment.
- **A fixture that spread `null`.** The new close spec closed a project and
  then built the next one from `{ ...store.getState().project }` — which is
  `null` by then. The store held a project with no scenes. The checks still
  passed, because saving nonsense is still saving, while the app rendered
  over something that could not exist.
- **What that fixture actually broke.** It made the heartbeat half of the
  spec unreachable — zero beats, correct-looking state, no error — and then
  broke every spec that ran after it, since specs share one application.
  **A spec that leaves the app in a bad state does not fail. The next one
  does, somewhere else, for reasons that look nothing like it.** Worth a
  habit: a spec that mutates global app state hands it back seeded.

## Where this is tested

- `tests/close-safety.spec.mjs` — the flush, against real files.
- `tests/close-heartbeat.spec.mjs` — the pulse, counted in the main
  process while the renderer sits on an open question past the old
  four-second deadline. Its own file: different process boundary,
  different setup.
- Five negative controls across the two, all confirmed to turn the right
  check red.

449 tests, 39 negative controls.
