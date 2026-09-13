import { useEffect, useRef } from "react";
import { useProjectStore } from "../state/projectStore";
import { useSelectionStore } from "../state/selectionStore";
import { useToastStore } from "../state/toastStore";
import { ownsEditingKeys } from "../utils/keyboardFocus";
import {
  buildClipboard,
  describeClipboard,
  type ContentClipboard,
} from "../utils/contentClipboard";

/**
 * App-wide Ctrl+C / Ctrl+X / Ctrl+V / Delete for scenes and folders
 * (v0.27.0), alongside v0.25.0's Ctrl+Z.
 *
 * Until now these keys did nothing outside the text editor, which made the
 * Content Browser the one part of the app that didn't behave like a file
 * manager — everything had to go through the right-click menu. The rule
 * for when they apply is the same one undo uses: if focus is in a text
 * field or the editor, the keys belong to that field (see
 * utils/keyboardFocus.ts); anywhere else they're about the project.
 *
 * WHICH selection they act on is the other half, and it's decided by
 * `selectionStore` — the panel you touched last owns the keyboard. Both
 * the Content Browser and the Story Graph keep their selection visible at
 * the same time on purpose, so "the visible selection" isn't a single
 * thing and something has to arbitrate.
 *
 * Every one of these is undoable, and a destructive one raises the same
 * undo toast the right-click menu does, so there's no path through the app
 * where a delete is quieter or less reversible than another.
 */
export function useKeyboardClipboard(): void {
  // The clipboard is a ref, not state: nothing renders differently because
  // something was copied, and making it state would re-render the whole
  // app on every Ctrl+C for no visible effect.
  const clipboardRef = useRef<ContentClipboard | null>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.altKey) return;
      if (ownsEditingKeys(event.target)) return;

      const project = useProjectStore.getState().project;
      if (!project || useProjectStore.getState().isPlaying) return;

      const { surface, contentIds, graphIds } = useSelectionStore.getState();

      // A graph selection can hold frame ids as well as scene ids; only the
      // scenes are content nodes, and frames are left out of copy/paste
      // entirely — a frame is a piece of canvas layout, and pasting one
      // into the Content Browser has no meaning.
      const sceneIdSet = new Set(project.scenes.map((s) => s.id));
      const selectedIds =
        surface === "graph" ? graphIds.filter((id) => sceneIdSet.has(id)) : contentIds;

      const key = event.key.toLowerCase();
      const modifier = event.ctrlKey || event.metaKey;

      if (!modifier && (event.key === "Delete" || event.key === "Backspace")) {
        if (selectedIds.length === 0) return;
        event.preventDefault();
        deleteSelection(selectedIds);
        return;
      }

      if (!modifier) return;

      if (key === "c" || key === "x") {
        if (selectedIds.length === 0) return;
        const clipboard = buildClipboard(project, selectedIds);
        if (!clipboard) return;
        event.preventDefault();
        clipboardRef.current = clipboard;
        if (key === "x") deleteSelection(selectedIds, `Cut ${describeClipboard(clipboard)}`);
        return;
      }

      if (key === "v") {
        const clipboard = clipboardRef.current;
        if (!clipboard) return;
        event.preventDefault();

        // Pasting "into" a single selected folder is what a file manager
        // does and what the drag-and-drop in this panel already does.
        // Anything else pastes alongside the selection, so a paste never
        // silently buries itself somewhere the writer wasn't looking.
        const first = contentIds.length > 0 ? contentIds[0] : null;
        const firstNode = first ? project.content.find((n) => n.id === first) : undefined;
        const destination =
          surface === "content" && contentIds.length === 1 && firstNode?.kind === "folder"
            ? firstNode.id
            : firstNode?.parentId ?? null;

        const pasted = useProjectStore.getState().pasteContentNodes(clipboard, destination);
        if (pasted.length === 0) return;
        useToastStore.getState().showUndo(`Pasted ${describeClipboard(clipboard)}`);
        return;
      }
    }

    function deleteSelection(ids: string[], message?: string): void {
      const project = useProjectStore.getState().project;
      if (!project) return;

      // Mirrors the right-click menu's wording so the same operation reads
      // the same way however it was invoked.
      const single = ids.length === 1 ? project.content.find((n) => n.id === ids[0]) : undefined;
      const name =
        single?.kind === "folder"
          ? `folder "${single.name}"`
          : single
            ? `"${project.scenes.find((s) => s.id === single.id)?.title || "Untitled scene"}"`
            : `${ids.length} items`;

      useProjectStore.getState().deleteContentNodes(ids);
      useToastStore.getState().showUndo(message ?? `Deleted ${name}`);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
