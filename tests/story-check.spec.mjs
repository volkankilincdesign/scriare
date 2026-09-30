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
export default async function ({ page, api, check, seedProject, app }) {
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

  // Opened first, since v0.77.0. Until then a scene with one finding drew
  // its row IN the header, so the findings were on screen the moment the
  // dialog was — which is why this check never opened anything and why it
  // went red when that row stopped existing. Every scene is a disclosure
  // now, and the thing being tested here is what is IN them.
  await api(() => {
    document.querySelectorAll("[data-scene-group] > button").forEach((b) => b.click());
  });
  await new Promise((resolve) => setTimeout(resolve, 250));

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
  await new Promise((resolve) => setTimeout(resolve, 100));
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

  // v0.76.0 — kept as its own function because it builds documents rather
  // than the compact scene descriptions above, and mixing the two styles
  // in one body is how a spec becomes unreadable.
  await speakers({ api, check, seedProject });
  await rowsAndReveal({ page, api, check, seedProject, app });
}

/**
 * Speakers (v0.76.0) — the fifth gap from the v0.63.0 audit.
 *
 * `speakerName` returns null for an id that resolves to nobody, and a line
 * with no name in front of it IS narration. So deleting a character does
 * not break the story, it rewrites it: a speech becomes the narrator's,
 * silently, in whatever scene it was in. Measured on v0.75.2, Check Story
 * had nothing to say about any of it — the module did not contain the word
 * "speaker".
 *
 * The cases here are the ones a plausible implementation gets wrong:
 *
 *  - A SPEAKER LIVES IN FOUR PLACES, not one. A paragraph's attribute, a
 *    choice option's, a Dialogue line's, and that line's REPLY. The reply
 *    is a second speaker on the same node, so a walk written per-node
 *    rather than per-slot finds three of the four and looks correct.
 *  - `@player` RESOLVES THROUGH THE STORY, not through the entity list.
 *    It can never dangle, so reporting it would be a false alarm on every
 *    story that uses it — which is most of them.
 *  - A LOCATION SET AS A SPEAKER STILL EXISTS. Reporting "deleted" about
 *    İstanbul would be a lie about something still in the story, so it is
 *    its own kind with its own sentence.
 *  - ONE ROW PER SPEAKER PER SCENE, his call: a character deleted mid-draft
 *    is one mistake, not thirty rows of it.
 */
