import { GRAPH_GRID } from "./graphConstants";

/**
 * Where a connection leaves a card, and where it arrives (v0.73.0).
 *
 * Until now there was one answer to both: the middle of the right edge out,
 * the middle of the left edge in, for every wire on the canvas. Two things
 * followed from that, and both of them were reported as "it is impossible to
 * read which node is connected to which".
 *
 * The first is arithmetic. Four choices leaving one scene left from the same
 * pixel, so for the first stretch of their journey they were the same line —
 * measured on The Blue Hour, 66 pairs of wires shared a starting point and
 * 104 shared a finishing one. There is no routing clever enough to separate
 * two lines that begin at the same place.
 *
 * The second only appeared once chapters began running down the page. A
 * choice leading to the scene directly below had to leave SIDEWAYS, swing
 * out into empty canvas, turn round and come back — so for its first forty
 * pixels it pointed at the wrong scene entirely. In a stacked layout 64 of
 * The Blue Hour's 72 wires were that shape.
 *
 * So: one anchor per choice, and the anchor is on whichever side the wire is
 * actually heading for.
 */

/** Which edge of a card a wire uses. */
export type Side = "top" | "right" | "bottom" | "left";

export interface AnchorBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AnchorLink {
  id: string;
  source: string;
  target: string;
  /** Position on the page — choice 1, choice 2 — so slots read in writing order. */
  ordinal: number;
}

export interface Anchor {
  x: number;
  y: number;
  /** Unit normal: the direction the wire sets off in. */
  nx: number;
  ny: number;
  side: Side;
}

export interface WireEnds {
  link: AnchorLink;
  from: AnchorBox;
  to: AnchorBox;
  p1: Anchor;
  p2: Anchor;
}

const OPPOSITE: Record<Side, Side> = {
  right: "left",
  left: "right",
  bottom: "top",
  top: "bottom",
};

/**
 * The side a wire should leave by: whichever direction the target actually
 * lies in, measured by the widest clear gap between the two cards.
 *
 * Ties fall to `right`, then `bottom` — so a story that could be read either
 * way is read the way stories are read. A card that overlaps its target on
 * both axes has no clear gap at all and every candidate is negative; the
 * same ordering then picks the least wrong one, which is what you want for
 * two cards sitting almost on top of each other.
 */
export function sideFor(a: AnchorBox, b: AnchorBox): [Side, Side] {
  const gaps: [Side, number][] = [
    ["right", b.x - (a.x + a.width)],
    ["bottom", b.y - (a.y + a.height)],
    ["left", a.x - (b.x + b.width)],
    ["top", a.y - (b.y + b.height)],
  ];
  gaps.sort((p, q) => q[1] - p[1]);
  return [gaps[0][0], OPPOSITE[gaps[0][0]]];
}

/**
 * Slots are measured OUTWARD FROM THE CENTRE on a fixed pitch, not spread at
 * even fractions of the edge.
 *
 * An earlier version of this comment claimed that spreading at fractions
 * costs you the centre line, so a spine between two cards sitting plumb
 * above each other would have to jog to meet itself. That is false, and the
 * negative control for it proved so by staying green: at even fractions a
 * card with three exits puts them at a quarter, a half and three quarters,
 * and the middle one is on the centre line exactly as it is here. Both
 * schemes give an odd count the centre. The comment was the thing that was
 * wrong, and it is worth leaving the correction in rather than quietly
 * deleting the claim.
 *
 * What actually differs is whether the spacing is a constant of the design
 * or a function of how many choices a scene happens to have. At fractions a
 * card with two exits spaces them sixty pixels apart and a card with four
 * spaces them thirty-six, so two neighbouring scenes hand their wires out on
 * two different rhythms and the lanes never line up. On a fixed pitch every
 * card offers the same spacing, and that pitch is the canvas's own dot field
 * — the grid every card already snaps to — so a wire leaves on the same
 * lattice it is about to travel on.
 *
 * Halved across a card's short edge, because 56px will not hold three whole
 * cells. It compresses below the pitch only when a card is busy enough that
 * its slots would otherwise run off the end, which in practice is the
 * arrival side of a hub and never the exit side: no scene in a real story
 * has had more than four ways out.
 */
export function anchorAt(box: AnchorBox, side: Side, index: number, count: number): Anchor {
  const vertical = side === "right" || side === "left";
  const along = vertical ? box.height : box.width;
  const pitch = Math.min(vertical ? GRAPH_GRID / 2 : GRAPH_GRID * 2, along / (count + 1));
  const offset = (index - (count - 1) / 2) * pitch;
  switch (side) {
    case "right":
      return { x: box.x + box.width, y: box.y + box.height / 2 + offset, nx: 1, ny: 0, side };
    case "left":
      return { x: box.x, y: box.y + box.height / 2 + offset, nx: -1, ny: 0, side };
    case "bottom":
      return { x: box.x + box.width / 2 + offset, y: box.y + box.height, nx: 0, ny: 1, side };
    default:
      return { x: box.x + box.width / 2 + offset, y: box.y, nx: 0, ny: -1, side };
  }
}

/**
 * Every wire's two ends, with the slots allocated.
 *
 * Exits keep the order they were written in: the first choice on the page is
 * the first slot on the edge, which is a fact about the writing and free to
 * show. Arrivals are ordered by where they come FROM, along the axis of the
 * edge they land on, so two wires never cross each other in the last twenty
 * pixels for no reason at all.
 */
export function wireEnds(boxes: AnchorBox[], links: AnchorLink[]): WireEnds[] {
  const byId = new Map(boxes.map((b) => [b.id, b]));
  interface Pending {
    link: AnchorLink;
    from: AnchorBox;
    to: AnchorBox;
    sOut: Side;
    sIn: Side;
  }
  const pending: Pending[] = [];
  for (const link of links) {
    const from = byId.get(link.source);
    const to = byId.get(link.target);
    if (!from || !to || from === to) continue;
    const [sOut, sIn] = sideFor(from, to);
    pending.push({ link, from, to, sOut, sIn });
  }

  const outGroups = new Map<string, Pending[]>();
  const inGroups = new Map<string, Pending[]>();
  for (const p of pending) {
    const ok = `${p.link.source}|${p.sOut}`;
    const ik = `${p.link.target}|${p.sIn}`;
    (outGroups.get(ok) ?? outGroups.set(ok, []).get(ok)!).push(p);
    (inGroups.get(ik) ?? inGroups.set(ik, []).get(ik)!).push(p);
  }

  const slotOut = new Map<AnchorLink, [number, number]>();
  const slotIn = new Map<AnchorLink, [number, number]>();
  for (const group of outGroups.values()) {
    group.sort((a, b) => a.link.ordinal - b.link.ordinal || a.link.id.localeCompare(b.link.id));
    group.forEach((p, i) => slotOut.set(p.link, [i, group.length]));
  }
  for (const group of inGroups.values()) {
    const along = (p: Pending): number =>
      p.sIn === "left" || p.sIn === "right" ? p.from.y : p.from.x;
    group.sort((a, b) => along(a) - along(b) || a.link.id.localeCompare(b.link.id));
    group.forEach((p, i) => slotIn.set(p.link, [i, group.length]));
  }

  return pending.map((p) => {
    const [oi, on] = slotOut.get(p.link)!;
    const [ii, inn] = slotIn.get(p.link)!;
    return {
      link: p.link,
      from: p.from,
      to: p.to,
      p1: anchorAt(p.from, p.sOut, oi, on),
      p2: anchorAt(p.to, p.sIn, ii, inn),
    };
  });
}
