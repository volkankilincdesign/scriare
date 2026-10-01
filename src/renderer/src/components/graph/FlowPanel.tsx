import { useEffect, useMemo, useRef, useState } from "react";
import { ReactFlow, Background, BackgroundVariant, Controls, SelectionMode } from "@xyflow/react";
import type {
  Node,
  Edge,
  NodeMouseHandler,
  NodeChange,
  OnNodeDrag,
  OnNodesChange,
  ReactFlowInstance,
  NodeTypes,
  EdgeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useProjectStore } from "../../state/projectStore";
import { useSelectionStore } from "../../state/selectionStore";
import { extractChoices } from "../../utils/choiceBlocks";
import {
  newSignatureCache,
  pruneSignatureCache,
  reuseBySignature,
} from "../../utils/reuseBySignature";
import { mentionResolver } from "../../utils/mentions";
import { dialogueExits, extractDialogueLines } from "../../utils/dialogueBlocks";
import {
  GRAPH_GRID,
  SCENE_NODE_HEIGHT,
  SCENE_NODE_WIDTH,
  snapRect,
} from "../../utils/graphConstants";
import { routeDragged, routeSignature, routeWires } from "../../utils/wireRouter";
import {
  COLLAPSED_GROUP_SIZE,
  contentIndex,
  folderSubtree,
  graphGroups,
  groupAtPoint,
  hiddenSceneIds,
  visibleStandIn,
} from "../../utils/graphGroups";
import { SceneNode } from "./SceneNode";
import { RoutedEdge } from "./RoutedEdge";
import { GraphMiniMap } from "./GraphMiniMap";
import { GroupNode } from "./GroupNode";
import { DockGlyph, DockToggle } from "../common/DockToggle";

interface FlowPanelProps {
  collapsed: boolean;
  onToggle: () => void;
  /** Expanded height in pixels — the editor/graph splitter controls this. */
  height?: number;
}

// The group node type keeps the id "frame" so React Flow's own CSS hooks
// and this app's `.scriare-frame-box` styling carry over untouched — only
// what backs it changed in v0.28.0, not how it is drawn.
const nodeTypes: NodeTypes = {
  scene: SceneNode,
  frame: GroupNode,
};

// One edge type, and it draws whatever the router decided (v0.73.0). The
// shape of a wire depends on what else is on the canvas, which no single
// edge can know, so every edge asks the same component to draw the path it
// was handed — or a bezier, when there isn't one. See RoutedEdge.
const edgeTypes: EdgeTypes = { routed: RoutedEdge };

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

// A wire's label lives inside the graph's transformed viewport, so it
// shrinks with the camera. At the zoom that fits a thirteen-scene story
// into the panel, 10px of text renders about four pixels tall — not text
// any more, just a pale smear laid across the wires, which is the failure
// this label has been reported for twice. It is therefore drawn at its
// ordinary size and simply not drawn at all once the camera is too far
// out for it to be read (LABEL_MIN_ZOOM). Holding it at a constant SCREEN
// size instead was tried in v0.40.0 and is worse: every wire then carries
// a full-size sign on a map small enough to see the whole story, which is
// the same clutter arriving by the opposite route.
const LABEL_PX = 10;

