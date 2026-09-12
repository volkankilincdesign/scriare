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
  | { kind: "choice"; sceneId: string; blockId: string };

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
