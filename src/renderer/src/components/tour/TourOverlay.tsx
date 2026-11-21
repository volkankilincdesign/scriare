import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTourStore } from "../../state/tourStore";
import { useProjectStore } from "../../state/projectStore";
import { TOUR_STOPS } from "../../tour/tourSteps";
import { Button } from "../common/Button";

/**
 * The first-launch tour, drawn (v0.91.0) — direction A, "Spotlight", his
 * pick from three on the walkable mockup: the room dims, one region is cut
 * out of the dim, and a card stands beside it.
 *
 * THE HOLE IS A BOX SHADOW. One element the size of the region, with a
 * shadow wide enough to cover the window in `--overlay`. Four dimming
 * rectangles around a gap would be the obvious build and has seams; an SVG
 * mask would be a second way of drawing what the app's modals already
 * draw. A shadow also animates with the box for free, so moving from one
 * stop to the next is the hole travelling rather than the room flashing.
 *
 * MEASURED EVERY FRAME, WHILE IT IS OPEN. The regions it points at move for
 * reasons the tour does not own: the panels it has just opened lay out on
 * the next frame, the graph splitter takes a share of a column that has
 * only just been sized, and a writer can resize the window mid-tour. A
 * ResizeObserver would see the target's own size change and miss it being
 * pushed sideways. One getBoundingClientRect per target per frame, for a
 * minute, on a screen with nothing else animating, is the cheap answer.
 *
 * NOTHING BEHIND IT IS REACHABLE. The dim catches the pointer and the card
 * takes the keyboard (capture phase, so the app's own Delete, Ctrl+Z and
 * Ctrl+S never hear a key pressed during the tour). A tour that lets the
 * room be edited underneath it is two things at once, and the stranger it
 * is for cannot tell which one they are doing.
 */

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The ring sits 2px INSIDE the region, on every stop (v0.91.0, his call
 * after the first build). It was drawn 6px outside, which a panel against
 * the window's edge has no room for: the box was clamped to the window and
 * the ring ran off the app. Inside by 2px is the one rule that holds for a
 * region in the middle of the window and one against its edge alike, and
 * at 2px it covers no text or control.
 */
const INSET = 2;
/** The ring's own width, drawn outward from the box by its box-shadow. */
const RING = 2;
const GAP = 14;
const EDGE = 12;
const CARD_W = 340;

function measure(selectors: string[]): Box | null {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const selector of selectors) {
    for (const el of document.querySelectorAll(selector)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      left = Math.min(left, r.left);
      top = Math.min(top, r.top);
      right = Math.max(right, r.right);
      bottom = Math.max(bottom, r.bottom);
    }
  }
  if (!Number.isFinite(left)) return null;
  // Clipped to the window first (the page's scroll area can run past the
  // bottom edge), then brought in so the ring's OUTER edge lands INSET px
  // inside the region: box + RING = region - INSET.
  left = Math.max(left, 0) + INSET + RING;
  top = Math.max(top, 0) + INSET + RING;
  right = Math.min(right, window.innerWidth) - INSET - RING;
  bottom = Math.min(bottom, window.innerHeight) - INSET - RING;
  return { x: left, y: top, w: right - left, h: bottom - top };
}

function sameBox(a: Box | null, b: Box | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    Math.abs(a.x - b.x) < 0.5 &&
    Math.abs(a.y - b.y) < 0.5 &&
    Math.abs(a.w - b.w) < 0.5 &&
    Math.abs(a.h - b.h) < 0.5
  );
}

/**
 * Beside the region if there is room — right, then left — otherwise below,
 * then above, and failing all four, over the region's own centre. Clamped
 * so no edge of the card ever leaves the window.
 */
