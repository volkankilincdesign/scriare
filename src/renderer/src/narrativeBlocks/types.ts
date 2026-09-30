import type { Editor, Range } from "@tiptap/core";

/**
 * A single entry in the Narrative Blocks catalog — what the "/" slash menu
 * lists and what a slash-menu selection actually runs. This is the whole
 * extension point: a future block (Variables, Images, Dialogue, Audio,
 * embedded widgets, ...) is one more entry here plus its own Tiptap
 * extension registered in SceneEditor, plus a runtime registry entry in
 * runtime/registry.ts if it needs special playback behavior — nothing about
 * the slash menu, its filtering, or its keyboard handling needs to change.
 */
export interface NarrativeBlockDefinition {
  /** Stable id — also used as the React key in the slash menu. */
  id: string;
  /** Shown in the slash menu. */
  title: string;
  /**
   * One line, and the ONLY sentence the app uses to say what this block is
   * (v0.81.0). The slash menu prints it under the title and the toolbar
   * button's tooltip is `title — description`, because until now those two
   * places were typed separately and disagreed: the Conditional was "a
   * passage that only appears sometimes" on the button and "Prose that only
   * appears when a condition holds" in the menu, and the Choice button said
   * "Insert a Choice Block" — the app repeating its own noun back at the
   * one person who does not know it yet.
   */
  description: string;
  /**
   * What this block IS, for somebody who has never seen one (v0.81.0).
   * Two sentences at most: what the reader experiences, then the one fact
   * that distinguishes it from its siblings.
   *
   * ITS PRESENCE IS THE MARKER. The three story blocks have it; Divider,
   * Quote and Callout do not, because a horizontal line explains itself.
   * "How Scriare works" lists exactly the entries that carry one and the
   * empty states read from the same field, so a fourth block type joins
   * both by having its sentence written — rather than by someone
   * remembering to add its id to a list somewhere else.
   */
  teaches?: string;
  /**
   * The four-or-five words a block's own header wears, after its name
   * (v0.81.0). The Dialogue has said "— stays on this page" since v0.66.0
   * and the Conditional "— appears sometimes" since v0.78.0; the Choice
   * had none, which left the one a newcomer meets FIRST as the only
   * member of the family that did not say what it was.
   *
   * They are written as a set rather than one at a time, because their
   * job is the contrast: "the page turns here" against "stays on this
   * page" teaches the distinction between the two blocks in four words,
   * and neither sentence does that alone.
   */
  tagline?: string;
  /** A single character/emoji shown as the menu item's icon. */
  icon: string;
  /** Extra terms the slash query can match against, beyond the title. */
  keywords: string[];
  /** Runs when this item is chosen — replaces the "/query" text and inserts the block. */
  command: (editor: Editor, range: Range) => void;
}
