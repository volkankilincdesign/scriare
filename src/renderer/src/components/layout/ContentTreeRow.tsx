import type { MouseEvent as ReactMouseEvent } from "react";
import type { ContentNode } from "../../types/project";
import { childrenOf } from "../../utils/contentTree";
import { useContentBrowser } from "./contentBrowserContext";
import { StartBadge } from "../common/StartBadge";
import { Icon } from "../common/Icon";

interface ContentTreeRowProps {
  node: ContentNode;
  depth: number;
}

export function ContentTreeRow({ node, depth }: ContentTreeRowProps) {
  const {
    nodes,
    scenesById,
    selectedSceneId,
    startSceneId,
    favoriteSceneIds,
    expanded,
    toggleExpand,
    selectedIds,
    onItemClick,
    renamingId,
    renameDraft,
    startRename,
    changeRenameDraft,
    commitRename,
    cancelRename,
    openContextMenu,
    draggingIds,
    dropTarget,
    onDragStartNode,
    onDragOverNode,
    onDropNode,
    onDragEnd,
  } = useContentBrowser();

  const isFolder = node.kind === "folder";
  const isExpanded = expanded.has(node.id);
  const isRenaming = renamingId === node.id;
  const scene = node.kind === "leaf" ? scenesById.get(node.id) : undefined;
  const isActiveScene = node.kind === "leaf" && node.id === selectedSceneId;
  const isStartScene = node.kind === "leaf" && node.id === startSceneId;
  const isSelected = selectedIds.has(node.id);
  const isFavorite = node.kind === "leaf" && favoriteSceneIds.has(node.id);
  const isDragging = draggingIds.has(node.id);
  const dropHere = dropTarget?.id === node.id ? dropTarget.position : null;

  const displayName = isFolder ? node.name : scene?.title || "Untitled scene";
  const children = isFolder ? childrenOf(nodes, node.category, node.id) : [];

  let rowStyle = "hover:bg-[var(--bg)]";
  if (isActiveScene) rowStyle = "bg-[var(--surface-2)]";
  else if (isSelected) rowStyle = "bg-[var(--accent-soft-2)] ring-1 ring-inset ring-[var(--accent-ring)]";

  return (
    <div>
      <div
        draggable
        onDragStart={(e) => onDragStartNode(e, node.id)}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDragOverNode(e, node);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDropNode(e, node);
        }}
        onDragEnd={onDragEnd}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          openContextMenu(e, node);
        }}
        style={{ paddingLeft: 8 + depth * 16 }}
        className={`group relative flex select-none items-center gap-1 rounded-md pr-1.5 ${rowStyle} ${
          isDragging ? "opacity-40" : ""
        }`}
      >
        {dropHere === "before" && (
          <div className="pointer-events-none absolute inset-x-1 top-0 h-0.5 bg-[var(--accent)]" />
        )}
        {dropHere === "after" && (
          <div className="pointer-events-none absolute inset-x-1 bottom-0 h-0.5 bg-[var(--accent)]" />
        )}
        {dropHere === "inside" && (
          <div className="pointer-events-none absolute inset-0.5 rounded-md border border-[var(--accent)]" />
        )}

        {isFolder ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => toggleExpand(node.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleExpand(node.id);
              }
            }}
            className="w-4 shrink-0 cursor-pointer text-center text-[10px] text-[var(--text-3)] hover:text-[var(--text-2)] focus:outline-none"
          >
            {isExpanded ? "▾" : "▸"}
          </div>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        <Icon name={isFolder ? "folder" : "scene"} className="h-3.5 w-3.5 text-[var(--text-3)]" />

        {isRenaming ? (
          <input
            autoFocus
            value={renameDraft}
            onChange={(e) => changeRenameDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") cancelRename();
            }}
            className="min-w-0 flex-1 bg-transparent px-1 py-1.5 text-sm text-[var(--text)] outline-none"
          />
        ) : (
          // A plain div (not a <button>) on purpose: this row is the primary
          // drag handle (the outer row's `draggable` + onDragStart live one
          // level up), and a native <button> nested inside a draggable
          // ancestor can swallow the mousedown Chromium needs to recognize a
          // drag gesture, especially once anything on it calls
          // preventDefault() in a mousedown handler (which a <button> here
          // used to do, to suppress a stray focus/selection highlight — see
          // the architecture doc's "Known pitfalls"). `select-none` on the
          // row plus `focus:outline-none` here already suppress that
          // highlight without touching mousedown, so dragging works again.
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => onItemClick(e, node)}
            onDoubleClick={() => startRename(node.id, displayName)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onItemClick(e as unknown as ReactMouseEvent, node);
              }
            }}
            title="Double-click to rename"
            className={`min-w-0 flex-1 cursor-default truncate px-1 py-1.5 text-left text-sm focus:outline-none ${
              isActiveScene || isSelected ? "text-[var(--text)]" : "text-[var(--text-2)] group-hover:text-[var(--text)]"
            }`}
          >
            {displayName}
          </div>
        )}

        {!isFolder && isStartScene && <StartBadge />}
        {!isFolder && isFavorite && <span className="shrink-0 text-xs text-[var(--accent)]">★</span>}

        <button
          type="button"
          onClick={(e) => openContextMenu(e, node)}
          className="hidden shrink-0 rounded px-1 text-xs text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] group-hover:block focus:outline-none"
          title="More actions"
        >
          ⋯
        </button>
      </div>

      {isFolder && isExpanded && (
        <div>
          {children.length === 0 ? (
            <div style={{ paddingLeft: 8 + (depth + 1) * 16 }} className="py-1 text-xs text-[var(--text-3)]">
              Empty folder
            </div>
          ) : (
            children.map((child) => <ContentTreeRow key={child.id} node={child} depth={depth + 1} />)
          )}
        </div>
      )}
    </div>
  );
}
