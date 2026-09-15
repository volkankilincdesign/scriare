/**
 * The Story Graph's minimap (v0.36.1, reported).
 *
 * On a small story the minimap sat in the bottom-left corner covering a
 * scene, with no way to move it. The complaint was right, and the fix is
 * the definition rather than a setting: a minimap exists to show you where
 * you are in something too big to see, so when the whole story is already
 * on screen it isn't an overview of anything — just an opaque rectangle
 * parked on top of what it claims to summarise.
 *
 * Both halves need testing, and the second is the one that would rot
 * silently: it is easy to make the thing disappear and much easier than it
 * looks to make it never come back.
 */
export default async function ({ api, check, seedProject }) {
  const seed = (positions) =>
    api((pos) => {
      const store = window.__scriareProjectStore;
      const now = new Date().toISOString();
      store.setState({
        project: {
          name: "Graph", createdAt: now, updatedAt: now,
          scenes: pos.map((p, i) => ({
            id: `s${i}`, title: `Scene ${i + 1}`, position: p, order: i,
            content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "words" }] }] },
          })),
          content: pos.map((_, i) => ({
            id: `s${i}`, kind: "leaf", category: "story", parentId: null, order: i, refType: "scene",
          })),
          favorites: [], variables: [], entities: [],
          choiceStyles: window.__scriareChoiceStyles.normalizeChoiceStyles(undefined),
          startSceneId: "s0",
        },
        filePath: null, selectedSceneId: "s0", selectedEntityId: null, saveStatus: "saved",
        isPlaying: false, canUndo: false, canRedo: false, undoLabel: null, redoLabel: null, undoToken: null,
      });
    }, positions);

  const settle = () => new Promise((resolve) => setTimeout(resolve, 700));
  const minimap = () => api(() => Boolean(document.querySelector(".react-flow__minimap")));
  // The graph itself has to be on screen, or "there is no minimap" is true
  // for the uninteresting reason and this whole file proves nothing.
  const graphIsShowing = () => api(() => Boolean(document.querySelector(".react-flow__viewport")));

  // 1 — a story that fits on screen doesn't get a minimap over it.
  await seed([{ x: 0, y: 0 }, { x: 260, y: 0 }]);
  await settle();
  let r = await minimap();
  const showing = await graphIsShowing();
  check("the Story Graph is on screen at all — the precondition for everything below",
    showing === true);
  check("a story that fits on screen has no minimap in the way", r === false);

  // 2 — and one that doesn't fit does. This is the half that could rot
  // unnoticed: "it's gone" and "it never comes back" look identical until
  // the day you need it.
  await seed([{ x: 0, y: 0 }, { x: 2600, y: 1800 }, { x: -1200, y: 900 }]);
  await settle();
  r = await minimap();
  check("a story spread beyond the viewport gets one back", r === true);

  r = await api(() => {
    const el = document.querySelector(".react-flow__minimap");
    return el ? Number(getComputedStyle(el).opacity) : null;
  });
  check("...and it waits at a low opacity over the scene underneath it",
    r !== null && r < 0.8, `opacity ${r}`);

  await seedProject();
}
