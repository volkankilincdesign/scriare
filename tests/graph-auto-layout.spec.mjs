/**
 * What Auto Layout is trying to do (v0.43.0, reported as "it tidies up the
 * space but seems like not enough").
 *
 * Two rules, and they are rules about the STORY, not about pixels:
 *
 *   1. A scene sits one column past the scene that leads to it. dagre's own
 *      ranking minimises total edge length instead, which is right for a
 *      flowchart and wrong for a story: given a scene with three choices it
 *      will happily put each option in a different column so the long
 *      branch and the short one meet neatly at the merge, and the result is
 *      a staircase — three options from one moment marching down and to the
 *      right, not one of their connections horizontal.
 *   2. A scene whose feeders all sit on one line joins that line. Ranking
 *      alone gets the columns right and says nothing about height, so a
 *      spine of four scenes still came out as a gentle zig-zag.
 *
 * Both are checked against layouts computed here rather than against
 * screenshots, and both have a negative control: rule 1 fails on the old
 * ranking (the three options land in three columns), rule 2 fails with the
 * straightening pass removed (the spine zig-zags).
 */
export default async function ({ page, api, check, seedProject }) {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /** Lay out a graph described as [from, to] pairs and report the geometry. */
  const layout = (edges) =>
    api((links) => {
      const ids = [...new Set(links.flat())];
      const positions = window.__scriareAutoLayout.computeAutoLayout(
        ids,
        links.map(([source, target]) => ({ source, target })),
      );
      const columns = {};
      for (const id of ids) {
        const key = String(positions[id].x);
        (columns[key] ??= []).push(id);
      }
      return { positions, columns };
    }, edges);

  // 1 — the spine. Five scenes in a row, each leading to the next: every
  // one a column further right, all on one line, so every connection is
  // horizontal. This is the shape most of a first draft is.
  let r = await layout([["a", "b"], ["b", "c"], ["c", "d"], ["d", "e"]]);
  const spineY = new Set(Object.values(r.positions).map((p) => p.y));
  const spineX = Object.values(r.positions)
    .map((p) => p.x)
    .sort((m, n) => m - n);
  check("a straight run of scenes comes out as a straight line",
    spineY.size === 1, JSON.stringify(r.positions));
  check("...one column apart, in order",
    spineX.length === 5 && spineX.every((x, i) => i === 0 || x > spineX[i - 1]),
    JSON.stringify(spineX));

  // 2 — the reported shape. One scene with three choices, whose branches
  // are of three different lengths and then merge. The three options are
  // one moment in the story, so they belong in one column; the old ranking
  // spread them across three so that each branch could meet the merge
  // without a long edge.
  r = await layout([
    ["open", "short"], ["open", "middle"], ["open", "long"],
    ["middle", "middle2"],
    ["long", "long2"], ["long2", "long3"],
    ["short", "end"], ["middle2", "end"], ["long3", "end"],
  ]);
  const optionColumn = new Set([r.positions.short.x, r.positions.middle.x, r.positions.long.x]);
  check("every choice out of one scene lands in the same column",
    optionColumn.size === 1,
    `short ${r.positions.short.x}, middle ${r.positions.middle.x}, long ${r.positions.long.x}`);
  check("...one column past the scene they are choices in",
    [...optionColumn][0] > r.positions.open.x,
    `open at ${r.positions.open.x}, options at ${[...optionColumn][0]}`);
  check("...and the merge they all reach is the last column",
    Object.values(r.positions).every((p) => p.x <= r.positions.end.x),
    JSON.stringify(Object.fromEntries(Object.entries(r.positions).map(([k, v]) => [k, v.x]))));
  // The branch that takes three scenes to get there is what forces the
  // columns apart; without it the case above could pass on any ranking.
  check("a longer branch reaches further right than a shorter one — the control",
    r.positions.long3.x > r.positions.middle2.x && r.positions.middle2.x > r.positions.short.x,
    `${r.positions.short.x} / ${r.positions.middle2.x} / ${r.positions.long3.x}`);

  // 3 — the straightening rule and its limit. Each branch here runs on
  // from a single feeder, so each must be horizontal; the merge has three
  // feeders on three different lines and must NOT snap onto one of them,
  // because a merge that picks a side lies about the other two.
  check("a branch scene sits on the line of the scene that led to it",
    r.positions.long2.y === r.positions.long.y &&
      r.positions.long3.y === r.positions.long.y &&
      r.positions.middle2.y === r.positions.middle.y,
    `long ${r.positions.long.y} → ${r.positions.long2.y} → ${r.positions.long3.y}, ` +
      `middle ${r.positions.middle.y} → ${r.positions.middle2.y}`);
  const branchLines = [r.positions.short.y, r.positions.middle2.y, r.positions.long3.y];
  check("...but a merge stays between the branches it merges",
    r.positions.end.y > Math.min(...branchLines) && r.positions.end.y < Math.max(...branchLines),
    `end at ${r.positions.end.y}, branches at ${JSON.stringify(branchLines)}`);

  // 3b — the shape the straightening pass actually exists for, and the
  // one that made the report: a spine where each scene ALSO links ahead
  // past the next one ("read the book, or skip straight to the table").
  // Every scene has one column of its own, so there is nothing for dagre's
  // median rule to weigh, and it hangs each card off the connections
  // passing through that column instead — 216, 180, 234, 216, a zig-zag
  // down a line of four. Their feeders are all on one line, so all four
  // belong on it. (Confirmed by removing the pass: this is the check that
  // goes red, and the branchy cases above do not.)
  r = await layout([
    ["open", "book"], ["open", "coin"],
    ["book", "coin"], ["book", "table"],
    ["coin", "table"],
  ]);
  const spineLines = new Set(["open", "book", "coin", "table"].map((id) => r.positions[id].y));
  check("a spine whose scenes also link ahead still comes out as one line",
    spineLines.size === 1,
    JSON.stringify(Object.fromEntries(["open", "book", "coin", "table"].map((id) => [id, r.positions[id].y]))));

  // 4 — a loop. A story that sends the reader back has no "depth" for the
  // scenes inside the loop, and the ranking has to survive that rather than
  // hang or drop them: every scene still gets a place.
  r = await layout([["a", "b"], ["b", "c"], ["c", "b"], ["c", "d"]]);
  check("a story that loops back still lays out, with every scene placed",
    ["a", "b", "c", "d"].every((id) => Number.isFinite(r.positions[id]?.x)),
    JSON.stringify(r.positions));

  // 5 — and the whole thing lands on the canvas grid, which v0.42.0 asked
  // for and this release's rewrite could quietly have broken.
  const off = Object.entries(r.positions).filter(([, p]) => p.x % 18 !== 0 || p.y % 18 !== 0);
  check("every laid-out scene is still on the grid", off.length === 0, JSON.stringify(off));

  await seedProject();
  await wait(300);
}
