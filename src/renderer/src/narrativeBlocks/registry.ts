import type { NarrativeBlockDefinition } from "./types";

/**
 * The catalog of Narrative Blocks available from the "/" slash menu, and
 * since v0.81.0 the single place the app says what each block IS.
 *
 * Every surface a writer can meet a block on reads from here: the slash
 * menu's description, the toolbar button's tooltip, the empty state inside
 * a block that has nothing in it yet, and the "How Scriare works" panel.
 * They were typed separately before, and they disagreed — which matters
 * most for exactly the person this text exists for, because a newcomer
 * meeting two descriptions of one thing concludes there are two things. This is
 * the single place a new block plugs into the writing surface — Divider and
 * Quote just call the same commands the toolbar already uses (no new node
 * types), Choice inserts a Choice Block, and Callout wraps the current block
 * in a callout. Deliberately small for now, per the current milestone: only
 * these four. Future blocks (Variables, Images, Audio,
 * embedded widgets, ...) are meant to slot in here the same way, each with
 * its own Tiptap extension registered alongside ChoiceBlock/Callout.
 */
export const NARRATIVE_BLOCKS: NarrativeBlockDefinition[] = [
  {
    id: "choice",
    title: "Choice",
    description: "The story branches — the reader picks one and moves on",
    tagline: "the page turns here",
    teaches:
      "The reader picks one option and the page turns. Every option points at another scene, so a Choice is where your story forks.",
    icon: "⤷",
    keywords: ["choice", "branch", "option", "decision", "path"],
    command: (editor, range) => editor.chain().focus().deleteRange(range).insertChoiceBlock().run(),
  },
  {
    id: "dialogue",
    title: "Dialogue",
    description: "A conversation that stays on this page",
    tagline: "stays on this page",
    teaches:
      "The reader picks what to say and the answer appears underneath, without leaving the scene. A line is spent once it has been said, so a conversation runs out rather than repeating.",
    icon: "◆",
    keywords: ["dialogue", "conversation", "talk", "ask", "topic", "speak", "reply", "in-place"],
    command: (editor, range) => editor.chain().focus().deleteRange(range).insertDialogueBlock().run(),
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
    // v0.78.0 — "Conditional", the one word the toolbar button, the
    // block's own header and the Inspector all use. This was the last
    // place still saying "Conditional Text", and the menu is exactly
    // where a name being inconsistent does the most damage: it is how a
    // writer meets the block for the first time.
    title: "Conditional",
    // ONE SENTENCE, and this is the one. It used to differ from the
    // toolbar button's tooltip, which said "a passage that only appears
    // sometimes" — near enough that nobody noticed, and far enough that a
    // writer met two descriptions of one thing.
    description: "A passage that only appears sometimes",
    tagline: "appears sometimes",
    teaches:
      "Prose that appears only when a condition holds, so one scene can read differently depending on what has already happened. It holds writing rather than options — that is what makes it the lightest of the three.",
    icon: "◇",
    // `text` kept as a KEYWORD although it left the title. The menu
    // matches on title as well as keywords, so until now typing `/text`
    // found this block; renaming without this line would quietly break a
    // habit somebody may already have, which is a worse trade than one
    // extra word in a list nobody reads.
    keywords: ["condition", "conditional", "if", "gate", "variable", "state", "reactive", "text"],
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

/**
 * The block types that have something to teach — the three a writer has to
 * be told about, in the order the toolbar draws them.
 *
 * Derived from `teaches` rather than from a list of ids, so the panel and
 * the empty states cannot fall out of step with the catalog: a fourth
 * block type is in both the moment its sentence is written, and a block
 * with no sentence is in neither.
 */
export const STORY_BLOCKS = NARRATIVE_BLOCKS.filter((block) => Boolean(block.teaches));

/** What a toolbar button says on hover. One sentence, from one place. */
export function blockTooltip(id: string): string {
  const block = NARRATIVE_BLOCKS.find((b) => b.id === id);
  return block ? `${block.title} — ${block.description}` : "";
}

/** The words after a block's name in its own header. */
export function blockTagline(id: string): string {
  return NARRATIVE_BLOCKS.find((b) => b.id === id)?.tagline ?? "";
}
