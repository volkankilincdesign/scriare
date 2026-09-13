import type { ChoiceOption } from "../../utils/choiceBlocks";
import { describeCondition, evaluateConditions } from "../../types/variables";
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
    <div className="my-6 flex flex-col gap-2">
      {visible.map(({ option, passes }) =>
        passes ? (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              // Actions run before the jump, same order a player reads them
              // in the Inspector ("picking this does X, then goes here") —
              // and it means goToScene's own scene-change render always sees
              // the already-updated variable values, never a stale frame.
              if (option.actions?.length) context.applyActions(option.actions);
              context.goToScene(option.targetSceneId as string);
            }}
            className="rounded-md border border-[var(--border)] bg-[var(--surface-2-translucent)] px-4 py-2 text-left text-sm text-[var(--text)] hover:border-[var(--accent)] hover:bg-[var(--surface-2)]"
          >
            {option.text || "Continue"}
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
            className="cursor-not-allowed rounded-md border border-dashed border-[var(--border-soft)] bg-transparent px-4 py-2 text-left text-sm text-[var(--text-3)]"
          >
            <span className="flex items-center gap-2">
              <span aria-hidden>✕</span>
              <span>{option.text || "Continue"}</span>
            </span>
            {/* The reason is the entire point of showing a locked option.
                Without it the player learns only that they failed at
                something unnamed, which is worse than not seeing it. */}
            {option.conditions.length > 0 && (
              <span className="mt-0.5 block pl-5 text-xs text-[var(--text-3)]">
                Requires{" "}
                {option.conditions
                  .map((condition) => describeCondition(condition, context.variables))
                  .join(", and ")}
              </span>
            )}
          </button>
        ),
      )}
    </div>
  );
}

/** The runtime's registration for Choice Blocks — see runtime/registry.ts. */
export const choiceRuntimeBlock: RuntimeBlockDefinition = {
  nodeType: "choiceBlock",
  render: (node, context, key) => {
    const options = (node.attrs?.options as ChoiceOption[] | undefined) ?? [];
    return <RuntimeChoiceOptions key={key} options={options} context={context} />;
  },
};
