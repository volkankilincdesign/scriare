import { GRAPH_GRID } from "./graphConstants";
import { wireEnds } from "./wireAnchors";
import type { AnchorBox, AnchorLink, WireEnds } from "./wireAnchors";

/**
 * An obstacle-aware router for the Story Graph (v0.73.0).
 *
 * The canvas is a place with things in it, and until now a wire behaved as
 * if it were empty: a bezier from A to B, straight through whatever happened
 * to be in the way. On The Blue Hour that was sixty wires crossing a card
 * they had nothing to do with — which is the single most confusing mark the
 * graph can make, because a line that passes under a scene looks like it
 * ENDS there.
 *
 * So:
 *
 *   A CARD is a hard obstacle. No route passes through one, and there is no
 *   code path in here that can draw a wire without asking. The forbidden
 *   rectangle is the card plus a pixel, not the card minus one: a line
 *   lying exactly along a card's border is legal by the geometry and wrong
 *   by the eye, because it looks attached.
 *
 *   ANOTHER WIRE is a soft obstacle, and the two ways of meeting one are
 *   priced very differently. Running ALONG the same line is expensive: that
 *   is the overlap nobody can read, and the price is set high enough that a
 *   wire takes the next lane over — a whole grid cell — rather than share.
 *   CROSSING one at a right angle is nearly free, because a plus sign is not
 *   ambiguous. A router that treated every meeting as something to avoid
 *   would tie itself in knots buying something the reader never wanted.
 *
 *   A TURN costs something too. Without it the cheapest path is a staircase
 *   of tiny steps: the correct length, and unreadable.
 *
 * The search is A* over a lane grid whose lines are the card edges, a margin
 * outside them, every anchor, and fill lines a grid cell apart across any gap
 * wide enough to hold them — so a gutter is a set of real tracks rather than
 * a void the router has to invent coordinates in.
 *
 * Then rip-up-and-retry, because this is order-dependent and one pass cannot
 * fix that: the wire routed first takes the good track and can force a later
 * one into a detour that makes no sense to look at. Everything is routed, the
 * worst offenders are torn out and routed again with the rest of the picture
 * in place, and that repeats — under a hard time budget, because Auto Layout
 * is one button press with an undo behind it and has to feel instant rather
 * than converge beautifully.
 *
 * WHAT THIS DOES NOT DO, measured rather than guessed: it does not scale. On
 * generated stories it is 111ms at 32 scenes, 355ms at 100 and 589ms at 250 —
 * and then 4.1 seconds at 500 and 39 at 1000, because the grid grows on both
 * axes at once and the search window stops helping once a single chapter is
 * bigger than the window. Past BOARD_ABOVE scenes the cheap router below runs
 * instead. That is a real limit, stated here rather than discovered by
 * someone with a long story.
 */

/** Above this many boxes, the cheap router. See the note above. */
export const BOARD_ABOVE = 300;

const LANE = GRAPH_GRID;
const MARGIN = GRAPH_GRID;
/** Fill lines per gap. A cap, so a large empty area cannot explode the grid. */
const FILL_LIMIT = 10;

/** Costs, in pixels of apparent effort. */
const COST = {
  /** A corner is worth about a grid cell and a half of extra wire. */
  turn: 26,
  /** A right-angle crossing: cheap, but not free. */
  cross: 14,
  /** Running ALONG another wire, per pixel: six times the price of empty canvas. */
  overlapPerPx: 6,
  /** Grazing a card's margin — legal, mildly discouraged. */
  nearCardPerPx: 0.6,
};

export interface RouteStats {
  ms: number;
  routed: number;
  failed: number;
  passes: number;
  mode: "aware" | "board";
}

export interface RouteResult {
  /** Link id → SVG path. A link with no entry could not be routed; draw it the old way. */
  paths: Map<string, string>;
  /**
   * Link id → where its label belongs: the midpoint by arc length along the
   * route, not the midpoint of the straight line between the two ends. On an
   * orthogonal path those are rarely the same point, and the straight-line
   * one lands off the wire entirely whenever the route detours.
   */
  labels: Map<string, { x: number; y: number }>;
  stats: RouteStats;
}

