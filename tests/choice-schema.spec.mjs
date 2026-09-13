/**
 * Choice labels are real text (v0.32.0).
 *
 * Until this version a Choice Block was an atom holding an `options` array,
 * each label a plain string in a node attribute. That string was invisible
 * to everything the editor is good at: the toolbar applies marks to text
 * nodes, and there was no text node, so no arrangement of UI could ever let
 * a writer bold a word in a choice. The fix was a schema change — an option
 * is now its own node whose content is `inline*` — and a schema change is
 * exactly the kind of edit that looks fine in one afternoon's clicking and
 * quietly eats someone's manuscript on load.
 *
 * So the weight here is on the two things that would be unrecoverable:
 *
 *  - MIGRATION. Every project written before this version has the old
 *    shape. If the conversion drops a destination, a condition or an
 *    action, the story still opens and still looks right — the links are
 *    just gone. Both legacy generations are tested field by field, and the
 *    v0.32.0 case was verified to FAIL on a build whose migration copied
 *    only the label.
 *  - NOT LOSING A CHOICE. Remove, reorder and append all rewrite the
 *    block's children through ProseMirror, where an off-by-one deletes the
 *    wrong node rather than throwing.
 *
 * The rest proves the point of the change: a label is prose, the toolbar
 * reaches it, and the formatting arrives in Play Mode.
 */
