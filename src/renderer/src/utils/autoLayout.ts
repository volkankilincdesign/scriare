import dagre from "@dagrejs/dagre";
import { SCENE_NODE_HEIGHT, SCENE_NODE_WIDTH } from "./graphConstants";

interface LayoutEdge {
  source: string;
  target: string;
}

/** Gap between two cards side by side in the same rank — two grid cells. */
const GAP_BETWEEN_ROWS = 36;
/** Gap between ranks — six cells, room for a wire and its number. */
const GAP_BETWEEN_COLUMNS = 108;

/**
 * The same two gaps for a chapter that runs DOWN the page (v0.73.0).
 *
 * They are not the sideways pair with the names swapped. Running down, the
 * gap between one scene and the next is where a wire turns, and 36px is not
 * enough room to turn in — a router with no lane to change into puts the
 * wire through the card. Five cells gives it somewhere to go. Across, two
 * branches of the same moment want to sit close enough to read as a pair
 * rather than as two unrelated columns, and 90 is five cells of the dot
 * field, which is one bright dot apart.
 */
const STACK_GAP_BETWEEN_RANKS = 90;
const STACK_GAP_ACROSS = 90;

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
 * based on their connections, using dagre.
 *
 * A "node id" here is a scene's own id or a GROUP's id standing in for
 * everything inside it, collapsed to one node. Callers decide which ids to
 * pass and collapse the edges to match; this function does not know or
 * care what a given id "is".
 *
 * `nodeSize`, when given, returns the real footprint to reserve for an id —
 * a group's own size, most importantly, so dagre gives it the room it
 * actually needs rather than scene-card-sized space. Omitted, it falls back
 * to the standard scene card.
 *
 * (This described Frames and pointed at `projectStore.autoLayoutScenes` for
 * the collapsing. Frames were replaced by content-tree groups in v0.28.0
 * and the collapsing moved to utils/autoLayoutGraph.ts — so the comment
 * sent a reader to a concept the app no longer has, in a file whose whole
 * job is the thing being described. Corrected v0.51.0.)
 */
export function computeAutoLayout(
  nodeIds: string[],
  edges: LayoutEdge[],
  nodeSize?: (id: string) => { width: number; height: number } | undefined,
  rankdir: "LR" | "TB" = "LR",
): Record<string, { x: number; y: number }> {
  const graph = new dagre.graphlib.Graph();
  // v0.43.0 — tighter than the 60/140 this shipped with, and both figures
  // are whole cells of the canvas grid (2 and 6), so a laid-out story and a
  // hand-dragged one are measured in the same unit.
  const nodesep = rankdir === "LR" ? GAP_BETWEEN_ROWS : STACK_GAP_ACROSS;
  const ranksep = rankdir === "LR" ? GAP_BETWEEN_COLUMNS : STACK_GAP_BETWEEN_RANKS;
  graph.setGraph({ rankdir, nodesep, ranksep });
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
  straightenRuns(graph, nodeIds, live, rankdir);

  const positions: Record<string, { x: number; y: number }> = {};
  nodeIds.forEach((id) => {
    const node = graph.node(id);
    const size = sizeById.get(id)!;
    // dagre positions by centre — convert to the top-left corner our
    // project data model expects.
    //
    // NOT snapped here (v0.51.0). It used to be, and the comment on the
    // other snap — in projectStore's autoLayoutScenes — said flatly that
    // snapping happens "here rather than inside the layout algorithm",
    // which was untrue while both existed. The inner one was also doing
    // nothing: groups are resized and their contents re-based afterwards
    // by offsets that are not whole cells, so its output was overwritten
    // before anything saw it. Removed and measured — graph-auto-layout's
    // 17 checks and graph-grid's 16 all stay green, which is the claim
    // that the LAST snap is the one that decides.
    positions[id] = {
      x: node.x - size.width / 2,
      y: node.y - size.height / 2,
    };
  });

  return positions;
}

/** Clearance kept between two cards sharing a rank. */
const STRAIGHTEN_CLEARANCE = 12;

/**
 * Pulls a scene onto the line of the scenes that lead to it (v0.43.0).
 *
 * v0.73.0 — the "line" is now whichever axis runs ACROSS the flow, rather
 * than always the vertical one. Sideways that is unchanged and means what
 * it always meant. Stacked, it is the horizontal position, and it is the
 * difference between a chapter reading as a spine and reading as a
 * staircase sliding downhill — which was most of what "logically true but
 * not pleasing" was pointing at. The function was hard-coded to `.y`
 * because until now there was only one direction; nobody had taught it the
 * general rule, only the one case.
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
  rankdir: "LR" | "TB",
): void {
  // The coordinate across the flow, and the size measured along it.
  const cross = rankdir === "LR" ? "y" : "x";
  const span = rankdir === "LR" ? "height" : "width";
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
      const lines = new Set(earlier.map((f) => graph.node(f)[cross] as number));
      if (lines.size !== 1) continue;
      const line = [...lines][0];
      if (node[cross] === line) continue;
      const clash = byRank.get(rank)!.some((other) => {
        if (other === id) return false;
        const o = graph.node(other);
        return (
          Math.abs((o[cross] as number) - line) <
          ((o[span] as number) + (node[span] as number)) / 2 + STRAIGHTEN_CLEARANCE
        );
      });
      if (clash) continue;
      node[cross] = line;
    }
  }
}
