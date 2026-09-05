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

// A Choice Block is an atomic block node holding one or more options — each
// option is `{ id, text, targetSceneId }`. It renders no editable rich-text
// content of its own; a React NodeView (ChoiceBlockView) supplies the whole
// UI (one row per option, add/remove/reorder). Writers insert it directly
// into the document — this is what makes branching feel like a writing
// action instead of a separate system, and lets a single Choice Block offer
// several options without becoming several blocks.
export const ChoiceBlock = Node.create({
  name: "choiceBlock",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      blockId: { default: null },
      options: { default: [] },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="choice-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "choice-block" })];
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
