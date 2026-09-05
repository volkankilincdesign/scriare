# Scriare — v0.9.1 — Brand Mark

Scriare is still a rich text editor, first and foremost. This is a small
visual follow-up to v0.9.0: the app logo is now a live, theme-aware glyph
instead of a static PNG. **No functionality changed.**

## What's new (v0.9.1 — Brand Mark)

- **The Top Bar and Welcome screen logo is now rendered text, not an
  image.** The project owner supplied a blackletter font pack
  (`other_materials/fonts/blackletter_ds/`, two cuts — a filled ExtraBold
  and a decorative Shadow/outline variant); the filled one
  (`BLACEB__.TTF`, renamed `scriare-blackletter.ttf`) is embedded via
  `@font-face` in `themes.css` and used to render a single capital "S" as
  the brand mark, coloured with `var(--accent)`.
- **The mark now re-themes live**, exactly like the rest of the app —
  switch palettes in Project Settings and the "S" shifts colour along with
  everything else, instead of staying frozen as a static white-on-black
  image. Verified by rendering the glyph against two different `--accent`
  values and confirming both render correctly.
- The original PNG (`assets/logo-mark.png`) is no longer imported in
  `TopBar.tsx`/`WelcomeScreen.tsx` — it's kept only as the source for
  `build/icon.png`/`resources/icon.png` (the Electron window icon), which
  has to be a bitmap regardless of the in-app theme.

## What's new (v0.9.0 — Premium Redesign)

