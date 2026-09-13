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