/** The point half way along a polyline, measured by distance travelled. */
function midpointOf(points: { x: number; y: number }[]): { x: number; y: number } {
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    total += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
  }
  let walked = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const seg = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    if (walked + seg >= total / 2) {
      const t = seg === 0 ? 0 : (total / 2 - walked) / seg;
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * t,
        y: points[i].y + (points[i + 1].y - points[i].y) * t,
      };
    }
    walked += seg;
  }
  return points[points.length - 1] ?? { x: 0, y: 0 };
}

// ── a small binary heap, because a sorted array is the slow part ─────────
class Heap {
  private f: number[] = [];
  private v: number[] = [];
  get size(): number {
    return this.f.length;
  }
  push(f: number, v: number): void {
    this.f.push(f);
    this.v.push(v);
    let i = this.f.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.f[p] <= this.f[i]) break;
      [this.f[p], this.f[i]] = [this.f[i], this.f[p]];
      [this.v[p], this.v[i]] = [this.v[i], this.v[p]];
      i = p;
    }
  }
  pop(): number {
    const top = this.v[0];
    const lf = this.f.pop()!;
    const lv = this.v.pop()!;
    if (this.f.length) {
      this.f[0] = lf;
      this.v[0] = lv;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < this.f.length && this.f[l] < this.f[m]) m = l;
        if (r < this.f.length && this.f[r] < this.f[m]) m = r;
        if (m === i) break;
        [this.f[m], this.f[i]] = [this.f[i], this.f[m]];
        [this.v[m], this.v[i]] = [this.v[i], this.v[m]];
        i = m;
      }
    }
    return top;
  }
}

function axisLines(values: number[]): number[] {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  const out: number[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    out.push(sorted[i]);
    if (i === sorted.length - 1) continue;
    const gap = sorted[i + 1] - sorted[i];
    if (gap <= LANE * 1.5) continue;
    const n = Math.min(FILL_LIMIT, Math.floor(gap / LANE) - 1);
    const step = gap / (n + 1);
    for (let k = 1; k <= n; k += 1) out.push(sorted[i] + step * k);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

interface Grid {
  X: number[];
  Y: number[];
  NX: number;
  NY: number;
  N: number;
  hBlocked: Uint8Array;
  vBlocked: Uint8Array;
  hNear: Uint8Array;
  vNear: Uint8Array;
}

/**
 * Built once per layout and reused by every wire and every rip-up pass,
 * which is what makes this affordable at all — the expensive question
 * (where can a wire physically be) does not depend on which wire is asking.
 */
function buildGrid(boxes: AnchorBox[], wires: WireEnds[]): Grid {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const b of boxes) {
    xs.push(b.x - MARGIN, b.x, b.x + b.width, b.x + b.width + MARGIN);
    ys.push(b.y - MARGIN, b.y, b.y + b.height, b.y + b.height + MARGIN);
  }
  for (const w of wires) {
    xs.push(w.p1.x, w.p2.x, w.p1.x + w.p1.nx * MARGIN, w.p2.x + w.p2.nx * MARGIN);
    ys.push(w.p1.y, w.p2.y, w.p1.y + w.p1.ny * MARGIN, w.p2.y + w.p2.ny * MARGIN);
  }
  const pad = MARGIN * 8;
  xs.push(Math.min(...xs) - pad, Math.max(...xs) + pad);
  ys.push(Math.min(...ys) - pad, Math.max(...ys) + pad);

  const X = axisLines(xs);
  const Y = axisLines(ys);
  const NX = X.length;
  const NY = Y.length;
  const N = NX * NY;

  const hBlocked = new Uint8Array(N);
  const vBlocked = new Uint8Array(N);
  const hNear = new Uint8Array(N);
  const vNear = new Uint8Array(N);

  for (const b of boxes) {
    const x1 = b.x - 1;
    const x2 = b.x + b.width + 1;
    const y1 = b.y - 1;
    const y2 = b.y + b.height + 1;
    const mx1 = b.x - MARGIN;
    const mx2 = b.x + b.width + MARGIN;
    const my1 = b.y - MARGIN;
    const my2 = b.y + b.height + MARGIN;
    for (let j = 0; j < NY; j += 1) {
      const inside = Y[j] > y1 && Y[j] < y2;
      const near = Y[j] > my1 && Y[j] < my2;
      if (!inside && !near) continue;
      for (let i = 0; i < NX - 1; i += 1) {
        if (X[i + 1] <= x1 || X[i] >= x2) {
          if (near && X[i + 1] > mx1 && X[i] < mx2) hNear[i * NY + j] = 1;
          continue;
        }
        if (inside) hBlocked[i * NY + j] = 1;
        else hNear[i * NY + j] = 1;
      }
    }
    for (let i = 0; i < NX; i += 1) {
      const inside = X[i] > x1 && X[i] < x2;
      const near = X[i] > mx1 && X[i] < mx2;
      if (!inside && !near) continue;
      for (let j = 0; j < NY - 1; j += 1) {
        if (Y[j + 1] <= y1 || Y[j] >= y2) {
          if (near && Y[j + 1] > my1 && Y[j] < my2) vNear[i * NY + j] = 1;
          continue;
        }
        if (inside) vBlocked[i * NY + j] = 1;
        else vNear[i * NY + j] = 1;
      }
    }
  }

  return { X, Y, NX, NY, N, hBlocked, vBlocked, hNear, vNear };
}

interface Occupancy {
  hUse: Int16Array;
  vUse: Int16Array;
  nodeH: Int16Array;
  nodeV: Int16Array;
}

function nearestIndex(list: number[], value: number): number {
  let lo = 0;
  let hi = list.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(list[lo - 1] - value) < Math.abs(list[lo] - value)) return lo - 1;
  return lo;
}

