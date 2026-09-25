# Whole-app audit, after v0.48.0

Asked 21 Sep 2026: *"investigate the WHOLE APP… bugs, inconsistencies and
everything that can be optimized. Do not change any functionality."*

Five parallel read-only audits — render cost, state and effects, main
process and persistence, UI/theme/accessibility, pure logic and dead code —
over 108 files and ~20,000 lines. **Everything in the Confirmed sections
below was reproduced by measurement against the running app or a real
`writeProjectFile` call**, not inferred from reading. Anything that could
not be reproduced is in "Reported but not confirmed" at the end.

The headline: the suite is 411 checks and green, and none of these six
data-loss bugs had a test. Four of them are in code written *after* the
feature the test suite covers most heavily.

---

## Tier 1 — Confirmed, and they lose the writer's work

### 1. Ctrl+Z after changing scenes overwrites the open scene with the previous one's text

`src/renderer/src/components/editor/SceneEditor.tsx:189-197` (and
`EntityEditor.tsx:91-97`)

The scene swap is `editor.commands.setContent(...)`. Tiptap's `setContent`
sets `preventUpdate` but **not** `addToHistory: false`, and StarterKit's
History plugin is enabled — so replacing the whole document on a scene
switch becomes an ordinary undoable step. Undoing it restores the *previous
scene's* document into the *current scene's* editor, and that undo is a
normal `docChanged` transaction, so `onUpdate` fires and persists it.

**Measured, with no typing at all:**

```
open scene one, switch to scene three, press Ctrl+Z
  scene three before : "three"
  editor.can().undo(): true        ← should be false on arrival
  scene three after  : "one"       ← scene one's text, written to scene three
```

Autosave commits it 1.5 s later. The app's own undo cannot repair it:
`mergeLiveProse` deliberately keeps live prose over snapshot prose, so a
project-level Ctrl+Z preserves the corruption.

There is a worse variant. If the editor was constructed while nothing was
open (reachable: open a Character page, delete that character — both
selection ids become null), the first `setContent` is "empty → scene", so
undoing writes an **empty document** into the scene.

**This is the worst bug in the app.** Every writer who has pressed Ctrl+Z
after changing scenes has hit it.

### 2. "Open the version on disk" does not reload the editor

`projectStore.ts:1679-1698` with `SceneEditor.tsx:189-197`

`resolveConflictReload` swaps `project` wholesale, but SceneEditor's load
effect is guarded by `if (lastLoadedSceneId.current === scene.id) return;`.
After a reload the scene id is usually unchanged, so the guard
short-circuits and ProseMirror keeps displaying the text the writer just
chose to discard.

**Measured:**

```
store says       : "DISK-VERSION"
editor shows     : "SESSION-TEXT-TO-DISCARD"     ← split brain
then type one character:
store now says   : "SESSION-TEXT-TO-DISCARDx"    ← disk version destroyed
```

`fileStamp` is valid by then, so no second conflict stops it. The whole
point of v0.47.0's conflict question is defeated by the one answer that
means "keep the other machine's work".

### 3. The conflict backup destroys itself five minutes later

`src/main/projectFile.ts:187-203`, cadence at `:89-90`

`forceBackup: true` exists so that "overwrite it with my version" keeps
what it destroys — the comment says "what they might want back in ten
minutes." But it writes to the same `<project>.bak` the routine 5-minute
cadence uses, **and sets `lastBackupAt`**. Exactly `BACKUP_EVERY_MS` later,
an ordinary autosave — triggered by nothing but continued typing — copies
the writer's own file over it.

**Measured against the real `writeProjectFile`:**

```
after overwrite, .bak = {"v":"OTHER-MACHINE-WORK"}
routine autosave 6 min later: backedUp = true
.bak now              = {"v":"MINE-v1"}
the other machine's work is: GONE
```

The one undo of last resort deletes itself on a timer.

### 4. Structural undo silently reverts Character and Location page prose

`src/renderer/src/state/history.ts:232-247`

`mergeLiveProse` exists precisely to stop a structural undo rolling back
prose written since the snapshot — but it only carries `snapshot.scenes`
forward. `project.entities[].content` is not merged, and
`updateEntityContent` takes no snapshot of its own, so entity prose has no
protection on either side.

**Measured:**

