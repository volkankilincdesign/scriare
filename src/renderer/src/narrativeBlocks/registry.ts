import type { NarrativeBlockDefinition } from "./types";

/**
 * The catalog of Narrative Blocks available from the "/" slash menu. This is
 * the single place a new block plugs into the writing surface — Divider and
 * Quote just call the same commands the toolbar already uses (no new node
 * types), Choice inserts a Choice Block, and Callout wraps the current block
 * in a callout. Deliberately small for now, per the current milestone: only
 * these four. Future blocks (Variables, Conditions, Images, Dialogue, Audio,
 * embedded widgets, ...) are meant to slot in here the same way, each with
 * its own Tiptap extension registered alongside ChoiceBlock/Callout.
 */
export const NARRATIVE_BLOCKS: NarrativeBlockDefinition[] = [
  {
    id: "choice",
    title: "Choice",
    description: "Branch the story with one or more options",
    icon: "⤷",
    keywords: ["choice", "branch", "option", "decision", "path"],
    command: (editor, range) => editor.chain().focus().deleteRange(range).insertChoiceBlock().run(),
  },
  {
    id: "divider",
    title: "Divider",
    description: "A horizontal line to separate content",
    icon: "―",
    keywords: ["divider", "line", "separator", "hr", "break"],
    command: (editor, range) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    id: "quote",
    title: "Quote",
    description: "A block quotation",
    icon: "“",
    keywords: ["quote", "blockquote", "citation"],
    command: (editor, range) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    id: "conditional",
    title: "Conditional Text",
    description: "Prose that only appears when a condition holds",
    icon: "◇",
    keywords: ["condition", "conditional", "if", "gate", "variable", "state", "reactive"],
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).insertConditionalBlock().run(),
  },
  {
    id: "callout",
    title: "Callout",
    description: "A highlighted note or aside",
    icon: "💡",
    keywords: ["callout", "note", "aside", "highlight", "info", "tip"],
    command: (editor, range) => editor.chain().focus().deleteRange(range).toggleCallout().run(),
  },
];
