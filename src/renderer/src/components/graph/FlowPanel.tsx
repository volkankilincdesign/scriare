import { useMemo, useRef, useState } from "react";
import { ReactFlow, Background, Controls, MiniMap } from "@xyflow/react";
import type {
  Node,
  Edge,
  NodeMouseHandler,
  OnNodeDrag,
  ReactFlowInstance,
  NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useProjectStore } from "../../state/projectStore";
import { extractChoices } from "../../utils/choiceBlocks";
import { SceneNode } from "./SceneNode";
import { FrameNode } from "./FrameNode";

interface FlowPanelProps {
  collapsed: boolean;
  onToggle: () => void;
  /** Expanded height in pixels — the editor/graph splitter controls this. */
  height?: number;
}

const nodeTypes: NodeTypes = {
  scene: SceneNode,
  frame: FrameNode,
};

interface FrameDragOffset {
  frameId: string;
  origin: { x: number; y: number };
  dx: number;
  dy: number;
}

export function FlowPanel({ collapsed, onToggle, height = 224 }: FlowPanelProps) {
  const project = useProjectStore((s) => s.project);
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
  const selectScene = useProjectStore((s) => s.selectScene);
  const updateScenePosition = useProjectStore((s) => s.updateScenePosition);
  const updateFramePosition = useProjectStore((s) => s.updateFramePosition);
  const autoLayoutScenes = useProjectStore((s) => s.autoLayoutScenes);
  const addFrame = useProjectStore((s) => s.addFrame);

  const flowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const [frameDrag, setFrameDrag] = useState<FrameDragOffset | null>(null);

  const { nodes, edges } = useMemo(() => {
    if (!project) return { nodes: [] as Node[], edges: [] as Edge[] };

    const frameNodes: Node[] = project.frames.map((frame) => {
      const isDragging = frameDrag?.frameId === frame.id;
      const position = isDragging
        ? { x: frame.position.x + frameDrag.dx, y: frame.position.y + frameDrag.dy }
        : frame.position;

      return {
        id: frame.id,
        type: "frame",
        position,
        style: { width: frame.size.width, height: frame.size.height, zIndex: 0 },
        data: { title: frame.title },
        zIndex: 0,
      };
    });

    const sceneNodes: Node[] = project.scenes.map((scene) => {
      const inDraggingFrame = scene.frameId && frameDrag?.frameId === scene.frameId;
      const position = inDraggingFrame
        ? { x: scene.position.x + frameDrag.dx, y: scene.position.y + frameDrag.dy }
        : scene.position;

      return {
        id: scene.id,
        type: "scene",
        position,
        data: {
          label: scene.title || "Untitled scene",
          choiceCount: extractChoices(scene.content).length,
          isActive: scene.id === selectedSceneId,
          isStart: scene.id === project.startSceneId,
        },
        zIndex: 1,
      };
    });

    const flowEdges: Edge[] = project.scenes.flatMap((scene) =>
      extractChoices(scene.content)
        .filter((choice) => choice.targetSceneId)
        .map((choice) => ({
          id: `${scene.id}-${choice.id}`,
          source: scene.id,
          target: choice.targetSceneId as string,
          type: "smoothstep",
          label: choice.text || undefined,
          style: { stroke: "var(--border-faint)", strokeWidth: 1.6 },
          labelStyle: { fill: "var(--text-2)", fontSize: 11 },
          labelBgStyle: { fill: "var(--surface)" },
        })),
    );

    return { nodes: [...frameNodes, ...sceneNodes], edges: flowEdges };
  }, [project, selectedSceneId, frameDrag]);

  const handleNodeClick: NodeMouseHandler = (_event, node) => {
    if (node.type === "scene") selectScene(node.id);
  };

  const handleNodeDragStart: OnNodeDrag = (_event, node) => {
    if (node.type !== "frame") return;
    setFrameDrag({ frameId: node.id, origin: { ...node.position }, dx: 0, dy: 0 });
  };

  const handleNodeDrag: OnNodeDrag = (_event, node) => {
    if (node.type !== "frame") return;
    setFrameDrag((prev) => {
      if (!prev || prev.frameId !== node.id) return prev;
      return {
        ...prev,
        dx: node.position.x - prev.origin.x,
        dy: node.position.y - prev.origin.y,
      };
    });
  };

  const handleNodeDragStop: OnNodeDrag = (_event, node) => {
    if (node.type === "frame") {
      updateFramePosition(node.id, node.position);
      setFrameDrag(null);
    } else if (node.type === "scene") {
      updateScenePosition(node.id, node.position);
    }
  };

  function handleAutoLayout(): void {
    autoLayoutScenes();
    window.requestAnimationFrame(() => {
      flowInstanceRef.current?.fitView({ duration: 400, padding: 0.2 });
    });
  }

  return (
    <div
      style={{ height: collapsed ? 36 : height }}
      className="flex shrink-0 flex-col overflow-hidden border-t border-[var(--border-soft)] bg-[var(--surface)]"
    >
      <div className="flex items-center justify-between px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-3)] hover:text-[var(--text)]"
        >
          <span>{collapsed ? "▸" : "▾"}</span>
          Flow
        </button>

        {!collapsed && project && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => addFrame()}
              className="rounded px-2 py-1 text-xs font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
              title="Add a frame to visually group scenes"
            >
              + Frame
            </button>
            <button
              type="button"
              onClick={handleAutoLayout}
              className="rounded px-2 py-1 text-xs font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
              title="Automatically arrange scenes that aren't in a frame"
            >
              Auto Layout
            </button>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="scriare-graph-bg relative flex-1">
          {!project || project.scenes.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-[var(--text-3)]">
              Scenes will appear here as you write.
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onInit={(instance) => {
                flowInstanceRef.current = instance;
              }}
              onNodeClick={handleNodeClick}
              onNodeDragStart={handleNodeDragStart}
              onNodeDrag={handleNodeDrag}
              onNodeDragStop={handleNodeDragStop}
              nodesDraggable
              nodesConnectable={false}
              edgesFocusable={false}
              edgesReconnectable={false}
              deleteKeyCode={null}
              minZoom={0.15}
              maxZoom={1.5}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Background color="var(--border-soft)" gap={18} />
              <MiniMap
                pannable
                zoomable
                maskColor="var(--overlay)"
                style={{ background: "var(--surface)" }}
                nodeColor={(node) => (node.type === "frame" ? "var(--surface-3)" : "var(--accent)")}
                nodeStrokeColor={() => "var(--surface)"}
                position="bottom-left"
              />
              <Controls
                showInteractive={false}
                orientation="horizontal"
                position="bottom-right"
              />
            </ReactFlow>
          )}
        </div>
      )}
    </div>
  );
}
