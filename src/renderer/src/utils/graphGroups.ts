import type { ContentFolder, ContentNode, FolderRect, Project, Scene } from "../types/project";
import { SCENE_NODE_HEIGHT, SCENE_NODE_WIDTH } from "./graphConstants";

/**
 * Story folders as the graph sees them (v0.28.0).
 *
 * A folder with a `rect` is a box on the canvas; a folder without one just
 * lives in the Content Browser. Everything here is derived from
 * `project.content` — there is no second list of groups to keep in step,
 * which is the entire point of folding Frames into folders.
 */
export interface GraphGroup {
  id: string;
  name: string;
  rect: FolderRect;
  parentId: string | null;
  collapsed: boolean;
  /** How deeply nested this box is, for paint order — a child must sit above its parent. */
  depth: number;
  /**
   * True when this group has no stored rectangle and is being drawn around
   * its own scenes instead. It becomes false the first time the writer
   * moves or resizes it — see graphGroups.
   */
  derived: boolean;
}

/**
 * Every Story group currently drawn on the canvas, parents before children.
 *
 * A group is drawn when it has a stored `rect` OR when it contains at least
 * one scene (v0.31.0). The second rule closes an asymmetry that made the
 * app feel inconsistent: a group made on the graph appeared in the Content
 * Browser instantly, while one made in the Content Browser never appeared
 * on the graph — not even after scenes were filed into it, which left the
 * tree saying "this scene lives in Chapter Two" and the canvas showing it
 * loose with no box around it. That is a softer version of exactly the
 * drift v0.28.0 existed to eliminate.
 *
 * "Contains a scene" is the right trigger rather than "exists", because an
 * EMPTY group cannot create that drift — there is no scene whose home is
 * being misrepresented — and a writer filing things into an empty group
 * ("Cut scenes", "Notes to self") shouldn't have boxes appear on a canvas
 * they never asked to change.
 *
 * A derived rect is not written to the project. It bounds the group's own
 * scenes, so it follows them until the writer first moves or resizes the
 * box, at which point `updateFolderRect` stores a real rect and the group
 * owns its geometry from then on. Deriving here rather than migrating
 * means no project file changes, and no writing to the store from a render.
 */
export function graphGroups(content: ContentNode[], scenes?: Scene[]): GraphGroup[] {
  const derivedRects = scenes ? deriveMissingRects(content, scenes) : new Map<string, FolderRect>();

  const folders = content.filter(
    (n): n is ContentFolder =>
      n.kind === "folder" &&
      n.category === "story" &&
      (Boolean(n.rect) || derivedRects.has(n.id)),
  );
  const drawn = new Set(folders.map((f) => f.id));
  const byId = new Map(content.map((n) => [n.id, n]));

  /**
   * A folder's nearest ancestor that is ALSO drawn. A group nested under an
   * undrawn folder still has to know which box encloses it on screen, and
   * that's the nearest drawn one, not its literal parent.
   */
  function drawnParent(folder: ContentFolder): string | null {
    let current = folder.parentId;
    while (current) {
      if (drawn.has(current)) return current;
      current = byId.get(current)?.parentId ?? null;
    }
    return null;
  }

  const groups = folders.map((folder) => ({
    id: folder.id,
    name: folder.name,
    rect: folder.rect ?? derivedRects.get(folder.id)!,
    /** True while this box is only implied by its contents — see above. */
    derived: !folder.rect,
    parentId: drawnParent(folder),
    collapsed: Boolean(folder.collapsed),
    depth: 0,
  }));

  const index = new Map(groups.map((g) => [g.id, g]));
  for (const group of groups) {
    let depth = 0;
    let parent = group.parentId;
    while (parent && depth < 32) {
      depth += 1;
      parent = index.get(parent)?.parentId ?? null;
    }
    group.depth = depth;
  }

  // Parents first: React Flow paints in array order, and a child box drawn
  // before its parent would be covered by it.
  return groups.sort((a, b) => a.depth - b.depth);
}

