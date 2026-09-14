import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, MouseEvent } from "react";
import { useProjectStore } from "../../state/projectStore";
import { useUIStore } from "../../state/uiStore";
import { useToastStore } from "../../state/toastStore";
import { useSelectionStore } from "../../state/selectionStore";
import type { ContentNode, Scene } from "../../types/project";
import { ancestorsOf, childrenOf, computeDropPosition, flattenVisible } from "../../utils/contentTree";
import { ContentBrowserContext } from "./contentBrowserContext";
import type { ContentBrowserContextValue, DropTarget } from "./contentBrowserContext";
import { ContentTreeRow } from "./ContentTreeRow";
import { FindResults } from "./FindResults";
import { ContentContextMenu } from "./ContentContextMenu";
import type { ContentMenuItem } from "./ContentContextMenu";
import { MoveToDialog } from "./MoveToDialog";
import { Icon } from "../common/Icon";
import type { IconName } from "../common/Icon";
import { ENTITY_LABEL } from "../../types/entities";
import { fold } from "../../utils/textFold";
import type { EntityKind } from "../../types/entities";

/**
 * One category's entities, flat. Entities can't be foldered yet — a story
 * with enough characters to need chapters of characters is a problem worth
 * having first, and the tree machinery (drag, multi-select, context menus)
 * is built around scenes.
 */
function EntityList({ kind }: { kind: EntityKind }) {
  const entities = useProjectStore((s) => s.project?.entities) ?? [];
  const selectedEntityId = useProjectStore((s) => s.selectedEntityId);
  const selectEntity = useProjectStore((s) => s.selectEntity);
  const createEntity = useProjectStore((s) => s.createEntity);
  const mine = entities.filter((e) => e.kind === kind);

  if (mine.length === 0) {
    return (
      <div className="px-3 py-3 text-center">
        <p className="mb-2 text-xs text-[var(--text-3)]">
          No {ENTITY_LABEL[kind].toLowerCase()}s yet.
        </p>
        <button
          type="button"
          onClick={() => createEntity(kind)}
          className="rounded-md border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)]"
        >
          Create {ENTITY_LABEL[kind]}
        </button>
        <p className="mt-2 text-[11px] text-[var(--text-3)]">
          Or type @ while writing a scene.
        </p>
      </div>
    );
  }

  return (
    <div>
      {mine.map((entity) => (
        <div
          key={entity.id}
          data-entity-row={entity.id}
          onClick={() => selectEntity(entity.id)}
          className={`ml-3 flex cursor-default items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
            entity.id === selectedEntityId
              ? "bg-[var(--surface-2)] text-[var(--text)]"
              : "text-[var(--text-2)] hover:bg-[var(--bg)] hover:text-[var(--text)]"
          }`}
        >
          <Icon name={kind === "character" ? "character" : "location"} />
          <span className="min-w-0 flex-1 truncate">
            {entity.name || `Untitled ${ENTITY_LABEL[kind].toLowerCase()}`}
          </span>
        </div>
      ))}
    </div>
  );
}

const EXPANDED_STORAGE_KEY = "scriare:contentExpanded";
const STORY_ROOT = "root:story";

/**
 * v0.35.0 — Characters and Locations are real now (see types/entities.ts).
 * Notes and Assets keep the "Coming soon" treatment until they are, because
 * a category that quietly does nothing is worse than one that says so.
 */
const ENTITY_CATEGORIES: { kind: EntityKind; key: string; icon: IconName; label: string }[] = [
  { kind: "character", key: "root:characters", icon: "character", label: "Characters" },
  { kind: "location", key: "root:locations", icon: "location", label: "Locations" },
];

