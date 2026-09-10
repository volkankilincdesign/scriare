import type { ReactNode } from "react";
import type { JSONContent } from "@tiptap/react";
import type { VariableAction } from "../types/variables";

/**
 * The minimal set of capabilities a runtime block's render function can call
 * back into the player with — "jump to another scene" (what Choice needs),
 * and, as of Sprint 9A, "run these Variable Actions" (what a Choice's
 * Actions need — see choiceRuntimeBlock.tsx). Extending this object is how
 * a future block (Conditions, Characters, ...) gains a new capability
 * without changing every existing block's signature; Sprint 9B's
 * Conditions will most likely add a `getVariable` read-side counterpart to
 * `applyActions` here.
 */
export interface RuntimeContext {
  goToScene: (sceneId: string) => void;
  applyActions: (actions: VariableAction[]) => void;
}

/**
 * One narrative block's runtime behavior — the playback-side counterpart to
 * narrativeBlocks' `NarrativeBlockDefinition` (which governs *authoring* a
 * block from the slash menu). Registering one more entry in
 * `runtime/registry.ts` is the only thing a future block (Variables,
 * Conditions, Images, Dialogue, Embedded widgets, ...) needs in order to
 * render correctly during Play — the player's core render loop
 * (`PlayRuntime.tsx` + `documentSegments.ts`) never has to change.
 */
export interface RuntimeBlockDefinition {
  /** The Tiptap node type this renderer owns, e.g. "choiceBlock". */
  nodeType: string;
  /** Renders one instance of this block during Play, given its raw node JSON. */
  render: (node: JSONContent, context: RuntimeContext, key: string | number) => ReactNode;
}