function placeCard(hole: Box, cardH: number): { left: number; top: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left: number;
  let top: number;
  if (hole.x + hole.w + GAP + CARD_W + EDGE <= vw) {
    left = hole.x + hole.w + GAP;
    top = hole.y + hole.h / 2 - cardH / 2;
  } else if (hole.x - GAP - CARD_W - EDGE >= 0) {
    left = hole.x - GAP - CARD_W;
    top = hole.y + hole.h / 2 - cardH / 2;
  } else if (hole.y + hole.h + GAP + cardH + EDGE <= vh) {
    left = hole.x + hole.w / 2 - CARD_W / 2;
    top = hole.y + hole.h + GAP;
  } else if (hole.y - GAP - cardH - EDGE >= 0) {
    left = hole.x + hole.w / 2 - CARD_W / 2;
    top = hole.y - GAP - cardH;
  } else {
    left = hole.x + hole.w / 2 - CARD_W / 2;
    top = hole.y + hole.h / 2 - cardH / 2;
  }
  return {
    left: Math.round(Math.max(EDGE, Math.min(left, vw - CARD_W - EDGE))),
    top: Math.round(Math.max(EDGE, Math.min(top, vh - cardH - EDGE))),
  };
}

export function TourOverlay() {
  const active = useTourStore((s) => s.active);
  if (!active) return null;
  return createPortal(<TourLayer />, document.body);
}

