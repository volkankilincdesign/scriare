import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ConditionalBlockView } from "../components/editor/ConditionalBlockView";
import { nanoid } from "nanoid";
import { TextSelection } from "@tiptap/pm/state";
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

  // v0.78.0 — the third sibling gets the same treatment the other two
  // have: a real node view, so it can say how many conditions it has,
  // what they are, and where it ends. See ConditionalBlockView.
  addNodeView() {
    return ReactNodeViewRenderer(ConditionalBlockView);
  },

  addCommands() {
    return {
      /**
       * Inserts one AND PUTS THE CARET IN IT (v0.78.0).
       *
       * Its two siblings insert and stop, which is right for them: a
       * Choice and a Dialogue arrive holding a row each, and the writer
       * clicks the row they want. This one arrives holding an empty
       * paragraph, because it is a place to WRITE — so leaving the caret
       * outside means pressing the button and then typing into the page
       * behind the block. Measured on the first build of this button,
       * which did exactly that.
       *
       * The id is generated up front so the block can be found again
       * after the insert; `pos + 1` is inside the block and `+ 1` again
       * is inside its first paragraph.
       */
      insertConditionalBlock:
        () =>
        ({ chain }) => {
          const blockId = nanoid();
          return chain()
            .insertContent({
              type: this.name,
              attrs: { blockId, conditions: [] },
              content: [{ type: "paragraph" }],
            })
            .command(({ tr, dispatch }) => {
              let at = -1;
              tr.doc.descendants((node, pos) => {
                if (at !== -1) return false;
                if (node.type.name === "conditionalBlock" && node.attrs.blockId === blockId) {
                  at = pos + 2;
                  return false;
                }
                return true;
              });
              // Not found is not a failure — the block is in the document
              // either way, and refusing the whole chain would undo it.
              if (at === -1 || !dispatch) return true;
              dispatch(tr.setSelection(TextSelection.create(tr.doc, Math.min(at, tr.doc.content.size))));
              return true;
            })
            .run();
        },
    };
  },
});
