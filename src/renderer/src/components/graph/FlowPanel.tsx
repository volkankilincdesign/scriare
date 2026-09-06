import { useMemo, useRef, useState } from "react";
import { ReactFlow, Background, Controls, MiniMap } from "@xyflow/react";
import type {
  Node,
  Edge,
  NodeMouseHandler,
  NodeChange,
  OnNodeDrag,
  OnNodesChange,
  ReactFlowInstance,
  NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useProjectStore } from "../../state/projectStore";
import { extractChoices } from "../../utils/choiceBlocks";
import { findContainingFrame } from "../../utils/graphConstants";
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

interface SceneDragOffset {
  sceneId: string;
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hoverFrameIdRef = useRef<string | null>(null);
  const [frameDrag, setFrameDrag] = useState<FrameDragOffset | null>(null);
  const [sceneDrag, setSceneDrag] = useState<SceneDragOffset | null>(null);

  // Root cause of the "drag freezes/goes blank after ~1s" bug (confirmed via
  // React Flow's own console warning, error015 — "trying to drag a node that
  // is not initialized... use onNodesChange"): this app never wired up
  // `onNodesChange`, and every node object handed to <ReactFlow nodes={...}>
  // is a brand-new object literal on every drag-frame recompute (see the
  // `nodes` memo below). @xyflow/system's `adoptUserNodes` only carries a
  // node's already-measured `measured: {width, height}` forward when the
  // incoming node is *reference-identical* to the one it already has
  // internally; any other object — which every one of our nodes is, every
  // single pointer-move during a drag — makes it rebuild that node's
  // internal record with `measured: {width: undefined, height: undefined}`.
  // That flips `hasDimensions` to false, which hides the node (visibility:
  // hidden) and re-triggers its ResizeObserver un/re-observe cycle. Under
  // load that measure/reset race can lose outright, leaving the node stuck
  // unmeasured (and therefore invisible/frozen-looking) until something else
  // forces a full remeasure — matching "reopening the document fixes it."
  //
  // The fix: capture React Flow's own `dimensions` change events (fired once
  // a node's real DOM size is known) into a ref-keyed cache, and feed that
  // cached size back in as each node's `measured` field so it survives being
  // rebuilt as a fresh object every drag frame.
  const measuredSizeRef = useRef<Map<string, { width: number; height: number }>>(new Map());

  // Bumped whenever a node's measured size actually changes. `measuredSizeRef`
  // is a ref, so writing into it doesn't by itself trigger a re-render — and
  // (the bug in the first cut of this fix, v0.10.5) a re-render alone isn't
  // even enough: the `nodes` useMemo below only recomputes when something in
  // *its own* dependency array changes, so bumping unrelated state caused a
  // re-render that just handed back the same stale, memoized `nodes` array.
  // `measuredVersion` has to be listed as one of that memo's dependencies
  // (see below) for a change here to actually reach the array React Flow —
  // and the MiniMap, which colours/sizes nodes from that array, not from
  // React Flow's own internal store — receives. Without both halves of this
  // wired together, a freshly mounted graph (first launch, or reopening the
  // Flow panel after it was collapsed, which unmounts <ReactFlow> and wipes
  // this whole ref) shows every node correctly in the main canvas (which
  // measures independently, straight off the DOM) but leaves the MiniMap
  // stuck showing unmeasured, colourless boxes until some unrelated drag
  // happens to touch `frameDrag`/`sceneDrag` and force a recompute.
  const [measuredVersion, setMeasuredVersion] = useState(0);

  const handleNodesChange: OnNodesChange = (changes: NodeChange[]) => {
    let changed = false;
    for (const change of changes) {
      if (change.type === "dimensions" && change.dimensions) {
        const prev = measuredSizeRef.current.get(change.id);
        if (!prev || prev.width !== change.dimensions.width || prev.height !== change.dimensions.height) {
          measuredSizeRef.current.set(change.id, change.dimensions);
          changed = true;
        }
      }
    }
    if (changed) setMeasuredVersion((v) => v + 1);
  };

