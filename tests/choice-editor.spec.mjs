/**
 * The choice editor, grouped (v0.65.0) — board L, direction L3.
 *
 * What it replaced: six labelled fields at one weight, stacked in a 320px
 * column. The grouping is the visible change, but it is not the point.
 * The point is that a choice with NOTHING set used to look exactly as
 * complicated as a choice with a locked condition and two effects, and
 * most choices have nothing set — so an unset rule is now one line that
 * says what is true rather than a heading over an empty control.
 *
 * Every check below reads the rendered panel. The v0.50.0 finding still
 * governs: a test that calls the helper is testing the helper.
 */
export default async function run({ page, api, check, seedProject }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ── a block with three choices: gated, effectful, and plain ──────────
  //
  // The editor is moved OFF the scene before its content is replaced, and
  // back onto it afterwards. Both halves matter: the Inspector patches a
  // choice through the mounted Tiptap editor (see patchOption), so a
  // block written straight into the store is a block the editor has never
  // heard of — every read passes and every write silently does nothing,
  // which is exactly how the first run of this spec looked.
  await api(() => {
    const store = window.__scriareProjectStore;
    const other = store.getState().project.scenes[1];
    if (other) store.getState().selectScene(other.id);
  });
  await wait(250);

  await api(() => {
    const store = window.__scriareProjectStore;
    const { buildChoiceBlockNode } = window.__scriareChoiceUtils;
    const state = store.getState();
    const project = state.project;

    const variables = [
      { id: "v-resolve", name: "resolve", type: "number", defaultValue: 0 },
      { id: "v-told", name: "told_him", type: "boolean", defaultValue: false },
    ];

    const target = project.scenes[1]?.id ?? null;
    const block = buildChoiceBlockNode(
      [
        {
          id: "gated",
          text: "Raise your hand and ask to be heard.",
          targetSceneId: target,
          conditions: [{ id: "c1", variableId: "v-resolve", comparator: "gte", value: 3 }],
          whenUnmet: "lock",
          actions: [],
        },
        {
          id: "effects",
          text: "Stand there a while longer.",
          targetSceneId: target,
          conditions: [],
          actions: [
            { id: "a1", variableId: "v-resolve", operation: "add", value: 1 },
            { id: "a2", variableId: "v-told", operation: "toggle", value: true },
          ],
        },
        { id: "plain", text: "Go up.", targetSceneId: target, conditions: [], actions: [] },
      ],
      "blk",
    );

    const scene = project.scenes[0];
    store.setState({
      project: {
        ...project,
        variables,
        scenes: project.scenes.map((s) =>
          s.id === scene.id
            ? { ...s, content: { type: "doc", content: [{ type: "paragraph" }, block] } }
            : s,
        ),
      },
      selectedSceneId: scene.id,
      selectedEntityId: null,
    });
  });
  await wait(150);

  // Back onto the scene, so the editor loads the block that was just put
  // there — and only then point the Inspector at it.
  await api(() => {
    const store = window.__scriareProjectStore;
    const first = store.getState().project.scenes[0];
    store.getState().selectScene(first.id);
  });
  await wait(350);
  await api(() => {
    const store = window.__scriareProjectStore;
    window.__scriareInspectorStore.getState().selectTarget({
      kind: "choice",
      sceneId: store.getState().project.scenes[0].id,
      blockId: "blk",
      optionId: null,
    });
  });
  await wait(300);

  const wired = await api(() => {
    const editor = window.__scriareEditorStore.getState().editor;
    let found = 0;
    editor?.state.doc.descendants((node) => {
      if (node.type.name === "choiceOption") found += 1;
    });
    return found;
  });
  check(
    "the editor really is holding the block, not just the store",
    wired === 3,
    `${wired} options in the document — a patch goes through the editor, so 0 here means every write below is a no-op`,
  );

  /** Opens one accordion by clicking its header, the way a writer does. */
  const open = async (optionId) => {
    const clicked = await api(({ id, sel }) => {
      const row = document.querySelector(`${sel}[data-option-id="${id}"]`);
      if (!row) return "no row";
      if (row.dataset.expanded === "true") return "already open";
      const header = row.querySelector("button");
      if (!header) return "no header";
      header.click();
      return "clicked";
    }, { id: optionId, sel: "aside.scriare-panel-r " });
    await wait(220);
    return clicked;
  };

  /** What the panel says about one option, read off the screen. */
  const readOption = (optionId) =>
    api(({ id, sel }) => {
      const row = document.querySelector(`${sel}[data-option-id="${id}"]`);
      if (!row) return null;
      const text = row.innerText;
      return {
        expanded: row.dataset.expanded === "true",
        text,
        headings: [...row.querySelectorAll("h4")].map((h) => h.textContent.trim()),
        rules: [...row.querySelectorAll("[data-rule]")].map(
          (el) => `${el.dataset.rule}:${el.tagName === "DIV" && el.querySelector("h4") ? "section" : "quiet"}`,
        ),
        ifNotMet: text.includes("If not met"),
      };
    }, { id: optionId, sel: "aside.scriare-panel-r " });

  // ── the plain choice, which is the common case ───────────────────────
  // SCOPED TO THE INSPECTOR. `[data-option-id]` also matches the option's
  // node view in the editor, and there are three of each — so an unscoped
  // querySelector hands back the editor's copy, whose first button is the
  // one that DELETES the option. The first run of this spec removed the
  // choice it was about to read.
  const PANEL = "aside.scriare-panel-r ";
  const ids = await api((sel) => ({
    dom: [...document.querySelectorAll(sel + "[data-option-id]")].map((el) => el.dataset.optionId),
    doc: (() => {
      const out = [];
      window.__scriareEditorStore.getState().editor?.state.doc.descendants((n) => {
        if (n.type.name === "choiceOption") out.push(n.attrs.optionId);
      });
      return out;
    })(),
  }), PANEL);
  check("the Inspector shows the three choices, and only those", ids.dom.join(",") === "gated,effects,plain",
    `dom: ${ids.dom.join(",")} | doc: ${ids.doc.join(",")}`);

  check("a choice opens when its header is clicked", (await open("plain")) === "clicked");
  const plain = await readOption("plain");

  check(
    "a choice with no rules says so instead of drawing empty sections",
    plain.text.includes("Shown always") && plain.text.includes("Changes nothing"),
    JSON.stringify(plain.text.split("\n").filter(Boolean)),
  );
  check(
    "...and spends no heading on either of them",
    plain.headings.join(" | ") === "The Line",
    plain.headings.join(" | "),
  );
  check(
    "...and does not ask about a failure that cannot happen",
    plain.ifNotMet === false,
    "no If-not-met on an unconditional choice",
  );
  check(
    "the fields it DOES have are labelled beside their controls",
    ["Speaker", "Style", "Goes to"].every((l) => plain.text.includes(l)),
    plain.text.replace(/\n/g, " · ").slice(0, 120),
  );

  // ── the gated one ────────────────────────────────────────────────────
  await open("gated");
  const gated = await readOption("gated");
  check(
    "a choice WITH a condition gets the heading and the section",
    gated.headings.includes("Shown") && !gated.text.includes("Shown always"),
    gated.headings.join(" | "),
  );
  check("...and asks what happens when it fails", gated.ifNotMet === true);
  check(
    "...while its empty half stays quiet",
    gated.text.includes("Changes nothing") && !gated.headings.includes("Changes"),
    gated.headings.join(" | "),
  );

  // ── the effectful one ────────────────────────────────────────────────
  await open("effects");
  const effects = await readOption("effects");
  check(
    "a choice with effects gets Changes, and stays quiet about being unconditional",
    effects.headings.includes("Changes") &&
      !effects.headings.includes("Shown") &&
      effects.text.includes("Shown always"),
    effects.headings.join(" | "),
  );
  check(
    "the three headings are the agreed words",
    [...new Set([...plain.headings, ...gated.headings, ...effects.headings])].sort().join(" | ") ===
      "Changes | Shown | The Line",
    [...new Set([...plain.headings, ...gated.headings, ...effects.headings])].sort().join(" | "),
  );

  // ── the quiet line is a CONTROL, not a label ─────────────────────────
  // The whole design rests on this: if the only way to add a condition to
  // a plain choice were to be somewhere else, the quiet line would be a
  // dead end dressed as an answer.
  const before = await readOption("plain");
  const added = await api(() => {
    const row = document.querySelector('aside.scriare-panel-r [data-option-id="plain"]');
    const quiet = row?.querySelector('[data-rule="shown"]');
    const button = quiet?.querySelector("button");
    if (!button) return "no button";
    button.click();
    return "clicked";
  });
  await wait(250);
  const after = await readOption("plain");

  check("the quiet line carries the way to change it", added === "clicked");
  check(
    "...and using it turns the line into the section",
    before.text.includes("Shown always") &&
      !after.text.includes("Shown always") &&
      after.headings.includes("Shown"),
    `${before.headings.join("|")} → ${after.headings.join("|")}`,
  );
  check(
    "...and the If-not-met question appears with it",
    after.ifNotMet === true,
    "asked only once there is something to fail",
  );

  // ── the closed header still reports the rules ────────────────────────
  const closed = await api(() => {
    const row = document.querySelector('aside.scriare-panel-r [data-option-id="effects"]');
    const header = row?.querySelector("button");
    if (row?.dataset.expanded === "true") header?.click();
    return null;
  });
  void closed;
  await wait(220);
  const summary = await api(() => {
    const row = document.querySelector('aside.scriare-panel-r [data-option-id="effects"]');
    return { expanded: row.dataset.expanded === "true", text: row.innerText };
  });
  check(
    "a closed choice still says what it does, so a block of six can be read without opening six",
    summary.expanded === false && /2 actions/.test(summary.text) && /0 conditions/.test(summary.text),
    summary.text.replace(/\n/g, " · "),
  );

  // ── put it back ──────────────────────────────────────────────────────
  await seedProject();
  await wait(200);
  check(
    "the workspace is handed back to the next spec",
    await api(() => Boolean(window.__scriareProjectStore.getState().project)),
  );
}
