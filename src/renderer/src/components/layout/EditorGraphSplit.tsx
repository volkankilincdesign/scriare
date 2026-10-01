import { useCallback, useEffect, useRef, useState } from "react";
import { SceneEditor } from "../editor/SceneEditor";
import { EntityEditor } from "../editor/EntityEditor";
import { useProjectStore } from "../../state/projectStore";
import { FlowPanel } from "../graph/FlowPanel";

const MIN_FLOW_HEIGHT = 120;
/** Only a fallback for the first paint and for a stored value read before
 *  the column has been measured — the real ceiling is the column's own
 *  height, resolved at drag time. v0.41.0, reported: the graph stopped at
 *  about two thirds of the window, and a writer who wants to look at nothing
 *  but the map should be able to. */
const MAX_FLOW_HEIGHT = 4000;
/** Only the first paint, before the column has a measured height. */
const DEFAULT_FLOW_HEIGHT = 224;
const STORAGE_KEY = "scriare:flowHeight";

/**
 * How tall the Story Graph opens, as a share of the column (v0.88.0).
 *
 * IT WAS A FIXED 224px, AND FIXED WAS BACKWARDS. Measured, with the real
 * story open:
 *
 *   1920×1080  column 996  graph 224 = 22%
 *   1440×900   column 816  graph 224 = 27%
 *   1366×768   column 684  graph 224 = 33%
 *   1024×720   column 636  graph 224 = 35%
 *
 * The graph took its LARGEST share of the screen exactly where space was
 * tightest, and its smallest where there was room to show a map. On a big
 * screen 22% is not enough to read thirty-two cards in; on a small one 35%
 * is eating the page.
 *
 * THE CEILING IS HIS, AND IT IS THE PREMISE RATHER THAN A NUMBER: write
 * stories, not syntax. The graph may not take more than 40% of the column
 * when the app opens, so the editor always holds the majority of the frame
 * a stranger sees first.
 *
 * IT IS ONE NUMBER, NOT TWO, and a control is why. This shipped as a 30%
 * share CLAMPED to a 40% ceiling, and raising that ceiling to 50% changed
 * nothing anywhere — because at a 30% target the clamp never fires. A
 * second mechanism added to be safe that cannot be observed is the pattern
 * this project has deleted three times before (v0.77.x), so it is deleted
 * here too. The share is the rule, the share is under his ceiling, and the
 * check asserts the CEILING rather than the share: push this past 0.4 and
 * it goes red, which is the guard actually doing something.
 *
 * THE DEFAULT ONLY. A writer who has dragged the splitter keeps exactly
 * what they dragged, including taller than 40% — v0.41.0 settled that
 * ("a writer who wants to look at nothing but the map should be able to"),
 * and this does not reopen it.
 */
/**
 * 0.33 RATHER THAN 0.30, AND A RETAKE IS WHY (v0.88.1).
 *
 * v0.88.0 shipped 30% and the screens taken straight afterwards showed the
 * graph at 215px — NINE PIXELS SMALLER than the 224 it replaced. The app's
 * window opens at 1280×800, which leaves a 716px column, and 30% of that is
 * less than the old fixed number. So on the window most people actually
 * launch into, "bump it a couple of pixels" had arrived as a reduction; the
 * bump only existed on a maximised screen.
 *
 * At 33% every launch size gains: 236 at the default window, 269 at
 * 1440×900, 329 at 1920×1080. A small window still loses a little (210 at
 * 1024×720) and that is the premise doing its job rather than a miss — the
 * editor holds two thirds of the screen wherever it opens.
 *
 * Found by retaking the screenshots after shipping, which is the second
 * time looking at a picture has corrected something a measurement had
 * already "confirmed".
 */
const OPENING_SHARE = 0.33;

export function openingFlowHeight(columnHeight: number): number {
  if (!Number.isFinite(columnHeight) || columnHeight <= 0) return DEFAULT_FLOW_HEIGHT;
  // NO CLAMP UP TO MIN_FLOW_HEIGHT, and the conflict is real rather than
  // theoretical: the app sets no minimum window height, so a column short
  // enough for the share to fall under the usable minimum is reachable by
  // dragging the window small. Clamping up there would break the one rule
  // actually stated — it opened the graph at 67% of a 180px column — and a
  // rule that bends on the hard case is a rule nobody can check. Below
  // about a 300px column neither panel is usable at any share, and the
  // splitter is still draggable.
  return Math.round(columnHeight * OPENING_SHARE);
}

