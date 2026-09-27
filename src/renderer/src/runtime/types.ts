import type { ReactNode } from "react";
import type { JSONContent } from "@tiptap/react";
import type { Variable, VariableAction, VariableValue } from "../types/variables";
import type { ChoiceStyle } from "../types/choiceStyles";
import type { Entity } from "../types/entities";

/**
 * The minimal set of capabilities a runtime block's render function can call
 * back into the player with — "jump to another scene" (what Choice needs),
 * and, as of Sprint 9A, "run these Variable Actions" (what a Choice's
 * Actions need — see choiceRuntimeBlock.tsx). Extending this object is how
 * a future block (Conditions, Characters, ...) gains a new capability
 * without changing every existing block's signature.
 *
 * v0.30.0 added the read side the comment above predicted, as `variables`
 * and `values` rather than a `getVariable` function: a block that renders
 * conditionally needs the whole picture to decide what to show, and
 * handing it the two arrays lets it call the same pure `evaluateConditions`
 * the rest of the app uses instead of a runtime-only accessor that would
 * have to be kept in step.
 */
export interface RuntimeContext {
  goToScene: (sceneId: string) => void;
  applyActions: (actions: VariableAction[]) => void;
  /** The project's variable definitions — names, types, defaults. */
  variables: Variable[];
  /** Their live values in THIS playthrough. */
  values: Record<string, VariableValue>;
  /**
   * v0.34.0 — the project's named Choice Styles. Passed rather than looked
   * up from the store inside the block for the same reason `variables` is:
   * a runtime block renders from what it is handed, which is what makes it
   * testable and what will let this same renderer run outside the app when
   * Export arrives.
   */
  choiceStyles: ChoiceStyle[];
  /**
   * v0.66.0 — what the Dialogue needs, and nothing the other blocks use.
   *
   * It lives on the shared context rather than inside the block because
   * the rule "nothing below an open conversation is drawn" belongs to
   * whoever walks the scene's segments, not to the block — a block cannot
   * decide what is rendered after it.
   *
   * Optional so that anything constructing a context for a narrower
   * purpose (a test, a future preview) is not forced to invent
   * conversation state it has no use for.
   */
  entities?: Entity[];
  /** Line ids said in this visit to the scene. */
  saidLines?: Record<string, boolean>;
  /** The same ids in the order they were said — the transcript. */
  transcript?: string[];
  /** Blocks whose conversation has closed. */
  closedDialogues?: Record<string, boolean>;
  sayLine?: (lineId: string) => void;
  closeDialogue?: (blockId: string) => void;
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