export async function speakers({ api, check, seedProject }) {
  await seedProject();

  const ghost = "gone-forever";

  const build = (opts = {}) =>
    api((o) => {
      const store = window.__scriareProjectStore;
      const st = store.getState();
      const p = st.project;

      const line = (speaker, text) => ({
        type: "paragraph",
        attrs: { speaker },
        content: [{ type: "text", text }],
      });

      const doc = {
        type: "doc",
        content: [
          line(o.speaker, "I told you not to come."),
          ...(o.second ? [line(o.speaker, "You never listen.")] : []),
          ...(o.choice
            ? [
                {
                  type: "choiceBlock",
                  attrs: { id: "cb1" },
                  content: [
                    {
                      type: "choiceOption",
                      attrs: { id: "o1", speaker: o.speaker, target: null },
                      content: [{ type: "text", text: "Say nothing." }],
                    },
                  ],
                },
              ]
            : []),
          ...(o.dialogue
            ? [
                {
                  type: "dialogueBlock",
                  attrs: { id: "db1" },
                  content: [
                    {
                      type: "dialogueLine",
                      attrs: {
                        id: "dl1",
                        speaker: o.speaker,
                        replySpeaker: o.reply ? o.speaker : null,
                        after: "end",
                      },
                      content: [{ type: "text", text: "Where were you?" }],
                    },
                  ],
                },
              ]
            : []),
        ],
      };

      st.updateSceneContent(p.scenes[0].id, doc);
      const result = window.__scriareStoryCheck.checkStory(store.getState().project);
      const speakerIssues = result.issues.filter(
        (i) => i.kind === "deleted-speaker" || i.kind === "silent-speaker",
      );
      return {
        kinds: speakerIssues.map((i) => i.kind),
        details: speakerIssues.map((i) => i.detail),
        whats: speakerIssues.map((i) => i.what),
        count: speakerIssues.length,
        severities: speakerIssues.map((i) => i.severity),
      };
    }, opts);

  // ── the four slots, one at a time ─────────────────────────────────────
  let r = await build({ speaker: ghost });
  check(
    "a prose line spoken by someone deleted is reported",
    r.count === 1 && r.kinds[0] === "deleted-speaker",
    JSON.stringify(r),
  );
  check(
    "...as a warning, because the story still plays",
    r.severities[0] === "warning",
    `severity: ${r.severities[0]}`,
  );

  r = await build({ speaker: ghost, choice: true });
  check(
    "a choice option's speaker counts too",
    r.count === 1 && /2 lines/.test(r.details[0]),
    JSON.stringify(r.details),
  );

  r = await build({ speaker: ghost, dialogue: true });
  check(
    "THE SIBLINGS RULE — a Dialogue line's speaker counts exactly as a choice's does",
    r.count === 1 && /2 lines/.test(r.details[0]),
    JSON.stringify(r.details),
  );

  // The one a per-node walk loses: the reply is a SECOND speaker on a node
  // that already had one, so finding the line's speaker and moving on
  // finds three slots of four and looks right.
  r = await build({ speaker: ghost, dialogue: true, reply: true });
  check(
    "...and so does that line's REPLY, which is a second speaker on the same node",
    r.count === 1 && /3 lines/.test(r.details[0]),
    JSON.stringify(r.details),
  );

  // ── the grouping he chose ─────────────────────────────────────────────
  r = await build({ speaker: ghost, second: true, choice: true, dialogue: true, reply: true });
  check(
    "five references to one deleted speaker are ONE row, not five",
    r.count === 1 && /5 lines/.test(r.details[0]),
    JSON.stringify(r),
  );

  // ── what must NOT be reported ─────────────────────────────────────────
  r = await build({ speaker: "@player" });
  check(
    "the player is never reported — it resolves through the story, not the entity list",
    r.count === 0,
    JSON.stringify(r),
  );

  r = await build({ speaker: null });
  check("narration is not a missing speaker", r.count === 0, JSON.stringify(r));

  // MADE HERE, NOT FOUND. The seeded project ships `entities: []`, so the
  // first version of this looked them up and skipped both checks when it
  // found none — silently, which is the worst outcome a check has: the
  // suite goes green having tested nothing. The precondition is stated
  // and asserted instead.
  const cast = await api(() => {
    const st = window.__scriareProjectStore.getState();
    st.createEntity("character", "Mara");
    st.createEntity("location", "İstanbul");
    const made = window.__scriareProjectStore.getState().project.entities;
    return {
      character: made.find((e) => e.kind === "character") ?? null,
      location: made.find((e) => e.kind === "location") ?? null,
    };
  });
  check(
    "PRECONDITION — a character and a location exist to attribute lines to",
    Boolean(cast.character && cast.location),
    JSON.stringify(cast),
  );

  r = await build({ speaker: cast.character.id, choice: true, dialogue: true, reply: true });
  check(
    "a character who is still here is not reported, in any of the four slots",
    r.count === 0,
    JSON.stringify(r),
  );

  // ── a Location set as a speaker: still here, still silent ─────────────
  r = await build({ speaker: cast.location.id });
  check(
    "a Location set as a speaker is reported as unable to speak, not as deleted",
    r.count === 1 && r.kinds[0] === "silent-speaker",
    JSON.stringify(r),
  );
  check(
    "...and the sentence names it rather than calling it deleted",
    r.count === 1 &&
      r.details[0].includes(cast.location.name) &&
      !/deleted/.test(r.details[0]),
    JSON.stringify(r.details),
  );

  // ── the row has to land somewhere ─────────────────────────────────────
  // One row standing for five lines still has to open one of them, and
  // since v0.77.0 that id is also what the editor scrolls to and marks.
  //
  // `lineId`, NOT `id` (corrected in v0.77.0). This fixture wrote `id`,
  // which no node type in the app uses — a paragraph and a Dialogue line
  // store theirs under `lineId`, an option under `optionId`, both block
  // kinds under `blockId` (contentIds.ts). The walk under test read
  // `attrs.id` too, so the two agreed with each other and with nothing
  // else: the check passed while every anchor in every real story was
  // null. It was measuring its own fixture. Found only because the reveal
  // built on top of it had nothing to scroll to.
  const anchored = await api((id) => {
    const store = window.__scriareProjectStore;
    const st = store.getState();
    st.updateSceneContent(st.project.scenes[0].id, {
      type: "doc",
      content: [
        { type: "paragraph", attrs: { lineId: "first-line", speaker: id },
          content: [{ type: "text", text: "I told you not to come." }] },
        { type: "paragraph", attrs: { lineId: "later-line", speaker: id },
          content: [{ type: "text", text: "You never listen." }] },
      ],
    });
    const issue = window.__scriareStoryCheck
      .checkStory(store.getState().project)
      .issues.find((i) => i.kind === "deleted-speaker");
    return { blockId: issue?.blockId ?? null, label: issue?.label ?? null };
  }, ghost);
  check(
    "the row points at the FIRST line that lost its speaker, not at the scene",
    anchored.blockId === "first-line",
    JSON.stringify(anchored),
  );
  check(
    "...which is what makes it draw as a name and a chip rather than a truncated sentence",
    anchored.label === "Deleted character",
    JSON.stringify(anchored),
  );

  // ── the toast, which is where this is caught at the moment it happens ──
  // REBUILT FIRST. Every `build` above replaces the scene's document, so
  // by now the ghost is not in the story at all — the first version of
  // this asked what deleting him would cost after he had already stopped
  // speaking, got "" and reported a bug in the toast that was a bug in
  // the spec.
  await build({ speaker: ghost, second: true, choice: true, dialogue: true, reply: true });
  const toast = await api((id) => {
    const store = window.__scriareProjectStore;
    const { deletedSpeakerNote } = window.__scriareSpeakerLines;
    const scenes = store.getState().project.scenes;
    return {
      withLines: deletedSpeakerNote(scenes, id),
      withNone: deletedSpeakerNote(scenes, "nobody-speaks-as-this"),
    };
  }, ghost);
  check(
    "deleting a speaker says in the toast what it cost",
    /5 lines in a scene/.test(toast.withLines),
    JSON.stringify(toast),
  );
  // A writer who deletes a character with no lines should not be told
  // about lines — an empty clause rather than "0 lines in 0 scenes".
  check(
    "...and says nothing at all when nothing was spoken",
    toast.withNone === "",
    JSON.stringify(toast),
  );

  await seedProject();
}

