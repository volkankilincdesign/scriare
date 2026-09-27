import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { DialogueBlockView } from "../components/editor/DialogueBlockView";
import { DIALOGUE_BLOCK_TYPE, DIALOGUE_LINE_TYPE } from "../types/nodeTypes";
import { buildDialogueBlockNode } from "../utils/dialogueBlocks";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    dialogueBlock: {
      insertDialogueBlock: () => ReturnType;
    };
  }
}

/**
 * The Dialogue — a conversation that stays on this page (v0.66.0).
 *
 * Structurally a twin of `choiceBlock`: a block that holds one or more
 * lines, each of which carries its own conditions, actions and style. The
 * difference is what a line MEANS. A choice option is a door out of the
 * scene; a dialogue line is something said inside it, and the scene only
 * turns if the line is explicitly marked to leave.
 *
 * Kept as its own node type rather than a flag on `choiceBlock` because
 * every surface downstream — Check Story, the Story Graph, Script Export,
 * both runtimes — has to be able to tell the two apart from the node name
 * alone. A flag would put that decision into every one of them.
 */
export const DialogueBlock = Node.create({
  name: DIALOGUE_BLOCK_TYPE,
  group: "block",
  content: `${DIALOGUE_LINE_TYPE}+`,
  defining: true,

  addAttributes() {
    return {
      blockId: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="dialogue-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "dialogue-block" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DialogueBlockView);
  },

  addCommands() {
    return {
      insertDialogueBlock:
        () =>
        ({ chain }) =>
          chain().insertContent(buildDialogueBlockNode()).run(),
    };
  },
});