```
create a scene (takes a snapshot), then write a character page, then undo
  before undo: "THREE NEW PARAGRAPHS"
  after  undo: "OLD"
```

Nothing on screen says so — the undo label only ever mentioned the scene.

### 5. Closing the project throws away a pending autosave, and the status bar can be lying when you do it

`projectStore.ts:1759-1773`; `saveNow` at `:1632`

`closeProject` runs `clearTimeout(autosaveTimer)` with no flush, no confirm
and no quit guard. Separately, `saveNow` unconditionally sets
`saveStatus: "saved"` when *its* write lands, even if the writer typed
while it was in flight — so there is a window where the bar reads **"All
changes saved"** while newer keystrokes exist only in memory. Clicking the
Scriare logo then loses them.

There is also no `close` handler on the window and no `beforeunload`, so
the X button has the same effect — including while the conflict dialog is
up, which is the one state where the project is *entirely* unsaved
(`saveNow` returns early and `scheduleAutosave` drops the timer), possibly
an hour of work.

### 6. Export can overwrite the project file with HTML, and it is the one write with no backup

`src/main/ipc/exportHandlers.ts:51-54`

```ts
const filePath = path.extname(result.filePath) === "" ? `${result.filePath}.html` : result.filePath;
await writeProjectFile(filePath, html, null, { noBackup: true });
```

Any extension other than empty is accepted verbatim, `expected` is null, and
`noBackup: true` disables recovery. The export dialog's default directory is
the project's own folder, so `My Story.scriare` is sitting in the file list;
clicking it fills the name box with it. The story is replaced by a web page,
atomically and completely, and the app then offers "Open it".

---

## Tier 2 — Confirmed, and a feature does not work

### 7. Find matches nothing if the query contains a space

`src/renderer/src/utils/textFold.ts:28`, consumed at `:56`

`foldWithMap` applies `fold()` **one character at a time**, and `fold` ends
in `.trim()` — so `fold(" ")` is `""` and every space is deleted from the
folded haystack with no entry in the index map. The query side trims only
the ends, so its inner spaces survive. The two can never line up.

**Measured:**

```
fold(" ")                               = ""
foldWithMap("the cat")                  = {"folded":"thecat","map":[0,1,2,4,5,6]}
foldedMatches("the cat sat","the cat")  = []              ← no match, ever
foldedMatches("the cat sat","ecat")     = [{start:2,end:7}]  ← matches "e cat"
```

So: every multi-word Find returns nothing, and a query with the spaces
removed matches across them. The `@` mention menu uses `fold` on the whole
string instead, so the two halves of the same search box disagree — and
`allowSpaces: true` on the mention suggestion means multi-word `@` queries
are a supported path.

The comment at `:49-51` says the map is *"Deliberately NOT trimmed… an
index map has to line up with the string it came from"* — it states the
exact invariant the code breaks, which is why this survived.

### 8. Clicking a Find result selects the wrong words after a divider

`src/renderer/src/utils/findInStory.ts:254-260`

