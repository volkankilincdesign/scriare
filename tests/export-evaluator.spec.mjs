/**
 * The exported page's evaluator against the app's (v0.48.0).
 *
 * WHY THIS FILE EXISTS. Almost all of Export avoids duplicating the app by
 * reusing its code at export time: prose goes through the same Tiptap
 * pipeline Play Mode uses, choice boxes are resolved with the app's own
 * `resolveChoiceBox`, a locked choice's reason is written by the app's own
 * `describeCondition`. Exactly two things could not be reused, because a
 * save dialog cannot ship TypeScript to a browser: deciding whether a
 * condition passes, and applying a variable action. Those are transliterated
 * by hand in src/renderer/src/export/pageRuntime.ts.
 *
 * Hand-transliterated logic drifts, and the failure it drifts into is the
 * worst kind this app has: a door that opens in Play Mode and stays shut in
 * the export — or the reverse — with nothing on screen to suggest anything
 * is wrong. The writer finds out when a reader tells them the story is
 * broken.
 *
 * So the duplicate is held to the original by enumeration rather than by
 * care. Every variable type, every comparator, both polarities of `negate`,
 * every operation, and a spread of values that includes the type-mismatched
 * ones a hand-edited project file can produce — both implementations get
 * the same input and must return the same answer.
 *
 * WHAT IS ACTUALLY MEASURED. Not a copy of the runtime pasted into this
 * file, which would only move the drift. The spec runs the real exporter,
 * writes the real file to disk, opens it in a window of its own, and reads
 * the answers out of the page that is running — through the page's own
 * restore path, not a back door invented for the test.
 */

const VARIABLES = [
  { id: "n", name: "Trust", type: "number", defaultValue: 0 },
  { id: "b", name: "Met her", type: "boolean", defaultValue: false },
  { id: "s", name: "Alias", type: "string", defaultValue: "" },
];

const now = new Date().toISOString();