/**
 * What a row SAYS at rest, and where clicking it lands (v0.77.0).
 *
 * The report was reported: a scene with one finding was drawn as a single
 * button — no disclosure, no line underneath, the sentence only in a
 * `title` attribute — so on a real story most scenes could only be
 * understood by hovering. And the dialog's own subtitle has promised
 * "Click a line to go there" since v0.36.0 while going as far as the scene.
 *
 * READ OFF THE SCREEN, NOT OFF THE ISSUE OBJECTS. Every claim here is about
 * what a writer can see without a pointer, which is exactly what an
 * assertion against `checkStory()`'s return value cannot tell you — the
 * hint could be perfect in the data and drawn nowhere.
 */
export async function rowsAndReveal({ page, api, check, seedProject, app }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await seedProject();
  const win = await app.browserWindow(page);
  await win.evaluate((w) => w.setBounds({ x: 0, y: 0, width: 1280, height: 900 }));
  await wait(250);

  // A scene long enough that landing on the line requires scrolling, with
  // one finding in it — the case that had no row at all.
  await api(() => {
    const st = window.__scriareProjectStore.getState();
    const content = [];
    const filler = (n) => ({
      type: "paragraph",
      attrs: { lineId: `fill-${n}` },
      content: [{ type: "text", text: `Filler line ${n}. `.repeat(6) }],
    });
    for (let n = 0; n < 40; n += 1) content.push(filler(n));
    content.push({
      type: "paragraph",
      attrs: { lineId: "the-lost-line", speaker: "ghost-who-was-deleted" },
      content: [{ type: "text", text: "I told you not to come." }],
    });
    for (let n = 40; n < 55; n += 1) content.push(filler(n));
    st.updateSceneContent(st.project.scenes[0].id, { type: "doc", content });
  });
  await wait(300);
  // The editor reads a document when the SCENE changes, not when the store
  // is written behind it, so bounce off a neighbour to make it load.
  await api(() => {
    const st = window.__scriareProjectStore.getState();
    st.selectScene(st.project.scenes[1].id);
  });
  await wait(250);
  await api(() => {
    const st = window.__scriareProjectStore.getState();
    st.selectScene(st.project.scenes[0].id);
  });
  await wait(400);

  await api(() => window.__scriareUIStore.getState().openStoryCheck());
  await wait(450);

  // ── every scene opens, including the ones with one finding ────────────
  const shape = await api(() => {
    const groups = [...document.querySelectorAll("[data-scene-group]")];
    return {
      groups: groups.length,
      // The defect: a group with one finding that cannot be opened at all.
      allExpandable: groups.every((g) => g.querySelector("button[aria-expanded]")),
      singles: groups.filter((g) => g.querySelector('[aria-expanded]')).length,
      // A caret drawn at opacity 0 is the shape the old single-row took.
      invisibleCarets: groups.filter((g) =>
        [...g.querySelectorAll("span")].some((s) => s.className.includes("opacity-0")),
      ).length,
    };
  });
  check(
    "every scene can be opened — a scene with one finding is not a different component",
    shape.groups > 0 && shape.allExpandable === true && shape.invisibleCarets === 0,
    JSON.stringify(shape),
  );

  // Open them all and read what is actually drawn.
  await api(() => {
    document.querySelectorAll("[data-scene-group] > button").forEach((b) => b.click());
  });
  await wait(300);

  const rows = await api(() => {
    const out = [];
    document.querySelectorAll("[data-issue]").forEach((r) => {
      out.push({
        kind: r.getAttribute("data-issue"),
        text: r.innerText.replace(/\n/g, " | "),
        hint: r.querySelector("[data-hint]")?.textContent ?? null,
      });
    });
    return out;
  });
  check(
    "every finding explains itself on the page, with no pointer anywhere near it",
    rows.length > 0 && rows.every((r) => r.hint && r.hint.length > 0),
    JSON.stringify(rows.slice(0, 3)),
  );
  // `what` is the header's chip, where it counts. On the row it was the
  // same job as the hint, done twice and in the app's vocabulary rather
  // than the writer's — three texts in a 576px row is what read as
  // crowded when this was drawn as a mockup.
  check(
    "...and does not ALSO repeat the two-word label beside it",
    rows.every((r) => !/\bno speaker\b|\bunlinked\b|\bdead action\b/.test(r.text)),
    JSON.stringify(rows.map((r) => r.text).slice(0, 3)),
  );
  const speakerRow = rows.find((r) => r.kind === "deleted-speaker");
  check(
    "the reported row reads as a sentence at rest",
    speakerRow?.hint === "1 line reads as narration.",
    JSON.stringify(speakerRow),
  );

  // ── clicking lands ON the line, not merely in the scene ───────────────
  await api(() => document.querySelector('[data-issue="deleted-speaker"]')?.click());
  await wait(800);

  const landed = await api(() => {
    const marked = document.querySelector(".scriare-revealed");
    const r = marked?.getBoundingClientRect() ?? null;
    return {
      dialogClosed: !document.querySelector('[role="dialog"]'),
      markedText: marked?.textContent ?? null,
      onScreen: r ? r.top >= 0 && r.bottom <= window.innerHeight : false,
      inspector: window.__scriareInspectorStore.getState().target.kind,
    };
  });
  check(
    "clicking a finding scrolls the editor to the line and marks it",
    landed.markedText === "I told you not to come." && landed.onScreen === true,
    JSON.stringify(landed),
  );
  check(
    "...without telling the Inspector that a paragraph is a choice",
    landed.inspector !== "choice",
    `Inspector target: ${landed.inspector}`,
  );

  // ── the Inspector opens on the RIGHT kind of thing ────────────────────
  //
  // Aimed at a Dialogue rather than at the speaker finding above, and the
  // reason is worth keeping: the first version of this asserted that a
  // speaker finding does not leave the Inspector on a choice, and stayed
  // green through a sabotage that hardcoded `kind: "choice"` for
  // everything. Not because the app was right — because InspectorPanel
  // has cleared a target whose choice block does not exist since v0.55.0,
  // so the wrong answer was being corrected a frame later and the check
  // could not see it. A Dialogue is where the difference survives: told
  // "choice", the panel finds no options and falls back to the scene;
  // told the truth, it opens the conversation.
  await seedProject();
  const madeDialogue = await api(() => {
    const st = window.__scriareProjectStore.getState();
    const { buildDialogueBlockNode } = window.__scriareDialogue;
    // AN AMBIGUOUS KIND, on purpose (v0.77.1, reported). The first version
    // of this used `dialogue-dead-gate`, which only a Dialogue can raise —
    // so the kind alone was enough to know what its blockId pointed at,
    // and the check passed while the real case was broken.
    //
    // `unnamed-variable-shown` is raised from a choice option AND from a
    // Dialogue line. That is the case he hit: told "choice" with a
    // Dialogue block's id, InspectorPanel finds no options and falls back
    // to Scene Properties — the block lit up in the editor and the panel
    // showed the scene.
    // A real variable with no DISPLAY name — which is what makes this
    // `unnamed-variable-shown` (the reader would be shown "resolve")
    // rather than a dead gate on a variable that does not exist.
    const vid = st.createVariable("resolve", "number");
    const block = buildDialogueBlockNode(
      [
        { text: "And if it fails?", after: "stay", whenUnmet: "lock",
          conditions: [{ variableId: vid, op: "gte", value: 3 }] },
        { text: "Never mind.", after: "end" },
      ],
      "the-conversation",
    );
    window.__scriareProjectStore.getState().updateSceneContent(st.project.scenes[0].id, {
      type: "doc",
      content: [
        { type: "paragraph", attrs: { lineId: "p1" }, content: [{ type: "text", text: "Rain." }] },
        block,
      ],
    });
    const issues = window.__scriareStoryCheck
      .checkStory(window.__scriareProjectStore.getState().project)
      .issues.filter((i) => i.blockId === "the-conversation" || i.inspect === "dialogue");
    return {
      count: issues.length,
      kinds: issues.map((i) => i.kind),
      inspect: issues[0]?.inspect ?? null,
    };
  });
  check(
    "PRECONDITION — a Dialogue line raises a finding a choice could raise too",
    madeDialogue.count > 0 && madeDialogue.kinds.includes("unnamed-variable-shown"),
    JSON.stringify(madeDialogue),
  );
  check(
    "...and that finding knows it came from a conversation, which its KIND cannot say",
    madeDialogue.inspect === "dialogue",
    JSON.stringify(madeDialogue),
  );

  // Clicked, not read. What `checkStory` puts in the field and what `goTo`
  // does with it are two claims, and only the second one is the feature.
  await api(() => {
    const st = window.__scriareProjectStore.getState();
    st.selectScene(st.project.scenes[1].id);
  });
  await wait(200);
  await api(() => {
    const st = window.__scriareProjectStore.getState();
    st.selectScene(st.project.scenes[0].id);
  });
  await wait(300);
  await api(() => window.__scriareUIStore.getState().openStoryCheck());
  await wait(400);
  await api(() => {
    document.querySelectorAll("[data-scene-group] > button").forEach((b) => b.click());
  });
  await wait(250);
  const clickedDialogue = await api(() => {
    // The only finding in this scene, and it is a kind a CHOICE could
    // also raise — which is the whole point of clicking it.
    const row = document.querySelector('[data-issue="unnamed-variable-shown"]');
    row?.click();
    return Boolean(row);
  });
  await wait(500);
  const onDialogue = await api(() => window.__scriareInspectorStore.getState().target);
  check(
    "a Dialogue finding opens the Inspector on the conversation, not on a choice",
    clickedDialogue === true && onDialogue.kind === "dialogue",
    JSON.stringify({ clickedDialogue, onDialogue }),
  );

  // The mark answers "which one", and that question is answered within a
  // second of arriving. One that waits to be dismissed is one more thing
  // on screen to deal with.
  await wait(1800);
  const faded = await api(() => ({
    still: Boolean(document.querySelector(".scriare-revealed")),
  }));
  check("...and the mark takes itself away", faded.still === false, JSON.stringify(faded));

  await seedProject();
}