  /**
   * Toggles a CSS class directly on the hovered Frame's DOM node while a
   * scene is being dragged over it — deliberately NOT React state. An
   * earlier version of this drop-target highlight lived in `nodes` data,
   * which meant every frame-boundary crossing produced a new `nodes` array
   * reference for the whole graph. React Flow only keeps tracking a node's
   * live drag position when the incoming node object is reference-equal to
   * the one it already has internally (see @xyflow/system's
   * `adoptUserNodes`) — any other node object resets that node's rendered
   * position from its `position` field, which is exactly our (stale, not
   * yet committed) store value during a drag. The result was the dragged
   * scene snapping back to its start position and never visibly moving
   * again. Going straight to the DOM for this purely cosmetic highlight
   * sidesteps the controlled-`nodes` reconciliation entirely, so a scene
   * drag never touches the `nodes` array until it's actually released.
   */
  function setFrameHighlight(frameId: string | null): void {
    if (hoverFrameIdRef.current === frameId) return;
    const container = containerRef.current;
    if (container) {
      if (hoverFrameIdRef.current) {
        container
          .querySelector(`.react-flow__node[data-id="${hoverFrameIdRef.current}"]`)
          ?.classList.remove("scriare-drop-target");
      }
      if (frameId) {
        container
          .querySelector(`.react-flow__node[data-id="${frameId}"]`)
          ?.classList.add("scriare-drop-target");
      }
    }
    hoverFrameIdRef.current = frameId;
  }

  // Choice data (choice count per scene, and the edges themselves) only
  // ever changes when a scene's *content* changes — dragging never touches
  // it. Keeping it in its own memo, keyed on `project` alone, means the
  // (potentially expensive, since it walks every scene's full Tiptap
  // document) `extractChoices()` call runs once per actual content edit —
  // not on every pointer-move of a drag. Before v0.10.2, scene dragging
  // never touched this memo at all, so this cost never showed up there;
  // frame dragging always recomputed it every frame, which nobody noticed
  // because frame drags are rarer/shorter. Once scene dragging *also*
  // started updating `nodes` every frame (the live-cursor-tracking fix),
  // recomputing every scene's choices via extractChoices() on every single
  // mousemove was enough to visibly stall the graph on any real-sized
  // project — this split is what keeps Sprint 8A's "must not reduce graph
  // performance" requirement true now that scenes drag exactly like frames.
  const choiceCountByScene = useMemo(() => {
    if (!project) return new Map<string, number>();
    return new Map(project.scenes.map((scene) => [scene.id, extractChoices(scene.content).length]));
  }, [project]);

  const edges = useMemo<Edge[]>(() => {
    if (!project) return [];
    return project.scenes.flatMap((scene) =>
      extractChoices(scene.content)
        .filter((choice) => choice.targetSceneId)
        .map((choice) => ({
          id: `${scene.id}-${choice.id}`,
          source: scene.id,
          target: choice.targetSceneId as string,
          type: "smoothstep",
          pathOptions: { borderRadius: 8 },
          label: choice.text || undefined,
          style: { stroke: "var(--border-faint)", strokeWidth: 1.6 },
          labelStyle: { fill: "var(--text-2)", fontSize: 11 },
          labelBgStyle: { fill: "var(--surface)" },
        })),
    );
  }, [project]);

