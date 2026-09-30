/**
 * Conditions (v0.30.0).
 *
 * Conditions are the first feature in Scriare whose correct behaviour is
 * INVISIBLE: a hidden choice looks exactly like a choice that was never
 * written. That makes them the easiest thing in the app to get subtly
 * wrong and never notice, which is why the evaluation rules get tested
 * directly rather than only through the UI.
 *
 * The two that carry real weight:
 *  - an empty condition list must PASS, or every choice written before
 *    this version silently disappears;
 *  - a condition whose variable was deleted must FAIL, so a gate whose
 *    question can no longer be asked stays shut rather than swinging open.
 * Both were verified to fail on builds with that logic inverted.
 */
export default async function ({ page, api, check, seedProject, app }) {
  const V = () => window.__scriareVariables;

  // 1 — the backwards-compatibility guarantee
  let r = await api(() => {
    const { evaluateConditions } = window.__scriareVariables;
    return {
      empty: evaluateConditions([], [], {}),
      undef: evaluateConditions(undefined, [], {}),
    };
  });
  check("no conditions means always available", r.empty === true && r.undef === true,
    `empty: ${r.empty}, undefined: ${r.undef}`);

  // 2 — the safe direction when a variable is gone
  r = await api(() => {
    const { evaluateConditions } = window.__scriareVariables;
    return evaluateConditions(
      [{ id: "c", variableId: "deleted", comparator: "eq", value: 1 }],
      [],
      {},
    );
  });
  check("a condition whose variable was deleted FAILS rather than passing", r === false, `got ${r}`);

  // 3 — every comparator, on a number
  r = await api(() => {
    const { evaluateCondition } = window.__scriareVariables;
    const trust = { id: "trust", name: "Trust", type: "number", defaultValue: 0 };
    const at = (comparator, value, current) =>
      evaluateCondition({ id: "c", variableId: "trust", comparator, value }, trust, current);
    return {
      eq: at("eq", 3, 3),
      eqNo: at("eq", 3, 2),
      neq: at("neq", 3, 2),
      gt: at("gt", 3, 4),
      gtEdge: at("gt", 3, 3),
      gte: at("gte", 3, 3),
      lt: at("lt", 3, 2),
      lte: at("lte", 3, 3),
    };
  });
  check("number comparators behave",
    r.eq && !r.eqNo && r.neq && r.gt && !r.gtEdge && r.gte && r.lt && r.lte,
    JSON.stringify(r));

  // 4 — NOT inverts whatever the comparator decided
  r = await api(() => {
    const { evaluateCondition } = window.__scriareVariables;
    const flag = { id: "f", name: "Met", type: "boolean", defaultValue: false };
    const base = { id: "c", variableId: "f", comparator: "eq", value: true };
    return {
      plain: evaluateCondition(base, flag, true),
      negated: evaluateCondition({ ...base, negate: true }, flag, true),
      negatedFalse: evaluateCondition({ ...base, negate: true }, flag, false),
    };
  });
  check("NOT inverts the result",
    r.plain === true && r.negated === false && r.negatedFalse === true, JSON.stringify(r));

  // 5 — a list is AND: one failure fails the lot
  r = await api(() => {
    const { evaluateConditions } = window.__scriareVariables;
    const vars = [
      { id: "trust", name: "Trust", type: "number", defaultValue: 0 },
      { id: "key", name: "HasKey", type: "boolean", defaultValue: false },
    ];
    const conds = [
      { id: "a", variableId: "trust", comparator: "gte", value: 3 },
      { id: "b", variableId: "key", comparator: "eq", value: true },
    ];
    return {
      both: evaluateConditions(conds, vars, { trust: 5, key: true }),
      oneShort: evaluateConditions(conds, vars, { trust: 5, key: false }),
      otherShort: evaluateConditions(conds, vars, { trust: 1, key: true }),
    };
  });
  check("every condition must hold",
    r.both === true && r.oneShort === false && r.otherShort === false, JSON.stringify(r));

  // 6 — an unset value falls back to the variable's default, not to undefined
  r = await api(() => {
    const { evaluateConditions } = window.__scriareVariables;
    const vars = [{ id: "trust", name: "Trust", type: "number", defaultValue: 5 }];
    return evaluateConditions(
      [{ id: "a", variableId: "trust", comparator: "gte", value: 3 }],
      vars,
      {}, // nothing has written to it yet this playthrough
    );
  });
  check("a variable not yet written uses its default value", r === true, `got ${r}`);

  // 7 — end to end through Play Mode: a gated choice appears only once the
  // variable says so, and a "lock" choice shows instead of vanishing.
  await api(() => {
    const store = window.__scriareProjectStore;
    const now = new Date().toISOString();
    const opt = (id, text, target, conditions, whenUnmet) => ({
      id, text, targetSceneId: target, actions: [], conditions, whenUnmet,
    });
    const scene = (id, title, options) => ({
      id, title,
      content: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: title }] },
          ...(options
            ? [window.__scriareChoiceUtils.buildChoiceBlockNode(options, "b" + id)]
            : []),
        ],
      },
      position: { x: 0, y: 0 }, order: 0,
    });
    store.setState({
      project: {
        name: "Gated", createdAt: now, updatedAt: now,
        scenes: [
          scene("start", "The Door", [
            opt("o1", "Walk through", "end", [{ id: "c1", variableId: "key", comparator: "eq", value: true }], "hide"),
            opt("o2", "Force it", "end", [{ id: "c2", variableId: "trust", comparator: "gte", value: 3 }], "lock"),
            opt("o3", "Turn back", "end", [], "hide"),
          ]),
          scene("end", "Outside", null),
        ],
        content: ["start", "end"].map((id, i) => ({
          id, kind: "leaf", category: "story", parentId: null, order: i, refType: "scene",
        })),
        favorites: [],
        variables: [
          { id: "key", name: "HasKey", type: "boolean", defaultValue: false },
          { id: "trust", name: "Trust", type: "number", defaultValue: 0 },
        ],
        startSceneId: "start",
      },
      filePath: null, selectedSceneId: "start", saveStatus: "saved",
      canUndo: false, canRedo: false, undoLabel: null, redoLabel: null, undoToken: null,
    });
    store.getState().startPlay();
  });

  const buttons = () =>
    api(() =>
      [...document.querySelectorAll("button")]
        .filter((b) => b.closest(".my-6"))
        .map((b) => `${b.disabled ? "[locked] " : ""}${b.textContent.trim()}`),
    );

  r = await buttons();
  check("a hidden choice is absent until its condition passes",
    !r.some((t) => t.includes("Walk through")), `buttons: ${JSON.stringify(r)}`);
  check("a locked choice is shown, disabled, with its reason",
    r.some((t) => t.startsWith("[locked]") && t.includes("Force it") && t.includes("Trust")),
    `buttons: ${JSON.stringify(r)}`);
  check("an unconditional choice is unaffected",
    r.some((t) => t.includes("Turn back") && !t.startsWith("[locked]")),
    `buttons: ${JSON.stringify(r)}`);

  // Flip the variables and the same scene reads differently.
  await api(() =>
    window.__scriareProjectStore.setState({ playVariableValues: { key: true, trust: 4 } }),
  );
  r = await buttons();
  check("the hidden choice appears once its condition passes",
    r.some((t) => t.includes("Walk through") && !t.startsWith("[locked]")),
    `buttons: ${JSON.stringify(r)}`);
  check("the locked choice unlocks",
    r.some((t) => t.includes("Force it") && !t.startsWith("[locked]")),
    `buttons: ${JSON.stringify(r)}`);

  // 8 — the variable readout is there for playtesting, closed by default
  // The panel's open/closed state persists in localStorage across runs, so
  // this asserts that toggling FLIPS it rather than assuming a starting
  // state — a test that only passes on a fresh profile is a test that fails
  // the second time you run it.
  const shows = () => api(() => document.body.innerText.includes("HasKey"));
  const toggleReadout = () =>
    api(() => {
      const toggle = [...document.querySelectorAll("button")].find((b) =>
        b.textContent.includes("Variables"),
      );
      if (!toggle) return false;
      toggle.click();
      return true;
    });

  // Two calls, not one: clicking schedules a React re-render, so reading
  // the DOM in the same synchronous block would always see the old frame.
  const startedOpen = await shows();
  const found = await toggleReadout();
  await new Promise((resolve) => setTimeout(resolve, 200));
  const afterFirst = await shows();
  await toggleReadout();
  await new Promise((resolve) => setTimeout(resolve, 200));
  const afterSecond = await shows();

  check("the Play Mode variable readout toggles, and shows live values when open",
    found && afterFirst === !startedOpen && afterSecond === startedOpen &&
      (afterFirst || afterSecond),
    `started ${startedOpen ? "open" : "closed"} → ${afterFirst} → ${afterSecond}`);

  await api(() => window.__scriareProjectStore.getState().exitPlay());
  await seedProject();

  await theThirdSibling({ page, api, check, seedProject, app });
}

