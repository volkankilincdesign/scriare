/**
 * Shared sizing used by the graph's node components, the auto-layout
 * algorithm, and the group/scene containment checks — all of them need to
 * agree on how big a scene card is on screen.
 */
export const SCENE_NODE_WIDTH = 180;
export const SCENE_NODE_HEIGHT = 56;

// A group this small could barely hold a single scene card once the title
// bar and a little padding are accounted for. Raised in v0.14.1 from an
// original 200x140, which let a box be dragged down to a size that could
// never usefully group anything; buildStoryFolder's default size
// (types/project.ts) starts well above this on purpose — this is just the
// resize-down limit.
export const FOLDER_MIN_WIDTH = 260;
export const FOLDER_MIN_HEIGHT = 170;

/** How much air a group keeps around whatever it contains when it grows to fit. */
export const FOLDER_PADDING = 26;

/**
 * Vertical room reserved for a group's title bar, drawn INSIDE the box's own
 * rectangle (see GroupNode). Without it, the first row of a freshly
 * laid-out chapter sits under its own name.
 *
 * Here rather than in each file that needs it (v0.51.0). This module's
 * header says these values all have to agree, and `26` was written four
 * times across three files for two quantities — `FOLDER_PADDING` here,
 * `DERIVED_PADDING` and `DERIVED_HEADER` in graphGroups.ts, and
 * `GROUP_HEADER_HEIGHT` in autoLayoutGraph.ts — so changing the padding in
 * the one obvious place silently disagreed with the layout engine and with
 * the derived-rect maths.
 */
export const GROUP_HEADER_HEIGHT = 26;

/**
 * The Story Graph's grid (v0.42.0).
 *
 * 18px, which is not an arbitrary round number: it is the spacing of the
 * canvas's fine dot field, and the coarse field sits at 90 — exactly five
 * cells. So a snapped card lands ON a dot, and a card five cells over lands
 * on a bright one. The grid you can see and the grid things snap to are the
 * same grid, which is the whole point; a snap to an invisible lattice just
 * feels like the app fighting the mouse.
 */
export const GRAPH_GRID = 18;

/** Nearest grid line. */
export function snapValue(n: number, grid: number = GRAPH_GRID): number {
  return Math.round(n / grid) * grid;
}

/** A position, snapped. */
export function snapPoint(
  point: { x: number; y: number },
  grid: number = GRAPH_GRID,
): { x: number; y: number } {
  return { x: snapValue(point.x, grid), y: snapValue(point.y, grid) };
}

/**
 * A rectangle, snapped by its CORNERS rather than by origin-plus-size.
 *
 * Both versions land every edge on the grid — that was checked, and it is
 * why "the edges are on the grid" is not the test that separates them. The
 * difference is WHICH line the far edge lands on: rounding the size
 * independently can put it a whole cell away from the edge the person
 * actually dragged, so the box jumps out from under the handle on release.
 * Snapping each corner to its own nearest line keeps the edge where it was
 * put, to within half a cell.
 */
export function snapRect(rect: {
  x: number;
  y: number;
  width: number;
  height: number;
}, grid: number = GRAPH_GRID): { x: number; y: number; width: number; height: number } {
  const x = snapValue(rect.x, grid);
  const y = snapValue(rect.y, grid);
  const right = snapValue(rect.x + rect.width, grid);
  const bottom = snapValue(rect.y + rect.height, grid);
  return {
    x,
    y,
    // A box can be dragged smaller than one cell; never let it round to zero.
    width: Math.max(grid, right - x),
    height: Math.max(grid, bottom - y),
  };
}
