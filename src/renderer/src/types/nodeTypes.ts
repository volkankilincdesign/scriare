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
