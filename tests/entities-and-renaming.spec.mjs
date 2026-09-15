/**
 * The three things a writer found by using the app (v0.39.0).
 *
 * All three are the same shape of defect: something was built and then not
 * connected to the way people actually reach it.
 *
 *  - A Character could not be DELETED. `deleteEntity` had been in the store
 *    since v0.35.0, correct and undoable. Its row had no context menu, so
 *    nothing in the interface ever called it.
 *  - F2 did not rename anything. Renaming existed for scenes and groups
 *    through a menu and a double-click, and for entities not at all.
 *  - Selecting text in a Group's name on the Story Graph dragged the group.
 *    The input guarded `mousedown`; React Flow drags from `pointerdown`.
 *
 * The third is the one worth testing carefully, because the wrong version
 * LOOKED like it worked: a plain click landed the caret fine. Only a
 * press-and-move — the gesture that selects text — moved the node. So the
 * test performs that gesture and measures whether the group travelled.
 */
export default async function ({ page, api, check, seedProject }) {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // ── A story with two characters and a location ───────────────────────
  await api(() => {
    const store = window.__scriareProjectStore;
    const now = new Date().toISOString();
    const page = (t) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: t }] }] });
    store.setState({
      project: {
        name: "Cast", createdAt: now, updatedAt: now,
        scenes: [{
          id: "s1", title: "Only Scene", position: { x: 0, y: 0 }, order: 0, frameId: null,
          content: {
            type: "doc",
            content: [{
              type: "paragraph",
              content: [
                { type: "mention", attrs: { entityId: "e1", label: "Mara" } },
                { type: "text", text: " waited." },
              ],
            }],
          },
        }],
        content: [
          { id: "s1", kind: "leaf", category: "story", parentId: null, order: 0, refType: "scene" },
          { id: "e1", kind: "leaf", category: "characters", parentId: null, order: 0, refType: "character" },
          { id: "e2", kind: "leaf", category: "characters", parentId: null, order: 1, refType: "character" },
          { id: "l1", kind: "leaf", category: "locations", parentId: null, order: 0, refType: "location" },
        ],
        favorites: [], variables: [],
        entities: [
          { id: "e1", kind: "character", name: "Mara", aliases: [], content: page("Her page.") },
          { id: "e2", kind: "character", name: "Ercüment", aliases: [], content: page("His page.") },
          { id: "l1", kind: "location", name: "İstanbul", aliases: [], content: page("The city.") },
        ],
        choiceStyles: window.__scriareChoiceStyles.normalizeChoiceStyles(undefined),
        startSceneId: "s1",
      },
      filePath: null, selectedSceneId: "s1", selectedEntityId: null, saveStatus: "saved",
      isPlaying: false, canUndo: false, canRedo: false, undoLabel: null, redoLabel: null, undoToken: null,
    });
  });
  await wait(400);

  // Open both category sections so the rows are on screen.
  await api(() => {
    document.querySelector('[data-category="root:characters"]')?.click();
    document.querySelector('[data-category="root:locations"]')?.click();
  });
  await wait(300);
  let r = await api(() => document.querySelectorAll("[data-entity-row]").length);
  check("the cast is listed in the Content Browser", r === 3, `${r} rows`);

  // ── 1. Deleting a character ──────────────────────────────────────────
  await api(() => {
    const row = document.querySelector('[data-entity-row="e1"]');
    row.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 60, clientY: 200 }));
  });
  await wait(250);
  r = await api(() =>
    [...document.querySelectorAll("button")].map((b) => b.textContent.trim()).filter((t) =>
      ["Rename", "Delete Character", "Delete Location"].includes(t),
    ),
  );
  check("right-clicking a character offers to rename and delete it",
    r.includes("Rename") && r.includes("Delete Character"), JSON.stringify(r));

  await api(() => {
    [...document.querySelectorAll("button")]
      .find((b) => b.textContent.trim() === "Delete Character")
      ?.click();
  });
  await wait(300);
  r = await api(() => {
    const p = window.__scriareProjectStore.getState().project;
    return {
      entities: p.entities.map((e) => e.name),
      // The leaf goes with her — a row pointing at nothing is worse than
      // no row.
      leaf: p.content.some((n) => n.id === "e1"),
      // Her name stays in the sentence. Deleting a character must never
      // blank out somebody's prose.
      prose: p.scenes[0].content.content[0].content.map((n) => n.attrs?.label ?? n.text).join(""),
      toast: document.body.innerText.includes('Deleted "Mara"'),
    };
  });
  check("a character can be deleted, and her row goes with her",
    r.entities.join() === "Ercüment,İstanbul" && r.leaf === false, JSON.stringify(r.entities));
  check("...without taking a word of the prose with it", r.prose === "Mara waited.", r.prose);
  check("...and it is as undoable and as loud as deleting a scene", r.toast,
    r.toast ? "undo toast shown" : "no undo toast");

  await api(() => window.__scriareProjectStore.getState().undo());
  await wait(300);
  r = await api(() => window.__scriareProjectStore.getState().project.entities.map((e) => e.name));
  check("...and undo brings her back", r.join() === "Mara,Ercüment,İstanbul", JSON.stringify(r));

  // ── 2. F2 ────────────────────────────────────────────────────────────
  // A scene first: F2 has to mean the same thing everywhere in the panel.
  await api(() => {
    // Clicked, not poked into the store: the panel's multi-selection is
    // component state, and claiming the keyboard happens on pointer-down.
    const label = document.querySelector('[data-content-label="s1"]');
    label.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    label.click();
  });
  await wait(250);
  await api(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "F2", bubbles: true })));
  await wait(250);
  r = await api(() => {
    // The rename box REPLACES the label, so it's read from the row.
    const input = document.querySelector('[data-content-row="s1"] input');
    return { open: Boolean(input), value: input?.value ?? null };
  });
  check("F2 renames the selected scene", r.open && r.value === "Only Scene", JSON.stringify(r));
  await api(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  await wait(150);

  // And a character, which had no rename at all.
  await api(() => {
    document.querySelector('[data-entity-row="e2"]').click();
  });
  await wait(250);
  await api(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "F2", bubbles: true })));
  await wait(250);
  r = await api(() => {
    const input = document.querySelector("[data-entity-rename]");
    return { open: Boolean(input), value: input?.value ?? null };
  });
  check("F2 renames the selected character too", r.open && r.value === "Ercüment", JSON.stringify(r));

  await api(() => {
    const input = document.querySelector("[data-entity-rename]");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, "Ercüment Çökertme");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  await wait(300);
  r = await api(() => window.__scriareProjectStore.getState().project.entities.map((e) => e.name));
  check("...and the new name is the character's, not a copy of it",
    r.includes("Ercüment Çökertme"), JSON.stringify(r));

  // F2 while writing belongs to the writing.
  await api(() => {
    const editor = window.__scriareEditorStore.getState().editor;
    editor.chain().focus().run();
  });
  await wait(200);
  await api(() => {
    document.querySelector(".ProseMirror").dispatchEvent(
      new KeyboardEvent("keydown", { key: "F2", bubbles: true }),
    );
  });
  await wait(250);
  r = await api(() => Boolean(document.querySelector("[data-entity-rename]")));
  check("F2 with the caret in a sentence does nothing, like every other key",
    r === false);

  // ── 3. The Group name on the Story Graph ─────────────────────────────
  // One scene, well clear of the group's box. The first version of this
  // ran against the seeded story and its drag landed on a scene node
  // sitting over the group: nothing moved and nothing was selected, which
  // looked exactly like the bug and was the test missing the target. The
  // group's rectangle is stated here rather than left to where the "+
  // Group" button happens to drop one, so the geometry is the test's.
  await api(() => {
    const store = window.__scriareProjectStore;
    const now = new Date().toISOString();
    store.setState({
      project: {
        name: "Graph", createdAt: now, updatedAt: now,
        scenes: [{
          id: "s9", title: "Far Away", position: { x: 640, y: 40 }, order: 0, frameId: null,
          content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }] },
        }],
        content: [
          { id: "g9", kind: "folder", category: "story", parentId: null, order: 0,
            name: "Group", rect: { x: 0, y: 0, width: 420, height: 300 } },
          { id: "s9", kind: "leaf", category: "story", parentId: null, order: 1, refType: "scene" },
        ],
        favorites: [], variables: [], entities: [],
        choiceStyles: window.__scriareChoiceStyles.normalizeChoiceStyles(undefined),
        startSceneId: "s9",
      },
      filePath: null, selectedSceneId: "s9", selectedEntityId: null, saveStatus: "saved",
      isPlaying: false, canUndo: false, canRedo: false, undoLabel: null, redoLabel: null, undoToken: null,
    });
  });
  await wait(800);

  // Driven with the REAL mouse rather than synthesised PointerEvents. The
  // first version dispatched its own events and both the assertion and its
  // control came back "didn't move" — React Flow's drag never started, so
  // "the group stayed put" was true for the wrong reason. Playwright's
  // mouse produces trusted input, which is the only kind a drag library is
  // obliged to believe.
  let boxes = await api(() => {
    const input = document.querySelector('.react-flow input[placeholder="Group name"]');
    if (!input) return null;
    const node = input.closest(".react-flow__node");
    const i = input.getBoundingClientRect();
    const n = node.getBoundingClientRect();
    const name = { x: i.left + 10, y: i.top + i.height / 2 };
    const body = { x: n.left + n.width / 2, y: n.bottom - 20 };
    return {
      name,
      body,
      // What is actually under each point. Asserted below, because a drag
      // that lands on the wrong element reports "nothing moved" and reads
      // like a pass.
      underName: document.elementFromPoint(name.x, name.y)?.tagName ?? null,
      underBody: document.elementFromPoint(body.x, body.y)?.className ?? null,
    };
  });
  check("a Group's name field is on the canvas", boxes !== null);
  check("...and the drag lands on the name field itself, not something over it",
    boxes.underName === "INPUT", `under the point: ${boxes.underName}`);

  const dragFrom = async (point) => {
    const before = await api(() => document.querySelector(".react-flow__node")?.style.transform);
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    for (let step = 1; step <= 5; step += 1) {
      await page.mouse.move(point.x + step * 12, point.y);
      await wait(25);
    }
    await page.mouse.up();
    await wait(250);
    return api((seen) => {
      const input = document.querySelector('.react-flow input[placeholder="Group name"]');
      return {
        before: seen,
        after: document.querySelector(".react-flow__node")?.style.transform,
        // The reported symptom, and the one that matters: whether the drag
        // SELECTED any of the name. A group that doesn't move is only half
        // of "renaming works" — if the graph takes the pointer, the browser
        // never extends the selection and the writer can't grab the word
        // they meant to replace.
        selected: input ? input.selectionEnd - input.selectionStart : -1,
      };
    }, before);
  };

  // The control first, so a dead gesture can't make the real assertion look
  // like a pass: the same drag on the group's body must move it.
  let moved = await dragFrom(boxes.body);
  check("dragging a Group by its body moves it — the control for what follows",
    moved.before !== moved.after, `${moved.before} → ${moved.after}`);

  boxes = await api(() => {
    const input = document.querySelector('.react-flow input[placeholder="Group name"]');
    const i = input.getBoundingClientRect();
    return { name: { x: i.left + 10, y: i.top + i.height / 2 } };
  });
  moved = await dragFrom(boxes.name);
  check("dragging inside a Group's name does not move the group",
    moved.before === moved.after, `${moved.before} → ${moved.after}`);
  check("...and it selects the letters it was dragged across, which is the whole point",
    moved.selected > 0, `${moved.selected} characters selected`);

  // Typing into it still renames, which is the thing the drag was in the
  // way of.
  await api(() => {
    const input = document.querySelector('.react-flow input[placeholder="Group name"]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, "Chapter One");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await wait(300);
  r = await api(() =>
    window.__scriareProjectStore
      .getState()
      .project.content.filter((n) => n.kind === "folder")
      .map((n) => n.name),
  );
  check("...and the name it types is the group's", r.includes("Chapter One"), JSON.stringify(r));

  await seedProject();
}
