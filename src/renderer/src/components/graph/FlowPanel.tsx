import { useMemo, useRef, useState } from "react";
import { ReactFlow, Background, Controls, MiniMap, SelectionMode } from "@xyflow/react";
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

// Sprint 8B interaction-consistency fix: the graph's two camera-fit
// animations (the initial mount's `fitViewOptions` and Auto Layout's own
// post-layout `fitView` call, below) used two different durations — 300ms
// and 400ms — for what reads as the identical gesture ("the camera glides
// to frame everything"). Nothing about either animation actually needs a
// different pace than the other; the mismatch was just two literals that
// drifted apart because they live in two different call sites. One shared
// constant keeps them identical going forward without relying on anyone
// remembering to update both numbers together.
const CAMERA_FIT_DURATION_MS = 350;

/** Live drag offset for a single node — its position at drag-start plus the
 * current cursor-driven delta. Originally this was one object per drag
 * (`frameId`/`sceneId` + a single `dx`/`dy`), which only ever tracked the
 * one node the pointer grabbed. That silently broke *multi*-selection drags
 * (bug reported right after v0.15.0): React Flow moves every selected node
 * together and reports the whole group as the third argument to
 * `onNodeDrag`/`onNodeDragStop` (`nodes`, not just the single `node` these
 * handlers also receive) — but with a single-id offset, only the grabbed
 * node's position ever got a live offset applied in the `nodes` memo below,
 * so the rest of the selection visually stayed put while the store's
 * eventual commit (also single-id) never touched them either. Generalizing
 * this into a per-id map, keyed by every node actually reported in that
 * `nodes` array, is what makes a multi-node selection move as one group. */
interface DragOffset {
  origin: { x: number; y: number };
  dx: number;
  dy: number;
}

/** A frame's in-progress size/position while `NodeResizer` is being dragged —
 * see the `frameResize` state declaration below for why this exists. */
