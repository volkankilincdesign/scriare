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

  await api(() => window.__scriareSelectionStore?.setState({ graphIds: [] }));
  await seedProject();
  await wait(300);
  await api(() => document.querySelector(".react-flow__controls-fitview")?.click());
  await wait(500);
}
