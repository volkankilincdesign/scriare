/**
 * The Story Graph's grid (v0.42.0, asked for).
 *
 * "Make the movement, landing and all the resize/location stuff GRID BASED."
 *
 * The grid is 18px, which is the spacing of the canvas's fine dot field, so
 * a snapped card lands on a dot rather than on an invisible lattice. Four
 * things have to obey it, and they arrive by four different routes — a
 * dragged card, a resized box, Auto Layout's output, and any position
 * written straight to the store (paste, an older project file). This file
 * checks each route on its own, because a fix applied only to the drag
 * would leave the other three off the grid and looking like a rendering
 * bug rather than a missing rule.
 *
 * The fifth case is the escape hatch: holding Alt suspends snapping, for
 * the one thing a grid can't do, which is put a card exactly where the
 * grid has no line.
 */
export default async function ({ page, api, check, seedProject }) {
  const GRID = 18;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const seedGraph = () =>
    api(() => {
      const store = window.__scriareProjectStore;
      const now = new Date().toISOString();
      const scene = (id, title, x, y, order) => ({
        id, title, position: { x, y }, order,
        content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: title }] }] },
      });
      store.setState({
        project: {
          name: "Grid", createdAt: now, updatedAt: now,
          scenes: [
            scene("a", "Alpha", 40, 60, 0),
            scene("b", "Beta", 420, 60, 1),
          ],
          content: [
            {
              id: "box", kind: "folder", category: "story", parentId: null, order: 0,
              name: "Chapter", rect: { x: 0, y: 0, width: 360, height: 260 },
            },
            { id: "a", kind: "leaf", category: "story", parentId: "box", order: 1, refType: "scene" },
            { id: "b", kind: "leaf", category: "story", parentId: null, order: 2, refType: "scene" },
          ],
          favorites: [], variables: [], entities: [],
          choiceStyles: window.__scriareChoiceStyles.normalizeChoiceStyles(undefined),
          startSceneId: "a",
        },
        filePath: null, selectedSceneId: "a", selectedEntityId: null, saveStatus: "saved",
        isPlaying: false, canUndo: false, canRedo: false, undoLabel: null, redoLabel: null, undoToken: null,
      });
      window.__scriareSelectionStore?.setState({ graphIds: [] });
    });

  const positionOf = (id) =>
    api((sceneId) => {
      const p = window.__scriareProjectStore.getState().project;
      return p.scenes.find((s) => s.id === sceneId)?.position ?? null;
    }, id);
  const onGrid = (n) => Number.isFinite(n) && n % GRID === 0;

  // 1 — the arithmetic, on its own. A rect is snapped by its CORNERS: round
  // the origin and the size separately and a rounding error at each end can
  // leave the far edge half a cell out, which is the version of this that
  // looks broken when two boxes sit side by side.
  let r = await api(() => {
    const { GRAPH_GRID, snapValue, snapPoint, snapRect } = window.__scriareGraphConstants;
    return {
      grid: GRAPH_GRID,
      near: snapValue(41),
      far: snapValue(-41),
      point: snapPoint({ x: 100, y: 205 }),
      rect: snapRect({ x: 7, y: 11, width: 401, height: 253 }),
      tiny: snapRect({ x: 0, y: 0, width: 2, height: 2 }),
    };
  });
  check("the grid is the dot field's own spacing", r.grid === GRID, `${r.grid}px`);
  check("values round to the nearest line, in both directions",
    r.near === 36 && r.far === -36, `${r.near} / ${r.far}`);
  check("a point lands on the lattice",
    onGrid(r.point.x) && onGrid(r.point.y), JSON.stringify(r.point));
  // Both edges on the grid is necessary but not sufficient: snapping the
  // origin and the SIZE separately also lands on lines, while moving the
  // far edge up to a whole cell away from where it was dragged. The edge a
  // person dragged has to go to the line nearest THEIR edge — here 7+401 =
  // 408, whose nearest line is 414, not the 396 that rounding the size
  // would give. Verified by breaking it: the size-rounding version leaves
  // every edge on the grid and only fails this comparison.
  check("a rect's far edges land on the line nearest where they were dragged",
    r.rect.x === 0 && r.rect.y === 18 &&
      r.rect.x + r.rect.width === 414 && r.rect.y + r.rect.height === 270,
    JSON.stringify(r.rect));
  check("...and a box squeezed below one cell never rounds away to nothing",
    r.tiny.width >= GRID && r.tiny.height >= GRID, JSON.stringify(r.tiny));

  // 2 — a real mouse drag. Driven with Playwright's mouse rather than
  // synthesised events for the reason entities-and-renaming.spec.mjs
  // records: React Flow only believes trusted input, and a synthetic drag
  // reports "nothing moved" from both the assertion and its control.
  await seedGraph();
  await wait(600);
  await api(() => document.querySelector(".react-flow__controls-fitview")?.click());
  await wait(700);

  const grab = await api(() => {
    const el = document.querySelector('.react-flow__node[data-id="b"]');
    if (!el) return null;
    const box = el.getBoundingClientRect();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  });
  check("the loose scene is on screen to drag", grab !== null, JSON.stringify(grab));

  const before = await positionOf("b");
  if (grab) {
    await page.mouse.move(grab.x, grab.y);
    await page.mouse.down();
    // Deliberately odd offsets: a drag that happened to land on a multiple
    // of 18 by itself would pass this test on a build with no snapping.
    for (const step of [13, 27, 41, 53]) {
      await page.mouse.move(grab.x + step, grab.y + step - 7);
      await wait(35);
    }
    // Still held: the card must ALREADY be on a line, not jump there on
    // release. Checked separately from the committed value, because the
    // store snaps on write as well — so without this the drag could feel
    // completely free and every other assertion here would still pass.
    const midDrag = await api(() => {
      const el = document.querySelector('.react-flow__node[data-id="b"]');
      const m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(el?.style.transform ?? "");
      return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
    });
    check("the card steps from cell to cell while the mouse is still down",
      midDrag !== null && onGrid(midDrag.x) && onGrid(midDrag.y), JSON.stringify(midDrag));
    await page.mouse.up();
    await wait(400);
  }
  const after = await positionOf("b");
  check("the drag actually moved the scene — the control for what follows",
    before && after && (before.x !== after.x || before.y !== after.y),
    `${JSON.stringify(before)} → ${JSON.stringify(after)}`);
  check("a dragged scene lands on the grid",
    after && onGrid(after.x) && onGrid(after.y), JSON.stringify(after));

  // 3 — Alt suspends it. Same gesture, same odd offsets; this time the
  // landing must NOT be forced onto a line. (A snapped result here would
  // mean the escape hatch does nothing.)
  const grab2 = await api(() => {
    const el = document.querySelector('.react-flow__node[data-id="b"]');
    const box = el.getBoundingClientRect();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  });
  await page.keyboard.down("Alt");
  await wait(120);
  await page.mouse.move(grab2.x, grab2.y);
  await page.mouse.down();
  for (const step of [9, 19, 31]) {
    await page.mouse.move(grab2.x + step, grab2.y + step + 5);
    await wait(35);
  }
  await page.mouse.up();
  await wait(300);
  await page.keyboard.up("Alt");
  const freeDrop = await api(() => {
    // Read the LIVE React Flow position rather than the stored one: the
    // store snaps every write on purpose (so a pasted or legacy position is
    // corrected too), which means the escape hatch can only be observed
    // where it applies — on the canvas, during and at the end of the drag.
    const el = document.querySelector('.react-flow__node[data-id="b"]');
    const t = el?.style.transform ?? "";
    const m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(t);
    return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
  });
  check("holding Alt lets a card land between the lines",
    freeDrop !== null && !(onGrid(freeDrop.x) && onGrid(freeDrop.y)),
    JSON.stringify(freeDrop));

  // 4 — a resize. Committed through the same door as a move, so the box's
  // corners land on lines even though its handles never did.
  await seedGraph();
  await wait(500);
  await api(() => {
    window.__scriareProjectStore
      .getState()
      .updateFolderRect("box", { x: 7, y: 11, width: 401, height: 253 }, false);
  });
  const rect = await api(() => {
    const p = window.__scriareProjectStore.getState().project;
    return p.content.find((n) => n.id === "box")?.rect ?? null;
  });
  check("a resized box has all four edges on the grid",
    rect && onGrid(rect.x) && onGrid(rect.y) &&
      onGrid(rect.x + rect.width) && onGrid(rect.y + rect.height),
    JSON.stringify(rect));

  // 4b — and the other half of that rule (v0.43.0). Corner-snapping is for
  // a resize only: applied to a MOVE it rounds the origin and the far edge
  // independently, so sliding a box sideways quietly changes its size by up
  // to a cell — a box nobody ever resized drifting a cell per drag, which is
  // how a folded chapter came back the size of the little folded block.
  //
  // The box is given a size that is NOT a whole number of cells first, and
  // that is the whole test rather than setup: when a box's width happens to
  // be a multiple of the grid, both its edges round the same way and corner
  // snapping is indistinguishable from moving. 620x300 is the case that
  // tells them apart.
  const moved = await api(() => {
    const store = window.__scriareProjectStore;
    // snap off, so the odd size survives to be moved.
    store.getState().updateFolderRect("box", { x: 0, y: 0, width: 620, height: 300 }, false, false);
    const was = store.getState().project.content.find((n) => n.id === "box").rect;
    store.getState().updateFolderRect("box", { ...was, x: was.x + 55, y: was.y + 55 }, true);
    const now = store.getState().project.content.find((n) => n.id === "box").rect;
    return { was, now };
  });
  check("moving a box lands it on the grid without resizing it",
    moved.now.width === moved.was.width && moved.now.height === moved.was.height &&
      onGrid(moved.now.x) && onGrid(moved.now.y) &&
      (moved.now.x !== moved.was.x || moved.now.y !== moved.was.y),
    `${JSON.stringify(moved.was)} → ${JSON.stringify(moved.now)}`);

  // 5 — Auto Layout. The tidy pass has to agree with the grid, or the first
  // manual nudge after it looks like it moved something already aligned.
  await seedGraph();
  await wait(500);
  await api(() => window.__scriareProjectStore.getState().autoLayoutScenes());
  await wait(600);
  const laid = await api(() => {
    const p = window.__scriareProjectStore.getState().project;
    return p.scenes.map((s) => s.position);
  });
  check("Auto Layout puts every scene on the grid",
    laid.length > 0 && laid.every((p) => onGrid(p.x) && onGrid(p.y)),
    JSON.stringify(laid));

  // 6 — and a position written straight to the store, which is how a paste
  // or a project file from before the grid arrives.
  await api(() => window.__scriareProjectStore.getState().updateScenePosition("a", { x: 137, y: 249 }));
  const pasted = await positionOf("a");
  check("a position written directly is corrected onto the grid too",
    pasted && onGrid(pasted.x) && onGrid(pasted.y), JSON.stringify(pasted));

  // 7 — and the thing the drags above exposed by accident. The graph's
  // selection is only ever cleared by a change React Flow reports about a
  // node it still has, so a scene that leaves the canvas — deleted from the
  // Content Browser, or carried away with a project that was closed — stayed
  // selected with nothing on screen saying so, and Delete stayed pointed at
  // it. Asserted here because this is where a project is swapped while
  // something is selected. (Confirmed by removing the prune: "b" survives
  // into the next project.)
  const clickAt = await api(() => {
    const el = document.querySelector('.react-flow__node[data-id="a"]');
    if (!el) return null;
    const box = el.getBoundingClientRect();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  });
  if (clickAt) await page.mouse.click(clickAt.x, clickAt.y);
  await wait(300);
  const selectedBefore = await api(() => window.__scriareSelectionStore.getState().graphIds.slice());
  check("something is still selected from the drags — the control for what follows",
    selectedBefore.length > 0, JSON.stringify(selectedBefore));

  await seedProject();
  await wait(400);
  const selectedAfter = await api(() => {
    const ids = window.__scriareSelectionStore.getState().graphIds;
    const p = window.__scriareProjectStore.getState().project;
    const live = new Set([...p.scenes.map((s) => s.id), ...p.content.map((n) => n.id)]);
    return { ids: ids.slice(), ghosts: ids.filter((id) => !live.has(id)) };
  });
  check("opening another project doesn't leave the old one's scenes selected",
    selectedAfter.ghosts.length === 0, JSON.stringify(selectedAfter));

  await api(() => document.querySelector(".react-flow__controls-fitview")?.click());
  await wait(500);
}
