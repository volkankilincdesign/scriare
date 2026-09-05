import { useEffect } from "react";
import { useProjectStore } from "../state/projectStore";

/** Wires up Ctrl+S / Cmd+S to trigger an immediate save. */
export function useKeyboardSave(): void {
  const saveNow = useProjectStore((s) => s.saveNow);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      const isSaveShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s";
      if (isSaveShortcut) {
        event.preventDefault();
        void saveNow();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveNow]);
}
