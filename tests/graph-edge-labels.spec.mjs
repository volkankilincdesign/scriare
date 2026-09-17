/**
 * What a connection in the Story Graph is labelled with (v0.43.0, asked for).
 *
 * The history is worth keeping, because this is the third answer to the same
 * question. Originally every wire printed its choice's full sentence over
 * the curve, which on a real story is fatal to the thing the graph is for:
 * the sentences are long, they overlap, and they sit on top of the wires
 * they belong to, so "which scene leads where" became the one question the
 * map couldn't answer. v0.39.1 replaced that with two labels and a rule for
 * which one you got — a bare ordinal at rest, the sentence on hover and on
 * the selected scene's wires.
 *
 * That was too clever. A label whose text changes as the pointer moves is a
 * label you have to chase, and the sentence it revealed is one double-click
 * away in the scene anyway. But a bare "1" was too little to stand on its
 * own: with no word attached it reads as a count, or a weight, or an order
 * of play. So a wire now always says the same thing, "Choice 1", and the
 * only question left is whether the camera is close enough to read it.
 *
 * Both failure directions are checked here: no sentences anywhere, however
 * you point or select, and no unreadable text drawn on a map pulled far
 * enough out that the letters are three pixels tall.
 */
export default async function ({ page, api, check, seedProject }) {
  // s0 branches three ways, but the middle option goes nowhere — so the two
  // drawn wires are choices 1 and 3. That gap is the assertion that matters
  // for the numbering: the ordinal has to be the option's place on the
  // PAGE, not its place among the links that happened to be wired up, or
  // the number on the wire quietly disagrees with the number the writer is
  // counting down the scene.
  const seed = (selected) =>
    api((selectedSceneId) => {
      const { buildChoiceBlockNode } = window.__scriareChoiceUtils;
      const store = window.__scriareProjectStore;
      const now = new Date().toISOString();
      const scene = (id, title, x, y, order, content) => ({
        id, title, position: { x, y }, order,
        content: { type: "doc", content },
      });
      store.setState({
        project: {
          name: "Edges", createdAt: now, updatedAt: now,
          scenes: [
            scene("s0", "Crossroads", 0, 0, 0, [
              { type: "paragraph", content: [{ type: "text", text: "The road forks." }] },
              buildChoiceBlockNode([
                { id: "c1", text: "Take the high road past the old barrow", targetSceneId: "s1" },
                { id: "c2", text: "Stand there and think about it for a while", targetSceneId: null },
                { id: "c3", text: "Take the low road down towards the river", targetSceneId: "s2" },
              ], "b1"),
            ]),
            scene("s1", "High road", 460, -220, 1, [
              { type: "paragraph", content: [{ type: "text", text: "Stones." }] },
            ]),
            scene("s2", "Low road", 460, 260, 2, [
              { type: "paragraph", content: [{ type: "text", text: "Water." }] },
            ]),
            scene("s3", "Elsewhere", 980, 620, 3, [
              { type: "paragraph", content: [{ type: "text", text: "Nowhere near." }] },
            ]),
          ],
          content: ["s0", "s1", "s2", "s3"].map((id, i) => ({
            id, kind: "leaf", category: "story", parentId: null, order: i, refType: "scene",
          })),
          favorites: [], variables: [], entities: [],
          choiceStyles: window.__scriareChoiceStyles.normalizeChoiceStyles(undefined),
          startSceneId: "s0",
        },
        filePath: null, selectedSceneId, selectedEntityId: null, saveStatus: "saved",
        isPlaying: false, canUndo: false, canRedo: false, undoLabel: null, redoLabel: null, undoToken: null,
      });
    }, selected);

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const settle = () => wait(700);
  const labels = () =>
    api(() => [...document.querySelectorAll(".react-flow__edge-text")].map((t) => t.textContent ?? ""));
  const click = async (control, times = 1) => {
    for (let i = 0; i < times; i += 1) {
      await api((cls) => document.querySelector(cls)?.click(), `.react-flow__controls-${control}`);
      await wait(120);
    }
    await wait(350);
  };
  const scale = () =>
    api(() => {
      const t = document.querySelector(".react-flow__viewport")?.style.transform ?? "";
      const m = /scale\(([\d.]+)\)/.exec(t);
      return m ? Number(m[1]) : null;
    });
  /** A rendered label's height in SCREEN pixels — what legibility means. */
  const heightOf = (needle) =>
    api((text) => {
      const node = [...document.querySelectorAll(".react-flow__edge-text")].find(
        (t) => t.textContent === text,
      );
      return node ? node.getBoundingClientRect().height : null;
    }, needle);

  // The pointer is parked in the corner first. That isn't hygiene — the
  // mouse keeps whatever position an earlier spec left it at, and a cursor
  // resting on a wire used to change what that wire said. Parking it means
  // the "nothing is being pointed at" case is actually being tested.
  const readable = async () => {
    // The camera's starting zoom is whatever fitView chose for the last
    // project the app had, and on a small window that is often below the
    // threshold — so every part of this file that is about the TEXT gets
    // the camera close enough first, and the threshold itself is checked
    // on its own in part 4.
    for (let i = 0; i < 15 && (await scale()) < 0.75; i += 1) await click("zoomin");
  };

  await page.mouse.move(4, 4);
  await seed("s3");
  await settle();
  await readable();

  const drawn = await api(() => document.querySelectorAll(".react-flow__edge").length);
  check("both linked choices are drawn as connections, and the unlinked one isn't",
    drawn === 2, `${drawn} edges`);

  // 1 — the label itself: which choice this is, named as a choice, numbered
  // by its place on the page rather than among the links.
  let r = await labels();
  check("a wire says which choice it is",
    [...r].sort().join(" / ") === "Choice 1 / Choice 3", JSON.stringify(r));
  check("...and no sentence is printed over the curves",
    r.every((t) => !t.includes("road")), JSON.stringify(r));

  // 2 — pointing at a wire changes nothing. The v0.39.1 behaviour swapped
  // in the choice's sentence here, and this is what says that is gone
  // rather than merely unused: a label that rewrites itself under the
  // pointer is the thing being removed.
  //
  // Done with the whole story in frame, which is both where a wire is
  // actually pointable (zoomed in, most of a curve is off the panel) and
  // the case the old behaviour was loudest in: out here it drew the
  // sentence at a fixed SCREEN size, so a hover printed a full-size banner
  // across a map small enough to see the whole story.
  await click("fitview");
  const onWire = await api(() => {
    // By id, not by label: out here the labels are deliberately not drawn,
    // which is the state being tested. The id is the scene's plus the
    // choice's, as the edges memo builds it.
    const edge =
      document.querySelector('.react-flow__edge[data-id="s0-c1"]') ??
      document.querySelector(".react-flow__edge");
    const path = edge?.querySelector(".react-flow__edge-path");
    if (!path) return null;
    const matrix = path.getScreenCTM();
    if (!matrix) return null;
    const pane = document.querySelector(".react-flow")?.getBoundingClientRect();
    // Several points along the curve rather than one: zoomed in, a given
    // fraction of the wire can easily be off the panel or under a scene
    // card, and what this step needs is any point that is genuinely on the
    // wire and pointable. React Flow draws an invisible fat interaction
    // path over every edge exactly so that exists.
    for (const at of [0.34, 0.5, 0.25, 0.66, 0.42, 0.58]) {
      const point = path.getPointAtLength(path.getTotalLength() * at);
      const screen = point.matrixTransform(matrix);
      if (pane && (screen.x < pane.x + 4 || screen.x > pane.right - 4 ||
                   screen.y < pane.y + 4 || screen.y > pane.bottom - 4)) continue;
      const hit = document.elementFromPoint(screen.x, screen.y);
      if (hit?.closest(".react-flow__edge")) return { x: screen.x, y: screen.y, at, onEdge: true };
    }
    return { onEdge: false };
  });
  check("a point on choice 1's wire is exposed to point at",
    onWire !== null && onWire.onEdge === true, JSON.stringify(onWire));
  if (onWire?.onEdge) {
    await page.mouse.move(onWire.x, onWire.y);
    await wait(300);
    r = await labels();
    check("pointing at a wire prints nothing over the map",
      r.length === 0, `zoom ${await scale()}, labels ${JSON.stringify(r)}`);
    await page.mouse.move(4, 4);
    await wait(200);
  }

  // 3 — nor does selecting the scene the wires belong to. Selection still
  // colours them (that is the `isConnectedToSelected` styling, and the
  // graph-selection specs cover it); what it must not do any more is put
  // sentences back on the map.
  await seed("s0");
  await settle();
  await readable();
  r = await labels();
  check("selecting a scene doesn't put sentences back on its wires",
    [...r].sort().join(" / ") === "Choice 1 / Choice 3", JSON.stringify(r));

  // 4 — and the one thing the camera does decide. Pulled far enough out,
  // the text would render a few pixels tall: a pale smear laid along every
  // wire, which is the original reported bug arriving by a different route.
  // It is left off entirely instead.
  const near = await heightOf("Choice 1");
  check("at a readable distance the label is drawn — the control for what follows",
    near !== null && near >= 7, `${near}px tall at zoom ${await scale()}`);

  await click("zoomout", 4);
  const farZoom = await scale();
  r = await labels();
  check("zoomed out past legibility, the wires carry no text at all",
    farZoom !== null && farZoom < 0.7 && r.length === 0, `zoom ${farZoom}, labels ${JSON.stringify(r)}`);

  // 5 — and it comes back. A rule that hides a label has to be a rule about
  // the camera, not a one-way door.
  for (let i = 0; i < 15 && (await scale()) < 0.75; i += 1) await click("zoomin");
  r = await labels();
  const back = await heightOf("Choice 3");
  check("coming back in brings the labels back, legibly",
    [...r].sort().join(" / ") === "Choice 1 / Choice 3" && back !== null && back >= 7,
    `${JSON.stringify(r)} at ${back}px, zoom ${await scale()}`);

  // The camera was moved by the checks above, and the graph only fits
  // itself on mount — so a spec after this one would inherit a zoom this
  // file chose, and anything measuring a node in screen pixels (the
  // Group-name drag in entities-and-renaming.spec.mjs does exactly that)
  // would be reading a differently sized node than it was written against.
  await seedProject();
  await wait(400);
  await click("fitview");
}