function TourLayer() {
  const step = useTourStore((s) => s.step);
  const starting = useTourStore((s) => s.starting);
  const { next, back, end } = useTourStore.getState();
  const hasProject = useProjectStore((s) => s.project !== null);
  const isPlaying = useProjectStore((s) => s.isPlaying);

  const stop = step >= 0 ? TOUR_STOPS[step] : null;

  /**
   * THE FIRST STOP APPEARS; ONLY LATER ONES TRAVEL. The hole was born with
   * its transition on, and the first stop's region is still being laid out
   * when it is first measured — the practice story has just opened and the
   * panels are just unfolding — so it read as the ring flying in from the
   * top-left corner. Sliding is switched on only by a move from one stop
   * to another; arriving from the welcome card, the ring fades in where it
   * is and follows the layout without animating it.
   */
  const [canSlide, setCanSlide] = useState(false);
  const prevStep = useRef(step);
  useEffect(() => {
    setCanSlide(prevStep.current >= 0 && step >= 0);
    prevStep.current = step;
  }, [step]);
  const [hole, setHole] = useState<Box | null>(null);
  const [cardH, setCardH] = useState(220);
  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<Element | null>(null);

  // A story that closes, or Play starting, takes away what the tour is
  // pointing at. It ends rather than pointing at the Welcome screen.
  useEffect(() => {
    if (step >= 0 && (!hasProject || isPlaying)) end("skipped");
  }, [step, hasProject, isPlaying, end]);

  useEffect(() => {
    if (!stop) {
      setHole(null);
      return;
    }
    let frame = 0;
    let last: Box | null = null;
    const tick = () => {
      const box = measure(stop.targets);
      if (!sameBox(box, last)) {
        last = box;
        setHole(box);
      }
      frame = window.requestAnimationFrame(tick);
    };
    tick();
    return () => window.cancelAnimationFrame(frame);
  }, [stop]);

  useLayoutEffect(() => {
    const h = cardRef.current?.offsetHeight;
    if (h && Math.abs(h - cardH) > 0.5) setCardH(h);
  });

  // Where focus was before, so it goes back there afterwards; then the
  // primary button, on every step, so Enter always means "on".
  useEffect(() => {
    returnFocus.current = document.activeElement;
    return () => {
      const el = returnFocus.current as HTMLElement | null;
      if (el && document.contains(el)) el.focus?.();
    };
  }, []);
  useEffect(() => {
    primaryRef.current?.focus();
  }, [step, starting]);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Tab") {
        // Kept inside the card. Three buttons at most, so the trap is a
        // wrap-around rather than a focus-trap library.
        const buttons = Array.from(cardRef.current?.querySelectorAll("button:not([disabled])") ?? []) as HTMLElement[];
        if (buttons.length === 0) return;
        const i = buttons.indexOf(document.activeElement as HTMLElement);
        const n = e.shiftKey ? (i <= 0 ? buttons.length - 1 : i - 1) : (i + 1) % buttons.length;
        buttons[n].focus();
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if ((e.key === "Enter" || e.key === " ") && cardRef.current?.contains(e.target as Node)) {
        // Left to the focused button, so Enter on Skip skips. NOT stopped
        // here: stopping propagation in the capture phase would keep the
        // event from ever reaching the button whose default action it is.
        return;
      }
      e.stopPropagation();
      if (e.key === "Escape") {
        e.preventDefault();
        end("skipped");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        back();
      } else if (e.key === "Enter") {
        // Focus has wandered off the card (a click on the dim): Enter still
        // means "on".
        e.preventDefault();
        next();
      } else {
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [next, back, end]);

  const total = TOUR_STOPS.length;
  // Spelled out in a sentence, as a number in the counter.
  const totalWord = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"][total] ?? String(total);
  const last = step === total - 1;
  const centred = !hole;
  const position = hole ? placeCard(hole, cardH) : null;

  const title = stop ? stop.title : "Scriare in a minute";
  const kicker = stop ? `${step + 1} of ${total} · ${stop.kicker}` : "Welcome";
  const body = stop
    ? stop.body
    : hasProject
      ? `${totalWord} stops, one for each part of the window, shown on the story you have open. Skip whenever you like.`
      : `${totalWord} stops, one for each part of the window. A short practice story opens to show them on. It is saved in the Scriare folder in your Documents, and it is yours to keep or delete.`;
  const primaryLabel = !stop ? (starting ? "Opening…" : "Start the tour") : last ? "Start writing" : "Next";

  return (
    <div
      className="scriare-tour fixed inset-0 z-[120]"
      data-tour-overlay
      data-tour-step={stop ? stop.id : "welcome"}
      // The dim swallows the pointer. Clicking it does NOT dismiss: a
      // stranger clicking to "get rid of the grey" should not lose the
      // tour, and Skip is one button away.
      onPointerDown={(e) => e.preventDefault()}
    >
      {hole ? (
        <div
          className={`scriare-tour-hole ${canSlide ? "is-sliding" : ""}`}
          data-tour-hole
          style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }}
        />
      ) : (
        <div className="scriare-tour-dim" />
      )}

      <div
        ref={cardRef}
        // Remounted between the welcome card and the stops, so the first
        // stop's card fades in beside its region rather than sliding out of
        // the middle of the window.
        key={stop ? "stops" : "welcome"}
        role="dialog"
        aria-modal="true"
        aria-labelledby="scriare-tour-title"
        aria-describedby="scriare-tour-body"
        data-tour-card
        className={`scriare-tour-card ${centred ? "is-centred" : ""} ${canSlide ? "is-sliding" : ""}`}
        style={position ? { left: position.left, top: position.top, width: CARD_W } : { width: CARD_W + 40 }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="mb-1 text-xs text-[var(--text-3)]" aria-live="polite">
          {kicker}
        </div>
        <h2
          id="scriare-tour-title"
          className="font-serif-narrative mb-2 text-[22px] italic leading-tight text-[var(--text)]"
        >
          {title}
        </h2>
        <div id="scriare-tour-body" className="mb-4 text-[13px] leading-relaxed text-[var(--text-2)]">
          {body && <p>{body}</p>}
          {stop?.terms && (
            <dl className="space-y-1.5">
              {stop.terms.map((t) => (
                <div key={t.term}>
                  <dt className="font-semibold text-[var(--text)]">{t.term}</dt>
                  <dd>{t.meaning}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {stop ? (
            <div className="flex flex-1 items-center gap-1" aria-hidden data-tour-dots>
              {TOUR_STOPS.map((s, i) => (
                <span key={s.id} className={`scriare-tour-dot ${i === step ? "is-on" : ""}`} />
              ))}
            </div>
          ) : (
            <span className="flex-1" />
          )}
          <Button intent="ghost" size="sm" onClick={() => end("skipped")} data-tour-skip>
            {stop ? "Skip" : "Not now"}
          </Button>
          {stop && step > 0 && (
            <Button intent="secondary" size="sm" onClick={back} data-tour-back>
              Back
            </Button>
          )}
          <Button
            ref={primaryRef}
            intent="primary"
            size="sm"
            onClick={next}
            disabled={starting}
            data-tour-next
          >
            {primaryLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
