import { useEffect } from "react";
import { useProjectStore } from "../state/projectStore";
import { confirmDialog } from "../state/confirmDialogStore";

/**
 * Closing the window writes what is pending first (v0.49.0).
 *
 * There was no close handling anywhere — no `close` listener in the main
 * process, no `beforeunload` here. The X button destroyed the window
 * immediately, and since autosave fires 1.5 seconds after the last change,
 * the last 1.5 seconds of typing went with it, every time, silently.
 *
 * Two shapes of loss, and they need different answers:
 *
 *  - ORDINARY UNSAVED WORK. Flush it. The app already promised to save
 *    this; it simply wasn't given the chance. Nothing new appears on
 *    screen, because nothing needs to: the correct behaviour here is the
 *    behaviour the writer already believes they are getting.
 *
 *  - AN UNRESOLVED CONFLICT. Ask. This is the one state where flushing is
 *    impossible: the path is exactly the one we are not allowed to write
 *    to, `saveNow` returns early, and `scheduleAutosave` drops its timer —
 *    so the project is entirely unsaved in memory, possibly an hour of it.
 *    The conflict dialog is deliberately undismissable, which means a
 *    writer who does not want to answer it has exactly one exit: the X.
 *    There is no fix for that which isn't a question, so this is the one
 *    question the app asks.
 *
 * The handshake (see main/index.ts) exists because the honest answer needs
 * asynchronous work and Electron's `close` handler cannot wait for it.
 */
export function useCloseGuard(): void {
  useEffect(() => {
    return window.api.lifecycle.onBeforeClose(() => {
      // The pulse that tells the main process this window is working
      // rather than wedged — see main/index.ts. It has to start before the
      // first `await`, because everything after that point (a write to a
      // synced folder, a question the writer is reading) is exactly what
      // used to run out the clock (v0.49.1).
      window.api.lifecycle.stillWorking();
      const pulse = setInterval(() => window.api.lifecycle.stillWorking(), 1000);

      void (async () => {
        try {
          await handleClose();
        } finally {
          clearInterval(pulse);
        }
      })();

      async function handleClose(): Promise<void> {
        const store = useProjectStore.getState();

        if (store.project && store.saveConflict) {
          const proceed = await confirmDialog({
            title: "Close without saving?",
            message:
              "This story has changes that haven't been saved, and a conflict you haven't answered yet. " +
              "Closing now loses everything written since you opened it.",
            confirmLabel: "Close anyway",
            cancelLabel: "Go back",
            danger: true,
          });
          window.api.lifecycle.readyToClose(proceed);
          return;
        }

        // A SAVE THE FILESYSTEM REFUSED (v0.86.0).
        //
        // The old comment here read: "a failed save is not a reason to trap
        // the writer in a window they asked to close — the file on disk is
        // still the last good version." That is still the rule and this does
        // not break it. Quitting is a thing a person is entitled to do, and a
        // modal that refuses is a trap.
        //
        // What it got wrong was treating "do not trap them" as "say nothing".
        // Measured: four edits into a folder that had gone away, the close
        // discarded all four, and the only thing on screen was a notice
        // saying the work was still open. `closeProject` asks now, with three
        // answers of which every one is an exit — including one that writes
        // the story somewhere that works — so nobody is trapped and nobody
        // loses an hour to a keystroke they did not know was the last.
        //
        // The ANSWER is what this hands the main process: "keep writing"
        // means the window stays open, which is the whole point of the
        // handshake existing.
        if (store.project) {
          const closed = await store.closeProject();
          window.api.lifecycle.readyToClose(closed);
          return;
        }

        window.api.lifecycle.readyToClose(true);
      }
    });
  }, []);
}
