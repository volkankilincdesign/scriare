import { useEffect, useRef, useState } from "react";
import { isDrawableShape } from "../../utils/recentShape";
import { orthoPath } from "../../utils/wireRouter";
import type { StoryShape } from "../../utils/recentShape";

interface StoryMapProps {
  /** Whatever was cached on the recent entry — any version, or nothing. */
  shape: unknown;
  /** The drawing's height in CSS px. The width is measured from the DOM. */
  height: number;
}

/**
 * A story's shape, drawn from the cached positions on its Recent Projects
 * entry.
 *
 * This is the one thing the Welcome screen shows that no competitor's
 * launcher does: a list of file names tells you what your stories are
 * CALLED, and a writer with nine of them does not recognise a story by its
 * name — they recognise it by whether it fans out early, runs as a spine,
 * or loops. So the card carries the picture.
 *
 * A SCALE MODEL, NOT A DIAGRAM (v0.53.2). The drawing is the graph
 * multiplied by one number: both axes share a scale, and so do the scene
 * cards, so every distance and every angle is the one the writer laid
 * out. The first two versions scaled the axes independently to fill the
 * panel, which turned a real 7.5:1 story into a 2.3:1 scatter — every
 * vertical gap exaggerated 3.2× — and produced a picture of a graph
 * nobody had drawn.
 *
 * The price is honest empty space: a wide flat story fills the width and
 * a third of the height. That space is canvas, so it is drawn as canvas —
 * the graph's own dot field, at the graph's own 18px spacing, behind
 * everything. A story with no shape yet is then the same drawing with the
 * scenes left out, which is exactly what it is.
 *
 * MEASURED, NOT SCALED. The element is measured and the drawing laid out
 * at real pixel size, rather than handing a fixed viewBox to the browser
 * to fit — which either letterboxes the drawing or smears every card.
 */
export function StoryMap({ shape, height }: StoryMapProps) {
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

  const drawable = isDrawableShape(shape) ? shape : null;

  return (
    <div ref={host} style={{ height }} className="w-full overflow-hidden">
      {width > 0 && (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          aria-hidden
          className="block"
          /* Marks a story map as a story map. The Welcome spec counts these
             to tell a map from the warning icon beside a moved file — both
             are <svg>, and "how many svgs are in this row" is the kind of
             question that quietly answers itself wrong. */
          data-story-map={drawable ? "drawn" : "empty"}
        >
          <DotField width={width} height={height} />
          {drawable && <Graph shape={drawable} width={width} height={height} />}
        </svg>
      )}
    </div>
  );
}

/** How much of the panel the drawing leaves as margin, per side. */
const PAD = 10;

/**
 * A card in the drawing is never allowed past this, however few scenes a
 * story has. Without it a two-scene story becomes two slabs filling the
 * panel, which says "enormous" about the smallest story on the shelf.
 */
const MAX_NODE_WIDTH = 54;

function Graph({ shape, width, height }: { shape: StoryShape; width: number; height: number }) {
  const boxW = Math.max(1, width - PAD * 2);
  const boxH = Math.max(1, height - PAD * 2);

  // ONE scale for both axes — the whole point. See the note on StoryMap.
  let scale = Math.min(boxW / Math.max(shape.w, 0.001), boxH / Math.max(shape.h, 0.001));
  if (shape.node.w * scale > MAX_NODE_WIDTH) scale = MAX_NODE_WIDTH / shape.node.w;

  const nodeW = Math.max(3, shape.node.w * scale);
  const nodeH = Math.max(2, shape.node.h * scale);
  // Centred in whatever room is left over, so a wide story sits on the
  // panel's midline rather than hugging its top edge.
  const offsetX = (width - shape.w * scale) / 2;
  const offsetY = (height - shape.h * scale) / 2;

  const at = (i: number) => {
    const n = shape.nodes[i];
    if (!n) return null;
    return { x: offsetX + n.x * scale, y: offsetY + n.y * scale };
  };

  return (
    <>
      <g fill="none" stroke="var(--border)" strokeWidth={1.25} strokeLinejoin="round" strokeLinecap="round">
        {shape.edges.map(([from, to], i) => {
          // The route the story's own router worked out, at save time, in
          // canvas coordinates — replayed here at whatever size this card
          // happens to be (v0.74.0). It used to be a cubic out of the
          // right edge into the next card's left, which was the rule the
          // Story Graph itself used until v0.73.0; leaving it here would
          // have made the map a picture of a graph the app no longer
          // draws.
          const flat = shape.wires?.[i];
          if (flat && flat.length >= 4) {
            const points: { x: number; y: number }[] = [];
            for (let k = 0; k < flat.length; k += 2) {
              points.push({
                x: offsetX + flat[k] * scale,
                y: offsetY + flat[k + 1] * scale,
              });
            }
            // The corner radius is chosen HERE, at the size the thing is
            // drawn, rather than scaled down with the drawing until it is
            // no longer a corner. Never more than a third of the shortest
            // run, so a short jog stays a jog.
            return <path key={`${from}-${to}-${i}`} d={orthoPath(points, 4)} />;
          }
          // A connection the router could not place keeps a straight line
          // between the two cards rather than disappearing: a map that
          // silently drops a connection is a map of a different story.
          const a = at(from);
          const b = at(to);
          if (!a || !b) return null;
          return (
            <path
              key={`${from}-${to}-${i}`}
              d={`M${a.x + nodeW / 2} ${a.y + nodeH / 2} L${b.x + nodeW / 2} ${b.y + nodeH / 2}`}
            />
          );
        })}
      </g>
      {shape.nodes.map((_, i) => {
        const p = at(i);
        if (!p) return null;
        const isStart = i === shape.start;
        return (
          <rect
            key={i}
            x={p.x}
            y={p.y}
            width={nodeW}
            height={nodeH}
            rx={Math.min(3, nodeH / 3)}
            fill={isStart ? "var(--accent)" : "var(--surface-3)"}
            stroke={isStart ? "var(--accent)" : "var(--border)"}
            strokeWidth={1}
          />
        );
      })}
    </>
  );
}

/**
 * The graph's own dot field, at the same 18px spacing the Story Graph
 * uses (see GRAPH_GRID). It sits behind every map, so the room a wide
 * story does not use reads as the canvas it is rather than as a gap.
 */
function DotField({ width, height }: { width: number; height: number }) {
  const step = 18;
  const dots: { x: number; y: number }[] = [];
  for (let x = step; x < width; x += step) {
    for (let y = step; y < height; y += step) dots.push({ x, y });
  }
  return (
    <g fill="var(--graph-dot)" data-dot-field="">
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={1} />
      ))}
    </g>
  );
}