export default async function ({ api, check, seedProject }) {
  // ── Migration ────────────────────────────────────────────────────────
  // `normalizeProject` is what every file load goes through, so this is
  // the real path, not a private helper called in isolation.

  // 1 — pre-v0.32.0: the whole option list in an `options` attribute.
  let r = await api(() => {
    const { normalizeProject } = window.__scriareProjectTypes;
    const { readChoiceBlockOptions } = window.__scriareChoiceUtils;
    const legacyBlock = {
      type: "choiceBlock",
      attrs: {
        blockId: "b1",
        options: [
          {
            id: "o1",
            text: "Unlock the door",
            targetSceneId: "s2",
            actions: [{ id: "a1", variableId: "trust", operation: "add", value: 1 }],
            conditions: [{ id: "c1", variableId: "key", comparator: "eq", value: true }],
            whenUnmet: "lock",
          },
          { id: "o2", text: "Force it open", targetSceneId: null },
        ],
      },
    };
    const project = normalizeProject({
      name: "Old", createdAt: "", updatedAt: "",
      scenes: [
        {
          id: "s1", title: "One", position: { x: 0, y: 0 }, order: 0,
          content: { type: "doc", content: [{ type: "paragraph" }, legacyBlock] },
        },
        { id: "s2", title: "Two", position: { x: 0, y: 0 }, order: 1, content: { type: "doc", content: [] } },
      ],
      content: [], favorites: [], variables: [], startSceneId: "s1",
    });
    const block = project.scenes[0].content.content.find((n) => n.type === "choiceBlock");
    const options = readChoiceBlockOptions(block);
    return {
      legacyAttrGone: block.attrs.options === undefined,
      childTypes: (block.content ?? []).map((c) => c.type),
      // The label has to be an actual text node in the option's content —
      // an attribute that happens to hold the same string would pass every
      // other assertion here and still be unstylable.
      labelIsTextNode: block.content?.[0]?.content?.[0]?.type === "text",
      options,
    };
  });
  check("a pre-v0.32.0 choice block becomes real option nodes",
    r.legacyAttrGone && JSON.stringify(r.childTypes) === '["choiceOption","choiceOption"]' &&
      r.labelIsTextNode,
    `attrs.options gone: ${r.legacyAttrGone}, children: ${JSON.stringify(r.childTypes)}, label is text: ${r.labelIsTextNode}`);
  check("migration keeps every option's label, destination, conditions and actions",
    r.options.length === 2 &&
      r.options[0].id === "o1" &&
      r.options[0].text === "Unlock the door" &&
      r.options[0].targetSceneId === "s2" &&
      r.options[0].conditions.length === 1 &&
      r.options[0].conditions[0].variableId === "key" &&
      r.options[0].actions.length === 1 &&
      r.options[0].actions[0].variableId === "trust" &&
      r.options[0].whenUnmet === "lock" &&
      r.options[1].text === "Force it open" &&
      r.options[1].targetSceneId === null &&
      r.options[1].whenUnmet === "hide",
    JSON.stringify(r.options.map((o) => ({ t: o.text, to: o.targetSceneId, c: o.conditions.length, a: o.actions.length, u: o.whenUnmet }))));

  // 2 — pre-v0.7.0: one option, flat on the block's own attributes.
  r = await api(() => {
    const { normalizeProject } = window.__scriareProjectTypes;
    const { readChoiceBlockOptions } = window.__scriareChoiceUtils;
    const project = normalizeProject({
      name: "Ancient", createdAt: "", updatedAt: "",
      scenes: [{
        id: "s1", title: "One", position: { x: 0, y: 0 }, order: 0,
        content: {
          type: "doc",
          content: [{
            type: "choiceBlock",
            attrs: { blockId: "b1", choiceId: "old", text: "Go north", targetSceneId: "s2" },
          }],
        },
      }],
      content: [], favorites: [], variables: [], startSceneId: "s1",
    });
    const block = project.scenes[0].content.content[0];
    return readChoiceBlockOptions(block);
  });
  check("a pre-v0.7.0 single-option block migrates too",
    r.length === 1 && r[0].text === "Go north" && r[0].targetSceneId === "s2",
    JSON.stringify(r));

  // 3 — a current document must pass through untouched. Migration runs on
  // EVERY load, so one that re-wraps its own output would corrupt a file a
  // little further each time it was opened.
  r = await api(() => {
    const { normalizeProject } = window.__scriareProjectTypes;
    const { buildChoiceBlockNode, readChoiceBlockOptions } = window.__scriareChoiceUtils;
    const current = buildChoiceBlockNode(
      [{ id: "keep", text: "Already current", targetSceneId: "s2" }],
      "b1",
    );
    const load = (content) =>
      normalizeProject({
        name: "N", createdAt: "", updatedAt: "",
        scenes: [{ id: "s1", title: "One", position: { x: 0, y: 0 }, order: 0, content }],
        content: [], favorites: [], variables: [], startSceneId: "s1",
      }).scenes[0].content;

    const once = load({ type: "doc", content: [current] });
    const twice = load(once);
    return {
      first: readChoiceBlockOptions(once.content[0]),
      second: readChoiceBlockOptions(twice.content[0]),
      stillOneBlock: twice.content.filter((n) => n.type === "choiceBlock").length,
    };
  });
  check("loading an already-current document changes nothing",
    r.stillOneBlock === 1 && r.first.length === 1 && r.second.length === 1 &&
      r.second[0].id === "keep" && r.second[0].text === "Already current" &&
      r.second[0].targetSceneId === "s2",
    JSON.stringify(r.second));

  // ── The label as prose ───────────────────────────────────────────────
  // From here on this drives the real mounted editor. A schema is only
  // real through ProseMirror: a document this test builds by hand proves
  // nothing if the editor would reject it.

  const seedChoiceScene = () =>
    api(() => {
      const store = window.__scriareProjectStore;
      const { buildChoiceBlockNode } = window.__scriareChoiceUtils;
      const editor = window.__scriareEditorStore.getState().editor;
      if (!editor) return false;
      const doc = {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "The door is locked." }] },
          buildChoiceBlockNode(
            [
              { id: "o1", text: "Unlock the door", targetSceneId: "s2" },
              { id: "o2", text: "Force it open", targetSceneId: "s3" },
            ],
            "b1",
          ),
        ],
      };
      editor.commands.setContent(doc);
      return editor.state.doc.textBetween(0, editor.state.doc.content.size, " ");
    });

  r = await seedChoiceScene();
  check("the editor accepts a choice block whose labels are inline content",
    typeof r === "string" && r.includes("Unlock the door") && r.includes("Force it open"),
    typeof r === "string" ? JSON.stringify(r) : "no editor mounted");

  // 4 — typing in a label is an ordinary document edit, and lands in the
  // project the same way prose does.
  r = await api(() => {
    const editor = window.__scriareEditorStore.getState().editor;
    let end = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "choiceOption" && node.attrs.optionId === "o1") {
        end = pos + node.nodeSize - 1;
      }
    });
    editor.chain().focus().setTextSelection(end).insertContent(" slowly").run();
    const { readChoiceBlockOptions } = window.__scriareChoiceUtils;
    const stored = window.__scriareProjectStore
      .getState()
      .project.scenes.find((s) => s.id === "s1").content;
    const block = stored.content.find((n) => n.type === "choiceBlock");
    return readChoiceBlockOptions(block).map((o) => o.text);
  });
  check("typing into a label persists to the project like any other prose",
    JSON.stringify(r) === '["Unlock the door slowly","Force it open"]', JSON.stringify(r));

  // 5 — the whole point: a mark on part of a label. This is what the old
  // schema made impossible.
  r = await api(() => {
    const editor = window.__scriareEditorStore.getState().editor;
    let from = -1;
    let to = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "choiceOption" && node.attrs.optionId === "o1") {
        from = pos + node.nodeSize - 1 - " slowly".length;
        to = pos + node.nodeSize - 1;
      }
    });
    editor.chain().focus().setTextSelection({ from, to }).toggleBold().run();
    const { readChoiceBlockOptions } = window.__scriareChoiceUtils;
    const stored = window.__scriareProjectStore
      .getState()
      .project.scenes.find((s) => s.id === "s1").content;
    const option = readChoiceBlockOptions(stored.content.find((n) => n.type === "choiceBlock"))[0];
    return {
      text: option.text,
      pieces: (option.node?.content ?? []).map((c) => ({
        text: c.text,
        marks: (c.marks ?? []).map((m) => m.type),
      })),
    };
  });
  check("the toolbar's marks apply to part of a label, and only that part",
    r.pieces.length === 2 &&
      r.pieces[0].text === "Unlock the door" && r.pieces[0].marks.length === 0 &&
      r.pieces[1].text === " slowly" && r.pieces[1].marks.includes("bold") &&
      // The flattened form still reads as the sentence — everything that
      // wants a string (the graph's edge labels, the Inspector summary)
      // must not start seeing markup.
      r.text === "Unlock the door slowly",
    JSON.stringify(r));

  // 6 — and it survives into Play Mode, which renders through its own HTML
  // pass. A mark that the editor keeps but the runtime drops is a feature
  // that only works while you're looking at it.
  await api(() => window.__scriareProjectStore.getState().startPlay());
  await new Promise((resolve) => setTimeout(resolve, 200));
  r = await api(() =>
    [...document.querySelectorAll("button")]
      .map((b) => b.innerHTML)
      .filter((h) => h.includes("Unlock the door")),
  );
  check("a formatted label reaches Play Mode with its formatting",
    r.length === 1 && /<strong>\s*slowly<\/strong>/.test(r[0]),
    JSON.stringify(r));
  await api(() => window.__scriareProjectStore.getState().exitPlay());

  // ── Rewriting a block's children ─────────────────────────────────────

  // 7 — a reorder must never lose a choice, including one the caller's
  // order list forgot to mention.
  await seedChoiceScene();
  r = await api(() => {
    const editor = window.__scriareEditorStore.getState().editor;
    const { reorderChoiceOptions, appendChoiceOption } = window.__scriareChoiceEditing;
    const { readChoiceBlockOptions } = window.__scriareChoiceUtils;
    appendChoiceOption(editor, "b1");
    const read = () => {
      const doc = editor.getJSON();
      return readChoiceBlockOptions(doc.content.find((n) => n.type === "choiceBlock"));
    };
    const afterAppend = read();
    // Deliberately incomplete: only the two named options are ordered.
    const ok = reorderChoiceOptions(editor, "b1", ["o2", "o1"]);
    const afterReorder = read();
    return {
      appendedCount: afterAppend.length,
      ok,
      order: afterReorder.map((o) => o.id),
      texts: afterReorder.map((o) => o.text),
    };
  });
  check("adding a choice adds exactly one, empty", r.appendedCount === 3, `count ${r.appendedCount}`);
  check("a reorder keeps every choice, including ones it wasn't told about",
    r.ok && r.order.length === 3 && r.order[0] === "o2" && r.order[1] === "o1" &&
      r.texts[0] === "Force it open" && r.texts[1] === "Unlock the door",
    `${JSON.stringify(r.order)} / ${JSON.stringify(r.texts)}`);

  // 8 — removing options one at a time, until the block itself goes. A
  // Choice Block's content is `choiceOption+`, so an empty one isn't a
  // valid document — and a branching point that doesn't branch is not
  // something to leave behind anyway.
  await seedChoiceScene();
  r = await api(() => {
    const editor = window.__scriareEditorStore.getState().editor;
    const { removeChoiceOption } = window.__scriareChoiceEditing;
    const { readChoiceBlockOptions } = window.__scriareChoiceUtils;
    const blockOf = () => editor.getJSON().content.find((n) => n.type === "choiceBlock");

    removeChoiceOption(editor, "o1");
    const afterFirst = readChoiceBlockOptions(blockOf());
    removeChoiceOption(editor, "o2");
    return {
      afterFirst: afterFirst.map((o) => o.id),
      blockGone: blockOf() === undefined,
      proseKept: editor.getJSON().content.some(
        (n) => n.type === "paragraph" && n.content?.[0]?.text === "The door is locked.",
      ),
    };
  });
  check("removing one option leaves the rest alone",
    JSON.stringify(r.afterFirst) === '["o2"]', JSON.stringify(r.afterFirst));
  check("removing the last option removes the block, and nothing else",
    r.blockGone && r.proseKept, `block gone: ${r.blockGone}, prose kept: ${r.proseKept}`);

  // 9 — copying scenes still rewires links between the copies, with the
  // labels intact. This is the same guarantee clipboard.spec.mjs makes for
  // whole projects, checked here at the level the new schema rewrote.
  r = await api(() => {
    const { buildChoiceBlockNode, regenerateChoiceIds, readChoiceBlockOptions } =
      window.__scriareChoiceUtils;
    const doc = {
      type: "doc",
      content: [
        buildChoiceBlockNode(
          [
            { id: "o1", text: "To the copy", targetSceneId: "inside" },
            { id: "o2", text: "To Chapter Three", targetSceneId: "outside" },
          ],
          "b1",
        ),
      ],
    };
    const copy = regenerateChoiceIds(doc, new Map([["inside", "inside-copy"]]));
    const before = readChoiceBlockOptions(doc.content[0]);
    const after = readChoiceBlockOptions(copy.content[0]);
    return {
      freshIds: after.every((o, i) => o.id !== before[i].id) &&
        copy.content[0].attrs.blockId !== "b1",
      rewired: after[0].targetSceneId,
      leftAlone: after[1].targetSceneId,
      labels: after.map((o) => o.text),
      originalUntouched: before.map((o) => o.id).join(",") === "o1,o2",
    };
  });
  check("a copied scene gets fresh choice ids without touching the original",
    r.freshIds && r.originalUntouched, JSON.stringify(r));
  check("a copy links to its own copies, and leaves outside links alone",
    r.rewired === "inside-copy" && r.leftAlone === "outside" &&
      JSON.stringify(r.labels) === '["To the copy","To Chapter Three"]',
    JSON.stringify(r));

  await seedProject();
}
