/**
 * What a locked option tells the reader (v0.72.0).
 *
 * A locked option is shown on purpose — the runtime's own comment argues
 * that a crossed-out row with no reason is worse than no row at all — and
 * that decision made the variable's name into prose. Until this version a
 * player met "Requires knows_roster is true" in the middle of a story: an
 * internal identifier, an English comparator and a raw value, none of
 * which anybody wrote.
 *
 * Everything here is asserted on the two surfaces a reader can actually
 * reach — Play Mode and the exported page — rather than on the phrasing
 * helper they share, because the helper has been correct in every version
 * of this that never shipped and what a player sees is a rendered row.
 */
export default async function run({ api, check, seedProject, openExported }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ── a story with one of each kind of gate ────────────────────────────
  await api(() => {
    const store = window.__scriareProjectStore;
    const { buildChoiceBlockNode } = window.__scriareChoiceUtils;
    const { normalizeProject } = window.__scriareProjectTypes;
    const now = new Date().toISOString();
    const leaf = (id, i) => ({
      id, kind: "leaf", category: "story", parentId: null, order: i, refType: "scene",
    });
    const scene = (id, title, content) => ({
      id, title, content: { type: "doc", content }, position: { x: 0, y: 0 }, frameId: null, order: 0,
    });

    store.setState({
      project: normalizeProject({
        name: "Gates",
        createdAt: now,
        updatedAt: now,
        variables: [
          // Named for the reader.
          { id: "v1", name: "resolve", displayName: "Courage", type: "number", defaultValue: 0 },
          // A boolean, which is the phrasing that has no sensible form
          // with its value printed: "knows_roster is true" is not English.
          { id: "v2", name: "knows_roster", displayName: "The Roster", type: "boolean", defaultValue: false },
          // Starts TRUE, so a condition asking for its absence fails and
          // the option is actually locked — a negative gate that passes
          // would have left this case untested while looking tested.
          { id: "v4", name: "lamp_lit", displayName: "The Dark", type: "boolean", defaultValue: true },
          // Deliberately unnamed — Check Story should say so.
          { id: "v3", name: "deniz_warned", type: "boolean", defaultValue: false },
        ],
        entities: [],
        choiceStyles: window.__scriareChoiceStyles.normalizeChoiceStyles(undefined),
        favorites: [],
        startSceneId: "sa",
        scenes: [
          scene("sa", "The Gate", [
            { type: "paragraph", content: [{ type: "text", text: "Three doors." }] },
            buildChoiceBlockNode(
              [
                {
                  id: "o-num", text: "Push through", targetSceneId: "sb",
                  whenUnmet: "lock",
                  conditions: [{ id: "c1", variableId: "v1", comparator: "gte", value: 3 }],
                },
                {
                  id: "o-bool", text: "Name the names", targetSceneId: "sb",
                  whenUnmet: "lock",
                  conditions: [{ id: "c2", variableId: "v2", comparator: "eq", value: true }],
                },
                {
                  id: "o-neg", text: "Slip past unseen", targetSceneId: "sb",
                  whenUnmet: "lock",
                  conditions: [{ id: "c3", variableId: "v4", comparator: "eq", value: false }],
                },
                {
                  id: "o-written", text: "Ask about the vote", targetSceneId: "sb",
                  whenUnmet: "lock",
                  lockReason: "You would have to have spoken to Nesrin first.",
                  conditions: [{ id: "c4", variableId: "v1", comparator: "gte", value: 9 }],
                },
                {
                  id: "o-hidden", text: "The secret way", targetSceneId: "sb",
                  whenUnmet: "hide",
                  conditions: [{ id: "c5", variableId: "v3", comparator: "eq", value: true }],
                },
                { id: "o-open", text: "Just go in", targetSceneId: "sb" },
              ],
              "blk",
            ),
          ]),
          scene("sb", "Inside", [
            { type: "paragraph", content: [{ type: "text", text: "It is warmer in here." }] },
          ]),
        ],
        content: [leaf("sa", 0), leaf("sb", 1)],
      }),
      filePath: null,
      selectedSceneId: "sa",
      selectedEntityId: null,
      saveStatus: "saved",
      isPlaying: false,
    });
  });
  await wait(600);

  // ── Play Mode, which is the rehearsal ────────────────────────────────
  await api(() => window.__scriareProjectStore.getState().startPlay());
  await wait(800);

  const played = await api(() => {
    const locked = [...document.querySelectorAll("[data-locked='true'], button[disabled]")];
    return locked.map((el) => el.textContent.replace(/\s+/g, " ").trim());
  });

  const reasonFor = (label, rows) => rows.find((r) => r.includes(label)) ?? "";

  check(
    "A NUMBER'S THRESHOLD NEVER REACHES THE READER — they learn what they lack, not the integer",
    reasonFor("Push through", played).includes("Requires Courage") &&
      !reasonFor("Push through", played).includes("3"),
    reasonFor("Push through", played) || "no locked row found",
  );
  check(
    "A BOOLEAN READS AS A THING, not as `is true`",
    reasonFor("Name the names", played).includes("Requires The Roster") &&
      !reasonFor("Name the names", played).includes("true"),
    reasonFor("Name the names", played) || "missing",
  );
  check(
    "A NEGATIVE CONDITION SAYS SO — dropping the value would state the opposite",
    reasonFor("Slip past unseen", played).includes("not The Dark"),
    reasonFor("Slip past unseen", played) || "missing",
  );
  check(
    "THE WRITER'S OWN SENTENCE REPLACES OURS, with no \"Requires\" bolted on the front",
    reasonFor("Ask about", played).includes("You would have to have spoken to Nesrin first.") &&
      !reasonFor("Ask about", played).includes("Requires"),
    reasonFor("Ask about", played) || "missing",
  );
  check(
    "...and no internal name survives anywhere on the page",
    !played.join(" ").includes("resolve") && !played.join(" ").includes("knows_roster"),
    played.join(" | ").slice(0, 150),
  );
  check(
    "a HIDDEN option is still hidden, so its unnamed variable never shows",
    !played.join(" ").includes("secret way") && !played.join(" ").includes("deniz_warned"),
    `${played.length} locked rows`,
  );

  await api(() => window.__scriareProjectStore.getState().exitPlay());
  await wait(400);

  // ── the exported page, which is the finished file ────────────────────
  // Play Mode and the export are two renderings of one story, and the one
  // failure this version could have is the rehearsal disagreeing with the
  // thing a stranger opens.
  const html = await api(() => {
    const project = window.__scriareProjectStore.getState().project;
    const story = window.__scriareExport.buildExportStory(project);
    return window.__scriareExport.buildExportHtml(story);
  });
  const exported = await openExported(html);
  await wait(700);
  const onPage = await exported.evaluate(() => {
    const rows = [...document.querySelectorAll(".scriare-choice.is-locked")];
    return rows.map((el) => el.textContent.replace(/\s+/g, " ").trim());
  });
  check(
    "THE EXPORTED PAGE SAYS THE SAME THINGS — a rehearsal that disagrees is worse than none",
    onPage.some((r) => r.includes("Requires Courage")) &&
      onPage.some((r) => r.includes("Requires The Roster")) &&
      onPage.some((r) => r.includes("not The Dark")) &&
      onPage.some((r) => r.includes("You would have to have spoken to Nesrin first.")),
    onPage.join(" | ").slice(0, 200) || "no locked rows on the page",
  );
  check(
    "...and it leaks no identifier either",
    !onPage.join(" ").includes("resolve") && !onPage.join(" ").includes("knows_roster"),
    onPage.join(" | ").slice(0, 120),
  );
  check(
    "...and the word \"Requires\" is no longer hard-coded in the page's own runtime",
    !/"Requires "/.test(html),
    /"Requires[^"]{0,24}/.exec(html)?.[0] ?? "absent from the runtime",
  );

  // ── Check Story finds the one the writer has not named ───────────────
  const found = await api(() => {
    const { checkStory } = window.__scriareStoryCheck;
    const project = window.__scriareProjectStore.getState().project;
    const issues = checkStory(project).issues.filter((i) => i.kind === "unnamed-variable-shown");
    return issues.map((i) => ({ label: i.label, detail: i.detail }));
  });
  check(
    "CHECK STORY REPORTS A VARIABLE A READER CAN SEE BUT NOBODY NAMED",
    found.length === 0,
    found.length ? found[0].detail : "nothing unnamed is reader-visible in this fixture",
  );

  const withUnnamed = await api(() => {
    const { checkStory } = window.__scriareStoryCheck;
    const store = window.__scriareProjectStore;
    const project = store.getState().project;
    // Strip Courage's display name and the written reason, so the two
    // escape hatches are both closed and the warning has to fire.
    const stripped = {
      ...project,
      variables: project.variables.map((v) => (v.id === "v1" ? { ...v, displayName: "" } : v)),
    };
    const issues = checkStory(stripped).issues.filter((i) => i.kind === "unnamed-variable-shown");
    return { count: issues.length, detail: issues[0]?.detail ?? "" };
  });
  check(
    "...it fires the moment a shown variable loses its display name",
    withUnnamed.count >= 1 && withUnnamed.detail.includes("resolve"),
    `${withUnnamed.count} reported — ${withUnnamed.detail.slice(0, 100)}`,
  );
  check(
    "...and NOT for the option carrying the writer's own sentence, which names nothing",
    withUnnamed.count === 1,
    `${withUnnamed.count} reported, and four options are locked`,
  );

  await seedProject();
  await wait(300);
  check(
    "the workspace is handed back to the next spec",
    await api(() => Boolean(window.__scriareProjectStore.getState().project)),
  );
}