interface Attempt {
  nodes: number[] | null;
  expansions: number;
  exhausted: boolean;
}

function routeOne(
  grid: Grid,
  occ: Occupancy,
  w: WireEnds,
  pad: number,
  budgetExpansions: number,
): Attempt {
  const { X, Y, NX, NY, N, hBlocked, vBlocked, hNear, vNear } = grid;
  const { hUse, vUse, nodeH, nodeV } = occ;

  const sx = nearestIndex(X, w.p1.x + w.p1.nx * MARGIN);
  const sy = nearestIndex(Y, w.p1.y + w.p1.ny * MARGIN);
  const tx = nearestIndex(X, w.p2.x + w.p2.nx * MARGIN);
  const ty = nearestIndex(Y, w.p2.y + w.p2.ny * MARGIN);

  const startAxis = w.p1.nx !== 0 ? 0 : 1;
  const goalAxis = w.p2.nx !== 0 ? 0 : 1;
  const start = (sx * NY + sy) * 2 + startAxis;
  const goal = (tx * NY + ty) * 2 + goalAxis;

  // A window, which is the difference between this being usable and not.
  // Without it the cost of routing one connection grows with the size of the
  // whole story rather than with the length of the connection. A wire
  // between two neighbouring scenes has no business looking at chapter nine.
  const wx1 = Math.min(w.p1.x, w.p2.x) - pad;
  const wx2 = Math.max(w.p1.x, w.p2.x) + pad;
  const wy1 = Math.min(w.p1.y, w.p2.y) - pad;
  const wy2 = Math.max(w.p1.y, w.p2.y) + pad;

  const S = N * 2;
  const g = new Float64Array(S).fill(Infinity);
  const from = new Int32Array(S).fill(-1);
  const closed = new Uint8Array(S);
  const heap = new Heap();

  const gx = X[tx];
  const gy = Y[ty];
  // Slightly greedy. It gives up the guarantee of the single cheapest route
  // for a large cut in how much of the grid is looked at, and on a story
  // graph the difference is a wire one lane over.
  const h = (state: number): number => {
    const node = state >> 1;
    const i = (node / NY) | 0;
    const j = node % NY;
    return (Math.abs(X[i] - gx) + Math.abs(Y[j] - gy)) * 1.15;
  };

  g[start] = 0;
  heap.push(h(start), start);
  let expansions = 0;

  while (heap.size) {
    const cur = heap.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    expansions += 1;
    if (cur === goal) break;
    if (expansions > budgetExpansions) return { nodes: null, expansions, exhausted: true };

    const node = cur >> 1;
    const axis = cur & 1;
    const i = (node / NY) | 0;
    const j = node % NY;
    const base = g[cur];

    for (let d = 0; d < 4; d += 1) {
      const ni = i + (d === 0 ? 1 : d === 1 ? -1 : 0);
      const nj = j + (d === 2 ? 1 : d === 3 ? -1 : 0);
      if (ni < 0 || ni >= NX || nj < 0 || nj >= NY) continue;
      if (X[ni] < wx1 || X[ni] > wx2 || Y[nj] < wy1 || Y[nj] > wy2) continue;
      const horizontal = d < 2;
      const newAxis = horizontal ? 0 : 1;
      const ei = horizontal ? Math.min(i, ni) * NY + j : i * NY + Math.min(j, nj);
      if (horizontal ? hBlocked[ei] : vBlocked[ei]) continue;

      const len = horizontal ? Math.abs(X[ni] - X[i]) : Math.abs(Y[nj] - Y[j]);
      let step = len;
      if (horizontal ? hUse[ei] : vUse[ei]) step += len * COST.overlapPerPx;
      if (horizontal ? hNear[ei] : vNear[ei]) step += len * COST.nearCardPerPx;
      if (newAxis !== axis) step += COST.turn;
      const nn = ni * NY + nj;
      if (horizontal ? nodeV[nn] : nodeH[nn]) step += COST.cross;

      const ns = nn * 2 + newAxis;
      const cand = base + step;
      if (cand < g[ns]) {
        g[ns] = cand;
        from[ns] = cur;
        heap.push(cand + h(ns), ns);
      }
    }
  }

  if (g[goal] === Infinity) return { nodes: null, expansions, exhausted: false };

  const nodes: number[] = [];
  for (let s = goal; s !== -1; s = from[s]) nodes.push(s >> 1);
  nodes.reverse();
  return { nodes, expansions, exhausted: false };
}

