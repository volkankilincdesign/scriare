import dagre from "@dagrejs/dagre";
import { SCENE_NODE_HEIGHT, SCENE_NODE_WIDTH, snapPoint } from "./graphConstants";

interface LayoutEdge {
  source: string;
  target: string;
}

/** Vertical gap between two cards in the same column — two grid cells. */
const GAP_BETWEEN_ROWS = 36;
/** Horizontal gap between columns — six cells, room for a wire and its number. */
const GAP_BETWEEN_COLUMNS = 108;

/**
 * How far into the story each scene is: the LONGEST path to it from a scene
 * nothing leads to. Longest rather than shortest, because a scene you can
 * reach both directly and the long way round belongs after the long way —
 * putting it earlier would draw its own feeder as an arrow pointing back.
 *
 * Stories loop (a hub you return to, a corridor you re-enter), and a cycle
 * has no depth. Kahn's algorithm drains everything acyclic and stops; what
 * is left is exactly the scenes in cycles, and each of those is placed one
 * past the deepest scene that feeds it from outside the tangle. That is
 * arbitrary in the way any answer here is arbitrary, and it is stable.
 */
function storyDepth(nodeIds: string[], edges: LayoutEdge[]): Map<string, number> {
  const out = new Map<string, string[]>(nodeIds.map((id) => [id, []]));
  const remaining = new Map<string, number>(nodeIds.map((id) => [id, 0]));
  for (const edge of edges) {
    out.get(edge.source)!.push(edge.target);
    remaining.set(edge.target, (remaining.get(edge.target) ?? 0) + 1);
  }

  const depth = new Map<string, number>(nodeIds.map((id) => [id, 0]));
  const queue = nodeIds.filter((id) => remaining.get(id) === 0);
  const settled = new Set(queue);
  while (queue.length) {
    const id = queue.shift()!;
    for (const next of out.get(id)!) {
      depth.set(next, Math.max(depth.get(next) ?? 0, (depth.get(id) ?? 0) + 1));
      remaining.set(next, (remaining.get(next) ?? 0) - 1);
      if (remaining.get(next) === 0 && !settled.has(next)) {
        settled.add(next);
        queue.push(next);
      }
    }
  }

  for (const id of nodeIds) {
    if (settled.has(id)) continue;
    let best = 0;
    for (const edge of edges) {
      if (edge.target === id && settled.has(edge.source)) {
        best = Math.max(best, (depth.get(edge.source) ?? 0) + 1);
      }
    }
    depth.set(id, best);
  }
  return depth;
}

/**
 * Computes a clean left-to-right layered layout for the given node ids,
 * based on their connections, using dagre. As of v0.16.0 a "node id" here
 * can be either a loose scene's own id or a Frame's id (standing in for
 * every scene grouped into it, collapsed to one node — see
 * `projectStore.autoLayoutScenes` for how that collapsing is built) —
 * callers are expected to have already decided which ids to pass and to
 * filter/collapse edges accordingly; this function itself doesn't know or
 * care what a given id "is."
 *
 * `nodeSize`, when given, returns the real footprint to reserve for a
 * specific id — a Frame's own `size`, most importantly, so dagre gives it
 * as much room as it actually needs instead of scene-card-sized space.
 * Omitted (or returning nothing for a particular id) falls back to the
 * standard scene card footprint, preserving the original behavior for a
 * plain scene-only layout.
 */