/** What the writer last dragged it to, or null if they never have. */
function loadStoredHeight(): number | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? Number(raw) : NaN;
    if (Number.isFinite(parsed)) {
      return Math.min(MAX_FLOW_HEIGHT, Math.max(MIN_FLOW_HEIGHT, parsed));
    }
  } catch {
    // localStorage can be unavailable in rare embedding scenarios — fall
    // back to the default rather than breaking the layout.
  }
  return null;
}

interface EditorGraphSplitProps {
  flowCollapsed: boolean;
  onToggleFlow: () => void;
}

/**
 * Lets writers decide how much vertical space the editor vs. the Flow graph
 * gets, by dragging a thin handle between them — Priority 3 of the writing
 * workflow milestone. Purely a layout affordance: it never touches project
 * data, and the ratio is remembered locally (not saved into the project
 * file) so it doesn't clutter what gets synced/shared.
 */
export function EditorGraphSplit({ flowCollapsed, onToggleFlow }: EditorGraphSplitProps) {
  // v0.35.0 — a Character or Location page takes the whole area. The Story
  // Graph is a map of the story's branching, and a character page isn't in
  // it: leaving the graph on screen below an unrelated page would suggest
  // the two were showing the same thing.
  const entityOpen = useProjectStore((s) => Boolean(s.selectedEntityId));
  const [flowHeight, setFlowHeight] = useState(() => loadStoredHeight() ?? DEFAULT_FLOW_HEIGHT);
  /** True until the writer has dragged the splitter even once. */
  const neverDragged = useRef(loadStoredHeight() === null);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ y: number; height: number } | null>(null);
  // The column the editor and the graph share. Its height is the ceiling:
  // drag all the way up and the graph takes the lot.
  const columnRef = useRef<HTMLDivElement | null>(null);

  /**
   * The opening share, applied once the column has a height (v0.88.0).
   *
   * In an effect rather than in `useState`, because the column does not
   * exist yet when the initial value is computed — the first paint uses the
   * old fixed fallback and this replaces it on the same frame the layout
   * settles, which is why the fallback is still here rather than deleted.
   *
   * Runs ONLY for a writer who has never dragged the splitter. Resizing the
   * window later does not re-run it either: the share is about the frame the
   * app opens on, and a graph that re-sized itself whenever a window moved
   * would be a panel with a mind of its own.
   *
   * WHICH MEANS THE LAUNCH WINDOW DECIDES IT, and that is worth saying
   * because it is easy to misread the numbers: open the app at 1280×800 and
   * maximise afterwards and the graph stays sized for 1280×800. That is the
   * intended trade and it is also why the share had to suit the DEFAULT
   * window rather than the biggest one — see OPENING_SHARE.
   */
  useEffect(() => {
    if (!neverDragged.current) return;
    const column = columnRef.current?.clientHeight ?? 0;
    if (column <= 0) return;
    setFlowHeight(openingFlowHeight(column));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragStart.current = { y: e.clientY, height: flowHeight };
      setDragging(true);
      e.preventDefault();
    },
    [flowHeight],
  );

  useEffect(() => {
    if (!dragging) return;

    function handleMove(e: PointerEvent): void {
      if (!dragStart.current) return;
      // Dragging down shrinks the graph (dy > 0 -> less height), since the
      // handle sits above the graph panel.
      const dy = e.clientY - dragStart.current.y;
      const ceiling = columnRef.current?.clientHeight ?? MAX_FLOW_HEIGHT;
      const next = Math.min(ceiling, Math.max(MIN_FLOW_HEIGHT, dragStart.current.height - dy));
      setFlowHeight(next);
    }

    function handleUp(): void {
      setDragging(false);
      dragStart.current = null;
      setFlowHeight((current) => {
        try {
          window.localStorage.setItem(STORAGE_KEY, String(current));
          // From here on this writer has an opinion, and the opening share
          // stops applying to them — including if they drag it past 40%.
          neverDragged.current = false;
        } catch {
          // Best-effort persistence only.
        }
        return current;
      });
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [dragging]);

  if (entityOpen) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <EntityEditor />
      </div>
    );
  }

  return (
    <div ref={columnRef} className="flex flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-hidden">
        <SceneEditor />
      </div>

      {!flowCollapsed && (
        <div
          onPointerDown={handlePointerDown}
          title="Drag to resize"
          className={`group relative h-1.5 shrink-0 cursor-row-resize bg-[var(--surface-2)] ${
            dragging ? "bg-[var(--accent)]" : "hover:bg-[var(--accent-fill-mid)]"
          }`}
        >
          <div className="absolute inset-x-0 -top-1.5 -bottom-1.5" />
        </div>
      )}

      <FlowPanel collapsed={flowCollapsed} onToggle={onToggleFlow} height={flowHeight} />
    </div>
  );
}
