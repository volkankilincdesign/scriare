import dagre from "@dagrejs/dagre";
import { SCENE_NODE_HEIGHT, SCENE_NODE_WIDTH } from "./graphConstants";

interface LayoutEdge {
  source: string;
  target: string;
}

/**
 * Computes a clean left-to-right layered layout for the given scene ids,
 * based on their choice connections, using dagre. Only meant to arrange
 * scenes that aren't manually grouped into a Frame — callers are expected
 * to filter the id list accordingly.
 */
export function computeAutoLayout(
  sceneIds: string[],
  edges: LayoutEdge[],
): Record<string, { x: number; y: number }> {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 140 });
  graph.setDefaultEdgeLabel(() => ({}));

  const idSet = new Set(sceneIds);
  sceneIds.forEach((id) => {
    graph.setNode(id, { width: SCENE_NODE_WIDTH, height: SCENE_NODE_HEIGHT });
  });
  edges.forEach((edge) => {
    if (idSet.has(edge.source) && idSet.has(edge.target)) {
      graph.setEdge(edge.source, edge.target);
    }
  });

  dagre.layout(graph);

  const positions: Record<string, { x: number; y: number }> = {};
  sceneIds.forEach((id) => {
    const node = graph.node(id);
    // dagre positions by center — convert to the top-left corner our
    // project data model expects.
    positions[id] = {
      x: node.x - SCENE_NODE_WIDTH / 2,
      y: node.y - SCENE_NODE_HEIGHT / 2,
    };
  });

  return positions;
}
