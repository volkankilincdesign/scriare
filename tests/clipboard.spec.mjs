/**
 * App-wide Ctrl+C / Ctrl+X / Ctrl+V / Delete (v0.27.0).
 *
 * Two things here are easy to get subtly wrong and impossible to notice by
 * clicking around, so they get the most attention:
 *
 *  - Copying a SET of linked scenes has to rewire the copies to each other.
 *    Otherwise you paste a branch and get two loose scenes both feeding
 *    back into the originals, which looks right in the Content Browser and
 *    is wrong everywhere it matters.
 *  - Copying a folder has to bring its contents, including scenes that
 *    were never selected.
 *
 * Both were verified to FAIL on builds with the relevant logic removed.
 */
export default async function ({ page, api, check, seedProject }) {
  // A richer project than the shared seed: a folder holding two scenes
  // that link to each other, plus one outside it.
  const seedLinked = () =>
    api(() => {
      const store = window.__scriareProjectStore;
      const now = new Date().toISOString();
      const choice = (target) => ({
        type: "choiceBlock",
        attrs: {
          blockId: "b-" + target,
          options: [{ id: "o-" + target, text: "go", targetSceneId: target, actions: [] }],
        },
      });
      const scene = (id, title, links) => ({
        id,
        title,
        content: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: title }] },
            ...links.map(choice),
          ],
        },
        position: { x: 0, y: 0 },
        frameId: null,
        order: 0,
      });
      store.setState({
        project: {
          name: "Linked",
          createdAt: now,
          updatedAt: now,
          scenes: [
            scene("a", "Alpha", ["b", "outside"]),
            scene("b", "Beta", ["a"]),
            scene("outside", "Outside", []),
          ],
          content: [
            { id: "fold", kind: "folder", category: "story", parentId: null, order: 0, name: "Chapter" },
            { id: "a", kind: "leaf", category: "story", parentId: "fold", order: 0, refType: "scene" },
            { id: "b", kind: "leaf", category: "story", parentId: "fold", order: 1, refType: "scene" },
            { id: "outside", kind: "leaf", category: "story", parentId: null, order: 1, refType: "scene" },
          ],
          frames: [],
          favorites: [],
          variables: [],
          startSceneId: "a",
        },
        filePath: null,
        selectedSceneId: "a",
        saveStatus: "saved",
        isPlaying: false,
        canUndo: false,
        canRedo: false,
        undoLabel: null,
        redoLabel: null,
        undoToken: null,
      });
      window.__scriareToastStore?.setState({ toasts: [] });
      window.__scriareSelectionStore?.setState({ surface: "content", contentIds: [], graphIds: [] });
    });

  const targetsOf = (sceneId) =>
    api((id) => {
      const p = window.__scriareProjectStore.getState().project;
      const scene = p.scenes.find((s) => s.id === id);
      const out = [];
      (function walk(n) {
        if (n.type === "choiceBlock") {
          (n.attrs?.options ?? []).forEach((o) => out.push(o.targetSceneId));
          return;
        }
        (n.content ?? []).forEach(walk);
      })(scene.content);
      return out;
    }, sceneId);

  // 1 — copying a folder brings everything inside it
  await seedLinked();
  let r = await api(() => {
    const store = window.__scriareProjectStore;
    const { buildClipboard } = window.__scriareClipboardUtils;
    const clip = buildClipboard(store.getState().project, ["fold"]);
    return {
      nodes: clip.nodes.map((n) => n.id).sort(),
      scenes: clip.scenes.map((s) => s.id).sort(),
    };
  });
  check("copying a folder brings its contents", r.nodes.join() === "a,b,fold" && r.scenes.join() === "a,b",
    `nodes [${r.nodes}], scenes [${r.scenes}]`);

  // 2 — THE ONE THAT MATTERS: pasted copies link to each other, not the originals
  r = await api(() => {
    const store = window.__scriareProjectStore;
    const { buildClipboard } = window.__scriareClipboardUtils;
    const clip = buildClipboard(store.getState().project, ["fold"]);
    const roots = store.getState().pasteContentNodes(clip, null);
    const p = store.getState().project;
    const copies = p.content.filter((n) => !["fold", "a", "b", "outside"].includes(n.id));
    const newFolder = copies.find((n) => n.kind === "folder");
    const newLeaves = copies.filter((n) => n.kind === "leaf");
    return {
      roots,
      total: p.scenes.length,
      newFolderId: newFolder?.id ?? null,
      childrenReparented: newLeaves.every((n) => n.parentId === newFolder?.id),
      copyOfAlpha: p.scenes.find(
        (s) => newLeaves.some((n) => n.id === s.id) && s.title === "Alpha",
      )?.id,
      copyOfBeta: p.scenes.find(
        (s) => newLeaves.some((n) => n.id === s.id) && s.title === "Beta",
      )?.id,
    };
  });
  check("paste creates a new folder with its scenes inside", r.total === 5 && r.childrenReparented && r.roots.length === 1,
    `${r.total} scenes, roots [${r.roots}]`);

  const alphaCopyTargets = await targetsOf(r.copyOfAlpha);
  const betaCopyTargets = await targetsOf(r.copyOfBeta);
  check("a pasted scene links to the OTHER pasted scene, not the original",
    alphaCopyTargets.includes(r.copyOfBeta) && !alphaCopyTargets.includes("b"),
    `Alpha's copy points at [${alphaCopyTargets}], Beta's copy is ${r.copyOfBeta}`);
  check("a link leaving the copied set still points at the original",
    alphaCopyTargets.includes("outside"), `[${alphaCopyTargets}]`);
  check("the reverse link is rewired too",
    betaCopyTargets.includes(r.copyOfAlpha) && !betaCopyTargets.includes("a"),
    `Beta's copy points at [${betaCopyTargets}]`);

  // 3 — the originals are untouched by the paste
  const alphaTargets = await targetsOf("a");
  check("the original's own links are untouched",
    alphaTargets.join() === "b,outside", `[${alphaTargets}]`);

  // 4 — paste is one undo step
  r = await api(() => {
    const store = window.__scriareProjectStore;
    store.getState().undo();
    const p = store.getState().project;
    return { scenes: p.scenes.length, nodes: p.content.length, label: store.getState().redoLabel };
  });
  check("undo removes an entire paste in one step", r.scenes === 3 && r.nodes === 4,
    `back to ${r.scenes} scenes / ${r.nodes} nodes, redo offers "${r.label}"`);

  // 5 — the Delete key acts on the Content Browser selection
  await seedLinked();
  r = await api(() => {
    const sel = window.__scriareSelectionStore;
    sel.setState({ surface: "content", contentIds: ["outside"] });
    document.body.focus();
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Delete", bubbles: true, cancelable: true }),
    );
    const p = window.__scriareProjectStore.getState().project;
    return {
      scenes: p.scenes.map((s) => s.id),
      toast: window.__scriareToastStore.getState().toasts[0]?.message,
    };
  });
  check("Delete removes the selected scene and raises an undo toast",
    r.scenes.join() === "a,b" && Boolean(r.toast), `[${r.scenes}], toast "${r.toast}"`);

  // 6 — Delete inside a text field is not ours
  r = await api(() => {
    const sel = window.__scriareSelectionStore;
    sel.setState({ surface: "content", contentIds: ["a"] });
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Delete", bubbles: true, cancelable: true }),
    );
    const count = window.__scriareProjectStore.getState().project.scenes.length;
    input.remove();
    return count;
  });
  check("Delete in a text field does NOT delete the selected scene", r === 2, `${r} scenes`);

  // 7 — the graph surface only ever offers its scenes, never its frames
  r = await api(() => {
    const store = window.__scriareProjectStore;
    const sel = window.__scriareSelectionStore;
    store.setState({
      project: {
        ...store.getState().project,
        frames: [
          { id: "fr1", title: "F", position: { x: 0, y: 0 }, size: { width: 300, height: 200 }, order: 0 },
        ],
      },
    });
    sel.setState({ surface: "graph", graphIds: ["fr1", "a"] });
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Delete", bubbles: true, cancelable: true }),
    );
    const p = store.getState().project;
    return { scenes: p.scenes.map((s) => s.id), frames: p.frames.map((f) => f.id) };
  });
  check("Delete on a graph selection removes its scenes and leaves frames alone",
    r.scenes.join() === "b" && r.frames.join() === "fr1",
    `scenes [${r.scenes}], frames [${r.frames}]`);

  // 8 — the same thing through the real UI: a click claims the panel, the
  // keys go through the window handler, and the selection published by the
  // Content Browser is the one that gets acted on. Everything above drives
  // the stores; this is the only case that proves they're actually wired
  // to each other.
  await api(() => {
    const store = window.__scriareProjectStore;
    const now = new Date().toISOString();
    const sc = (id, t) => ({
      id,
      title: t,
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: t }] }] },
      position: { x: 0, y: 0 },
      frameId: null,
      order: 0,
    });
    store.setState({
      project: {
        name: "UI",
        createdAt: now,
        updatedAt: now,
        scenes: [sc("s1", "Alpha"), sc("s2", "Beta"), sc("s3", "Gamma")],
        content: ["s1", "s2", "s3"].map((id, i) => ({
          id, kind: "leaf", category: "story", parentId: null, order: i, refType: "scene",
        })),
        frames: [], favorites: [], variables: [], startSceneId: "s1",
      },
      filePath: null, selectedSceneId: "s1", saveStatus: "saved", isPlaying: false,
      canUndo: false, canRedo: false, undoLabel: null, redoLabel: null, undoToken: null,
    });
    window.__scriareToastStore.setState({ toasts: [] });
    window.__scriareSelectionStore.setState({ surface: null, contentIds: [], graphIds: [] });
  });
  await page.waitForTimeout(300);

  const contentPanel = page.locator("aside").first();
  await contentPanel.getByText("Beta", { exact: true }).first().click();
  await page.waitForTimeout(150);

  r = await api(() => window.__scriareSelectionStore.getState());
  check("clicking a row claims the panel and publishes the selection",
    r.surface === "content" && r.contentIds.join() === "s2",
    `surface "${r.surface}", ids [${r.contentIds}]`);

  await page.keyboard.press("Delete");
  await page.waitForTimeout(250);
  r = await api(() => ({
    titles: window.__scriareProjectStore.getState().project.scenes.map((s) => s.title),
    toast: window.__scriareToastStore.getState().toasts[0]?.message,
  }));
  check("a real Delete keypress deletes the clicked row",
    r.titles.join() === "Alpha,Gamma" && Boolean(r.toast),
    `[${r.titles}], toast "${r.toast}"`);

  await contentPanel.getByText("Alpha", { exact: true }).first().click();
  await page.waitForTimeout(150);
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  await page.waitForTimeout(250);
  r = await api(() => window.__scriareProjectStore.getState().project.scenes.map((s) => s.title));
  check("real Ctrl+C then Ctrl+V pastes a copy under a distinct name",
    r.length === 3 && r[2] === "Alpha Copy", `[${r}]`);

  await seedProject();
}
