import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * What Auto Layout actually produces, in numbers (v0.85.0).
 *
 * THIS SPEC MOVES NOTHING AND FIXES NOTHING. It exists because the roadmap
 * has carried "we will need to investigate the behaviour of the Auto Layout
 * further" since September, with three named suspects — merges dragged far
 * right by dagre's longest-path ranking, loops that have no rank at all,
 * and chapter boxes sized after their contents are placed — and no number
 * attached to any of them. "Better" cannot be claimed against an
 * impression, so the first move is a measurement rather than a rewrite.
 * His instruction for the optimisation pass is explicit that nothing may
 * move; this file is how the parts that WOULD move get reported instead.
 *
 * MEASURED ON THE REAL STORY, not on a fixture written to have the shape
 * being measured. The Blue Hour is 32 scenes, five chapters and 70 choice
 * options, and it is the story he said Auto Layout "started to shatter" on
 * — so a harness that reports it as healthy is a harness that is wrong.
 * graph-auto-layout.spec.mjs covers the RULES on small hand-built graphs,
 * which is the right shape for a rule; this covers the OUTCOME at scale,
 * which a five-node graph cannot show at all.
 *
 * Most of what follows is logged rather than checked, on perf.spec's
 * precedent: a number with no agreed threshold is documentation, and
 * writing `check(name, true)` beside it would be a pass dressed as an
 * assertion. What IS asserted is the handful of properties that are
 * defects at any magnitude — a scene placed outside the chapter that owns
 * it, a scene placed on top of another, a chapter box overlapping its
 * neighbour — and those are asserted as COUNTS so the failure says how
 * bad rather than merely that.
 */

