import { useEffect } from "react";
import { useProjectStore } from "../state/projectStore";
import { useToastStore } from "../state/toastStore";

/**
 * Opening a story by double-clicking it (v0.61.0).
 *
 * The installer registers `.scriare` with Windows, which launches the app
 * with the file's path on its command line — or, when the app is already
 * running, hands that path to the running copy (see main/index.ts). This
 * is the end of both routes.
 *
 * WHAT HAPPENS TO THE STORY ALREADY OPEN. It is closed the way every other
 * close closes it: `closeProject()`, which flushes whatever autosave had
 * not written yet and forces the cached picture the Welcome screen reads.
 * Not a new path — the SAME path — because a second way of putting a
 * project down is a second way of losing the last 1.5 seconds of it, and
 * v0.49.0 spent a version on that.
 *
 * THE ONE CASE THAT IS REFUSED is an unanswered save conflict. There,
 * flushing is impossible by definition (the file underneath changed, and
 * `saveNow` returns early rather than overwrite it), so closing would
 * throw away everything written since the conflict appeared. The request
 * is declined out loud instead: the writer double-clicked something and
 * deserves to know why nothing happened.
 */
export function useOpenFromDisk(): void {
  useEffect(() => {
    let cancelled = false;

    async function open(filePath: string): Promise<void> {
      const store = useProjectStore.getState();

      if (store.project) {
        if (store.saveConflict) {
          useToastStore
            .getState()
            .showNotice(
              "There's a conflict to answer in the story that's open — settle that first, then open this one.",
            );
          return;
        }
        if (store.filePath === filePath) return;
        await store.closeProject();
      }

      await useProjectStore.getState().openRecentProject(filePath);
    }

    // Asked for once on mount: the app may have been STARTED by a
    // double-click, in which case the path was waiting in the main process
    // before this window existed.
    void window.api.lifecycle.pendingOpen().then((filePath) => {
      if (!cancelled && filePath) void open(filePath);
    });

    const stop = window.api.lifecycle.onOpenFromDisk((filePath) => void open(filePath));
    return () => {
      cancelled = true;
      stop();
    };
  }, []);
}
