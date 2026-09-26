import type { StoryShape } from "../../utils/recentShape";

interface StoryMapProps {
  shape: StoryShape | null | undefined;
  width: number;
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
 * No shape — a story last saved by a version before this one — is a state
 * with its own drawing: the graph's dot field, which is what an empty
 * canvas looks like inside the app. A grey placeholder box would say "this
 * story is broken"; an empty canvas says "nothing here yet", which is both
 * true and what the writer sees when the shape is filled in on next save.
 */
export function StoryMap({ shape, width, height, nodeWidth = 38, nodeHeight = 15 }: StoryMapProps) {
  if (!shape || shape.nodes.length === 0) {
    return <DotField width={width} height={height} />;
  }

  // The unit square maps into the box inset by half a card, so a node at
  // x=0 or x=1 sits fully inside the drawing rather than half outside it.
  const padX = nodeWidth / 2 + 4;
  const padY = nodeHeight / 2 + 5;
  const spanX = Math.max(0, width - padX * 2);
  const spanY = Math.max(0, height - padY * 2);
  const cx = (n: { x: number }) => padX + n.x * spanX;
  const cy = (n: { y: number }) => padY + n.y * spanY;

  const points = shape.nodes.map((n) => ({ x: cx(n), y: cy(n) }));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      aria-hidden
      className="block"
      preserveAspectRatio="xMidYMid meet"
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
            fill={isStart ? "var(--accent)" : "var(--surface-2)"}
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
      width="100%"
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
