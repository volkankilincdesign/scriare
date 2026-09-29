import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { SCENE_NODE_HEIGHT, SCENE_NODE_WIDTH } from "../../utils/graphConstants";
import { StartBadge } from "../common/StartBadge";

interface SceneNodeData {
  label: string;
  choiceCount: number;
  /** v0.66.0 — the Dialogue's one badge, or null when there is none. */
  dialogue?: { inPage: number; exits: number } | null;
  isActive: boolean;
  isStart: boolean;
  /** v0.73.0 — something else is selected, and this is not one step from it. */
  dimmed?: boolean;
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

export function SceneNode({ data, selected }: NodeProps) {
  const { label, choiceCount, dialogue, isActive, isStart, dimmed } = data as SceneNodeData;

  return (
    <div
      // `opacity` rather than a colour change (v0.73.0): a dimmed card has
      // to lose its border, its fill, its title and its badge all at once,
      // and there is no way to say that in tokens without inventing a
      // faded twin of every one of them. Not zero, and not close to it —
      // the point is that the rest of the story is still THERE, just out
      // of the way, so that the lit path reads as a path through something
      // rather than as the only thing that exists.
      style={{ width: SCENE_NODE_WIDTH, height: SCENE_NODE_HEIGHT, opacity: dimmed ? 0.28 : 1 }}
      // `scriare-scene-card` is a stable hook for the graph's CSS-only
      // drag-lift effect (see index.css) — it targets
      // `.react-flow__node.dragging .scriare-scene-card` directly, rather
      // than a React-state `isDragging` flag threaded through node `data`.
      // That state-driven approach was tried first and reverted: any state
      // update during a scene drag forces FlowPanel's `nodes` memo to
      // recompute, which hands React Flow a *new* node object for the
      // scene being dragged — and React Flow only preserves a node's live
      // drag position when the incoming object is reference-identical to
      // its internal one, so every recompute snapped the node back to its
      // pre-drag position mid-drag. Plain CSS keyed off React Flow's own
      // `dragging` class needs no state at all, so it can't cause that.
      //
      // `isActive` (open in the Scene Editor) and `selected` (selected in
      // the graph — via click, Ctrl+click, or box-select, see FlowPanel's
      // `selectedGraphIds`) are deliberately two different visual
      // languages, same as they're two different concepts as of Sprint 8B:
      // `isActive` keeps the stronger solid accent border + fill it always
      // had, so "what's open for editing" stays unambiguous; a `selected`
      // scene that ISN'T also active gets a lighter accent *ring* instead
      // (reusing the `--accent-ring` token already reserved for exactly
      // this kind of selection halo) — visible enough to confirm "yes, this
      // is what Ctrl+click/box-select picked up," without reading as if the
      // Scene Editor just jumped to it.
      // `transition` (not just `transition-colors`) as of Sprint 8B: this
      // card's own `scale(1.05)` drag-lift (index.css, keyed off the
      // ancestor `.react-flow__node.dragging`) and its selection ring
      // (Tailwind's `ring-*`, which is a box-shadow under the hood) were
      // both snapping in/out instantly — only border-color/background-color
      // were ever covered. Safe to animate `transform` here specifically
      // because it's applied to THIS inner card, never the outer
      // `.react-flow__node` wrapper React Flow itself repositions every
      // drag frame (see the drag-transition pitfall in the architecture
      // doc) — this element's own transform only ever flips between "1x"
      // and "1.05x scaled," it's never fed a continuously-updating value,
      // so easing it can't lag behind or fight the cursor.
      className={`scriare-scene-card flex flex-col justify-center rounded-lg border px-3 py-2 transition duration-150 ${
        isActive
          ? "border-[var(--accent)] bg-[var(--surface-2)]"
          : "border-[var(--border)] bg-[var(--bg)] hover:border-[var(--border-faint)] hover:bg-[var(--surface-2-faint)]"
      } ${selected && !isActive ? "ring-2 ring-[var(--accent-ring)]" : ""}`}
    >
      <Handle type="target" position={Position.Left} style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Right} style={HANDLE_STYLE} />

      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1 truncate text-xs font-medium text-[var(--text)]">{label}</div>
        {isStart && <StartBadge compact />}
      </div>
      <div className="mt-0.5 text-[10px] text-[var(--text-3)]">
        {choiceCount === 0
          ? "No choices"
          : `${choiceCount} choice${choiceCount === 1 ? "" : "s"}`}
      </div>
      {/* ONE badge, settled on board G6: neither silence — which makes a
          scene where five things can happen look empty — nor a self-loop,
          which would claim the scene leads to itself when it leads
          nowhere at all. */}
      {dialogue && (dialogue.inPage > 0 || dialogue.exits > 0) && (
        <div className="mt-0.5 text-[10px] text-[var(--accent)]" data-dialogue-badge>
          ◆ {dialogue.inPage} in-page
          {dialogue.exits > 0 && ` · ${dialogue.exits} exit${dialogue.exits === 1 ? "" : "s"}`}
        </div>
      )}
    </div>
  );
}