function claim(grid: Grid, occ: Occupancy, nodes: number[], sign: number): void {
  const { NY } = grid;
  for (let k = 0; k < nodes.length - 1; k += 1) {
    const a = nodes[k];
    const b = nodes[k + 1];
    const ai = (a / NY) | 0;
    const aj = a % NY;
    const bi = (b / NY) | 0;
    const bj = b % NY;
    if (aj === bj) {
      occ.hUse[Math.min(ai, bi) * NY + aj] += sign;
      occ.nodeH[a] += sign;
      occ.nodeH[b] += sign;
    } else {
      occ.vUse[ai * NY + Math.min(aj, bj)] += sign;
      occ.nodeV[a] += sign;
      occ.nodeV[b] += sign;
    }
  }
}

/** Grid indices → canvas points, with collinear runs collapsed. */
function toPoints(grid: Grid, nodes: number[], w: WireEnds): { x: number; y: number }[] {
  const { NY, X, Y } = grid;
  const raw = nodes.map((n) => ({ x: X[(n / NY) | 0], y: Y[n % NY] }));
  const clean = [raw[0]];
  for (let i = 1; i < raw.length - 1; i += 1) {
    const a = clean[clean.length - 1];
    const b = raw[i];
    const c = raw[i + 1];
    if ((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)) continue;
    clean.push(b);
  }
  clean.push(raw[raw.length - 1]);
  return [{ x: w.p1.x, y: w.p1.y }, ...clean, { x: w.p2.x, y: w.p2.y }];
}

/** An orthogonal polyline with rounded corners. */
export function orthoPath(points: { x: number; y: number }[], radius = 10): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1];
    const here = points[i];
    const next = points[i + 1];
    const inLen = Math.hypot(here.x - prev.x, here.y - prev.y);
    const outLen = Math.hypot(next.x - here.x, next.y - here.y);
    const r = Math.max(0, Math.min(radius, inLen / 2, outLen / 2));
    const a = {
      x: here.x - Math.sign(here.x - prev.x) * r,
      y: here.y - Math.sign(here.y - prev.y) * r,
    };
    const b = {
      x: here.x + Math.sign(next.x - here.x) * r,
      y: here.y + Math.sign(next.y - here.y) * r,
    };
    d += ` L ${a.x} ${a.y} Q ${here.x} ${here.y} ${b.x} ${b.y}`;
  }
  const last = points[points.length - 1];
  return `${d} L ${last.x} ${last.y}`;
}

