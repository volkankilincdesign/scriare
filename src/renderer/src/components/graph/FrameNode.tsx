import { NodeResizer } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { useProjectStore } from "../../state/projectStore";
import { confirmDialog } from "../../state/confirmDialogStore";
import { FRAME_MIN_HEIGHT, FRAME_MIN_WIDTH } from "../../utils/graphConstants";

interface FrameNodeData {
  title: string;
  [key: string]: unknown;
}

export function FrameNode({ id, data, selected }: NodeProps) {
  const { title } = data as FrameNodeData;
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
    <div className="h-full w-full rounded-lg border-2 border-dashed border-zinc-700 bg-zinc-800/20">
      <NodeResizer
        minWidth={FRAME_MIN_WIDTH}
        minHeight={FRAME_MIN_HEIGHT}
        isVisible={selected}
        lineClassName="!border-emerald-500"
        handleClassName="!h-2.5 !w-2.5 !rounded-sm !border-emerald-500 !bg-zinc-900"
        onResizeEnd={(_event, params) => {
          updateFrameRect(id, {
            x: params.x,
            y: params.y,
            width: params.width,
            height: params.height,
          });
        }}
      />
      <div className="flex items-center gap-1.5 rounded-t-md bg-zinc-900/80 px-2 py-1">
        <input
          value={title}
          onChange={(e) => renameFrame(id, e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
          placeholder="Frame title"
          className="min-w-0 flex-1 bg-transparent text-xs font-semibold uppercase tracking-wide text-zinc-300 outline-none placeholder:text-zinc-600"
        />
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleDelete}
          className="shrink-0 rounded px-1 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
          title="Delete frame"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