const PLACEHOLDER_CATEGORIES: { key: string; icon: IconName; label: string }[] = [
  { key: "root:notes", icon: "note", label: "Notes" },
  { key: "root:assets", icon: "asset", label: "Assets" },
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

interface ContentBrowserProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function ContentBrowser({ collapsed, onToggle }: ContentBrowserProps) {
  const project = useProjectStore((s) => s.project);
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
  const selectScene = useProjectStore((s) => s.selectScene);
  const createScene = useProjectStore((s) => s.createScene);
  const createEntity = useProjectStore((s) => s.createEntity);
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
  const showUndo = useToastStore((s) => s.showUndo);
  const claimSurface = useSelectionStore((s) => s.claimSurface);
  const publishSelection = useSelectionStore((s) => s.setContentIds);

  const [expanded, setExpanded] = useState<Set<string>>(loadExpanded);
  const [search, setSearch] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const findToken = useUIStore((s) => s.findToken);

  // Ctrl+F puts the caret in the box and selects what's there, so the
  // second press of it replaces the last search rather than appending to
  // it. A counter rather than a flag, because pressing it twice has to
  // happen twice — see uiStore.
  useEffect(() => {
    if (findToken === 0) return;
    searchInput.current?.focus();
    searchInput.current?.select();
  }, [findToken]);
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

  // Mirror the selection out for the app-wide shortcuts (see
  // state/selectionStore.ts). Published in the project's own node order
  // rather than click order, so a copied or deleted group keeps the
  // arrangement the writer sees. Must sit above the `!project` early
  // return — a hook after a conditional return is a hook that sometimes
  // doesn't run.
  useEffect(() => {
    const ids = (project?.content ?? []).filter((n) => selectedIds.has(n.id)).map((n) => n.id);
    publishSelection(ids);
  }, [project, selectedIds, publishSelection]);

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
    // The query STAYS (v0.38.0). Fixing a name in twelve scenes is twelve
    // clicks down one list; clearing the box after the first would make it
    // twelve searches.
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
        { label: "New Group", onSelect: () => createFolder(null) },
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
        onSelect: () => {
          deleteContentNodes(ids);
          showUndo(`Deleted ${ids.length} items`);
        },
      });
      return items;
    }

    if (node.kind === "folder") {
      return [
        { label: "New Scene", onSelect: () => createScene(node.id) },
        { label: "New Group", onSelect: () => createFolder(node.id) },
        { label: "Rename", onSelect: () => startRename(node.id, node.name) },
        {
          label: "Delete",
          danger: true,
          onSelect: () => {
            deleteFolder(node.id);
            showUndo(`Deleted "${node.name}" — its contents moved up one level`);
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
        onSelect: () => {
          deleteScene(node.id);
          showUndo(`Deleted "${scene?.title || "Untitled scene"}"`);
        },
      });
    }
    return items;
  }

  // Folded rather than lowercased (v0.38.0): this box is now the same box
  // that searches the writing, and a scene called "İstanbul'da Gece" that
  // the prose search finds but the title filter doesn't would look like a
  // bug in whichever half the writer noticed second.
  const searchQuery = search.trim();
  const foldedQuery = fold(searchQuery);
  const searchResults = foldedQuery
    ? project.content
        .filter((n) => n.category === "story")
        .filter((n) => {
          const name = n.kind === "folder" ? n.name : scenesById.get(n.id)?.title ?? "";
          return fold(name).includes(foldedQuery);
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

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="flex w-8 shrink-0 flex-col items-center gap-1.5 border-r border-[var(--border-soft)] bg-[var(--surface)] pt-2 text-[var(--text-3)] hover:text-[var(--text)]"
        title="Expand Content"
      >
        <span aria-hidden className="text-[10px]">▸</span>
        <span className="[writing-mode:vertical-rl] text-xs font-semibold uppercase tracking-wide">
          Content
        </span>
      </button>
    );
  }

  return (
    <ContentBrowserContext.Provider value={contextValue}>
      <aside
        // Touching a panel is what makes it the one the keyboard means —
        // see state/selectionStore.ts. Capture phase, so it still fires when
        // a child stops propagation for its own drag handling.
        onPointerDownCapture={() => claimSurface("content")}
        className="flex w-64 shrink-0 flex-col border-r border-[var(--border-soft)] bg-[var(--surface)]"
      >
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
              title="New group (Story root)"
            >
              + Group
            </button>
            <button
              type="button"
              onClick={onToggle}
              className="rounded px-1.5 text-sm text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
              title="Collapse"
            >
              <span aria-hidden>◂</span>
            </button>
          </div>
        </div>

        <div className="border-b border-[var(--border-soft)] px-2 py-2">
          <input
            ref={searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              // Escape empties the box and returns the tree, rather than
              // leaving the panel showing results for a search the writer
              // has finished with.
              if (e.key === "Escape") {
                e.stopPropagation();
                if (search) setSearch("");
                else (e.target as HTMLInputElement).blur();
              }
            }}
            data-find-input
            placeholder="Search story and writing..."
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
                <div className="px-2 py-2 text-sm text-[var(--text-3)]">No scene by that name.</div>
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
                      <Icon name={node.kind === "folder" ? "folder" : "scene"} className="h-3.5 w-3.5" />
                      <span className="min-w-0 flex-1 truncate">{name}</span>
                    </button>
                  );
                })
              )}
              {/* Which scenes are CALLED this, above; where the words
                  actually appear, below. One box, two questions — see
                  FindResults.tsx. */}
              <FindResults query={searchQuery} />
            </div>
          ) : (
            <div className="mb-1">
              <div
                onClick={() => toggleExpand(STORY_ROOT)}
                onContextMenu={(e) => openContextMenu(e, null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDropOnStoryRoot}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2-faint)]"
              >
                <span className="w-3 text-[10px] text-[var(--text-3)]">{expanded.has(STORY_ROOT) ? "▾" : "▸"}</span>
                <Icon name="story" />
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
                          Create Group
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
            ENTITY_CATEGORIES.map((cat) => (
              <div key={cat.key} className="mb-1">
                <div
                  onClick={() => toggleExpand(cat.key)}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2-faint)]"
                >
                  <span className="w-3 text-[10px] text-[var(--text-3)]">
                    {expanded.has(cat.key) ? "▾" : "▸"}
                  </span>
                  <Icon name={cat.icon} />
                  <span className="flex-1">{cat.label}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!expanded.has(cat.key)) toggleExpand(cat.key);
                      createEntity(cat.kind);
                    }}
                    title={`New ${cat.label.slice(0, -1).toLowerCase()}`}
                    className="rounded px-1.5 text-xs text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                  >
                    +
                  </button>
                </div>
                {expanded.has(cat.key) && <EntityList kind={cat.kind} />}
              </div>
            ))}

          {!searchQuery &&
            PLACEHOLDER_CATEGORIES.map((cat) => (
              <div key={cat.key} className="mb-1">
                <div
                  onClick={() => toggleExpand(cat.key)}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-[var(--text-3)] transition-colors hover:bg-[var(--surface-2-faint)]"
                >
                  <span className="w-3 text-[10px] text-[var(--text-3)]">{expanded.has(cat.key) ? "▾" : "▸"}</span>
                  <Icon name={cat.icon} />
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