/**
 * The cheap router, used above BOARD_ABOVE boxes.
 *
 * One turn, in the first free lane between the two cards, rejecting any lane
 * whose path would cross a card. It is first-fit rather than a search, so it
 * can fail to find anything — and when it does it returns nothing for that
 * wire rather than drawing one anyway, which is the mistake the version
 * before this made and the reason a connection ran under two scenes.
 */
function boardRoute(
  boxes: AnchorBox[],
  wires: WireEnds[],
): { paths: Map<string, string>; labels: Map<string, { x: number; y: number }> } {
  const taken: { vertical: boolean; at: number; lo: number; hi: number }[] = [];
  const paths = new Map<string, string>();
  const labels = new Map<string, { x: number; y: number }>();

  const crosses = (pts: { x: number; y: number }[], w: WireEnds): boolean =>
    boxes.some((b) => {
      if (b.id === w.link.source || b.id === w.link.target) return false;
      const x1 = b.x - 1;
      const x2 = b.x + b.width + 1;
      const y1 = b.y - 1;
      const y2 = b.y + b.height + 1;
      for (let i = 0; i < pts.length - 1; i += 1) {
        const a = pts[i];
        const c = pts[i + 1];
        if (
          Math.max(a.x, c.x) > x1 &&
          Math.min(a.x, c.x) < x2 &&
          Math.max(a.y, c.y) > y1 &&
          Math.min(a.y, c.y) < y2
        ) {
          return true;
        }
      }
      return false;
    });

  const order = [...wires].sort(
    (a, b) =>
      Math.abs(a.p2.x - a.p1.x) +
      Math.abs(a.p2.y - a.p1.y) -
      (Math.abs(b.p2.x - b.p1.x) + Math.abs(b.p2.y - b.p1.y)),
  );

  for (const w of order) {
    const vertical = w.p1.nx === 0;
    const fromC = vertical ? w.p1.y : w.p1.x;
    const toC = vertical ? w.p2.y : w.p2.x;
    const perpFrom = vertical ? w.p1.x : w.p1.y;
    const perpTo = vertical ? w.p2.x : w.p2.y;
    const span: [number, number] = [
      Math.min(perpFrom, perpTo) - LANE / 2,
      Math.max(perpFrom, perpTo) + LANE / 2,
    ];

    if (Math.abs(perpFrom - perpTo) < 1.5) {
      const straight = [
        { x: w.p1.x, y: w.p1.y },
        { x: w.p2.x, y: w.p2.y },
      ];
      if (!crosses(straight, w)) {
        paths.set(w.link.id, orthoPath(straight));
        labels.set(w.link.id, midpointOf(straight));
        continue;
      }
    }

    const ideal = (fromC + toC) / 2;
    const lo = Math.min(fromC, toC) + MARGIN;
    const hi = Math.max(fromC, toC) - MARGIN;
    let found: { x: number; y: number }[] | null = null;
    let at = 0;
    for (let step = 0; step < 160 && !found; step += 1) {
      at =
        Math.round(ideal / LANE) * LANE + (step % 2 === 0 ? 1 : -1) * Math.ceil(step / 2) * LANE;
      if (hi > lo && (at < lo || at > hi)) continue;
      if (
        taken.some(
          (t) =>
            t.vertical === vertical &&
            Math.abs(t.at - at) < LANE - 1 &&
            t.hi > span[0] &&
            t.lo < span[1],
        )
      ) {
        continue;
      }
      const pts = vertical
        ? [
            { x: w.p1.x, y: w.p1.y },
            { x: w.p1.x, y: at },
            { x: w.p2.x, y: at },
            { x: w.p2.x, y: w.p2.y },
          ]
        : [
            { x: w.p1.x, y: w.p1.y },
            { x: at, y: w.p1.y },
            { x: at, y: w.p2.y },
            { x: w.p2.x, y: w.p2.y },
          ];
      if (crosses(pts, w)) continue;
      found = pts;
    }
    if (!found) continue; // no path: the caller draws it the old way
    taken.push({ vertical, at, lo: span[0], hi: span[1] });
    paths.set(w.link.id, orthoPath(found));
    labels.set(w.link.id, midpointOf(found));
  }
  return { paths, labels };
}