- **New colour-theme system.** Four palettes, each a small set of CSS
  custom properties in `src/renderer/src/styles/themes.css`:
  - **Crimson Noir** (default) — cool near-black neutrals with a red accent.
  - **Indigo Dusk** — cool blue-violet accent.
  - **Emerald Slate** — muted forest-green accent.
  - **Ivory Gold** — a light, warm palette (the one theme that flips to a
    light background).
  All four are built from [oklch](https://oklch.com) colours so lightness
  and contrast stay consistent across hues. Switch between them any time
  in Project Settings → Appearance; the choice is saved to
  `localStorage` (`scriare.theme`) and applied instantly via a
  `data-theme` attribute on `<html>`, no reload needed.
- **Every hardcoded Tailwind colour (`zinc-*`, `emerald-*`) was replaced**
  with a CSS-variable-backed class (e.g. `bg-[var(--surface)]`,
  `text-[var(--accent)]`) across all 23 components that had them — Content
  Browser, editor toolbar, Story Graph, dialogs, Play Mode, the welcome
  screen, everywhere. Nothing was restyled by hand per-theme; changing a
  theme's variables in `themes.css` re-themes the entire app.
- **New app logo** (`src/renderer/src/assets/logo-mark.png`, supplied by
  the project owner): now shown top-left in the Top Bar and on the Welcome
  screen, and set as the Electron window icon (`build/icon.png`,
  `resources/icon.png` — ready for `electron-builder` packaging later;
  a `.ico`/`.icns` conversion will be needed when packaging is set up,
  since Windows/macOS installers don't accept a bare `.png`).
- **New font pairing**: Newsreader (a serif, for the "Scriare" wordmark and
  other narrative-facing titles) paired with Manrope (sans, for UI chrome),
  loaded via Google Fonts `@import` in `themes.css`.
- **Project Settings gained an Appearance section**: a 2×2 grid of theme
  swatches (each swatch reads its *own* theme's live CSS variables, so it
  can never drift out of sync with `themes.css`); clicking one applies
  instantly. The existing Start Scene field is unchanged, just visually
  restyled and now sitting in a slightly wider dialog.
- **Story Graph (`FlowPanel.tsx`)**: edges, the dot-grid background, the
  minimap, and the zoom controls now read the active theme's CSS variables
  instead of hardcoded hex, so the graph re-themes along with everything
  else. The Left/Right edge-handle fix from earlier work (so Auto Layout's
  left-to-right edges run straight rather than looping) was untouched.
- Two small consistency fixes made while reskinning, both cosmetic: the
  Play/Save/Confirm buttons' hover states no longer resolve to the exact
  same colour as their resting state (a latent bug — hover and rest both
  used to be `emerald-600`), and button text now uses a
  theme-aware `--accent-text-on` instead of a hardcoded white, so text
  stays legible against light accents (relevant on Ivory Gold).

## What's new (v0.8.3 — Drag & Drop Fix)

- **Fixed: dragging items in the Content Browser did nothing.** The
  folder-expand arrow and the scene/folder name label were native
  `<button>` elements that called `preventDefault()` on `mousedown` (added
  in v0.6.1 to stop a stray focus/selection highlight on Shift+Click).
  Calling `preventDefault()` on `mousedown` — especially on a `<button>`
  nested inside a `draggable` row — stops Chromium from ever recognizing
  the drag gesture, so the row's own `onDragStart` never fired. Clicking,
  Ctrl-clicking, and Shift-clicking still worked because those don't depend
  on native `dragstart`, which is exactly why only dragging looked broken.
  Fixed by making those two row elements plain `<div role="button">`s
  instead of `<button>`s and dropping the `mousedown` handler entirely —
  the existing `select-none` (text selection) and `focus:outline-none`
  (focus ring) CSS already suppress the highlight v0.6.1 was fixing,
  without touching `mousedown`.
- Folder drag & drop, scene drag & drop, nested folders, and everything
  else audited in v0.8.2 continues to work exactly as before — this is a
  single, isolated fix.

## What's new (v0.8.2 — Regression Audit)

A line-by-line audit of every file touched in v0.8.0/v0.8.1, plus the
supporting Content Browser/graph code, against all of: folder drag & drop,
scene drag & drop, nested folders, multi-selection, Ctrl-selection,
Shift-selection, favorites, search, folder deletion behavior, custom
modals, and graph synchronization. No functional regressions were found —
every change from those two sprints was purely additive (new fields, a new
dialog, a new context menu item, a new checkbox) and none of it touched the
existing logic paths. Two stale code comments left over from the
`PlayView` → `runtime/PlayRuntime` rename (in `narrativeBlocks/types.ts`
and `utils/readingColumn.ts`) were corrected — documentation only, no
behavior change. See "Regression audit findings" further down for the full
list of what was checked.

## What's new (v0.8.1 — Start Scene Management)

- **Set the Start Scene from the Content Browser.** Right-click any Story
  scene and choose **Set as Start Scene** — no need to open Project Settings
  for a quick change.
- **Toggle it from the Inspector.** Selecting a scene now shows a "This is
  the Start Scene" checkbox in Scene Details — check it to make that scene
  the start, uncheck it to clear it (Play Mode then falls back to the first
  Story scene, same as an unset project).
- **Always exactly one Start Scene.** All three places to set it — Project
  Settings, the Content Browser, and the Inspector — read and write the
  same underlying value, so choosing a new Start Scene from any of them
  instantly un-marks whichever scene was the Start Scene before, everywhere
  it's shown (the ▶ Start badge in the Content Browser and the graph).

## What's new (v0.8.0 — Runtime Polish)

- **Start Scene.** Project Settings (the new ⚙ button in the top bar) lets
  you pick which scene Play Mode begins from. If none is set, the first
  Story scene is used, same as before. The Start Scene is marked with a
  small "▶ Start" badge — in the Content Browser and on its node in the
  Flow graph — instead of Twine's rocket icon, to match Scriare's own
  visual language.
- **A proper ending screen.** Reaching a scene with no outgoing choices now
  shows a minimal, centered "The End" card with **Restart Story** and a new
  **Return to Editor** button, instead of just a heading and one button.
- **Escape exits Play**, in addition to the existing Exit Play button —
  both return you to exactly where you left off: same scene selected, same
  editor scroll position, same graph pan/zoom, all untouched because the
  editor is never unmounted while playing.
- **A simple scene fade** on every transition — comfortable, immediate, and
  nothing more elaborate than that on purpose.
- **The runtime is now its own layer**, under `src/renderer/src/runtime/`,
  separate from the editor's UI components. A small registry
  (`runtime/registry.ts`) maps each narrative block's node type to its own
  playback renderer — Choice is the only one registered today, but a future
  block (Variables, Conditions, Images, Dialogue, embedded widgets, ...)
  only needs one more registry entry, not changes to the player itself.
- Play Mode's actual rendering (headings, rich text formatting, colors,
  highlights, alignment, Choice/Divider/Quote/Callout blocks, all in exact
  document order) is unchanged from v0.7.0 — that fidelity already held.

## What's new (v0.7.0 — Narrative Blocks)

Scriare evolved from a rich text editor with branching metadata into a
writing-first narrative editor. Nothing about the editor became a card
system or a Notion-style block editor: paragraphs are still paragraphs,
and you can keep typing straight through a Choice Block, a Callout, a
Quote, or a Divider exactly like you'd type past an image in Word.

- **Choice Blocks now hold multiple options.** A single Choice Block can
  have one or more options, each with its own text and destination scene —
  add an option, remove one, or reorder them with the ▲/▼ arrows, all
  inside the same block. Choices are still purely something you write, not
  editor metadata.
- **Slash commands.** Type `/` anywhere in the document to open a small
  command menu: `/choice`, `/divider`, `/quote`, `/callout`. Pick one with
  the arrow keys + Enter, or click it — it replaces the `/query` text with
  the block. The toolbar's "+ Choice" and "Quote"/"Divider" buttons still
  work exactly as before; the slash menu is just a second way to reach the
  same commands.
- **Callout**, a new block for a highlighted note or aside — insert it with
  `/callout`, type normally inside it (it holds ordinary paragraphs), and
  it looks the same whether you're writing it or playing it back.
- **Play Mode renders every block in the exact order it was written.**
  Paragraph, Choice Block, paragraph, divider, paragraph — plays back in
  that order, with each Choice Block's buttons appearing right where the
  choice was written, not collected at the bottom of the scene like before.
- Built as an extensible system on purpose: a `NARRATIVE_BLOCKS` registry
  is the one place a new block (future: Variables, Images, Dialogue, ...)
  plugs into the slash menu, so adding one later won't mean redesigning
  the editor.
- Existing projects open unaffected — old-format Choice Blocks (from any
  earlier version) are upgraded to the new multi-option shape automatically
  the first time they're opened.

## Fixes (v0.6.2)

- **Play Mode now reads at the same width as the editor.** Both now share
  one definition of the reading column (`utils/readingColumn.ts`) instead
  of each keeping their own copy — so the text width, the wrap points, and
  the typography (font, size, line height, spacing) are guaranteed to
  match, and Play Mode centers a comfortable, Twine/Notion/Medium-style
  column instead of stretching text across the whole window. Long
  unbroken words now also wrap inside the column instead of overflowing
  it. Play Mode's layout, navigation, and choices are unchanged — this was
  purely a rendering-consistency fix.

## Fixes (v0.6.1)

- **Shift+Click no longer leaves a stray highlight.** Range-selecting in
  the Content Browser was triggering the browser's own text-selection/focus
  outline on the clicked row. Rows now suppress both, so Shift+Click only
  does the selection you asked for.
- **Auto Layout now routes edges cleanly.** Scene boxes only had
  top/bottom connection points, but Auto Layout arranges scenes
  left-to-right — so choice arrows had to loop out the bottom and back in
  the top of the next box, bending and crossing awkwardly. Connection
  points are now on the left/right sides, matching the flow direction, so
  arrows travel straight and don't cross each other after Auto Layout.

## What's new (v0.6.0)

- **Custom confirmation dialogs.** Every "are you sure?" (deleting a
  scene, deleting a folder, bulk deletes) now shows Scriare's own dark,
  rounded, blurred-backdrop modal instead of a native OS popup — with
  Enter to confirm and Escape to cancel.
- **Multi-selection.** Click a Story item to select just it, **Ctrl/Cmd
  + Click** to add or remove one from the selection, **Shift + Click** to
  select the visible range between two items. Selected rows get a clear
  highlight distinct from the "currently open scene" highlight.
- **Multi-item drag & drop.** Drag any item that's part of a selection of
  more than one, and the whole selection moves together — into another
  folder, back to the Story root, or reordered as siblings.
- **Multi-item context menu actions.** Right-click within a multi-selection
  for bulk **Move… **(via a new destination picker), **Duplicate**,
  **Favorite/Unfavorite**, and **Delete** — all confirmed through the new
  in-app dialog when destructive.
- Existing single-item behavior is unchanged: deleting a folder still
  ungroups its contents up one level with a confirmation, deleting a scene
  still asks for confirmation, and nothing about the Content Browser's
  layout was redesigned.

## What's new (v0.5.0 — Content Browser)

- **Hierarchical Story tree.** Create Folders and Scenes, nest folders
  inside folders, and drag items between them. Right-click anywhere for a
  context menu with only the actions that make sense for what you clicked
  (a folder gets New Scene/New Folder/Rename/Delete; a scene gets
  Rename/Duplicate Scene/Favorite/Delete).
- **Drag & Drop reordering**, Unreal/Unity/VS-Code-Explorer style: drop
  near the top or bottom edge of an item to reorder as a sibling, or drop
  in the middle of a folder to move something inside it.
- **Favorites.** Star any scene from its context menu — favorites show in
  their own section at the top of the browser. A favorite is a reference
  only: it can never move or duplicate the scene, and clicking it just
  opens and focuses the original.
- **Search** instantly filters Story folders and scenes by name.
- **Four more roots** — 👤 Characters, 🌍 Locations, 📝 Notes, 🖼 Assets —
  exist as expandable placeholders ("Coming soon") for future milestones.
  Nothing about them is implemented yet; they're there so the browser
  already has room to grow into them.
- Deleting a folder never deletes what's inside it — its contents move up
  one level, the same non-destructive rule the Flow graph's Frames already
  follow.
- If Story has no scenes yet, you'll see "No story yet." with Create Scene
  / Create Folder buttons instead of an empty tree.

Nothing about the editor, the toolbar, the Story Graph, or Play Mode
changed in either milestone.

### How it's built (for future content types)

The browser doesn't know anything Story-specific under the hood. Every
item in it is a generic `ContentNode` — either a `folder` (pure
organization) or a `leaf` (a reference to a real entity elsewhere, keyed
by `refType`; today only `"scene"` exists). Adding Characters later means
adding a `refType: "character"` and an editor for it — not touching this
tree, its drag-and-drop, its search, or its Favorites system, all of which
are already generic. Favorites work the same way: a favorite is just
`{ refType, refId }`, so any future content type can be favorited without
changing how favoriting works.

## How to run it

You need [Node.js](https://nodejs.org) installed (LTS version).

```bash
npm install
npm run dev
```

## Trying the UX polish out (from v0.6.0)

1. Click one scene, then **Ctrl/Cmd + Click** another — both highlight.
   **Shift + Click** a third to select everything in between.
2. Drag any of the selected scenes into a folder — all of them move
   together.
3. Right-click within the selection and try **Move…**, **Duplicate**,
   **Favorite**, and **Delete** — Delete shows the new in-app confirmation
   dialog (Enter/Escape both work).
4. Delete a single scene or folder the old way — you'll see the same
   custom dialog instead of a Windows/OS popup.

## Trying the Content Browser out

1. Right-click empty space under **📖 Story** (or use the **+ Scene** /
   **+ Folder** buttons in the header) to create a folder.
2. Drag a scene into it — notice it becomes nested. Drag it back out to
   the Story root by dropping it on the "📖 Story" row itself.
3. Right-click a scene and choose **Favorite** — it appears in the
   **Favorites** section at the top. Click it there to jump straight to
   it.
4. Right-click a scene and choose **Duplicate Scene** — the copy keeps the
   same choices and destinations as the original, with fresh ids so
   nothing is shared between them.
5. Type in the search box — the tree is replaced by a flat list of
   matching folders/scenes; click one to jump to it (it also gets
   revealed and expanded back in the tree).
6. Expand **👤 Characters** or any of the other placeholder roots to see
   "Coming soon" — they're not functional yet, on purpose.

## Trying Start Scene Management out (from v0.8.1)

1. Right-click any scene in the Content Browser and choose **Set as Start
   Scene** — its "▶ Start" badge appears immediately, and disappears from
   wherever it was before.
2. Select a different scene and check **This is the Start Scene** in Scene
   Details (the Inspector) — same effect, from a different place.
3. Uncheck it — Play Mode now falls back to the first Story scene again.
4. Open **⚙ Project Settings** and confirm its dropdown always matches
   whichever scene you last set from either of the above.

## Trying Runtime Polish out (from v0.8.0)

1. Open **⚙ Project Settings** in the top bar, pick a different Start
   Scene, and save — notice its "▶ Start" badge move to that scene in both
   the Content Browser and the Flow graph.
2. Press **▶ Play** — it now begins from that scene, with a brief fade in.
3. Play through to a scene with no outgoing choices and confirm the new
   ending card: **Restart Story** and **Return to Editor**.
4. Press **Esc** at any point while playing — you're back in the editor
   instantly, on the same scene, same scroll position, same graph view.

## Trying Narrative Blocks out (from v0.7.0)

1. In a scene, type `/` on its own line — a small menu appears with
   Choice, Divider, Quote, and Callout. Try `/callout` and type inside it.
2. Click **+ Choice** in the toolbar (or type `/choice`) to insert a Choice
   Block, then click **+ Add option** to give it a second path — each
   option gets its own text and destination scene, and the ▲/▼ arrows
   reorder them.
3. Write a scene with a paragraph, then a Choice Block, then another
   paragraph — press **▶ Play** and confirm it plays back in that exact
   order, with the choice's buttons appearing between the two paragraphs.

## Trying the writing workflow out (from v0.4.0)

1. Try the toolbar's underline, color, highlight, alignment, font
   size/family, clear formatting, and horizontal divider controls.
3. Drag the thin bar between the editor and the Flow panel to resize them.

## Trying Play Mode out (from v0.3.0)

1. Write a few scenes with Choice Blocks linking them, and make sure at
   least one has none, so you can see the "The End" screen.
2. Click **▶ Play** in the top bar, click through your choices, then
   **■ Exit Play** to return exactly where you left off.

## Other commands

- `npm run build` — compiles a production version into `out/`.
- `npm run preview` — runs that built production version.
- `npx tsc --noEmit -p tsconfig.node.json` / `tsconfig.web.json` — type-check
  without touching any files. **Do not run `tsc -b`** on this project — its
  build mode writes compiled `.js`/`.jsx`/`.d.ts` files directly next to the
  TypeScript source, which can silently shadow your real source files.

## Regression audit findings (v0.8.2)

Checked against the Content Browser and graph as they worked before the
Runtime Polish / Start Scene sprints — every item below was traced through
its actual code path and confirmed still wired correctly:

- **Folder & scene drag & drop** (`ContentBrowser.tsx`'s
  `handleDragStartNode`/`handleDragOverNode`/`handleDropNode` and
  `projectStore.moveContentNodes`) — the reducer logic itself was (and still
  is) unchanged and correct. **Correction:** this audit only traced the
  logic, not an actual drag in a running browser, and missed that dragging
  didn't actually work at all — a pre-existing bug from v0.6.1, unrelated
  to the Runtime Polish/Start Scene sprints, fixed in v0.8.3. See that
  version's "What's new" above.
- **Nested folders** (`utils/contentTree.ts`'s `childrenOf`) — untouched by
  either sprint; recursive rendering in `ContentTreeRow.tsx` still nests
  correctly to any depth.
- **Multi-selection, Ctrl-selection, Shift-selection**
  (`handleItemClick`/`selectedIds`/`selectionAnchor` in `ContentBrowser.tsx`,
  `flattenVisible` in `contentTree.ts`) — unchanged; the new "Set as Start
  Scene" item only appears in the single-scene context menu branch, the
  bulk-selection branch (Move/Duplicate/Favorite/Delete) is untouched.
- **Favorites** (`toggleFavorite`/`setFavorites` in `projectStore.ts`) —
  unchanged.
- **Search** (`searchResults` filtering in `ContentBrowser.tsx`) —
  unchanged.
- **Folder deletion behavior** (`deleteFolder`/`deleteContentNodes` in
  `projectStore.ts`) — unchanged; folders still ungroup rather than destroy
  their contents, including through nested/bulk deletes.
- **Custom modals** (`Modal.tsx`, `ConfirmDialogHost.tsx`,
  `ContentContextMenu.tsx`, `MoveToDialog.tsx`) — unchanged; the new
  `ProjectSettingsDialog.tsx` is a separate self-contained dialog built on
  the same shared `Modal` shell, it doesn't alter any existing dialog.
- **Graph synchronization** (`FlowPanel.tsx`, `SceneNode.tsx`) — node
  positions, edges, selection highlighting, and Auto Layout are unchanged;
  the graph node's new "▶ Start" badge is an additive `isStart` field
  alongside the existing `label`/`choiceCount`/`isActive` data.

No functional regressions were found. Two stale comments left over from
the `PlayView` → `runtime/PlayRuntime` rename were corrected for accuracy
(`narrativeBlocks/types.ts`, `utils/readingColumn.ts`) — comments only, no
behavior change. Verified with a clean `tsc --noEmit` on both configs, a
clean production build, and a bundle grep confirming every feature's
marker strings are present in the shipped code.

## Where things are

- `src/renderer/src/runtime/` — the Play runtime, kept separate from the
  editor's UI components on purpose. `PlayRuntime.tsx` is the player itself
  (consumes the document model via Tiptap's `generateHTML()`, never imports
  `SceneEditor`/`EditorToolbar`/`ChoiceBlockView`); `registry.ts` maps a
  narrative block's node type to its own playback renderer (`RUNTIME_BLOCKS`
  — the extension point for future blocks); `documentSegments.ts` splits a
  scene's content into ordered prose/block segments using that registry;
  `blocks/choiceRuntimeBlock.tsx` is Choice's own renderer, registered
  rather than hardcoded into the player.
- `src/renderer/src/components/layout/ProjectSettingsDialog.tsx` — the
  Start Scene picker, opened from the top bar's ⚙ button.
  `projectStore.setStartScene(sceneId | null)` is the single action behind
  it, the Content Browser's "Set as Start Scene" context menu item, and the
  Inspector's "This is the Start Scene" checkbox (v0.8.1) — all three read
  and write `project.startSceneId` directly, so they can never disagree.
- `src/renderer/src/components/common/StartBadge.tsx` — the "▶ Start"
  indicator shared by the Content Browser row and the graph's SceneNode.
- `src/renderer/src/types/project.ts` — `ContentCategory`, `ContentFolder`,
  `ContentLeaf`, `ContentNode`, `Favorite` types; `Project.content` (a flat
  list with `parentId`/`order`, same pattern as graph Frames) and
  `Project.favorites`. `normalizeProject()` now also synthesizes Story-root
  leaves for any scene from an older project file that predates the
  Content Browser.
- `src/renderer/src/utils/contentTree.ts` — generic tree helpers:
  `childrenOf()`, `nextOrder()`, `isDescendant()` (cycle prevention while
  dragging a folder), `ancestorsOf()`, `computeDropPosition()`.
- `src/renderer/src/state/projectStore.ts` — added `createFolder`,
  `renameFolder`, `deleteFolder`, `moveContentNode`, `duplicateScene`, and
  `toggleFavorite`. `createScene` now takes an optional parent folder id.
  `deleteScene` also removes the scene's content leaf and any favorite
  referencing it.
- `src/renderer/src/components/layout/ContentBrowser.tsx` — the whole
  browser: header, search, Favorites section, the Story tree (or its
  empty state), and the four placeholder category roots.
- `src/renderer/src/components/layout/ContentTreeRow.tsx` — the recursive
  row renderer (folder or scene), handling expand/collapse, inline
  rename, drag & drop, and the context-menu trigger.
- `src/renderer/src/components/layout/ContentContextMenu.tsx` — a small
  generic right-click menu; the caller supplies whatever actions are
  relevant.
- `src/renderer/src/components/layout/contentBrowserContext.ts` — a React
  context carrying the browser's shared state/callbacks down to each
  recursive row, instead of prop-drilling through every nesting level.
