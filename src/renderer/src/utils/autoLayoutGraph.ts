import type { ContentFolder, ContentNode, Project, Scene } from "../types/project";
import { computeAutoLayout } from "./autoLayout";
import { FOLDER_MIN_HEIGHT, FOLDER_MIN_WIDTH, FOLDER_PADDING, SCENE_NODE_HEIGHT, SCENE_NODE_WIDTH } from "./graphConstants";
import { extractChoices } from "./choiceBlocks";
import { graphGroups } from "./graphGroups";

/**
 * Vertical room reserved for a group's title bar, which is drawn inside the
 * box's own rectangle (see GroupNode). Without this, the first row of a
 * freshly laid-out chapter sits under its own name.
 */
const GROUP_HEADER_HEIGHT = 26;

/**
 * Auto Layout, all the way down (v0.29.0).
 *
 * Until now Auto Layout arranged the top level and stopped: a group was
 * placed as a single unit and whatever was inside it kept its exact
 * arrangement, untouched. That rule came from the Frame era and was right
 * then — a frame was a box someone had drawn and filled by hand, and
 * rearranging its contents would have thrown away deliberate work.
 *
 * Folding frames into folders (v0.28.0) changed what a group is, and with
 * it what "don't undo the writer's organizing work" should mean. A group is
 * now a chapter, and a chapter's internal arrangement is the thing most
 * likely to end up a mess after a run of imprecise drags — exactly what
 * someone reaches for Auto Layout to fix. Refusing to touch it meant there
 * was no way to tidy the inside of a chapter at all.
 *
 * So this lays out every container, innermost first, and resizes each group
 * to fit what it now holds. It is a bigger, more destructive action than it
 * used to be — which is fine, because it is one undo step, and undo has
 * existed since v0.25.0. That is the trade: the button does the obvious
 * thing, and Ctrl+Z is there when the obvious thing wasn't wanted.
 */
interface LayoutResult {
  scenes: Scene[];
  content: ContentNode[];
}

/** Members of one container: scenes and drawn sub-groups that sit directly inside it. */
interface Member {
  id: string;
  kind: "scene" | "group";
  width: number;
  height: number;
}

