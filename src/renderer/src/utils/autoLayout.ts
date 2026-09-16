import dagre from "@dagrejs/dagre";
import { SCENE_NODE_HEIGHT, SCENE_NODE_WIDTH, snapPoint } from "./graphConstants";

interface LayoutEdge {
  source: string;
  target: string;
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
  graph.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 140 });
  graph.setDefaultEdgeLabel(() => ({}));

  const idSet = new Set(nodeIds);
  const sizeById = new Map<string, { width: number; height: number }>();
  nodeIds.forEach((id) => {
    const size = nodeSize?.(id) ?? { width: SCENE_NODE_WIDTH, height: SCENE_NODE_HEIGHT };
    sizeById.set(id, size);
    graph.setNode(id, size);
  });
  edges.forEach((edge) => {
    if (idSet.has(edge.source) && idSet.has(edge.target)) {
      graph.setEdge(edge.source, edge.target);
    }
  });

  dagre.layout(graph);

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
