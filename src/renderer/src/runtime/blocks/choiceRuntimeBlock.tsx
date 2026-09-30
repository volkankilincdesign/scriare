import { generateHTML } from "@tiptap/core";
import type { JSONContent } from "@tiptap/react";
import type { ChoiceOption } from "../../utils/choiceBlocks";
import { readChoiceBlockOptions } from "../../utils/choiceBlocks";
import { RUNTIME_EXTENSIONS } from "../extensions";
import { evaluateConditions, lockSentence } from "../../types/variables";
import { resolveChoiceBox } from "../../types/choiceStyles";
import { boxClass } from "../../styles/choiceBoxLayer";
import type { RuntimeBlockDefinition, RuntimeContext } from "../types";

interface RuntimeChoiceOptionsProps {
  options: ChoiceOption[];
  context: RuntimeContext;
}

// Renders one Choice Block's options as buttons, exactly where the block
// sits in the document flow — not collected and moved to the bottom of the
// scene. Options with no destination set yet are skipped rather than shown
// as a dead button.
function RuntimeChoiceOptions({ options, context }: RuntimeChoiceOptionsProps) {
  const linkedOptions = options.filter((option) => option.targetSceneId);

  // Conditions are evaluated once, up here, rather than inside the map, so
  // the "is there anything to show at all" check sees the same answer the
  // buttons do — a block whose every option is hidden must render nothing,
  // not an empty gap where choices used to be.
  const evaluated = linkedOptions.map((option) => ({
    option,
    passes: evaluateConditions(option.conditions, context.variables, context.values),
  }));
  const visible = evaluated.filter((e) => e.passes || e.option.whenUnmet === "lock");
  if (visible.length === 0) return null;

  return (
    <div className="scriare-choices my-6 flex flex-col gap-2">
      {visible.map(({ option, passes }) =>
        passes ? (
          <button
            key={option.id}
            // v0.34.0 — the option's own box, resolved from the project's
            // named styles. An unstyled choice resolves to the Default
            // style, whose values are the theme variables this button used
            // to hard-code, so an untouched story looks exactly as it did.
            type="button"
            onClick={() => {
              // Actions run before the jump, same order a player reads them
              // in the Inspector ("picking this does X, then goes here") —
              // and it means goToScene's own scene-change render always sees
              // the already-updated variable values, never a stale frame.
              if (option.actions?.length) context.applyActions(option.actions);
              context.goToScene(option.targetSceneId as string);
            }}
            // v0.80.0 — the box is a class in a cascade layer rather than
            // an inline style, so a writer's stylesheet can reach it.
            // `border-solid` left with it: the generated rule sets the
            // border style, and a Tailwind utility is unlayered and would
            // have outranked it.
            className={`scriare-choice ${boxClass(resolveChoiceBox(context.choiceStyles, option.style))} px-4 py-2 text-left text-sm text-[var(--text)] transition-colors hover:brightness-110`}
          >
            <Label option={option} />
          </button>
        ) : (
          // A locked option stays a real <button>, disabled, rather than a
          // styled div: it keeps the same shape and rhythm in the column as
          // the choices around it, and a screen reader announces it as an
          // unavailable option rather than as stray prose.
          <button
            key={option.id}
            type="button"
            disabled
            // A locked choice keeps its own dashed, drained treatment —
            // that IS the information — but borrows the style's corner
            // radius so it still reads as one of the choices around it.
            className={`scriare-choice is-locked ${boxClass(resolveChoiceBox(context.choiceStyles, option.style))} cursor-not-allowed border border-dashed border-[var(--border-soft)] bg-transparent px-4 py-2 text-left text-sm text-[var(--text-3)]`}
          >
            <span className="flex items-center gap-2">
              <span aria-hidden>✕</span>
              <Label option={option} />
            </span>
            {/* The reason is the entire point of showing a locked option.
                Without it the player learns only that they failed at
                something unnamed, which is worse than not seeing it. */}
            {lockSentence(option.lockReason, option.conditions, context.variables) && (
              <span className="mt-0.5 block pl-5 text-xs text-[var(--text-3)]">
                {lockSentence(option.lockReason, option.conditions, context.variables)}
              </span>
            )}
          </button>
        ),
      )}
    </div>
  );
}

/**
 * A choice's label, with whatever formatting the writer gave it.
 *
 * Since v0.32.0 the label is inline content in the document rather than a
 * plain string, so it renders through the same `generateHTML` pass every
 * paragraph goes through — bold, colour, font and size all arrive for free,
 * and there is no second styling path to keep in step with the editor's.
 */
function Label({ option }: { option: ChoiceOption }) {
  const inline = option.node?.content as JSONContent[] | undefined;
  if (!inline || inline.length === 0) return <>Continue</>;
  try {
    const html = generateHTML({ type: "doc", content: [{ type: "paragraph", content: inline }] }, RUNTIME_EXTENSIONS);
    // The wrapping paragraph is stripped: a choice's label is a line inside
    // a button, not a block, and leaving it would inherit the prose column's
    // vertical rhythm inside a control.
    return <span dangerouslySetInnerHTML={{ __html: html.replace(/^<p>|<\/p>$/g, "") }} />;
  } catch {
    return <>{option.text || "Continue"}</>;
  }
}

/** The runtime's registration for Choice Blocks — see runtime/registry.ts. */
export const choiceRuntimeBlock: RuntimeBlockDefinition = {
  nodeType: "choiceBlock",
  render: (node, context, key) => (
    <RuntimeChoiceOptions key={key} options={readChoiceBlockOptions(node)} context={context} />
  ),
};
