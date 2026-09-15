/**
 * What paints on top of what in the Story Graph (v0.39.2, reported).
 *
 * Reported as: the scenes inside the third group on the canvas can't be
 * clicked — "can only select the group itself" — while the first two groups
 * and everything in them behave normally.
 *
 * The cause was a z-index scheme that made sense one line at a time. A
 * group's z is its place in the parents-first group list, so a nested box
 * paints above the box that owns it; a scene's z was the literal 1. So the
 * first box (z 0) sat behind its scenes, the second (z 1) tied and lost to
 * them on array order, and the third (z 2) and everything after it was
 * drawn OVER its own contents and swallowed every click. Nothing about the
 * third group was special — it was just the first one whose index cleared
 * the scenes.
 *
 * A box is a container: it belongs behind what it contains, whatever order
 * it was made in. Which is one rule, and this file is the two halves of it
 * — scenes above every box, and boxes still ordered among themselves.
 */
export default async function ({ page, api, check, seedProject }) {
  // Three sibling boxes, one scene each, small enough that the whole thing
  // fits in the graph panel once fitted — a scene that has scrolled off the
  // canvas also reports "something else is on top", for a reason that has
  // nothing to do with stacking (this file's first draft measured the
  // Inspector, and read as a pass for the bug).
  const seedBoxes = (count) =>
    api((n) => {
      const store = window.__scriareProjectStore;
      const now = new Date().toISOString();
      const scenes = [];
      const content = [];
      for (let i = 0; i < n; i += 1) {
        const gid = `g${i}`;
        const sid = `s${i}`;
        scenes.push({
          id: sid,
          title: `Scene ${i + 1}`,
          position: { x: i * 200 + 30, y: 60 },
          order: i,
          content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "words" }] }] },
        });
        content.push({
          id: gid, kind: "folder", category: "story", parentId: null, order: i * 2,
          name: `Box ${i + 1}`, rect: { x: i * 200, y: 0, width: 170, height: 150 },
        });
        content.push({
          id: sid, kind: "leaf", category: "story", parentId: gid, order: i * 2 + 1, refType: "scene",
        });
      }
      store.setState({
        project: {
          name: "Boxes", createdAt: now, updatedAt: now,
          scenes, content,
          favorites: [], variables: [], entities: [],
          choiceStyles: window.__scriareChoiceStyles.normalizeChoiceStyles(undefined),
          startSceneId: "s0",
        },
        filePath: null, selectedSceneId: null, selectedEntityId: null, saveStatus: "saved",
        isPlaying: false, canUndo: false, canRedo: false, undoLabel: null, redoLabel: null, undoToken: null,
      });
      window.__scriareSelectionStore?.setState({ graphIds: [] });
    }, count);

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const frame = async () => {
    await wait(600);
    await api(() => document.querySelector(".react-flow__controls-fitview")?.click());
    await wait(700);
  };
  /** The id of the node actually under a node's own centre. */
  const topmostOver = (id) =>
    api((nodeId) => {
      const el = document.querySelector(`.react-flow__node[data-id="${nodeId}"]`);
      if (!el) return "missing";
      const box = el.getBoundingClientRect();
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      const node = hit?.closest(".react-flow__node");
      // Not a node at all (the panel edge, the Inspector) is its own answer
      // — reported rather than folded into "something covers it", because
      // it means the measurement missed, not that the app is wrong.
      return node ? node.getAttribute("data-id") : "off-canvas";
    }, id);
  const centreOf = (id) =>
    api((nodeId) => {
      const el = document.querySelector(`.react-flow__node[data-id="${nodeId}"]`);
      if (!el) return null;
      const box = el.getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    }, id);
  const graphSelection = () =>
    api(() => window.__scriareSelectionStore.getState().graphIds.slice().sort());

  // 1 — the reported case, and the two that always worked, measured the
  // same way. Five boxes rather than three: the bug appeared at the third
  // and got worse after it, so a test that stops at three would pass on a
  // fix that only moved the problem along by one.
  await seedBoxes(5);
  await frame();

  const covered = [];
  for (let i = 0; i < 5; i += 1) {
    const top = await topmostOver(`s${i}`);
    if (top !== `s${i}`) covered.push(`s${i} covered by ${top}`);
  }
  check("a scene inside a box is the thing you're pointing at — in every box, not just the first two",
    covered.length === 0, covered.length ? covered.join("; ") : "all five scenes on top");

  // 2 — the reported symptom itself, with a real click: the scene gets
  // selected, not the box around it. The check above is the mechanism; this
  // is the sentence he wrote.
  const centre = await centreOf("s4");
  check("the fifth box's scene is somewhere to click", centre !== null, JSON.stringify(centre));
  if (centre) {
    await page.mouse.click(centre.x, centre.y);
    await wait(350);
    const selection = await graphSelection();
    check("clicking a scene in the last box selects the SCENE, not the box",
      selection.length === 1 && selection[0] === "s4", JSON.stringify(selection));
  }

  // 3 — the other half of the rule: a box inside a box still paints above
  // the box that owns it. Kept as a guard rather than sold as a proof —
  // flattening every group to a single z-index was tried on a broken build
  // and this check stayed green, because React Flow falls back to array
  // order for equal z and the group list is already parents-first. So the
  // per-group index is belt and braces; what this catches is anyone
  // reordering that list, or lifting scenes so far that a nested box goes
  // with them.
  await seedBoxes(1);
  await api(() => {
    const store = window.__scriareProjectStore;
    const project = store.getState().project;
    store.setState({
      project: {
        ...project,
        // The parent is grown and the inner box put BELOW the scene on
        // purpose: scenes sit above boxes now, so an inner box drawn under
        // the scene would report "covered" for the correct reason and this
        // check would be measuring the wrong thing.
        content: [
          ...project.content.map((n) =>
            n.id === "g0" ? { ...n, rect: { x: 0, y: 0, width: 420, height: 420 } } : n,
          ),
          {
            id: "inner", kind: "folder", category: "story", parentId: "g0", order: 9,
            name: "Inner", rect: { x: 40, y: 220, width: 200, height: 150 },
          },
        ],
      },
    });
  });
  await frame();
  const overInner = await topmostOver("inner");
  check("a box nested inside another box still paints above the one that owns it",
    overInner === "inner", `under the point: ${overInner}`);

  // The camera was moved to frame this file's own layouts, and the graph
  // only fits itself on mount — so the next spec would inherit a zoom this
  // one chose, and anything measuring a node in screen pixels would be
  // reading a differently sized node than it was written against.
  await seedProject();
  await wait(400);
  await api(() => document.querySelector(".react-flow__controls-fitview")?.click());
  await wait(600);
}
