import { useEffect } from "react";
import { useUIStore } from "../state/uiStore";

/**
 * Ctrl+F / Cmd+F — put the caret in the Content Browser's search box.
 *
 * It works from anywhere, including from inside the editor, which is the
 * point: Find is reached at the moment you're writing and realise you've
 * called someone two different things. The browser's own find-in-page is
 * preventDefault'd because in an Electron app it would search the rendered
 * DOM — one scene's worth of words — while claiming to be Find.
 */
export function useKeyboardFind(): void {
  const requestFind = useUIStore((s) => s.requestFind);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() !== "f") return;
      event.preventDefault();
      requestFind();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [requestFind]);
}