interface FrameResizeOverlay {
  frameId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function FlowPanel({ collapsed, onToggle, height = 224 }: FlowPanelProps) {
  const project = useProjectStore((s) => s.project);
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
  const selectScene = useProjectStore((s) => s.selectScene);
  const updateScenePosition = useProjectStore((s) => s.updateScenePosition);
  const updateFramePosition = useProjectStore((s) => s.updateFramePosition);
  const updateFrameRect = useProjectStore((s) => s.updateFrameRect);
  const autoLayoutScenes = useProjectStore((s) => s.autoLayoutScenes);
  const addFrame = useProjectStore((s) => s.addFrame);

  const flowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hoverFrameIdRef = useRef<string | null>(null);
  // Map<nodeId, DragOffset> rather than a single offset — see `DragOffset`'s
  // own comment above for why this has to cover every node being dragged
  // together, not just the one the pointer grabbed.
  const [frameDrag, setFrameDrag] = useState<Map<string, DragOffset> | null>(null);
  const [sceneDrag, setSceneDrag] = useState<Map<string, DragOffset> | null>(null);

  // Graph selection (which nodes — scenes *and* frames — currently show a
  // selected/highlighted state) lives in this app-owned Set, fed back into
  // every node object below, for the same reason `measuredSizeRef` and
  // `frameDrag`/`sceneDrag` do: anything React Flow tracks internally that
  // isn't explicitly carried forward through the controlled `nodes` array
  // gets silently reset on the very next unrelated recompute (this app's
  // `nodes` memo rebuilds fresh node objects extremely often — every drag
  // frame, every measured-size update). v0.14.2 first discovered this for a
  // single selected Frame; Sprint 8B's nav-model pass (right-click-to-pan,
  // left-drag-to-box-select, Ctrl+click to add/remove) generalizes the same
  // fix to *every* node and to multi-selection, rather than hand-rolling
  // click/box-select/Ctrl-click logic ourselves: React Flow already
  // implements all of that natively (native click selects just that node,
  // Ctrl+click toggles one node without touching the rest, a drag-select
  // rectangle selects everything it touches, clicking the pane or pressing
  // Escape clears it) and reports every one of those as `select`-type
  // `NodeChange` events through `onNodesChange` — this app just needs to
  // stop dropping them (see `handleNodesChange` below) and apply them here.
  //
  // This is deliberately a *separate* concept from `selectedSceneId`, which
  // now means "the scene open in the Scene Editor," not "the scene last
  // clicked in the graph" — see the Scene Editor focus comment on
  // `handleNodeDoubleClick` below for why single-click and double-click
  // needed to stop meaning the same thing.
  const [selectedGraphIds, setSelectedGraphIds] = useState<Set<string>>(() => new Set());

  // A Frame's in-progress size (and, when resizing from a top/left handle,
  // its in-progress position) while the user is actively dragging one of
  // `NodeResizer`'s handles — fed into the frame's node object below the
  // same way `frameDrag`/`sceneDrag` feed in a live drag position. Without
  // this, resizing looked like it "only updated after releasing the mouse":
  // `NodeResizer` reports every in-progress tick as a `dimensions`-type
  // `NodeChange` (already tracked below for `measuredSizeRef`), so resizing
  // a frame forces this app's `nodes` memo to recompute mid-drag — and
  // without `frameResize`, that recompute kept re-supplying the frame's
  // OLD, not-yet-committed `frame.size` as its `style.width/height`, which
  // is a *different* object each time, so React Flow adopted it as the new
  // "real" size and snapped the box back — only for the very next resize
  // tick to immediately drag it forward again. That fight between the live
  // resize and this app's stale controlled size is what read as jittery/
  // delayed-until-release, not any missing feature in `NodeResizer` itself.
  const [frameResize, setFrameResize] = useState<FrameResizeOverlay | null>(null);

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
    let dimensionsChanged = false;
    let nextSelected: Set<string> | null = null;

    for (const change of changes) {
      if (change.type === "dimensions" && change.dimensions) {
        const prev = measuredSizeRef.current.get(change.id);
        if (!prev || prev.width !== change.dimensions.width || prev.height !== change.dimensions.height) {
          measuredSizeRef.current.set(change.id, change.dimensions);
          dimensionsChanged = true;
        }
      } else if (change.type === "select") {
        // Covers native click-select, Ctrl+click add/remove, the box-select
        // rectangle, pane-click-to-deselect, and Escape — see the
        // `selectedGraphIds` comment above for why this app has to apply
        // these itself instead of letting React Flow track them internally.
        if (!nextSelected) nextSelected = new Set(selectedGraphIds);
        if (change.selected) nextSelected.add(change.id);
        else nextSelected.delete(change.id);
      }
    }

    if (dimensionsChanged) setMeasuredVersion((v) => v + 1);
    if (nextSelected) setSelectedGraphIds(nextSelected);
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

  // Kept keyed on `project` alone, deliberately not on `selectedSceneId` —
  // this is the same expensive-per-scene extractChoices() walk the v0.10.3
  // pitfall exists to warn about, so it must only rerun when a scene's
  // content actually changes, never on a plain click. The lightweight
  // selection-highlight styling below is a separate, cheap memo layered on
  // top instead.
  const edgesBase = useMemo<Edge[]>(() => {
    if (!project) return [];
    return project.scenes.flatMap((scene) =>
      extractChoices(scene.content)
        .filter((choice) => choice.targetSceneId)
        .map((choice) => ({
          id: `${scene.id}-${choice.id}`,
          source: scene.id,
          target: choice.targetSceneId as string,
          // Bezier ("default"), not "smoothstep" — investigated as part of
          // the frame-interaction pass below. SceneNode's handles are fixed
          // to Right (source) / Left (target) for Auto Layout's normal
          // left-to-right flow, but a scene dragged freely inside a frame
          // (or anywhere off the auto-layout grid) very often ends up
          // *behind* or *below* the scene it connects to rather than neatly
          // to its right. `smoothstep`'s routing has to stay axis-aligned,
          // so a "backward" connection like that forces it into a hard
          // right-angle loop — step right, double back, step left again —
          // which is exactly the tangled loop that showed up once frames
          // made tight, non-linear scene clusters common. A bezier curve
          // has no such constraint: from the same fixed handles it bows
          // smoothly toward the target from any relative direction, so a
          // backward or stacked connection reads as a graceful cable, not a
          // routing glitch — closer to the Blueprint-style wires the frame
          // grouping is deliberately going for. Auto-layout's ordinary
          // forward connections look effectively identical either way.
          type: "default",
          label: choice.text || undefined,
          labelStyle: { fill: "var(--text-2)", fontSize: 11 },
          labelBgStyle: { fill: "var(--surface)" },
        })),
    );
  }, [project]);

  // Edges connected to the selected scene read as part of what's selected,
  // not just the node itself — matching how a selected scene already gets
  // an accent border. This is purely a style pass over the small edges
  // array (never a re-walk of scene content), so clicking between scenes
  // stays as cheap as it already was.
  const edges = useMemo<Edge[]>(() => {
    return edgesBase.map((edge) => {
      // Sprint 8B interaction-consistency fix: this used to check only
      // `selectedSceneId` (the scene open in the Scene Editor), so a scene
      // picked up by Ctrl+click or a box-select rectangle — which already
      // shows its own accent-ring highlight, see SceneNode's `selected`
      // handling — had edges that stayed unhighlighted, unlike the fuller
      // treatment an *active* scene's edges got. Selection feedback is
      // supposed to be "immediately understandable" everywhere at once;
      // checking `selectedGraphIds` too means an edge lights up the moment
      // either end of it is selected by any means (open-in-editor, click,
      // Ctrl+click, or box-select), not just the one case that happened to
      // be wired up first. `selectedGraphIds` can also contain frame ids,
      // but no edge ever references one, so `.has()` on those simply never
      // matches — nothing extra to guard against here.
      const isConnectedToSelected =
        (!!selectedSceneId && (edge.source === selectedSceneId || edge.target === selectedSceneId)) ||
        selectedGraphIds.has(edge.source) ||
        selectedGraphIds.has(edge.target as string);
      return {
        ...edge,
        style: {
          stroke: isConnectedToSelected ? "var(--accent)" : "var(--border-faint)",
          strokeWidth: isConnectedToSelected ? 2.2 : 1.6,
        },
        zIndex: isConnectedToSelected ? 1 : 0,
      };
    });
  }, [edgesBase, selectedSceneId, selectedGraphIds]);

  // Positions (and the two data fields that come along for free —
  // choiceCount looked up from the memo above, not recomputed) DO need to
  // update every pointer-move during a drag, so this memo depends on
  // `frameDrag`/`sceneDrag` — but everything inside it is now cheap
  // arithmetic, no document parsing.
  const nodes = useMemo<Node[]>(() => {
    if (!project) return [];

    const frameNodes: Node[] = project.frames.map((frame) => {
      const dragOffset = frameDrag?.get(frame.id);
      const isResizing = frameResize?.frameId === frame.id;
      const position = dragOffset
        ? { x: frame.position.x + dragOffset.dx, y: frame.position.y + dragOffset.dy }
        : isResizing
          ? { x: frameResize.x, y: frameResize.y }
          : frame.position;
      const size = isResizing ? { width: frameResize.width, height: frameResize.height } : frame.size;

      return {
        id: frame.id,
        type: "frame",
        position,
        style: { width: size.width, height: size.height, zIndex: 0 },
        // Suppresses the node's own settle transition (see `.react-flow__node
        // :not(.dragging):not(.scriare-resizing)` in index.css) only while
        // this frame is being resized. That CSS transition exists so a
        // *programmatic* position change (Auto Layout, a frame drag
        // settling) eases into place — but resizing never gets React Flow's
        // own `.dragging` class (that's drag-only), so without this, a
        // top/left-handle resize (which moves `position`, not just
        // width/height) had its position updates eased over 150ms while
        // width/height applied instantly — the left/top edge visibly lagged
        // behind the cursor while the opposite edge appeared to overshoot to
        // compensate. Bottom/right-handle resizes never touch `position`, so
        // they were never affected — which is exactly why only top/left felt
        // wrong.
        className: isResizing ? "scriare-resizing" : undefined,
        data: {
          title: frame.title,
          // Threaded through `data` (rather than called straight from a
          // store hook inside FrameNode, the way `renameFrame`/`deleteFrame`
          // are) because the *live* overlay these drive — `frameResize` —
          // has to live here in FlowPanel, alongside `frameDrag`/`sceneDrag`,
          // not in FrameNode itself: FrameNode has no way to feed a value
          // back into the `nodes` array its own node object comes from. See
          // `frameResize`'s declaration comment for why the overlay itself
          // is necessary.
          onResize: (rect: { x: number; y: number; width: number; height: number }) => {
            setFrameResize({ frameId: frame.id, ...rect });
          },
          onResizeEnd: (rect: { x: number; y: number; width: number; height: number }) => {
            updateFrameRect(frame.id, rect);
            setFrameResize(null);
          },
        },
        // Fed back in every recompute — see `selectedGraphIds`'s own
        // declaration comment for why this is required, not optional, for a
        // frame to ever show as selected (accent border, resize handles).
        selected: selectedGraphIds.has(frame.id),
        zIndex: 0,
        // Carries the node's last-known real DOM size across drag-frame
        // recomputes — see the `measuredSizeRef` comment above.
        measured: measuredSizeRef.current.get(frame.id),
      };
    });

    const sceneNodes: Node[] = project.scenes.map((scene) => {
      // A scene whose containing Frame is *also* being dragged takes the
      // frame's offset, same precedence the store's own `updateFramePosition`
      // commit uses (see `handleNodeDragStop`) — a contained scene that
      // isn't itself part of the selection still has to ride along with its
      // frame, and one that IS also directly selected/dragged already gets
      // carried correctly by the frame's motion, so applying its own
      // (redundant) offset on top would double it.
      const frameOffset = scene.frameId ? frameDrag?.get(scene.frameId) : undefined;
      const sceneOffset = sceneDrag?.get(scene.id);
      const position = frameOffset
        ? { x: scene.position.x + frameOffset.dx, y: scene.position.y + frameOffset.dy }
        : sceneOffset
          ? { x: scene.position.x + sceneOffset.dx, y: scene.position.y + sceneOffset.dy }
          : scene.position;

      return {
        id: scene.id,
        type: "scene",
        position,
        data: {
          label: scene.title || "Untitled scene",
          choiceCount: choiceCountByScene.get(scene.id) ?? 0,
          // "Open in the Scene Editor" (thicker accent border + fill) —
          // unchanged meaning, but no longer set by a single click; see
          // `handleNodeDoubleClick` below.
          isActive: scene.id === selectedSceneId,
          isStart: scene.id === project.startSceneId,
        },
        // Fed back in every recompute for the same reason a frame's
        // `selected` is — see `selectedGraphIds`. Scenes never carried this
        // field before Sprint 8B, so a scene could never show a "selected in
        // the graph, but not open in the editor" state at all, nor could it
        // ever visibly participate in Ctrl+click or box-select.
        selected: selectedGraphIds.has(scene.id),
        zIndex: 1,
        measured: measuredSizeRef.current.get(scene.id),
      };
    });

    return [...frameNodes, ...sceneNodes];
    // `measuredVersion` isn't read inside this computation — it's listed here
    // purely so a change to it (see its own comment above) forces this memo
    // to recompute and re-read `measuredSizeRef.current`, which the
    // computation above does use.
  }, [
    project,
    selectedSceneId,
    selectedGraphIds,
    frameDrag,
    sceneDrag,
    frameResize,
    choiceCountByScene,
    measuredVersion,
    updateFrameRect,
  ]);

  // Single click no longer opens a scene in the Scene Editor — it now only
  // participates in graph selection (native React Flow click/Ctrl-click/
  // box-select, applied via `handleNodesChange` above). A single click used
  // to call `selectScene` directly, which meant just clicking a node to
  // glance at or select it also blew away whatever you were mid-edit on in
  // the Scene Editor — too aggressive for a spatial "select things" gesture.
  // Opening a scene for editing is now its own explicit gesture instead:
  // double-click. (Frames have no editor to focus, so double-click on one is
  // a no-op — nothing else in this app currently wants it.)
  const handleNodeDoubleClick: NodeMouseHandler = (_event, node) => {
    if (node.type === "scene") {
      selectScene(node.id);
    }
  };

  // All three handlers below read their THIRD argument, `nodes` — not just
  // the single `node` React Flow reports as "the one the pointer grabbed" —
  // because a multi-selection drags as a group: React Flow moves every
  // selected node together and reports the whole set there. Building a
  // per-id offset for everything in that array (rather than only for
  // `node`) is what makes Ctrl+click/box-select multi-selections actually
  // move together instead of only the grabbed node responding.
  const handleNodeDragStart: OnNodeDrag = (_event, node, nodes) => {
    const frameMap = new Map<string, DragOffset>();
    const sceneMap = new Map<string, DragOffset>();
    for (const n of nodes) {
      if (n.type === "frame") {
        frameMap.set(n.id, { origin: { ...n.position }, dx: 0, dy: 0 });
      } else if (n.type === "scene") {
        sceneMap.set(n.id, { origin: { ...n.position }, dx: 0, dy: 0 });
      }
    }
    // No manual selection call needed here: React Flow's default
    // `selectNodesOnDrag` already selects a node the moment you start
    // dragging it (the same `select`-type `NodeChange` `handleNodesChange`
    // now applies generally — see `selectedGraphIds`), so grabbing a frame
    // to move it already selects it, meaning its resize handles are
    // available immediately after a drag without a separate click first.
    setFrameDrag(frameMap.size > 0 ? frameMap : null);
    // Mirrors the frame branch above: an unconditional setState on every
    // drag frame is what makes a node visually track the cursor at all.
    // React Flow's own internal drag tracking only repaints a node when
    // something calls `onNodesChange` (never wired up in this app) or when
    // the *store* itself is told to update — neither happens on its own
    // here, so without this, `internals.positionAbsolute` is computed once
    // at drag-start and then never touched again until drop, which is
    // exactly the "sits in place while you drag" symptom. Feeding a live
    // dx/dy into each dragged node's fed-in `position` (below, in the nodes
    // memo) forces a real re-render every pointer-move, and — critically —
    // the position we feed in always equals where the cursor already put
    // the node, so `adoptUserNodes` has nothing stale to reset it to.
    setSceneDrag(sceneMap.size > 0 ? sceneMap : null);

    if (node.type === "scene" && project) {
      setFrameHighlight(findContainingFrame(project.frames, node.position)?.id ?? null);
    }
  };

  const handleNodeDrag: OnNodeDrag = (_event, node, nodes) => {
    setFrameDrag((prev) => {
      if (!prev) return prev;
      const next = new Map(prev);
      let changed = false;
      for (const n of nodes) {
        const entry = n.type === "frame" ? next.get(n.id) : undefined;
        if (!entry) continue;
        const dx = n.position.x - entry.origin.x;
        const dy = n.position.y - entry.origin.y;
        if (dx !== entry.dx || dy !== entry.dy) {
          next.set(n.id, { ...entry, dx, dy });
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    setSceneDrag((prev) => {
      if (!prev) return prev;
      const next = new Map(prev);
      let changed = false;
      for (const n of nodes) {
        const entry = n.type === "scene" ? next.get(n.id) : undefined;
        if (!entry) continue;
        const dx = n.position.x - entry.origin.x;
        const dy = n.position.y - entry.origin.y;
        if (dx !== entry.dx || dy !== entry.dy) {
          next.set(n.id, { ...entry, dx, dy });
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    if (node.type === "scene" && project) {
      setFrameHighlight(findContainingFrame(project.frames, node.position)?.id ?? null);
    }
  };

  const handleNodeDragStop: OnNodeDrag = (_event, node, nodes) => {
    const draggedFrameIds = new Set(nodes.filter((n) => n.type === "frame").map((n) => n.id));

    for (const n of nodes) {
      if (n.type === "frame") updateFramePosition(n.id, n.position);
    }
    for (const n of nodes) {
      if (n.type !== "scene") continue;
      const scene = project?.scenes.find((s) => s.id === n.id);
      // A scene whose containing frame is *also* being dragged in this same
      // gesture already gets carried along by `updateFramePosition` above
      // (it shifts every scene sharing that `frameId`) — committing this
      // scene's own position on top of that would double-apply the frame's
      // motion. See the matching comment on `frameOffset`/`sceneOffset` in
      // the `nodes` memo, which mirrors this same precedence while dragging.
      if (scene?.frameId && draggedFrameIds.has(scene.frameId)) continue;
      updateScenePosition(n.id, n.position);
    }

    setFrameDrag(null);
    setSceneDrag(null);
    if (node.type === "scene") setFrameHighlight(null);
  };

  function handleAutoLayout(): void {
    autoLayoutScenes();
    window.requestAnimationFrame(() => {
      flowInstanceRef.current?.fitView({ duration: CAMERA_FIT_DURATION_MS, padding: 0.2 });
    });
  }

  return (
    <div
      style={{ height: collapsed ? 36 : height }}
      className="flex shrink-0 flex-col overflow-hidden border-t border-[var(--border-soft)] bg-[var(--surface)]"
    >
      {collapsed ? (
        // The whole collapsed bar is the click target to re-expand — matching
        // how the Content and Scene Details panels' collapsed strips already
        // work (click anywhere on the strip, not just the label).
        <button
          type="button"
          onClick={onToggle}
          title="Expand Flow"
          className="flex flex-1 items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-3)] hover:text-[var(--text)]"
        >
          <span aria-hidden>▴</span>
          Flow
        </button>
      ) : (
        <div className="flex items-center justify-between px-3 py-2">
          <button
            type="button"
            onClick={onToggle}
            title="Collapse"
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-3)] hover:text-[var(--text)]"
          >
            <span aria-hidden>▾</span>
            Flow
          </button>

          {project && (
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
                // As of v0.16.0, a Frame containing scenes is arranged as
                // one collapsed unit (see "Auto Layout and Frames
                // architecture") rather than being skipped — this tooltip
                // was still describing the pre-v0.16.0 behavior.
                title="Automatically arrange scenes and frames"
              >
                Auto Layout
              </button>
            </div>
          )}
        </div>
      )}

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
              onNodeDoubleClick={handleNodeDoubleClick}
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
              fitViewOptions={{ padding: 0.2, duration: CAMERA_FIT_DURATION_MS }}
              // Nav model (Sprint 8B): right mouse button pans, left mouse
              // button is reserved for selection — click a node to select
              // it, Ctrl/Cmd+click to add or remove one from the selection
              // (React Flow's own default, OS-aware `multiSelectionKeyCode`
              // — left as the default rather than hardcoded to "Control" so
              // it stays Cmd+click if this app is ever run on macOS), and a
              // left-drag on empty canvas draws a selection rectangle
              // instead of panning. `panOnDrag={[2]}` is what unlocks all of
              // this: with it set, React Flow also automatically suppresses
              // the browser's native right-click context menu on this
              // canvas (see Pane's own onContextMenu handler) — nothing
              // extra needed here for that. `selectionMode="Partial"` (a
              // node only needs to be touched by the rectangle, not fully
              // enclosed) matches how box-select feels in most modern
              // creative/design tools and reads as more responsive than the
              // library's own default ("Full" containment only).
              panOnDrag={[2]}
              selectionOnDrag
              selectionMode={SelectionMode.Partial}
              nodeDragThreshold={2}
              // Sprint 8B evaluated dragging a node near the viewport edge
              // (a large-graph usability question) and found React Flow
              // already auto-pans the canvas while a node drag is held near
              // an edge — `autoPanOnNodeDrag`/`autoPanSpeed` are both
              // already React Flow's own defaults (true / 15), so this was
              // never actually missing. Declared explicitly here, matching
              // this codebase's standing practice of pinning any
              // load-bearing library default rather than leaving it
              // implicit (see e.g. `selectionMode`, `panOnDrag` above) —
              // this way a future React Flow upgrade changing its own
              // default can't silently change this app's feel.
              autoPanOnNodeDrag
              autoPanSpeed={15}
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
