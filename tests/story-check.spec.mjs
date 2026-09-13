/**
 * Check Story (v0.36.0).
 *
 * Everything this reports is already knowable from the project — the point
 * is that none of it is visible while writing. Which means the danger is
 * the opposite of most features: not that it breaks loudly, but that it
 * quietly reports the wrong thing and gets believed. A validator that says
 * "nothing to fix" while a branch dangles is worse than no validator.
 *
 * So the cases here are the ones where a plausible implementation is
 * subtly wrong:
 *
 *  - A SCENE REACHED TWICE BY DIFFERENT ROUTES IS NOT A LOOP. Branches
 *    rejoin all the time; a cycle check that doesn't track the current
 *    path calls every diamond a loop and then refuses to measure the
 *    story.
 *  - A LOOP HAS NO LONGEST ROUTE. Reporting one anyway is inventing a
 *    number, so it reports nothing and says the story loops instead.
 *  - AN ENDING IS NOT AN ERROR. A branching story is supposed to have
 *    them; they belong in the count, not in the problems.
 *  - A GATE ON A DELETED VARIABLE IS INVISIBLE, NOT MERELY ODD.
 *    Conditions fail closed, so that choice can never appear for anyone —
 *    which is exactly the kind of thing you find out from a playtester.
 */
export default async function ({ api, check, seedProject }) {
  /** Builds a project from a compact description and checks it. */
  const analyse = (spec) =>
    api((input) => {
      const { buildChoiceBlockNode } = window.__scriareChoiceUtils;
      const scenes = input.scenes.map((scene, index) => ({
        id: scene.id,
        title: scene.title ?? scene.id,
        position: { x: 0, y: 0 },
        order: index,
        content: {
          type: "doc",
          content: [
            ...(scene.text === ""
              ? []
              : [{ type: "paragraph", content: [{ type: "text", text: scene.text ?? "some words here" }] }]),
            ...(scene.choices?.length
              ? [buildChoiceBlockNode(
                  scene.choices.map((choice, i) => ({
                    id: `${scene.id}-o${i}`,
                    text: choice.text ?? "go",
                    targetSceneId: choice.to ?? null,
                    conditions: choice.conditions ?? [],
                    actions: choice.actions ?? [],
                  })),
                  `${scene.id}-block`,
                )]
              : []),
          ],
        },
      }));
      const project = {
        name: "Check", createdAt: "", updatedAt: "",
        scenes,
        content: scenes.map((s, i) => ({
          id: s.id, kind: "leaf", category: "story", parentId: null, order: i, refType: "scene",
        })),
        favorites: [],
        variables: input.variables ?? [],
        entities: input.entities ?? [],
        choiceStyles: window.__scriareChoiceStyles.normalizeChoiceStyles(undefined),
        startSceneId: input.startSceneId === undefined ? "a" : input.startSceneId,
      };
      return window.__scriareStoryCheck.checkStory(project);
    }, spec);

  // 1 — a clean, ordinary branching story reports nothing to fix.
  let r = await analyse({
    scenes: [
      { id: "a", choices: [{ to: "b" }, { to: "c" }] },
      { id: "b", choices: [{ to: "d" }] },
      { id: "c", choices: [{ to: "d" }] },
      { id: "d" },
    ],
  });
  check("a story where everything connects reports nothing to fix",
    r.issues.length === 0, JSON.stringify(r.issues.map((i) => i.kind)));
  check("...and a scene two branches both reach is NOT called a loop",
    r.stats.loops === false && r.stats.longestRoute === 3,
    `loops: ${r.stats.loops}, longest: ${r.stats.longestRoute}`);
  check("its ending is counted as an ending, not reported as a problem",
    r.stats.endings === 1 && r.endings[0].id === "d", JSON.stringify(r.endings));
  check("the routes are measured from the start",
    r.stats.shortestRoute === 3 && r.stats.reachable === 4,
    `shortest ${r.stats.shortestRoute}, reachable ${r.stats.reachable}`);

  // 2 — a real loop: the number is withheld rather than invented.
  r = await analyse({
    scenes: [
      { id: "a", choices: [{ to: "b" }] },
      { id: "b", choices: [{ to: "a" }, { to: "c" }] },
      { id: "c" },
    ],
  });
  check("a story that can return on itself says so",
    r.stats.loops === true, `loops: ${r.stats.loops}`);
  check("...and refuses to name a longest route, which doesn't exist",
    r.stats.longestRoute === null, `longest: ${r.stats.longestRoute}`);
  check("...while the shortest route is still answerable",
    r.stats.shortestRoute === 3, `shortest: ${r.stats.shortestRoute}`);

  // 3 — the three broken things, each pointing somewhere useful.
  r = await analyse({
    scenes: [
      { id: "a", choices: [{ text: "nowhere", to: null }, { text: "gone", to: "deleted" }, { to: "b" }] },
      { id: "b" },
      { id: "orphan", title: "Written but unwired" },
    ],
  });
  const kinds = r.issues.map((i) => i.kind);
  check("a choice that goes nowhere is a problem",
    kinds.includes("unlinked-choice") &&
      r.issues.find((i) => i.kind === "unlinked-choice").severity === "problem",
    JSON.stringify(kinds));
  check("a choice pointing at a deleted scene is a problem",
    kinds.includes("broken-link"), JSON.stringify(kinds));
  check("a scene nothing leads to is a warning, not a problem",
    r.issues.find((i) => i.kind === "unreachable-scene")?.severity === "warning",
    JSON.stringify(r.issues.map((i) => `${i.kind}:${i.severity}`)));
  check("every issue says where to go",
    r.issues.every((i) => Boolean(i.sceneId)) &&
      r.issues
        .filter((i) => i.kind === "unlinked-choice" || i.kind === "broken-link")
        .every((i) => Boolean(i.blockId)),
    JSON.stringify(r.issues.map((i) => ({ k: i.kind, s: i.sceneId, b: i.blockId }))));

  // 4 — a gate whose variable was deleted can never open. This one is
  // invisible in the app and invisible in Play: the choice simply never
  // appears, for anyone, ever.
  r = await analyse({
    scenes: [
      {
        id: "a",
        choices: [
          { text: "locked", to: "b", conditions: [{ id: "c1", variableId: "deleted", comparator: "eq", value: true }] },
          { text: "sets", to: "b", actions: [{ id: "a1", variableId: "deleted", operation: "set", value: 1 }] },
        ],
      },
      { id: "b" },
    ],
    variables: [],
  });
  check("a condition on a deleted variable is a problem — that choice can never appear",
    r.issues.some((i) => i.kind === "missing-variable-condition" && i.severity === "problem"),
    JSON.stringify(r.issues.map((i) => i.kind)));
  check("an action on a deleted variable is only a warning — it just does nothing",
    r.issues.find((i) => i.kind === "missing-variable-action")?.severity === "warning",
    JSON.stringify(r.issues.map((i) => `${i.kind}:${i.severity}`)));

  // 5 — the start scene. Leaving it unset is not a problem (Play Mode
  // falls back to the first scene, as Project Settings says); starting
  // from a scene that was DELETED is, because the story then begins
  // somewhere nobody chose.
  r = await analyse({ scenes: [{ id: "a" }], startSceneId: null });
  check("an unset start scene is not reported — the first scene is the documented fallback",
    !r.issues.some((i) => i.kind === "no-start-scene"), JSON.stringify(r.issues.map((i) => i.kind)));

  r = await analyse({ scenes: [{ id: "a" }], startSceneId: "deleted-scene" });
  check("a start scene that was deleted IS reported",
    r.issues.some((i) => i.kind === "no-start-scene" && i.severity === "problem"),
    JSON.stringify(r.issues.map((i) => i.kind)));
  check("...and the story is still measured, from wherever it can begin",
    r.stats.reachable === 1, `reachable ${r.stats.reachable}`);

  // 6 — words are counted the way a writer counts them, including the
  // choices a player reads and the names inside sentences.
  r = await api(() => {
    const { buildChoiceBlockNode } = window.__scriareChoiceUtils;
    const project = {
      name: "Words", createdAt: "", updatedAt: "",
      scenes: [{
        id: "a", title: "A", position: { x: 0, y: 0 }, order: 0,
        content: { type: "doc", content: [
          { type: "paragraph", content: [
            { type: "text", text: "Behind it, " },
            { type: "mention", attrs: { entityId: "c1", label: "Mara" } },
            { type: "text", text: " waits." },
          ] },
          buildChoiceBlockNode([{ id: "o1", text: "Open the door", targetSceneId: null }], "b1"),
        ] },
      }],
      content: [{ id: "a", kind: "leaf", category: "story", parentId: null, order: 0, refType: "scene" }],
      favorites: [], variables: [],
      entities: [{ id: "c1", kind: "character", name: "Mara", aliases: [], content: { type: "doc", content: [] } }],
      choiceStyles: window.__scriareChoiceStyles.normalizeChoiceStyles(undefined),
      startSceneId: "a",
    };
    return window.__scriareStoryCheck.checkStory(project).stats.words;
  });
  // "Behind it, Mara waits." = 4, "Open the door" = 3.
  check("a name in a sentence counts as the word it is", r === 7, `counted ${r}`);

  // 7 — through the app: the dialog opens, lists the problem, and clicking
  // it lands on the scene AND on the choice. A report you have to go and
  // act on yourself is a list of reasons to close the window.
  await api(() => {
    const store = window.__scriareProjectStore;
    const { buildChoiceBlockNode } = window.__scriareChoiceUtils;
    const now = new Date().toISOString();
    const scene = (id, title, choices) => ({
      id, title, position: { x: 0, y: 0 }, order: 0,
      content: { type: "doc", content: [
        { type: "paragraph", content: [{ type: "text", text: "words" }] },
        ...(choices ? [buildChoiceBlockNode(choices, `${id}-block`)] : []),
      ] },
    });
    store.setState({
      project: {
        name: "Broken", createdAt: now, updatedAt: now,
        scenes: [
          scene("start", "Opening", [{ id: "o1", text: "Go nowhere", targetSceneId: null }]),
          scene("lost", "Nobody Comes Here", null),
        ],
        content: ["start", "lost"].map((id, i) => ({
          id, kind: "leaf", category: "story", parentId: null, order: i, refType: "scene",
        })),
        favorites: [], variables: [], entities: [],
        choiceStyles: window.__scriareChoiceStyles.normalizeChoiceStyles(undefined),
        startSceneId: "start",
      },
      filePath: null, selectedSceneId: "lost", selectedEntityId: null, saveStatus: "saved",
      isPlaying: false, canUndo: false, canRedo: false, undoLabel: null, redoLabel: null, undoToken: null,
    });
    window.__scriareInspectorStore.getState().clearTarget();
  });
  await new Promise((resolve) => setTimeout(resolve, 250));

  r = await api(() => {
    const open = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Check");
    open?.click();
    return Boolean(open);
  });
  await new Promise((resolve) => setTimeout(resolve, 250));
  check("there is a way into it from the top bar", r === true);

  r = await api(() => {
    const rows = [...document.querySelectorAll("[data-issue]")];
    return rows.map((b) => `${b.dataset.issue}: ${b.textContent.trim().slice(0, 40)}`);
  });
  check("it lists the dangling choice and the unreachable scene",
    r.some((t) => t.startsWith("unlinked-choice")) && r.some((t) => t.startsWith("unreachable-scene")),
    JSON.stringify(r));

  await api(() => {
    const row = [...document.querySelectorAll('[data-issue="unlinked-choice"]')][0];
    row?.click();
  });
  // Read AFTER React has re-rendered: clicking schedules the close, so
  // asking in the same tick would report the dialog still open whatever
  // the app did.
  await new Promise((resolve) => setTimeout(resolve, 250));
  r = await api(() => ({
    scene: window.__scriareProjectStore.getState().selectedSceneId,
    target: window.__scriareInspectorStore.getState().target,
    dialogClosed: document.querySelectorAll("[data-issue]").length === 0,
  }));
  check("clicking a problem takes you to the scene it's in",
    r.scene === "start", `landed on ${r.scene}`);
  check("...and points the Inspector at the choice that needs fixing",
    r.target.kind === "choice" && r.target.blockId === "start-block", JSON.stringify(r.target));
  check("...and gets out of the way", r.dialogClosed);

  // 8 — the grouping itself (v0.36.2, reported).
  //
  // Six unlinked choices in one Choice Block produced six identical rows —
  // same scene, same sentence, six times — and the panel read as a wall
  // before it read as information. Grouped by scene it's one line, and the
  // line has to STAY a line: counts became chips precisely because the
  // prose version ("6 choices go nowhere and nothing leads here") wraps to
  // two rows and breaks the rhythm of the list.
  await api(() => {
    const store = window.__scriareProjectStore;
    const { buildChoiceBlockNode } = window.__scriareChoiceUtils;
    const now = new Date().toISOString();
    const scene = (id, title, choices) => ({
      id, title, position: { x: 0, y: 0 }, order: 0,
      content: { type: "doc", content: [
        { type: "paragraph", content: [{ type: "text", text: "words" }] },
        ...(choices ? [buildChoiceBlockNode(choices, `${id}-block`)] : []),
      ] },
    });
    store.setState({
      project: {
        name: "Wall", createdAt: now, updatedAt: now,
        scenes: [
          scene("start", "Opening", [{ id: "ok", text: "Go on", targetSceneId: "pile" }]),
          // A real scene title, not "Scene 2": the header only has to hold
          // its line when there's something in it. With a short name the
          // prose version of these counts fits too, and the test passes on
          // the layout it was written to rule out.
          scene(
            "pile",
            "Ercüment Çökertme — The Long Night",
            [1, 2, 3, 4, 5, 6].map((n) => ({ id: `u${n}`, text: "", targetSceneId: null })),
          ),
        ],
        content: ["start", "pile"].map((id, i) => ({
          id, kind: "leaf", category: "story", parentId: null, order: i, refType: "scene",
        })),
        favorites: [], variables: [], entities: [],
        choiceStyles: window.__scriareChoiceStyles.normalizeChoiceStyles(undefined),
        startSceneId: "start",
      },
      filePath: null, selectedSceneId: "start", selectedEntityId: null, saveStatus: "saved",
      isPlaying: false, canUndo: false, canRedo: false, undoLabel: null, redoLabel: null, undoToken: null,
    });
  });
  await new Promise((resolve) => setTimeout(resolve, 250));
  await api(() => {
    [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Check")?.click();
  });
  await new Promise((resolve) => setTimeout(resolve, 250));

  r = await api(() => {
    const groups = [...document.querySelectorAll("[data-scene-group]")];
    const header = groups[0]?.querySelector("button");
    return {
      groups: groups.length,
      rowsAtRest: document.querySelectorAll("[data-scene-group] button").length,
      headerHeight: header ? Math.round(header.getBoundingClientRect().height) : null,
      chips: [...(header?.querySelectorAll("[data-chip]") ?? [])].map((c) => c.textContent),
      nameShown: header?.querySelector(".truncate")?.textContent ?? null,
    };
  });
  check("six problems in one scene collapse to one line",
    r.groups === 1 && r.rowsAtRest === 1, JSON.stringify(r));
  check("the scene's name is still readable beside them",
    r.nameShown && r.nameShown.startsWith("Ercüment"), `name: ${r.nameShown}`);
  check("...counted in a chip rather than repeated as six sentences",
    r.chips.join() === "6 unlinked", JSON.stringify(r.chips));
  check("...on a header that stays one line",
    r.headerHeight !== null && r.headerHeight <= 44, `${r.headerHeight}px`);

  r = await api(() => {
    document.querySelector("[data-scene-group] button")?.click();
    return true;
  });
  await new Promise((resolve) => setTimeout(resolve, 200));
  r = await api(() => {
    const rows = [...document.querySelectorAll("[data-scene-group] [data-issue]")];
    return rows.map((b) => b.innerText.replace(/\n/g, " "));
  });
  check("opening it gives back every one of them, named by position",
    r.length === 6 && r[0].includes("choice 1") && r[5].includes("choice 6"),
    JSON.stringify(r));

  await seedProject();
}
