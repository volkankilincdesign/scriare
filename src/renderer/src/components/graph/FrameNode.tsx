import { NodeResizer } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { useProjectStore } from "../../state/projectStore";
import { useToastStore } from "../../state/toastStore";
import { FRAME_MIN_HEIGHT, FRAME_MIN_WIDTH } from "../../utils/graphConstants";

interface FrameRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FrameNodeData {
  title: string;
  // Threaded down from FlowPanel's `nodes` memo rather than read from the
  // store directly (unlike `renameFrame`/`deleteFrame` below) — see the
  // `data.onResize`/`data.onResizeEnd` comment in FlowPanel.tsx for why the
  // live resize overlay these drive has to live there, not here.
  onResize?: (rect: FrameRect) => void;
  onResizeEnd?: (rect: FrameRect) => void;
  [key: string]: unknown;
}

export function FrameNode({ id, data, selected }: NodeProps) {
  const { title, onResize, onResizeEnd } = data as FrameNodeData;
  const renameFrame = useProjectStore((s) => s.renameFrame);
  const deleteFrame = useProjectStore((s) => s.deleteFrame);

  function handleDelete(): void {
    deleteFrame(id);
    useToastStore
      .getState()
      .showUndo(`Deleted the "${title || "Untitled"}" frame — its scenes are now ungrouped`);
  }

  return (
    // `scriare-frame-box` is a stable hook for the CSS-only drop-target
    // highlight: FlowPanel toggles a sibling `scriare-drop-target` class on
    // this node's own `.react-flow__node` wrapper directly via the DOM
    // while a scene is dragged over it (see FlowPanel's `setFrameHighlight`
    // for why that's imperative DOM manipulation rather than React state).
    // As of Sprint 8A's polish pass, it also carries a hover treatment
    // (mirroring SceneNode's own hover border) and a `selected`-driven
    // accent border — previously a selected frame was distinguishable only
    // by its (small, easy-to-miss) resize handles, unlike a selected scene,
    // which gets a full accent border. Both read from the same `--accent`/
    // `--border-faint` tokens SceneNode already uses, so there's no new
    // visual language introduced, just applied consistently to both node
    // types.
    <div
      className={`scriare-frame-box h-full w-full rounded-lg border-2 border-dashed bg-[var(--surface-2-faint)] transition-colors duration-150 ${
        selected
          ? "border-[var(--accent)]"
          : "border-[var(--border)] hover:border-[var(--border-faint)]"
      }`}
    >
      <NodeResizer
        minWidth={FRAME_MIN_WIDTH}
        minHeight={FRAME_MIN_HEIGHT}
        isVisible={selected}
        lineClassName="!border-[var(--accent)]"
        handleClassName="!h-2.5 !w-2.5 !rounded-sm !border-[var(--accent)] !bg-[var(--bg)]"
        // `onResize` fires on every drag tick (live) — feeding it up to
        // FlowPanel's `frameResize` overlay is what makes the box actually
        // track the cursor continuously instead of only settling into place
        // on release. `onResizeEnd` is the actual commit to the project.
        onResize={(_event, params) => {
          onResize?.({ x: params.x, y: params.y, width: params.width, height: params.height });
        }}
        onResizeEnd={(_event, params) => {
          onResizeEnd?.({ x: params.x, y: params.y, width: params.width, height: params.height });
        }}
      />
      <div className="flex items-center gap-1.5 rounded-t-md bg-[var(--surface-translucent)] px-2 py-1">
        <input
          value={title}
          onChange={(e) => renameFrame(id, e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
          placeholder="Frame title"
          className="min-w-0 flex-1 cursor-text bg-transparent text-xs font-semibold uppercase tracking-wide text-[var(--text-2)] outline-none placeholder:text-[var(--text-3)]"
        />
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleDelete}
          className="shrink-0 cursor-pointer rounded px-1 text-xs text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"
          title="Delete frame"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
