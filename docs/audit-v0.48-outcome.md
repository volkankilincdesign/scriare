# What v0.49.0 did with the audit

Companion to `claude/audit-v0.48.md`, which is the findings record and is
left exactly as it was written — a report that gets edited after the fact
stops being evidence. This is what was taken, what was left, and why.

## Scope

Scope chosen: **tiers 1 and 2 in full**, plus the four tier-3 items whose
fix was a pure memoisation change. Tiers 4 and 5 were deliberately not
taken — they are visible-but-small, accessibility, and dead code, and
mixing them into a release about data loss would have made the diff
unreviewable.

### Taken (all six tier 1, all ten tier 2)

| # | Fix |
|---|---|
| 1 | `utils/loadDocument.ts` — a scene swap replaces the whole `EditorState` instead of dispatching a transaction, so there is no history to rebase |
| 2 | The load effect is keyed on `` `${documentToken}:${scene.id}` ``; `documentToken` moves on every new, open, close and conflict reload |
| 3 | `BACKUP_SLOTS = 3`, `.bak.1` newest, `rotateBackups()` renames downward before copying |
| 4 | `mergeLiveProse` merges `entities[].content` as well as `scenes` |
| 5 | Main-process `close` handshake (`app:before-close` / `app:ready-to-close`, 4 s timeout) + `hooks/useCloseGuard.ts`; `closeProject` is async and flushes; `saveNow` checks `get().filePath !== filePath` after the await |
| 6, 16 | `asWebPage()` in `exportHandlers.ts` strips a project extension rather than honouring it; `KNOWN_PROJECT_EXTENSIONS` membership replaces `extname === ""` in `projectHandlers.ts` |
| 7 | `foldRun` (no trim) split from `fold` (trims ends); `foldWithMap` uses `foldRun` |
| 8 | `LEAF_TYPES` set in `findInStory.ts`, measured as size 1 |
| 9 | `Boolean(n.rect)` dropped from `hiddenSceneIds` and `visibleStandIn` |
| 10 | `hasVisibleText` checked **before** `run.line(speaker)` |
| 11 | `Modal` counts open dialogs; `aDialogIsOpen()` gates all four keyboard hooks and `ContentBrowser` |
| 12 | Covered by #5's `saveNow` guard; `saveInFlight`/`saveQueued`/`lastSaveFailed` reset on close |
| 13 | `ToastHost` `z-50` → `z-[110]` |
| 14 | `isMissingFile()` / `reportOpenFailure()`; `openProject` try/catches both the IPC and `normalizeProject`; Recent is pruned only on a genuine ENOENT |
| 15 | `selectedEntityId: null` at the five actions that set `selectedSceneId` |

### Taken from tier 3 (17–21, partly)

17, 18 and 20 collapse into one memo over `project` that yields both
`choiceCountByScene` and `edgesBase`, with `contentIndex(project.content)`
hoisted and `visibleStandIn` taking the index as a parameter. 19 is three
separate `useStore` selectors. 21 reuses a `groupsNow` memo. 22 is
`useRafThrottledPatch` in `ChoiceStylesDialog` — the Inspector's colour
control was left, since it is the same pipeline and belongs with 23–24.

### NOT taken — still open

- **Tier 3**: only 23's real fix remains — memoizing ContentBrowser's
  context and `ContentTreeRow`, worth about 16 ms of a keystroke on a
  300-scene story. **Corrected in v0.51.0 by measurement:** 22 was already
  fixed in v0.49.0 (the Inspector has no colour input of its own; it uses
  the shared `BoxControls`, which was throttled then), and 24 costs
  −3.0 ms, which is noise. See `claude/perf-v0.51.0.md`.
- **Tier 4**: keyboard reachability of Content Browser disclosure and
  entity rows; `focus:outline-none` out-specifying the global ring;
  `Modal` without `role="dialog"`, `aria-modal`, focus trap or restore;
  section-header label drift; extending `themes.spec.mjs`'s palette walk
  to the eleven unwalked surfaces. *(The three cosmetic items —
  `ChoiceBlockView`'s `--overlay`, `StoryCheckDialog`'s empty grid tracks,
  `TopBar`'s untruncated name, `ExportDialog`'s stale success screen,
  Escape in the suggestion menus — WERE taken, as they are one-line
  changes with no accessibility surface.)*
- **Tier 5**: all of it. Dead `stripChoiceBlocks`, duplicated snapping,
  the four `26` constants, `CHOICE_OPTION_TYPE` defined twice, the false
  comments, `isDescendant` cycle guard, `regenerateChoiceIds` and
  conditional blocks, `countWords` on unresolved mentions.
- **Reported but not confirmed**: unchanged. The security items and the
  missing directory fsync remain as written.

### Test debt this round exposed

441 checks now, and 34 negative controls. Three of the new controls did
not turn anything red on the first run, and all three were the test's
fault:

- one sabotage was a **no-op** — it inserted a comment above the fixed
  line instead of removing it, so nothing changed and nothing failed;
- the export-backup assertion still looked for the v0.48.0 single `.bak`
  name, which the rotation **never writes under any circumstances**, so it
  passed whether the export took a backup or not;
- the rotation spec read `.bak.2` with a bare `readFile`, so when the
  control removed the rotation the spec **threw** rather than failing.

The runner also now has a pre-flight that checks, before it sabotages
anything, that no earlier interrupted run left a sabotage in the shipped
source — which had happened during this round (a SIGKILL mid-control left
`return current - operand` in `pageRuntime.ts`) and which nothing would
otherwise have caught.
