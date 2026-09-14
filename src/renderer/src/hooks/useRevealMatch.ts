import { useEffect } from "react";
import type { Editor } from "@tiptap/react";
import { useUIStore } from "../state/uiStore";

/**
 * Puts the caret on a match a writer clicked in Find (v0.38.0).
 *
 * Clicking a result does two things a beat apart: it opens the document,
 * and then — once that document is actually in the editor — it selects the
 * words. This hook is the second beat. It runs in whichever editor is
 * mounted, checks that the note left in the store names the document it
 * just loaded, and only then moves the caret.
 *
 * Selecting the match rather than merely scrolling to it is the point. A
 * writer clicks a search result because they intend to change those words;
 * landing with them selected means the next thing typed replaces them,
 * which is what every editor they have ever used does.
 *
 * Positions are clamped rather than trusted. They were computed from the
 * stored document, and between the click and this effect the writer could
 * have deleted half a scene in another window of their own making —
 * ProseMirror throws on an out-of-range selection, and a crash is a worse
 * answer to a stale position than a caret in roughly the right place.
 */
export function useRevealMatch(
  editor: Editor | null,
  document: { sceneId?: string | null; entityId?: string | null },
): void {
  const reveal = useUIStore((s) => s.reveal);
  const clearReveal = useUIStore((s) => s.clearReveal);
  const sceneId = document.sceneId ?? null;
  const entityId = document.entityId ?? null;

  useEffect(() => {
    if (!editor || !reveal) return;
    const mine =
      (reveal.sceneId !== null && reveal.sceneId === sceneId) ||
      (reveal.entityId !== null && reveal.entityId === entityId);
    if (!mine) return;

    const end = editor.state.doc.content.size;
    const from = Math.max(0, Math.min(reveal.from, end));
    const to = Math.max(from, Math.min(reveal.to, end));
    editor.chain().setTextSelection({ from, to }).scrollIntoView().focus().run();
    clearReveal();
  }, [editor, reveal, sceneId, entityId, clearReveal]);
}
