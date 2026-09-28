/**
 * Column A means something (v0.69.0).
 *
 * The spreadsheet export makes the id of a line the CSV's RowName, and a
 * DataTable with two rows under one RowName is not a story with a small
 * flaw in it — it is a file the engine drops rows out of. So the property
 * being asserted here is not "ids exist", which v0.66.0 already had. It is
 * that no two things in a document can ever claim the same id, through
 * every route the audit found that produced one.
 *
 * Each assertion is phrased as the writer's action rather than the
 * mechanism, because the mechanisms changed once already and the actions
 * did not: `keepOnSplit: false` looked like it prevented the split case
 * for two versions while measurably not doing so, and a test named after
 * the flag would have gone green the whole time.
 *
 * ONE NAMESPACE. Paragraphs, dialogue lines, dialogue blocks, choice
 * options and choice blocks are all counted against each other rather than
 * each against its own kind, because column A mixes them.
 */
export default async function run({ page, api, check, seedProject }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /**
   * The five id-bearing node types, WRITTEN OUT HERE rather than read from
   * the app.
   *
   * The negative controls forced this. The first version asked
   * `idAttrFor` — the app's own table — which attribute to look at, so
   * deleting a row from that table made the code stop stamping a node type
   * AND made the test stop looking at it. Both went quiet together and the
   * suite stayed green. A test that asks the code under test what to check
   * cannot catch the code forgetting something.
   */
  const ID_ATTRS = {
    paragraph: "lineId",
    dialogueLine: "lineId",
    dialogueBlock: "blockId",
    choiceOption: "optionId",
    choiceBlock: "blockId",
  };

  /** Every id in the document, in document order, across all five kinds. */
  const allIds = () =>
    api((table) => {
      const editor = window.__scriareEditorStore.getState().editor;
      const out = [];
      editor.state.doc.descendants((node) => {
        const attr = table[node.type.name];
        if (attr) out.push({ kind: node.type.name, id: node.attrs[attr] ?? null });
        return true;
      });
      return out;
    }, ID_ATTRS);

  const report = (rows) => {
    const ids = rows.map((r) => r.id);
    return {
      total: ids.length,
      blank: ids.filter((v) => !v).length,
      unique: new Set(ids.filter(Boolean)).size,
      ids,
    };
  };

  const setScene = (build) => api(build);

  await api(() => {
    const store = window.__scriareProjectStore;
    store.getState().selectScene(store.getState().project.scenes[0].id);
  });
  await wait(400);

  // ── 1. splitting a sentence ──────────────────────────────────────────
  // The measured fault: Enter mid-sentence handed both halves the same id,
  // permanently, because Tiptap only consults `keepOnSplit` when the caret
  // is at the end of the block.
  await setScene(() => {
    const editor = window.__scriareEditorStore.getState().editor;
    editor.commands.setContent(
      {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Alpha beta gamma." }] }],
      },
      true,
    );
  });
  await wait(600);
  const startId = (await allIds())[0].id;

  await api(() => {
    const editor = window.__scriareEditorStore.getState().editor;
    let start = -1;
    editor.state.doc.descendants((node, at) => {
      if (start === -1 && node.type.name === "paragraph") start = at;
    });
    editor.chain().focus().setTextSelection(start + 7).run();
  });
  await wait(250);
  await page.keyboard.press("Enter");
  await wait(700);

  const split = report(await allIds());
  check(
    "SPLITTING A SENTENCE gives the two halves different ids",
    split.total === 2 && split.blank === 0 && split.unique === 2,
    `${split.total} paragraphs, ${split.unique} unique, ${split.blank} blank`,
  );
  check(
    "...and the half that starts the sentence is the one that keeps the id",
    (await allIds())[0].id === startId,
    `first half ${(await allIds())[0].id === startId ? "kept" : "lost"} ${startId}`,
  );

  // A split at the END of a paragraph took a different code path inside
  // Tiptap and was already correct. Asserted so that a future change which
  // "simplifies" the two paths into one has to keep both working.
  await api(() => {
    const editor = window.__scriareEditorStore.getState().editor;
    editor.chain().focus().setTextSelection(editor.state.doc.content.size - 1).run();
  });
  await wait(200);
  await page.keyboard.press("Enter");
  await wait(700);
  const atEnd = report(await allIds());
  check(
    "SPLITTING AT THE END of a paragraph also gives the new one its own id",
    atEnd.blank === 0 && atEnd.unique === atEnd.total,
    `${atEnd.total} paragraphs, ${atEnd.unique} unique`,
  );

  // ── 2. pasting ───────────────────────────────────────────────────────
  // Every id round-trips through a `data-*` attribute, so before v0.69.0
  // the clipboard carried them straight back in. Done here with a REAL
  // clipboard round-trip rather than by inserting JSON: the JSON path and
  // the paste path are different pieces of code, and it was the paste path
  // that was broken.
  await setScene(() => {
    const editor = window.__scriareEditorStore.getState().editor;
    const { buildChoiceBlockNode } = window.__scriareChoiceUtils;
    const { buildDialogueBlockNode } = window.__scriareDialogue;
    editor.commands.setContent(
      {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "A paragraph to copy." }] },
          buildDialogueBlockNode(
            [
              { id: "cid-l1", text: "Line one", reply: "Reply one." },
              { id: "cid-l2", text: "Line two", reply: "Reply two." },
            ],
            "cid-blk",
          ),
          buildChoiceBlockNode(
            [
              { id: "cid-o1", text: "Option one" },
              { id: "cid-o2", text: "Option two" },
            ],
            "cid-choice",
          ),
        ],
      },
      true,
    );
  });
  await wait(800);
  const beforePaste = report(await allIds());

  await api(() => {
    const editor = window.__scriareEditorStore.getState().editor;
    editor.chain().focus().selectAll().run();
  });
  await wait(200);
  await page.keyboard.press("Control+c");
  await wait(400);
  await api(() => {
    const editor = window.__scriareEditorStore.getState().editor;
    editor.chain().focus().setTextSelection(editor.state.doc.content.size - 1).run();
  });
  await wait(200);
  await page.keyboard.press("Control+v");
  await wait(1000);

  const afterPaste = report(await allIds());
  check(
    "PASTING A COPY of everything leaves no two things sharing an id",
    afterPaste.blank === 0 && afterPaste.unique === afterPaste.total,
    `${afterPaste.total} ids, ${afterPaste.unique} unique, ${afterPaste.blank} blank`,
  );
  check(
    "...and the paste really did double the document, so the check had something to catch",
    afterPaste.total >= beforePaste.total * 2,
    `${beforePaste.total} before, ${afterPaste.total} after`,
  );
  check(
    "...across all five id-bearing kinds, not just paragraphs",
    new Set((await allIds()).map((r) => r.kind)).size === 5,
    [...new Set((await allIds()).map((r) => r.kind))].join(", "),
  );

  // ── 2b. pasting into a DIFFERENT SCENE ───────────────────────────────
  // This is the assertion the paste strip actually exists for, and it took
  // the negative controls two tries to find. Breaking the strip left every
  // check above green, because the sweep repairs a duplicate wherever it
  // came from — so a paste inside one scene cannot tell the two designs
  // apart at all.
  //
  // What the sweep cannot do is see a scene that is not open. It walks the
  // mounted document and nothing else, so it makes a SCENE internally
  // consistent and says nothing about the project. Copy a line out of
  // scene 3, open scene 20, paste: two scenes claim one id, no sweep will
  // ever look at both of them, and the duplicate is permanent. Column A is
  // the project's RowName, not the scene's, so that is the property that
  // matters — and the strip at the paste boundary is the only thing in the
  // app that holds it.
  const crossScene = await api(async () => {
    const store = window.__scriareProjectStore;
    const scenes = store.getState().project.scenes;
    if (scenes.length < 2) return { error: "the seed has fewer than two scenes" };
    return { from: scenes[0].id, to: scenes[1].id };
  });
  check(
    "there are two scenes to paste between",
    !crossScene.error,
    crossScene.error ?? "two scenes",
  );

  await api((id) => window.__scriareProjectStore.getState().selectScene(id), crossScene.from);
  await wait(500);
  await setScene(() => {
    const editor = window.__scriareEditorStore.getState().editor;
    const { buildChoiceBlockNode } = window.__scriareChoiceUtils;
    const { buildDialogueBlockNode } = window.__scriareDialogue;
    editor.commands.setContent(
      {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "A travelling paragraph." }] },
          buildDialogueBlockNode([{ id: "x-l1", text: "Said once", reply: "Answered." }], "x-blk"),
          buildChoiceBlockNode([{ id: "x-o1", text: "Chosen once" }], "x-choice"),
        ],
      },
      true,
    );
  });
  await wait(900);

  await api(() => window.__scriareEditorStore.getState().editor.chain().focus().selectAll().run());
  await wait(200);
  await page.keyboard.press("Control+c");
  await wait(400);

  await api((id) => window.__scriareProjectStore.getState().selectScene(id), crossScene.to);
  await wait(900);
  await api(() => {
    const editor = window.__scriareEditorStore.getState().editor;
    editor.chain().focus().setTextSelection(editor.state.doc.content.size - 1).run();
  });
  await wait(250);
  await page.keyboard.press("Control+v");
  await wait(1200);

  // Read the whole PROJECT, not the open document — that is the point.
  const project = await api((table) => {
    const store = window.__scriareProjectStore;
    const counts = new Map();
    let total = 0;
    const walk = (n) => {
      if (!n || typeof n !== "object") return;
      const attr = table[n.type];
      const id = attr ? n.attrs?.[attr] : null;
      if (attr) {
        total += 1;
        if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      (n.content ?? []).forEach(walk);
    };
    store.getState().project.scenes.forEach((s) => walk(s.content));
    const repeated = [...counts.entries()].filter(([, c]) => c > 1);
    return {
      total,
      unique: counts.size,
      blank: total - [...counts.values()].reduce((a, b) => a + b, 0),
      repeated: repeated.length,
      sample: repeated.slice(0, 3),
    };
  }, ID_ATTRS);
  check(
    "PASTING INTO ANOTHER SCENE leaves no id claimed by two scenes",
    project.repeated === 0,
    `${project.total} ids across the project, ${project.unique} unique, ${project.repeated} repeated${project.sample.length ? ` (${project.sample.map(([i, c]) => `${i.slice(0, 6)}×${c}`).join(", ")})` : ""}`,
  );
  // A blank id is a different fault from a repeated one and is repaired by
  // a different thing — the sweep when the scene is next mounted, or the
  // open-time pass when the file is next opened — so it is counted apart
  // rather than folded into the assertion above. A scene the session has
  // never mounted can legitimately be carrying one.
  check(
    "...and the scene that was pasted into is fully stamped",
    (await allIds()).every((r) => r.id),
    `${project.blank} unstamped across the project, ${(await allIds()).filter((r) => !r.id).length} in the open scene`,
  );
  check(
    "...and the paste really arrived, so the check had something to catch",
    await api(
      () =>
        window.__scriareEditorStore
          .getState()
          .editor.state.doc.textContent.includes("A travelling paragraph"),
    ),
  );

  // ── 3. duplicating a scene ───────────────────────────────────────────
  // Choice ids were reissued here since long before the Dialogue existed;
  // the prose and the Dialogue were not, so two scenes claimed them.
  const scenes = await api((table) => {
    const store = window.__scriareProjectStore;
    const scene = store.getState().project.scenes[0];
    store.getState().duplicateScene(scene.id);
    const state = store.getState();
    const copy = state.project.scenes[state.project.scenes.length - 1];

    const read = (content) => {
      const out = [];
      const walk = (n) => {
        if (!n || typeof n !== "object") return;
        const attr = table[n.type];
        if (attr) out.push(n.attrs?.[attr] ?? null);
        (n.content ?? []).forEach(walk);
      };
      walk(content);
      return out;
    };
    return { original: read(scene.content), copy: read(copy.content) };
  }, ID_ATTRS);
  await wait(600);
  const shared = scenes.original.filter((id) => scenes.copy.includes(id));
  check(
    "DUPLICATING A SCENE gives the copy its own ids, prose and Dialogue included",
    shared.length === 0 && scenes.copy.length === scenes.original.length,
    `${scenes.original.length} ids in the original, ${scenes.copy.length} in the copy, ${shared.length} shared`,
  );
  check(
    "...and the copy is not empty, so the check had something to catch",
    scenes.copy.length > 0 && scenes.copy.every(Boolean),
    `${scenes.copy.length} ids, ${scenes.copy.filter(Boolean).length} of them real`,
  );

  // ── 4. a file that already holds duplicates ──────────────────────────
  // Every project written by v0.68.0 or earlier can hold ids the app
  // itself duplicated. Opening one has to heal it: the duplicate is
  // already broken and it breaks silently, in a spreadsheet, weeks later.
  const healed = await api((table) => {
    const { stampContentIds } = window.__scriareContentIds;
    // Current-shaped ids, so this measures the DUPLICATE rule rather than
    // the shape rule — v0.70.1 also reissues anything in the old
    // twenty-one-character shape, and a fixture using one would have both
    // rules firing at once and prove neither.
    const sick = {
      type: "doc",
      content: [
        { type: "paragraph", attrs: { lineId: "t_aaaaaaaa" }, content: [{ type: "text", text: "One." }] },
        { type: "paragraph", attrs: { lineId: "t_aaaaaaaa" }, content: [{ type: "text", text: "Two." }] },
        { type: "paragraph", content: [{ type: "text", text: "Three, with no id at all." }] },
      ],
    };
    const out = stampContentIds(sick);
    const ids = [];
    const walk = (n) => {
      const attr = table[n.type];
      if (attr) ids.push(n.attrs?.[attr] ?? null);
      (n.content ?? []).forEach(walk);
    };
    walk(out);
    return ids;
  }, ID_ATTRS);
  check(
    "OPENING AN OLD FILE with duplicate ids heals it rather than carrying them",
    healed.length === 3 && healed.every(Boolean) && new Set(healed).size === 3,
    `${JSON.stringify(healed.map((v) => (v ? v.slice(0, 6) : v)))}`,
  );
  check(
    "...keeping the id on the first of the two, so an existing translation stays attached",
    healed[0] === "t_aaaaaaaa",
    `first is ${healed[0]}`,
  );

  // A document already correct is handed back unchanged rather than
  // rebuilt, which is what keeps the open-time pass free.
  const untouched = await api(() => {
    const { stampContentIds } = window.__scriareContentIds;
    const fine = {
      type: "doc",
      content: [
        { type: "paragraph", attrs: { lineId: "t_bbbbbbbb" }, content: [{ type: "text", text: "x" }] },
      ],
    };
    return stampContentIds(fine) === fine;
  });
  check("...and a document with nothing wrong with it is not rewritten", untouched);

  // v0.70.1 — the third fault the open-time pass repairs. An id in the old
  // twenty-one-character nanoid shape is reissued, because that id is what
  // column A of the spreadsheet prints and it looked like ciphertext.
  const reshaped = await api(() => {
    const { stampContentIds } = window.__scriareContentIds;
    const old = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { lineId: "xU40lTnJ8JVN16hgSPB2I" },
          content: [{ type: "text", text: "An old line." }],
        },
      ],
    };
    return stampContentIds(old).content[0].attrs.lineId;
  });
  check(
    "AN ID IN THE OLD NANOID SHAPE IS REISSUED on open, so no sheet prints one",
    /^t_[23456789abcdefghjkmnpqrstvwxyz]{8}$/.test(reshaped),
    reshaped,
  );

  await seedProject();
  await wait(300);
  check(
    "the workspace is handed back to the next spec",
    await api(() => Boolean(window.__scriareProjectStore.getState().project)),
  );
}
