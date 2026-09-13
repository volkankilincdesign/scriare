import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ChoiceBlockView } from "../components/editor/ChoiceBlockView";
import { buildChoiceBlockNode } from "../utils/choiceBlocks";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    choiceBlock: {
      insertChoiceBlock: () => ReturnType;
    };
  }
}

/**
 * A Choice Block — one branching point, holding one or more options.
 *
 * As of v0.32.0 this is a CONTAINER, not an atom. It used to hold its whole
 * option list as a plain array in a node attribute, labels included, which
 * meant a choice's text wasn't text as far as the editor was concerned: the
 * toolbar couldn't touch it, undo didn't see it, and Play Mode needed its
 * own path to render it. Now each option is a real `choiceOption` node with
 * inline content (see ChoiceOption.ts), so a label is the same kind of
 * thing as a sentence and everything the editor already does to a sentence
 * works on it for free.
 *
 * Writers insert this directly into the document — that's what makes
 * branching feel like a writing action rather than a separate system, and
 * what lets one block offer several options without becoming several
 * blocks.
 */
export const ChoiceBlock = Node.create({
  name: "choiceBlock",
  group: "block",
  content: "choiceOption+",
  defining: true,

  addAttributes() {
    return {
      blockId: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="choice-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "choice-block" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ChoiceBlockView);
  },

  addCommands() {
    return {
      insertChoiceBlock:
        () =>
        ({ chain }) =>
          chain().insertContent(buildChoiceBlockNode()).run(),
    };
  },
});
