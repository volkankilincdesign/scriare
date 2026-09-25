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

## Deliberately not done

Crash-recovery drafts (an autosave journal in app data, restored on next
launch). Still post-launch; only worth it if something is ever lost to a
power cut that the atomic write could not catch.
