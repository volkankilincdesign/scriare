import { EditorState } from "@tiptap/pm/state";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Editor, JSONContent } from "@tiptap/react";

/**
 * Loading a different document into the one live editor (v0.49.0).
 *
 * THE BUG THIS EXISTS TO FIX. Both editors reused a single Tiptap instance
 * across documents and swapped the content with
 * `editor.commands.setContent(...)`. That is the documented way to do it,
 * and it is wrong here for one reason: `setContent` sets `preventUpdate`
 * but NOT `addToHistory: false`, so replacing the whole document on a
 * scene switch becomes an ordinary undoable step in ProseMirror's history.
 * Undoing it restored the PREVIOUS scene's document into the CURRENT
 * scene's editor — and that undo is a normal `docChanged` transaction, so
 * `onUpdate` fired and persisted it. Measured, with no typing at all:
 *
 *   open scene one, switch to scene three, press Ctrl+Z
 *     scene three before : "three"
 *     editor.can().undo(): true      ← should be false on arrival
 *     scene three after  : "one"     ← scene one's text, written to scene three
 *
 * Autosave committed it 1.5 seconds later, and the app's own undo could
 * not repair it: `mergeLiveProse` deliberately keeps live prose over the
 * snapshot, so a project-level Ctrl+Z preserved the corruption. Anyone who
 * pressed Ctrl+Z after changing scenes hit this.
 *
 * WHY IT REPLACES THE STATE RATHER THAN DISPATCHING A TRANSACTION. Marking
 * the swap `addToHistory: false` is not enough on its own. That keeps the
 * swap itself out of the stack, but every step the writer took in the
 * PREVIOUS document is still in there, and prosemirror-history rebases
 * that stack through the replacement — so undo would still try to apply
 * the inverse of a sentence typed in scene one at mapped positions inside
 * scene three. The only correct answer is that the history belongs to the
 * document: a new document starts with none.
 *
 * `view.updateState` builds a fresh `EditorState` over the same plugins,
 * which resets every plugin's own state along with history — the speaker
 * decorations, the marker-style cache, the suggestion plugins. That is
 * correct rather than incidental: all of them derive from the document,
 * and this IS a different document. It also dispatches no transaction, so
 * nothing calls `onUpdate` and the swap cannot write itself back into the
 * store.
 */
export function loadDocumentIntoEditor(editor: Editor, content: JSONContent): void {
  const doc = ProseMirrorNode.fromJSON(editor.schema, content);
  editor.view.updateState(
    EditorState.create({
      doc,
      plugins: editor.state.plugins,
    }),
  );
}

/** What an editor shows when there is nothing to show. */
export const EMPTY_EDITOR_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };
