/**
 * Folders as graph groups (v0.28.0).
 *
 * The whole point of folding Frames into folders is that the Content
 * Browser and the Story Graph can no longer disagree about where a scene
 * lives. Every case here is a way they used to be able to drift apart:
 *
 *  - dropping a scene into a box has to move it in the TREE, not just on
 *    the canvas;
 *  - dragging a box has to carry everything inside it, at every depth;
 *  - dragging a box out of another box has to re-file it;
 *  - a box resized past its parent's edge has to grow the parent, never
 *    end up drawn outside the thing that owns it;
 *  - and the frame-era migration has to convert old projects without
 *    quietly rearranging a story someone already organised by hand.
 *
 * The first and third were verified to FAIL on builds with their logic
 * removed.
 */
export default async function ({ api, check, seedProject }) {
  // Chapter box at (0,0,600x400) with one scene in it; a second box
  // ("Side") off to the right; one loose scene.
  const seedGroups = () =>
    api(() => {
      const store = window.__scriareProjectStore;
      const now = new Date().toISOString();
      const scene = (id, title, x, y) => ({
        id,
        title,
        content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: title }] }] },
        position: { x, y },
        order: 0,
      });
      store.setState({
        project: {
          name: "Groups",
          createdAt: now,
          updatedAt: now,
          scenes: [scene("in", "Inside", 100, 100), scene("out", "Loose", 1400, 100)],
          content: [
            {
              id: "chapter", kind: "folder", category: "story", parentId: null, order: 0,
              name: "Chapter", rect: { x: 0, y: 0, width: 600, height: 400 },
            },
            { id: "in", kind: "leaf", category: "story", parentId: "chapter", order: 0, refType: "scene" },
            {
              id: "side", kind: "folder", category: "story", parentId: null, order: 1,
              name: "Side", rect: { x: 800, y: 0, width: 500, height: 400 },
            },
            { id: "out", kind: "leaf", category: "story", parentId: null, order: 2, refType: "scene" },
          ],
          favorites: [], variables: [], startSceneId: "in",
        },
        filePath: null, selectedSceneId: "in", saveStatus: "saved", isPlaying: false,
        canUndo: false, canRedo: false, undoLabel: null, redoLabel: null, undoToken: null,
      });
      window.__scriareToastStore?.setState({ toasts: [] });
    });

  const parentOf = (id) =>
    api((nodeId) => {
      const p = window.__scriareProjectStore.getState().project;
      return p.content.find((n) => n.id === nodeId)?.parentId ?? null;
    }, id);

  // 1 — THE POINT OF THE WHOLE CHANGE: dropping a scene inside a box files
  // it in that folder, and dropping it on open canvas takes it back out.
  await seedGroups();
  await api(() => window.__scriareProjectStore.getState().updateScenePosition("out", { x: 200, y: 200 }));
  check("dropping a scene inside a group moves it into that folder",
    (await parentOf("out")) === "chapter", `parent is ${await parentOf("out")}`);

  await api(() => window.__scriareProjectStore.getState().updateScenePosition("out", { x: 1400, y: 900 }));
  check("dropping a scene on open canvas moves it back to the root",
    (await parentOf("out")) === null, `parent is ${await parentOf("out")}`);

  // 2 — a scene lands in the DEEPEST box it's inside, not the outermost
  await seedGroups();
  let r = await api(() => {
    const store = window.__scriareProjectStore;
    const p = store.getState().project;
    store.setState({
      project: {
        ...p,
        content: [
          ...p.content,
          {
            id: "sub", kind: "folder", category: "story", parentId: "chapter", order: 1,
            name: "Sub", rect: { x: 50, y: 50, width: 300, height: 200 },
          },
        ],
      },
    });
    store.getState().updateScenePosition("out", { x: 100, y: 100 });
    return store.getState().project.content.find((n) => n.id === "out").parentId;
  });
  check("a scene inside nested boxes joins the innermost one", r === "sub", `parent is ${r}`);

  // 3 — dragging a group carries everything inside it, at every depth
  r = await api(() => {
    const store = window.__scriareProjectStore;
    store.getState().updateFolderRect("chapter", { x: 100, y: 100, width: 600, height: 400 }, true);
    const p = store.getState().project;
    return {
      sub: p.content.find((n) => n.id === "sub").rect,
      inScene: p.scenes.find((s) => s.id === "in").position,
      nested: p.scenes.find((s) => s.id === "out").position,
    };
  });
  check("moving a group carries its scenes and its sub-groups by the same delta",
    r.sub.x === 150 && r.sub.y === 150 && r.inScene.x === 200 && r.inScene.y === 200 &&
      r.nested.x === 200 && r.nested.y === 200,
    `sub at ${r.sub.x},${r.sub.y}; scenes at ${r.inScene.x},${r.inScene.y} and ${r.nested.x},${r.nested.y}`);

  // 4 — dragging a sub-group clear of its parent re-files it at the root
  r = await api(() => {
    const store = window.__scriareProjectStore;
    store.getState().updateFolderRect("sub", { x: 2000, y: 2000, width: 300, height: 200 }, true);
    const p = store.getState().project;
    return {
      parent: p.content.find((n) => n.id === "sub").parentId,
      carried: p.scenes.find((s) => s.id === "out").position,
    };
  });
  check("dragging a sub-group out of its parent re-files it in the tree",
    r.parent === null, `parent is ${r.parent}`);
  check("...and its scenes travel with it", r.carried.x === 2050 && r.carried.y === 2050,
    `scene at ${r.carried.x},${r.carried.y}`);

  // 5 — dropping a group wholly inside another files it under that one
  r = await api(() => {
    const store = window.__scriareProjectStore;
    store.getState().updateFolderRect("sub", { x: 850, y: 50, width: 300, height: 200 }, true);
    return store.getState().project.content.find((n) => n.id === "sub").parentId;
  });
  check("dropping a group wholly inside another files it under that one", r === "side", `parent is ${r}`);

  // 6 — a resize never re-files, however the corners land
  r = await api(() => {
    const store = window.__scriareProjectStore;
    store.getState().updateFolderRect("sub", { x: 850, y: 50, width: 3000, height: 2000 }, false);
    return store.getState().project.content.find((n) => n.id === "sub").parentId;
  });
  check("resizing a group never re-files it", r === "side", `parent is ${r}`);

  // 7 — a child resized past its parent's edge GROWS the parent, so the
  // picture can never contradict the tree
  r = await api(() => {
    const p = window.__scriareProjectStore.getState().project;
    const side = p.content.find((n) => n.id === "side").rect;
    const sub = p.content.find((n) => n.id === "sub").rect;
    return {
      fits:
        sub.x >= side.x && sub.y >= side.y &&
        sub.x + sub.width <= side.x + side.width &&
        sub.y + sub.height <= side.y + side.height,
      side, sub,
    };
  });
  check("a group resized past its parent grows the parent to contain it", r.fits,
    `parent ${r.side.width}x${r.side.height} at ${r.side.x},${r.side.y}; child ${r.sub.width}x${r.sub.height} at ${r.sub.x},${r.sub.y}`);

  // 8 — folding hides everything inside, at every depth
  await seedGroups();
  r = await api(() => {
    const store = window.__scriareProjectStore;
    const { hiddenSceneIds } = window.__scriareGroupUtils;
    store.getState().toggleFolderCollapsed("chapter");
    const p = store.getState().project;
    return {
      collapsed: p.content.find((n) => n.id === "chapter").collapsed,
      hidden: [...hiddenSceneIds(p)],
    };
  });
  check("folding a group hides its scenes", r.collapsed === true && r.hidden.join() === "in",
    `hidden: [${r.hidden}]`);

  r = await api(() => {
    const store = window.__scriareProjectStore;
    const { hiddenSceneIds } = window.__scriareGroupUtils;
    store.getState().toggleFolderCollapsed("chapter");
    return [...hiddenSceneIds(store.getState().project)].length;
  });
  check("unfolding brings them back", r === 0, `${r} still hidden`);

  // 9 — the frame migration: an old project converts without rearranging
  // anything the writer filed by hand.
  r = await api(() => {
    const { normalizeProject } = window.__scriareProjectTypes;
    const legacy = {
      id: "p", name: "Old", createdAt: "", updatedAt: "", startSceneId: "s1",
      scenes: [
        { id: "s1", title: "Loose", content: { type: "doc", content: [] }, position: { x: 0, y: 0 }, frameId: "fr1" },
        { id: "s2", title: "Filed", content: { type: "doc", content: [] }, position: { x: 0, y: 0 }, frameId: "fr1" },
      ],
      frames: [
        { id: "fr1", title: "Old Frame", position: { x: 10, y: 20 }, size: { width: 400, height: 300 } },
        { id: "fr2", title: "Empty Frame", position: { x: 0, y: 0 }, size: { width: 200, height: 200 } },
      ],
      content: [
        { id: "own", kind: "folder", category: "story", parentId: null, order: 0, name: "Hand-made" },
        { id: "s1", kind: "leaf", category: "story", parentId: null, order: 1, refType: "scene" },
        { id: "s2", kind: "leaf", category: "story", parentId: "own", order: 0, refType: "scene" },
      ],
      favorites: [], variables: [],
    };
    const p = normalizeProject(legacy);
    const folder = p.content.find((n) => n.id === "fr1");
    return {
      hasFramesKey: "frames" in p,
      folderName: folder?.name,
      rect: folder?.rect,
      s1Parent: p.content.find((n) => n.id === "s1").parentId,
      s2Parent: p.content.find((n) => n.id === "s2").parentId,
      emptyKept: Boolean(p.content.find((n) => n.id === "fr2")),
      frameIdGone: !("frameId" in p.scenes[0]),
    };
  });
  check("a frame becomes a folder carrying its rectangle",
    r.folderName === "Old Frame" && r.rect?.x === 10 && r.rect?.width === 400,
    `"${r.folderName}" at ${r.rect?.x},${r.rect?.y} ${r.rect?.width}x${r.rect?.height}`);
  check("a scene that was only in a frame moves into the new folder",
    r.s1Parent === "fr1", `parent is ${r.s1Parent}`);
  check("a scene the writer had already filed by hand is NOT moved",
    r.s2Parent === "own", `parent is ${r.s2Parent}`);
  check("an empty frame survives as an empty folder", r.emptyKept);
  check("the legacy fields are dropped once converted",
    r.hasFramesKey === false && r.frameIdGone === true,
    `frames key present: ${r.hasFramesKey}, frameId present: ${!r.frameIdGone}`);

  // 10 — Auto Layout reaches inside groups (v0.29.0). Before this, a
  // group's contents were deliberately left alone, so there was no way to
  // tidy the inside of a chapter at all.
  await api(() => {
    const store = window.__scriareProjectStore;
    const now = new Date().toISOString();
    const ch = (t) =>
      window.__scriareChoiceUtils.buildChoiceBlockNode(
        [{ id: "o" + t, text: "go", targetSceneId: t }],
        "b" + t,
      );
    const sc = (id, title, x, y, links = []) => ({
      id, title,
      content: { type: "doc", content: [{ type: "paragraph" }, ...links.map(ch)] },
      position: { x, y }, order: 0,
    });
    store.setState({
      project: {
        name: "Messy", createdAt: now, updatedAt: now,
        // Three scenes inside one chapter, in a deliberately terrible
        // arrangement: a chain a→b→c scattered so that b is far left of a.
        scenes: [
          sc("a", "A", 900, 700, ["b"]),
          sc("b", "B", 100, 30, ["c"]),
          sc("c", "C", 500, 450, []),
          sc("loose", "Loose", 2000, 2000, []),
        ],
        content: [
          {
            id: "chap", kind: "folder", category: "story", parentId: null, order: 0,
            name: "Chapter", rect: { x: 0, y: 0, width: 1200, height: 900 },
          },
          { id: "a", kind: "leaf", category: "story", parentId: "chap", order: 0, refType: "scene" },
          { id: "b", kind: "leaf", category: "story", parentId: "chap", order: 1, refType: "scene" },
          { id: "c", kind: "leaf", category: "story", parentId: "chap", order: 2, refType: "scene" },
          { id: "loose", kind: "leaf", category: "story", parentId: null, order: 1, refType: "scene" },
        ],
        favorites: [], variables: [], startSceneId: "a",
      },
      filePath: null, selectedSceneId: "a", saveStatus: "saved", isPlaying: false,
      canUndo: false, canRedo: false, undoLabel: null, redoLabel: null, undoToken: null,
    });
  });

  r = await api(() => {
    const store = window.__scriareProjectStore;
    const before = store.getState().project.scenes.map((s) => `${s.id}:${s.position.x},${s.position.y}`);
    store.getState().autoLayoutScenes();
    const p = store.getState().project;
    const pos = Object.fromEntries(p.scenes.map((s) => [s.id, s.position]));
    const rect = p.content.find((n) => n.id === "chap").rect;
    return { before, pos, rect };
  });
  check("Auto Layout arranges the scenes INSIDE a group",
    r.pos.a.x < r.pos.b.x && r.pos.b.x < r.pos.c.x,
    `a.x=${r.pos.a.x} b.x=${r.pos.b.x} c.x=${r.pos.c.x} (must follow the a→b→c chain left to right)`);

  check("every scene in the group ends up inside its box",
    ["a", "b", "c"].every(
      (id) =>
        r.pos[id].x >= r.rect.x &&
        r.pos[id].y >= r.rect.y &&
        r.pos[id].x + 180 <= r.rect.x + r.rect.width &&
        r.pos[id].y + 56 <= r.rect.y + r.rect.height,
    ),
    `box ${r.rect.width}x${r.rect.height} at ${r.rect.x},${r.rect.y}`);

  check("the group shrinks to fit what it actually holds",
    r.rect.width < 1200 && r.rect.height < 900,
    `was 1200x900, now ${r.rect.width}x${r.rect.height}`);

  check("a loose scene is laid out too, and clear of the group",
    r.pos.loose.x !== 2000 || r.pos.loose.y !== 2000,
    `loose at ${r.pos.loose.x},${r.pos.loose.y}`);

  // 11 — and it's one undo step, which is the whole reason it's allowed to
  // be this destructive.
  r = await api(() => {
    const store = window.__scriareProjectStore;
    store.getState().undo();
    const p = store.getState().project;
    return {
      a: p.scenes.find((s) => s.id === "a").position,
      rect: p.content.find((n) => n.id === "chap").rect,
    };
  });
  check("one undo puts the whole layout back",
    r.a.x === 900 && r.a.y === 700 && r.rect.width === 1200,
    `a back at ${r.a.x},${r.a.y}; box ${r.rect.width}x${r.rect.height}`);

  // 12 — nested groups are laid out innermost-first, so a parent sizes
  // itself around a child that has already been arranged.
  r = await api(() => {
    const store = window.__scriareProjectStore;
    const p = store.getState().project;
    store.setState({
      project: {
        ...p,
        content: [
          ...p.content.map((n) =>
            n.id === "a" || n.id === "b" ? { ...n, parentId: "inner" } : n,
          ),
          {
            id: "inner", kind: "folder", category: "story", parentId: "chap", order: 3,
            name: "Inner", rect: { x: 10, y: 10, width: 300, height: 200 },
          },
        ],
      },
    });
    store.getState().autoLayoutScenes();
    const q = store.getState().project;
    const outer = q.content.find((n) => n.id === "chap").rect;
    const inner = q.content.find((n) => n.id === "inner").rect;
    return { outer, inner };
  });
  check("a nested group ends up fully inside its parent after Auto Layout",
    r.inner.x >= r.outer.x && r.inner.y >= r.outer.y &&
      r.inner.x + r.inner.width <= r.outer.x + r.outer.width &&
      r.inner.y + r.inner.height <= r.outer.y + r.outer.height,
    `outer ${r.outer.width}x${r.outer.height} at ${r.outer.x},${r.outer.y}; inner ${r.inner.width}x${r.inner.height} at ${r.inner.x},${r.inner.y}`);

  // 13 — a group made in the Content Browser appears on the graph as soon
  // as it holds a scene (v0.31.0). Before this, the tree could say "this
  // scene lives in Chapter Two" while the canvas showed it loose with no
  // box at all — a softer version of exactly the drift v0.28.0 killed.
  const drawn = () =>
    api(() => {
      const p = window.__scriareProjectStore.getState().project;
      return window.__scriareGroupUtils
        .graphGroups(p.content, p.scenes)
        .map((g) => `${g.name}${g.derived ? ":derived" : ":stored"}`);
    });

  await api(() => {
    const store = window.__scriareProjectStore;
    const now = new Date().toISOString();
    store.setState({
      project: {
        name: "Sym", createdAt: now, updatedAt: now,
        scenes: [
          { id: "s1", title: "One", position: { x: 100, y: 100 }, order: 0,
            content: { type: "doc", content: [{ type: "paragraph" }] } },
          { id: "s2", title: "Two", position: { x: 400, y: 100 }, order: 0,
            content: { type: "doc", content: [{ type: "paragraph" }] } },
        ],
        content: [
          { id: "s1", kind: "leaf", category: "story", parentId: null, order: 0, refType: "scene" },
          { id: "s2", kind: "leaf", category: "story", parentId: null, order: 1, refType: "scene" },
          // Made in the Content Browser: no rect of its own.
          { id: "ch", kind: "folder", category: "story", parentId: null, order: 2, name: "Chapter" },
        ],
        favorites: [], variables: [], startSceneId: "s1",
      },
      filePath: null, selectedSceneId: "s1", saveStatus: "saved", isPlaying: false,
      canUndo: false, canRedo: false, undoLabel: null, redoLabel: null, undoToken: null,
    });
  });

  r = await drawn();
  check("an EMPTY group made in Content is not drawn on the graph", r.length === 0,
    `drawn: [${r}]`);

  await api(() => window.__scriareProjectStore.getState().moveContentNode("s1", "ch", 0));
  r = await drawn();
  check("it appears the moment it holds a scene",
    r.length === 1 && r[0] === "Chapter:derived", `drawn: [${r}]`);

  // The derived box must actually bound its scene — a box that doesn't
  // contain its own contents is the bug, not the fix.
  r = await api(() => {
    const p = window.__scriareProjectStore.getState().project;
    const g = window.__scriareGroupUtils.graphGroups(p.content, p.scenes)[0];
    const s = p.scenes.find((x) => x.id === "s1");
    return {
      fits:
        s.position.x >= g.rect.x && s.position.y >= g.rect.y &&
        s.position.x + 180 <= g.rect.x + g.rect.width &&
        s.position.y + 56 <= g.rect.y + g.rect.height,
      rect: g.rect, pos: s.position,
    };
  });
  check("the derived box bounds its own scene", r.fits,
    `box ${r.rect.width}x${r.rect.height} at ${r.rect.x},${r.rect.y}; scene at ${r.pos.x},${r.pos.y}`);

  // 14 — a derived box is still a real target: dropping another scene in
  // files it, and dragging one out un-files it, exactly as a stored box.
  r = await api(() => {
    const store = window.__scriareProjectStore;
    const p = store.getState().project;
    const g = window.__scriareGroupUtils.graphGroups(p.content, p.scenes)[0];
    store.getState().updateScenePosition("s2", { x: g.rect.x + 20, y: g.rect.y + 40 });
    return store.getState().project.content.find((n) => n.id === "s2").parentId;
  });
  check("a scene dropped into a derived box joins that group", r === "ch", `parent is ${r}`);

  r = await api(() => {
    const store = window.__scriareProjectStore;
    store.getState().updateScenePosition("s2", { x: 3000, y: 3000 });
    return store.getState().project.content.find((n) => n.id === "s2").parentId;
  });
  check("a scene dragged clear of a derived box leaves the group", r === null, `parent is ${r}`);

  // 15 — touching the box is what makes its geometry real
  r = await api(() => {
    const store = window.__scriareProjectStore;
    const p = store.getState().project;
    const g = window.__scriareGroupUtils.graphGroups(p.content, p.scenes)[0];
    store.getState().updateFolderRect("ch", { ...g.rect, x: g.rect.x + 100 }, true);
    const after = store.getState().project.content.find((n) => n.id === "ch");
    return { stored: Boolean(after.rect), x: after.rect?.x, wasAt: g.rect.x };
  });
  check("moving a derived box stores its geometry from where it appeared",
    r.stored && r.x === r.wasAt + 100, `stored: ${r.stored}, x ${r.wasAt} → ${r.x}`);

  // 16 — emptying a group takes its box away again rather than leaving a
  // stored rectangle around nothing... unless the writer gave it one.
  r = await api(() => {
    const store = window.__scriareProjectStore;
    store.getState().updateScenePosition("s1", { x: 5000, y: 5000 });
    const p = store.getState().project;
    return {
      s1Parent: p.content.find((n) => n.id === "s1").parentId,
      stillDrawn: window.__scriareGroupUtils.graphGroups(p.content, p.scenes).length,
    };
  });
  check("a group the writer has placed keeps its box even when emptied",
    r.s1Parent === null && r.stillDrawn === 1,
    `s1's parent: ${r.s1Parent}, groups drawn: ${r.stillDrawn}`);

  // 17 — THE FOLDED HIT-AREA BUG (v0.31.1). A folded group shrinks to a
  // small block on screen but keeps its real dimensions for when it
  // unfolds. Hit-testing against those real dimensions meant a folded
  // chapter went on silently swallowing anything dropped anywhere in the
  // large area it used to occupy — an invisible target, which is the worst
  // kind of target. Verified to fail on a build that tests `rect`.
  const seedFolded = () =>
    api(() => {
      const store = window.__scriareProjectStore;
      const now = new Date().toISOString();
      const scene = (id, title, x, y) => ({
        id, title, position: { x, y }, order: 0,
        content: { type: "doc", content: [{ type: "paragraph" }] },
      });
      store.setState({
        project: {
          name: "Folded", createdAt: now, updatedAt: now,
          scenes: [scene("in", "Inside", 100, 100), scene("loose", "Loose", 2000, 2000)],
          content: [
            // A big box, folded. On screen it is only 236x78 at (0,0).
            { id: "chap", kind: "folder", category: "story", parentId: null, order: 0,
              name: "Chapter", rect: { x: 0, y: 0, width: 900, height: 700 }, collapsed: true },
            { id: "in", kind: "leaf", category: "story", parentId: "chap", order: 0, refType: "scene" },
            { id: "loose", kind: "leaf", category: "story", parentId: null, order: 1, refType: "scene" },
          ],
          favorites: [], variables: [], startSceneId: "in",
        },
        filePath: null, selectedSceneId: "in", saveStatus: "saved", isPlaying: false,
        canUndo: false, canRedo: false, undoLabel: null, redoLabel: null, undoToken: null,
      });
    });

  await seedFolded();
  r = await api(() => {
    // Well inside the folded group's STORED rectangle, well outside the
    // block actually drawn — the exact spot the bug report describes.
    window.__scriareProjectStore.getState().updateScenePosition("loose", { x: 500, y: 400 });
    return window.__scriareProjectStore.getState().project.content.find((n) => n.id === "loose")
      .parentId;
  });
  check("a scene dropped in a folded group's EMPTY footprint is not swallowed",
    r === null, `parent is ${r}`);

  // Dropping on the block you can actually see still files it — that's a
  // real gesture, and the only one a folded group should answer to.
  await seedFolded();
  r = await api(() => {
    window.__scriareProjectStore.getState().updateScenePosition("loose", { x: 40, y: 20 });
    return window.__scriareProjectStore.getState().project.content.find((n) => n.id === "loose")
      .parentId;
  });
  check("a scene dropped ON the folded block still joins that group", r === "chap",
    `parent is ${r}`);

  // Unfolded, the whole box is a target again.
  r = await api(() => {
    const store = window.__scriareProjectStore;
    store.getState().toggleFolderCollapsed("chap");
    store.getState().updateScenePosition("loose", { x: 500, y: 400 });
    return store.getState().project.content.find((n) => n.id === "loose").parentId;
  });
  check("unfolded, the full box is a drop target again", r === "chap", `parent is ${r}`);

  // 18 — folding a group takes its SUB-groups off screen too, so a folded
  // chapter can't leave a sub-chapter's box floating over empty canvas.
  r = await api(() => {
    const store = window.__scriareProjectStore;
    const p = store.getState().project;
    store.setState({
      project: {
        ...p,
        content: [
          ...p.content,
          { id: "sub", kind: "folder", category: "story", parentId: "chap", order: 5,
            name: "Sub", rect: { x: 50, y: 50, width: 300, height: 200 } },
        ],
      },
    });
    const { graphGroups } = window.__scriareGroupUtils;
    const q = store.getState().project;
    const unfolded = graphGroups(q.content, q.scenes).filter((g) => !g.hidden).map((g) => g.name);
    store.getState().toggleFolderCollapsed("chap");
    const t = store.getState().project;
    const folded = graphGroups(t.content, t.scenes).filter((g) => !g.hidden).map((g) => g.name);
    return { unfolded, folded };
  });
  check("folding a group hides its sub-groups as well",
    r.unfolded.length === 2 && r.folded.join() === "Chapter",
    `unfolded: [${r.unfolded}] → folded: [${r.folded}]`);

  // ...and a hidden sub-group can't catch a drop either.
  r = await api(() => {
    const store = window.__scriareProjectStore;
    store.getState().updateScenePosition("loose", { x: 100, y: 100 });
    return store.getState().project.content.find((n) => n.id === "loose").parentId;
  });
  check("a hidden sub-group cannot catch a drop", r === null, `parent is ${r}`);

  await seedProject();
}
