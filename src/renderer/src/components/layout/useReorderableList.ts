import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

/**
 * Drag-to-reorder for a list of rows (v0.67.0).
 *
 * THIS IS NOT NEW CODE. It is the gesture Choice Properties has had since
 * v0.35.x, lifted out of it one file at a time and not otherwise touched,
 * because the Dialogue needed the same thing and the alternative — a
 * second copy — is how two lists that are supposed to behave identically
 * start behaving differently. Everything that made this hard is recorded
 * in the comments below, and all of it is still true; the only change is
 * that the list no longer has to be made of choices.
 *
 * The caller owns what the rows ARE and what reordering them means: it
 * hands in the ids in display order and gets told, once, at the drop, what
 * the new order is. The hook owns the geometry, the transforms and every
 * way a drag can end badly.
 */


/**
 * Everything a drag needs to know about the Choices list's geometry,
 * measured once at the instant of the grab and never re-measured for the
 * rest of the gesture — see the drag-state comment inside
 * `ChoiceProperties` for why that immutability is the entire point.
 */
interface DragLayout {
  /** Choice order at the grab; the rendered order stays this for the whole drag. */
  order: string[];
  /** Index of the dragged choice within `order`. */
  draggedIdx: number;
  /** Each choice's top edge at the grab, aligned to `order`. */
  tops: number[];
  /** Each choice's height at the grab, aligned to `order`. */
  heights: number[];
  /** Vertical space the dragged choice occupies in flow — its own height plus the list's gap. */
  shift: number;
  /**
   * Every position the dragged choice can actually land in, given as the
   * top edge it would have there: `slotTops[k]` is where it ends up if
   * dropped at index k. Derived from the layout with the dragged choice
   * lifted out, so each slot already accounts for the choices above it
   * closing up into the space it left behind.
   */
  slotTops: number[];
  /** Where inside the card the pointer grabbed it, plus the card's own box. */
  grabOffsetY: number;
  left: number;
  width: number;
  height: number;
  /**
   * The Inspector's scrolling element and its scroll position at the
   * grab. Everything above is in viewport coordinates, frozen — which is
   * only safe as long as the content itself doesn't move underneath
   * them, and a scroll does exactly that. Keeping the starting scroll
   * position lets a mid-drag scroll be subtracted back out, so the
   * frozen geometry stays valid instead of silently describing where the
   * choices used to be.
   */
  scrollEl: HTMLElement | null;
  scrollTop: number;
}

/** Nearest ancestor that actually scrolls — the Inspector's own scroll pane. */
function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let node = el?.parentElement ?? null; node; node = node.parentElement) {
    const overflowY = getComputedStyle(node).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return node;
  }
  return null;
}

/**
 * Turns one set of measurements taken at the grab into the fixed geometry
 * the rest of the drag runs on. Nothing here is estimated or assumed —
 * the list's gap is derived from the real distance between neighbours
 * rather than hardcoded, so this stays correct if the spacing ever
 * changes.
 */
function buildDragLayout(
  order: string[],
  rects: DOMRect[],
  draggedIdx: number,
  grabOffsetY: number,
  scrollEl: HTMLElement | null,
): DragLayout {
  const tops = rects.map((r) => r.top);
  const heights = rects.map((r) => r.height);
  const height = heights[draggedIdx];

  let shift = height;
  if (draggedIdx < order.length - 1) {
    shift = tops[draggedIdx + 1] - tops[draggedIdx];
  } else if (draggedIdx > 0) {
    shift = tops[draggedIdx] + height - (tops[draggedIdx - 1] + heights[draggedIdx - 1]);
  }
  const gap = shift - height;

  // Where every other choice sits once the dragged one is lifted out:
  // anything below it closes up by exactly the space it vacated.
  const closedTop = (i: number): number => tops[i] - (i > draggedIdx ? shift : 0);
  const siblingIdxs = order.map((_, i) => i).filter((i) => i !== draggedIdx);

  // A landing slot k means "sit where sibling k currently sits, pushing
  // it and everything below it back down" — so in the lifted-out layout,
  // slot k's top IS sibling k's top. The extra final slot is the one
  // after the last sibling, which has no sibling of its own to borrow a
  // position from.
  const slotTops = siblingIdxs.map(closedTop);
  const lastSibling = siblingIdxs[siblingIdxs.length - 1];
  slotTops.push(
    lastSibling === undefined
      ? tops[draggedIdx]
      : closedTop(lastSibling) + heights[lastSibling] + gap,
  );

  return {
    order,
    draggedIdx,
    tops,
    heights,
    shift,
    slotTops,
    grabOffsetY,
    left: rects[draggedIdx].left,
    width: rects[draggedIdx].width,
    height,
    scrollEl,
    scrollTop: scrollEl?.scrollTop ?? 0,
  };
}

