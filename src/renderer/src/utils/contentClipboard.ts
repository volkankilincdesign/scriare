import type { ContentNode, Project, Scene } from "../types/project";

/**
 * The app's clipboard for story structure (v0.27.0).
 *
 * Deliberately an in-app clipboard rather than the operating system's.
 * The OS clipboard would buy copy-and-paste between two Scriare windows,
 * which nobody has asked for, at the cost of reading and writing
 * serialised story data through a channel any other application can also
 * read and write — and of a paste path that has to defend itself against
 * whatever arbitrary text happens to be on the clipboard. An in-app
 * clipboard is synchronous, needs no permissions, and can't be handed
 * anything it didn't produce itself.
 *
 * It holds a SNAPSHOT, not references. Copy three scenes, delete them,
 * paste: the scenes come back, because the payload owns its own copy of
 * their data rather than pointing at rows that no longer exist.
 */
export interface ContentClipboard {
  /**
   * The copied nodes, including every descendant of a copied folder.
   * `parentId` still uses ORIGINAL ids; a node whose parent isn't in this
   * array is a root of the copied set and gets re-parented on paste.
   */
  nodes: ContentNode[];
  /** Full scene records for every leaf in `nodes`. */
  scenes: Scene[];
}

/**
 * Collects `ids` — plus everything inside any folder among them — into a
 * self-contained payload.
 *
 * Descendants come along whether or not they were selected: a folder in
 * this app is the thing that contains its children, so copying one and
 * getting an empty folder would be a surprise every time. A child that was
 * *also* selected explicitly is included once, not twice.
 */
export function buildClipboard(project: Project, ids: string[]): ContentClipboard | null {
  const selected = new Set(ids);
  if (selected.size === 0) return null;

  const included = new Set<string>();
  const byParent = new Map<string | null, ContentNode[]>();
  for (const node of project.content) {
    const siblings = byParent.get(node.parentId) ?? [];
    siblings.push(node);
    byParent.set(node.parentId, siblings);
  }

  function include(node: ContentNode): void {
    if (included.has(node.id)) return;
    included.add(node.id);
    if (node.kind === "folder") {
      for (const child of byParent.get(node.id) ?? []) include(child);
    }
  }

  for (const node of project.content) {
    if (selected.has(node.id)) include(node);
  }
  if (included.size === 0) return null;

  // Keep the project's own ordering so a paste reproduces the arrangement
  // rather than whatever order the user happened to click things in.
  const nodes = project.content.filter((n) => included.has(n.id)).map((n) => ({ ...n }));
  const leafIds = new Set(nodes.filter((n) => n.kind === "leaf").map((n) => n.id));
  const scenes = project.scenes.filter((s) => leafIds.has(s.id)).map((s) => ({ ...s }));

  return { nodes, scenes };
}

/** How many scenes and folders a payload holds — for the paste toast. */
export function describeClipboard(clipboard: ContentClipboard): string {
  const folders = clipboard.nodes.filter((n) => n.kind === "folder").length;
  const scenes = clipboard.scenes.length;
  const parts: string[] = [];
  if (scenes > 0) parts.push(`${scenes} scene${scenes === 1 ? "" : "s"}`);
  if (folders > 0) parts.push(`${folders} folder${folders === 1 ? "" : "s"}`);
  return parts.join(" and ") || "nothing";
}
