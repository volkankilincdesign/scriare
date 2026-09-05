import type { MouseEvent as ReactMouseEvent } from "react";
import type { ContentNode } from "../../types/project";
import { childrenOf } from "../../utils/contentTree";
import { useContentBrowser } from "./contentBrowserContext";
import { StartBadge } from "../common/StartBadge";

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

  let rowStyle = "hover:bg-zinc-900";
  if (isActiveScene) rowStyle = "bg-zinc-800";
  else if (isSelected) rowStyle = "bg-emerald-950/40 ring-1 ring-inset ring-emerald-700/50";

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
          <div className="pointer-events-none absolute inset-x-1 top-0 h-0.5 bg-emerald-500" />
        )}
        {dropHere === "after" && (
          <div className="pointer-events-none absolute inset-x-1 bottom-0 h-0.5 bg-emerald-500" />
        )}
        {dropHere === "inside" && (
          <div className="pointer-events-none absolute inset-0.5 rounded-md border border-emerald-500" />
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
            className="w-4 shrink-0 cursor-pointer text-center text-[10px] text-zinc-500 hover:text-zinc-300 focus:outline-none"
          >
            {isExpanded ? "▾" : "▸"}
          </div>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        <span className="shrink-0 text-xs">{isFolder ? "📁" : "📄"}</span>

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
            className="min-w-0 flex-1 bg-transparent px-1 py-1.5 text-sm text-zinc-100 outline-none"
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
              isActiveScene || isSelected ? "text-zinc-100" : "text-zinc-400 group-hover:text-zinc-200"
            }`}
          >
            {displayName}
          </div>
        )}

        {!isFolder && isStartScene && <StartBadge />}
        {!isFolder && isFavorite && <span className="shrink-0 text-xs text-amber-400">★</span>}

        <button
          type="button"
          onClick={(e) => openContextMenu(e, node)}
          className="hidden shrink-0 rounded px-1 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 group-hover:block focus:outline-none"
          title="More actions"
        >
          ⋯
        </button>
      </div>

      {isFolder && isExpanded && (
        <div>
          {children.length === 0 ? (
            <div style={{ paddingLeft: 8 + (depth + 1) * 16 }} className="py-1 text-xs text-zinc-600">
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
