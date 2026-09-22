import { aModalIsOpen } from "../components/common/Modal";

/**
 * Whether a keyboard event landed somewhere that already owns the standard
 * editing shortcuts — the Tiptap editor, or any plain text field.
 *
 * This is the seam every app-wide shortcut routes through. Ctrl+Z with the
 * caret in a scene is about the sentence being written and belongs to
 * Tiptap's history; Ctrl+C in a rename field is about the three characters
 * you selected, not about the scene. Anywhere else — the Content Browser,
 * the graph, the Inspector, a panel's empty space — the same keys are
 * about the project, and the app handles them.
 *
 * Routing by focus rather than by a mode flag means the rule always
 * matches where the writer is actually looking, and it needs no state.
 *
 * `isContentEditable` is true for any element inside a contenteditable
 * region, so a caret anywhere in the document counts, not just the
 * editor's root element.
 */
export function ownsEditingKeys(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * Whether an app-wide shortcut should stand down because a dialog is open
 * (v0.49.0).
 *
 * `ownsEditingKeys` routes by FOCUS, which is the right rule for telling a
 * text field's Ctrl+C from the project's — and it has nothing to say about
 * a modal, because a modal is not a focus target. So every shortcut in the
 * app fired straight through an open dialog, at the selection behind it.
 * Measured: with Check Story open and three scenes selected, pressing
 * Delete removed them — `content.length` 4 → 3 — behind the backdrop,
 * raising an undo toast that rendered underneath it. Ctrl+F with the
 * Variable Manager open moved focus into the Content panel's search box
 * behind the scrim, so everything typed afterwards went somewhere
 * invisible. Ctrl+Z behind the conflict dialog undid a structural change
 * the writer could not see AND armed an autosave, which is how a resolved
 * conflict could immediately raise a second, spurious one.
 *
 * One gate, consulted by all of them, rather than each hook growing its
 * own idea of what "a dialog" is. A dialog's own keys still work: Modal
 * binds Escape and Enter itself, and a field inside it is a focus target
 * like any other.
 */
export function aDialogIsOpen(): boolean {
  return aModalIsOpen();
}
