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
export default async function ({ api, check, seedProject }) {
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
          ...(options ? [{ type: "choiceBlock", attrs: { blockId: "b" + id, options } }] : []),
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
}
