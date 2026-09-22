import { MiniMap, useNodes, useStore } from "@xyflow/react";
import { useMemo } from "react";

/**
 * The Story Graph's minimap — present only when it has a job (v0.36.1).
 *
 * Reported: on a small story the minimap sits in the bottom-left corner
 * covering a scene, and there is nothing you can do about it. That is the
 * whole complaint and it's correct: a minimap exists to tell you where you
 * are in something too big to see. When the entire story is already on
 * screen it isn't an overview of anything — it's an opaque rectangle
 * parked on top of the thing it claims to summarise.
 *
 * So it appears when some part of the graph is off screen, and doesn't
 * when it isn't. No setting, no toggle to discover, nothing to remember:
 * the answer to "why is this in my way" is that it stops being there.
 *
 * While it IS shown it sits at a low opacity and comes up to full on
 * hover. Even when the minimap is needed, what's underneath it is a scene
 * someone wrote, and the schematic can afford to wait its turn.
 */
export function GraphMiniMap() {
  const nodes = useNodes();
  // The viewport, straight from React Flow's own store: the pan/zoom
  // transform and the size of the pane it's drawn in.
  // Three separate selectors, each returning a primitive or a stable
  // reference — NOT one selector returning `{width, height, transform}`.
  // React Flow's `useStore` compares with `Object.is` by default, and a
  // fresh object literal never matches the previous one, so this component
  // re-rendered on EVERY internal store notification: every drag frame,
  // every dimension change, every pan. On a large graph that reconciled
  // one <rect> per node per pointer-move, for values that had not changed
  // (v0.49.0).
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const transform = useStore((state) => state.transform);

  const bounds = useMemo(() => {
    if (nodes.length === 0) return null;
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    nodes.forEach((node) => {
      // `measured` is what React Flow actually laid out; `width`/`height`
      // are only the hints given to it, and a group's real size comes from
      // the DOM. Falling back keeps a node that hasn't been measured yet
      // from poisoning the bounds with NaN.
      const w = node.measured?.width ?? (node.width as number | undefined) ?? 0;
      const h = node.measured?.height ?? (node.height as number | undefined) ?? 0;
      left = Math.min(left, node.position.x);
      top = Math.min(top, node.position.y);
      right = Math.max(right, node.position.x + w);
      bottom = Math.max(bottom, node.position.y + h);
    });
    return { left, top, right, bottom };
  }, [nodes]);

  if (!bounds || width === 0 || height === 0) return null;

  const [tx, ty, zoom] = transform;
  const visible = {
    left: -tx / zoom,
    top: -ty / zoom,
    right: (-tx + width) / zoom,
    bottom: (-ty + height) / zoom,
  };

  // A threshold rather than a bare comparison, in flow units scaled to the
  // current zoom: a scene one pixel past the edge is not a story you can't
  // see, and without a dead band the minimap would blink in and out while
  // panning along the boundary.
  const slack = 24 / zoom;
  const offScreen =
    bounds.left < visible.left - slack ||
    bounds.top < visible.top - slack ||
    bounds.right > visible.right + slack ||
    bounds.bottom > visible.bottom + slack;

  if (!offScreen) return null;

  return (
    <MiniMap
      pannable
      zoomable
      maskColor="var(--overlay)"
      style={{ background: "var(--surface)" }}
      // --accent is a near-white fill in this monochrome palette, so
      // colouring minimap nodes with it turned every scene into a
      // blown-out white block — by some distance the loudest thing on
      // screen, and in a corner of the UI meant to be glanced at rather
      // than read. A minimap is a schematic; muted greys say "shape and
      // position" without shouting.
      nodeColor={(node) => (node.type === "frame" ? "var(--surface-3)" : "var(--text-3)")}
      nodeStrokeColor={() => "var(--border)"}
      position="bottom-left"
      className="scriare-minimap"
    />
  );
}