export function computeAutoLayout(
  nodeIds: string[],
  edges: LayoutEdge[],
  nodeSize?: (id: string) => { width: number; height: number } | undefined,
): Record<string, { x: number; y: number }> {
  const graph = new dagre.graphlib.Graph();
  // v0.43.0 — tighter than the 60/140 this shipped with, and both figures
  // are whole cells of the canvas grid (2 and 6), so a laid-out story and a
  // hand-dragged one are measured in the same unit.
  graph.setGraph({ rankdir: "LR", nodesep: GAP_BETWEEN_ROWS, ranksep: GAP_BETWEEN_COLUMNS });
  graph.setDefaultEdgeLabel(() => ({}));

  const idSet = new Set(nodeIds);
  const sizeById = new Map<string, { width: number; height: number }>();
  nodeIds.forEach((id) => {
    const size = nodeSize?.(id) ?? { width: SCENE_NODE_WIDTH, height: SCENE_NODE_HEIGHT };
    sizeById.set(id, size);
    graph.setNode(id, size);
  });

  const live = edges.filter((e) => idSet.has(e.source) && idSet.has(e.target));
  // Every scene sits one column past the scene that leads to it (v0.43.0,
  // reported as "it tidies up the space but seems like not enough").
  //
  // dagre's own ranking minimises total edge length, which is right for a
  // flowchart and wrong for a story: given a scene with three choices, it is
  // free to put each option in a different column so that the long branch
  // and the short one meet neatly at the merge. The result is a staircase —
  // three options from one moment marching down and to the right, with not
  // one of their connections horizontal.
  //
  // Ranking by story depth instead (how far a scene is from the opening,
  // longest path) puts all three options in ONE column: the trunk runs
  // straight across, a branch is a vertical fan at the moment it happens,
  // and columns mean something a writer can read — "this is how far in this
  // scene is". dagre has no setting for this, so the ranks are computed here
  // and forced by giving each edge a minimum length equal to the gap it
  // has to span; the ranking that satisfies all of them exactly is the one
  // below, and it is the cheapest, so network simplex lands on it.
  const depth = storyDepth(nodeIds, live);
  live.forEach((edge) => {
    graph.setEdge(edge.source, edge.target, {
      minlen: Math.max(1, (depth.get(edge.target) ?? 0) - (depth.get(edge.source) ?? 0)),
    });
  });

  dagre.layout(graph);
  straightenRuns(graph, nodeIds, live);

  const positions: Record<string, { x: number; y: number }> = {};
  nodeIds.forEach((id) => {
    const node = graph.node(id);
    const size = sizeById.get(id)!;
    // dagre positions by center — convert to the top-left corner our
    // project data model expects.
    // v0.42.0 — snapped, so Auto Layout's output sits on the same grid a
    // hand-dragged card does. Without this, one tidy pass puts every scene
    // half a cell off and the first manual nudge afterwards looks like it
    // moved something that was already aligned.
    positions[id] = snapPoint({
      x: node.x - size.width / 2,
      y: node.y - size.height / 2,
    });
  });

  return positions;
}

/** Vertical clearance kept between two cards in the same column. */
const STRAIGHTEN_CLEARANCE = 12;

/**
 * Pulls a scene onto the line of the scenes that lead to it (v0.43.0).
 *
 * Ranking by story depth (above) puts everything in the right column but
 * says nothing about height, and dagre decides that by a median rule that
 * also has to make room for the connections passing THROUGH a column. A
 * spine of four scenes, one per column, comes out of it as a gentle
 * zig-zag — every card a little above or below the last, not one of its
 * connections horizontal. That is the "tidied, but not tidy" the report
 * was about.
 *
 * The rule here is deliberately narrow: a scene joins its feeders' line
 * only when they ALL sit on one line already, so a merge point stays
 * between the branches it merges rather than snapping onto whichever one
 * happened to be checked first. Columns are walked left to right, so an
 * alignment propagates along a spine in one pass. A move that would put
 * two cards on top of each other is skipped — a straight connection is
 * worth less than being able to read the two scenes it joins.
 */
function straightenRuns(
  graph: dagre.graphlib.Graph,
  nodeIds: string[],
  edges: LayoutEdge[],
): void {
  const known = new Set(nodeIds);
  const feeders = new Map<string, string[]>(nodeIds.map((id) => [id, []]));
  for (const edge of edges) {
    if (known.has(edge.source) && known.has(edge.target)) feeders.get(edge.target)!.push(edge.source);
  }

  const rankOf = (id: string): number => (graph.node(id) as { rank?: number }).rank ?? 0;
  const byRank = new Map<number, string[]>();
  for (const id of nodeIds) {
    const rank = rankOf(id);
    const row = byRank.get(rank);
    if (row) row.push(id);
    else byRank.set(rank, [id]);
  }

  for (const rank of [...byRank.keys()].sort((a, b) => a - b)) {
    for (const id of byRank.get(rank)!) {
      const node = graph.node(id);
      // Only feeders to the LEFT: a connection that loops back from a later
      // scene says nothing about where this one belongs.
      const earlier = feeders.get(id)!.filter((f) => rankOf(f) < rank);
      if (earlier.length === 0) continue;
      const lines = new Set(earlier.map((f) => graph.node(f).y));
      if (lines.size !== 1) continue;
      const line = [...lines][0];
      if (node.y === line) continue;
      const clash = byRank.get(rank)!.some((other) => {
        if (other === id) return false;
        const o = graph.node(other);
        return Math.abs(o.y - line) < (o.height + node.height) / 2 + STRAIGHTEN_CLEARANCE;
      });
      if (clash) continue;
      node.y = line;
    }
  }
}
