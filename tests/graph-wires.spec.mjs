/**
 * How a connection is drawn (v0.73.0).
 *
 * Reported as "they overlap too much and it is almost impossible to read
 * which node is connected to which", and the investigation turned three
 * separate facts up, each of which is a rule here:
 *
 *   1. Every exit left from the same pixel. Four choices out of one scene
 *      were, for their first stretch, the same line — and no routing
 *      separates two lines that begin at the same place.
 *   2. Once a chapter ran DOWN the page, a wire still left SIDEWAYS, swung
 *      out and came back, so for its first forty pixels it pointed at the
 *      wrong scene.
 *   3. A wire passed underneath cards it had nothing to do with, which is
 *      the worst of the three: a line crossing a scene looks like it ends
 *      there.
 *
 * Everything below is measured off the real anchor model and the real
 * router rather than off a picture, because a picture cannot tell you
 * whether a wire passes through a card or merely near one.
 */
export default async function ({ page, api, check, seedProject }) {
  await seedProject();

  const W = 180;
  const H = 56;
  const card = (id, x, y) => ({ id, x, y, width: W, height: H });

  // ── 1. one anchor per choice ──────────────────────────────────────────
  let r = await api(() => {
    const { wireEnds } = window.__scriareWires;
    const boxes = [
      { id: "hub", x: 0, y: 0, width: 180, height: 56 },
      { id: "a", x: 400, y: -120, width: 180, height: 56 },
      { id: "b", x: 400, y: 0, width: 180, height: 56 },
      { id: "c", x: 400, y: 120, width: 180, height: 56 },
    ];
    const ends = wireEnds(boxes, [
      { id: "1", source: "hub", target: "a", ordinal: 1 },
      { id: "2", source: "hub", target: "b", ordinal: 2 },
      { id: "3", source: "hub", target: "c", ordinal: 3 },
    ]);
    return ends.map((e) => ({ id: e.link.id, p1: e.p1, side: e.p1.side }));
  });
  const starts = new Set(r.map((e) => `${e.p1.x},${e.p1.y}`));
  check("three choices out of one scene leave from three different points",
    starts.size === 3, [...starts].join("  "));

  check("...in the order they were written, top to bottom",
    r[0].p1.y < r[1].p1.y && r[1].p1.y < r[2].p1.y,
    r.map((e) => `${e.id}@${e.p1.y}`).join(" "));

  // The spacing is a constant of the design, not a function of how many
  // choices a scene happens to have. Spread at even fractions instead, a
  // card with two exits spaces them one way and a card with four another,
  // so two neighbouring scenes hand their wires out on different rhythms
  // and the lanes between them never line up. (The earlier claim here —
  // that fractions cost you the centre line — was wrong, and its negative
  // control is what said so. See wireAnchors.ts.)
  const gaps = await api(() => {
    const { anchorAt } = window.__scriareWires;
    const box = { id: "x", x: 0, y: 0, width: 180, height: 56 };
    const spacing = (n) => anchorAt(box, "right", 1, n).y - anchorAt(box, "right", 0, n).y;
    return { two: spacing(2), three: spacing(3), four: spacing(4) };
  });
  check("two exits and four exits are spaced on the same pitch",
    gaps.two === gaps.three && gaps.three === gaps.four,
    `2 → ${gaps.two}px, 3 → ${gaps.three}px, 4 → ${gaps.four}px`);

  // ...and that pitch is the canvas's own dot field, halved across a
  // card's short edge, so a wire leaves on the lattice it will travel on.
  check("...and the pitch is the grid the cards themselves snap to",
    gaps.two === 9, `${gaps.two}px against the canvas grid's 18`);

  // ── 2. a wire leaves the side it is going to ─────────────────────────
  r = await api(() => {
    const { wireEnds } = window.__scriareWires;
    const boxes = [
      { id: "top", x: 0, y: 0, width: 180, height: 56 },
      { id: "below", x: 0, y: 200, width: 180, height: 56 },
      { id: "right", x: 400, y: 0, width: 180, height: 56 },
      { id: "back", x: -400, y: 0, width: 180, height: 56 },
    ];
    const ends = wireEnds(boxes, [
      { id: "down", source: "top", target: "below", ordinal: 1 },
      { id: "across", source: "top", target: "right", ordinal: 2 },
      { id: "backwards", source: "top", target: "back", ordinal: 3 },
    ]);
    return Object.fromEntries(ends.map((e) => [e.link.id, { out: e.p1.side, in: e.p2.side }]));
  });
  check("a wire to the scene BELOW leaves the bottom and lands on the top",
    r.down.out === "bottom" && r.down.in === "top", JSON.stringify(r.down));
  check("a wire to the scene BESIDE leaves the right and lands on the left",
    r.across.out === "right" && r.across.in === "left", JSON.stringify(r.across));
  check("a wire that goes BACK leaves the left, because that is where it goes",
    r.backwards.out === "left" && r.backwards.in === "right", JSON.stringify(r.backwards));

  // ── 3. nothing routes through a card ─────────────────────────────────
  //
  // A column of five, with the first linked to the last: the straight line
  // between them runs through three scenes, so the router has to leave the
  // column and come back.
  r = await api(() => {
    const { routeWires } = window.__scriareWires;
    const boxes = [];
    for (let i = 0; i < 5; i += 1) {
      boxes.push({ id: `s${i}`, x: 0, y: i * 150, width: 180, height: 56 });
    }
    const result = routeWires(boxes, [
      { id: "skip", source: "s0", target: "s4", ordinal: 1 },
      { id: "step", source: "s0", target: "s1", ordinal: 2 },
    ]);
    return {
      paths: Object.fromEntries(result.paths),
      stats: result.stats,
      boxes,
    };
  });

  /** Does an SVG path's straight runs pass through any box it doesn't touch? */
  const throughCards = (d, boxes, from, to) => {
    // The path is M/L/Q only; sampling the anchor points of each command is
    // enough because every run between them is axis-aligned.
    const nums = d.match(/-?\d+(\.\d+)?/g).map(Number);
    const pts = [];
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: nums[i], y: nums[i + 1] });
    return boxes.filter((b) => {
      if (b.id === from || b.id === to) return false;
      for (let i = 0; i < pts.length - 1; i += 1) {
        const a = pts[i];
        const c = pts[i + 1];
        if (
          Math.max(a.x, c.x) > b.x + 1 &&
          Math.min(a.x, c.x) < b.x + b.width - 1 &&
          Math.max(a.y, c.y) > b.y + 1 &&
          Math.min(a.y, c.y) < b.y + b.height - 1
        ) {
          return true;
        }
      }
      return false;
    }).map((b) => b.id);
  };

  check("the router placed both wires", r.stats.failed === 0, JSON.stringify(r.stats));
  const hit = throughCards(r.paths.skip, r.boxes, "s0", "s4");
  check("a wire that skips three scenes goes AROUND them, not through",
    hit.length === 0, hit.length ? `through ${hit.join(", ")}` : "clear of every card");

  // The control for that one: the straight line it could have taken DOES
  // cross all three, so "clear" is a fact about the route rather than about
  // the column being empty.
  r = await api(() => {
    const boxes = [];
    for (let i = 0; i < 5; i += 1) {
      boxes.push({ id: `s${i}`, x: 0, y: i * 150, width: 180, height: 56 });
    }
    return { boxes };
  });
  const naive = throughCards("M 90 56 L 90 600", r.boxes, "s0", "s4");
  check("...and the straight line between them would have crossed three",
    naive.length === 3, naive.join(", "));

  // ── 4. the honest limit ───────────────────────────────────────────────
  //
  // Measured, not assumed: the obstacle-aware router is ~0.1s at 32 scenes
  // and 39 SECONDS at a thousand, so past a threshold the cheap one runs
  // instead. The threshold has to be a real switch, not a comment.
  r = await api(() => {
    const { routeWires, BOARD_ABOVE } = window.__scriareWires;
    const make = (n) => {
      const boxes = [];
      const links = [];
      for (let i = 0; i < n; i += 1) {
        boxes.push({ id: `s${i}`, x: (i % 20) * 260, y: Math.floor(i / 20) * 150, width: 180, height: 56 });
        if (i) links.push({ id: `l${i}`, source: `s${i - 1}`, target: `s${i}`, ordinal: 1 });
      }
      return { boxes, links };
    };
    const small = make(BOARD_ABOVE - 10);
    const big = make(BOARD_ABOVE + 10);
    return {
      limit: BOARD_ABOVE,
      small: routeWires(small.boxes, small.links).stats.mode,
      big: routeWires(big.boxes, big.links).stats.mode,
    };
  });
  check("a story this size gets the router that knows what is in the way",
    r.small === "aware", `${r.limit - 10} boxes → ${r.small}`);
  check("...and a story too big for it gets the cheap one rather than a freeze",
    r.big === "board", `${r.limit + 10} boxes → ${r.big}`);

  // ── 5. a wire it cannot place is not drawn wrongly ────────────────────
  //
  // The version before this one had a give-up path that drew the wire
  // anyway, unchecked, and that is how a connection ended up running under
  // two scenes. A route that cannot be found must come back as nothing, so
  // the graph falls back to the old curve.
  r = await api(() => {
    const { routeWires } = window.__scriareWires;
    // A target walled in on every side by cards touching each other.
    const boxes = [
      { id: "from", x: 0, y: 0, width: 180, height: 56 },
      { id: "to", x: 1000, y: 1000, width: 180, height: 56 },
    ];
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        if (!dx && !dy) continue;
        boxes.push({
          id: `wall${dx}${dy}`,
          x: 1000 + dx * 180,
          y: 1000 + dy * 56,
          width: 180,
          height: 56,
        });
      }
    }
    const result = routeWires(boxes, [{ id: "in", source: "from", target: "to", ordinal: 1 }]);
    return { has: result.paths.has("in"), failed: result.stats.failed };
  });
  check("a wire with nowhere to go comes back with no path at all",
    r.has === false && r.failed === 1,
    `path: ${r.has}, failed: ${r.failed}`);

  // ── 6. select a scene, and the rest of the story gets out of the way ──
  //
  // The cheapest part of the answer and possibly the most effective, and
  // the only part that is not geometry at all. Driven by clicking, because
  // the thing under test is what happens when a person picks a scene.
  await api(() => {
    const { buildChoiceBlockNode } = window.__scriareChoiceUtils;
    const store = window.__scriareProjectStore;
    const now = new Date().toISOString();
    const scene = (id, title, x, y, order, content) => ({
      id, title, position: { x, y }, order, content: { type: "doc", content },
    });
    store.setState({
      project: {
        name: "Dim", createdAt: now, updatedAt: now,
        scenes: [
          scene("near", "Near", 0, 0, 0, [
            buildChoiceBlockNode([{ id: "c1", text: "Go on", targetSceneId: "next" }], "b1"),
          ]),
          scene("next", "Next", 420, 0, 1, [
            { type: "paragraph", content: [{ type: "text", text: "here" }] },
          ]),
          scene("far", "Far", 420, 300, 2, [
            { type: "paragraph", content: [{ type: "text", text: "elsewhere" }] },
          ]),
        ],
        content: ["near", "next", "far"].map((id, i) => ({
          id, kind: "leaf", category: "story", parentId: null, order: i, refType: "scene",
        })),
        entities: [], favorites: [], variables: [], startSceneId: "near",
      },
      filePath: null, selectedSceneId: null, saveStatus: "saved", isPlaying: false,
      canUndo: false, canRedo: false, undoLabel: null, redoLabel: null, undoToken: null,
    });
  });
  await page.waitForTimeout(500);

  const opacities = () =>
    page.evaluate(() =>
      Object.fromEntries(
        [...document.querySelectorAll(".scriare-scene-card")].map((card) => [
          // The title is the first line of the card; the badges below it
          // run together in textContent, so read the title element itself.
          card.querySelector(".truncate")?.textContent ?? "?",
          Number(getComputedStyle(card).opacity),
        ]),
      ),
    );

  const before = await opacities();
  check("nothing is dimmed until something is selected — the control",
    Object.values(before).every((o) => o === 1), JSON.stringify(before));

  const nearBox = await page.evaluate(() => {
    const card = [...document.querySelectorAll(".scriare-scene-card")].find((c) =>
      c.textContent.startsWith("Near"),
    );
    const r = card.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.click(nearBox.x, nearBox.y);
  await page.waitForTimeout(400);

  const after = await opacities();
  check("selecting a scene keeps it and what it leads to at full strength",
    after.Near === 1 && after.Next === 1, JSON.stringify(after));
  check("...and fades the scene it has nothing to do with",
    after.Far !== undefined && after.Far < 0.5, `Far at ${after.Far}`);
  check("...without hiding it — the rest of the story is still there",
    after.Far > 0, `Far at ${after.Far}`);

  // ── 7. a wire follows the card you are holding ────────────────────────
  //
  // Reported the day this shipped: picking a scene up turned its wires
  // back into curves for the duration of the drag, because the full router
  // costs a tenth of a second and cannot run sixty times a second. True,
  // and the wrong conclusion — a drag gets the CHEAP router rather than no
  // router at all.
  //
  // Asserted as "the start point moved with the card" rather than as "it
  // is not a curve", because a STALE path is a straight line too and is
  // just as wrong. This catches the curve, the stale path, and no path.
  const firstPoint = () =>
    page.evaluate(() => {
      const path = [...document.querySelectorAll(".react-flow__edge-path")][0];
      if (!path) return null;
      const d = path.getAttribute("d") || "";
      const m = d.match(/M\s*(-?[\d.]+)[,\s]+(-?[\d.]+)/);
      return m ? { x: Number(m[1]), y: Number(m[2]), curved: d.includes("C") } : null;
    });

  const atRest = await firstPoint();
  check("the one wire is drawn as a line to begin with — the control",
    atRest !== null && atRest.curved === false, JSON.stringify(atRest));

  const grab = await page.evaluate(() => {
    const card = [...document.querySelectorAll(".scriare-scene-card")].find((c) =>
      c.textContent.startsWith("Near"),
    );
    const r = card.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i += 1) {
    await page.mouse.move(grab.x - i * 10, grab.y + i * 6);
    await page.waitForTimeout(16);
  }
  const held = await firstPoint();
  await page.mouse.up();
  await page.waitForTimeout(400);

  check("while the card is held, its wire is still a line",
    held !== null && held.curved === false, JSON.stringify(held));
  check("...and it followed the card rather than staying where it was",
    held !== null && atRest !== null && held.x < atRest.x - 20 && held.y > atRest.y + 10,
    `${JSON.stringify(atRest)} → ${JSON.stringify(held)}`);

  // And it is affordable, which is the reason the first version did not
  // do it at all: the cheap router over one busy card's wires, sixty
  // times, on a story the size of a real one.
  const cost = await api(() => {
    const boxes = [];
    const links = [];
    for (let i = 0; i < 32; i += 1) {
      boxes.push({ id: `s${i}`, x: (i % 6) * 280, y: Math.floor(i / 6) * 150, width: 180, height: 56 });
    }
    for (let i = 0; i < 32; i += 1) {
      for (let k = 1; k <= 2; k += 1) {
        const t = (i + k) % 32;
        if (t !== i) links.push({ id: `l${i}-${k}`, source: `s${i}`, target: `s${t}`, ordinal: k });
      }
    }
    const affected = new Set(
      links.filter((l) => l.source === "s7" || l.target === "s7").map((l) => l.id),
    );
    const t0 = performance.now();
    for (let i = 0; i < 60; i += 1) window.__scriareWires.routeDragged(boxes, links, affected);
    return { wires: affected.size, perFrame: +((performance.now() - t0) / 60).toFixed(2) };
  });
  check("a drag frame costs a fraction of one",
    cost.perFrame < 8, `${cost.wires} wires moving, ${cost.perFrame}ms per frame`);

  await seedProject();
}
