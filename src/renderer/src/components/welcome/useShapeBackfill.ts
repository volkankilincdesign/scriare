import { useEffect, useRef } from "react";
import { normalizeProject } from "../../types/project";
import { buildStoryShape, isDrawableShape } from "../../utils/recentShape";

interface Backfillable {
  filePath: string;
  shape?: unknown;
  missing?: boolean;
}

/**
 * Draws the maps for stories that were saved before this app could cache
 * one (v0.53.1).
 *
 * v0.53.0 wrote a story's shape on save, and only on save — so on the
 * first launch after updating, every card showed the dot field, and a map
 * appeared only once the writer had opened that story and saved it. That
 * inverts the feature: the picture is there to help you FIND the story,
 * and it arrived only after you had already found it without it.
 *
 * So the screen fills them in itself. What makes that affordable is that
 * it happens exactly once per story, ever: the shape is written to the
 * recent entry and every launch afterwards reads it from there.
 *
 * The rules it works under, each one load-bearing:
 *
 * - ONE AT A TIME, never in parallel. Eight `JSON.parse` calls racing each
 *   other on the renderer thread is the one way to make a launcher feel
 *   slow, and there is no hurry: nothing on screen is waiting.
 * - AFTER THE PAINT, and yielded between each. The screen must be up and
 *   usable first; maps that appear a moment later read as the app waking
 *   up, and maps that delay the first frame read as the app being slow.
 * - NEVER TWICE for the same path, even if the list re-renders — which it
 *   does on every fill, since filling one is what changes the list.
 * - A file it cannot read is simply skipped. It may be mid-sync, locked
 *   by another program, or larger than a thumbnail is worth (the main
 *   process refuses those). The card keeps its dot field, which is the
 *   honest drawing of "not known yet", and the story's own next save
 *   fills it in.
 * - IT DOES NOT OPEN THE STORY. Reading a file to draw its thumbnail must
 *   not move it to the top of Recent Projects — see `project:readForShape`.
 */
export function useShapeBackfill(
  entries: Backfillable[],
  onFilled: (list: unknown[]) => void,
): void {
  const tried = useRef(new Set<string>());
  const running = useRef(false);
  // Held in a ref so the effect below can read the CURRENT list without
  // listing it as a dependency — otherwise every fill restarts the pass.
  const latest = useRef(entries);
  latest.current = entries;

  useEffect(() => {
    if (running.current) return;
    let cancelled = false;

    const yieldToPaint = () =>
      new Promise<void>((resolve) => {
        const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => number })
          .requestIdleCallback;
        if (idle) idle(() => resolve());
        else setTimeout(resolve, 120);
      });

    async function pass(): Promise<void> {
      running.current = true;
      try {
        // The screen paints first. Everything below this line is work
        // nobody is waiting for.
        await yieldToPaint();

        for (;;) {
          if (cancelled) return;
          // `isDrawableShape`, not `!e.shape` — a shape written by an
          // older version is present and unusable, and testing for
          // presence alone would leave every one of them showing an empty
          // canvas forever while the backfill reported nothing to do.
          const next = latest.current.find(
            (e) =>
              !e.missing && !isDrawableShape(e.shape) && !tried.current.has(e.filePath),
          );
          if (!next) return;
          tried.current.add(next.filePath);

          try {
            const read = await window.api.project.readForShape(next.filePath);
            if (cancelled) return;
            if (!read?.raw) continue;

            const shape = buildStoryShape(normalizeProject(JSON.parse(read.raw)));
            if (!shape || cancelled) continue;

            const list = await window.api.recent.touch(next.filePath, { shape });
            if (cancelled) return;
            onFilled(list);
          } catch {
            // A story that will not parse is a story this screen has no
            // business reporting on. Opening it raises the real error, with
            // the real path, in the place the writer asked for it.
          }

          await yieldToPaint();
        }
      } finally {
        running.current = false;
      }
    }

    void pass();
    return () => {
      cancelled = true;
    };
    // Deliberately once per mount. `entries` is read through `latest`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
