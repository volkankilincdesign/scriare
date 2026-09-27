import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../common/Button";
import type { DragEvent, MouseEvent } from "react";
import { useProjectStore } from "../../state/projectStore";
import { useUIStore } from "../../state/uiStore";
import { useToastStore } from "../../state/toastStore";
import { useSelectionStore } from "../../state/selectionStore";
import { aDialogIsOpen, ownsEditingKeys } from "../../utils/keyboardFocus";
import type { ContentNode, Scene } from "../../types/project";
import { ancestorsOf, childrenOf, computeDropPosition, flattenVisible } from "../../utils/contentTree";
import { ContentBrowserContext, useContentBrowser } from "./contentBrowserContext";
import type { ContentBrowserContextValue, DropTarget } from "./contentBrowserContext";
import { ContentTreeRow } from "./ContentTreeRow";
import { rowActivation } from "../../utils/clickableRow";
import { FindResults } from "./FindResults";
import { ContentContextMenu } from "./ContentContextMenu";
import type { ContentMenuItem } from "./ContentContextMenu";
import { MoveToDialog } from "./MoveToDialog";
import { Icon } from "../common/Icon";
import type { IconName } from "../common/Icon";
import { ENTITY_LABEL } from "../../types/entities";
import { fold } from "../../utils/textFold";
import type { EntityKind } from "../../types/entities";
import { DockGlyph, DockToggle } from "../common/DockToggle";

/**
 * One category's entities, flat. Entities can't be foldered yet — a story
 * with enough characters to need chapters of characters is a problem worth
 * having first, and the tree machinery (drag, multi-select, context menus)
 * is built around scenes.
 */
