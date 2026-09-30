import type { JSONContent } from "@tiptap/react";
import { extractDialogueLines } from "../../utils/dialogueBlocks";
import type { DialogueLine } from "../../utils/dialogueBlocks";
import { evaluateConditions, lockSentence } from "../../types/variables";
import { resolveChoiceBox } from "../../types/choiceStyles";
import { boxClass } from "../../styles/choiceBoxLayer";
import { speakerName } from "../../types/speaker";
import type { RuntimeBlockDefinition, RuntimeContext } from "../types";

/**
 * A conversation, played (v0.66.0).
 *
 * Three rules, and they are the whole block:
 *
 *   1. SAID IS SPENT — a line said leaves the list, unless it is marked
 *      repeatable.
 *   2. EVERY LINE HAS AN AFTER — stay, end, or leave.
 *   3. THE PAGE WAITS — but that one is not here. It cannot be: a block
 *      cannot decide what is drawn after it. It lives in PlayRuntime and
 *      in the export's own runtime, which is exactly why this block
 *      reports `closed` through the context rather than keeping it to
 *      itself.
 *
 * WHAT IS NOT REMEMBERED, on purpose: leaving the scene and coming back
 * starts the conversation fresh. A conversation is a thing that happens
 * now, and the alternative — topics exhausted for the rest of the story —
 * is available to a writer already, with a variable and a condition, which
 * is what this block is sugar for. Making it the default would mean
 * persisting a set of line ids in the save file to buy a behaviour half of
 * all conversations do not want.
 */

function Said({
  who,
  line,
  isPlayer,
}: {
  who: string | null;
  line: string;
  isPlayer?: boolean;
}) {
  return (
    <div className="mb-3">
      {who && (
        <div className="scriare-speaker text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
          {who}
        </div>
      )}
      <p className={isPlayer ? "italic text-[var(--text-2)]" : "text-[var(--text-reading)]"}>
        {line}
      </p>
    </div>
  );
}

function RuntimeDialogue({
  blockId,
  lines,
  context,
}: {
  blockId: string;
  lines: DialogueLine[];
  context: RuntimeContext;
}) {
  const said = context.saidLines ?? {};
  const closed = Boolean(context.closedDialogues?.[blockId]);

  // The transcript is the lines said, in the order they were said — which
  // is why `context.transcript` keeps an ordered list rather than this
  // filtering `said` and hoping the object preserved insertion order.
  const spoken = (context.transcript ?? [])
    .map((id) => lines.find((l) => l.id === id))
    .filter((l): l is DialogueLine => Boolean(l));

  const offered = lines.filter((line) => {
    if (said[line.id] && !line.repeatable) return false;
    return true;
  });

  const evaluated = offered.map((line) => ({
    line,
    passes: evaluateConditions(line.conditions, context.variables, context.values),
  }));
  const visible = evaluated.filter((e) => e.passes || e.line.whenUnmet === "lock");

  // Nothing left to say closes the conversation by itself. Reported up
  // during render rather than in an effect because the page below must not
  // flash: the same pass that discovers there is nothing left is the pass
  // that has to let the rest of the scene through.
  if (visible.length === 0 && !closed) context.closeDialogue?.(blockId);

  function pick(line: DialogueLine): void {
    if (line.actions?.length) context.applyActions(line.actions);
    context.sayLine?.(line.id);
    if (line.after === "leave") {
      if (line.targetSceneId) context.goToScene(line.targetSceneId);
      return;
    }
    if (line.after === "end") context.closeDialogue?.(blockId);
  }

  return (
    <div className="scriare-dialogue my-6" data-dialogue={blockId} data-closed={closed ? "true" : "false"}>
      {spoken.map((line, i) => (
        <div key={`${line.id}-${i}`}>
          <Said who={speakerName(line.speaker, context.entities ?? [], context.playerName)} line={line.text} isPlayer />
          {line.after !== "leave" && line.reply && (
            <Said who={speakerName(line.replySpeaker, context.entities ?? [], context.playerName)} line={line.reply} />
          )}
        </div>
      ))}

      {!closed && visible.length > 0 && (
        <div className="scriare-choices flex flex-col gap-2">
          {visible.map(({ line, passes }) =>
            passes ? (
              <button
                key={line.id}
                type="button"
                data-dialogue-line={line.id}
                data-after={line.after}
                onClick={() => pick(line)}
                // v0.80.0 — the box is a CLASS now, not an inline style, so
                // a writer's own stylesheet can reach it. `rounded-md` and
                // `border` left with it: the generated rule owns the
                // radius, width and style, and a utility class is unlayered
                // so it would have outranked the layer they live in.
                className={`scriare-choice ${boxClass(resolveChoiceBox(context.choiceStyles, line.style))} w-full cursor-pointer px-4 py-2.5 text-left transition-colors hover:border-[var(--accent)]`}
              >
                {line.text || "…"}
              </button>
            ) : (
              <div
                key={line.id}
                data-dialogue-line={line.id}
                data-locked="true"
                className={`scriare-choice is-locked ${boxClass(resolveChoiceBox(context.choiceStyles, line.style))} w-full px-4 py-2.5 text-left opacity-60`}
              >
                <span>{line.text || "…"}</span>
                <span className="mt-1 block text-xs text-[var(--text-3)]">
                  {lockSentence(line.lockReason, line.conditions, context.variables)}
                </span>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

export const dialogueRuntimeBlock: RuntimeBlockDefinition = {
  nodeType: "dialogueBlock",
  render: (node: JSONContent, context: RuntimeContext, key: string | number) => {
    const lines = extractDialogueLines(node);
    if (lines.length === 0) return null;
    return (
      <RuntimeDialogue
        key={key}
        blockId={(node.attrs?.blockId as string) ?? String(key)}
        lines={lines}
        context={context}
      />
    );
  },
};

/**
 * Is this block still holding the page?
 *
 * The runtime asks this while walking segments, so the rule "nothing below
 * an open Dialogue is drawn" is answered in one place for both the React
 * runtime and anything else that walks the same list.
 */
export function dialogueHoldsPage(
  node: JSONContent,
  closed: Record<string, boolean>,
  variables: RuntimeContext["variables"],
  values: RuntimeContext["values"],
  said: Record<string, boolean>,
): boolean {
  const blockId = (node.attrs?.blockId as string) ?? "";
  if (closed[blockId]) return false;
  const lines = extractDialogueLines(node);
  if (lines.length === 0) return false;
  // A conversation with nothing left to offer is over even if nobody has
  // told the store yet — otherwise the page would be held for one render
  // by a block that is about to close itself.
  const remaining = lines.filter((line) => {
    if (said[line.id] && !line.repeatable) return false;
    return evaluateConditions(line.conditions, variables, values) || line.whenUnmet === "lock";
  });
  return remaining.length > 0;
}