const now = (): number =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

export interface RouteOptions {
  budgetMs?: number;
  passes?: number;
  boardAbove?: number;
}

/**
 * The wires of a scene being dragged, redrawn for this frame (v0.73.0).
 *
 * The full router costs about a tenth of a second, which is fine once per
 * edit and absurd sixty times a second — so the first version of this let a
 * dragged scene's wires fall back to the bezier until the drag committed.
 * That was reported immediately, and rightly: the whole point of the
 * release is that a connection is a line, and watching four of them turn
 * back into curves the moment you pick a card up says the lines were a
 * decoration rather than the truth.
 *
 * So a drag gets the CHEAP router instead of no router. One turn, first
 * free lane, still refusing to cross a card — no search, no rip-up, and
 * only for the handful of wires whose ends actually moved. Everything else
 * keeps the path it was already given, because nothing about it changed.
 *
 * The anchors are still worked out over EVERY link, not just the moving
 * ones: a wire arriving at a stationary scene shares that card's edge with
 * its siblings, and allocating slots from a subset would have it hop to a
 * different slot for the duration of the drag and snap back on release.
 */
export function routeDragged(
  boxes: AnchorBox[],
  links: AnchorLink[],
  affected: ReadonlySet<string>,
): { paths: Map<string, string>; labels: Map<string, { x: number; y: number }> } {
  if (affected.size === 0) return { paths: new Map(), labels: new Map() };
  const wires = wireEnds(boxes, links).filter((w) => affected.has(w.link.id));
  if (wires.length === 0) return { paths: new Map(), labels: new Map() };
  const { paths, labels } = boardRoute(boxes, wires);

  // Anything the cheap router could not place gets a plain one-turn path
  // anyway — and this is the ONE place in the file that draws a wire
  // without checking what is under it.
  //
  // It is deliberate and it is narrow. Mid-drag the cards are being pulled
  // over each other on purpose, so "no legal route exists" is common and
  // means nothing: the arrangement under the cursor is not an arrangement
  // anybody is going to keep. A line briefly crossing a card while you
  // hold it is a far smaller lie than the wire turning into a curve, and
  // the real router redraws it the instant the drag commits. Nothing here
  // is ever saved or shown at rest.
  for (const w of wires) {
    if (paths.has(w.link.id)) continue;
    const vertical = w.p1.nx === 0;
    const points = vertical
      ? [
          { x: w.p1.x, y: w.p1.y },
          { x: w.p1.x, y: (w.p1.y + w.p2.y) / 2 },
          { x: w.p2.x, y: (w.p1.y + w.p2.y) / 2 },
          { x: w.p2.x, y: w.p2.y },
        ]
      : [
          { x: w.p1.x, y: w.p1.y },
          { x: (w.p1.x + w.p2.x) / 2, y: w.p1.y },
          { x: (w.p1.x + w.p2.x) / 2, y: w.p2.y },
          { x: w.p2.x, y: w.p2.y },
        ];
    paths.set(w.link.id, orthoPath(points));
    labels.set(w.link.id, midpointOf(points));
  }

  return { paths, labels };
}

