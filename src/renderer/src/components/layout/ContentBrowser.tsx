import { useEffect, useMemo, useState } from "react";
import type { DragEvent, MouseEvent } from "react";
import { useProjectStore } from "../../state/projectStore";
import { confirmDialog } from "../../state/confirmDialogStore";
import type { ContentNode, Scene } from "../../types/project";
import { ancestorsOf, childrenOf, computeDropPosition, flattenVisible } from "../../utils/contentTree";
import { ContentBrowserContext } from "./contentBrowserContext";
import type { ContentBrowserContextValue, DropTarget } from "./contentBrowserContext";
import { ContentTreeRow } from "./ContentTreeRow";
import { ContentContextMenu } from "./ContentContextMenu";
import type { ContentMenuItem } from "./ContentContextMenu";
import { MoveToDialog } from "./MoveToDialog";

const EXPANDED_STORAGE_KEY = "scriare:contentExpanded";
const STORY_ROOT = "root:story";

const PLACEHOLDER_CATEGORIES = [
  { key: "root:characters", icon: "👤", label: "Characters" },
  { key: "root:locations", icon: "🌍", label: "Locations" },
  { key: "root:notes", icon: "📝", label: "Notes" },
  { key: "root:assets", icon: "🖼", label: "Assets" },
];

function loadExpanded(): Set<string> {
  try {
    const raw = window.localStorage.getItem(EXPANDED_STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {
    // fall through to default
  }
  return new Set([STORY_ROOT]);
}

interface ContextMenuState {
  x: number;
  y: number;
  node: ContentNode | null;
}

export function ContentBrowser() {
  const project = useProjectStore((s) => s.project);
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
  const selectScene = useProjectStore((s) => s.selectScene);
  const createScene = useProjectStore((s) => s.createScene);
  const renameScene = useProjectStore((s) => s.renameScene);
  const deleteScene = useProjectStore((s) => s.deleteScene);
  const duplicateScene = useProjectStore((s) => s.duplicateScene);
  const duplicateScenes = useProjectStore((s) => s.duplicateScenes);
  const createFolder = useProjectStore((s) => s.createFolder);
  const renameFolder = useProjectStore((s) => s.renameFolder);
  const deleteFolder = useProjectStore((s) => s.deleteFolder);
  const moveContentNodes = useProjectStore((s) => s.moveContentNodes);
  const deleteContentNodes = useProjectStore((s) => s.deleteContentNodes);
  const toggleFavorite = useProjectStore((s) => s.toggleFavorite);
  const setFavorites = useProjectStore((s) => s.setFavorites);
  const setStartScene = useProjectStore((s) => s.setStartScene);

  const [expanded, setExpanded] = useState<Set<string>>(loadExpanded);
  const [search, setSearch] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [draggingIds, setDraggingIds] = useState<Set<string>>(new Set());
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionAnchor, setSelectionAnchor] = useState<string | null>(null);
  const [moveDialogNodeIds, setMoveDialogNodeIds] = useState<string[] | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify([...expanded]));
    } catch {
      // Best-effort persistence only.
    }
  }, [expanded]);

  const scenesById = useMemo(() => {
    const map = new Map<string, Scene>();
    project?.scenes.forEach((s) => map.set(s.id, s));
    return map;
  }, [project]);

  const favoriteSceneIds = useMemo(
    () => new Set((project?.favorites ?? []).filter((f) => f.refType === "scene").map((f) => f.refId)),
    [project],
  );

  const favoriteScenes = useMemo(
    () =>
      (project?.favorites ?? [])
        .filter((f) => f.refType === "scene")
        .map((f) => scenesById.get(f.refId))
        .filter((s): s is Scene => Boolean(s)),
    [project, scenesById],
  );

  if (!project) return null;

  function toggleExpand(id: string): void {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function revealNode(nodeId: string): void {
    const ancestors = ancestorsOf(project!.content, nodeId);
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(STORY_ROOT);
      ancestors.forEach((id) => next.add(id));
      const node = project!.content.find((n) => n.id === nodeId);
      if (node?.kind === "folder") next.add(node.id);
      return next;
    });
  }

  function jumpToSearchResult(node: ContentNode): void {
    revealNode(node.id);
    if (node.kind === "leaf") selectScene(node.id);
    setSelectedIds(new Set([node.id]));
    setSelectionAnchor(node.id);
    setSearch("");
  }

  function openFavorite(sceneId: string): void {
    revealNode(sceneId);
    selectScene(sceneId);
    setSelectedIds(new Set([sceneId]));
    setSelectionAnchor(sceneId);
  }

  // --- selection ---
  function handleItemClick(e: MouseEvent, node: ContentNode): void {
    if (e.shiftKey && selectionAnchor) {
      const visible = flattenVisible(project!.content, "story", null, expanded);
      const anchorIndex = visible.findIndex((n) => n.id === selectionAnchor);
      const clickedIndex = visible.findIndex((n) => n.id === node.id);
      if (anchorIndex === -1 || clickedIndex === -1) {
        setSelectedIds(new Set([node.id]));
        setSelectionAnchor(node.id);
        return;
      }
      const [start, end] =
        anchorIndex <= clickedIndex ? [anchorIndex, clickedIndex] : [clickedIndex, anchorIndex];
      setSelectedIds(new Set(visible.slice(start, end + 1).map((n) => n.id)));
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(node.id)) next.delete(node.id);
        else next.add(node.id);
        return next;
      });
      setSelectionAnchor(node.id);
      return;
    }

    setSelectedIds(new Set([node.id]));
    setSelectionAnchor(node.id);
    if (node.kind === "folder") toggleExpand(node.id);
    else selectScene(node.id);
  }

  // --- renaming ---
  function startRename(id: string, currentName: string): void {
    setRenamingId(id);
    setRenameDraft(currentName);
  }
  function commitRename(): void {
    if (renamingId && renameDraft.trim()) {
      const node = project!.content.find((n) => n.id === renamingId);
      if (node?.kind === "folder") renameFolder(renamingId, renameDraft.trim());
      else renameScene(renamingId, renameDraft.trim());
    }
    setRenamingId(null);
  }
  function cancelRename(): void {
    setRenamingId(null);
  }

  // --- drag & drop ---
  function handleDragStartNode(e: DragEvent, id: string): void {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    if (selectedIds.has(id) && selectedIds.size > 1) {
      setDraggingIds(new Set(selectedIds));
    } else {
      setDraggingIds(new Set([id]));
      setSelectedIds(new Set([id]));
      setSelectionAnchor(id);
    }
  }
  function handleDragOverNode(e: DragEvent, node: ContentNode): void {
    if (draggingIds.size === 0 || draggingIds.has(node.id)) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const position = computeDropPosition(e.clientY, rect, node.kind === "folder");
    setDropTarget({ id: node.id, position });
  }
  function handleDropNode(e: DragEvent, node: ContentNode): void {
    if (draggingIds.size === 0 || draggingIds.has(node.id)) return cleanupDrag();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const position = computeDropPosition(e.clientY, rect, node.kind === "folder");
    const idsToMove = [...draggingIds];

    if (position === "inside" && node.kind === "folder") {
      const destSiblings = childrenOf(project!.content, node.category, node.id).filter(
        (n) => !draggingIds.has(n.id),
      );
      moveContentNodes(idsToMove, node.id, destSiblings.length);
    } else {
      const siblings = childrenOf(project!.content, node.category, node.parentId).filter(
        (n) => !draggingIds.has(n.id),
      );
      const targetIndex = siblings.findIndex((n) => n.id === node.id);
      const insertIndex = position === "before" ? targetIndex : targetIndex + 1;
      moveContentNodes(idsToMove, node.parentId, insertIndex);
    }
    cleanupDrag();
  }
  function handleDropOnStoryRoot(e: DragEvent): void {
    e.preventDefault();
    if (draggingIds.size === 0) return cleanupDrag();
    const rootSiblings = childrenOf(project!.content, "story", null).filter((n) => !draggingIds.has(n.id));
    moveContentNodes([...draggingIds], null, rootSiblings.length);
    cleanupDrag();
  }
  function cleanupDrag(): void {
    setDraggingIds(new Set());
    setDropTarget(null);
  }

  // --- context menu ---
  function openContextMenu(e: MouseEvent, node: ContentNode | null): void {
    e.preventDefault();
    e.stopPropagation();
    if (node && !selectedIds.has(node.id)) {
      setSelectedIds(new Set([node.id]));
      setSelectionAnchor(node.id);
    } else if (!node) {
      setSelectedIds(new Set());
    }
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  }

  function buildMenuItems(node: ContentNode | null): ContentMenuItem[] {
    if (node === null) {
      return [
        { label: "New Scene", onSelect: () => createScene(null) },
        { label: "New Folder", onSelect: () => createFolder(null) },
      ];
    }

    // Bulk actions when the right-clicked item is part of a multi-selection.
    if (selectedIds.has(node.id) && selectedIds.size > 1) {
      const ids = [...selectedIds];
      const sceneIds = ids.filter((id) => project!.content.find((n) => n.id === id)?.kind === "leaf");
      const allFavorited = sceneIds.length > 0 && sceneIds.every((id) => favoriteSceneIds.has(id));
      const items: ContentMenuItem[] = [
        { label: `Move ${ids.length} items...`, onSelect: () => setMoveDialogNodeIds(ids) },
      ];
      if (sceneIds.length > 0) {
        items.push({
          label: sceneIds.length === 1 ? "Duplicate Scene" : `Duplicate ${sceneIds.length} Scenes`,
          onSelect: () => duplicateScenes(sceneIds),
        });
        items.push({
          label: allFavorited ? "Unfavorite" : "Favorite",
          onSelect: () => setFavorites("scene", sceneIds, !allFavorited),
        });
      }
      items.push({
        label: `Delete ${ids.length} items`,
        danger: true,
        onSelect: async () => {
          const confirmed = await confirmDialog({
            title: `Delete ${ids.length} items?`,
            message:
              "Folders in the selection will be removed and their contents moved up one level. Scenes will be deleted permanently.",
            confirmLabel: "Delete",
            danger: true,
          });
          if (confirmed) deleteContentNodes(ids);
        },
      });
      return items;
    }

    if (node.kind === "folder") {
      return [
        { label: "New Scene", onSelect: () => createScene(node.id) },
        { label: "New Folder", onSelect: () => createFolder(node.id) },
        { label: "Rename", onSelect: () => startRename(node.id, node.name) },
        {
          label: "Delete",
          danger: true,
          onSelect: async () => {
            const confirmed = await confirmDialog({
              title: "Delete folder?",
              message: `Delete folder "${node.name}"? Its contents move up one level — nothing inside it is deleted.`,
              confirmLabel: "Delete",
              danger: true,
            });
            if (confirmed) deleteFolder(node.id);
          },
        },
      ];
    }

    const scene = scenesById.get(node.id);
    const isFav = favoriteSceneIds.has(node.id);
    const isStartScene = project!.startSceneId === node.id;
    const items: ContentMenuItem[] = [
      { label: "Rename", onSelect: () => startRename(node.id, scene?.title ?? "") },
      { label: "Duplicate Scene", onSelect: () => duplicateScene(node.id) },
      { label: isFav ? "Unfavorite" : "Favorite", onSelect: () => toggleFavorite("scene", node.id) },
    ];
    // Assigning a new Start Scene always replaces the previous one (there's
    // only ever one, per projectStore.setStartScene), so there's nothing
    // useful to do from here once a scene already is the Start Scene — that
    // case is only offered from the Inspector's toggle, which can also clear it.
    if (!isStartScene) {
      items.push({ label: "Set as Start Scene", onSelect: () => setStartScene(node.id) });
    }
    if (project!.scenes.length > 1) {
      items.push({
        label: "Delete",
        danger: true,
        onSelect: async () => {
          const confirmed = await confirmDialog({
            title: "Delete scene?",
            message: `Delete "${scene?.title || "this scene"}"? This can't be undone.`,
            confirmLabel: "Delete",
            danger: true,
          });
          if (confirmed) deleteScene(node.id);
        },
      });
    }
    return items;
  }

  const searchQuery = search.trim().toLowerCase();
  const searchResults = searchQuery
    ? project.content
        .filter((n) => n.category === "story")
        .filter((n) => {
          const name = n.kind === "folder" ? n.name : scenesById.get(n.id)?.title ?? "";
          return name.toLowerCase().includes(searchQuery);
        })
    : [];

  const storyChildren = childrenOf(project.content, "story", null);
  const hasAnyScenes = project.scenes.length > 0;

  const contextValue: ContentBrowserContextValue = {
    nodes: project.content,
    scenesById,
    selectedSceneId,
    startSceneId: project.startSceneId,
    favoriteSceneIds,
    expanded,
    toggleExpand,
    selectedIds,
    onItemClick: handleItemClick,
    renamingId,
    renameDraft,
    startRename,
    changeRenameDraft: setRenameDraft,
    commitRename,
    cancelRename,
    openContextMenu,
    draggingIds,
    dropTarget,
    onDragStartNode: handleDragStartNode,
    onDragOverNode: handleDragOverNode,
    onDropNode: handleDropNode,
    onDragEnd: cleanupDrag,
  };

  return (
    <ContentBrowserContext.Provider value={contextValue}>
      <aside className="flex w-64 shrink-0 flex-col border-r border-[var(--border-soft)] bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Content</span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => createScene(null)}
              className="rounded px-1.5 text-xs text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
              title="New scene (Story root)"
            >
              + Scene
            </button>
            <button
              type="button"
              onClick={() => createFolder(null)}
              className="rounded px-1.5 text-xs text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
              title="New folder (Story root)"
            >
              + Folder
            </button>
          </div>
        </div>

        <div className="border-b border-[var(--border-soft)] px-2 py-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Story..."
            className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--bg)] px-2 py-1 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-3)] focus:border-[var(--accent)]"
          />
        </div>

        <nav className="flex-1 overflow-y-auto p-1.5">
          {favoriteScenes.length > 0 && (
            <div className="mb-2">
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
                Favorites
              </div>
              {favoriteScenes.map((scene) => (
                <button
                  key={scene.id}
                  type="button"
                  onClick={() => openFavorite(scene.id)}
                  className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm ${
                    scene.id === selectedSceneId ? "bg-[var(--surface-2)] text-[var(--text)]" : "text-[var(--text-2)] hover:bg-[var(--bg)] hover:text-[var(--text)]"
                  }`}
                >
                  <span className="text-xs text-[var(--accent)]">★</span>
                  <span className="min-w-0 flex-1 truncate">{scene.title || "Untitled scene"}</span>
                </button>
              ))}
            </div>
          )}

          {searchQuery ? (
            <div>
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
                Search results
              </div>
              {searchResults.length === 0 ? (
                <div className="px-2 py-2 text-sm text-[var(--text-3)]">No matches in Story.</div>
              ) : (
                searchResults.map((node) => {
                  const name = node.kind === "folder" ? node.name : scenesById.get(node.id)?.title ?? "Untitled scene";
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => jumpToSearchResult(node)}
                      className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm text-[var(--text-2)] hover:bg-[var(--bg)] hover:text-[var(--text)]"
                    >
                      <span className="text-xs">{node.kind === "folder" ? "📁" : "📄"}</span>
                      <span className="min-w-0 flex-1 truncate">{name}</span>
                    </button>
                  );
                })
              )}
            </div>
          ) : (
            <div className="mb-1">
              <div
                onClick={() => toggleExpand(STORY_ROOT)}
                onContextMenu={(e) => openContextMenu(e, null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDropOnStoryRoot}
                className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-[var(--text-2)] hover:bg-[var(--bg)]"
              >
                <span className="w-3 text-[10px] text-[var(--text-3)]">{expanded.has(STORY_ROOT) ? "▾" : "▸"}</span>
                <span>📖</span>
                <span>Story</span>
              </div>

              {expanded.has(STORY_ROOT) && (
                <div>
                  {!hasAnyScenes ? (
                    <div className="px-3 py-4 text-center">
                      <p className="mb-3 text-sm text-[var(--text-3)]">No story yet.</p>
                      <div className="flex flex-col gap-1.5">
                        <button
                          type="button"
                          onClick={() => createScene(null)}
                          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--accent-text-on)] hover:bg-[var(--accent-hover)]"
                        >
                          Create Scene
                        </button>
                        <button
                          type="button"
                          onClick={() => createFolder(null)}
                          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)]"
                        >
                          Create Folder
                        </button>
                      </div>
                    </div>
                  ) : (
                    storyChildren.map((node) => <ContentTreeRow key={node.id} node={node} depth={1} />)
                  )}
                </div>
              )}
            </div>
          )}

          {!searchQuery &&
            PLACEHOLDER_CATEGORIES.map((cat) => (
              <div key={cat.key} className="mb-1">
                <div
                  onClick={() => toggleExpand(cat.key)}
                  className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-[var(--text-3)] hover:bg-[var(--bg)]"
                >
                  <span className="w-3 text-[10px] text-[var(--text-3)]">{expanded.has(cat.key) ? "▾" : "▸"}</span>
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </div>
                {expanded.has(cat.key) && (
                  <div className="px-3 py-2 text-xs text-[var(--text-3)]">Coming soon.</div>
                )}
              </div>
            ))}
        </nav>
      </aside>

      {contextMenu && (
        <ContentContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={buildMenuItems(contextMenu.node)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {moveDialogNodeIds && (
        <MoveToDialog nodeIds={moveDialogNodeIds} onClose={() => setMoveDialogNodeIds(null)} />
      )}
    </ContentBrowserContext.Provider>
  );
}
