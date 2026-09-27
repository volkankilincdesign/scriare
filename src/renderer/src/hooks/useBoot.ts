import { useEffect, useState } from "react";
import { useProjectStore } from "../state/projectStore";
import { SHELL_GRACE_MS, SPLASH_MIN_MS } from "../../../shared/boot";

/**
 * Working out what to draw BEFORE drawing anything (v0.62.0).
 *
 * Two things decide what the first screen is, and both arrive over IPC:
 * whether this launch was asked to open a story (a double-clicked
 * `.scriare`, see main/index.ts), and what is in Recent Projects. Until
 * v0.62.0 the app rendered its default — the Welcome screen with nothing
 * on it — while those answers were in flight, so a writer with nine
 * stories saw "no stories yet" for a frame, and double-clicking a story
 * showed the empty Welcome before the story.
 *
 * So the app boots in one place instead of in three components:
 *
 *   1. Is a story waiting? Open it. Nothing else matters.
 *   2. Otherwise, load the recent list, so the Welcome knows whether it is
 *      a first launch or a shelf before it paints either.
 *   3. Say so — the window is waiting to be shown (SHELL_GRACE_MS).
 *
 * ASKED ONCE. The pending path is cleared by the main process as it is
 * handed over, so this is the only place allowed to ask for it —
 * `useOpenFromDisk` keeps the running-app route and nothing else. Two
 * askers would mean one of them gets null and the other gets a story, and
 * which one is a race.
 */
export type BootPhase = "booting" | "ready";

export function useBoot(): BootPhase {
  const [phase, setPhase] = useState<BootPhase>("booting");

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();

    void (async () => {
      try {
        const pending = await window.api.lifecycle.pendingOpen();
        if (pending) {
          await useProjectStore.getState().openRecentProject(pending);
        } else {
          await useProjectStore.getState().loadRecent();
        }
      } catch {
        // A boot that cannot answer still has to finish. Failing to read
        // the recent list is not a reason to sit on a splash forever —
        // the Welcome screen's own empty state is the honest thing to
        // show when there is genuinely nothing to show.
      }

      if (cancelled) return;

      // If the whole boot fitted inside the grace, the window has not been
      // shown yet and no splash was ever on screen: finish immediately and
      // the app appears already showing the right thing. If it did not,
      // the splash IS on screen, and it stays long enough to read as
      // deliberate rather than as a flicker.
      const elapsed = Date.now() - startedAt;
      const wait = elapsed <= SHELL_GRACE_MS ? 0 : Math.max(0, SHELL_GRACE_MS + SPLASH_MIN_MS - elapsed);

      window.setTimeout(() => {
        if (cancelled) return;
        setPhase("ready");
        // The main process is holding the window back for this.
        window.api.lifecycle.shellReady();
      }, wait);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return phase;
}
