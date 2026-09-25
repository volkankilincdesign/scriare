# Sprint 9B — Choice Block Inspector Refactor: Final Report

Shipped as v0.22.0.

## UX improvements made

**One selection, one editing surface.** Clicking anywhere in a Choice Block now selects the whole block, not a single line inside it. The Inspector's new "Choices" section shows every option in that block as its own accordion — any number can be expanded at once, independently, so moving from editing option 2 to option 3 no longer means clicking back into the document. The editor itself now shows a compact, read-only preview (numbered choice lines with their destinations) instead of a form full of inputs — it reads as writing again, not data entry.

**Collapsed accordions stay informative.** Each shows its destination, its condition count, and its action count without needing to expand it — a writer can scan a five-option Choice Block's shape at a glance.

**Direct-manipulation reordering.** Dragging a choice's handle moves that accordion itself, following the pointer in real time; the list reorders live as the dragged item crosses a neighbor, so the gap opens exactly where it will land. No browser drag-ghost, no separate placeholder element — the same "what you're holding is what moves" feel as dragging a scene on the Story Graph.

## Architecture decisions

**The whole block, not one option, is the unit of Inspector targeting.** `InspectorTarget`'s choice case dropped `optionId` (`{kind:"choice", sceneId, blockId}` only) — Sprint 9A tracked one option at a time; this sprint's brief asked for every option to be editable simultaneously, so the option-level distinction moved to purely local UI state (`expanded: Set<string>`) inside the Inspector's `ChoiceProperties` component, reset by remounting it (`key={target.blockId}`) whenever the target block changes.

**Fixed a real editor/store desync bug.** Sprint 9A's `updateChoiceOption` wrote directly to `project.scenes` in the store, bypassing the live Tiptap document — harmless when the Inspector only occasionally touched one option's Actions, but this sprint makes the Inspector the *primary* place Choice content is edited, and the bug would have surfaced constantly (a keystroke in the editor after an Inspector edit would silently revert it, since the editor's own `onUpdate` would persist its own, still-stale document). Fixed by routing every Choice edit — from the editor's own block preview or the Inspector — through one path: a real ProseMirror transaction dispatched on the live editor instance (`utils/choiceBlockEditing.ts`'s `applyChoiceBlockOptions`). A new `state/editorStore.ts` holds a reference to the currently-mounted `Editor` instance so the Inspector (a sibling panel, not a child of `SceneEditor`) can reach it. That transaction's own `onUpdate` is what persists to the store — there is exactly one writer of scene content now, not two.

**Selecting an atom NodeView reliably.** `ChoiceBlockView`'s selection handler moved from `onClick` to `onMouseDown` with `preventDefault()`. With `contentEditable={false}`, a plain click let the browser place its own native caret in the nearest editable text (frequently a neighboring paragraph), and ProseMirror's `selectionchange` sync would silently overwrite the NodeSelection we'd just set. Blocking the browser's default mousedown behavior before that happens is the standard fix for "click an atom NodeView to select it" in ProseMirror — verified via Playwright against the real packaged app; without the fix, clicking the block collapsed the editor's selection into an unrelated paragraph instead of selecting the block.

**Reordering is a small, dependency-free sortable list**, not a new library. The dragged accordion follows the pointer via a `translateY` transform computed from raw pointer deltas; `dragOrder` (an array of ids) live-reorders as the dragged item's center crosses a neighbor's midpoint (measured via `getBoundingClientRect`, not assumed uniform height, since accordions can be expanded); non-dragged items that shift position animate into their new spot with a small FLIP transform rather than snapping. On drop, the final order is mapped back to full `ChoiceOption` objects and committed through the same `applyChoiceBlockOptions` transaction path as every other Choice edit.

**One primitive covers add, remove, and reorder.** `applyChoiceBlockOptions(editor, blockId, options)` always replaces a Choice Block's entire option list. An empty array is the signal to delete the whole block — the same "last option removed ⇒ block goes away" behavior the old inline editor already had, now centralized in one place instead of duplicated between the editor and the Inspector.

## Future extensibility considerations

- Each accordion already renders a Conditions placeholder in the exact spot a real Conditions editor will go — no structural change needed to the accordion layout when Sprint 9B (Conditions) lands for real, just a swap of that placeholder block.
- `applyChoiceBlockOptions` operates on the whole `ChoiceOption[]`, so any future per-option field (probability, weights, inventory or character requirements) is a new key on `ChoiceOption` and a new form control inside the accordion's expanded body — the mutation path doesn't change.
- The `editorStore` pattern (a live instance ref reachable from sibling panels) is reusable for any future Inspector-driven editing of live document content — it isn't Choice-Block-specific.
- The drag-reorder implementation is generic enough (id-array reordering + FLIP) to lift into a shared hook if a future list (e.g. reordering Conditions within a choice, or Actions within a choice) wants the same interaction.

## Runtime-related technical debt intentionally deferred

- Conditions remain entirely unimplemented — every accordion honestly reports "0 conditions" because there is truly no conditions data yet, not because the count is hidden.
- No uniqueness or validation rules were added this sprint (e.g. a Choice Block with zero linked destinations, or all-empty choice text) — carried over from Sprint 9A, unchanged.
- The drag-reorder's neighbor-crossing measurement re-reads live DOM rects on every pointer move; this is correct but means a very large Choice Block (dozens of options) could see minor measurement jitter during a drag — acceptable for the option counts this app expects, worth revisiting only if that changes.
- No keyboard-accessible alternative to drag-reordering exists yet (e.g. "move up/down" buttons) — the editor's old NodeView had explicit ▲/▼ buttons for this; they were intentionally dropped in favor of a pointer-only drag interaction per the brief's "the dragged item itself should move" requirement, but an accessibility pass may want to add them back inside the Inspector.

## Verification

`npx tsc --noEmit` clean on both `tsconfig.web.json` and `tsconfig.node.json`; `npm run build` clean. End-to-end verified via Playwright driving the real packaged Electron app (temporary debug hooks removed before shipping): selected a 3-option Choice Block by clicking it (confirmed via the block's own `selected` NodeView state), expanded two accordions simultaneously, edited one option's Display Text from the Inspector and confirmed the change appeared both in the live editor's own block preview and in the persisted project data (proving the editor/store desync bug is fixed), added and removed a choice via the Inspector (confirmed against both the Inspector's accordion count and the editor's rendered preview), and dragged the first choice past the other two, confirming the final persisted option order matched the drop position.
