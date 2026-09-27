import { create } from "zustand";

/**
 * Sprint 9A — the Inspector Philosophy section of the sprint brief asks for
 * the Inspector to become "the central property editor of Scriare",
 * adapting to whatever is currently selected: a Scene shows Scene
 * Properties, a Choice shows Choice Properties, and (per the brief) a
 * future Character or Location should show their own Properties view the
 * same way, without the Inspector's own architecture changing again.
 *
 * That's what this discriminated union is for. `InspectorPanel.tsx` is a
 * thin switch over `target.kind` — adding a new selectable thing later
 * (Character, Location, Item, ...) means adding one union member here and
 * one case in that switch, not touching how Scene/Choice selection already
 * works. Deliberately its own store rather than fields on `projectStore`:
 * "what the Inspector is currently showing" is ephemeral UI state (it
 * resets on scene switch, never persists, never gets saved to disk),
 * exactly like `selectedSceneId` is project-adjacent but panel-collapse
 * state in App.tsx is not project data — keeping it separate means a
 * future selectable entity's store doesn't have to grow projectStore's
 * already-large surface just to participate in Inspector targeting.
 *
 * Sprint 9B narrowed the Choice case from "one option" to "one block":
 * the Inspector now shows every option in a selected Choice Block as its
 * own accordion (see InspectorPanel.tsx's ChoiceProperties), so the unit
 * of Inspector targeting is the block, not a single option inside it —
 * `optionId` was dropped from this shape accordingly.
 */
export type InspectorTarget =
  | { kind: "scene" }
  | {
      kind: "choice";
      sceneId: string;
      blockId: string;
      /**
       * v0.33.1 — which option the writer's caret is actually in, so the
       * Inspector can open that option's accordion instead of making them
       * find it in a list.
       *
       * NOT a return to Sprint 9A's per-option targeting: the unit of
       * targeting is still the block, and the Inspector still shows every
       * option in it. This is a hint about where attention is. The
       * distinction matters because the caret moves constantly — if the
       * option were part of the target's identity, the panel would remount
       * every time a keystroke crossed an option boundary (see the
       * `key={target.blockId}` note in InspectorPanel).
       */
      optionId?: string | null;
    }
  // v0.30.0 — a Conditional Text block. Selected by the cursor being
  // anywhere INSIDE it rather than by a NodeSelection over it, because
  // unlike a Choice Block it holds ordinary prose the writer types into;
  // see SceneEditor's onSelectionUpdate.
  | { kind: "conditional"; sceneId: string; blockId: string }
  /**
   * v0.66.0 — the Dialogue. Targeted exactly like a Choice Block, and with
   * the same `lineId` hint for which line the caret is in, because the
   * panel has the same job: show every line in the block and open the one
   * being worked on.
   */
  | { kind: "dialogue"; sceneId: string; blockId: string; lineId?: string | null };

interface InspectorState {
  target: InspectorTarget;
  selectTarget: (target: InspectorTarget) => void;
  /** Back to the default Scene Properties view — e.g. on scene switch, or when the editor selection leaves a Choice Block. */
  clearTarget: () => void;
}

export const useInspectorStore = create<InspectorState>((set) => ({
  target: { kind: "scene" },
  selectTarget: (target) => set({ target }),
  clearTarget: () => set({ target: { kind: "scene" } }),
}));
