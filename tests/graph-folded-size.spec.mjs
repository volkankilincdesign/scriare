import { readFile } from "node:fs/promises";

/**
 * A folded group keeps the size it will unfold to (v0.43.0, reported).
 *
 * Reported as "when a closed group is opened it tries to hold its closed
 * state's size" — fold a 620x300 chapter, touch it, unfold it, and the box
 * comes back at the small folded block's dimensions with its own scenes
 * sitting outside it.
 *
 * The cause is one line in the commit path rather than anything to do with
 * folding: a box's drag-stop writes the size off the NODE, and a folded
 * node's size is the fixed folded block (COLLAPSED_GROUP_SIZE). React Flow
 * fires drag-start/stop around a plain click too, so this does not need an
 * actual drag — clicking the unfold caret is enough to overwrite the real
 * rectangle, which is why it reads as "folding resized my chapter".
 *
 * The probe below therefore drives the real gesture (mouse down/up on the
 * folded box) rather than calling the store: calling updateFolderRect
 * directly would be testing my own theory of the bug instead of the bug.
 */
export default async function ({ page, api, check, seedProject }) {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const OPEN = { x: 0, y: 0, width: 620, height: 300 };

  const seed = () =>
    api((rect) => {
      const store = window.__scriareProjectStore;
      const now = new Date().toISOString();
      const scene = (id, title, x, y, order) => ({
        id, title, position: { x, y }, order,
        content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: title }] }] },
      });
      store.setState({
        project: {
          name: "Folding", createdAt: now, updatedAt: now,
          scenes: [scene("s1", "One", 36, 72, 0), scene("s2", "Two", 342, 72, 1)],
          content: [
            {
              id: "ch", kind: "folder", category: "story", parentId: null, order: 0,
              name: "Chapter", rect: rect,
            },
            { id: "s1", kind: "leaf", category: "story", parentId: "ch", order: 1, refType: "scene" },
            { id: "s2", kind: "leaf", category: "story", parentId: "ch", order: 2, refType: "scene" },
          ],
          favorites: [], variables: [], entities: [],
          choiceStyles: window.__scriareChoiceStyles.normalizeChoiceStyles(undefined),
          startSceneId: "s1",
        },
        filePath: null, selectedSceneId: null, selectedEntityId: null, saveStatus: "saved",
        isPlaying: false, canUndo: false, canRedo: false, undoLabel: null, redoLabel: null, undoToken: null,
      });
    }, OPEN);

  const storedRect = () =>
    api(() => {
      const p = window.__scriareProjectStore.getState().project;
      return p.content.find((n) => n.id === "ch")?.rect ?? null;
    });
  const fold = () => api(() => window.__scriareProjectStore.getState().toggleFolderCollapsed("ch"));
  const centreOfBox = () =>
    api(() => {
      const el = document.querySelector('.react-flow__node[data-id="ch"]');
      if (!el) return null;
      const b = el.getBoundingClientRect();
      // Near the top of the box, where its own bar is — not the middle,
      // which on an unfolded box is empty canvas belonging to the pane.
      return { x: b.x + b.width / 2, y: b.y + 14 };
    });

  await seed();
  await wait(600);
  await api(() => document.querySelector(".react-flow__controls-fitview")?.click());
  await wait(700);

  // 1 — the folded block really is a different size from the box, which is
  // the whole premise: if folding didn't change the node's dimensions there
  // would be nothing for the commit to get wrong.
  const openSize = await api(() => {
    const el = document.querySelector('.react-flow__node[data-id="ch"]');
    const b = el?.getBoundingClientRect();
    return b ? Math.round(b.width) : null;
  });
  await fold();
  await wait(500);
  const foldedSize = await api(() => {
    const el = document.querySelector('.react-flow__node[data-id="ch"]');
    const b = el?.getBoundingClientRect();
    return b ? Math.round(b.width) : null;
  });
  check("folding draws the chapter as a smaller block",
    openSize && foldedSize && foldedSize < openSize, `${openSize}px → ${foldedSize}px`);

  // 2 — the reported gesture. A press and release on the folded box, with no
  // movement at all: React Flow reports this as a drag that started and
  // stopped, and that is where the size was being written.
  const spot = await centreOfBox();
  check("the folded box is on screen to click", spot !== null, JSON.stringify(spot));
  if (spot) {
    await page.mouse.move(spot.x, spot.y);
    await page.mouse.down();
    await wait(60);
    await page.mouse.up();
    await wait(400);
  }
  const afterClick = await storedRect();
  check("clicking a folded box does not resize the chapter",
    afterClick && afterClick.width === OPEN.width && afterClick.height === OPEN.height,
    JSON.stringify(afterClick));

  // 3 — and a real drag of the folded box, which must still move it. The
  // fix is "keep the stored size", not "stop committing anything": a folded
  // chapter you drag across the canvas has to stay where you put it.
  const from = await centreOfBox();
  const before = await storedRect();
  if (from) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (const step of [20, 50, 84]) {
      await page.mouse.move(from.x + step, from.y + step);
      await wait(35);
    }
    await page.mouse.up();
    await wait(400);
  }
  const afterDrag = await storedRect();
  check("dragging a folded box still moves it — the control for what follows",
    before && afterDrag && (afterDrag.x !== before.x || afterDrag.y !== before.y),
    `${JSON.stringify(before)} → ${JSON.stringify(afterDrag)}`);
  check("...and still doesn't resize it",
    afterDrag && afterDrag.width === OPEN.width && afterDrag.height === OPEN.height,
    JSON.stringify(afterDrag));

  // 4 — what the writer actually sees: unfold, and the chapter is the size
  // it was before any of this.
  await fold();
  await wait(500);
  const unfolded = await storedRect();
  check("unfolding gives back the size the chapter had",
    unfolded && unfolded.width === OPEN.width && unfolded.height === OPEN.height,
    JSON.stringify(unfolded));

  // 5 — and its scenes are inside it again, which is the symptom in the
  // screenshot: a box that came back small left its own scenes outside.
  const contains = await api(() => {
    const p = window.__scriareProjectStore.getState().project;
    const r = p.content.find((n) => n.id === "ch").rect;
    const gc = window.__scriareGraphConstants;
    return p.scenes.every(
      (s) =>
        s.position.x >= r.x &&
        s.position.y >= r.y &&
        s.position.x + gc.SCENE_NODE_WIDTH <= r.x + r.width &&
        s.position.y + gc.SCENE_NODE_HEIGHT <= r.y + r.height,
    );
  });
  check("...with its own scenes still inside it", contains === true, `contains: ${contains}`);

  /* ── fold everything, and look for it (v0.87.0) ─────────────────── */

  // FOUND IN A SCREENSHOT, not by a test, which is the second time that has
  // happened on this surface. With every chapter of the real story folded,
  // the graph held five collapsed blocks and eleven bundled wires and showed
  // an empty canvas: the blocks are drawn where their chapters were, and the
  // camera was still framing the area thirty-two scene cards used to fill.
  //
  // ASSERTED AS "ON SCREEN", NOT AS "EXISTS". The nodes existed the whole
  // time — a check that counted them passed on the broken build, which is
  // exactly the trap v0.85.0's route memo set. What was wrong is where the
  // camera was pointing, so the measurement is each node's rectangle against
  // the graph's own rectangle, in screen pixels.
  const onScreen = () =>
    api(() => {
      const surface = document.querySelector(".react-flow");
      if (!surface) return { nodes: 0, visible: 0 };
      const box = surface.getBoundingClientRect();
      const nodes = [...document.querySelectorAll(".react-flow__node")];
      const visible = nodes.filter((n) => {
        const r = n.getBoundingClientRect();
        return (
          r.width > 0 &&
          r.right > box.left &&
          r.left < box.right &&
          r.bottom > box.top &&
          r.top < box.bottom
        );
      });
      return { nodes: nodes.length, visible: visible.length };
    });

  // THE REAL STORY FOR THIS ONE, and the reason is the fixture above. It has
  // three scenes in one chapter, so folding it moves the content a few dozen
  // pixels and the camera never loses sight of it — the check would pass on
  // the broken build. The defect appears when folding collapses a wide story
  // into blocks far from where the camera is framing, which needs a story
  // with some width to it: thirty-two scenes across five chapters.
  const loaded = await api(async (json) => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    const project = window.__scriareProjectTypes.normalizeProject(JSON.parse(json));
    window.__scriareProjectStore.setState({ project, filePath: null, saveStatus: "saved" });
    await w(500);
    // Frame it the way a writer would find it, so the camera starts where
    // the unfolded story is.
    document.querySelector(".react-flow__controls-fitview")?.click();
    await w(700);
    return { scenes: project.scenes.length };
  }, await readFile(new URL("./fixtures/the-blue-hour.scriare", import.meta.url), "utf-8"));

  check(
    "the big story is loaded, so folding has somewhere to go wrong",
    loaded.scenes >= 30,
    `${loaded.scenes} scenes`,
  );

  const framedBefore = await onScreen();
  check(
    "the graph has something on screen to start with",
    framedBefore.visible > 0,
    `${framedBefore.visible} of ${framedBefore.nodes} nodes visible`,
  );

  // Every group folded, through the store rather than by clicking each
  // caret: what is being tested is where the camera ends up, and the gesture
  // that folds a chapter is already covered above.
  const folded = await api(() => {
    const store = window.__scriareProjectStore.getState();
    const groups = window.__scriareGroupUtils.graphGroups(
      store.project.content,
      store.project.scenes,
    );
    groups.forEach((g) => store.toggleFolderCollapsed(g.id));
    return groups.length;
  });
  // The re-fit runs on the frame after the fold and animates, so this waits
  // for the animation rather than for the state.
  await wait(900);
  const framedAfter = await onScreen();

  check(
    "folding every chapter actually folds them",
    folded >= 1 && framedAfter.nodes > 0 && framedAfter.nodes < framedBefore.nodes,
    `${folded} folded · ${framedBefore.nodes} nodes → ${framedAfter.nodes}`,
  );
  check(
    "...and the folded story is still on screen, not off in the margin",
    framedAfter.visible === framedAfter.nodes,
    `${framedAfter.visible} of ${framedAfter.nodes} blocks visible`,
  );

  /* ── the triangles nobody had ever clicked (v0.88.4) ──────────────── */

  // UNTIL THIS VERSION, NOTHING IN THE SUITE CLICKED THEM. Every fold test
  // here and in groups.spec called `toggleFolderCollapsed` on the store
  // directly, which tests the action and says nothing about the control —
  // so the buttons could have been unrendered, wired to the wrong folder,
  // or swallowed by React Flow's own drag handling, and all 1124 checks
  // would have stayed green. That is the shape of the Welcome screen's dead
  // link in v0.81.0, which eight negative controls were green over: a door
  // tested where it was convenient rather than where it was at risk.
  //
  // Found while collapsing the two buttons onto one component, which is
  // the only reason anybody looked.
  await seed();
  await wait(600);
  await api(() => document.querySelector(".react-flow__controls-fitview")?.click());
  await wait(600);

  const clickFoldToggle = (which) =>
    api((w) => {
      const el = document.querySelector(
        `.react-flow__node[data-id="ch"] [data-fold-toggle="${w}"]`,
      );
      if (!el) return { found: false, collapsed: null };
      el.click();
      return { found: true };
    }, which);

  const isCollapsed = () =>
    api(() => {
      const p = window.__scriareProjectStore.getState().project;
      return Boolean(p.content.find((n) => n.id === "ch")?.collapsed);
    });

  check("an unfolded chapter draws a fold triangle", (await clickFoldToggle("fold")).found);
  await wait(400);
  check("clicking it folds the chapter", (await isCollapsed()) === true, "collapsed after click");

  const unfoldClick = await clickFoldToggle("unfold");
  check("a folded chapter draws an unfold triangle", unfoldClick.found);
  await wait(400);
  check("clicking that one unfolds it again", (await isCollapsed()) === false, "open after click");

  // Both branches render the same component, so the thing worth asserting
  // is that they are NOT both present at once — a fold control on a folded
  // box would mean the collapsed flag never reached it.
  const bothAtOnce = await api(() => {
    const node = document.querySelector('.react-flow__node[data-id="ch"]');
    return {
      fold: Boolean(node?.querySelector('[data-fold-toggle="fold"]')),
      unfold: Boolean(node?.querySelector('[data-fold-toggle="unfold"]')),
    };
  });
  check(
    "a chapter shows one triangle, not both",
    bothAtOnce.fold !== bothAtOnce.unfold,
    `fold: ${bothAtOnce.fold}, unfold: ${bothAtOnce.unfold}`,
  );

  await api(() => window.__scriareSelectionStore?.setState({ graphIds: [] }));
  await seedProject();
  await wait(300);
  await api(() => document.querySelector(".react-flow__controls-fitview")?.click());
  await wait(500);
}