/**
 * The Conditional as the third block type (v0.78.0, reported).
 *
 * It had existed since v0.30.0 with no way to create it but a slash
 * command — so a writer had to already know it was there. Two block types
 * with buttons and a third without said the pair was the complete set,
 * which is worse than either being missing.
 *
 * What is checked here is that it is drawn as FAMILY and behaves as a
 * PLACE TO WRITE. Those pull in opposite directions and both were asked
 * for: identical to its siblings down to the token, and a small editor
 * inside the editor that takes as many lines as the writer wants.
 */
export async function theThirdSibling({ page, api, check, seedProject, app }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await seedProject();
  const win = await app.browserWindow(page);
  await win.evaluate((w) => w.setBounds({ x: 0, y: 0, width: 1280, height: 1000 }));
  await wait(300);

  // ── the slash menu calls it what the button calls it ──────────────────
  // The last place still saying "Conditional Text" (v0.78.0), and the one
  // where a name being inconsistent does the most damage: the menu is how
  // a writer meets the block for the first time.
  const menu = async (query) => {
    await api(() => {
      const ed = window.__scriareEditorStore.getState().editor;
      ed.chain().focus().clearContent().insertContent({ type: "paragraph" }).run();
    });
    await wait(200);
    await page.keyboard.type(query);
    await wait(350);
    // SCOPED TO THE MENU. The first version read every button on screen
    // and filtered for /condition/i — which always matched the toolbar's
    // own Conditional button, so it passed no matter what the menu said.
    // Two controls went green against it before that was noticed.
    const items = await api(() =>
      [...document.querySelectorAll("[data-slash-menu] [data-slash-title]")].map((t) =>
        t.textContent.trim(),
      ),
    );
    await page.keyboard.press("Escape");
    await api(() => {
      const ed = window.__scriareEditorStore.getState().editor;
      ed.chain().focus().clearContent().insertContent({ type: "paragraph" }).run();
    });
    await wait(200);
    return items;
  };

  const byName = await menu("/cond");
  check(
    "the slash menu calls it Conditional, the same word as the button and the block",
    byName.includes("Conditional") && !byName.includes("Conditional Text"),
    JSON.stringify(byName),
  );
  // The menu matches on title as well as keywords, so the rename would
  // have quietly broken anyone who reached it by typing `/text`.
  const byHabit = await menu("/text");
  check(
    "...and is still reachable by the word that used to be in its title",
    byHabit.includes("Conditional"),
    JSON.stringify(byHabit),
  );

  // ── the button exists, and is not the lesser of three ─────────────────
  const buttons = await api(() => {
    const read = (sel) => {
      const b = document.querySelector(sel);
      if (!b) return null;
      const cs = getComputedStyle(b);
      return {
        bg: cs.backgroundColor, color: cs.color, height: cs.height,
        weight: cs.fontWeight, size: cs.fontSize, label: b.textContent.trim(),
      };
    };
    return {
      choice: read("[data-insert-choice]") ?? read("button[title^='Insert a Choice']"),
      dialogue: read("[data-insert-dialogue]"),
      conditional: read("[data-insert-conditional]"),
    };
  });
  check(
    "there is a third button at all — it was a slash command only, so effectively absent",
    buttons.conditional !== null && buttons.conditional.label === "Conditional",
    JSON.stringify(buttons.conditional),
  );
  // v0.67.4's rule, restated for a third control: drawing one of them
  // quieter says it is the lesser, which is what having no button said.
  const sameButton = (a, b) =>
    a && b && a.bg === b.bg && a.color === b.color && a.height === b.height &&
    a.weight === b.weight && a.size === b.size;
  check(
    "...drawn as the same control as the Dialogue, not a quieter one",
    sameButton(buttons.conditional, buttons.dialogue),
    JSON.stringify(buttons),
  );

  // ── clicking it lands the caret INSIDE, and it takes as many lines as
  //    the writer types ───────────────────────────────────────────────────
  // FROM A SCENE THE WRITER HAS JUST OPENED AND NOT YET TYPED IN, which
  // is the flow this was reported from: open a scene, reach for the new
  // button. Insert-at-the-caret does the right thing when the caret is
  // already in the prose, so a fixture that focuses the editor first
  // cannot see the bug — measured, the control stayed green through it.
  await api(() => {
    const st = window.__scriareProjectStore.getState();
    window.__scriareProjectStore.getState().updateSceneContent(st.project.scenes[0].id, {
      type: "doc",
      content: [
        { type: "paragraph", attrs: { lineId: "r1" }, content: [{ type: "text", text: "Rain on the glass." }] },
        { type: "paragraph", attrs: { lineId: "r2" }, content: [{ type: "text", text: "Three floors up." }] },
      ],
    });
  });
  await wait(250);
  // Bounced rather than focused: the editor loads the document and nobody
  // has put a caret in it.
  await api(() => {
    const s2 = window.__scriareProjectStore.getState();
    s2.selectScene(s2.project.scenes[1].id);
  });
  await wait(250);
  await api(() => {
    const s2 = window.__scriareProjectStore.getState();
    s2.selectScene(s2.project.scenes[0].id);
  });
  await wait(400);
  await api(() => document.querySelector("[data-insert-conditional]")?.click());
  await wait(400);
  await page.keyboard.type("You came up. Good.");
  await page.keyboard.press("Enter");
  await page.keyboard.type("I was not going to ask twice.");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Sit down.");
  await wait(300);

  const written = await api(() => {
    const ed = window.__scriareEditorStore.getState().editor;
    let block = null;
    ed.state.doc.descendants((n) => {
      if (n.type.name === "conditionalBlock") {
        block = { children: n.childCount, text: n.textContent };
        return false;
      }
      return true;
    });
    return block;
  });
  // The first build of this button inserted the block and left the caret
  // outside it, so everything typed went into the page behind it.
  check(
    "the caret lands inside it, so the first thing typed is inside the block",
    written !== null && written.text.startsWith("You came up. Good."),
    JSON.stringify(written),
  );
  check(
    "...and Enter keeps making lines INSIDE it — one Conditional, however many lines",
    written !== null && written.children === 3,
    JSON.stringify(written),
  );

  // And a way back out, or the block is a trap.
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await wait(200);
  await page.keyboard.type("Ordinary narration after.");
  await wait(300);
  const escaped = await api(() => {
    const ed = window.__scriareEditorStore.getState().editor;
    let inside = "";
    ed.state.doc.descendants((n) => {
      if (n.type.name === "conditionalBlock") { inside = n.textContent; return false; }
      return true;
    });
    return { inside, whole: ed.state.doc.textContent };
  });
  check(
    "...and the writer can get back out to ordinary prose",
    escaped.whole.includes("Ordinary narration after.") &&
      !escaped.inside.includes("Ordinary narration after."),
    JSON.stringify(escaped),
  );

  // ── drawn as family, to the token ─────────────────────────────────────
  await seedProject();
  await api(() => {
    const st = window.__scriareProjectStore.getState();
    const { buildChoiceBlockNode } = window.__scriareChoiceUtils;
    const { buildDialogueBlockNode } = window.__scriareDialogue;
    const vid = st.createVariable("hikmet_offer", "boolean");
    window.__scriareProjectStore.getState().updateSceneContent(st.project.scenes[0].id, {
      type: "doc",
      content: [
        {
          type: "conditionalBlock",
          attrs: {
            blockId: "cb",
            conditions: [{ id: "c1", variableId: vid, op: "is", value: true, negate: true }],
          },
          content: [
            { type: "paragraph", attrs: { lineId: "k1" },
              content: [{ type: "text", text: "You came up. Good." }] },
          ],
        },
        buildChoiceBlockNode(
          [{ id: "o1", text: "Stand there.", targetSceneId: st.project.scenes[1].id }],
          "chb",
        ),
        buildDialogueBlockNode([{ id: "d1", text: "Say it here, then.", after: "end" }], "dbb"),
      ],
    });
  });
  await wait(300);
  await api(() => {
    const s = window.__scriareProjectStore.getState();
    s.selectScene(s.project.scenes[1].id);
  });
  await wait(250);
  await api(() => {
    const s = window.__scriareProjectStore.getState();
    s.selectScene(s.project.scenes[0].id);
  });
  await wait(600);

  const drawn = await api(() => {
    const pick = (sel) => {
      const e = document.querySelector(sel);
      if (!e) return null;
      const cs = getComputedStyle(e);
      return {
        bg: cs.backgroundColor, border: cs.borderColor, width: cs.borderTopWidth,
        style: cs.borderTopStyle, radius: cs.borderTopLeftRadius, pad: cs.padding,
      };
    };
    const cond = document.querySelector(".conditional-block");
    return {
      cond: pick(".conditional-block"),
      choice: pick(".choice-block"),
      dialogue: pick(".dialogue-block"),
      // What the block says about itself, read off the screen.
      head: cond?.querySelector(".scriare-section-label")?.textContent ?? null,
      foot: cond?.lastElementChild?.textContent ?? null,
      // It holds prose, so it offers no way to add a row — only a way out.
      actions: [...(cond?.querySelectorAll("button") ?? [])].map((b) => b.textContent.trim()),
    };
  });
  const same = (a, b) =>
    a && b && a.bg === b.bg && a.border === b.border && a.width === b.width &&
    a.style === b.style && a.radius === b.radius && a.pad === b.pad;
  check(
    "it is drawn as the same object as the Choice — same fill, edge, radius and padding",
    same(drawn.cond, drawn.choice),
    JSON.stringify({ cond: drawn.cond, choice: drawn.choice }),
  );
  check(
    "...and as the same object as the Dialogue",
    same(drawn.cond, drawn.dialogue),
    JSON.stringify({ cond: drawn.cond, dialogue: drawn.dialogue }),
  );
  check(
    "its header names it and counts its conditions, the way the Dialogue counts lines",
    drawn.head?.includes("Conditional") && drawn.head?.includes("1 condition"),
    JSON.stringify(drawn.head),
  );
  // The one fact worth the footer's width, in the same words Play Mode and
  // the exported page use for a locked choice.
  check(
    "its footer says WHEN, in words, rather than counting something",
    drawn.foot?.includes("Shown when") && drawn.foot?.includes("hikmet_offer"),
    JSON.stringify(drawn.foot),
  );
  check(
    "it offers no way to add a row — it holds prose, so you add to it by typing",
    drawn.actions.length === 1 && drawn.actions[0] === "Remove block",
    JSON.stringify(drawn.actions),
  );

  // ── the Inspector stopped explaining what the block now says ──────────
  const panel = await api(() => {
    window.__scriareInspectorStore.getState().selectTarget({
      kind: "conditional",
      sceneId: window.__scriareProjectStore.getState().project.scenes[0].id,
      blockId: "cb",
    });
    return true;
  });
  await wait(350);
  const inspector = await api(() => {
    const p = document.querySelector(".scriare-panel-r");
    return { text: p?.innerText.replace(/\n/g, " | ") ?? null };
  });
  check(
    "the Inspector no longer spends two rows explaining the block",
    panel === true &&
      inspector.text !== null &&
      !inspector.text.includes("This passage appears only when"),
    JSON.stringify(inspector.text?.slice(0, 120)),
  );
  // Folded, because `scriare-section-label` uppercases it in CSS and
  // innerText returns what is PAINTED — asserting on "Conditional" here
  // would fail on a label that is perfectly correct.
  const folded = inspector.text?.toLowerCase() ?? "";
  check(
    "...and calls it by the same one word the block and the button use",
    folded.includes("conditional") && !folded.includes("conditional text"),
    JSON.stringify(inspector.text?.slice(0, 80)),
  );

  await seedProject();
}
