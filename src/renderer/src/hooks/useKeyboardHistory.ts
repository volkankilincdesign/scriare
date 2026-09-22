import { useEffect } from "react";
import { useProjectStore } from "../state/projectStore";
import { aDialogIsOpen } from "../utils/keyboardFocus";

/**
 * Returns true for anything that owns its own undo: the Tiptap editor
 * (contenteditable), and any plain text field.
 *
 * This is the seam between Scriare's two undo stacks (see state/history.ts).
 * Ctrl+Z with the caret in a scene is about the sentence being written, and
 * belongs to Tiptap's history; Ctrl+Z anywhere else — the Content Browser,
 * the graph, the Inspector, a panel's empty space — is about the project,
 * and belongs to the store's. Routing by focus rather than by a mode flag
 * means the rule matches where the writer is actually looking.
 *
 * `isContentEditable` is true for any element inside a contenteditable
 * region, so this covers a caret anywhere in the document, not just the
 * editor's root element.
 */
function ownsItsOwnUndo(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/** Wires Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (plus Ctrl+Y on Windows) to project undo/redo. */
export function useKeyboardHistory(): void {
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (!event.ctrlKey && !event.metaKey) return;
      if (event.altKey) return;
      // A dialog owns the keyboard while it is up — see
      // utils/keyboardFocus.ts's aDialogIsOpen.
      if (aDialogIsOpen()) return;
      if (ownsItsOwnUndo(event.target)) return;

      const key = event.key.toLowerCase();

      // Ctrl+Y is the Windows convention for redo and does nothing else
      // here; macOS uses Cmd+Shift+Z and has no Cmd+Y binding to clash with.
      if (key === "y") {
        event.preventDefault();
        redo();
        return;
      }

      if (key !== "z") return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);
}