// Below this, the label is left off. 0.7 puts the smallest drawn text at
// seven pixels — the point where "Choice 1" stops being legible and starts
// being a mark on the cable.
const LABEL_MIN_ZOOM = 0.7;

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
  const updateFolderRect = useProjectStore((s) => s.updateFolderRect);
  const claimSurface = useSelectionStore((s) => s.claimSurface);
  const publishSelection = useSelectionStore((s) => s.setGraphIds);
  const autoLayoutScenes = useProjectStore((s) => s.autoLayoutScenes);
  const addGraphGroup = useProjectStore((s) => s.addGraphGroup);

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

  // The camera's current zoom, used only to decide whether a wire's label
  // is large enough on screen to be worth drawing (see LABEL_MIN_ZOOM).
  // Rounded on the way in, because `onMove` fires continuously while
  // panning and an unrounded value would rerender the edges on every frame
  // of a gesture that didn't change how anything looks.
  const [zoom, setZoom] = useState(1);

  // v0.42.0 — the canvas is grid-based: scenes and boxes move, land and
  // resize on the same 18px lattice the dot field draws, so a story laid out
  // by hand lines up the way one laid out by Auto Layout does. Holding Alt
  // suspends it for the one case a grid can't serve — squeezing a card into
  // a gap the grid doesn't offer. Released on blur as well as keyup, because
  // a window that loses focus mid-drag would otherwise stay in free mode
  // with nothing holding the key down.
  const [freeMove, setFreeMove] = useState(false);

  useEffect(() => {
    function down(e: KeyboardEvent): void {
      if (e.key === "Alt") setFreeMove(true);
    }
    function up(e: KeyboardEvent): void {
      if (e.key === "Alt") setFreeMove(false);
    }
    function clear(): void {
      setFreeMove(false);
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
    };
  }, []);

  // Selection is only ever *un*-set by a change React Flow reports about a
  // node it still has (see `handleNodesChange`), so an id whose node leaves
  // the canvas — a scene deleted from the Content Browser, one project
  // closed and another opened — would otherwise stay selected forever, with
  // nothing on screen showing it and Delete still pointed at it. Found as
  // one project's selection surviving into the next; pruning here rather
  // than at every place that can remove a node keeps the rule in one place:
  // what is selected is a subset of what exists.
  useEffect(() => {
    if (selectedGraphIds.size === 0) return;
    const live = new Set<string>();
    for (const scene of project?.scenes ?? []) live.add(scene.id);
    for (const node of project?.content ?? []) live.add(node.id);
    let stale = false;
    for (const id of selectedGraphIds) {
      if (!live.has(id)) {
        stale = true;
        break;
      }
    }
    if (stale) setSelectedGraphIds(new Set([...selectedGraphIds].filter((id) => live.has(id))));
  }, [project, selectedGraphIds]);

  // Mirror the graph's selection out for the app-wide Delete/copy/paste
  // shortcuts — see state/selectionStore.ts. This set can hold frame ids
  // as well as scene ids; the shortcut layer filters, because what a frame
  // means to those operations is its business, not the graph's.
  useEffect(() => {
    publishSelection([...selectedGraphIds]);
  }, [selectedGraphIds, publishSelection]);

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
  //
  // ONE memo, not two. Until v0.49.0 the choice COUNTS and the EDGES were
  // separate memos, both keyed on `project`, and each ran its own complete
  // `extractChoices()` over every scene — so every keystroke walked every
  // document in the story twice, when the second walk already produced the
  // list whose length the first one wanted. Measured together at 1.5 ms on
  // a 40-scene story and 24.8 ms on a 300-scene one; roughly half of that
  // was the duplicate. They are still keyed on `project` alone, which is
  // the part that matters: neither runs on a drag frame.
  const { choiceCountByScene, dialogueByScene, edgesBase } = useMemo<{
    choiceCountByScene: Map<string, number>;
    dialogueByScene: Map<string, { inPage: number; exits: number }>;
    edgesBase: Edge[];
  }>(() => {
    const counts = new Map<string, number>();
    // v0.66.0 — one badge per node, "4 in-page · 2 exits", settled on
    // board G6. Not silence, which would make a scene where five things
    // can happen look empty, and not a self-loop, which would say the
    // scene leads to itself when it leads nowhere at all.
    const talk = new Map<string, { inPage: number; exits: number }>();
    if (!project) return { choiceCountByScene: counts, dialogueByScene: talk, edgesBase: [] };

    // An endpoint hidden inside a folded group is re-pointed at the box you
    // can actually see, so folding a chapter never makes a connection
    // silently vanish — the story still reads as connected, just at a
    // coarser grain. Several choices collapsing onto the same pair become
    // ONE edge carrying the count, because a dozen identical curves between
    // two boxes says nothing a single labelled one doesn't.
    const bundled = new Map<string, { source: string; target: string; count: number }>();
    const direct: Edge[] = [];

    // v0.37.0 — built once for the whole walk, so an edge labelled
    // "Follow @Mara" reads "Follow Mara" and keeps reading the right name
    // after she's renamed. Before this, a mention contributed nothing at
    // all to an edge label (see optionPlainText).
    const resolve = mentionResolver(project.entities ?? []);


    // Built once for the whole walk rather than inside `visibleStandIn`,
    // which used to index the entire content tree on every call — twice
    // per linked choice, on every keystroke. On a 300-scene story that was
    // 360,000 Map insertions per character typed, nearly all of them to
    // answer "no, nothing above this is folded".
    const byId = contentIndex(project.content);

    for (const scene of project.scenes) {
      // Numbered in document order across the whole scene, counting options
      // that go nowhere too — so the badge on a wire is the same ordinal the
      // writer sees counting down the page, not a renumbering that only
      // agrees with the page when every option happens to be linked.
      const sceneChoices = extractChoices(scene.content, resolve);
      counts.set(scene.id, sceneChoices.length);

      // THE RULE: a line is an edge only if it leaves. The ones that stay
      // are counted for the badge and contribute no wire at all.
      const dialogue = extractDialogueLines(scene.content, resolve);
      if (dialogue.length > 0) {
        const exits = dialogue.filter(dialogueExits);
        talk.set(scene.id, { inPage: dialogue.length - exits.length, exits: exits.length });
        for (const line of exits) {
          if (!line.targetSceneId) continue;
          sceneChoices.push({
            blockId: "",
            option: {
              id: line.id,
              text: line.text,
              targetSceneId: line.targetSceneId,
              actions: line.actions,
              conditions: line.conditions,
              whenUnmet: line.whenUnmet,
              style: line.style,
            },
          } as never);
        }
      }
      for (const [index, choice] of sceneChoices.entries()) {
        if (!choice.targetSceneId) continue;
        const ordinal = index + 1;
        const source = visibleStandIn(project, scene.id, byId) ?? scene.id;
        const target = visibleStandIn(project, choice.targetSceneId, byId) ?? choice.targetSceneId;
        // Both ends folded into the same box: the connection is now
        // internal to a single block, with nothing to draw between.
        if (source === target) continue;

        if (source !== scene.id || target !== choice.targetSceneId) {
          const key = `${source}->${target}`;
          const existing = bundled.get(key);
          if (existing) existing.count += 1;
          else bundled.set(key, { source, target, count: 1 });
          continue;
        }

        direct.push({
          id: `${scene.id}-${choice.id}`,
          source: scene.id,
          target: choice.targetSceneId,
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
          type: "routed",
          // v0.39.1 — the label is NOT set here. Printing every choice's
          // full sentence over the curves made the curves unreadable: on a
          // real 13-scene story the labels overlapped each other and sat
          // squarely on top of the wires they belonged to, so the one thing
          // the graph exists to show — which scene leads where — was the one
          // thing you couldn't trace. The text moved into `data` and the
          // styling memo below decides what's actually drawn: a short
          // ordinal bead at rest, the full sentence only for the handful of
          // wires you're pointing at.
          data: { short: `Choice ${ordinal}`, ordinal },
        });
      }
    }

    const bundles: Edge[] = [...bundled.values()].map(({ source, target, count }) => ({
      id: `bundle-${source}-${target}`,
      source,
      target,
      type: "routed",
      // A bundle is several choices folded into one wire, so it cannot name
      // a choice; it says how many it stands for instead.
      data: { bundled: true, short: `×${count}`, ordinal: 0 },
    }));

    return { choiceCountByScene: counts, dialogueByScene: talk, edgesBase: [...direct, ...bundles] };
  }, [project]);

  // Edges connected to the selected scene read as part of what's selected,
  // not just the node itself — matching how a selected scene already gets
  // an accent border. This is purely a style pass over the small edges
  // array (never a re-walk of scene content), so clicking between scenes
  // stays as cheap as it already was.
  /**
   * Edges that did not change keep their object identity (v0.51.0).
   *
   * Same story as the scene nodes above, and on a story with real choices
   * in it the edges are the bigger half: `edgesBase` is rebuilt whenever
   * `project` changes, so every wire became a new object on a title edit
   * and React Flow reconciled all of them. Measured on 300 scenes with 450
   * choices, one title edit: the graph cost 81.9 ms of a 115.5 ms
   * keystroke before this.
   *
   * An edge draws from a handful of primitives, so a signature settles
   * whether anything visible about it changed.
   */
  const edgeCache = useRef(newSignatureCache<Edge>());

  // Which group (if any) currently encloses a scene, mapped once per
  // render — a scene inside a group that is being dragged has to ride along
  // with it, and walking the content tree per scene per drag frame is
  // exactly the kind of per-pointer-move work the v0.10.3 pitfall is about.
  const groupOfScene = useMemo(() => {
    const map = new Map<string, string>();
    if (!project) return map;
    // Deepest-first, because innermost wins: a scene two levels down
    // belongs to the box that directly holds it, and that box is itself
    // carried by its parent. `graphGroups` returns parents first, so the
    // walk is reversed.
    //
    // This used to do the whole thing TWICE — fill the map parents-first,
    // then `map.clear()` and redo it reversed — so the first pass's entire
    // output was unreachable. `graphGroups` is not cheap (it runs
    // `deriveMissingRects`, a `folderSubtree` per rect-less folder plus a
    // spread-based min/max per group) and this memo is keyed on `project`,
    // so both halves ran on every keystroke; one of them for nothing.
    const groups = graphGroups(project.content, project.scenes).slice().reverse();
    for (const group of groups) {
      const subtree = folderSubtree(project.content, group.id);
      subtree.delete(group.id);
      for (const id of subtree) if (!map.has(id)) map.set(id, group.id);
    }
    return map;
  }, [project]);

  /**
   * The group boxes as they are right now.
   *
   * Memoized because the two drag handlers below read it on every
   * pointer-move, to decide which box a dragged scene is hovering over —
   * and each of them used to call `graphGroups(...)` itself, rebuilding
   * every group's rectangle from scratch per frame while the `nodes` memo
   * was doing the same thing in the same frame. Group geometry is a pure
   * function of `project`, which cannot change mid-drag (v0.49.0).
   */
  const groupsNow = useMemo(
    () => (project ? graphGroups(project.content, project.scenes) : []),
    [project],
  );

  /**
   * Fold every chapter and the map was gone (v0.87.0).
   *
   * MEASURED, from a screenshot and then from the DOM: with all five
   * chapters of The Blue Hour folded, the graph holds 5 collapsed group
   * nodes and 11 bundled edges, and not one of them is on screen. The
   * blocks are drawn where their chapters were; the camera is still framing
   * the area thirty-two scene cards used to occupy, which after folding
   * contains nothing at all. A writer folds a story to see its shape and
   * gets an empty canvas — and the shot the roadmap plans for the video,
   * four chapter boxes and then one unfolds, cannot be taken without
   * hunting for them with the fit-view button first.
   *
   * THE RULE IS DELIBERATELY NARROW, for `straightenRuns`' reason: a camera
   * that re-frames on every fold would yank the view away from a writer who
   * folded one distant chapter while working on another, which is a worse
   * fault than the one being fixed because it happens constantly rather
   * than occasionally. So this re-fits ONLY when the fold left nothing
   * visible — when the node bounds and the viewport no longer intersect at
   * all. Fold a chapter you are looking at and nothing moves.
   *
   * Keyed on which groups are folded rather than on `project`, so that
   * typing a word does not run it.
   */
  const foldSignature = groupsNow
    .filter((g) => g.collapsed)
    .map((g) => g.id)
    .sort()
    .join("|");
  const lastFold = useRef(foldSignature);
  useEffect(() => {
    if (lastFold.current === foldSignature) return;
    lastFold.current = foldSignature;
    const instance = flowInstanceRef.current;
    if (!instance) return;

    // A TIMER, NOT A FRAME, and the distinction is the whole of it. The
    // first version used `requestAnimationFrame` and the check still found
    // nothing on screen: React Flow replaces the node set and then MEASURES
    // it, and a frame callback runs before that measuring pass, so the
    // bounds read there are the ones being replaced.
    //
    // THE DURATION IS NOT THE MECHANISM, which a control proved by failing
    // to fail: at `0` this works exactly as well as at `120`. So the number
    // is slack rather than necessity — kept small and kept honest about
    // being arbitrary, because a comment claiming 120ms was needed would be
    // a claim nothing in this file can support.
    const id = window.setTimeout(() => {
      const flow = flowInstanceRef.current;
      if (!flow) return;
      const nodes = flow.getNodes();
      if (nodes.length === 0) return;

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const n of nodes) {
        const w = n.measured?.width ?? n.width ?? SCENE_NODE_WIDTH;
        const h = n.measured?.height ?? n.height ?? SCENE_NODE_HEIGHT;
        minX = Math.min(minX, n.position.x);
        minY = Math.min(minY, n.position.y);
        maxX = Math.max(maxX, n.position.x + w);
        maxY = Math.max(maxY, n.position.y + h);
      }

      // The visible rectangle, in the same coordinates the nodes live in.
      const { x, y, zoom } = flow.getViewport();
      // `containerRef` is the graph's visible rectangle — the element
      // <ReactFlow> fills — so it is what "is anything on screen" means.
      const box = containerRef.current?.getBoundingClientRect();
      if (!box || zoom <= 0) return;
      const viewMinX = -x / zoom;
      const viewMinY = -y / zoom;
      const viewMaxX = viewMinX + box.width / zoom;
      const viewMaxY = viewMinY + box.height / zoom;

      const intersects =
        maxX > viewMinX && minX < viewMaxX && maxY > viewMinY && minY < viewMaxY;
      if (intersects) return;
      flow.fitView({ duration: CAMERA_FIT_DURATION_MS, padding: 0.2 });
    }, 120);
    return () => window.clearTimeout(id);
  }, [foldSignature]);

  /** The live drag offset a scene inherits from whichever group is carrying it. */
  function groupOffsetFor(sceneId: string): DragOffset | undefined {
    if (!frameDrag) return undefined;
    let current = groupOfScene.get(sceneId);
    let guard = 0;
    while (current && guard++ < 32) {
      const offset = frameDrag.get(current);
      if (offset) return offset;
      current = project?.content.find((n) => n.id === current)?.parentId ?? undefined;
    }
    return undefined;
  }

  /**
   * Every wire's shape, worked out once for the whole canvas (v0.73.0).
   *
   * Keyed on the COMMITTED geometry — `project` and the edge list — and
   * deliberately not on the drag overlays beside it. Routing costs about a
   * tenth of a second on a real story, which is nothing once per edit and
   * impossible sixty times a second, so a wire whose scene is mid-drag has a
   * stale path and RoutedEdge draws it as a bezier until the drag commits.
   * That is the arrangement, not a gap in it.
   *
   * The obstacles are the scene cards and the FOLDED chapter boxes, which
   * are exactly the things a wire can end at. An open chapter box is not an
   * obstacle: it is a container, its scenes are inside it, and a wire
   * crossing its border crosses a label rather than a thing.
   *
   * "KEYED ON THE COMMITTED GEOMETRY" WAS NOT TRUE (v0.85.0). It said
   * `project` and meant geometry, and `project` is a new object after every
   * store write — so every letter of prose, every speaker, every condition
   * re-routed every wire in the story. Measured: 91.5 ms on a 32-scene
   * story with 70 wires, which is five times the whole of Auto Layout and
   * the largest single thing in a keystroke. The sentence above is exactly
   * the comment v0.51.0 found on the nodes memo, one layer out, and it was
   * wrong in the same way for the same reason.
   *
   * So the geometry is now stated rather than implied: `routeSignature`
   * lists what the router reads, and `reuseBySignature` hands back the
   * previous wires when none of it moved. The signature is built next to the
   * router, so a change to what routing depends on puts the promise about it
   * on screen. The boxes and links are still built every render — that is a
   * walk over 32 scenes and a map over an existing array, a fraction of a
   * millisecond against the 91 it decides whether to spend.
   *
   * Nothing here draws differently. Same inputs, same wires, same labels;
   * the only change is how often the question is asked.
   */
  const routeCache = useRef(
    newSignatureCache<{
      paths: Map<string, string>;
      labels: Map<string, { x: number; y: number }>;
    }>(),
  );
  const routes = useMemo(() => {
    const empty = {
      paths: new Map<string, string>(),
      labels: new Map<string, { x: number; y: number }>(),
    };
    if (!project) return empty;
    const hidden = hiddenSceneIds(project);
    const boxes = [
      ...project.scenes
        .filter((scene) => !hidden.has(scene.id))
        .map((scene) => ({
          id: scene.id,
          x: scene.position.x,
          y: scene.position.y,
          width: SCENE_NODE_WIDTH,
          height: SCENE_NODE_HEIGHT,
        })),
      ...graphGroups(project.content, project.scenes)
        .filter((group) => !group.hidden && group.collapsed)
        .map((group) => ({
          id: group.id,
          x: group.rect.x,
          y: group.rect.y,
          width: COLLAPSED_GROUP_SIZE.width,
          height: COLLAPSED_GROUP_SIZE.height,
        })),
    ];
    const links = edgesBase.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      ordinal: (edge.data as { ordinal?: number } | undefined)?.ordinal ?? 0,
    }));
    // ONE KEY, not one per wire. The router solves the whole board at once —
    // a wire's path depends on where every other wire went — so there is
    // nothing to reuse per wire, and the cache holds a single entry.
    return reuseBySignature(routeCache.current, "routes", routeSignature(boxes, links), () => {
      const result = routeWires(boxes, links);
      return { paths: result.paths, labels: result.labels };
    });
  }, [project, edgesBase]);

  const dragging = Boolean(frameDrag || sceneDrag || frameResize);

  /**
   * The wires of whatever is being dragged, redrawn for this frame.
   *
   * The first version of this let a dragged scene's wires fall back to the
   * bezier for the duration of the drag, on the grounds that the full
   * router costs a tenth of a second and cannot run sixty times a second.
   * The first half of that is true and the conclusion was wrong: watching
   * four connections turn back into curves the moment you pick a card up
   * says the lines were a decoration rather than what a connection IS.
   *
   * So a drag gets the cheap router rather than no router — one turn,
   * first free lane, still refusing to cross a card — and only for the
   * handful of wires whose ends actually moved. Every other wire keeps the
   * path the real router already gave it, because nothing about it changed:
   * dragging one scene has never been a reason to redraw the other sixty.
   */
  const dragRoutes = useMemo(() => {
    const empty = {
      paths: new Map<string, string>(),
      labels: new Map<string, { x: number; y: number }>(),
      moved: new Set<string>(),
    };
    if (!project || !dragging) return empty;

    const hidden = hiddenSceneIds(project);
    const movedBoxes = new Set<string>();
    const boxes = [
      ...project.scenes
        .filter((scene) => !hidden.has(scene.id))
        .map((scene) => {
          // Same precedence the `nodes` memo uses: a scene inside a group
          // being dragged rides along with the group; one dragged directly
          // carries its own offset.
          const offset = groupOffsetFor(scene.id) ?? sceneDrag?.get(scene.id);
          if (offset) movedBoxes.add(scene.id);
          return {
            id: scene.id,
            x: scene.position.x + (offset?.dx ?? 0),
            y: scene.position.y + (offset?.dy ?? 0),
            width: SCENE_NODE_WIDTH,
            height: SCENE_NODE_HEIGHT,
          };
        }),
      ...graphGroups(project.content, project.scenes)
        .filter((group) => !group.hidden && group.collapsed)
        .map((group) => {
          const offset = frameDrag?.get(group.id);
          const resizing = frameResize?.frameId === group.id;
          if (offset || resizing) movedBoxes.add(group.id);
          return {
            id: group.id,
            x: resizing ? frameResize.x : group.rect.x + (offset?.dx ?? 0),
            y: resizing ? frameResize.y : group.rect.y + (offset?.dy ?? 0),
            width: COLLAPSED_GROUP_SIZE.width,
            height: COLLAPSED_GROUP_SIZE.height,
          };
        }),
    ];

    const links = edgesBase.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      ordinal: (edge.data as { ordinal?: number } | undefined)?.ordinal ?? 0,
    }));
    const moved = new Set(
      links
        .filter((link) => movedBoxes.has(link.source) || movedBoxes.has(link.target))
        .map((link) => link.id),
    );
    const result = routeDragged(boxes, links, moved);
    return { paths: result.paths, labels: result.labels, moved };
    // `groupOffsetFor` closes over `frameDrag`, `groupOfScene` and
    // `project`, all of which are listed.
  }, [project, edgesBase, dragging, frameDrag, sceneDrag, frameResize, groupOfScene]);

  /**
   * What stays lit when something is selected (v0.73.0).
   *
   * The complaint this whole release answers was "it is almost impossible
   * to read which node is connected to which", and every other part of the
   * answer is geometry: better anchors, a better layout, a router that
   * knows what is in the way. This part is not geometry at all and it is
   * probably the cheapest of them — pick a scene and everything that is not
   * it or one step from it gets out of the way.
   *
   * Keyed on `selectedGraphIds` (click, Ctrl+click, box-select) and NOT on
   * `selectedSceneId`, which is "open in the Scene Editor" and is set
   * almost all the time. Dimming on that would mean the graph spent its
   * life three-quarters faded, answering a question nobody asked.
   */
  const litIds = useMemo(() => {
    if (selectedGraphIds.size === 0) return null;
    const lit = new Set(selectedGraphIds);
    for (const edge of edgesBase) {
      if (selectedGraphIds.has(edge.source)) lit.add(edge.target);
      if (selectedGraphIds.has(edge.target)) lit.add(edge.source);
    }
    return lit;
  }, [selectedGraphIds, edgesBase]);

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
      // A bundle stands for several connections at once, so it's drawn
      // heavier — the weight is the only thing distinguishing "these two
      // chapters are loosely related" from "everything flows through here".
      const isBundle = Boolean((edge.data as { bundled?: boolean } | undefined)?.bundled);
      // v0.39.1 — two labels per edge, and which one is drawn is a function
      // of attention. At rest every wire carries only its ordinal, small
      // enough to read as a bead threaded on the cable rather than a sign
      // hung over it; the sentence appears on the wires of whatever you've
      // selected, and on the single wire under the pointer. That keeps the
      // "which choice is this?" answer one hover away without ever letting
      // more than a few sentences be on screen at once — which was the
      // actual failure, not the labels themselves.
      // v0.43.0 — one label per wire, and it always says the same thing:
      // which choice this is. The two-label arrangement v0.39.1 introduced
      // (a bare ordinal at rest, the choice's own sentence on hover and on
      // the selected scene's wires) answered a question that turned out not
      // to be worth the machinery — the sentence is one double-click away
      // in the scene itself, and a label that changes what it says as the
      // pointer moves is a label you have to chase. A bare "1" was too
      // little on its own, though: it reads as a count or a weight, not as
      // "the first choice on the page". "Choice 1" is the whole idea.
      const labels = edge.data as { short?: string } | undefined;
      // Below this the text is under seven pixels tall, which is the white
      // smear over the wires this label has twice been reported as. The
      // graph zoomed out is a picture of the shape of the story, and the
      // shape doesn't need the numbering.
      const readable = zoom >= LABEL_MIN_ZOOM;
      // A wire whose ends moved this frame takes the cheap route worked
      // out for the drag; everything else keeps the one the real router
      // gave it. Neither is a reason to fall back to a curve.
      const onTheMove = dragRoutes.moved.has(edge.id);
      const source = onTheMove ? dragRoutes : routes;
      const path = source.paths.get(edge.id);
      const at = path ? source.labels.get(edge.id) : undefined;
      // Lit when either end is part of what is selected; faded when
      // something is selected and this is not part of it.
      const dimmed = Boolean(litIds) && !isConnectedToSelected;
      const sig = [
        edge.source,
        edge.target,
        isConnectedToSelected,
        isBundle,
        dimmed,
        readable ? labels?.short ?? "" : "",
        path ?? "",
      ].join("|");
      const build = (): Edge => ({
        ...edge,
        data: { ...edge.data, path, labelX: at?.x, labelY: at?.y },
        label: readable && !dimmed ? labels?.short : undefined,
        labelStyle: {
          fill: isConnectedToSelected ? "var(--text-2)" : "var(--text-3)",
          fontSize: LABEL_PX,
        },
        labelBgStyle: {
          fill: "var(--surface)",
          stroke: isConnectedToSelected ? "var(--border)" : "var(--border-faint)",
          strokeWidth: 1,
          fillOpacity: 0.96,
        },
        labelBgPadding: [5, 2] as [number, number],
        labelBgBorderRadius: 4,
        labelShowBg: true,
        style: {
          stroke: isConnectedToSelected ? "var(--accent)" : "var(--border-faint)",
          strokeWidth: isConnectedToSelected ? 2.2 : isBundle ? 2.6 : 1.6,
          // Not zero: a wire you can still see the run of is what makes the
          // lit one read as "this one, out of all those", rather than as the
          // only connection in the story.
          opacity: dimmed ? 0.12 : 1,
          transition: "opacity 120ms ease",
        },
        zIndex: 0,
      });
      return reuseBySignature(edgeCache.current, edge.id, sig, build);
    });
  }, [edgesBase, selectedSceneId, selectedGraphIds, zoom, routes, dragRoutes, litIds]);


  /** True when this scene sits inside one of the groups being dragged. */
  function isInsideDraggedGroup(sceneId: string, draggedGroupIds: Set<string>): boolean {
    let current = groupOfScene.get(sceneId);
    let guard = 0;
    while (current && guard++ < 32) {
      if (draggedGroupIds.has(current)) return true;
      current = project?.content.find((n) => n.id === current)?.parentId ?? undefined;
    }
    return false;
  }

  // Positions (and the two data fields that come along for free —
  // choiceCount looked up from the memo above, not recomputed) DO need to
  // update every pointer-move during a drag, so this memo depends on
  // `frameDrag`/`sceneDrag` — but everything inside it is now cheap
  // arithmetic, no document parsing.
  /**
   * Scene nodes that did not change keep their object identity (v0.51.0).
   *
   * The memo below depends on `project`, so editing ONE scene's title
   * rebuilt all 300 node objects and React Flow — which diffs by reference
   * — then reconciled every one of them.
   *
   * Measured on a 300-scene story, one title edit, median of 9 after
   * warm-up: 80.6 ms with everything open, 33.3 ms with the Story Graph
   * collapsed (and 33 ms is the floor, two animation frames). So the graph
   * was about 50 ms of an 80 ms keystroke — more than the Content panel,
   * the Inspector and the editor put together, and not where the v0.48.0
   * audit's tier 3 was looking.
   *
   * A scene node is fully described by primitives, so a signature settles
   * whether anything it draws has actually changed. Only scene nodes are
   * cached: group nodes carry a callback in `data`, and handing back a
   * cached object would hand back the callback captured with it.
   */
  const sceneNodeCache = useRef(newSignatureCache<Node>());

  const nodes = useMemo<Node[]>(() => {
    if (!project) return [];

    // Groups come from the content tree, parents before children, so a
    // nested box paints above the one that owns it (React Flow honours
    // array order for equal z-index). Everything below is unchanged from
    // the Frame era apart from where the data comes from.
    const groups = graphGroups(project.content, project.scenes).filter((g) => !g.hidden);
    // Every scene paints above every box (v0.39.2, reported). A group's own
    // z-index is its place in that parents-first list, which is what makes a
    // nested box paint above the one that owns it — but scenes used to be
    // pinned at a flat z of 1, so the THIRD box on a canvas (index 2) and
    // everything after it was drawn over its own contents and swallowed
    // every click, while the first two behaved. A box is a container: it is
    // always behind what it contains, whatever order it was made in.
    const sceneZ = groups.length + 1;
    const sceneCounts = new Map<string, number>();
    for (const group of groups) {
      const subtree = folderSubtree(project.content, group.id);
      subtree.delete(group.id);
      let count = 0;
      for (const scene of project.scenes) if (subtree.has(scene.id)) count += 1;
      sceneCounts.set(group.id, count);
    }

    const groupNodes: Node[] = groups.map((group, index) => {
      const dragOffset = frameDrag?.get(group.id);
      const isResizing = frameResize?.frameId === group.id;
      const position = dragOffset
        ? { x: group.rect.x + dragOffset.dx, y: group.rect.y + dragOffset.dy }
        : isResizing
          ? { x: frameResize.x, y: frameResize.y }
          : { x: group.rect.x, y: group.rect.y };
      const size = isResizing
        ? { width: frameResize.width, height: frameResize.height }
        : group.collapsed
          ? COLLAPSED_GROUP_SIZE
          : { width: group.rect.width, height: group.rect.height };

      return {
        id: group.id,
        type: "frame",
        position,
        style: { width: size.width, height: size.height, zIndex: index },
        // Suppresses the node's own settle transition (see `.react-flow__node
        // :not(.dragging):not(.scriare-resizing)` in index.css) only while
        // this box is being resized — resizing never gets React Flow's own
        // `.dragging` class, so without this a top/left-handle resize had
        // its position eased over 150ms while width/height applied
        // instantly, and the moving edge visibly lagged the cursor.
        className: isResizing ? "scriare-resizing" : undefined,
        data: {
          name: group.name,
          collapsed: group.collapsed,
          sceneCount: sceneCounts.get(group.id) ?? 0,
          // Threaded through `data` (rather than read from a store hook
          // inside GroupNode, the way rename/delete/fold are) because the
          // live overlay these drive — `frameResize` — has to live here
          // alongside `frameDrag`/`sceneDrag`: GroupNode has no way to feed
          // a value back into the `nodes` array its own node comes from.
          onResize: (rect: { x: number; y: number; width: number; height: number }) => {
            // Snapped on the way in, so the box being dragged shows the size
            // it is going to keep rather than a number that jumps on release.
            setFrameResize({ frameId: group.id, ...(freeMove ? rect : snapRect(rect)) });
          },
          onResizeEnd: (rawRect: { x: number; y: number; width: number; height: number }) => {
            const rect = freeMove ? rawRect : snapRect(rawRect);
            // `false` — a resize changes the box's shape, not where the
            // writer means it to live, so it must never re-file the folder
            // just because a corner happened to cross another box's edge.
            updateFolderRect(group.id, rect, false);
            setFrameResize(null);
          },
        },
        // Fed back in every recompute — see `selectedGraphIds`'s own
        // declaration comment for why this is required, not optional, for a
        // box to ever show as selected (accent border, resize handles).
        selected: selectedGraphIds.has(group.id),
        zIndex: index,
        // Carries the node's last-known real DOM size across drag-frame
        // recomputes — see the `measuredSizeRef` comment above.
        measured: measuredSizeRef.current.get(group.id),
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
      const frameOffset = groupOffsetFor(scene.id);
      const sceneOffset = sceneDrag?.get(scene.id);
      const position = frameOffset
        ? { x: scene.position.x + frameOffset.dx, y: scene.position.y + frameOffset.dy }
        : sceneOffset
          ? { x: scene.position.x + sceneOffset.dx, y: scene.position.y + sceneOffset.dy }
          : scene.position;

      const fresh: Node = {
        id: scene.id,
        type: "scene",
        position,
        data: {
          label: scene.title || "Untitled scene",
          choiceCount: choiceCountByScene.get(scene.id) ?? 0,
          dialogue: dialogueByScene.get(scene.id) ?? null,
          // "Open in the Scene Editor" (thicker accent border + fill) —
          // unchanged meaning, but no longer set by a single click; see
          // `handleNodeDoubleClick` below.
          isActive: scene.id === selectedSceneId,
          isStart: scene.id === project.startSceneId,
          // See `litIds`: faded when something else is selected and this
          // scene is neither it nor one step from it.
          dimmed: Boolean(litIds) && !litIds!.has(scene.id),
        },
        // Fed back in every recompute for the same reason a frame's
        // `selected` is — see `selectedGraphIds`. Scenes never carried this
        // field before Sprint 8B, so a scene could never show a "selected in
        // the graph, but not open in the editor" state at all, nor could it
        // ever visibly participate in Ctrl+click or box-select.
        selected: selectedGraphIds.has(scene.id),
        zIndex: sceneZ,
        measured: measuredSizeRef.current.get(scene.id),
      };

      // Everything the node draws, in one string. Cheap to build and
      // cheaper than the reconciliation it avoids.
      const measured = fresh.measured as { width?: number; height?: number } | undefined;
      const sig = [
        fresh.position.x,
        fresh.position.y,
        fresh.data.label,
        fresh.data.choiceCount,
        fresh.data.isActive,
        fresh.data.isStart,
        fresh.data.dimmed,
        fresh.selected,
        fresh.zIndex,
        measured?.width,
        measured?.height,
      ].join("|");
      return reuseBySignature(sceneNodeCache.current, scene.id, sig, () => fresh);
    });

    // A scene inside a folded group isn't drawn at all — that's what
    // folding means. Its edges are re-pointed at the folded box instead
    // (see `edges` above), so nothing about the story silently disappears.
    const hidden = hiddenSceneIds(project);
    pruneSignatureCache(sceneNodeCache.current, new Set(project.scenes.map((s) => s.id)));
    return [...groupNodes, ...sceneNodes.filter((n) => !hidden.has(n.id))];
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
    litIds,
    measuredVersion,
    updateFolderRect,
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
      setFrameHighlight(groupAtPoint(groupsNow, node.position)?.id ?? null);
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
      setFrameHighlight(groupAtPoint(groupsNow, node.position)?.id ?? null);
    }
  };

  const handleNodeDragStop: OnNodeDrag = (_event, node, nodes) => {
    const draggedGroupIds = new Set(nodes.filter((n) => n.type === "frame").map((n) => n.id));

    // The size a box KEEPS, which is not always the size it is drawn at: a
    // folded group is drawn as a small fixed block (COLLAPSED_GROUP_SIZE)
    // while still owning the dimensions it will unfold to. Reading the size
    // off the node meant dragging a folded chapter across the canvas wrote
    // the little block's dimensions in as the chapter's real ones, so
    // unfolding gave back a box the size of the folded stand-in with its own
    // scenes sitting outside it (reported after v0.42.0). A drag moves a box;
    // only a resize resizes one.
    const realSize = new Map<string, { width: number; height: number }>();
    if (project) {
      for (const group of graphGroups(project.content, project.scenes)) {
        realSize.set(group.id, { width: group.rect.width, height: group.rect.height });
      }
    }

    for (const n of nodes) {
      if (n.type === "frame") {
        const kept = realSize.get(n.id);
        updateFolderRect(
          n.id,
          {
            x: n.position.x,
            y: n.position.y,
            width: kept?.width ?? (n.style?.width as number) ?? 0,
            height: kept?.height ?? (n.style?.height as number) ?? 0,
          },
          true,
          // Alt held: keep exactly where it was dropped. Without threading
          // this through, the escape hatch would only affect the live drag
          // and the store would snap the box back on release — a bypass that
          // lies about what it does is worse than no bypass.
          !freeMove,
        );
      }
    }
    for (const n of nodes) {
      if (n.type !== "scene") continue;
      // A scene inside a group that is ALSO being dragged in this gesture is
      // already carried by `updateFolderRect` above (it shifts everything in
      // the subtree) — committing its own position on top would double-apply
      // the group's motion. Mirrors the same precedence the `nodes` memo
      // applies while the drag is still in flight.
      if (isInsideDraggedGroup(n.id, draggedGroupIds)) continue;
      updateScenePosition(n.id, n.position, !freeMove);
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
      className="scriare-graph-band flex shrink-0 flex-col overflow-hidden border-t border-[var(--border-soft)] bg-[var(--surface)]"
    >
      {collapsed ? (
        // The whole collapsed bar is the click target to re-expand — matching
        // how the Content and Scene Details panels' collapsed strips already
        // work (click anywhere on the strip, not just the label).
        // Sprint 8C naming-consistency fix (v0.18.0): this panel's visible
        // label was "Flow" — a leftover from before the app had real
        // product-facing panel names — while the other two dockable panels
        // (Content, Scene Details) and every internal architecture-doc
        // reference to this one already call it the "Story Graph". Renamed
        // to match; purely a label change, no change to layout, state, or
        // the `flow`/`FlowPanel` identifiers themselves (renaming those
        // would ripple through prop names, storage keys, and this whole
        // file for no user-visible benefit).
        <button
          type="button"
          onClick={onToggle}
          title="Expand Story Graph"
          className="scriare-section-label flex flex-1 items-center gap-2.5 px-3 py-2 text-[var(--text-3)] hover:text-[var(--text)]"
        >
          <DockGlyph direction="up" />
          Story Graph
        </button>
      ) : (
        // pt-3, not pt-2: this header sits directly under the splitter, and
        // at the old padding the toggle was all but touching the editor above
        // it (v0.45.0, reported).
        <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-3">
          <div className="flex items-center gap-2.5">
            <DockToggle direction="down" onClick={onToggle} title="Collapse Story Graph" />
            <span className="scriare-section-label text-[var(--text-3)]">
              Story Graph
            </span>
          </div>

          {project && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => addGraphGroup()}
                className="rounded px-2 py-1 text-xs font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                title="Add a group — a box on the canvas, and the same group in Content"
              >
                + Group
              </button>
              <button
                type="button"
                onClick={handleAutoLayout}
                className="rounded px-2 py-1 text-xs font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                // A group containing scenes is arranged as one unit
                // (v0.16.0's behaviour, retargeted from Frames to folders in
                // v0.28.0) rather than being skipped, and everything inside
                // keeps its own relative arrangement.
                title="Arrange scenes and groups automatically"
              >
                Auto Layout
              </button>
            </div>
          )}
        </div>
      )}

      {!collapsed && (
        <div
          ref={containerRef}
          // Touching the graph makes it the panel the keyboard means —
          // see state/selectionStore.ts. Capture phase, because React Flow
          // stops propagation on its own pointer handling.
          onPointerDownCapture={() => claimSurface("graph")}
          className="scriare-graph-bg relative flex-1"
        >
          {!project || project.scenes.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-[var(--text-3)]">
              Scenes will appear here as you write.
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              edgeTypes={edgeTypes}
              nodeTypes={nodeTypes}
              onInit={(instance) => {
                flowInstanceRef.current = instance;
              }}
              onMove={(_, viewport) => {
                const next = Math.round(viewport.zoom * 100) / 100;
                setZoom((prev) => (prev === next ? prev : next));
              }}
              onNodeDoubleClick={handleNodeDoubleClick}
              onNodesChange={handleNodesChange}
              onNodeDragStart={handleNodeDragStart}
              onNodeDrag={handleNodeDrag}
              onNodeDragStop={handleNodeDragStop}
              nodesDraggable
              // The live half of the grid: React Flow reports snapped
              // positions to onNodeDrag, so the card visibly steps from cell
              // to cell AND the value this app commits on release is already
              // on the lattice. The store snaps again on write (see
              // updateScenePosition) — belt and braces, because a position
              // can also arrive from paste, from Auto Layout, or from a
              // project file written by an older version.
              snapToGrid={!freeMove}
              snapGrid={[GRAPH_GRID, GRAPH_GRID]}
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
              {/* v0.41.0 — two dot fields rather than one flat grid. The
                  fine one gives the canvas a surface; the coarse one gives it
                  a scale, so panning reads as movement over something instead
                  of a texture sliding past. Reported as "the graph feels
                  infinite and hard to read", which is exactly what a canvas
                  with no measurable spacing feels like. */}
              <Background
                id="scriare-fine"
                variant={BackgroundVariant.Dots}
                color="var(--graph-dot)"
                gap={18}
                size={1.3}
              />
              <Background
                id="scriare-coarse"
                variant={BackgroundVariant.Dots}
                color="var(--graph-dot-strong)"
                gap={90}
                size={2.6}
              />
              {/* Shown only when part of the graph is off screen — see
                  GraphMiniMap for why that is the whole of its logic. */}
              <GraphMiniMap />
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