export default async function run({ api, check, openExported }) {
  /* ────────────────────────────────────────────────────────────────
     Conditions
     ──────────────────────────────────────────────────────────────── */

  const conditionPlan = await api(
    ({ variables, now: stamp }) => {
      const X = window.__scriareExport;
      const V = window.__scriareVariables;

      // Values of the WRONG type for the variable are in here on purpose: a
      // project file is editable text, both implementations coerce, and the
      // point of testing it is that they coerce identically.
      const currents = {
        n: [0, 3, -2, 3.5, "3", true, null],
        b: [true, false, 1, 0, "", "no", null],
        s: ["", "Mara", "mara", "0", 0, false, null],
      };
      const operands = {
        n: [0, 3, -1, 2.5, "3", true],
        b: [true, false, 1, ""],
        s: ["", "Mara", "mara", 7, null],
      };

      const cases = [];
      for (const variable of variables) {
        const comparators = V.COMPARATORS_BY_TYPE[variable.type].map((c) => c.value);
        // An unrecognised comparator is included deliberately: both sides
        // fall back to equality, and "both sides share a fallback" is
        // exactly the kind of agreement that quietly stops being true.
        comparators.push("not-a-comparator");
        for (const comparator of comparators) {
          for (const negate of [false, true]) {
            for (const current of currents[variable.id]) {
              for (const value of operands[variable.id]) {
                cases.push({ variable, comparator, negate, current, value });
              }
            }
          }
        }
      }

      const expected = cases.map((c) =>
        V.evaluateConditions(
          [{ id: "c", variableId: c.variable.id, comparator: c.comparator, value: c.value, negate: c.negate }],
          variables,
          { [c.variable.id]: c.current },
        ),
      );

      // One choice per case, all in one scene, every one set to "lock" so a
      // FAILING condition still renders a button. That is what makes the
      // reading unambiguous: button order matches option order exactly, so
      // "the nth button is disabled" means "case n failed" — never "case n
      // vanished for some other reason".
      const options = cases.map((c, i) => ({
        type: "choiceOption",
        attrs: {
          optionId: `o${i}`,
          targetSceneId: "end",
          actions: [],
          conditions: [
            { id: `c${i}`, variableId: c.variable.id, comparator: c.comparator, value: c.value, negate: c.negate },
          ],
          whenUnmet: "lock",
          style: null,
          speaker: null,
        },
        content: [{ type: "text", text: `case ${i}` }],
      }));

      const project = {
        id: "evalprobe",
        name: "Evaluator probe",
        createdAt: stamp,
        updatedAt: stamp,
        startSceneId: "probe",
        scenes: [
          {
            id: "probe",
            title: "Probe",
            content: { type: "doc", content: [{ type: "choiceBlock", content: options }] },
            position: { x: 0, y: 0 },
            frameId: null,
            order: 0,
          },
          {
            id: "end",
            title: "End",
            content: { type: "doc", content: [{ type: "paragraph" }] },
            position: { x: 0, y: 0 },
            frameId: null,
            order: 1,
          },
        ],
        content: [],
        favorites: [],
        variables,
        choiceStyles: window.__scriareChoiceStyles.normalizeChoiceStyles(undefined),
        entities: [],
      };

      // Grouped by the value the variable must hold, so the page is loaded
      // once per distinct starting state rather than once per case.
      const groups = [];
      const byKey = new Map();
      cases.forEach((c, i) => {
        const key = `${c.variable.id}:${JSON.stringify(c.current)}:${typeof c.current}`;
        if (!byKey.has(key)) {
          byKey.set(key, { variableId: c.variable.id, current: c.current, indices: [] });
          groups.push(byKey.get(key));
        }
        byKey.get(key).indices.push(i);
      });

      return {
        html: X.buildExportHtml(X.buildExportStory(project)),
        expected,
        groups,
        total: cases.length,
        describe: cases.map((c) => ({
          type: c.variable.type,
          comparator: c.comparator,
          negate: c.negate,
          current: `${String(c.current)} (${typeof c.current})`,
          value: `${String(c.value)} (${typeof c.value})`,
        })),
      };
    },
    { variables: VARIABLES, now },
  );

  const page = await openExported(conditionPlan.html);
  const actual = new Array(conditionPlan.total).fill("not-read");
  let shape = null;

  for (const group of conditionPlan.groups) {
    // The only door into the exported page's state is the progress it
    // restores from — which is the point. Writing a saved position with the
    // variable already set makes the page evaluate against a chosen value
    // using its OWN code path, not one this test bolted on.
    await page.evaluate((g) => {
      localStorage.setItem(
        "scriare:evalprobe:progress",
        JSON.stringify({
          scene: "probe",
          values: { n: 0, b: false, s: "", [g.variableId]: g.current },
          // Non-empty, so the page offers to resume rather than starting
          // fresh and discarding the value above.
          trail: [{ scene: "probe", values: {} }],
        }),
      );
    }, group);
    await page.reload();

    const read = await page.evaluate((indices) => {
      const resume = document.querySelector(".scriare-resume-yes");
      if (!resume) return { error: "the exported page did not offer to resume" };
      resume.click();
      const buttons = document.querySelectorAll(".scriare-choice");
      return { count: buttons.length, answers: indices.map((i) => !buttons[i].disabled) };
    }, group.indices);

    if (read.error) {
      shape = read.error;
      break;
    }
    if (read.count !== conditionPlan.total) {
      shape = `expected ${conditionPlan.total} choices, the page rendered ${read.count}`;
      break;
    }
    group.indices.forEach((i, at) => {
      actual[i] = read.answers[at];
    });
  }

  await page.evaluate(() => localStorage.removeItem("scriare:evalprobe:progress"));

  if (shape) {
    check("the condition probe ran", false, shape);
  } else {
    const mismatches = [];
    for (let i = 0; i < conditionPlan.total; i++) {
      if (actual[i] !== conditionPlan.expected[i]) {
        mismatches.push({ ...conditionPlan.describe[i], app: conditionPlan.expected[i], page: actual[i] });
      }
    }

    check(
      `every condition evaluates the same in the app and in the export (${conditionPlan.total} cases)`,
      mismatches.length === 0,
      mismatches.length === 0
        ? `${conditionPlan.total} cases over ${conditionPlan.groups.length} page loads`
        : `${mismatches.length} disagree, e.g. ${JSON.stringify(mismatches[0])}`,
    );

    // A matrix that has stopped covering anything still passes. Asserting
    // its size is what catches the refactor that leaves this running over
    // four rows and reporting a clean sweep.
    check(
      "the condition matrix is large enough to be evidence",
      conditionPlan.total > 500,
      `${conditionPlan.total} cases`,
    );
  }

  /* ────────────────────────────────────────────────────────────────
     Variable actions
     ──────────────────────────────────────────────────────────────── */

  const actionPlan = await api(
    ({ variables, now: stamp }) => {
      const X = window.__scriareExport;
      const V = window.__scriareVariables;

      const starts = { n: [0, 5, -3, "2"], b: [true, false, 1], s: ["", "x", 4] };
      const operands = { n: [2, -1, "3"], b: [true, false, 0], s: ["y", 9, null] };

      const cases = [];
      for (const variable of variables) {
        const operations = V.OPERATIONS_BY_TYPE[variable.type].map((o) => o.value);
        operations.push("not-an-operation");
        for (const operation of operations) {
          for (const start of starts[variable.id]) {
            for (const value of operands[variable.id]) {
              cases.push({ variable, operation, start, value });
            }
          }
        }
      }

      const expected = cases.map((c) =>
        V.applyVariableAction(c.start, c.variable, {
          id: "a",
          variableId: c.variable.id,
          operation: c.operation,
          value: c.value,
        }),
      );

      // One scene per case, each holding a single choice that carries that
      // case's action and leads to a shared ending. The exported runtime's
      // applyVariableAction is not reachable directly, so it is exercised
      // the way a reader exercises it — by clicking the choice — and the
      // answer is read out of the progress the page saves on the next
      // render.
      const scenes = cases.map((c, i) => ({
        id: `c${i}`,
        title: `Case ${i}`,
        content: {
          type: "doc",
          content: [
            {
              type: "choiceBlock",
              content: [
                {
                  type: "choiceOption",
                  attrs: {
                    optionId: `o${i}`,
                    targetSceneId: "end",
                    actions: [
                      { id: `a${i}`, variableId: c.variable.id, operation: c.operation, value: c.value },
                    ],
                    conditions: [],
                    whenUnmet: "hide",
                    style: null,
                    speaker: null,
                  },
                  content: [{ type: "text", text: "go" }],
                },
              ],
            },
          ],
        },
        position: { x: 0, y: 0 },
        frameId: null,
        order: i,
      }));

      scenes.push({
        id: "end",
        title: "End",
        content: { type: "doc", content: [{ type: "paragraph" }] },
        position: { x: 0, y: 0 },
        frameId: null,
        order: cases.length,
      });

      const project = {
        id: "actprobe",
        name: "Action probe",
        createdAt: stamp,
        updatedAt: stamp,
        startSceneId: "c0",
        scenes,
        content: [],
        favorites: [],
        variables,
        choiceStyles: window.__scriareChoiceStyles.normalizeChoiceStyles(undefined),
        entities: [],
      };

      return {
        html: X.buildExportHtml(X.buildExportStory(project)),
        expected: expected.map((v) => ({ value: v, kind: typeof v })),
        cases: cases.map((c, i) => ({
          index: i,
          variableId: c.variable.id,
          type: c.variable.type,
          operation: c.operation,
          start: c.start,
          value: c.value,
        })),
      };
    },
    { variables: VARIABLES, now },
  );

  const actionPage = await openExported(actionPlan.html);
  const actionResults = [];

  for (const c of actionPlan.cases) {
    await actionPage.evaluate((one) => {
      localStorage.setItem(
        "scriare:actprobe:progress",
        JSON.stringify({
          scene: `c${one.index}`,
          values: { n: 0, b: false, s: "", [one.variableId]: one.start },
          trail: [{ scene: `c${one.index}`, values: {} }],
        }),
      );
    }, c);
    await actionPage.reload();

    actionResults.push(
      await actionPage.evaluate((one) => {
        const resume = document.querySelector(".scriare-resume-yes");
        if (!resume) return { error: "no resume offered" };
        resume.click();
        const choice = document.querySelector(".scriare-choice");
        if (!choice) return { error: "no choice rendered" };
        choice.click();
        const saved = JSON.parse(localStorage.getItem("scriare:actprobe:progress"));
        const value = saved.values[one.variableId];
        return { value, kind: typeof value };
      }, c),
    );
  }

  await actionPage.evaluate(() => localStorage.removeItem("scriare:actprobe:progress"));

  const actionMismatches = [];
  for (let i = 0; i < actionPlan.cases.length; i++) {
    const got = actionResults[i];
    const want = actionPlan.expected[i];
    // The type is compared as well as the value. `false` and `0` cross a
    // JSON round trip as themselves, but a boolean operation that started
    // returning a number would otherwise pass a loose comparison — and a
    // variable that silently changes type is a condition that silently
    // changes answer.
    if (got.error || got.value !== want.value || got.kind !== want.kind) {
      actionMismatches.push({
        ...actionPlan.cases[i],
        start: String(actionPlan.cases[i].start),
        value: String(actionPlan.cases[i].value),
        app: `${String(want.value)} (${want.kind})`,
        page: got.error ?? `${String(got.value)} (${got.kind})`,
      });
    }
  }

  check(
    `every variable action produces the same value in the app and in the export (${actionPlan.cases.length} cases)`,
    actionMismatches.length === 0,
    actionMismatches.length === 0
      ? `${actionPlan.cases.length} cases`
      : `${actionMismatches.length} disagree, e.g. ${JSON.stringify(actionMismatches[0])}`,
  );

  check(
    "the action matrix is large enough to be evidence",
    actionPlan.cases.length > 40,
    `${actionPlan.cases.length} cases`,
  );
}
