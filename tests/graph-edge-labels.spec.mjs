/**
 * What a connection in the Story Graph is labelled with (v0.39.1, reported).
 *
 * Every edge used to print its choice's full sentence over the curve. On a
 * real story that is fatal to the thing the graph is for: the sentences are
 * long, they overlap each other, and they sit exactly on top of the wires
 * they belong to, so "which scene leads where" — the one question the map
 * answers — became the one question you couldn't answer from it.
 *
 * The rule now, in three parts, each tested below:
 *
 *   - At rest a wire carries only its choice's number, small enough to read
 *     as a bead threaded on the cable, and shrinking away with everything
 *     else as you pull back.
 *   - Selecting a scene puts the text back on its own wires, once the
 *     camera is close enough for an 11px label to be legible.
 *   - Pointing at a wire always answers, at any distance — that one label
 *     is drawn at a fixed size on screen, like a tooltip.
 *
 * All three fail in different directions, which is why all three are here:
 * printing everything is the reported bug, printing nothing is the
 * over-correction, and printing the text at a size nobody can read is the
 * same bug wearing better typography.
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
  /** A rendered label's height in SCREEN pixels — what legibility means. */
  const heightOf = (match) =>
    api((needle) => {
      const text = [...document.querySelectorAll(".react-flow__edge-text")].find((t) =>
        needle.length <= 2 ? t.textContent === needle : (t.textContent ?? "").includes(needle),
      );
      return text ? text.getBoundingClientRect().height : null;
    }, match);

  // 1 — nothing of s0's is selected, so neither of its wires says anything
  // but its number. ("s3" is off on its own with no connections, so
  // selecting it can't light up an edge by accident.)
  //
  // The pointer is parked in the corner first, and that isn't hygiene — the
  // mouse keeps whatever position an earlier spec left it at, and a cursor
  // resting on a wire legitimately makes that wire show its sentence. Left
  // unparked, "at rest" would mean "at rest, unless the mouse happens to be
  // somewhere interesting".
  await page.mouse.move(4, 4);
  await seed("s3");
  await settle();

  const drawn = await api(() => document.querySelectorAll(".react-flow__edge").length);
  check("both linked choices are drawn as connections, and the unlinked one isn't",
    drawn === 2, `${drawn} edges`);

  let r = await labels();
  check("at rest a wire is labelled with its choice's number on the page, nothing more",
    [...r].sort().join(",") === "1,3", JSON.stringify(r));
  check("...so no sentence is printed over the curves",
    r.every((t) => !t.includes("road")), JSON.stringify(r));

  // 2 — a bead shrinks away with the rest of the map. Held at a fixed size
  // it would be two characters on every wire at every distance, which is
  // the clutter this release removes, in miniature.
  const beadNear = await heightOf("3");
  await click("zoomout", 4);
  const beadFar = await heightOf("3");
  check("a bead shrinks with the map as you pull back",
    beadNear !== null && beadFar !== null && beadFar < beadNear * 0.75,
    `${beadNear}px → ${beadFar}px`);

  // 3 — the pointer answers at any distance, and answers legibly. This is
  // the label drawn at a fixed size on SCREEN rather than in the map's own
  // scale, so the check is its measured height, not its presence: a
  // five-pixel sentence smeared across the wires is the reported bug, not a
  // fix for it. Still zoomed right out from the step above.
  const onWire = await api(() => {
    const text = [...document.querySelectorAll(".react-flow__edge-text")].find(
      (t) => t.textContent === "1",
    );
    const edge = text?.closest(".react-flow__edge");
    const path = edge?.querySelector(".react-flow__edge-path");
    if (!path) return null;
    const point = path.getPointAtLength(path.getTotalLength() * 0.34);
    const matrix = path.getScreenCTM();
    if (!matrix) return null;
    const screen = point.matrixTransform(matrix);
    const hit = document.elementFromPoint(screen.x, screen.y);
    // The bead is a couple of screen pixels wide out here and often sits
    // under a scene box, so the point is taken off the curve itself — React
    // Flow draws an invisible fat interaction path over every edge exactly
    // so a wire can be pointed at.
    return { x: screen.x, y: screen.y, onEdge: Boolean(hit?.closest(".react-flow__edge")) };
  });
  check("a point on choice 1's wire is exposed to point at",
    onWire !== null && onWire.onEdge === true, JSON.stringify(onWire));

  if (onWire?.onEdge) {
    await page.mouse.move(onWire.x, onWire.y);
    await wait(300);
    r = await labels();
    check("pointing at a wire, zoomed right out, shows that one choice and no other",
      r.some((t) => t.startsWith("Take the high road past")) && r.includes("3"),
      JSON.stringify(r));
    check("...capped in length, so it labels a wire instead of crossing the map",
      r.every((t) => t.length <= 34), JSON.stringify(r.map((t) => t.length)));

    const hovered = await heightOf("high road");
    check("...and drawn big enough to actually read, at a zoom where the map is tiny",
      hovered !== null && hovered >= 10 && beadFar !== null && hovered > beadFar * 3,
      `label ${hovered}px vs bead ${beadFar}px`);

    // Leaving has to put it back, or one hover permanently prints a
    // sentence over the graph and the treatment unravels a wire at a time
    // as the mouse moves around.
    await page.mouse.move(onWire.x, onWire.y - 240);
    await wait(300);
    r = await labels();
    check("...and moving off it puts the number back",
      [...r].sort().join(",") === "1,3", JSON.stringify(r));
  }

  // 4 — selecting the scene puts the text on its own wires, but only once
  // the camera is close enough for it to be worth drawing. Both halves
  // matter: the text has to come back at all (or this "fix" has deleted
  // information), and it must not come back as an unreadable smear the
  // moment a scene is clicked on a zoomed-out map.
  await page.mouse.move(4, 4);
  await seed("s0");
  await settle();
  r = await labels();
  check("selected but zoomed out, the wires keep their numbers",
    [...r].sort().join(",") === "1,3", JSON.stringify(r));

  // Zoomed in until the camera is past the threshold rather than a fixed
  // number of clicks: the zoom step is the library's, and what counts is
  // being close enough to read, not how many times a button was pressed.
  const scale = () =>
    api(() => {
      const t = document.querySelector(".react-flow__viewport")?.style.transform ?? "";
      const m = /scale\(([\d.]+)\)/.exec(t);
      return m ? Number(m[1]) : null;
    });
  for (let i = 0; i < 15 && (await scale()) < 0.85; i += 1) await click("zoomin");
  const zoomedTo = await scale();
  check("the camera is now close enough for a label to be worth drawing",
    zoomedTo !== null && zoomedTo >= 0.85, `zoom ${zoomedTo}`);
  r = await labels();
  check("zoomed in, a selected scene's wires carry their choices' text",
    r.some((t) => t.startsWith("Take the high road past")) &&
      r.some((t) => t.startsWith("Take the low road down")),
    JSON.stringify(r));

  const selected = await heightOf("high road");
  check("...at a legible size", selected !== null && selected >= 10, `${selected}px tall`);

  // The camera was moved by the checks above, and the graph only fits
  // itself on mount — so a spec after this one would inherit a zoom this
  // file chose, and anything measuring a node in screen pixels (the
  // Group-name drag in entities-and-renaming.spec.mjs does exactly that)
  // would be reading a differently sized node than it was written against.
  await seedProject();
  await wait(400);
  await click("fitview");
}
