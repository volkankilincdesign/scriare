import { BaseEdge, EdgeText, getBezierPath, Position } from "@xyflow/react";
import type { EdgeProps } from "@xyflow/react";

/**
 * A wire that draws the path the router worked out for it (v0.73.0).
 *
 * React Flow's own edge types each compute their own shape from the two
 * handle positions, which is exactly the assumption this feature exists to
 * break: the shape depends on what else is on the canvas, and a single edge
 * cannot know that. So the path is computed once for the whole graph (see
 * utils/wireRouter.ts) and handed to each edge in `data`.
 *
 * THE FALLBACK IS NOT A SAFETY NET, IT IS THE DESIGN. A routed path is a
 * snapshot of where things were when the router last ran, and the router
 * does not run on drag frames — it costs about a tenth of a second, which is
 * fine once per button press and absurd sixty times a second. So while a
 * scene is being dragged its wires have no current path and fall back to the
 * bezier, which follows the cursor for free because React Flow keeps the
 * handle coordinates live. The wire snaps back into its routed shape when
 * the drag commits. Same code path serves a wire the router could not place
 * at all: no path, draw the old way, rather than draw something wrong.
 */
export function RoutedEdge(props: EdgeProps): JSX.Element {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    style,
    markerEnd,
    label,
    labelStyle,
    labelShowBg,
    labelBgStyle,
    labelBgPadding,
    labelBgBorderRadius,
    data,
  } = props;

  const routed = (data as { path?: string; labelX?: number; labelY?: number } | undefined) ?? {};

  let d = routed.path;
  let lx = routed.labelX;
  let ly = routed.labelY;

  if (!d) {
    const [path, bx, by] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition: Position.Right,
      targetX,
      targetY,
      targetPosition: Position.Left,
    });
    d = path;
    lx = bx;
    ly = by;
  }

  return (
    <>
      <BaseEdge id={id} path={d} style={style} markerEnd={markerEnd} />
      {label !== undefined && label !== null && lx !== undefined && ly !== undefined && (
        <EdgeText
          x={lx}
          y={ly}
          label={label}
          labelStyle={labelStyle}
          labelShowBg={labelShowBg}
          labelBgStyle={labelBgStyle}
          labelBgPadding={labelBgPadding}
          labelBgBorderRadius={labelBgBorderRadius}
        />
      )}
    </>
  );
}
