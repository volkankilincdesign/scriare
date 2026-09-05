import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { SCENE_NODE_HEIGHT, SCENE_NODE_WIDTH } from "../../utils/graphConstants";
import { StartBadge } from "../common/StartBadge";

interface SceneNodeData {
  label: string;
  choiceCount: number;
  isActive: boolean;
  isStart: boolean;
  [key: string]: unknown;
}

// Invisible connection points so edges have somewhere to attach. A custom
// node type renders none of these automatically (unlike React Flow's
// built-in default node, which has exactly this target-top/source-bottom
// pair) — without them, edges silently fail to draw at all even though the
// edges array itself is correct. Deliberately just one handle of each type
// (no id needed) so plain edges — which don't specify a handle id — resolve
// unambiguously; giving a node several handles of the same type requires
// every edge to name one explicitly, which would be a bigger change than
// this fix calls for.
//
// Left/Right (not Top/Bottom) because Auto Layout arranges scenes in a
// left-to-right flow (dagre's `rankdir: "LR"`, see autoLayout.ts) — handles
// on the horizontal sides let edges travel straight along that flow instead
// of looping vertically out of and back into each box, which is what caused
// edges to bend awkwardly and cross each other after Auto Layout ran.
const HANDLE_STYLE = { opacity: 0, pointerEvents: "none" as const };

export function SceneNode({ data }: NodeProps) {
  const { label, choiceCount, isActive, isStart } = data as SceneNodeData;

  return (
    <div
      style={{ width: SCENE_NODE_WIDTH, height: SCENE_NODE_HEIGHT }}
      className={`flex flex-col justify-center rounded-lg border px-3 py-2 ${
        isActive
          ? "border-emerald-500 bg-zinc-800"
          : "border-zinc-700 bg-zinc-900 hover:border-zinc-600"
      }`}
    >
      <Handle type="target" position={Position.Left} style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Right} style={HANDLE_STYLE} />

      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-100">{label}</div>
        {isStart && <StartBadge compact />}
      </div>
      <div className="mt-0.5 text-[10px] text-zinc-500">
        {choiceCount === 0
          ? "No choices"
          : `${choiceCount} choice${choiceCount === 1 ? "" : "s"}`}
      </div>
    </div>
  );
}
