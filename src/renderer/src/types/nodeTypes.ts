/**
 * Document node type names, with no dependencies of their own.
 *
 * They used to live beside the code that reads each node (choiceBlocks,
 * Mention), which was fine until a leaf type module needed one: `speaker.ts`
 * has to know that a choice option can carry a speaker, and importing
 * `choiceBlocks` for a single string while `choiceBlocks` imports `speaker`
 * back is a module cycle — the kind that works until a bundler decides on a
 * different evaluation order and a constant is briefly undefined.
 *
 * A name is not behaviour. Names go here; the code that acts on them stays
 * where it is and re-exports these, so nothing that already imported
 * `CHOICE_BLOCK_TYPE` from `utils/choiceBlocks` has to change.
 */
export const CHOICE_BLOCK_TYPE = "choiceBlock";
export const CHOICE_OPTION_TYPE = "choiceOption";

/**
 * The Dialogue (v0.66.0) — a conversation that stays on the page.
 *
 * Named apart from `choiceBlock` on purpose. The two look alike in the
 * file and mean opposite things: a choice is a door out of the scene, a
 * dialogue line is something said inside it. Every place that asks "does
 * this scene lead anywhere" has to be able to tell them apart by the node
 * name alone, because that is the only thing it has.
 */
export const DIALOGUE_BLOCK_TYPE = "dialogueBlock";
export const DIALOGUE_LINE_TYPE = "dialogueLine";

/**
 * What happens once a line has been said.
 *
 *   stay  — the reply appends and the conversation carries on (default)
 *   end   — the reply appends, then the conversation closes and the rest
 *           of the page unfolds
 *   leave — an ordinary exit: the scene turns, and what is below the
 *           Dialogue is never seen
 */
export type DialogueAfter = "stay" | "end" | "leave";