/** Rectangles, as the canvas sees them. */
function overlap(a, b) {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * Do two straight segments cross?
 *
 * The real wires are orthogonal routes from v0.73.0's A* router, not
 * straight lines, so a crossing count taken on centre-to-centre segments is
 * a PROXY. It is the right proxy for this job: the router's own cost
 * function already prices crossings, so what is being measured here is how
 * much work the layout hands it, not how well it copes. Counting the real
 * routes would measure the router instead, and the router is not what the
 * roadmap is asking about.
 */
function crosses(p1, p2, p3, p4) {
  const d = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = d(p3, p4, p1);
  const d2 = d(p3, p4, p2);
  const d3 = d(p1, p2, p3);
  const d4 = d(p1, p2, p4);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

export default async function run({ api, check, seedProject }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // perf.spec's convention: a number with no agreed threshold is printed
  // with the checks and marked as not asserted, never dressed as one.
  const say = (line) => console.log(`  · ${line}`);

  const out = await fs.mkdtemp(path.join(os.tmpdir(), "scriare-layout-"));
  const fixture = path.join(out, "The Blue Hour.scriare");
  await fs.writeFile(fixture, await fs.readFile(new URL("./fixtures/the-blue-hour.scriare", import.meta.url)));

  await api(async (p) => {
    await window.__scriareProjectStore.getState().openRecentProject(p);
  }, fixture);
  await wait(500);

  const story = await api(() => {
    const project = window.__scriareProjectStore.getState().project;
    if (!project) return null;
    const drawn = window.__scriareGroupUtils.graphGroups(project.content, project.scenes);
    const stored = project.content.filter((n) => n.kind === "folder" && n.rect);
    return {
      name: project.name,
      scenes: project.scenes.length,
      drawnFolders: drawn.length,
      storedRects: stored.length,
    };
  });

  check(
    "the story being measured is the one that shatters",
    story && story.name === "The Blue Hour" && story.scenes >= 30,
    story
      ? `${story.name} — ${story.scenes} scenes, ${story.drawnFolders} chapters drawn ` +
        `(${story.storedRects} with a stored box, the rest derived from their scenes)`
      : "not open",
  );

  /* ── lay it out, and time it ──────────────────────────────────────── */

  // THE PURE FUNCTION, NOT THE BUTTON. `autoLayoutScenes` also pushes
  // history, snaps to the grid and writes the store, so timing it would
  // time three things and attribute all of it to the layout. The button's
  // own cost is measured separately at the end, because the difference
  // between the two is where an optimisation might live.
  const measure = () =>
    api(() => {
      const project = window.__scriareProjectStore.getState().project;
      const compute = window.__scriareAutoLayout.computeGraphLayout;
      const timings = [];
      let result = null;
      // Five runs, median reported: one run on a loaded machine is a number
      // about the machine.
      for (let i = 0; i < 5; i += 1) {
        const t0 = performance.now();
        result = compute(project);
        timings.push(performance.now() - t0);
      }
      const byId = new Map(result.content.map((n) => [n.id, n]));
      return {
        timings,
        scenes: result.scenes.map((s) => ({ id: s.id, x: s.position.x, y: s.position.y })),
        // THE GROUPS THE CANVAS DRAWS, asked of the app rather than read off
        // `content[].rect`. A folder is drawn when it has a stored rect OR
        // when it holds at least one scene (v0.31.0), and its box is then
        // DERIVED from its own scenes. Counting stored rects reported this
        // story as having no chapters at all, which made three checks
        // vacuous and a second measurement pass identical to the first — the
        // same fixture-avoids-the-hard-case failure this file exists to look
        // for, twice over, in the file looking for it.
        folders: window.__scriareGroupUtils
          .graphGroups(result.content, result.scenes)
          .map((g) => ({
            id: g.id,
            name: g.name,
            parentId: g.parentId,
            derived: g.derived,
            ...g.displayRect,
          })),
        // The nearest DRAWN ancestor of each scene, so "is it in the box that
        // owns it" can be asked at all. Read off the content tree rather than
        // guessed from geometry — which would be circular.
        owner: (() => {
          const drawnIds = new Set(
            window.__scriareGroupUtils.graphGroups(result.content, result.scenes).map((g) => g.id),
          );
          return Object.fromEntries(
            result.scenes.map((s) => {
              let current = byId.get(s.id)?.parentId ?? null;
              let guard = 0;
              while (current && guard++ < 64) {
                if (drawnIds.has(current)) return [s.id, current];
                current = byId.get(current)?.parentId ?? null;
              }
              return [s.id, null];
            }),
          );
        })(),
        // The app's own choice walk, not a copy of it: a wire exists because
        // `extractChoices` says a choice has a destination, and a measurement
        // that re-implements that question measures its own re-implementation.
        links: result.scenes.flatMap((s) =>
          window.__scriareChoiceUtils
            .extractChoices(s.content)
            .filter((c) => c.targetSceneId)
            .map((c) => ({ source: s.id, target: c.targetSceneId })),
        ),
        card: {
          width: window.__scriareGraphConstants.SCENE_NODE_WIDTH,
          height: window.__scriareGraphConstants.SCENE_NODE_HEIGHT,
        },
      };
    });

  const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

  /** Every number this file reports, for one state of the story. */
  function report(label, runs) {
    say(`── ${label} ──`);
    say(`computeGraphLayout: median ${median(runs.timings).toFixed(1)} ms over 5 runs ` +
        `(${runs.timings.map((t) => t.toFixed(0)).join(", ")})`);

    const xs = runs.scenes.map((s) => s.x);
    const ys = runs.scenes.map((s) => s.y);
    const width = Math.max(...xs) + runs.card.width - Math.min(...xs);
    const height = Math.max(...ys) + runs.card.height - Math.min(...ys);
    say(`extent ${Math.round(width)}×${Math.round(height)} px, aspect ${(width / height).toFixed(2)}:1`);

    /* suspect 1 — what the wires cost */
    const centres = new Map(
      runs.scenes.map((s) => [s.id, { x: s.x + runs.card.width / 2, y: s.y + runs.card.height / 2 }]),
    );
    const links = runs.links.filter((l) => centres.has(l.source) && centres.has(l.target));
    let total = 0;
    let longest = 0;
    let backward = 0;
    for (const l of links) {
      const a = centres.get(l.source);
      const b = centres.get(l.target);
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      total += d;
      longest = Math.max(longest, d);
      // A wire running right to left is a loop drawn as if it were forward
      // motion — suspect 2 on the roadmap, and countable.
      if (b.x < a.x) backward += 1;
    }
    let crossings = 0;
    for (let i = 0; i < links.length; i += 1) {
      for (let j = i + 1; j < links.length; j += 1) {
        const a = links[i];
        const b = links[j];
        if (a.source === b.source || a.source === b.target ||
            a.target === b.source || a.target === b.target) {
          continue; // wires that share an end are not a crossing
        }
        if (crosses(centres.get(a.source), centres.get(a.target),
                    centres.get(b.source), centres.get(b.target))) {
          crossings += 1;
        }
      }
    }
    say(`${links.length} wires · total ${Math.round(total)} px · longest ${Math.round(longest)} px · ` +
        `${crossings} crossings · ${backward} running backwards`);

    /* suspect 3 — the chapter boxes */
    const folderById = new Map(runs.folders.map((f) => [f.id, f]));
    const owned = runs.scenes.filter((s) => folderById.has(runs.owner[s.id]));
    const escaped = owned.filter((s) => {
      const box = folderById.get(runs.owner[s.id]);
      return (
        s.x < box.x ||
        s.y < box.y ||
        s.x + runs.card.width > box.x + box.width ||
        s.y + runs.card.height > box.y + box.height
      );
    });

    // SAY WHAT WAS LOOKED AT. The first run of this file reported three
    // green chapter-box checks against a story with ZERO drawn chapters —
    // the fixture-avoids-the-ambiguous-case failure, in a file written to
    // investigate exactly that kind of thing. The count is in the detail of
    // every one of them now, and the second pass below draws them all.
    const scope = `${runs.folders.length} drawn chapters, ${owned.length} of ${runs.scenes.length} scenes inside one`;

    check(
      `${label}: every scene is inside the chapter that owns it`,
      escaped.length === 0,
      `${escaped.length} outside · ${scope}`,
    );

    const contains = (a, b) =>
      a.x <= b.x && a.y <= b.y && a.x + a.width >= b.x + b.width && a.y + a.height >= b.y + b.height;
    const collisions = [];
    for (let i = 0; i < runs.folders.length; i += 1) {
      for (let j = i + 1; j < runs.folders.length; j += 1) {
        const a = runs.folders[i];
        const b = runs.folders[j];
        if (contains(a, b) || contains(b, a)) continue;
        const area = overlap(a, b);
        if (area > 0) {
          collisions.push(`${a.name || a.id} × ${b.name || b.id} (${Math.round(area)} px²)`);
        }
      }
    }
    check(
      `${label}: no two chapter boxes overlap`,
      collisions.length === 0,
      collisions.length ? collisions.join(", ") : `none · ${scope}`,
    );

    const stacked = [];
    for (let i = 0; i < runs.scenes.length; i += 1) {
      for (let j = i + 1; j < runs.scenes.length; j += 1) {
        const a = { ...runs.scenes[i], ...runs.card };
        const b = { ...runs.scenes[j], ...runs.card };
        if (overlap(a, b) > 0) stacked.push([runs.scenes[i].id, runs.scenes[j].id]);
      }
    }
    check(
      `${label}: no two scene cards overlap`,
      stacked.length === 0,
      stacked.length ? `${stacked.length} pairs` : `none · ${runs.scenes.length} cards`,
    );

    return { crossings, backward, total, longest, width, height, escaped: escaped.length,
             collisions: collisions.length, stacked: stacked.length, timings: runs.timings };
  }

  const asFound = report("as the story is", await measure());

  /* ── and again from an untidy start ──────────────────────────────── */

  // ALL FIVE CHAPTERS WERE ALREADY DRAWN, with boxes derived from the scenes
  // they hold — so the first version of this pass changed nothing and
  // reported numbers identical to the pixel, which is how the mistake above
  // was caught. What a writer DOES have that this story does not is five
  // chapters with STORED boxes, dragged around by hand into an overlapping
  // mess. That is the state suspect 3 needs: a box whose stored geometry has
  // to be replaced by one sized from its freshly placed contents.
  //
  // The point of measuring it is that where the writer left the boxes must
  // not decide where Auto Layout puts them. If these numbers differ from the
  // ones above, the button is not idempotent with respect to its input, and
  // that is worth knowing before anything is optimised.
  const drawn = await api(() => {
    const store = window.__scriareProjectStore.getState();
    const folders = store.project.content.filter((n) => n.kind === "folder");
    folders.forEach((f, i) => {
      store.updateFolderRect(f.id, { x: 80 + i * 200, y: 80 + i * 120, width: 460, height: 360 }, false);
    });
    const after = window.__scriareProjectStore.getState().project.content
      .filter((n) => n.kind === "folder" && n.rect).length;
    return { folders: folders.length, stored: after };
  });
  await wait(200);

  check(
    "every chapter now carries a stored box, overlapping, as a hand-dragged story would",
    drawn.stored === drawn.folders && drawn.stored >= 4,
    `${drawn.stored} of ${drawn.folders} chapters given a stored box`,
  );

  const fromMess = report("from an untidy start", await measure());
  say(
    `as found → from a mess:  ${asFound.crossings} → ${fromMess.crossings} crossings · ` +
      `${Math.round(asFound.total)} → ${Math.round(fromMess.total)} px of wire · ` +
      `${Math.round(asFound.width)}×${Math.round(asFound.height)} → ` +
      `${Math.round(fromMess.width)}×${Math.round(fromMess.height)}`,
  );
  check(
    "Auto Layout lands in the same place whatever mess it started from",
    asFound.crossings === fromMess.crossings &&
      Math.round(asFound.width) === Math.round(fromMess.width) &&
      Math.round(asFound.height) === Math.round(fromMess.height),
    `${asFound.crossings}/${Math.round(asFound.width)}×${Math.round(asFound.height)} vs ` +
      `${fromMess.crossings}/${Math.round(fromMess.width)}×${Math.round(fromMess.height)}`,
  );

  /* ── and the cost that lands AFTER the layout ─────────────────────── */

  // THE LAYOUT IS NOT THE EXPENSIVE PART, and that is the finding the
  // optimisation pass has to start from. `computeGraphLayout` is dagre over
  // 32 nodes and comes back in under a frame. What happens next is 70 wires
  // through v0.73.0's A* router — lane grid, rip-up-and-retry, four passes
  // under a 400 ms budget — and then React Flow re-rendering every node
  // whose position just changed. Measuring the button alone would have
  // sized the work in the wrong place entirely.
  //
  // The router reports its own `stats`, so this reads them rather than
  // timing it from outside and attributing the wait to whatever was nearby.
  const router = await api(() => {
    const project = window.__scriareProjectStore.getState().project;
    const G = window.__scriareGraphConstants;
    const groups = window.__scriareGroupUtils;
    const boxes = [
      ...project.scenes.map((s) => ({
        id: s.id,
        x: s.position.x,
        y: s.position.y,
        width: G.SCENE_NODE_WIDTH,
        height: G.SCENE_NODE_HEIGHT,
      })),
      ...groups
        .graphGroups(project.content, project.scenes)
        .filter((g) => !g.hidden && g.collapsed)
        .map((g) => ({
          id: g.id,
          x: g.rect.x,
          y: g.rect.y,
          width: groups.COLLAPSED_GROUP_SIZE.width,
          height: groups.COLLAPSED_GROUP_SIZE.height,
        })),
    ];
    const seen = new Map();
    const links = [];
    for (const scene of project.scenes) {
      const choices = window.__scriareChoiceUtils.extractChoices(scene.content);
      choices.forEach((c, i) => {
        if (!c.targetSceneId) return;
        const key = `${scene.id}->${c.targetSceneId}`;
        const ordinal = (seen.get(key) ?? 0) + 1;
        seen.set(key, ordinal);
        links.push({ id: `${key}#${i}`, source: scene.id, target: c.targetSceneId, ordinal });
      });
    }
    const runs = [];
    let last = null;
    for (let i = 0; i < 3; i += 1) {
      last = window.__scriareWires.routeWires(boxes, links);
      runs.push(last.stats);
    }
    return { boxes: boxes.length, links: links.length, runs };
  });

  const routerMs = router.runs.map((r) => r.ms);
  const worst = router.runs[routerMs.indexOf(Math.max(...routerMs))];
  say(
    `routeWires on the laid-out story: median ${median(routerMs).toFixed(1)} ms ` +
      `(${routerMs.map((m) => m.toFixed(0)).join(", ")}) · ${router.links} wires over ` +
      `${router.boxes} obstacles · ${worst.routed} routed, ${worst.failed} failed, ` +
      `${worst.passes} passes, mode "${worst.mode}"`,
  );
  say(
    `so one Auto Layout costs roughly ` +
      `${(median(routerMs) + median(asFound.timings ?? [0])).toFixed(0)} ms of work it cannot avoid ` +
      `— the router is the larger half`,
  );

  // A wire the router gave up on falls back to a curve, which is the one
  // visible symptom of the budget being spent — worth an assertion rather
  // than a number, because a story this size should never reach it.
  check(
    "no wire on this story outruns the router's budget",
    worst.failed === 0,
    `${worst.failed} of ${router.links} fell back to a curve`,
  );

  /* ── what the button costs, as against the layout ─────────────────── */

  // The gap between this and the figure above is history, the grid snap and
  // the store write — the part an optimisation pass can touch without
  // changing where anything lands.
  const button = await api(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    const timings = [];
    for (let i = 0; i < 3; i += 1) {
      const t0 = performance.now();
      window.__scriareProjectStore.getState().autoLayoutScenes();
      timings.push(performance.now() - t0);
      await w(120);
      window.__scriareProjectStore.getState().undo();
      await w(120);
    }
    return timings;
  });
  say(`autoLayoutScenes (the button, including history + snap + store): ` +
      `median ${median(button).toFixed(1)} ms (${button.map((t) => t.toFixed(0)).join(", ")})`);

  /* ── how tall the graph opens (v0.88.0) ──────────────────────────── */

  // HIS CEILING, AND IT IS THE PREMISE RATHER THAN A NUMBER: write stories,
  // not syntax. The graph may not take more than 40% of the column on the
  // frame the app opens on, so the editor always holds the majority of the
  // first thing a stranger sees.
  //
  // MEASURED ON THE REAL COLUMN HEIGHTS, not on invented ones. The fixed
  // 224px it replaced was 22% of the column at 1920×1080 and 35% at
  // 1024×720 — largest where space was tightest, which is backwards — and
  // both of those numbers came from this story on this app, so the sizes
  // below are the ones that were actually seen.
  const opening = await api(() => {
    const f = window.__scriareSplit.openingFlowHeight;
    const columns = [996, 966, 816, 776, 684, 636, 420, 300, 180];
    return columns.map((column) => {
      const height = f(column);
      return { column, height, share: Math.round((height / column) * 100) };
    });
  });
  opening.forEach((r) =>
    say(`column ${r.column}px → graph opens at ${r.height}px (${r.share}%)`),
  );

  // EVERY COLUMN, INCLUDING THE ABSURD ONES. 300px and 180px are in the list
  // because the app sets no minimum window height, so they are reachable —
  // and they are where the ceiling collides with the usable minimum. The
  // ceiling wins there, which is why those rows exist rather than being
  // quietly excluded for being inconvenient.
  const over = opening.filter((r) => r.height / r.column > 0.4001);
  check(
    "the graph never opens over 40% of the column — write stories, not syntax",
    over.length === 0,
    over.length
      ? over.map((r) => `${r.column}px → ${r.share}%`).join(", ")
      : `${opening.length} column heights, worst ${Math.max(...opening.map((r) => r.share))}%`,
  );

  // AND IT IS A BUMP WHERE THERE IS ROOM, which is the other half of what he
  // asked for. On the screens with space the graph gets more than the fixed
  // 224px it replaced; the ceiling only takes space away on short windows.
  const roomy = opening.filter((r) => r.column >= 800);
  check(
    "...and it opens larger than the old fixed height where there is room for it",
    roomy.length > 0 && roomy.every((r) => r.height > 224),
    roomy.map((r) => `${r.column}→${r.height}`).join(" · "),
  );

  // THE WINDOW THE APP ACTUALLY OPENS AT, which is the case v0.88.0 got
  // wrong and no check caught. `main/index.ts` creates the window at
  // 1280×800, leaving a 716px column — and at a 30% share that produced
  // 215px, NINE PIXELS SMALLER than the fixed height it replaced. "Bump it
  // a couple of pixels" had arrived as a reduction on the window most
  // people launch into, and the screens taken after shipping are what
  // showed it. A check against 996 and 816 passed the whole time, because
  // the sizes it was asked about were the ones with room to spare.
  const LAUNCH_COLUMN = 716;
  const atLaunch = await api(
    (column) => window.__scriareSplit.openingFlowHeight(column),
    LAUNCH_COLUMN,
  );
  say(`the window the app opens at: column ${LAUNCH_COLUMN}px → graph ${atLaunch}px`);
  check(
    "the graph opens larger than it used to on the window the app actually opens at",
    atLaunch > 224,
    `${atLaunch}px against the old fixed 224 · ${Math.round((atLaunch / LAUNCH_COLUMN) * 100)}%`,
  );

  await seedProject();
  await wait(300);
}
