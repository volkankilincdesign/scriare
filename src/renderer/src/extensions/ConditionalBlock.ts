import { Node, mergeAttributes } from "@tiptap/core";
import { nanoid } from "nanoid";
import type { VariableCondition } from "../types/variables";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    conditionalBlock: {
      insertConditionalBlock: () => ReturnType;
    };
  }
}

/**
 * A run of prose that only appears when its conditions hold (v0.30.0).
 *
 * Structurally this is a Callout — a container for ordinary block content —
 * with one extra attribute. That is deliberate: gating a paragraph should
 * not change how it is written, only whether it is read, so everything
 * inside behaves like any other part of the document (bold, headings,
 * lists, even a Choice Block nested inside a conditional section all work
 * without this file knowing about any of them).
 *
 * The conditions themselves live in an attribute rather than in the
 * document body, for the same reason a Choice Block's options do: they are
 * structured data a writer edits through controls in the Inspector, not
 * text they type into the flow of the scene.
 *
 * `blockId` gives the Inspector something stable to target, exactly as
 * ChoiceBlock's does.
 */
export const ConditionalBlock = Node.create({
  name: "conditionalBlock",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      blockId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-block-id"),
        renderHTML: (attributes) => ({ "data-block-id": attributes.blockId }),
      },
      conditions: {
        default: [] as VariableCondition[],
        // Serialised into a data attribute so a round-trip through HTML
        // (which Play Mode's static render does) doesn't lose them.
        parseHTML: (element) => {
          try {
            return JSON.parse(element.getAttribute("data-conditions") ?? "[]");
          } catch {
            return [];
          }
        },
        renderHTML: (attributes) => ({
          "data-conditions": JSON.stringify(attributes.conditions ?? []),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="conditional-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "conditional-block" }), 0];
  },

  addCommands() {
    return {
      insertConditionalBlock:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { blockId: nanoid(), conditions: [] },
            content: [{ type: "paragraph" }],
          }),
    };
  },
});
