import { useEffect, useRef } from "react";
import type { Editor } from "@tiptap/react";
import { useUIStore } from "../state/uiStore";
import { REVEAL_FLASH_MS, revealFlashKey } from "../extensions/RevealFlash";
import { idAttrFor } from "../utils/contentIds";

/**
 * Finds a node by its stable id, and says where it is (v0.77.0).
 *
 * Exported so a spec can ask the question directly — the alternative is a
 * test that clicks a row and infers the position from a scroll offset,
 * which measures the browser rather than the app.
 */
export function positionOfNode(
  editor: Editor,
  nodeId: string,
): { from: number; to: number } | null {
  let found: { from: number; to: number } | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (found) return false;
    // Asked of contentIds rather than read off `attrs.id`, which no node
    // type in this app uses — see its "one namespace for all five" note.
    // A finding can carry a paragraph's `lineId`, a block's `blockId` or
    // an option's `optionId`, and they all arrive here as one string.
    const attr = idAttrFor(node.type.name);
    if (attr && node.attrs?.[attr] === nodeId) {
      found = { from: pos, to: pos + node.nodeSize };
      return false;
    }
    return true;
  });
  return found;
}

/**
 * Puts the caret on a match a writer clicked in Find (v0.38.0), or on the
 * thing a Check Story finding named (v0.77.0).
 *
 * Clicking a result does two things a beat apart: it opens the document,
 * and then — once that document is actually in the editor — it goes to the
 * place. This hook is the second beat. It runs in whichever editor is
 * mounted, checks that the note left in the store names the document it
 * just loaded, and only then moves.
 *
 * TWO CALLERS, TWO BEHAVIOURS, and the difference is the point.
 *
 * Find SELECTS its match. A writer clicks a search result because they
 * intend to change those words; landing with them selected means the next
 * thing typed replaces them, which is what every editor they have ever used
 * does. It arrives with POSITIONS, because a match is a range of characters
 * with no identity.
 *
 * Check Story arrives with a NODE ID and leaves the caret collapsed at the
 * start of that node, marking it instead (see extensions/RevealFlash.ts). A
 * finding is something to look at before deciding, and a whole Choice Block
 * arriving selected means one keystroke deletes it. The id rather than a
 * position because a finding is about an object — this choice, this line —
 * and an id survives the writer inserting a sentence above it.
 *
 * Positions are clamped rather than trusted. They were computed from the
 * stored document, and between the click and this effect the writer could
 * have deleted half a scene — ProseMirror throws on an out-of-range
 * selection, and a crash is a worse answer to a stale position than a caret
 * in roughly the right place. An id that no longer resolves is the same
 * question with an easier answer: the scene is open, which is most of what
 * was asked for, and nothing is marked.
 */
export function useRevealMatch(
  editor: Editor | null,
  document: { sceneId?: string | null; entityId?: string | null },
): void {
  const reveal = useUIStore((s) => s.reveal);
  const clearReveal = useUIStore((s) => s.clearReveal);
  const sceneId = document.sceneId ?? null;
  const entityId = document.entityId ?? null;
  // Outside the effect on purpose — see the note where it is set.
  const fadeTimer = useRef<number | undefined>(undefined);

  // The one cleanup that is right: on unmount, nothing should still be
  // waiting to dispatch into an editor this component owned.
  useEffect(() => () => window.clearTimeout(fadeTimer.current), []);

  useEffect(() => {
    if (!editor || !reveal) return;
    const mine =
      (reveal.sceneId !== null && reveal.sceneId === sceneId) ||
      (reveal.entityId !== null && reveal.entityId === entityId);
    if (!mine) return;

    if (reveal.nodeId) {
      const at = positionOfNode(editor, reveal.nodeId);
      clearReveal();
      // The scene is open either way. A finding whose node has since been
      // deleted lands the writer in the right scene with nothing marked,
      // which is the honest answer rather than an error.
      if (!at) return;
      editor
        .chain()
        // `from + 1` is inside the node rather than before it, so the caret
        // lands in the thing instead of between it and its neighbour.
        .setTextSelection(at.from + 1)
        .focus()
        .run();
      editor.view.dispatch(
        editor.state.tr.setMeta(revealFlashKey, at).setMeta("addToHistory", false),
      );

      // THE DOM NODE, NOT THE SELECTION. The chain's own `.scrollIntoView()`
      // is what Find uses and it did nothing here — measured: the mark
      // landed correctly and the line stayed 2176px down a scroller that
      // never moved. ProseMirror scrolls the selection into view, and a
      // collapsed caret that the view has not drawn yet gives it nothing to
      // scroll to; Find gets away with it because its selection spans real
      // text. Asking the element directly also lets it be CENTRED rather
      // than dragged just inside the edge, which matters when the answer to
      // "which one" is the line's neighbours as much as the line.
      const dom = editor.view.nodeDOM(at.from);
      if (dom instanceof HTMLElement) {
        dom.scrollIntoView({ block: "center", behavior: "smooth" });
      }

      // Cleared on a handle that OUTLIVES this effect. The obvious version
      // returns `() => clearTimeout(timer)`, and that cancels the fade
      // every time: `clearReveal()` above changes the store, the effect
      // re-runs, React tears the old one down and the timer dies with it.
      // Measured — the mark stayed on screen indefinitely.
      window.clearTimeout(fadeTimer.current);
      fadeTimer.current = window.setTimeout(() => {
        // The editor can be gone by now — the writer opens another scene,
        // or closes the project — and dispatching into a destroyed view
        // throws.
        if (editor.isDestroyed) return;
        editor.view.dispatch(
          editor.state.tr.setMeta(revealFlashKey, null).setMeta("addToHistory", false),
        );
      }, REVEAL_FLASH_MS);
      return;
    }

    const end = editor.state.doc.content.size;
    const from = Math.max(0, Math.min(reveal.from, end));
    const to = Math.max(from, Math.min(reveal.to, end));
    editor.chain().setTextSelection({ from, to }).scrollIntoView().focus().run();
    clearReveal();
    return;
  }, [editor, reveal, sceneId, entityId, clearReveal]);
}
