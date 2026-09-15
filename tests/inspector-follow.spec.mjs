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
        // `.every()` on an empty list is TRUE, so the count is asserted
        // separately below — otherwise an Inspector that isn't on screen
        // at all satisfies this, which is how seven of these tests once
        // passed for everyone but the writer who had collapsed the panel.
        openRows: rows.filter((el) => el.dataset.expanded === "true").length,
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
    panel.openRows === 1 && panel.expandedHasControls,
    `${panel.openRows} open`);
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

  // 6b — WORKING IN THE INSPECTOR MUST NOT CLOSE IT (v0.34.1, reported).
  //
  // Dragging a choice into a new order and releasing the mouse threw the
  // panel back to Scene Properties, mid-edit. Reordering rewrites the
  // block's children, which remaps the editor's selection; releasing the
  // mouse outside the editor can also make ProseMirror resync its selection
  // from the DOM. Either way the caret ends up somewhere neutral, and the
  // selection handler read that as "they've left the choice".
  //
  // The editor being unfocused is what stands in here for "the writer is
  // in the Inspector" — which is exactly the condition the fix turns on.
  await putCaret("o1");
  await settle();
  const beforeEdit = await target();
  let r = await api(() => {
    const editor = window.__scriareEditorStore.getState().editor;
    const idsOf = () => {
      const block = editor.getJSON().content.find((n) => n.type === "choiceBlock");
      return (block?.content ?? []).map((c) => c.attrs.optionId);
    };
    const before = idsOf();
    // Swap the first two, whatever they are — earlier cases in this spec
    // have added a choice, and this one is about the Inspector, not about
    // any particular order.
    editor.commands.blur();
    window.__scriareChoiceEditing.reorderChoiceOptions(editor, "b1", [
      before[1], before[0], ...before.slice(2),
    ]);
    return { before, after: idsOf() };
  });
  await settle();
  t = await target();
  check("reordering really did reorder",
    r.after[0] === r.before[1] && r.after[1] === r.before[0] &&
      r.after.length === r.before.length,
    `${JSON.stringify(r.before)} → ${JSON.stringify(r.after)}`);
  check("an edit made from the Inspector doesn't close the Inspector",
    t.kind === "choice" && t.blockId === beforeEdit.blockId && t.optionId === beforeEdit.optionId,
    `${JSON.stringify(beforeEdit)} → ${JSON.stringify(t)}`);

  // 6c — clicking a Choice Block's own header opens it, by putting the
  // caret in it. Before v0.34.1 the click pointed the Inspector at the
  // block and then ProseMirror placed the caret outside it, so the panel
  // opened and closed within the same click.
  await putCaret(null);
  await settle();
  r = await api(() => {
    const header = [...document.querySelectorAll(".choice-block div")].find((d) =>
      d.textContent?.trim().startsWith("⤷"),
    );
    if (!header) return null;
    const box = header.getBoundingClientRect();
    for (const type of ["mousedown", "mouseup", "click"]) {
      header.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true, cancelable: true,
          clientX: box.x + 30, clientY: box.y + box.height / 2,
        }),
      );
    }
    return true;
  });
  await settle();
  t = await target();
  check("clicking a Choice Block's header opens it in the Inspector",
    r === true && t.kind === "choice" && t.blockId === "b1", JSON.stringify(t));
  check("...and puts the caret inside it, so one rule explains the panel",
    await api(() => {
      const { $from } = window.__scriareEditorStore.getState().editor.state.selection;
      for (let d = $from.depth; d > 0; d -= 1) {
        if ($from.node(d).type.name === "choiceBlock") return true;
      }
      return false;
    }));

  // 7 — the accordions must not FLY (v0.33.2, reported).
  //
  // Opening choices top-down looked broken while bottom-up looked fine,
  // from the same code. Opening choice 2 while 1 is open collapses 1 and
  // expands 2 in one commit, and collapsing 1 lifts 2 hundreds of pixels
  // up the panel — which the list's FLIP animation faithfully played back
  // as the clicked choice racing up from the bottom. Bottom-up hid it
  // because the row that travelled was the one closing, below the one
  // being read.
  //
  // Measured as the actual transform on each row across the frames after
  // the change, because "does it look right" is not a thing a test can
  // ask. On the build before the fix these report 348px.
  const peakTransforms = (fromId, toId) =>
    api(
      async ([from, to]) => {
        const put = (oid) => {
          const editor = window.__scriareEditorStore.getState().editor;
          let pos = -1;
          editor.state.doc.descendants((n, at) => {
            if (pos !== -1) return false;
            if (n.type.name === "choiceOption" && n.attrs.optionId === oid) pos = at + 1;
            return true;
          });
          editor.chain().focus().setTextSelection(pos).run();
        };
        const peak = {};
        put(from);
        await new Promise((r) => setTimeout(r, 300));
        let frames = 0;
        const sample = () => {
          for (const el of document.querySelectorAll("[data-option-id]")) {
            const matrix = getComputedStyle(el.parentElement).transform;
            let ty = 0;
            if (matrix && matrix !== "none") {
              const parts = matrix.match(/matrix\(([^)]+)\)/);
              if (parts) ty = parseFloat(parts[1].split(",")[5]);
            }
            const id = el.dataset.optionId;
            peak[id] = Math.max(peak[id] ?? 0, Math.abs(ty));
          }
          if (++frames < 20) requestAnimationFrame(sample);
        };
        put(to);
        requestAnimationFrame(sample);
        await new Promise((r) => setTimeout(r, 420));
        return Object.fromEntries(Object.entries(peak).map(([k, v]) => [k, Math.round(v)]));
      },
      [fromId, toId],
    );

  // A block with enough choices that an expanded one moves the rest a
  // long way — the whole bug is about distance.
  await api(() => {
    const editor = window.__scriareEditorStore.getState().editor;
    editor.commands.setContent(
      {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "prose" }] },
          window.__scriareChoiceUtils.buildChoiceBlockNode(
            [1, 2, 3, 4].map((n) => ({ id: "c" + n, text: "Choice " + n, targetSceneId: "s2" })),
            "b2",
          ),
        ],
      },
      true,
    );
  });
  await settle();

  // Four rows, every one of them still. `every()` over nothing is true, so
  // the count is half the assertion: without it, an Inspector that isn't
  // rendered at all reports a clean pass.
  let peaks = await peakTransforms("c1", "c2");
  check("opening the NEXT choice down doesn't make it fly up the panel",
    Object.keys(peaks).length === 4 && Object.values(peaks).every((px) => px === 0),
    JSON.stringify(peaks));

  peaks = await peakTransforms("c4", "c3");
  check("...and the same going the other way, which always happened to look fine",
    Object.keys(peaks).length === 4 && Object.values(peaks).every((px) => px === 0),
    JSON.stringify(peaks));

  // 8 — but the list still animates what genuinely moves. Expanding a
  // choice by hand shifts everything below it, and that motion explains
  // the layout rather than inventing it. Without this, "nothing flies" is
  // satisfied just as well by animating nothing at all.
  const shiftBelow = await api(async () => {
    const rows = [...document.querySelectorAll("[data-option-id]")];
    const header = rows[0].querySelector("button");
    const peak = {};
    let frames = 0;
    const sample = () => {
      for (const el of document.querySelectorAll("[data-option-id]")) {
        const matrix = getComputedStyle(el.parentElement).transform;
        let ty = 0;
        if (matrix && matrix !== "none") {
          const parts = matrix.match(/matrix\(([^)]+)\)/);
          if (parts) ty = parseFloat(parts[1].split(",")[5]);
        }
        peak[el.dataset.optionId] = Math.max(peak[el.dataset.optionId] ?? 0, Math.abs(ty));
      }
      if (++frames < 20) requestAnimationFrame(sample);
    };
    header.click();
    requestAnimationFrame(sample);
    await new Promise((r) => setTimeout(r, 420));
    return Object.fromEntries(Object.entries(peak).map(([k, v]) => [k, Math.round(v)]));
  });
  check("choices below an opening one still slide into their new places",
    Object.entries(shiftBelow).some(([id, px]) => id !== "c1" && px > 20),
    JSON.stringify(shiftBelow));

  await seedProject();
}
