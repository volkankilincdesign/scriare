# Sprint 9A — Runtime Foundation & Variables: Final Report

Shipped as v0.21.0.

## Runtime architecture decisions

**Variables live on the Project, not the Scene.** `Project.variables: Variable[]` (in `types/project.ts`), matching the brief's explicit requirement that variables are story-wide state. `Variable` is a discriminated union (`NumberVariable | BooleanVariable | StringVariable`, in the new `types/variables.ts`) rather than one interface with a loosely-typed `value: number | boolean | string`. That's what lets every piece of UI that touches a variable — the Manager, the Action row's Value input — narrow on `variable.type` and get the matching widget and type-checking for free, instead of re-deriving "what kind of value is this" at every call site.

**Actions, not scripts.** `VariableAction` (`{id, variableId, operation, value}`) is attached per-option on a Choice Block (`ChoiceOption.actions`), not per-block — each option already owns its own `targetSceneId`, so "one choice, its own destination + conditions + actions" was the natural extension of the existing multi-option Choice Block model. `operation` is always chosen from a fixed, per-type list (`OPERATIONS_BY_TYPE`: Number gets Set/+Add/−Subtract, Boolean gets Set/Toggle, String gets Set) — there is no field anywhere a writer can type an expression into. That constraint is enforced at the type level (`operation: string`, but the UI only ever offers `OPERATIONS_BY_TYPE[variable.type]`), not just by convention.

**A pure apply function.** `applyVariableAction(currentValue, variable, action) → nextValue` in `types/variables.ts` is the single place "what does this operation actually do" is decided. Play Mode's `applyVariableActions` (projectStore.ts) is the only caller today, but the function takes no store or React dependency — a future "preview what this action would do" feature (e.g. annotating the graph) can call it directly.

**The Inspector became a discriminated-union switch, not a Scene-specific panel.** `inspectorStore.ts` introduces `InspectorTarget = {kind:"scene"} | {kind:"choice", sceneId, blockId, optionId}`. `InspectorPanel.tsx` is now a thin switch on `target.kind`, rendering `SceneProperties` or `ChoiceProperties`. This is a separate Zustand store from `projectStore`, deliberately: "what the Inspector is showing" is ephemeral UI state (resets on scene switch, never saved), not project data, the same distinction that already keeps panel-collapse state in `App.tsx`'s local state instead of the project.

**Selection is tracked at two levels.** `SceneEditor.tsx`'s `onSelectionUpdate` detects a ProseMirror `NodeSelection` over a `choiceBlock` node and sets the Inspector target at the block level (defaulting to the first option). `ChoiceBlockView.tsx`'s option `onFocus` handlers then narrow that target to the specific option the writer is editing. Two levels were necessary because a NodeSelection alone identifies the block, not which of its options the writer's cursor is actually in.

**No cascading deletes.** `deleteVariable` does not walk every scene rewriting `VariableAction`s that reference it. This matches the pre-existing precedent that `deleteScene` never cleans up other scenes' dangling `targetSceneId` references either — both resolve gracefully at render/runtime instead (an orphaned action is silently skipped in `applyVariableActions`). This was also a Performance-section decision: an eager cascade would mean walking and rewriting every scene's content tree on every delete, which doesn't scale to large projects.

**Play Mode's variable values are ephemeral.** `playVariableValues: Record<string, VariableValue>` lives in `projectStore.ts`, seeded from each Variable's `defaultValue` on `startPlay`/`restartPlay`, mutated only by `applyVariableActions`. It never touches `project` and never triggers autosave — preserving the pre-existing invariant that "Play Mode is a read-only pass over the existing project data."

## How future systems extend this

- **Conditions (9B)** can reuse `VariableType` / `VariableValue` / `OPERATIONS_BY_TYPE` wholesale for a `VariableCondition` shape (variable + comparator + value) — the read-side counterpart to `VariableAction`. The Inspector's Choice Properties view already has a placeholder Conditions section ready to swap for the real UI.
- **A new variable type** (e.g. "list", "enum") is one new member of the `Variable` union, one entry in `VARIABLE_TYPE_LABELS`/`OPERATIONS_BY_TYPE`/`defaultValueForType`, and one `case` in `applyVariableAction` — nothing that already touches a variable has to change.
- **A new action operation** for an existing type (e.g. "multiply" for numbers) is one entry in `OPERATIONS_BY_TYPE` plus one `case` in `applyVariableAction`.
- **Characters, Locations, Inventory, Relationships, Quests** each become a new `InspectorTarget` union member plus one new case in `InspectorPanel.tsx`'s switch — Scene and Choice targeting don't change. If any of them need their own runtime state (a Character's stats, say), the same Variable pattern (a typed, named, project-owned entity with a Manager and an Inspector view) is the template, not something to reinvent.
- **`RuntimeContext`** (runtime/types.ts) is the seam for anything a runtime block needs to call back into the player — it grew by exactly one member this sprint (`applyActions`, alongside the existing `goToScene`). A future Conditions-aware block would most likely add a `getVariable` read-side counterpart here.

## Why this stays scalable

Every extension point above is additive — a new union member, a new map entry, a new switch case — not a change to existing code paths. Nothing added this sprint required touching the editor's core (Tiptap extensions, `SceneEditor`'s content-loading effect) or introducing a second source of truth for scene content: `VariableAction`s live inside the same Tiptap JSON document a Choice Block's options already lived in, so they're versioned, autosaved, and undo-tracked by the exact same mechanism as everything else a writer types. The Inspector's adaptive-switch shape means the UI surface for "a new kind of thing's properties" scales linearly (one case per kind) rather than requiring a redesign each time a new entity type is introduced.

## Technical debt intentionally postponed to Sprint 9B

- `ChoiceOption` has no `conditions` field yet — deliberately, per the brief's own "Conditions (placeholder if not implemented)" instruction. Adding an empty array nothing reads would just be dead data.
- No uniqueness validation on Variable names — two variables can currently share a name. The Action dropdown falls back to showing "Untitled variable" for an empty name but doesn't prevent duplicates.
- No live-value preview during Play Mode — `playVariableValues` exists and updates correctly (verified via Playwright + Electron: a Number variable defaulting to 10, incremented by a Choice Action's "+5", correctly reads back as 15 after picking that choice), but there's no on-screen debug view of current variable state while playing. Worth considering alongside Conditions in 9B, since debugging a condition will likely need to see the values it's checking.
- An orphaned `VariableAction` (its `variableId` no longer resolves to any Variable) is silently skipped at runtime and not flagged anywhere in the Inspector — unlike a Choice option's dangling `targetSceneId`, which at least renders "Not linked yet." Worth a similar visual flag if this becomes confusing in practice.

## Verification

`npx tsc --noEmit` clean on both `tsconfig.web.json` and `tsconfig.node.json`; `npm run build` clean. End-to-end verified via Playwright driving the real packaged Electron app (Xvfb, temporary debug store hook removed before shipping): created a Number variable via the Variable Manager, selected a Choice Block option in the editor (confirming the Inspector's selection-tracking wiring), added a Choice Action referencing that variable, entered Play Mode, and confirmed picking that choice correctly applied the action (10 → 15) before navigating to the linked scene.
