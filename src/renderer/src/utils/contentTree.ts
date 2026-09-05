import type { ContentCategory, ContentNode } from "../types/project";

/** A node's direct children within its category, sorted for display. */
export function childrenOf(
  nodes: ContentNode[],
  category: ContentCategory,
  parentId: string | null,
): ContentNode[] {
  return nodes
    .filter((n) => n.category === category && n.parentId === parentId)
    .sort((a, b) => a.order - b.order);
}

/** The next `order` value to append a new sibling under `parentId`. */
export function nextOrder(
  nodes: ContentNode[],
  category: ContentCategory,
  parentId: string | null,
): number {
  const siblings = childrenOf(nodes, category, parentId);
  return siblings.length === 0 ? 0 : Math.max(...siblings.map((s) => s.order)) + 1;
}

/** True if `candidateId` is `ancestorId` itself, or nested under it. Used to
 * stop a folder from being dragged into its own descendant (a cycle). */
export function isDescendant(nodes: ContentNode[], candidateId: string, ancestorId: string): boolean {
  let current: ContentNode | undefined = nodes.find((n) => n.id === candidateId);
  while (current) {
    if (current.id === ancestorId) return true;
    current = current.parentId ? nodes.find((n) => n.id === current!.parentId) : undefined;
  }
  return false;
}

/**
 * Where a drag-over point falls within a row: the top/bottom quarters mean
 * "drop as a sibling before/after this item"; the middle means "drop inside"
 * — but only folders accept "inside" (a scene can't contain children).
 */
export function computeDropPosition(
  clientY: number,
  rect: { top: number; height: number },
  isFolder: boolean,
): "before" | "after" | "inside" {
  const ratio = (clientY - rect.top) / rect.height;
  if (isFolder) {
    if (ratio < 0.25) return "before";
    if (ratio > 0.75) return "after";
    return "inside";
  }
  return ratio < 0.5 ? "before" : "after";
}

/** Every ancestor folder id of `id`, nearest first — used to expand a
 * node's containing folders so it's visible after a search jump. */
export function ancestorsOf(nodes: ContentNode[], id: string): string[] {
  const result: string[] = [];
  let current = nodes.find((n) => n.id === id);
  while (current?.parentId) {
    result.push(current.parentId);
    current = nodes.find((n) => n.id === current!.parentId);
  }
  return result;
}

/**
 * The tree flattened into the exact top-to-bottom order it's currently
 * rendered in — only descending into folders whose id is in `expandedIds`.
 * Used for Shift+Click range selection, so the range matches what the user
 * actually sees on screen rather than the full underlying tree.
 */
export function flattenVisible(
  nodes: ContentNode[],
  category: ContentCategory,
  parentId: string | null,
  expandedIds: Set<string>,
): ContentNode[] {
  const result: ContentNode[] = [];
  for (const node of childrenOf(nodes, category, parentId)) {
    result.push(node);
    if (node.kind === "folder" && expandedIds.has(node.id)) {
      result.push(...flattenVisible(nodes, category, node.id, expandedIds));
    }
  }
  return result;
}
