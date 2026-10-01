# Save safety — built in v0.47.0

Decided 17 Sep 2026, built 18 Sep. Came out of the Android/cloud
exploration: the only genuine defect that conversation turned up was in how
the app writes its own project file.

## The defect, reproduced before anything was changed

`project:save` was one line — `fs.writeFile(filePath, json)` — which opens
the real file, TRUNCATES it, then writes. Demonstrated on a 400KB tmpfs:

```
before:  16719 bytes, parses: true
write failed: ENOSPC
after:  409600 bytes, parses: false
```

A 16KB story became 400KB of half-written JSON and the last good version was
already gone. A second demonstration, on any filesystem: while a plain write
is in flight, four of five reads from another process see a file that does
not parse — which is what a sync client, a backup tool or a second window
sees at the wrong moment.

## What shipped

- **Replace, never write into.** Temp file beside the project, fsync, rename
  over the target. Atomic within a directory; a failure at any earlier step
  leaves the old file untouched.
- **Keep the previous version** as `<project>.bak`, on a five-minute cadence
  rather than per save — autosave fires 1.5s after every change, and a
  backup from 1.5 seconds ago is the same mistake you just made. Overwriting
  a conflict always backs up, whatever the cadence says.
- **Never overwrite a file that changed underneath us.** The app carries the
  mtime+size it opened; a mismatch raises a dialog (reload / save a copy /
  overwrite) and writes nothing. The dialog cannot be dismissed, because
  dismissing would leave someone typing into a document that cannot save.

## Three defects found while reviewing the work, not in the plan

Worth recording, because they are the case-study material:

1. **Two saves could run at once** — Ctrl+S during an autosave. They
   generated the same temp filename (same pid, same millisecond), so one
   rename took the file and the other died with ENOENT: the save the writer
   asked for was the one that lost. Temp names are now unique per write, and
   saves are serialised with a single queued re-run. The same race could also
   land the older save last and silently restore a cut chapter.
2. **A failed save said nothing** — the status stopped at "Saving…" forever.
   It now names the cause ("there is no room left on the disk") and says the
   work is still open and the last saved version intact. Once, not once per
   autosave.
3. The fallback file size counted characters, not bytes — wrong the moment a
   story contains one Turkish character.

## Three assertions that passed against the bug they were written for

The rule that a passing negative control is a finding about the TEST earned
its keep three times here:

- "A save in flight never shows a half-written project" passed on the old
  build: what it measured was how long the JSON takes to cross the IPC
  bridge, not the write. Replaced by two things that cannot race — a temp
  file appears, and the project's inode changes.
- "Saving again while the question stands changes nothing" passed with the
  guard removed, because the main process refuses the write either way.
  Replaced by reading `saveStatus` in the same javascript turn as the call.
- "Two saves at once do not fight" passed in three different framings before
  one worked: counting temp files that exist AT THE SAME MOMENT.

28 checks in `tests/save-safety.spec.mjs`, each confirmed to fail with the
old behaviour put back.

## Crash-recovery drafts: measured in v0.86.0, and declined

This section used to read: *"Crash-recovery drafts (an autosave journal in
app data, restored on next launch). Still post-launch; only worth it if
something is ever lost to a power cut that the atomic write could not
catch."* That is a condition, and v0.86.0 finally measured it.

| | Measured |
| --- | --- |
| An ordinary edit, keystroke → on disk | **1.53 s** |
| A save the filesystem refuses | says so once, names the cause, keeps the work, leaves the last good file intact |
| The folder comes back | heals on the next keystroke, **1.4 s** |
| A conflict standing unanswered | status stays "unsaved", dialog focus-trapped |

**A journal would have insured a window a second and a half wide**, and for
the commonest cause — a full disk — it could not have been written either,
being on the same disk. Against that: a second copy of the file format, and
a restore dialog a newcomer meets at the worst possible moment. Declined,
and recorded here rather than dropped quietly.

The harness is `tests/crash-exposure.spec.mjs`. It reports the numbers on
every run and asserts only what would be a defect whatever the answer.

## The hole that measurement found, fixed in v0.86.0

**Closing a project after a failed save cleared it without asking**, while
the notice still on screen read "Your work is still open, and the last saved
version is intact". The second half stayed true; the first half became a lie
at the moment the project closed. Four edits into a folder that had gone
away, all four gone, no crash involved.

**The old behaviour was a decision rather than an oversight**, which changed
what the fix should be. `useCloseGuard` recorded it: "a failed save is not a
reason to trap the writer in a window they asked to close." That is right
about the window — quitting is theirs to do, and a modal that refuses is a
trap. It was then applied to closing a project, where nobody is trapped. The
rule was sound; its reach was wrong. And "do not trap them" had been read as
"say nothing", when a question whose every answer is an exit traps no one.

Shipped: one question, three answers, modelled on the conflict dialog
because it is the same question — *Save it somewhere else* / *Keep writing* /
*Close without saving*, no dismiss. The escape route already existed as
`resolveConflictSaveCopy` and refused to run unless a conflict was set; it is
`saveCopyElsewhere` now and returns whether anything was written, because a
cancelled file picker is not a decision to lose work.

**The guard lives in `closeProject`, not beside the close button.** It was
written at the call site first and a test that called the action directly
walked past it — as does `useOpenFromDisk`, which closes the current story to
open another. Two of three callers would have inherited the hole.

### Three mistakes in the measurement, each worth keeping

1. The first failure injection reassigned `window.api.project.save` to throw,
   measured "0 save attempts", and reported the app as never retrying.
   `contextBridge.exposeInMainWorld` hands the page a **frozen** object: the
   assignment did nothing and every save succeeded.
2. The second made the folder read-only with `chmod 0o500`, and the saves went
   through anyway — the suite runs as **root**, which bypasses permission
   bits. A fact about the container, not the app.
3. And one in the fix itself: the new `saveFailed` flag was set before being
   read, so "already told them" was always true and the app's most important
   notice would never have appeared once. It has its own control.
