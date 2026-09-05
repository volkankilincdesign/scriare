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
  /** One-line description shown under the title in the slash menu. */
  description: string;
  /** A single character/emoji shown as the menu item's icon. */
  icon: string;
  /** Extra terms the slash query can match against, beyond the title. */
  keywords: string[];
  /** Runs when this item is chosen — replaces the "/query" text and inserts the block. */
  command: (editor: Editor, range: Range) => void;
}
