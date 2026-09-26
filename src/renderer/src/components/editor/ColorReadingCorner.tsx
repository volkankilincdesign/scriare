import { ColorOnGrounds } from "../common/ColorOnGrounds";
import { useUIStore } from "../../state/uiStore";

/**
 * Where the colour reading is drawn while a writer is picking (v0.58.1).
 *
 * v0.58.0 put it directly under the colour control, which is the obvious
 * place and the one wrong place: that is where the browser opens the
 * colour picker. The reading spent the entire pick hidden behind the
 * picker it was about, and only appeared once the writer had already
 * chosen — which is the "reports instead of prevents" failure the whole
 * design was meant to avoid. Reported by Volkan with a screenshot of the
 * picker sitting exactly on top of it.
 *
 * So it lives in the writing pane's bottom corner instead. It is out of
 * the picker's way wherever the picker opens, it is the corner the app
 * already uses for a floating instrument (the Variable Readout in Play
 * sits in the same one), and — the part that matters — it is visible the
 * whole time the writer is dragging, which is the only moment changing
 * their mind is free.
 *
 * Drawn by the PANE rather than by the toolbar because a child cannot
 * render into its parent's corner; the subject travels through `uiStore`,
 * which exists for exactly this shape of problem.
 */
export function ColorReadingCorner() {
  const subject = useUIStore((s) => s.colorReading);
  const clear = useUIStore((s) => s.clearColorReading);
  if (!subject) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-end px-4 pb-3">
      <div className="pointer-events-auto">
        <ColorOnGrounds subject={subject} onDismiss={clear} />
      </div>
    </div>
  );
}
