/**
 * The Inspector follows the caret into a choice (v0.33.1).
 *
 * Reported: with the caret sitting in a choice label, being typed into,
 * the Inspector still showed Scene Properties and the words "Select a
 * Choice Block in the document to edit its choices" — advice the writer was
 * already following.
 *
 * The cause was historical. Before v0.32.0 a Choice Block was an atom, so
 * the only way to be "in" one was a NodeSelection over the whole block, and
 * that is what SceneEditor's onSelectionUpdate looked for. Once labels
 * became real text, the ordinary way to work on a choice — put the caret in
 * it — stopped matching anything.
 *
 * Two things are asserted, and the second is the one that makes the panel
 * useful rather than merely correct: the Inspector must open ON THE OPTION
 * THE CARET IS IN. A block with six choices that opens them all collapsed
 * is still a search.
 *
 * Both were verified to fail on the previous build.
 */
export default async function ({ api, check, seedProject }) {
  const target = () => api(() => window.__scriareInspectorStore.getState().target);

  const putCaret = (optionId) =>
    api((id) => {
      const editor = window.__scriareEditorStore.getState().editor;
      let pos = -1;
      editor.state.doc.descendants((node, at) => {
        if (pos !== -1) return false;
        if (id === null && node.type.name === "paragraph") pos = at + 1;
        if (id !== null && node.type.name === "choiceOption" && node.attrs.optionId === id) {
          pos = at + 1;
        }
        return true;
      });
      if (pos === -1) return false;
      editor.chain().focus().setTextSelection(pos).run();
      return true;
    }, optionId);

  const settle = () => new Promise((r) => setTimeout(r, 180));

  await api(() => {
    const store = window.__scriareProjectStore;
    const editor = window.__scriareEditorStore.getState().editor;
    store.getState().selectScene?.("s1");
    // `true` = emit the update, so the project store gets this document
    // too. Without it the editor and the saved scene disagree, and the
    // Inspector — which reads the SCENE, not the editor — would find no
    // such block and clear itself, which is correct behaviour answering a
    // question the test never meant to ask.
    editor.commands.setContent({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "The door is locked." }] },
        window.__scriareChoiceUtils.buildChoiceBlockNode(
          [
            { id: "o1", text: "Unlock the door", targetSceneId: "s2" },
            { id: "o2", text: "Force it open", targetSceneId: "s3" },
          ],
          "b1",
        ),
      ],
    }, true);
  });

  // 1 — prose is Scene Properties, as it always was.
  await putCaret(null);
  await settle();
  let t = await target();
  check("the caret in prose shows Scene Properties", t.kind === "scene", `target: ${t.kind}`);

  // 2 — the caret in a choice opens that block, with the option it's in.
  await putCaret("o1");
  await settle();
  t = await target();
  check("typing in a choice opens that Choice Block in the Inspector",
    t.kind === "choice" && t.blockId === "b1", JSON.stringify(t));
  check("...on the option the caret is actually in",
    t.optionId === "o1", `optionId: ${t.optionId}`);

  // 3 — and the panel really opens THAT option's controls, rather than
  // listing every choice collapsed and leaving the writer to find theirs.
  const openState = () =>
    api(() => {
      const rows = [...document.querySelectorAll("[data-option-id]")].filter((el) =>
        el.hasAttribute("data-expanded"),
      );
      return {
        rows: rows.map((el) => `${el.dataset.optionId}:${el.dataset.expanded}`),
        // "Destination" only exists inside an expanded accordion.
        expandedHasControls: rows
          .filter((el) => el.dataset.expanded === "true")
          .every((el) => el.innerText.toUpperCase().includes("DESTINATION")),
        stillAsking: document.body.innerText.includes("Select a Choice Block in the document"),
      };
    });

  let panel = await openState();
  check("the caret's own option is the one opened",
    panel.rows.join(" ") === "o1:true o2:false", panel.rows.join(" "));
  check("...and opened means its controls are there, not just a summary",
    panel.expandedHasControls);
  check("the Inspector stops telling the writer to select what they're already in",
    panel.stillAsking === false);

  // 4 — moving to the next choice follows, and closes the one it opened.
  // Anything the writer opened by hand is left alone; this only takes back
  // what it opened itself.
  await putCaret("o2");
  await settle();
  t = await target();
  check("moving the caret to another choice follows it",
    t.kind === "choice" && t.blockId === "b1" && t.optionId === "o2", JSON.stringify(t));
  panel = await openState();
  check("the accordion the caret opened follows it rather than piling up",
    panel.rows.join(" ") === "o1:false o2:true", panel.rows.join(" "));

  // 5 — adding a choice from the block's own button lands the writer in
  // the new one, so the Inspector should already be on it. This is the
  // other half of "the panel should open as soon as I touch the block":
  // the first thing anyone does after adding a choice is say where it goes.
  const before = (await target()).optionId;
  await api(() => {
    const add = [...document.querySelectorAll(".ProseMirror button")].find((b) =>
      b.textContent?.includes("Add Choice"),
    );
    add?.click();
  });
  await settle();
  t = await target();
  check("adding a choice in the editor opens the new one in the Inspector",
    t.kind === "choice" && typeof t.optionId === "string" && t.optionId !== before,
    JSON.stringify(t));

  // 6 — leaving the block returns to Scene Properties.
  await putCaret(null);
  await settle();
  t = await target();
  check("leaving the choice returns to Scene Properties", t.kind === "scene", `target: ${t.kind}`);

  await seedProject();
}
