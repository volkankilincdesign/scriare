import type { ChoiceOption } from "../../utils/choiceBlocks";
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
  if (linkedOptions.length === 0) return null;

  return (
    <div className="my-6 flex flex-col gap-2">
      {linkedOptions.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => context.goToScene(option.targetSceneId as string)}
          className="rounded-md border border-zinc-700 bg-zinc-800/60 px-4 py-2 text-left text-sm text-zinc-100 hover:border-emerald-500 hover:bg-zinc-800"
        >
          {option.text || "Continue"}
        </button>
      ))}
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