/**
 * How far choice `i` has to be moved (by transform, never by reflow) for
 * the list to read as though the dragged choice were sitting in slot
 * `targetIdx`. For the dragged choice's own slot this positions the
 * landing-zone outline; for everything else it opens the gap.
 */
function translateForIndex(layout: DragLayout, i: number, targetIdx: number): number {
  const { draggedIdx, tops, shift, slotTops } = layout;
  if (i === draggedIdx) return slotTops[targetIdx] - tops[i];
  const siblingIdx = i < draggedIdx ? i : i - 1;
  const closedTop = tops[i] - (i > draggedIdx ? shift : 0);
  return closedTop + (siblingIdx >= targetIdx ? shift : 0) - tops[i];
}

/**
 * Picks which slot the dragged choice is headed for: simply whichever
 * one it is currently CLOSEST to landing in.
 *
 * This deliberately replaces every threshold rule this panel has tried
 * (top-edge crossing, near-edge crossing, near-edge plus a percentage of
 * the neighbour's height, each with its own constants). Those all asked
 * "have I travelled far enough past this neighbour yet?", which for a
 * list whose rows range from one line to a fully expanded form is a
 * question with no good fixed answer — and, worse, any rule that fires
 * EARLY necessarily throws the landing zone further from the pointer,
 * because with a tall neighbour the two candidate landing positions are
 * hundreds of pixels apart. Asking instead "which landing position is
 * nearest to where this choice is actually floating right now?" needs no
 * constant at all, adapts itself to any mix of collapsed and expanded
 * rows, and by construction keeps the landing zone as close to the
 * pointer as the list's real geometry allows.
 *
 * `hysteresis` is the only tuning value, and it is not a threshold: it is
 * a small dead band that stops the choice flickering between two slots
 * when the pointer sits exactly on the boundary between them.
 */
function nearestSlot(layout: DragLayout, top: number, current: number, hysteresis: number): number {
  let best = current;
  let bestDist = Infinity;
  layout.slotTops.forEach((slotTop, k) => {
    const dist = Math.abs(slotTop - top);
    if (dist < bestDist) {
      bestDist = dist;
      best = k;
    }
  });
  const currentDist = Math.abs(layout.slotTops[current] - top);
  return bestDist < currentDist - hysteresis ? best : current;
}

export interface ReorderableList {
  /** The row being held, or null. */
  dragId: string | null;
  /** Where the floating copy of it sits, in client coordinates. */
  dragTop: number;
  /** Which slot it would land in if released now. */
  dragTargetIdx: number | null;
  /** The row gliding into place after a drop — painted above the rest. */
  settlingId: string | null;
  /** The geometry frozen at the grab: read `height`, `left` and `width`
   *  when drawing the landing zone and the floating copy. */
  layout: DragLayout | null;
  /** Goes on the element that wraps the rows. */
  containerRef: RefObject<HTMLDivElement>;
  /** `ref={registerItem(id)}` on each row's wrapper. */
  registerItem: (id: string) => (el: HTMLDivElement | null) => void;
  /** `onPointerDown` for a row's drag handle. */
  onDragHandleDown: (e: ReactPointerEvent, id: string) => void;
}

