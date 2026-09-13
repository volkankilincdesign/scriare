import type { JSONContent } from "@tiptap/react";
import { generateHTML } from "@tiptap/core";
import type { VariableCondition } from "../../types/variables";
import { evaluateConditions } from "../../types/variables";
import type { RuntimeBlockDefinition, RuntimeContext } from "../types";
import { READING_PROSE_CLASS } from "../../utils/readingColumn";
import { RUNTIME_EXTENSIONS } from "../extensions";

interface ConditionalProps {
  conditions: VariableCondition[];
  content: JSONContent[];
  context: RuntimeContext;
}

/**
 * A run of prose that only appears when its conditions hold — the other
 * half of what conditions are for. Gating a *choice* changes where the
 * story can go; gating a *paragraph* changes how it reads, which is how a
 * scene reflects what the player has already done without branching into a
 * separate scene for every combination.
 *
 * When the conditions fail this renders nothing at all — no placeholder, no
 * gap. There is deliberately no "locked" variant here the way there is for
 * a choice: a greyed-out paragraph saying "you don't know this yet" tells
 * the player something the writer specifically chose not to tell them.
 */
function ConditionalText({ conditions, content, context }: ConditionalProps) {
  if (!evaluateConditions(conditions, context.variables, context.values)) return null;
  if (content.length === 0) return null;

  const html = generateHTML({ type: "doc", content }, RUNTIME_EXTENSIONS);
  return <div className={READING_PROSE_CLASS} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** The runtime's registration for Conditional Blocks — see runtime/registry.ts. */
export const conditionalRuntimeBlock: RuntimeBlockDefinition = {
  nodeType: "conditionalBlock",
  render: (node, context, key) => (
    <ConditionalText
      key={key}
      conditions={(node.attrs?.conditions as VariableCondition[] | undefined) ?? []}
      content={node.content ?? []}
      context={context}
    />
  ),
};