  // Positions (and the two data fields that come along for free —
  // choiceCount looked up from the memo above, not recomputed) DO need to
  // update every pointer-move during a drag, so this memo depends on
  // `frameDrag`/`sceneDrag` — but everything inside it is now cheap
  // arithmetic, no document parsing.
  const nodes = useMemo<Node[]>(() => {
    if (!project) return [];

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
        // Carries the node's last-known real DOM size across drag-frame
        // recomputes — see the `measuredSizeRef` comment above.
        measured: measuredSizeRef.current.get(frame.id),
      };
    });

    const sceneNodes: Node[] = project.scenes.map((scene) => {
      const inDraggingFrame = scene.frameId && frameDrag?.frameId === scene.frameId;
      const isDraggingThis = sceneDrag?.sceneId === scene.id;
      const position = inDraggingFrame
        ? { x: scene.position.x + frameDrag.dx, y: scene.position.y + frameDrag.dy }
        : isDraggingThis
          ? { x: scene.position.x + sceneDrag.dx, y: scene.position.y + sceneDrag.dy }
          : scene.position;

      return {
        id: scene.id,
        type: "scene",
        position,
        data: {
          label: scene.title || "Untitled scene",
          choiceCount: choiceCountByScene.get(scene.id) ?? 0,
          isActive: scene.id === selectedSceneId,
          isStart: scene.id === project.startSceneId,
        },
        zIndex: 1,
        measured: measuredSizeRef.current.get(scene.id),
      };
    });

    return [...frameNodes, ...sceneNodes];
    // `measuredVersion` isn't read inside this computation — it's listed here
    // purely so a change to it (see its own comment above) forces this memo
    // to recompute and re-read `measuredSizeRef.current`, which the
    // computation above does use.
  }, [project, selectedSceneId, frameDrag, sceneDrag, choiceCountByScene, measuredVersion]);

  const handleNodeClick: NodeMouseHandler = (_event, node) => {
    if (node.type === "scene") selectScene(node.id);
  };

  const handleNodeDragStart: OnNodeDrag = (_event, node) => {
    if (node.type === "frame") {
      setFrameDrag({ frameId: node.id, origin: { ...node.position }, dx: 0, dy: 0 });
    } else if (node.type === "scene" && project) {
      // Mirrors the frame branch above exactly: an unconditional setState on
      // every drag frame is what makes the node visually track the cursor at
      // all. React Flow's own internal drag tracking only repaints a node
      // when something calls `onNodesChange` (never wired up in this app) or
      // when the *store* itself is told to update — neither happens on its
      // own here, so without this, `internals.positionAbsolute` is computed
      // once at drag-start and then never touched again until drop, which is
      // exactly the "sits in place while you drag" symptom. Feeding a live
      // dx/dy into the scene's fed-in `position` (below, in the nodes memo)
      // forces a real re-render every pointer-move, and — critically — the
      // position we feed in always equals where the cursor already put the
      // node, so `adoptUserNodes` has nothing stale to reset it to.
      setSceneDrag({ sceneId: node.id, origin: { ...node.position }, dx: 0, dy: 0 });
      setFrameHighlight(findContainingFrame(project.frames, node.position)?.id ?? null);
    }
  };

  const handleNodeDrag: OnNodeDrag = (_event, node) => {
    if (node.type === "frame") {
      setFrameDrag((prev) => {
        if (!prev || prev.frameId !== node.id) return prev;
        return {
          ...prev,
          dx: node.position.x - prev.origin.x,
          dy: node.position.y - prev.origin.y,
        };
      });
    } else if (node.type === "scene" && project) {
      setSceneDrag((prev) => {
        if (!prev || prev.sceneId !== node.id) return prev;
        return {
          ...prev,
          dx: node.position.x - prev.origin.x,
          dy: node.position.y - prev.origin.y,
        };
      });
      setFrameHighlight(findContainingFrame(project.frames, node.position)?.id ?? null);
    }
  };

  const handleNodeDragStop: OnNodeDrag = (_event, node) => {
    if (node.type === "frame") {
      updateFramePosition(node.id, node.position);
      setFrameDrag(null);
    } else if (node.type === "scene") {
      updateScenePosition(node.id, node.position);
      setSceneDrag(null);
      setFrameHighlight(null);
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
        <div ref={containerRef} className="scriare-graph-bg relative flex-1">
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
              onNodesChange={handleNodesChange}
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
              fitViewOptions={{ padding: 0.2, duration: 300 }}
              selectionOnDrag={false}
              nodeDragThreshold={2}
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