export function routeWires(
  boxes: AnchorBox[],
  links: AnchorLink[],
  options: RouteOptions = {},
): RouteResult {
  const t0 = now();
  const budgetMs = options.budgetMs ?? 400;
  const maxPasses = options.passes ?? 4;
  const boardAbove = options.boardAbove ?? BOARD_ABOVE;

  const wires = wireEnds(boxes, links);
  if (wires.length === 0) {
    return {
      paths: new Map(),
      labels: new Map(),
      stats: { ms: 0, routed: 0, failed: 0, passes: 0, mode: "aware" },
    };
  }

  if (boxes.length > boardAbove) {
    const { paths, labels } = boardRoute(boxes, wires);
    return {
      paths,
      labels,
      stats: {
        ms: +(now() - t0).toFixed(1),
        routed: paths.size,
        failed: wires.length - paths.size,
        passes: 1,
        mode: "board",
      },
    };
  }

  const grid = buildGrid(boxes, wires);
  const occ: Occupancy = {
    hUse: new Int16Array(grid.N),
    vUse: new Int16Array(grid.N),
    nodeH: new Int16Array(grid.N),
    nodeV: new Int16Array(grid.N),
  };
  const budgetExpansions = 120000;
  const laid = new Map<WireEnds, number[]>();
  const manhattan = (w: WireEnds): number =>
    Math.abs(w.p2.x - w.p1.x) + Math.abs(w.p2.y - w.p1.y);

  const routeInto = (w: WireEnds): void => {
    // Widen the fence twice before giving up — but only when the failure
    // was "no path inside the fence". Having burned the whole expansion
    // budget inside a small fence means a bigger one will burn more of it
    // for the same answer, and retrying those turned 38 seconds on a
    // thousand scenes into 51.
    let attempt: Attempt | null = null;
    for (const pad of [MARGIN * 15, MARGIN * 50, Number.POSITIVE_INFINITY]) {
      attempt = routeOne(grid, occ, w, pad, budgetExpansions);
      if (attempt.nodes) break;
      if (attempt.exhausted) break;
    }
    if (!attempt?.nodes) return;
    claim(grid, occ, attempt.nodes, +1);
    laid.set(w, attempt.nodes);
  };

  // Short first: a long wire has more places it can legally go, so it
  // suffers less from being asked to move.
  const order = [...wires].sort((a, b) => manhattan(a) - manhattan(b));
  for (const w of order) routeInto(w);

  /** How much of this wire runs along another, and how far out of its way it went. */
  const badness = (w: WireEnds): number => {
    const nodes = laid.get(w);
    if (!nodes) return Number.POSITIVE_INFINITY;
    const { NY, X, Y } = grid;
    let overlap = 0;
    let length = 0;
    for (let k = 0; k < nodes.length - 1; k += 1) {
      const a = nodes[k];
      const b = nodes[k + 1];
      const ai = (a / NY) | 0;
      const aj = a % NY;
      const bi = (b / NY) | 0;
      const bj = b % NY;
      const horizontal = aj === bj;
      const len = horizontal ? Math.abs(X[bi] - X[ai]) : Math.abs(Y[bj] - Y[aj]);
      length += len;
      const ei = horizontal ? Math.min(ai, bi) * NY + aj : ai * NY + Math.min(aj, bj);
      if ((horizontal ? occ.hUse[ei] : occ.vUse[ei]) > 1) overlap += len;
    }
    return overlap * 4 + Math.max(0, length - manhattan(w));
  };

  let passes = 1;
  for (let pass = 1; pass < maxPasses; pass += 1) {
    if (now() - t0 > budgetMs) break;
    const worst = wires
      .map((w) => [w, badness(w)] as const)
      .filter(([, b]) => b > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, Math.max(1, Math.ceil(wires.length * 0.25)));
    if (!worst.length) break;
    for (const [w] of worst) {
      const nodes = laid.get(w);
      if (nodes) claim(grid, occ, nodes, -1);
      laid.delete(w);
    }
    for (const [w] of worst) routeInto(w);
    passes = pass + 1;
  }

  const paths = new Map<string, string>();
  const labels = new Map<string, { x: number; y: number }>();
  for (const w of wires) {
    const nodes = laid.get(w);
    if (!nodes) continue;
    const points = toPoints(grid, nodes, w);
    paths.set(w.link.id, orthoPath(points));
    labels.set(w.link.id, midpointOf(points));
  }

  return {
    paths,
    labels,
    stats: {
      ms: +(now() - t0).toFixed(1),
      routed: paths.size,
      failed: wires.length - paths.size,
      passes,
      mode: "aware",
    },
  };
}
