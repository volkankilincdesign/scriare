# The project file — `.scriare`

Decided 20 Sep 2026. Volkan's call after arguing the case for a shorter
`.scri`.

## What it is

A Scriare project is one JSON document. That does not change: the extension
is about what the file ANNOUNCES itself to be, not about the format.

- **Was:** `My Story.json`, saved wherever the writer picked, with the New
  Project dialog defaulting to the root of Documents.
- **Is:** `My Story.scriare` — same JSON inside.

## Why not `.scri`

He proposed it (shorter, tidier in a file list) and asked to be argued with.
Two neighbours decided it:

- **[Scrivener](https://fileinfo.com/extension/scriv) uses `.scriv`**, and
  `.scrivx` for the project file inside its bundle. Scrivener is the tool
  this audience is most likely to have used, so `.scri` reads as a typo of
  it or as an imitation of it. That is a bad first thought to provoke about
  a new format.
- **`.scr` on Windows is a screensaver executable**, an old malware vector
  that some mail filters and IT policies still treat with suspicion. One
  dropped keystroke away.

`.scriare` is also googleable: someone who receives a demo file and searches
"what is a .scriare file" lands on his site. Length is close to free, since
nobody types an extension — the writer names the file and the app appends
the rest.

Recorded honestly: if `story.scriare` looks heavy in Explorer after a week
of using it, changing it again costs almost nothing while he is still the
only user in the world.

## What the change involves

Small, and best done alongside Export, where all the file-type questions
live:

1. The save and open dialogs' filters (`project:create`, `project:open`,
   `project:saveCopy` in `src/main/ipc/projectHandlers.ts`).
2. **Keep `.json` openable.** Every project that exists today — including
   `other_materials/what-the-ledger-says.json` — is a `.json`, and none of
   them should break. The open filter lists both; only the save filter
   prefers `.scriare`.
3. Default the New Project dialog to `Documents\Scriare\`, created on first
   save, rather than the root of Documents.
4. The backup convention follows the project file: `My Story.scriare.bak`.
5. Later, in the installer: register the extension so double-clicking a
   story opens it, and handle the file path Windows passes in `argv` (and
   `open-file` on macOS) so that actually works.

## Why it matters before the demo story

The demo story is 30–40 scenes he is about to write. Whatever extension it
is saved with is the one that appears in the video, in the case-study
screenshots, and in whatever he hands people to try.