export function useReorderableList({
  ids,
  expanded,
  onCommit,
}: {
  /** The rows, in the order they are drawn. */
  ids: string[];
  /** Rows whose open/closed state can change — one that just opened is
   *  not animated, see the FLIP effect. Pass an empty set if the rows do
   *  not open. */
  expanded: Set<string>;
  /** Called once, at the drop, with the new order. */
  onCommit: (order: string[]) => void;
}): ReorderableList {
  // Kept in refs so the pointer handlers — which are bound once per drag —
  // always read the current list and the current callback without the
  // whole gesture re-binding every render.
  const idsRef = useRef<string[]>(ids);
  idsRef.current = ids;
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;
  /** Which rows were open last time the list was measured — see the FLIP
   *  effect for why "did this row open or close?" decides whether it is
   *  animated. */
  const prevExpandedRef = useRef<Set<string>>(new Set());

  // --- Drag-to-reorder state -------------------------------------------
  // A lightweight, dependency-free sortable list, rebuilt around one rule
  // that every earlier version of this code broke: THE LIST'S LAYOUT DOES
  // NOT CHANGE WHILE A DRAG IS IN PROGRESS.
  //
  // Every previous version reordered the rendered list live as the drag
  // crossed a neighbour — the choices physically moved to new flow
  // positions mid-gesture. That is the root of the whole family of bugs
  // this panel has had. Reordering mid-drag means the geometry the
  // reorder decision is *reading* is changed by the decision itself:
  // measure a sibling to decide whether to swap past it, swap, and that
  // sibling is now somewhere else — which changes the answer to the
  // question that just triggered it. That fed back as choices flickering
  // together, as swap thresholds that moved while you were reaching for
  // them, and it forced every smoothing mechanism (animations, snapshots,
  // debounce timers) to be bolted on to compensate for instability that
  // shouldn't have existed.
  //
  // So: the DOM order is frozen for the whole gesture, and choices are
  // moved only by CSS transforms computed from a single measurement taken
  // at the instant of the grab. Nothing reflows, so nothing the reorder
  // logic reads can ever move underneath it, so the feedback loop is not
  // fixed but structurally impossible — and because layout is immutable,
  // the motion can finally be animated smoothly instead of having to snap
  // instantly to stay measurable. The dragged accordion itself is lifted
  // out of flow into a `position: fixed` overlay that tracks the cursor;
  // its own slot stays behind as the landing-zone outline, transformed to
  // wherever it would land if released right now.
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragTop, setDragTop] = useState(0);
  /** Which slot the dragged choice would land in if released now. */
  const [dragTargetIdx, setDragTargetIdx] = useState<number | null>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map());
  // Tracks the pending "reset the FLIP transform" rAF per item id, so a
  // second layout pass arriving before the first one's rAF has fired
  // (e.g. an option added/removed while a sibling is still mid-animation
  // from the previous change) cancels the stale one instead of letting
  // two competing rAFs fight over the same element's inline style.
  const flipRafRef = useRef<Map<string, number>>(new Map());
  // Mirrors the two pieces of drag state synchronously, so `finishDrag`
  // can read the latest values directly rather than through a `setState`
  // updater (see finishDrag's comment for why that mattered).
  const dragTopRef = useRef(0);
  const dragTargetIdxRef = useRef<number | null>(null);
  // Set by `finishDrag` for the item that was just released, so the
  // effect below can animate it smoothly from wherever the cursor left it
  // to its real resting position, instead of it silently teleporting
  // there the instant the drag ends.
  const pendingDropRef = useRef<{ id: string; fromTop: number; fromLeft: number } | null>(null);
  /** The choice currently gliding into place after a drop — painted above
   * the rest of the list for the length of that glide. */
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragContainerRef = useRef<HTMLDivElement>(null);
  // The entire geometry of the drag, measured once at the grab and then
  // treated as immutable — see `measureDragLayout` for what each field
  // means and how the landing slots are derived.
  const dragLayoutRef = useRef<DragLayout | null>(null);

  // Self-heal: if the item currently being dragged no longer exists in
  // this block's options — the fast-path way that can happen is the
  // writer removing it from elsewhere while a drag is somehow still
  // active — drop the drag entirely instead of leaving a floating
  // overlay/landing zone pointing at nothing.
  useEffect(() => {
    if (dragId && !ids.includes(dragId)) {
      dragLayoutRef.current = null;
      dragTargetIdxRef.current = null;
      setDragId(null);
      setDragTargetIdx(null);
      setDragTop(0);
    }
  }, [ids.join(","), dragId]);

  useLayoutEffect(() => {
    // Hands off entirely while a drag is running — the effect below owns
    // every transform for the duration of the gesture, and this one's job
    // (smoothing a real reflow) has nothing to do during a drag, because
    // a drag no longer causes one.
    if (dragId) return;

    // The actual root cause of "the panel gets visibly bugged if you
    // switch choices too fast": `getBoundingClientRect()` reports an
    // element's current VISUAL position, which includes any CSS
    // transform still mid-transition — not its true flow/layout
    // position. Rapid toggling/reordering fires this effect again well
    // within the previous run's 150ms transition, so `newRects` below
    // was being measured from an in-between, still-animating position
    // instead of the real one. That wrong number then got stored as the
    // NEXT run's `oldRect`, so the error didn't just cause one bad frame
    // — it fed forward and compounded with every subsequent change,
    // which is exactly how "big empty gaps that appear between choices"
    // can show up in a spot with no reorder, no dragged item, and no
    // stuck spacer: it was a stale, contaminated distance calculation
    // driving a transform to a wrong value that never resolved back to
    // zero, on a completely normal, still-present, no-longer-animating
    // choice. Fix: before measuring anything, synchronously snap every
    // item's transform back to identity (no transition — this happens
    // before paint, under useLayoutEffect, so there's no visible flash;
    // an item mid-transition just stops where it visually was, which is
    // fine — the correct new animation below starts from the true
    // position instead of continuing to build on a wrong one). Every
    // measurement after that point is guaranteed to be the item's real,
    // current layout position.
    ids.forEach((id) => {
      const el = itemRefs.current.get(id);
      if (!el) return;
      const pendingRaf = flipRafRef.current.get(id);
      if (pendingRaf !== undefined) {
        cancelAnimationFrame(pendingRaf);
        flipRafRef.current.delete(id);
      }
      el.style.transition = "none";
      el.style.transform = "";
    });

    const newRects = new Map<string, DOMRect>();
    ids.forEach((id) => {
      const el = itemRefs.current.get(id);
      if (el) newRects.set(id, el.getBoundingClientRect());
    });
    // v0.33.2 — a choice that just opened or closed is NOT animated into
    // place, however far its top moved.
    //
    // Reported: opening choices top-down looked broken while bottom-up
    // looked fine. Both were the same code. Opening choice 2 while choice
    // 1 is open does two things at once — 1 collapses, 2 expands — and
    // collapsing 1 lifts 2 several hundred pixels up the panel. FLIP saw
    // an element whose top moved 348px and did what it is for: put it
    // back where it was and slide it to where it now is. So the choice
    // the writer had just clicked came racing up from the bottom of the
    // panel. Bottom-up never showed it because collapsing a choice BELOW
    // the one being opened doesn't move it; the row that travelled was
    // the one closing, which nobody was looking at.
    //
    // The distinction that matters is what the movement MEANS. A row that
    // shifts because something else changed size did travel, and animating
    // it explains the layout. A row that opened or closed didn't travel at
    // all — its content changed, and it belongs exactly where the new
    // layout puts it. Animating that is telling the writer a story about
    // motion that never happened.
    const wasExpanded = prevExpandedRef.current;
    const changedOpenState = (id: string): boolean => wasExpanded.has(id) !== expanded.has(id);

    ids.forEach((id) => {
      const el = itemRefs.current.get(id);
      const oldRect = prevRectsRef.current.get(id);
      const newRect = newRects.get(id);
      if (el && oldRect && newRect && !changedOpenState(id)) {
        const dy = oldRect.top - newRect.top;
        if (Math.abs(dy) > 0.5) {
          // transform/transition were already reset above; just set the
          // "jumped" starting point and let the next frame transition it
          // back to identity.
          el.style.transform = `translateY(${dy}px)`;
          const rafId = requestAnimationFrame(() => {
            el.style.transition = "transform 150ms ease";
            el.style.transform = "";
            flipRafRef.current.delete(id);
          });
          flipRafRef.current.set(id, rafId);
        }
      }
    });
    prevRectsRef.current = newRects;
    prevExpandedRef.current = expanded;
    // `expanded` is intentionally included (via its size + membership
    // changing the Set reference every toggle) so a choice expanding or
    // collapsing — which reflows every choice below it — also refreshes
    // `prevRectsRef` immediately, rather than leaving it stale until the
    // next reorder/add/remove and then animating a big, wrong "catch-up"
    // jump from a layout that's long since changed. As a bonus, siblings
    // that shift because of the expand/collapse now animate into place
    // too, instead of only reorders getting that treatment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(","), dragId, expanded]);

  // The whole visible effect of a drag, expressed as transforms over a
  // layout that is not allowed to move. Every choice — the dragged one's
  // own slot included — is placed by `translateForIndex` from the
  // geometry captured at the grab, so what's on screen is a preview of
  // the real final layout without any of it having actually happened yet.
  //
  // These transitions are the motion that had to be switched off in every
  // previous version: when a drag reflowed the list for real, an animating
  // choice was a choice whose measured position was a moving target, and
  // the reorder logic read those measurements, so smooth motion and
  // correct reordering were mutually exclusive. Nothing is measured during
  // a drag any more, so they aren't — the list can settle gently and stay
  // exactly as predictable as if it snapped.
  useLayoutEffect(() => {
    const layout = dragLayoutRef.current;
    if (!dragId || !layout || dragTargetIdx === null) return;
    layout.order.forEach((id, i) => {
      const el = itemRefs.current.get(id);
      if (!el) return;
      const pendingRaf = flipRafRef.current.get(id);
      if (pendingRaf !== undefined) {
        cancelAnimationFrame(pendingRaf);
        flipRafRef.current.delete(id);
      }
      const dy = translateForIndex(layout, i, dragTargetIdx);
      el.style.transition = "transform 180ms cubic-bezier(0.2, 0, 0, 1)";
      el.style.transform = dy === 0 ? "" : `translateY(${dy}px)`;
    });
  }, [dragId, dragTargetIdx]);

  // On drop, the just-released choice reappears as a normal in-flow
  // element in the committed order — at the landing zone's position,
  // which is close to where the pointer left the overlay but not usually
  // exactly it. Without this, closing that last small distance would be
  // an instant teleport; with it, the choice glides the final few pixels
  // into place. This runs after the reflow effect above (same render,
  // later in declaration order) so its more accurate starting point —
  // the overlay's real last on-screen position — wins over that effect's
  // `prevRectsRef`-based guess for this one element.
  //
  // `settlingId` lifts that glide above the rest of the list for as long
  // as it lasts. While a choice is held, it's a floating overlay above
  // everything; the instant it's released it becomes an ordinary row
  // again, and an ordinary row is painted in document order — so a choice
  // dropped ABOVE an expanded one was, for the length of this animation,
  // travelling underneath it. It read as the choice diving behind the
  // open card on release rather than landing on top of the list, and only
  // in that direction, because dropping BELOW an expanded choice puts the
  // moving row later in document order where it already won.
  useLayoutEffect(() => {
    const pending = pendingDropRef.current;
    if (!pending || dragId) return;
    pendingDropRef.current = null;
    const el = itemRefs.current.get(pending.id);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dy = pending.fromTop - rect.top;
    const dx = pending.fromLeft - rect.left;
    if (Math.abs(dy) < 0.5 && Math.abs(dx) < 0.5) return;
    const pendingRaf = flipRafRef.current.get(pending.id);
    if (pendingRaf !== undefined) cancelAnimationFrame(pendingRaf);
    setSettlingId(pending.id);
    if (settleTimerRef.current !== null) clearTimeout(settleTimerRef.current);
    // Held a little past the 150ms glide so the lift never drops while
    // the choice is still visibly moving.
    settleTimerRef.current = setTimeout(() => {
      settleTimerRef.current = null;
      setSettlingId(null);
    }, 240);
    el.style.transition = "none";
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    const rafId = requestAnimationFrame(() => {
      el.style.transition = "transform 150ms ease";
      el.style.transform = "";
      flipRafRef.current.delete(pending.id);
    });
    flipRafRef.current.set(pending.id, rafId);
  }, [dragId]);

  // Cancel any FLIP rAFs still pending when this instance goes away —
  // belt-and-suspenders alongside the effects above; harmless if there's
  // nothing pending.
  useEffect(() => {
    return () => {
      flipRafRef.current.forEach((rafId) => cancelAnimationFrame(rafId));
      flipRafRef.current.clear();
      if (settleTimerRef.current !== null) clearTimeout(settleTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!dragId) return;

    // The only tuning value left in the reorder logic, and it isn't a
    // threshold — it's a small dead band that keeps the landing zone from
    // twitching between two slots when the pointer sits exactly on the
    // boundary between them. Everything else is derived from the list's
    // own measured geometry.
    const SLOT_HYSTERESIS = 6;

    function handleMove(e: PointerEvent): void {
      const layout = dragLayoutRef.current;
      if (!layout) return;

      // If the panel has been scrolled since the grab, the frozen
      // geometry now describes where the choices WERE. Subtracting the
      // scroll back out keeps it describing where they are.
      const scrollDelta = layout.scrollEl ? layout.scrollEl.scrollTop - layout.scrollTop : 0;

      // Where the dragged card actually is on screen: the pointer, minus
      // wherever inside the card it was grabbed. Clamped to the range of
      // real landing positions — which, because reordering can't change
      // how tall the list is, works out to exactly "stays within the
      // Choices section" without any invented number. The previous
      // version reserved a flat 28px of "clearance" at the bottom, a
      // constant that had to be guessed and was wrong for any card
      // taller than it.
      const firstSlot = layout.slotTops[0] - scrollDelta;
      const lastSlot = layout.slotTops[layout.slotTops.length - 1] - scrollDelta;
      const top = Math.min(Math.max(e.clientY - layout.grabOffsetY, firstSlot), lastSlot);
      dragTopRef.current = top;
      setDragTop(top);

      // Which slot is it nearest to landing in — see `nearestSlot` for
      // why this replaced every "have I crossed far enough past this
      // neighbour" rule that came before it.
      const current = dragTargetIdxRef.current ?? layout.draggedIdx;
      const next = nearestSlot(layout, top + scrollDelta, current, SLOT_HYSTERESIS);
      if (next !== current) {
        dragTargetIdxRef.current = next;
        setDragTargetIdx(next);
      }
    }

    // Shared by every way a drag can end — a clean pointerup, a lost
    // pointer capture (pointercancel — happens on a touch/pen drag that
    // strays out of bounds, or the OS intercepting the gesture), and the
    // window losing focus mid-drag (alt-tab, a native dialog, clicking
    // another app). Whatever ends it, the in-progress reorder still
    // commits — nothing about "you didn't release cleanly" should throw
    // away work — and the drag state always resets, so nothing is ever
    // left stuck mid-drag with no way to finish it.
    //
    // The final order is built here, at the drop, from the frozen order
    // plus the single index the drag settled on — the list itself was
    // never reordered while the drag was running, so this is the one and
    // only moment anything actually changes.
    //
    // `applyChoiceBlockOptions` is called as a plain side effect rather
    // than from inside a `setState` updater: it dispatches a real
    // ProseMirror transaction which synchronously updates the project
    // store, and running that during React's render phase can knock the
    // resulting store update out of the same batch as the rest of the
    // drop, showing up as a visible pause before the list catches up.
    function finishDrag(): void {
      const layout = dragLayoutRef.current;
      const droppedId = dragId;
      const targetIdx = dragTargetIdxRef.current;
      const fromTop = dragTopRef.current;
      const fromLeft = layout?.left;

      // Hand the reflow effect the positions the choices are ACTUALLY at
      // right now — displaced by the drag's transforms, which is already a
      // preview of the committed layout — as the baseline it animates
      // from. Without this it compares the committed layout against
      // `prevRectsRef`, which has been frozen since before the drag began
      // (the reflow effect stands down for the duration), and so animates
      // every choice back to where it sat before the drag and forward
      // again. On screen that is a jump at the exact moment of release:
      // the choices had already moved into place during the drag, and
      // then re-ran that same movement from the start. Recorded here,
      // before the transforms come off, the two layouts agree and there
      // is nothing left for that effect to animate.
      const settledRects = new Map<string, DOMRect>();
      layout?.order.forEach((id) => {
        const el = itemRefs.current.get(id);
        if (el) settledRects.set(id, el.getBoundingClientRect());
      });
      if (layout) prevRectsRef.current = settledRects;

      // Drop every transform before the real reorder lands, so the list
      // never renders its new order and the old displacement at once.
      layout?.order.forEach((id) => {
        const el = itemRefs.current.get(id);
        if (!el) return;
        el.style.transition = "";
        el.style.transform = "";
      });

      // The one and only moment anything actually changes. The caller
      // turns this order into a document transaction; the hook knows
      // nothing about what the rows are.
      if (layout && targetIdx !== null) {
        const finalOrder = layout.order.filter((id) => id !== droppedId);
        finalOrder.splice(targetIdx, 0, droppedId as string);
        if (finalOrder.length === idsRef.current.length && finalOrder.length > 0) {
          onCommitRef.current(finalOrder);
        }
      }

      if (droppedId && fromLeft !== undefined) {
        pendingDropRef.current = { id: droppedId, fromTop, fromLeft };
      }

      dragLayoutRef.current = null;
      dragTargetIdxRef.current = null;
      setDragTargetIdx(null);
      setDragId(null);
      setDragTop(0);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);
    window.addEventListener("blur", finishDrag);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
      window.removeEventListener("blur", finishDrag);
    };
  }, [dragId]);

  function handleDragHandleDown(e: ReactPointerEvent, id: string): void {
    e.preventDefault();
    // If a previous drag is somehow still active (a missed pointerup —
    // see finishDrag's comment above), don't stack a second one on top of
    // it: let the effect above unwind the old one first on the next
    // render rather than starting a new drag from a half-cleaned state.
    if (dragId) return;
    const order = idsRef.current;
    const draggedIdx = order.indexOf(id);
    if (draggedIdx < 0 || order.length < 2) return;

    // Settle anything still animating before measuring. A rect reports
    // where an element is being PAINTED, which mid-transition is a point
    // part-way through it — and a transition back to identity leaves
    // `style.transform` reading empty while the COMPUTED transform is
    // still a matrix, so an in-flight animation is invisible to every
    // obvious check. Grab a choice while the list is still settling
    // (expanding another choice slides everything below it; so does the
    // tail of a previous drop) and the measurements describe no real
    // layout at all: observed directly, a choice whose true position was
    // 514px reported 397px while its neighbour reported its full height,
    // which puts them 111px inside each other. Geometry derived from that
    // is nonsense — the measured spacing between choices came out
    // NEGATIVE — so the drag previewed a layout that was never going to
    // happen and then snapped ~190px to the real one at the drop. That
    // correction, with choices sliding past each other to reach positions
    // they should already have been in, is what reads as the movement
    // happening behind the open choice after you let go. Snapping to
    // identity first costs nothing — anything mid-animation simply
    // arrives early — and makes every number below a real layout position
    // instead of an animation frame. Same fix, same reason, as the reflow
    // effect's own snap further up.
    for (const optionId of order) {
      const itemEl = itemRefs.current.get(optionId);
      if (!itemEl) return;
      const pendingRaf = flipRafRef.current.get(optionId);
      if (pendingRaf !== undefined) {
        cancelAnimationFrame(pendingRaf);
        flipRafRef.current.delete(optionId);
      }
      itemEl.style.transition = "none";
      itemEl.style.transform = "";
    }

    // The one and only measurement of the whole gesture. It has to happen
    // here, synchronously on the grab, before any drag state exists: one
    // render later the dragged choice is already a lifted-out overlay,
    // and this would no longer be everyone's true undisturbed position.
    // Everything the drag does afterwards is arithmetic on these numbers.
    const rects: DOMRect[] = [];
    for (const optionId of order) {
      const itemEl = itemRefs.current.get(optionId);
      if (!itemEl) return;
      rects.push(itemEl.getBoundingClientRect());
    }

    const layout = buildDragLayout(
      order,
      rects,
      draggedIdx,
      e.clientY - rects[draggedIdx].top,
      findScrollParent(dragContainerRef.current),
    );
    dragLayoutRef.current = layout;
    dragTargetIdxRef.current = draggedIdx;
    dragTopRef.current = rects[draggedIdx].top;
    setDragTargetIdx(draggedIdx);
    setDragTop(rects[draggedIdx].top);
    setDragId(id);
  }
  // -----------------------------------------------------------------------

  function registerItem(id: string) {
    return (el: HTMLDivElement | null): void => {
      if (el) itemRefs.current.set(id, el);
      else itemRefs.current.delete(id);
    };
  }

  return {
    dragId,
    dragTop,
    dragTargetIdx,
    settlingId,
    layout: dragLayoutRef.current,
    containerRef: dragContainerRef,
    registerItem,
    onDragHandleDown: handleDragHandleDown,
  };
}