function EntityList({ kind }: { kind: EntityKind }) {
  const entities = useProjectStore((s) => s.project?.entities) ?? [];
  const nodes = useProjectStore((s) => s.project?.content) ?? [];
  const selectedEntityId = useProjectStore((s) => s.selectedEntityId);
  const selectEntity = useProjectStore((s) => s.selectEntity);
  const createEntity = useProjectStore((s) => s.createEntity);
  // v0.39.0 — the browser's own rename and context-menu machinery, which
  // an entity row never reached before. Characters and Locations were
  // built on the same ContentNode leaf every scene uses, and then given a
  // row that only knew how to be clicked: no menu, so no Delete, and no
  // rename except by opening the page. The store had `deleteEntity` the
  // whole time; nothing in the interface called it.
  const browser = useContentBrowser();
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
      {mine.map((entity) => {
        const leaf = nodes.find((node) => node.id === entity.id) ?? null;
        const renaming = browser.renamingId === entity.id;
        return (
          <div
            key={entity.id}
            data-entity-row={entity.id}
            {...rowActivation(() => {
              browser.clearSelection();
              selectEntity(entity.id);
            })}
            onClick={() => {
              browser.clearSelection();
              selectEntity(entity.id);
            }}
            onDoubleClick={() => browser.startRename(entity.id, entity.name)}
            onContextMenu={(e) => {
              browser.clearSelection();
              selectEntity(entity.id);
              browser.openContextMenu(e, leaf);
            }}
            className={`ml-3 flex cursor-default items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
              entity.id === selectedEntityId
                ? "scriare-row-on bg-[var(--surface-2)] text-[var(--text)]"
                : "text-[var(--text-2)] hover:bg-[var(--bg)] hover:text-[var(--text)]"
            }`}
          >
            <Icon name={kind === "character" ? "character" : "location"} />
            {renaming ? (
              <input
                autoFocus
                data-entity-rename={entity.id}
                value={browser.renameDraft}
                onChange={(e) => browser.changeRenameDraft(e.target.value)}
                onBlur={browser.commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") browser.commitRename();
                  if (e.key === "Escape") browser.cancelRename();
                  e.stopPropagation();
                }}
                className="min-w-0 flex-1 rounded border border-[var(--accent)] bg-[var(--bg)] px-1 text-sm text-[var(--text)] outline-none"
              />
            ) : (
              <span className="min-w-0 flex-1 truncate">
                {entity.name || `Untitled ${ENTITY_LABEL[kind].toLowerCase()}`}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

const EXPANDED_STORAGE_KEY = "scriare:contentExpanded";
const STORY_ROOT = "root:story";

/**
 * v0.35.0 — Characters and Locations are real now (see types/entities.ts).
 * A category that quietly does nothing is worse than one that says so.
 *
 * v0.59.0 — ASSETS IS CUT. It was a section for a feature that will not be
 * built, and a stranger opening a tree finds it and tries it: the north
 * star counts that as a defect rather than a gap. Notes stays, because it
 * is work that has not been written yet rather than work that will never
 * be, and it now says what it is for instead of "Coming soon." — which
 * tells a writer when it arrives and nothing about whether they want it.
 */
const ENTITY_CATEGORIES: { kind: EntityKind; key: string; icon: IconName; label: string }[] = [
  { kind: "character", key: "root:characters", icon: "character", label: "Characters" },
  { kind: "location", key: "root:locations", icon: "location", label: "Locations" },
];

const PLACEHOLDER_CATEGORIES: {
  key: string;
  icon: IconName;
  label: string;
  /** What it will hold, in the writer's terms. */
  promise: string;
}[] = [
  {
    key: "root:notes",
    icon: "note",
    label: "Notes",
    promise: "Nothing here yet. Notes are for what the story needs and the reader never sees.",
  },
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
  const renameEntity = useProjectStore((s) => s.renameEntity);
  const deleteEntity = useProjectStore((s) => s.deleteEntity);
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
  /**
   * The + New menu (v0.59.0). Its position rather than a boolean, because
   * it is the SAME component the right-click menu uses — a menu is a menu,
   * and a second one drawn from scratch here would be the kind of
   * near-copy v0.56.0 spent a version removing.
   */
  const [newMenu, setNewMenu] = useState<{ x: number; y: number } | null>(null);
  const newButton = useRef<HTMLButtonElement>(null);
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
      // Three kinds of thing share one rename box. An entity is checked by
      // its own list rather than by the leaf's refType, because the entity
      // is what actually holds the name — and renaming one reaches every
      // sentence she appears in, since no sentence ever stored it.
      if (project!.entities.some((e) => e.id === renamingId)) {
        renameEntity(renamingId, renameDraft.trim());
      } else if (node?.kind === "folder") {
        renameFolder(renamingId, renameDraft.trim());
      } else {
        renameScene(renamingId, renameDraft.trim());
      }
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

  /**
   * F2 renames what the Content Browser has selected (v0.39.0).
   *
   * The keyboard rule is the one Ctrl+Z established and Ctrl+C/V follow:
   * if focus is in a text field or the editor, the key belongs to that
   * field; anywhere else it's about the project. `ownsEditingKeys` is the
   * same check all three use, so F2 while writing a sentence does nothing,
   * which is what a writer expects of it.
   *
   * WHICH thing gets renamed follows from how the panel already works: one
   * selected scene or group, or the entity whose row is highlighted.
   * Anything else — nothing selected, or several — has no single answer, so
   * it does nothing rather than guessing.
   */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      // A dialog owns the keyboard while it is up — see
      // utils/keyboardFocus.ts's aDialogIsOpen.
      if (aDialogIsOpen()) return;
      if (ownsEditingKeys(event.target)) return;
      if (useSelectionStore.getState().surface !== "content") return;
      const current = useProjectStore.getState();
      if (!current.project || current.isPlaying) return;

      if (event.key === "F2") {
        // The tree's selection first, then the entity row — the two are
        // kept mutually exclusive (see clearSelection), so at most one of
        // them answers.
        const id = selectedIds.size === 1 ? [...selectedIds][0] : current.selectedEntityId;
        if (!id) return;
        const entity = current.project.entities.find((e) => e.id === id);
        const node = current.project.content.find((n) => n.id === id);
        if (!entity && !node) return;
        event.preventDefault();
        if (entity) startRename(entity.id, entity.name);
        else if (node!.kind === "folder") startRename(id, node!.name);
        else startRename(id, current.project.scenes.find((sc) => sc.id === id)?.title ?? "");
        return;
      }

      // Delete on a selected Character or Location. The app-wide clipboard
      // handler deletes the tree's selection and an entity is never in it,
      // so this is the one path that reaches them — and it raises the same
      // undo toast, because no way of deleting something should be quieter
      // than another.
      if (event.key === "Delete" && selectedIds.size === 0) {
        const entity = current.project.entities.find((e) => e.id === current.selectedEntityId);
        if (!entity) return;
        event.preventDefault();
        const shown = entity.name || `Untitled ${ENTITY_LABEL[entity.kind].toLowerCase()}`;
        deleteEntity(entity.id);
        showUndo(`Deleted "${shown}"`);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedIds, startRename, deleteEntity, showUndo]);

  // --- context menu ---

  /**
   * Opened under its own button rather than at the pointer, so it hangs
   * off the control that summoned it the way a menu should.
   */
  function openNewMenu(): void {
    const box = newButton.current?.getBoundingClientRect();
    if (!box) return;
    setNewMenu({ x: box.left, y: box.bottom + 4 });
  }

  /**
   * Everything a writer can make, in the order they will make it. A scene
   * first because that is what a story is; a group second because it is
   * what a story becomes; then the two kinds of entity, which the tree
   * used to offer through a "+" that appeared on their own rows.
   */
  function newMenuItems(): ContentMenuItem[] {
    return [
      { label: "New Scene", onSelect: () => createScene(null) },
      { label: "New Group", onSelect: () => createFolder(null) },
      {
        label: "New Character",
        onSelect: () => {
          if (!expanded.has("root:characters")) toggleExpand("root:characters");
          createEntity("character");
        },
      },
      {
        label: "New Location",
        onSelect: () => {
          if (!expanded.has("root:locations")) toggleExpand("root:locations");
          createEntity("location");
        },
      },
    ];
  }

  function openContextMenu(e: MouseEvent, node: ContentNode | null): void {
    e.preventDefault();
    e.stopPropagation();
    // An entity leaf is deliberately not pulled into the tree's selection:
    // it can't be dragged, foldered or bulk-anything, and putting it there
    // makes the panel hold two selections at once.
    const isEntity = node ? project!.entities.some((e) => e.id === node.id) : false;
    if (node && !isEntity && !selectedIds.has(node.id)) {
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

    // v0.39.0 — a Character or Location leaf. Checked BEFORE the bulk
    // branch: an entity is never part of the tree's multi-selection (it
    // isn't in the Story category and can't be dragged or foldered), so
    // falling through would offer it Move and Duplicate, neither of which
    // it has.
    const entity = project!.entities.find((e) => e.id === node.id);
    if (entity) {
      const shown = entity.name || `Untitled ${ENTITY_LABEL[entity.kind].toLowerCase()}`;
      return [
        { label: "Rename", onSelect: () => startRename(entity.id, entity.name) },
        {
          label: `Delete ${ENTITY_LABEL[entity.kind]}`,
          danger: true,
          onSelect: () => {
            deleteEntity(entity.id);
            // The same toast a deleted scene raises. Mentions of her are
            // deliberately left in the prose — they render as the words
            // that were written — so the undo here restores the page and
            // the link, not the sentences.
            showUndo(`Deleted "${shown}"`);
          },
        },
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
    clearSelection: () => {
      setSelectedIds(new Set());
      setSelectionAnchor(null);
    },
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
        className="flex w-8 shrink-0 flex-col items-center gap-2 border-r border-[var(--border-soft)] bg-[var(--surface)] pt-2.5 text-[var(--text-3)] hover:text-[var(--text)]"
        title="Expand Content"
      >
        <DockGlyph direction="right" />
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
        className="scriare-panel-l flex w-64 shrink-0 flex-col border-r border-[var(--border-soft)] bg-[var(--surface)]"
      >
        <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-3 py-2">
          <span className="scriare-section-label text-[var(--text-3)]">Content</span>
          {/* ONE PLACE TO MAKE A NEW THING (v0.59.0). It was two: "+ Scene"
              and "+ Group" here, and a "+" that appeared on the Characters
              and Locations rows — so where the button was depended on what
              you were making, and the header grew a button per content type
              as the app gained them. The dock toggle keeps its own air: it
              is a different kind of act, not the third item in a row of
              three (v0.45.0, reported). */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              ref={newButton}
              data-new-content
              aria-haspopup="menu"
              aria-expanded={newMenu !== null}
              onClick={openNewMenu}
              className="rounded border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
              title="New scene, group, character or location"
            >
              + New ▾
            </button>
            <DockToggle direction="left" onClick={onToggle} title="Collapse Content" />
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
              <div className="scriare-section-label px-2 py-1 text-[var(--text-3)]">
                Favorites
              </div>
              {favoriteScenes.map((scene) => (
                <button
                  key={scene.id}
                  type="button"
                  onClick={() => openFavorite(scene.id)}
                  className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm ${
                    scene.id === selectedSceneId
                      ? "scriare-row-on bg-[var(--surface-2)] text-[var(--text)]"
                      : "text-[var(--text-2)] hover:bg-[var(--bg)] hover:text-[var(--text)]"
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
              <div className="scriare-section-label px-2 py-1 text-[var(--text-3)]">
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
                {...rowActivation(() => toggleExpand(STORY_ROOT))}
                aria-expanded={expanded.has(STORY_ROOT)}
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
                        <Button
                          intent="primary"
                          size="sm"
                          onClick={() => createScene(null)}
                        >
                          Create Scene
                        </Button>
                        <Button
                          intent="secondary"
                          size="sm"
                          onClick={() => createFolder(null)}
                        >
                          Create Group
                        </Button>
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
                  data-category={cat.key}
                  {...rowActivation(() => toggleExpand(cat.key))}
                  aria-expanded={expanded.has(cat.key)}
                  onClick={() => toggleExpand(cat.key)}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2-faint)]"
                >
                  <span className="w-3 text-[10px] text-[var(--text-3)]">
                    {expanded.has(cat.key) ? "▾" : "▸"}
                  </span>
                  <Icon name={cat.icon} />
                  <span className="flex-1">{cat.label}</span>
                </div>
                {expanded.has(cat.key) && <EntityList kind={cat.kind} />}
              </div>
            ))}

          {!searchQuery &&
            PLACEHOLDER_CATEGORIES.map((cat) => (
              <div key={cat.key} className="mb-1">
                <div
                  {...rowActivation(() => toggleExpand(cat.key))}
                  aria-expanded={expanded.has(cat.key)}
                  onClick={() => toggleExpand(cat.key)}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-[var(--text-3)] transition-colors hover:bg-[var(--surface-2-faint)]"
                >
                  <span className="w-3 text-[10px] text-[var(--text-3)]">{expanded.has(cat.key) ? "▾" : "▸"}</span>
                  <Icon name={cat.icon} />
                  <span>{cat.label}</span>
                </div>
                {expanded.has(cat.key) && (
                  <div className="px-3 py-2 text-xs leading-relaxed text-[var(--text-3)]">
                    {cat.promise}
                  </div>
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

      {newMenu && (
        <ContentContextMenu
          x={newMenu.x}
          y={newMenu.y}
          items={newMenuItems()}
          onClose={() => setNewMenu(null)}
        />
      )}

      {moveDialogNodeIds && (
        <MoveToDialog nodeIds={moveDialogNodeIds} onClose={() => setMoveDialogNodeIds(null)} />
      )}
    </ContentBrowserContext.Provider>
  );
}
