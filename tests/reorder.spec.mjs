/**
 * Dragging a row into a new place (v0.67.0).
 *
 * The gesture was written for the Choices panel and has never had a test
 * that actually performed it — `reorderChoiceOptions` was covered at the
 * document level, the drag itself only by eye. v0.67.0 lifts that gesture
 * into `useReorderableList` so the Dialogue can use it too, and a shared
 * implementation with no test is a shared implementation that breaks both
 * lists at once. So this spec drives real pointer events on the real
 * handles, in both panels, and asks the DOCUMENT what happened — not the
 * panel, which is a picture of the document and could agree with itself
 * while being wrong.
 */
export default async function run({ api, check, seedProject }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ── a scene holding one of each block ────────────────────────────────
  await api(() => {
    const store = window.__scriareProjectStore;
    const project = store.getState().project;
    store.getState().selectScene(project.scenes[0].id);
  });
  await wait(400);

  await api(() => {
    const editor = window.__scriareEditorStore.getState().editor;
    const { buildChoiceBlockNode } = window.__scriareChoiceUtils;
    const { buildDialogueBlockNode } = window.__scriareDialogue;
    // `true` — emit the update, so the project store (and therefore the
    // Inspector, which reads the store rather than the editor) learns
    // about the blocks this spec just put in.
    editor.commands.setContent({
      type: "doc",
      content: [
        buildChoiceBlockNode(
          [
            { id: "o-one", text: "First option" },
            { id: "o-two", text: "Second option" },
            { id: "o-three", text: "Third option" },
          ],
          "blk-choice",
        ),
        buildDialogueBlockNode(
          [
            { id: "l-one", text: "First line", reply: "One." },
            { id: "l-two", text: "Second line", reply: "Two." },
            { id: "l-three", text: "Third line", reply: "Three." },
          ],
          "blk-talk",
        ),
      ],
    }, true);
  });
  await wait(700);

  /** The order the DOCUMENT is in, which is the only order that counts. */
  const orderOf = (nodeType, attr) =>
    api(
      ({ nodeType, attr }) => {
        const editor = window.__scriareEditorStore.getState().editor;
        const out = [];
        editor.state.doc.descendants((node) => {
          if (node.type.name === nodeType) out.push(node.attrs[attr]);
        });
        return out;
      },
      { nodeType, attr },
    );

  /**
   * Grab a handle and carry it far enough to land in `slots` rows' time.
   * The move is made in several steps because a single jump is not what a
   * pointer does, and the hysteresis in `nearestSlot` is there precisely
   * to survive the small ones.
   */
  const drag = async (handleSelector, rowSelector, from, slots) => {
    const grab = await api(
      ({ handleSelector, rowSelector, from }) => {
        const handles = [...document.querySelectorAll(handleSelector)];
        const rows = [...document.querySelectorAll(rowSelector)];
        if (handles.length < 2 || rows.length < 2) {
          return { error: `${handles.length} handles, ${rows.length} rows` };
        }
        const box = handles[from].getBoundingClientRect();
        const step = rows[1].getBoundingClientRect().top - rows[0].getBoundingClientRect().top;
        const x = box.left + box.width / 2;
        const y = box.top + box.height / 2;
        handles[from].dispatchEvent(
          new PointerEvent("pointerdown", {
            clientX: x,
            clientY: y,
            bubbles: true,
            cancelable: true,
            pointerId: 1,
            isPrimary: true,
          }),
        );
        return { step, x, y };
      },
      { handleSelector, rowSelector, from },
    );
    await wait(150);

    // The row really is held: its slot is behind as a landing zone and a
    // copy of it is floating. Checked here, between the grab and the
    // move, because this is the only moment both are true — and because
    // the first version of this spec fired every pointer event in one
    // tick, which measured a drag that React had not rendered yet and
    // reported a failure that was entirely the test's.
    const lifted = await api(() => ({
      fixed: [...document.querySelectorAll("aside div")].filter((d) => d.style.position === "fixed").length,
    }));

    await api(
      ({ x, y, travel }) => {
        for (let i = 1; i <= 6; i += 1) {
          window.dispatchEvent(
            new PointerEvent("pointermove", {
              clientX: x,
              clientY: y + (travel * i) / 6,
              bubbles: true,
              pointerId: 1,
            }),
          );
        }
      },
      { x: grab.x, y: grab.y, travel: (grab.step ?? 0) * slots },
    );
    await wait(250);
    await api(() => {
      window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
    });
    await wait(450);
    return { ...grab, lifted };
  };

  // ── the Choices panel, which had this before and must keep it ────────
  await api(() => {
    const store = window.__scriareProjectStore;
    window.__scriareInspectorStore.getState().selectTarget({
      kind: "choice",
      sceneId: store.getState().selectedSceneId,
      blockId: "blk-choice",
    });
  });
  await wait(500);

  const beforeChoices = await orderOf("choiceOption", "optionId");
  check(
    "the Choices panel is showing three rows to drag",
    beforeChoices.join(",") === "o-one,o-two,o-three",
    beforeChoices.join(", "),
  );

  const choiceDrag = await drag(
    "aside [data-option-id] [title='Drag to reorder']",
    "aside [data-option-id]",
    0,
    1,
  );
  check(
    "the held choice lifts out of the list while it is dragged",
    choiceDrag.lifted?.fixed === 1,
    JSON.stringify(choiceDrag.lifted),
  );
  const afterChoices = await orderOf("choiceOption", "optionId");
  check(
    "dragging a choice one row down moves it in the DOCUMENT",
    afterChoices.join(",") === "o-two,o-one,o-three",
    `${afterChoices.join(", ")} — ${JSON.stringify(choiceDrag)}`,
  );

  // ── the Dialogue panel, which is the point of the refactor ───────────
  await api(() => {
    const store = window.__scriareProjectStore;
    window.__scriareInspectorStore.getState().selectTarget({
      kind: "dialogue",
      sceneId: store.getState().selectedSceneId,
      blockId: "blk-talk",
    });
  });
  await wait(500);

  const beforeLines = await orderOf("dialogueLine", "lineId");
  check(
    "the Dialogue panel is showing three lines to drag",
    beforeLines.join(",") === "l-one,l-two,l-three",
    beforeLines.join(", "),
  );

  const lineDrag = await drag(
    "aside [data-dialogue-drag-handle]",
    "aside [data-dialogue-line-id]",
    2,
    -2,
  );
  const afterLines = await orderOf("dialogueLine", "lineId");
  check(
    "...and a held line lifts the same way",
    lineDrag.lifted?.fixed === 1,
    JSON.stringify(lineDrag.lifted),
  );
  check(
    "A DIALOGUE LINE CAN BE DRAGGED TOO — the last one to the front",
    afterLines.join(",") === "l-three,l-one,l-two",
    `${afterLines.join(", ")} — ${JSON.stringify(lineDrag)}`,
  );

  // The safeguard both helpers share, asserted on the new one: a reorder
  // that is told about fewer lines than exist must still keep them all.
  const kept = await api(() => {
    const editor = window.__scriareEditorStore.getState().editor;
    const { reorderDialogueLines } = window.__scriareDialogue;
    reorderDialogueLines(editor, "blk-talk", ["l-two"]);
    const out = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === "dialogueLine") out.push(node.attrs.lineId);
    });
    return out;
  });
  check(
    "a reorder that names one line keeps the other two",
    kept.length === 3 && kept[0] === "l-two",
    kept.join(", "),
  );

  await seedProject();
  await wait(200);
  check(
    "the workspace is handed back to the next spec",
    await api(() => Boolean(window.__scriareProjectStore.getState().project)),
  );
}
