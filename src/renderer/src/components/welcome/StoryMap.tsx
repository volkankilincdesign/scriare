import { useEffect, useRef, useState } from "react";
import type { StoryShape } from "../../utils/recentShape";

interface StoryMapProps {
  shape: StoryShape | null | undefined;
  /**
   * The drawing's height in CSS px. The WIDTH is measured from the element
   * it is given, because a card's width depends on the window and a map
   * that does not follow it is the one thing on this screen that visibly
   * fails to resize (v0.53.1).
   */
  height: number;
  /** Scene-card size in the drawing. Larger cards read better on a big map. */
  nodeWidth?: number;
  nodeHeight?: number;
}

/**
 * A story's shape, drawn from the cached positions on its Recent Projects
 * entry (v0.53.0).
 *
 * This is the one thing the Welcome screen shows that no competitor's
 * launcher does: a list of file names tells you what your stories are
 * CALLED, and a writer with nine of them does not recognise a story by its
 * name — they recognise it by whether it fans out early, runs as a spine,
 * or loops. So the card carries the picture.
 *
 * It is drawn with the Story Graph's own vocabulary on purpose: scene cards
 * as rounded rectangles left to right, choices as curves leaving a card's
 * right edge and arriving at the next card's left, the start scene in the
 * accent. Anything else would be a chart of a story rather than a small
 * picture of the thing you are about to open.
 *
 * No shape — a story last saved by a version before this one, and not yet
 * backfilled — is a state with its own drawing: the graph's dot field,
 * which is what an empty canvas looks like inside the app. A grey
 * placeholder box would say "this story is broken"; an empty canvas says
 * "nothing here yet".
 *
 * MEASURED, NOT SCALED (v0.53.1). The first version drew into a fixed
 * 372×104 viewBox and let the browser fit it with `preserveAspectRatio`,
 * which is the mistake that makes a map look broken on a wide window: the
 * drawing keeps its 3.6:1 shape and is letterboxed inside a card that is
 * now 5:1, so a third of the panel is empty and the story sits in a
 * stripe down the middle. Scaling to fill instead would stretch every
 * scene card into a smear. So the element is measured and the drawing is
 * laid out at the real pixel size, with the node cards staying the size
 * they are meant to be — which is what the Story Graph itself does when
 * its panel is resized.
 */
export function StoryMap({ shape, height, nodeWidth = 38, nodeHeight = 15 }: StoryMapProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const next = Math.round(entries[0]?.contentRect.width ?? 0);
      // Rounded, and only written when it actually changed: a ResizeObserver
      // that sets state on every sub-pixel report is a render loop with a
      // long fuse.
      setWidth((current) => (current === next ? current : next));
    });
    observer.observe(node);
    setWidth(Math.round(node.getBoundingClientRect().width));
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={host} style={{ height }} className="w-full overflow-hidden">
      {width > 0 && (shape && shape.nodes.length > 0
        ? <Drawn shape={shape} width={width} height={height} nodeWidth={nodeWidth} nodeHeight={nodeHeight} />
        : <DotField width={width} height={height} />)}
    </div>
  );
}

function Drawn({
  shape,
  width,
  height,
  nodeWidth,
  nodeHeight,
}: {
  shape: StoryShape;
  width: number;
  height: number;
  nodeWidth: number;
  nodeHeight: number;
}) {
  // The unit square maps into the box inset by half a card, so a node at
  // x=0 or x=1 sits fully inside the drawing rather than half outside it.
  const padX = nodeWidth / 2 + 10;
  const padY = nodeHeight / 2 + 8;
  const spanX = Math.max(0, width - padX * 2);
  const spanY = Math.max(0, height - padY * 2);
  const points = shape.nodes.map((n) => ({
    x: padX + n.x * spanX,
    y: padY + n.y * spanY,
  }));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden
      className="block"
      /* Marks a story map as a story map. The Welcome spec counts these to
         tell a map from the warning icon beside a moved file — both are
         <svg>, and "how many svgs are in this row" is the kind of question
         that quietly answers itself wrong. */
      data-story-map="drawn"
    >
      <g fill="none" stroke="var(--border)" strokeWidth={1.5}>
        {shape.edges.map(([from, to], i) => {
          const a = points[from];
          const b = points[to];
          if (!a || !b) return null;
          // Leaves the right edge, arrives at the left edge, with the
          // control points pulled horizontally — the same cubic the graph
          // draws, so a map and the canvas it came from look related.
          const x1 = a.x + nodeWidth / 2;
          const x2 = b.x - nodeWidth / 2;
          const bend = Math.max(12, Math.abs(x2 - x1) * 0.45);
          return (
            <path
              key={`${from}-${to}-${i}`}
              d={`M${x1} ${a.y} C ${x1 + bend} ${a.y}, ${x2 - bend} ${b.y}, ${x2} ${b.y}`}
            />
          );
        })}
      </g>
      {points.map((p, i) => {
        const isStart = i === shape.start;
        return (
          <rect
            key={i}
            x={p.x - nodeWidth / 2}
            y={p.y - nodeHeight / 2}
            width={nodeWidth}
            height={nodeHeight}
            rx={3}
            fill={isStart ? "var(--accent)" : "var(--surface-3)"}
            stroke={isStart ? "var(--accent)" : "var(--border)"}
            strokeWidth={1}
          />
        );
      })}
    </svg>
  );
}

/**
 * The graph's own dot field — an empty canvas, at the same 18px spacing
 * the Story Graph uses (see GRAPH_GRID). Drawn rather than imported as a
 * background image so it scales with the card and picks up the theme.
 */
function DotField({ width, height }: { width: number; height: number }) {
  const step = 18;
  const dots: { x: number; y: number }[] = [];
  for (let x = step; x < width; x += step) {
    for (let y = step; y < height; y += step) dots.push({ x, y });
  }
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden
      className="block"
      data-story-map="empty"
    >
      <g fill="var(--graph-dot)">
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={1} />
        ))}
      </g>
    </svg>
  );
}
