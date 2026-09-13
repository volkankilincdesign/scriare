import { Handle, NodeResizer, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { useProjectStore } from "../../state/projectStore";
import { useToastStore } from "../../state/toastStore";
import { FOLDER_MIN_HEIGHT, FOLDER_MIN_WIDTH } from "../../utils/graphConstants";
import type { FolderRect } from "../../types/project";

interface GroupNodeData {
  name: string;
  collapsed: boolean;
  /** How many scenes are inside, at any depth — the only thing a folded group can say about itself. */
  sceneCount: number;
  // Threaded down from FlowPanel's `nodes` memo rather than read from the
  // store here (unlike the rename/delete/fold actions below) — see the
  // `data.onResize`/`data.onResizeEnd` comment in FlowPanel.tsx for why the
  // live resize overlay these drive has to live there, not in this file.
  onResize?: (rect: FolderRect) => void;
  onResizeEnd?: (rect: FolderRect) => void;
  [key: string]: unknown;
}

/**
 * A Story folder drawn on the graph (v0.28.0, formerly FrameNode).
 *
 * The box and the folder are now the same object: renaming here renames the
 * folder in the Content Browser, deleting here ungroups exactly as deleting
 * the folder there does, and dragging a scene inside genuinely moves it into
 * this folder. There is no separate "frame" left to disagree with the tree.
 */

/**
 * Invisible connection points, for the same reason SceneNode carries them:
 * a custom node type renders none automatically, and an edge pointing at a
 * node with no handles silently fails to draw (the v0.2.1 bug, found the
 * hard way). A folded group is an edge endpoint — every connection into the
 * chapter now lands on the box — so it needs these as much as a scene does.
 * Left/Right to match SceneNode's, so a bundle leaves a group the same way
 * a choice leaves a scene.
 */
const HANDLE_STYLE = { opacity: 0, pointerEvents: "none" as const };

export function GroupNode({ id, data, selected }: NodeProps) {
  const { name, collapsed, sceneCount, onResize, onResizeEnd } = data as GroupNodeData;
  const renameFolder = useProjectStore((s) => s.renameFolder);
  const deleteFolder = useProjectStore((s) => s.deleteFolder);
  const toggleFolderCollapsed = useProjectStore((s) => s.toggleFolderCollapsed);

  function handleDelete(): void {
    deleteFolder(id);
    useToastStore
      .getState()
      .showUndo(`Deleted "${name || "Untitled group"}" — its contents moved up one level`);
  }

  const label = name || "Untitled group";

  if (collapsed) {
    // A folded group is a destination, not a container: no resize handles
    // (there is nothing inside to make room for) and the whole block is the
    // click target that unfolds it, since that is the only thing anyone
    // wants from it.
    return (
      <div
        onDoubleClick={() => toggleFolderCollapsed(id)}
        className={`flex h-full w-full cursor-pointer flex-col justify-center rounded-lg border bg-[var(--surface-2)] px-4 transition-colors duration-150 ${
          selected
            ? "border-[var(--accent)]"
            : "border-[var(--border-faint)] hover:border-[var(--accent-ring)]"
        }`}
        title="Double-click to unfold"
      >
        <Handle type="target" position={Position.Left} style={HANDLE_STYLE} />
        <Handle type="source" position={Position.Right} style={HANDLE_STYLE} />
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => toggleFolderCollapsed(id)}
            className="shrink-0 cursor-pointer rounded px-0.5 text-[10px] text-[var(--text-3)] hover:text-[var(--text)]"
            title="Unfold group"
          >
            ▸
          </button>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text)]">
            {label}
          </span>
        </div>
        <div className="mt-0.5 pl-4 text-[10px] text-[var(--text-3)]">
          {sceneCount} scene{sceneCount === 1 ? "" : "s"} · folded
        </div>
      </div>
    );
  }

  return (
    // `scriare-frame-box` is a stable hook for the CSS-only drop-target
    // highlight: FlowPanel toggles a sibling `scriare-drop-target` class on
    // this node's own `.react-flow__node` wrapper directly via the DOM while
    // a scene is dragged over it (see FlowPanel's `setGroupHighlight` for why
    // that's imperative DOM work rather than React state). The class name is
    // kept from the Frame era on purpose — the CSS it hooks is unchanged, and
    // renaming it would mean touching a stylesheet for no behavioural reason.
    <div
      className={`scriare-frame-box h-full w-full rounded-lg border-2 border-dashed bg-[var(--surface-2-faint)] transition-colors duration-150 ${
        selected
          ? "border-[var(--accent)]"
          : "border-[var(--border)] hover:border-[var(--border-faint)]"
      }`}
    >
      <Handle type="target" position={Position.Left} style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Right} style={HANDLE_STYLE} />
      <NodeResizer
        minWidth={FOLDER_MIN_WIDTH}
        minHeight={FOLDER_MIN_HEIGHT}
        isVisible={selected}
        lineClassName="!border-[var(--accent)]"
        handleClassName="!h-2.5 !w-2.5 !rounded-sm !border-[var(--accent)] !bg-[var(--bg)]"
        // `onResize` fires on every drag tick (live) — feeding it up to
        // FlowPanel's `groupResize` overlay is what makes the box track the
        // cursor continuously instead of settling into place only on release.
        // `onResizeEnd` is the actual commit to the project.
        onResize={(_event, params) => {
          onResize?.({ x: params.x, y: params.y, width: params.width, height: params.height });
        }}
        onResizeEnd={(_event, params) => {
          onResizeEnd?.({ x: params.x, y: params.y, width: params.width, height: params.height });
        }}
      />
      <div className="flex items-center gap-1 rounded-t-md bg-[var(--surface-translucent)] px-2 py-1">
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => toggleFolderCollapsed(id)}
          className="shrink-0 cursor-pointer rounded px-0.5 text-[10px] text-[var(--text-3)] hover:text-[var(--text)]"
          title="Fold group"
        >
          ▾
        </button>
        <input
          value={name}
          onChange={(e) => renameFolder(id, e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
          placeholder="Group name"
          className="min-w-0 flex-1 cursor-text bg-transparent text-xs font-semibold uppercase tracking-wide text-[var(--text-2)] outline-none placeholder:text-[var(--text-3)]"
        />
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleDelete}
          className="shrink-0 cursor-pointer rounded px-1 text-xs text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"
          title="Delete group (its contents move up one level)"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