`nodeSize` returns `inner + 2` for anything that isn't text or a mention.
ProseMirror gives a **leaf** node size 1. The schema has two:
`horizontalRule` (the toolbar's Divider) and `hardBreak` (Shift+Enter).

**Measured** — `<p>Before the line</p><hr><p>Second target here</p>`,
searching "target": reported `from: 27, to: 33`; the correct positions are
26–32. Off by one per leaf, cumulative. `useRevealMatch` feeds these to
`setTextSelection`, and the hook's whole purpose is "the next thing typed
replaces them."

The comment at `:253` — "text is its length, an atom is 1, a block is 2 +
content" — is the bug written down: it has no case for a leaf block.

### 9. Folding a chapter that was never given a rect leaves its scenes on the canvas

`src/renderer/src/utils/graphGroups.ts:311` and `:334`

`hiddenSceneIds` and `visibleStandIn` both require `Boolean(n.rect)`. Since
v0.31.0 `graphGroups` also draws folders with a **derived** rect and marks
them collapsed — and the fold button is rendered on every expanded group,
derived or not.

**Measured:**

```
group  : {derived: true, collapsed: true, hasRect: true}
hidden : []      ← scenes not hidden
standIn: null    ← edges not re-pointed at the folded box
```

The box collapses to 236×78 and its scenes sit on top of and around it with
their edges still drawn. The comment above the filter in `FlowPanel` says
"nothing about the story silently disappears" — here nothing disappears
because nothing was hidden.

### 10. An empty spoken line swallows the speaker's name on the line after it

`src/renderer/src/utils/speakerLines.ts:97-103`

`run.line(speaker)` mutates `last` **before** the empty-content early
return, so a blank paragraph that still carries a speaker consumes the
start of that speaker's run. Reachable because `keepOnSplit: true` means
pressing Enter on a spoken line produces exactly that.

**Measured:** `["Rain on the glass.", "", "I found it."]` — the third line
should read `"Mara: I found it."` The name never appears, in Play Mode or
in the export.

### 11. Every app-wide shortcut fires while a dialog is open

`hooks/useKeyboardClipboard.ts`, `useKeyboardFind.ts`, `useKeyboardHistory.ts`,
`ContentBrowser.tsx:407-446` — all gate on `ownsEditingKeys` (focus in a
text field) and nothing else. `utils/keyboardFocus.ts` has no notion of a
modal.

**Measured:** with Check Story open and three scenes selected, pressing
Delete removed them (`content.length` 4 → 3) behind the backdrop, raising
an undo toast that — see #13 — renders underneath it. Ctrl+F with the
Variable Manager open moved focus to `INPUT[Search story and writing...]`
in the panel behind the scrim; everything typed afterwards goes somewhere
invisible.

Ctrl+Z behind the conflict dialog is the same door, and it also arms an
autosave — which is how a resolved conflict can immediately raise a second,
spurious one.

### 12. An in-flight save stamps whatever project is open when it lands

`projectStore.ts:1594-1677`

`saveNow` captures `filePath` at the top, awaits the IPC, then writes
`fileStamp: outcome.stamp` back with no check that the store is still on
that file. Open project B while A's save is in flight and the store ends up
holding B's path with A's stamp — so B's first autosave reports a conflict
about a file nothing has touched. `saveInFlight`/`saveQueued`/`lastSaveFailed`
are module-level and are never reset by `closeProject`.

### 13. Toasts render behind dialogs

`ToastHost.tsx:21` (`z-50`) against `Modal.tsx:36` (`z-[100]`), both fixed
siblings under App's root.

Three callers raise a toast from inside their own modal: the Export
dialog's disk-full / read-only / failed messages, the Variable Manager's
delete-with-Undo, and Choice Styles' delete-with-Undo. In all three the
writer sees the row vanish with no undo offered, or an export button that
returns to "Export…" with no explanation. `toastStore.ts:44` says of
`showNotice`: *"a disk with no room left is the one moment the app must not
fail quietly"* — this is exactly that moment, failing quietly.

### 14. A malformed or momentarily-locked project opens as nothing, and is deleted from Recent

`projectHandlers.ts:168-179`, `projectStore.ts:427-430` and `:445-464`

`JSON.parse` runs unguarded in the main process; `openProject` has no
try/catch and is called as `void openProject()`. A half-synced OneDrive
file therefore produces **no toast, no dialog, nothing** — the Welcome
screen simply does not change. The same rejection inside the conflict
dialog makes its "Open the version on disk" button look dead.

Worse, `openRecentProject`'s catch is blanket and removes the entry from
the list: a transient EBUSY from a sync client or an antivirus scanner
permanently deletes a perfectly good story from the one place the writer
looks for it.

### 15. A scene created while a Character page is open lands in the wrong document

`projectStore.ts:475-501` (and `duplicateScene`, `duplicateScenes`,
`deleteScene`, `deleteContentNodes`, `undo`/`redo`)

The interface comment at `:86-92` states the invariant: *"Exactly one of
this and `selectedSceneId` is ever set."* `selectScene`/`selectEntity`
maintain it; none of those actions do. `EditorGraphSplit.tsx:48` resolves
the ambiguity as "entity wins", so the Content Browser and Inspector switch
to the new scene while the editor is still the character page — and
everything typed goes into the character.

### 16. `path.extname` means `My Story v1.2` is saved with no extension

`projectHandlers.ts:77-79`, same construct at `exportHandlers.ts:51-52`.
`path.extname("My Story v1.2")` is `".2"` — **verified** — so the guard
`extname === ""` does not fire and nothing is appended. The file does not
appear under the default open filter and never opens from Explorer. A
project named `Act 1: The Fall` is worse: the colon is illegal on Windows,
so the save dialog cannot honour the default path at all, while the
exporter three files away sanitises exactly these characters.

---

## Tier 3 — Confirmed, wasted work

Measured on synthetic projects at demo size (40 scenes) and large (300).

| | | |
|---|---|---|
| **17** | `FlowPanel.tsx:387` — `visibleStandIn` rebuilds a `Map` of the whole content tree **on every call**, twice per linked choice, inside a memo keyed on `project` | 1,200 Map allocations = 360,000 insertions per keystroke at 300 scenes; the two choice memos measure **1.5 ms at 40 scenes, 24.8 ms at 300** |
| **18** | `FlowPanel.tsx:349` and `:360` — every scene's document is walked by `extractChoices` **twice** per keystroke, and `FlowPanel` is mounted unconditionally, so **collapsing the Story Graph avoids none of it** | roughly half of the figure above |
| **19** | `GraphMiniMap.tsx:26` — `useStore` selector returns a fresh object literal with no equality function, so the component re-renders on **every** React Flow store notification | 300 SVG rects reconciled per pointer-move during a drag |
| **20** | `FlowPanel.tsx:530-552` — `groupOfScene` fills a map, calls `map.clear()`, and recomputes the identical thing in reverse. The first loop's entire output is unreachable | `graphGroups` (with a `folderSubtree` per group) run twice per keystroke |
| **21** | `FlowPanel.tsx:823` — `handleNodeDrag` rebuilds the whole group model per pointer-move for a hover highlight, while the `nodes` memo does it again in the same frame | 1.45 ms per frame at 300 scenes |
| **22** | `ChoiceStylesDialog.tsx:233` and `InspectorPanel.tsx:1381` — two `<input type="color">` controls commit straight through a full-document ProseMirror walk into a whole-project rebuild, at 60–120 events/second. `EditorToolbar.tsx:46-79` documents and fixes this exact pipeline; neither of these got the fix | window stops responding during a colour drag at 300 scenes |
| **23** | `ContentBrowser.tsx:589` — a fresh context object every render, with `ContentTreeRow` unmemoized, so every row re-renders on every keystroke and each folder row re-filters and re-sorts the whole content array | ~5,000 comparisons + ~300 component renders per character typed |
| **24** | `ChoiceOptionView.tsx:24` — every mounted choice option subscribes to the entire project and does a linear scene scan | 16 options × 300 scenes = 4,800 scan steps per keystroke |

---

## Tier 4 — Confirmed, visible but small

- **`ChoiceBlockView.tsx:80`** paints an unselected Choice Block with
  `bg-[var(--overlay)]` — the modal scrim. This is the exact bug v0.46.0
  fixed in Play Mode's ending card, still live in the writing surface: a
  hole punched through the page on the five dark themes, a heavy grey slab
  on the three light ones, with the hint line under AA on it.
- **`StoryCheckDialog.tsx:108`** puts six stats in a 4-column grid — row two
  has two stats and **two empty tracks**, which paint as a solid
  `--border-soft` rectangle across the bottom-right quarter. Every time.
- **`TopBar.tsx:45`** — the project name has no `truncate` and its container
  no `min-w-0`, so a long name wraps inside a fixed 56px bar and spills over
  the border. `StatusBar.tsx` gets this right.
- **`ExportDialog.tsx:42`** — `done` is only cleared by the Done button, so
  closing with Escape and reopening lands on the *previous* export's success
  screen, one "Open it" click away from opening a stale file.
- **`SlashCommand.ts:74` / `Mention.ts:229`** — Escape removes the popup's
  DOM but never exits the Suggestion plugin, so Enter still inserts from the
  invisible menu and arrow keys are still swallowed.
- **`choiceBlocks.ts:204`** — `findChoiceBlockOptions` calls `readOptions`
  with no mention resolver, so the Inspector shows a renamed character's
  **old** name in a choice summary while the graph and Check Story show the
  new one.
- **Keyboard reachability** — Content Browser disclosure rows
  (`:746`, `:791`, `:821`) and entity rows (`:71`) are bare `<div onClick>`
  with no role or tabIndex, so a keyboard user who collapses "Story" can
  never reopen it and can never open a character page. `ContentTreeRow`'s
  `focus:outline-none` (specificity 0,2,0) out-specifies the app's global
  `:focus-visible` ring (0,1,0), so tabbing the tree moves focus invisibly.
  `Modal` has no `role="dialog"`, `aria-modal`, focus trap or focus restore.
- **Section-header labels** have drifted into five spellings; every surface
  added since v0.44.0 picked `text-[10px] tracking-wider` while the older
  half uses `text-xs tracking-wide`.
- **`themes.spec.mjs`'s palette walk covers four surfaces** — editor, Check
  Story, Variables, Choice Styles. Export, the conflict dialog, the toast
  host, the status bar, entity pages, Project Settings, Move To, Find
  results, the context menu, Welcome and Play Mode are never walked. That is
  why the `--overlay` misuse above survived.

---

## Tier 5 — Dead code, duplication, false comments

- **`stripChoiceBlocks`** (`choiceBlocks.ts:218`) is the only fully dead
  export in the codebase — grepped across source, tests and docs, the
  definition line is the sole occurrence.
- **Snapping is implemented twice** — `autoLayout.ts:138` and
  `projectStore.ts:1191` — and each carries a comment asserting the other
  does not exist. The inner one achieves nothing, because
  `computeGraphLayout` re-bases every result by non-grid offsets afterwards.
- **`26` is written four times for two quantities** across three files
  (`FOLDER_PADDING`, `DERIVED_PADDING`, `DERIVED_HEADER`,
  `GROUP_HEADER_HEIGHT`), in the module whose header says "all of them need
  to agree". `GAP_BETWEEN_ROWS`/`GAP_BETWEEN_COLUMNS` are documented as
  whole multiples of `GRAPH_GRID` without importing it.
- **`CHOICE_OPTION_TYPE` is defined twice** — `nodeTypes.ts:16` and
  `ChoiceOption.ts:5` — in a module whose header says names live there and
  everything else *re-exports* them. `conditionalBlock` never made it into
  that module at all; the literal is written independently in five places.
- **False comments**: `textFold.ts:49` ("Deliberately NOT trimmed") states
  the invariant the code breaks; `choiceBlocks.ts:16` says `conditions` is
  "intentionally NOT a field yet" fourteen lines above the field;
  `autoLayout.ts:62-77` describes Frames, deprecated since v0.28.0, and
  points at collapsing logic that now lives in a different file;
  `textFold.ts:41` says "ß lowercases to two" — it doesn't.
- **`storyCheck.ts` computes reachability from a start scene Play Mode will
  never use** when `startSceneId` names a deleted scene — three different
  fallback rules in three files, and the issue text says "Play Mode begins
  wherever it can" when it begins nowhere.
- **`isDescendant`/`ancestorsOf`** (`contentTree.ts:26`, `:56`) have no
  cycle guard and hang the renderer on a `parentId` loop. Not reachable from
  the UI today; every other tree walker in the codebase has one.
- **`regenerateChoiceIds`** doesn't regenerate a Conditional Block's
  `blockId` or condition ids, so duplicating a scene leaves two copies
  claiming the same ones. Inert today because lookups are scoped to the open
  scene.
- **`countWords`** reads a mention's stored label while every other reader
  resolves it, so a renamed character is counted under the old name.

---

## Reported but not confirmed

- **The Inspector's colour-picker range sliders** were reported as an
  unthrottled hot path. They share the pipeline but a range input only fires
  on an integer change — 6 events for thickness, 21 for radius. Real, but
  bounded; listed under #22 rather than on its own.
- **`freeMove` missing from the `nodes` memo deps** (`FlowPanel.tsx:646`)
  produces a one-frame snap when Alt-resizing, then self-corrects because
  `frameResize` *is* a dependency. Worth fixing as the documented pattern,
  not as a visible bug.
- **Security items** — `sandbox: false`, no `will-navigate` handler, no
  scheme allowlist before `shell.openExternal`, `export:reveal` accepting
  any path. I could not construct a route from a malicious `.scriare` to
  script execution: the CSP has no `unsafe-inline` for scripts, ProseMirror
  serializes through DOM APIs rather than string concatenation, and no Link
  extension is registered. These are defence in depth against a future
  feature, not live holes.
- **No directory fsync after the rename** in `projectFile.ts`. Real, and the
  module's header does over-claim durability; the practical risk on ext4 and
  NTFS is low and the fix needs care on Windows.