/** True when `inner` sits entirely within `outer`. */
export function containsRect(outer: FolderRect, inner: FolderRect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

function containsPoint(rect: FolderRect, point: { x: number; y: number }): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/**
 * Which group a scene dropped at `topLeft` belongs to — the DEEPEST box
 * containing the card's centre point, so dropping into a sub-chapter inside
 * a chapter joins the sub-chapter rather than its parent.
 *
 * The same function backs both the live drag-hover highlight and the actual
 * commit on release, so what lights up while you drag is always what you
 * get when you let go.
 */
export function groupAtPoint(
  groups: GraphGroup[],
  topLeft: { x: number; y: number },
): GraphGroup | null {
  const centre = {
    x: topLeft.x + SCENE_NODE_WIDTH / 2,
    y: topLeft.y + SCENE_NODE_HEIGHT / 2,
  };
  let best: GraphGroup | null = null;
  for (const group of groups) {
    if (!containsPoint(group.rect, centre)) continue;
    if (!best || group.depth > best.depth) best = group;
  }
  return best;
}

/**
 * Which group a dragged GROUP belongs to after being dropped at `rect`.
 *
 * A box uses full containment rather than its centre point, unlike a scene.
 * A chapter is large; its centre can easily land inside a small sub-chapter
 * that it visually swallows, and "the thing I dragged is now inside the
 * thing it encloses" is both wrong and impossible to undo by eye. Requiring
 * the whole rectangle to fit means the answer always matches what the
 * writer can see.
 *
 * `excludeIds` keeps a group from adopting itself or one of its own
 * descendants, which would make a cycle in the content tree.
 */
export function groupContaining(
  groups: GraphGroup[],
  rect: FolderRect,
  excludeIds: Set<string>,
): GraphGroup | null {
  let best: GraphGroup | null = null;
  for (const group of groups) {
    if (excludeIds.has(group.id)) continue;
    if (!containsRect(group.rect, rect)) continue;
    if (!best || group.depth > best.depth) best = group;
  }
  return best;
}

/** Ids of `folderId` and every folder beneath it. */
export function folderSubtree(content: ContentNode[], folderId: string): Set<string> {
  const out = new Set<string>([folderId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const node of content) {
      if (node.parentId && out.has(node.parentId) && !out.has(node.id)) {
        out.add(node.id);
        grew = true;
      }
    }
  }
  return out;
}

/**
 * The smallest rectangle that still holds everything currently inside
 * `folderId` — used to grow a parent when a child is resized past its edge,
 * so a box can never end up visually outside the box that owns it.
 * Returns null when there's nothing inside to bound.
 */
export function contentBounds(
  project: Project,
  folderId: string,
  padding: number,
): FolderRect | null {
  const subtree = folderSubtree(project.content, folderId);
  subtree.delete(folderId);
  if (subtree.size === 0) return null;

  const scenesById = new Map(project.scenes.map((s: Scene) => [s.id, s]));
  const rects: FolderRect[] = [];

  for (const node of project.content) {
    if (!subtree.has(node.id)) continue;
    if (node.kind === "folder") {
      if (node.rect) rects.push(node.rect);
      continue;
    }
    const scene = scenesById.get(node.id);
    if (scene) {
      rects.push({
        x: scene.position.x,
        y: scene.position.y,
        width: SCENE_NODE_WIDTH,
        height: SCENE_NODE_HEIGHT,
      });
    }
  }
  if (rects.length === 0) return null;

  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.width));
  const maxY = Math.max(...rects.map((r) => r.y + r.height));

  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}

/** The union of two rectangles. */
export function unionRect(a: FolderRect, b: FolderRect): FolderRect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

/**
 * Scene ids hidden by a folded group — everything inside any collapsed
 * folder, including things nested several levels down.
 */
export function hiddenSceneIds(project: Project): Set<string> {
  const hidden = new Set<string>();
  const collapsed = project.content.filter(
    (n): n is ContentFolder => n.kind === "folder" && Boolean(n.collapsed) && Boolean(n.rect),
  );
  for (const folder of collapsed) {
    const subtree = folderSubtree(project.content, folder.id);
    subtree.delete(folder.id);
    for (const id of subtree) hidden.add(id);
  }
  return hidden;
}

/**
 * The visible box that stands in for a hidden scene — the outermost folded
 * folder containing it. "Outermost" matters: fold a chapter that has a
 * folded sub-chapter inside it and an edge into that sub-chapter has to
 * land on the chapter you can actually see.
 */
export function visibleStandIn(project: Project, sceneId: string): string | null {
  const byId = new Map(project.content.map((n) => [n.id, n]));
  let current = byId.get(sceneId)?.parentId ?? null;
  let outermostFolded: string | null = null;
  while (current) {
    const node = byId.get(current);
    if (!node || node.kind !== "folder") break;
    if (node.collapsed && node.rect) outermostFolded = node.id;
    current = node.parentId;
  }
  return outermostFolded;
}


/**
 * Bounding rectangles for Story groups that hold scenes but have no stored
 * geometry of their own — see graphGroups.
 *
 * Computed deepest-first so a nested group's derived box is already known
 * when its parent's is computed, and the parent ends up enclosing it rather
 * than only the scenes directly inside it.
 */
function deriveMissingRects(content: ContentNode[], scenes: Scene[]): Map<string, FolderRect> {
  const derived = new Map<string, FolderRect>();

  const folders = content.filter(
    (n): n is ContentFolder => n.kind === "folder" && n.category === "story" && !n.rect,
  );
  if (folders.length === 0) return derived;

  const scenesById = new Map(scenes.map((s) => [s.id, s]));
  const byId = new Map(content.map((n) => [n.id, n]));

  function depthOf(node: ContentNode): number {
    let depth = 0;
    let current = node.parentId;
    while (current && depth < 64) {
      depth += 1;
      current = byId.get(current)?.parentId ?? null;
    }
    return depth;
  }

  for (const folder of [...folders].sort((a, b) => depthOf(b) - depthOf(a))) {
    const subtree = folderSubtree(content, folder.id);
    subtree.delete(folder.id);

    const rects: FolderRect[] = [];
    for (const id of subtree) {
      const scene = scenesById.get(id);
      if (scene) {
        rects.push({
          x: scene.position.x,
          y: scene.position.y,
          width: SCENE_NODE_WIDTH,
          height: SCENE_NODE_HEIGHT,
        });
        continue;
      }
      const child = byId.get(id);
      const childRect = child?.kind === "folder" ? (child.rect ?? derived.get(id)) : undefined;
      if (childRect) rects.push(childRect);
    }
    if (rects.length === 0) continue; // empty group — deliberately not drawn

    const minX = Math.min(...rects.map((r) => r.x));
    const minY = Math.min(...rects.map((r) => r.y));
    derived.set(folder.id, {
      x: minX - DERIVED_PADDING,
      // Extra room at the top for the group's own title bar, which is drawn
      // inside its rectangle and would otherwise sit over the first scene.
      y: minY - DERIVED_PADDING - DERIVED_HEADER,
      width: Math.max(...rects.map((r) => r.x + r.width)) - minX + DERIVED_PADDING * 2,
      height:
        Math.max(...rects.map((r) => r.y + r.height)) - minY + DERIVED_PADDING * 2 + DERIVED_HEADER,
    });
  }

  return derived;
}

const DERIVED_PADDING = 26;
const DERIVED_HEADER = 26;
