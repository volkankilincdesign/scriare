import { NodeResizer } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { useProjectStore } from "../../state/projectStore";
import { confirmDialog } from "../../state/confirmDialogStore";
import { FRAME_MIN_HEIGHT, FRAME_MIN_WIDTH } from "../../utils/graphConstants";

interface FrameNodeData {
  title: string;
  /** True while a scene being dragged is currently hovering over this frame
   * — highlighted as the frame the scene will join if released now. */
  isDropTarget?: boolean;
  [key: string]: unknown;
}

export function FrameNode({ id, data, selected }: NodeProps) {
  const { title, isDropTarget } = data as FrameNodeData;
  const renameFrame = useProjectStore((s) => s.renameFrame);
  const deleteFrame = useProjectStore((s) => s.deleteFrame);
  const updateFrameRect = useProjectStore((s) => s.updateFrameRect);

  async function handleDelete(): Promise<void> {
    const confirmed = await confirmDialog({
      title: "Delete frame?",
      message: `Delete the "${title || "Untitled"}" frame? Its scenes won't be deleted — they'll just stop being grouped.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (confirmed) deleteFrame(id);
  }

  return (
    <div
      className={`h-full w-full rounded-lg border-2 border-dashed transition-colors duration-150 ${
        isDropTarget
          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
          : "border-[var(--border)] bg-[var(--surface-2-faint)]"
      }`}
    >
      <NodeResizer
        minWidth={FRAME_MIN_WIDTH}
        minHeight={FRAME_MIN_HEIGHT}
        isVisible={selected}
        lineClassName="!border-[var(--accent)]"
        handleClassName="!h-2.5 !w-2.5 !rounded-sm !border-[var(--accent)] !bg-[var(--bg)]"
        onResizeEnd={(_event, params) => {
          updateFrameRect(id, {
            x: params.x,
            y: params.y,
            width: params.width,
            height: params.height,
          });
        }}
      />
      <div className="flex items-center gap-1.5 rounded-t-md bg-[var(--surface-translucent)] px-2 py-1">
        <input
          value={title}
          onChange={(e) => renameFrame(id, e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
          placeholder="Frame title"
          className="min-w-0 flex-1 bg-transparent text-xs font-semibold uppercase tracking-wide text-[var(--text-2)] outline-none placeholder:text-[var(--text-3)]"
        />
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleDelete}
          className="shrink-0 rounded px-1 text-xs text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-red-400"
          title="Delete frame"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