export function computeGraphLayout(project: Project): LayoutResult | null {
  const groups = graphGroups(project.content);
  const groupIds = new Set(groups.map((g) => g.id));

  // A scene or sub-group belongs to the nearest DRAWN folder above it; an
  // undrawn folder is a Content Browser concept only, so its contents sit
  // in whatever box actually encloses them on screen.
  const containerOf = new Map<string, string | null>();
  const byId = new Map(project.content.map((n) => [n.id, n]));
  function nearestDrawnAncestor(nodeId: string): string | null {
    let current = byId.get(nodeId)?.parentId ?? null;
    let guard = 0;
    while (current && guard++ < 64) {
      if (groupIds.has(current)) return current;
      current = byId.get(current)?.parentId ?? null;
    }
    return null;
  }
  for (const scene of project.scenes) containerOf.set(scene.id, nearestDrawnAncestor(scene.id));
  for (const group of groups) containerOf.set(group.id, group.parentId);

  // Which layout member stands in for a scene inside a given container:
  // itself if it sits directly there, otherwise the sub-group that holds
  // it. This is what turns a choice between two scenes in different
  // chapters into one edge between those chapters.
  function memberFor(sceneId: string, containerId: string | null): string | undefined {
    let current: string | null = containerOf.get(sceneId) ?? null;
    let child = sceneId;
    let guard = 0;
    while (guard++ < 64) {
      if (current === containerId) return child;
      if (current === null) return undefined;
      child = current;
      current = containerOf.get(current) ?? null;
    }
    return undefined;
  }

  const rawLinks = project.scenes.flatMap((scene) =>
    extractChoices(scene.content)
      .filter((c): c is typeof c & { targetSceneId: string } => Boolean(c.targetSceneId))
      .map((c) => ({ source: scene.id, target: c.targetSceneId })),
  );

  // Results accumulate here; a group's size is finalised by its own pass
  // before its parent's pass reads it, which is why this goes innermost
  // first.
  const sizes = new Map<string, { width: number; height: number }>();
  const localPositions = new Map<string, Record<string, { x: number; y: number }>>();

  const ordered = [...groups].sort((a, b) => b.depth - a.depth); // deepest first
  const containers: (string | null)[] = [...ordered.map((g) => g.id), null];

  for (const containerId of containers) {
    const members: Member[] = [];
    for (const scene of project.scenes) {
      if (containerOf.get(scene.id) === containerId) {
        members.push({ id: scene.id, kind: "scene", width: SCENE_NODE_WIDTH, height: SCENE_NODE_HEIGHT });
      }
    }
    for (const group of groups) {
      if (containerOf.get(group.id) !== containerId) continue;
      const size = sizes.get(group.id) ?? { width: group.rect.width, height: group.rect.height };
      members.push({ id: group.id, kind: "group", width: size.width, height: size.height });
    }

    if (members.length === 0) {
      // An empty group keeps a usable footprint rather than collapsing to
      // nothing — it's still somewhere to drag scenes into.
      if (containerId) sizes.set(containerId, { width: FOLDER_MIN_WIDTH, height: FOLDER_MIN_HEIGHT });
      continue;
    }

    const memberIds = new Set(members.map((m) => m.id));
    const seen = new Set<string>();
    const edges: { source: string; target: string }[] = [];
    for (const link of rawLinks) {
      const source = memberFor(link.source, containerId);
      const target = memberFor(link.target, containerId);
      if (!source || !target || source === target) continue;
      if (!memberIds.has(source) || !memberIds.has(target)) continue;
      const key = `${source}->${target}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ source, target });
    }

    const sizeById = new Map(members.map((m) => [m.id, { width: m.width, height: m.height }]));
    const positions = computeAutoLayout([...memberIds], edges, (id) => sizeById.get(id));
    localPositions.set(containerId ?? "", positions);

    if (containerId) {
      // The group grows (or shrinks) to exactly hold what dagre just
      // arranged, plus air. Leaving the old size would mean a tidy layout
      // rattling around inside a box that no longer relates to it.
      const xs = members.map((m) => positions[m.id].x);
      const ys = members.map((m) => positions[m.id].y);
      const xe = members.map((m) => positions[m.id].x + m.width);
      const ye = members.map((m) => positions[m.id].y + m.height);
      const width = Math.max(FOLDER_MIN_WIDTH, Math.max(...xe) - Math.min(...xs) + FOLDER_PADDING * 2);
      // Extra room at the top for the group's own title bar, which sits
      // inside the box and would otherwise overlap the first row.
      const height = Math.max(
        FOLDER_MIN_HEIGHT,
        Math.max(...ye) - Math.min(...ys) + FOLDER_PADDING * 2 + GROUP_HEADER_HEIGHT,
      );
      sizes.set(containerId, { width, height });
    }
  }

  // --- resolve every local layout into absolute canvas coordinates ---
  const absolute = new Map<string, { x: number; y: number }>();

  function place(containerId: string | null, originX: number, originY: number): void {
    const positions = localPositions.get(containerId ?? "");
    if (!positions) return;
    const ids = Object.keys(positions);
    if (ids.length === 0) return;

    const minX = Math.min(...ids.map((id) => positions[id].x));
    const minY = Math.min(...ids.map((id) => positions[id].y));

    for (const id of ids) {
      const x = originX + (positions[id].x - minX);
      const y = originY + (positions[id].y - minY);
      absolute.set(id, { x, y });
      if (groupIds.has(id)) {
        place(id, x + FOLDER_PADDING, y + FOLDER_PADDING + GROUP_HEADER_HEIGHT);
      }
    }
  }

  // The root keeps the layout anchored where the existing content already
  // is, rather than jumping the whole story to the origin every time.
  const anchorX = Math.min(...project.scenes.map((s) => s.position.x), 80);
  const anchorY = Math.min(...project.scenes.map((s) => s.position.y), 80);
  place(null, anchorX, anchorY);

  if (absolute.size === 0) return null;

  const scenes = project.scenes.map((scene) => {
    const pos = absolute.get(scene.id);
    return pos ? { ...scene, position: pos } : scene;
  });

  const content = project.content.map((node) => {
    if (node.kind !== "folder" || !node.rect) return node;
    const pos = absolute.get(node.id);
    const size = sizes.get(node.id);
    if (!pos && !size) return node;
    const folder = node as ContentFolder;
    return {
      ...folder,
      rect: {
        x: pos?.x ?? folder.rect!.x,
        y: pos?.y ?? folder.rect!.y,
        width: size?.width ?? folder.rect!.width,
        height: size?.height ?? folder.rect!.height,
      },
    };
  });

  return { scenes, content };
}
