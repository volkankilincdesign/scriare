/**
 * The Welcome screen (v0.53.0) — one screen in three states.
 *
 * Two things here are worth stating, because they are the mistakes the
 * earlier versions of this file made.
 *
 * FIRST, every UI assertion reads the RENDERED SCREEN, never the utility
 * behind it. The v0.50.0 accessibility pass shipped two checks that called
 * a helper directly, and both survived their negative controls untouched —
 * a test that calls the function is testing the function, not the screen
 * that is supposed to be using it. So the map checks count `<rect>`s in
 * the DOM, the dimming check reads computed opacity off real nodes, and
 * the "frame is constant" check measures the header's actual box.
 *
 * SECOND, the specs share one app, so this one puts the store back the way
 * it found it. A spec that leaves `project: null` makes the NEXT spec
 * report an empty editor, which is how one wrong line becomes five
 * mysterious failures somewhere else (v0.50.0 again).
 */
export default async function run({ page, api, check, seedProject, app }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /**
   * Shows the Welcome screen with a known shelf.
   *
   * In two steps, and the gap matters: closing the project MOUNTS
   * WelcomeScreen, whose first effect reads the real recent-projects.json
   * from this machine's userData. Setting the list in the same tick had it
   * overwritten a moment later by whatever stories the person running the
   * suite happens to have — so the "empty shelf" case rendered a shelf,
   * and the spec measured the tester's own files.
   */
  const showWelcome = async (entries) => {
    await api(() => {
      window.__scriareProjectStore.setState({ project: null, filePath: null });
    });
    await wait(350);
    await api((list) => {
      window.__scriareProjectStore.setState({ recentProjects: list });
    }, entries);
    await wait(250);
  };

  // Section labels are uppercased in CSS, and `innerText` reports what is
  // PAINTED — so "Your other stories" comes back shouting. Compared in one
  // case rather than matching the shouting, which would make the test go
  // red the day someone stops shouting.
  const says = (text, phrase) => text.toLowerCase().includes(phrase.toLowerCase());

  const path = (name) => `C:\\Users\\volka\\Documents\\Scriare\\${name}.scriare`;
  const iso = (daysAgo) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();

  /**
   * The fixtures are built by the REAL shape builder, from real projects,
   * rather than written out as literals. The cached format has changed
   * once already (v0.53.2 gave both axes one scale); a literal fixture
   * would have gone on describing the old one, and the spec would have
   * gone on passing against a format the app no longer writes.
   */
  const fixtures = await api(() => {
    const { buildStoryShape } = window.__scriareRecentShape;
    const { normalizeChoiceStyles } = window.__scriareChoiceStyles;

    const make = (positions, links) => {
      const scenes = positions.map((p, i) => ({
        id: `n${i}`,
        title: `N${i}`,
        position: { x: p[0], y: p[1] },
        content: {
          type: "doc",
          content: (links[i] ?? []).map((t) => ({
            type: "choiceBlock",
            content: [
              {
                type: "choiceOption",
                attrs: { id: `c${i}-${t}`, targetSceneId: `n${t}` },
                content: [{ type: "paragraph", content: [{ type: "text", text: "go" }] }],
              },
            ],
          })),
        },
      }));
      return buildStoryShape({
        id: "p",
        name: "F",
        createdAt: "",
        updatedAt: "",
        startSceneId: "n0",
        scenes,
        content: scenes.map((sc, i) => ({
          id: sc.id,
          kind: "leaf",
          category: "story",
          parentId: null,
          order: i,
          refType: "scene",
        })),
        favorites: [],
        variables: [],
        choiceStyles: normalizeChoiceStyles(undefined),
        entities: [],
      });
    };

    // A spine and a fan — two shapes a person can tell apart at a glance,
    // which is the entire claim the maps make.
    const spine = make(
      [[0, 0], [280, 0], [560, 0], [840, 0]],
      { 0: [1], 1: [2], 2: [3] },
    );
    const fan = make(
      [[0, 180], [280, 0], [280, 180], [280, 360], [560, 180]],
      { 0: [1, 2, 3], 1: [4], 2: [4], 3: [4] },
    );

    // The geometry fixture: deliberately the proportions of a real story —
    // the 13-scene project this screen was measured against ran about
    // 1108 × 148 canvas units, 7.5 : 1. That ratio is the whole test.
    const widePositions = [
      [0, 60], [280, 0], [280, 120], [560, 60], [840, 0], [840, 60], [840, 120],
    ];
    const wide = make(widePositions, { 0: [1, 2], 1: [3], 2: [3], 3: [4, 5, 6] });

    return { spine, fan, wide, widePositions };
  });
  const { spine, fan } = fixtures;

  const resume = {
    sceneTitle: "The clerk counts twice",
    excerpt: "He wet his thumb, went back to the top of the column, and",
    groupName: "Act Two",
    at: iso(1),
  };

  // ---------------------------------------------------------------- shape

  const shapeFacts = await api(() => {
    const { buildStoryShape, sceneExcerpt, MAX_SHAPE_NODES, SHAPE_BUDGET_BYTES } =
      window.__scriareRecentShape;
    const { normalizeChoiceStyles } = window.__scriareChoiceStyles;

    // A real branching story, wide enough that the sample has to choose:
    // a spine of 30 scenes where each of the first few offers two choices.
    const scenes = [];
    const content = [];
    for (let i = 0; i < 30; i++) {
      const next = [];
      if (i < 29) next.push(`s${i + 1}`);
      if (i < 6 && i + 7 < 30) next.push(`s${i + 7}`);
      scenes.push({
        id: `s${i}`,
        title: `Scene ${i}`,
        position: { x: i * 220, y: (i % 3) * 140 },
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: `Prose of scene ${i} — SECRETWORD${i}` }],
            },
            ...next.map((target) => ({
              type: "choiceBlock",
              content: [
                {
                  type: "choiceOption",
                  attrs: { id: `c${i}-${target}`, targetSceneId: target },
                  content: [{ type: "paragraph", content: [{ type: "text", text: "go" }] }],
                },
              ],
            })),
          ],
        },
      });
      content.push({
        id: `s${i}`,
        kind: "leaf",
        category: "story",
        parentId: null,
        order: i,
        refType: "scene",
      });
    }
    const project = {
      id: "p",
      name: "Long Story",
      createdAt: "",
      updatedAt: "",
      startSceneId: "s0",
      scenes,
      content,
      favorites: [],
      variables: [],
      choiceStyles: normalizeChoiceStyles(undefined),
      entities: [],
    };

    const shape = buildStoryShape(project);
    const json = JSON.stringify(shape);
    const xs = shape.nodes.map((n) => n.x);
    const ys = shape.nodes.map((n) => n.y);

    // Same story, one scene, no branches — the degenerate case that used
    // to divide by zero when every scene shares a coordinate.
    const flat = {
      ...project,
      scenes: [scenes[0], { ...scenes[1], position: { x: 0, y: 0 } }],
      startSceneId: "s0",
    };
    flat.scenes[0] = { ...scenes[0], position: { x: 0, y: 0 } };

    return {
      sampled: shape.nodes.length,
      max: MAX_SHAPE_NODES,
      total: shape.total,
      edges: shape.edges.length,
      start: shape.start,
      bytes: json.length,
      budget: SHAPE_BUDGET_BYTES,
      // Not "does it contain the word prose" — the actual strings from the
      // actual scenes, so a future field that smuggles text in is caught.
      leaksProse: /SECRETWORD|Scene \d|Long Story|s\d/.test(json),
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
      w: shape.w,
      h: shape.h,
      nodeAspect: shape.node.w / shape.node.h,
      flatNodes: buildStoryShape(flat).nodes,
      orphanFirst: (() => {
        // Forty scenes whose CREATION order and whose STORY order disagree
        // completely: the story runs s0 → s20 → s21 → … → s38, and s1–s19
        // are scenes the writer made and never wired up. Taking the first
        // twenty in array order gets twenty scenes with nothing between
        // them — a map of twenty loose boxes, which says the story has no
        // shape. This is the fixture that tells a breadth-first sample
        // from a slice.
        const sc = [];
        const co = [];
        for (let i = 0; i < 40; i++) {
          const next = i === 0 ? ["s20"] : i >= 20 && i < 38 ? [`s${i + 1}`] : [];
          sc.push({
            id: `s${i}`,
            title: `S${i}`,
            position: { x: i * 100, y: (i % 4) * 90 },
            content: {
              type: "doc",
              content: next.map((t) => ({
                type: "choiceBlock",
                content: [
                  {
                    type: "choiceOption",
                    attrs: { id: `k${i}`, targetSceneId: t },
                    content: [{ type: "paragraph", content: [{ type: "text", text: "on" }] }],
                  },
                ],
              })),
            },
          });
          co.push({ id: `s${i}`, kind: "leaf", category: "story", parentId: null, order: i, refType: "scene" });
        }
        const wide = { ...project, scenes: sc, content: co, startSceneId: "s0" };
        const built = buildStoryShape(wide);
        const firstTwenty = new Set(sc.slice(0, 20).map((x) => x.id));
        let naive = 0;
        for (let i = 0; i < 40; i++) {
          const next = i === 0 ? ["s20"] : i >= 20 && i < 38 ? [`s${i + 1}`] : [];
          if (!firstTwenty.has(`s${i}`)) continue;
          naive += next.filter((t) => firstTwenty.has(t)).length;
        }
        return { nodes: built.nodes.length, edges: built.edges.length, naiveEdges: naive };
      })(),
      empty: buildStoryShape({ ...project, scenes: [] }),
      excerpt: sceneExcerpt(scenes[0].content),
      // Shipped as "...I don't know...But I know... We're in scene 2We are
      // sooo in scene 3" — two sentences joined at the block boundary, on
      // the most prominent line of the screen.
      welded: sceneExcerpt({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "first line." }] },
          { type: "paragraph", content: [{ type: "text", text: "second line" }] },
        ],
      }),
    };
  });

  check(
    "a story's shape is sampled, not stored whole",
    shapeFacts.sampled === shapeFacts.max && shapeFacts.total === 30,
    `${shapeFacts.sampled} of ${shapeFacts.total} scenes`,
  );

  check(
    "the sample follows the STORY, not the order the scenes were made in",
    shapeFacts.orphanFirst.edges >= shapeFacts.orphanFirst.nodes - 1,
    `${shapeFacts.orphanFirst.edges} edges between ${shapeFacts.orphanFirst.nodes} nodes ` +
      `(taking the first twenty in array order would give ${shapeFacts.orphanFirst.naiveEdges})`,
  );

  check(
    "both axes are divided by ONE number — the longer side of the graph",
    Math.max(shapeFacts.w, shapeFacts.h) === 1 &&
      shapeFacts.minX === 0 &&
      shapeFacts.minY === 0 &&
      shapeFacts.maxX <= shapeFacts.w &&
      shapeFacts.maxY <= shapeFacts.h,
    `extent ${shapeFacts.w} × ${shapeFacts.h}; nodes span ${shapeFacts.minX}–${shapeFacts.maxX} by ${shapeFacts.minY}–${shapeFacts.maxY}`,
  );
  check(
    "...and so is the scene card, so the drawing is a miniature",
    Math.abs(shapeFacts.nodeAspect - 180 / 56) < 0.02,
    `${shapeFacts.nodeAspect.toFixed(3)} : 1`,
  );

  check(
    "a story laid out in one row does not divide by zero",
    shapeFacts.flatNodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y)),
    JSON.stringify(shapeFacts.flatNodes),
  );

  check(
    "the start scene is marked",
    shapeFacts.start === 0,
    `index ${shapeFacts.start}`,
  );

  check(
    "a 30-scene story's cached shape fits the budget",
    shapeFacts.bytes < shapeFacts.budget,
    `${shapeFacts.bytes} of ${shapeFacts.budget} bytes`,
  );

  check(
    "the cache holds no prose, titles or ids",
    shapeFacts.leaksProse === false,
    "nothing from the story appears in the stored shape",
  );

  check(
    "a project with no scenes caches nothing rather than an empty drawing",
    shapeFacts.empty === null,
    String(shapeFacts.empty),
  );

  check(
    "two paragraphs are not welded into one word",
    shapeFacts.welded === "first line. second line",
    JSON.stringify(shapeFacts.welded),
  );

  check(
    "the excerpt is the scene's own opening",
    shapeFacts.excerpt.startsWith("Prose of scene 0"),
    JSON.stringify(shapeFacts.excerpt),
  );

  // ------------------------------------------------- the stored record

  const recordFacts = await api(() => {
    const { forStorage, mergeRecentEntry } = window.__scriareRecentEntries;
    const stored = forStorage({
      name: "A",
      filePath: "p",
      lastOpened: "t",
      shape: { nodes: [], edges: [], start: -1, total: 0 },
      missing: true,
    });
    const reopened = mergeRecentEntry(
      { name: "A", filePath: "p", lastOpened: "old", shape: { nodes: [{ x: 0, y: 0 }], edges: [], start: 0, total: 3 } },
      { name: "A", filePath: "p", lastOpened: "new" },
    );
    const cleared = mergeRecentEntry(
      { name: "A", filePath: "p", lastOpened: "old", shape: { nodes: [], edges: [], start: 0, total: 3 } },
      { name: "A", filePath: "p", lastOpened: "new", shape: null },
    );
    return {
      storedKeys: Object.keys(stored).sort(),
      keptShape: reopened.shape?.total ?? null,
      keptTime: reopened.lastOpened,
      clearedShape: cleared.shape,
    };
  });

  check(
    "'missing' is never written to disk",
    recordFacts.storedKeys.includes("missing") === false,
    recordFacts.storedKeys.join(", "),
  );

  check(
    "re-opening a story keeps its cached map",
    recordFacts.keptShape === 3 && recordFacts.keptTime === "new",
    `shape kept (${recordFacts.keptShape} scenes), lastOpened updated`,
  );

  check(
    "...but an explicit null still clears it",
    recordFacts.clearedShape === null,
    String(recordFacts.clearedShape),
  );

  // `recent:touch` must not resurrect a story that fell off the list. Safe
  // to run for real: a path that is not there is a no-op, so this writes
  // nothing to the writer's own recent-projects.json.
  const ghost = "Z:\\nowhere\\ghost-" + Date.now() + ".scriare";
  const afterTouch = await api(
    (p) => window.api.recent.touch(p, { shape: null, resume: null }),
    ghost,
  );
  check(
    "touching a path that is not in the list does not add it",
    Array.isArray(afterTouch) && afterTouch.every((e) => e.filePath !== ghost),
    `${afterTouch.length} entries, none of them the ghost`,
  );


  // ------------------------------------------- save → cache, for real

  /**
   * The whole pipeline against a real file: save a project, and the story's
   * shape and the scene you are in turn up on its Recent Projects entry.
   *
   * Worth the setup. Every check above this line reasons about the shape
   * builder or about a store the spec filled in itself; none of them would
   * notice if `saveNow` simply never called the thing. The project is
   * written into the OS temp directory and taken back out of Recent
   * Projects afterwards, so the suite does not leave a story behind in the
   * list of someone who ran it.
   */
  const tempDir = await app.evaluate(({ app: electronApp }) => electronApp.getPath("temp"));
  const sep = tempDir.includes("\\") ? "\\" : "/";
  const tempPath = `${tempDir}${sep}scriare-welcome-spec-${Date.now()}.scriare`;

  const cached = await api(async (file) => {
    const store = window.__scriareProjectStore;
    const { buildProject } = window.__scriareProjectTypes;

    const project = buildProject("Spec Story");
    // Three scenes in a row, with the start scene pointing at the second —
    // enough that a real shape has a real edge in it.
    const base = project.scenes[0];
    const extra = ["b", "c"].map((id, i) => ({
      ...base,
      id: `spec-${id}`,
      title: `Scene ${id}`,
      position: { x: (i + 1) * 200, y: 0 },
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: `body ${id}` }] }] },
    }));
    project.scenes = [
      {
        ...base,
        position: { x: 0, y: 0 },
        title: "The opening",
        content: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "He counted the column twice." }] },
            {
              type: "choiceBlock",
              content: [
                {
                  type: "choiceOption",
                  attrs: { id: "spec-choice", targetSceneId: "spec-b" },
                  content: [{ type: "paragraph", content: [{ type: "text", text: "Again" }] }],
                },
              ],
            },
          ],
        },
      },
      ...extra,
    ];
    project.content = project.scenes.map((sc, i) => ({
      id: sc.id,
      kind: "leaf",
      category: "story",
      parentId: null,
      order: i,
      refType: "scene",
    }));

    await window.api.project.save(file, JSON.stringify(project, null, 2), null);
    // Through the store's own action, so the file goes into Recent
    // Projects exactly the way opening one does.
    await store.getState().openRecentProject(file);
    store.setState({ saveStatus: "unsaved" });
    await store.getState().saveNow();

    const entry = store.getState().recentProjects.find((e) => e.filePath === file) ?? null;
    return {
      front: store.getState().recentProjects[0]?.filePath === file,
      total: entry?.shape?.total ?? null,
      nodes: entry?.shape?.nodes?.length ?? null,
      edges: entry?.shape?.edges?.length ?? null,
      sceneTitle: entry?.resume?.sceneTitle ?? null,
      excerpt: entry?.resume?.excerpt ?? null,
      missing: entry?.missing,
    };
  }, tempPath);

  check(
    "saving a story caches its shape on the recent entry",
    cached.total === 3 && cached.nodes === 3 && cached.edges === 1,
    `${cached.nodes} nodes, ${cached.edges} edge, total ${cached.total}`,
  );
  check(
    "...and the scene the writer is in",
    cached.sceneTitle === "The opening" &&
      (cached.excerpt ?? "").startsWith("He counted the column twice."),
    `${JSON.stringify(cached.sceneTitle)} — ${JSON.stringify(cached.excerpt)}`,
  );
  check(
    "a file that is on disk is not marked missing",
    cached.missing === false,
    `missing: ${cached.missing}`,
  );

  // --------------------------------------------------- the backfill

  /**
   * A story saved before this app cached shapes gets its map drawn on the
   * Welcome screen itself, without being opened.
   *
   * v0.53.0 wrote the shape on save and only on save, so the first launch
   * after updating showed the dot field on every card and a map appeared
   * only once the writer had opened that story and saved it — the picture
   * that is there to help you FIND a story arriving after you had found
   * it. Simulated exactly: take a story that IS on disk, forget its shape,
   * show the Welcome screen, and wait.
   *
   * The temp story sits at the front of Recent Projects (it was opened a
   * moment ago), and the backfill takes the first entry with no USABLE
   * shape, so this one is picked first rather than whatever else is in
   * the list.
   *
   * It is given a shape from the OLDER format rather than no shape at
   * all, because that is the state every story on a real machine is in
   * after this update, and it is the state a presence check gets wrong: a
   * v0.53.0 shape is there and unusable, so `!entry.shape` reports
   * nothing to do and the card shows an empty canvas forever.
   */
  await api(async (file) => {
    const store = window.__scriareProjectStore;
    const current = store.getState().recentProjects.find((e) => e.filePath === file);
    const older = { ...current.shape };
    delete older.v;
    await window.api.recent.touch(file, { shape: older });
  }, tempPath);
  await api(() => window.__scriareProjectStore.getState().closeProject());

  let backfilled = null;
  for (let i = 0; i < 40 && !backfilled; i++) {
    await wait(250);
    backfilled = await api((file) => {
      const found = window.__scriareProjectStore
        .getState()
        .recentProjects.find((e) => e.filePath === file)?.shape;
      return window.__scriareRecentShape.isDrawableShape(found) ? found : null;
    }, tempPath);
  }
  check(
    "a story whose map is missing or out of date gets one drawn, without being opened",
    backfilled?.total === 3 && backfilled?.edges?.length === 1,
    backfilled ? `${backfilled.nodes.length} nodes, ${backfilled.edges.length} edge` : "never filled",
  );

  await api((file) => window.api.recent.remove(file), tempPath);

  // ------------------------------------------------------- empty shelf

  await showWelcome([]);

  const empty = await api(() => {
    const text = document.body.innerText;
    const header = document.querySelector("header");
    return {
      text,
      deadEnd: text.includes("No recent projects yet"),
      search: Boolean(document.querySelector("#welcome-find")),
      buttons: [...document.querySelectorAll("header button")].map((b) => b.textContent.trim()),
      headerBox: header ? JSON.parse(JSON.stringify(header.getBoundingClientRect())) : null,
      // The illustration is drawn by the same component a real story uses.
      mapRects: document.querySelectorAll("main [data-story-map] rect").length,
      start: [...document.querySelectorAll("main button")].some((b) =>
        b.textContent.includes("Start a story"),
      ),
    };
  });

  check(
    "the empty shelf leads with the motto",
    says(empty.text, "Write stories, not syntax."),
    "Write stories, not syntax.",
  );
  check(
    "'No recent projects yet.' is gone — an empty state offers a move, not a report",
    empty.deadEnd === false,
  );
  check(
    "the empty shelf still shows a story's shape",
    empty.mapRects >= 6,
    `${empty.mapRects} scene cards drawn`,
  );
  check("...and one way in", empty.start);

  // ------------------------------------------------- one story, a hero

  await showWelcome([
    { name: "What the Ledger Says", filePath: path("Ledger"), lastOpened: iso(1), shape: spine, resume },
  ]);

  const one = await api(() => {
    const text = document.body.innerText;
    return {
      text,
      // The story in the hero must ALSO be on the shelf: a list headed
      // "your stories" that silently omits its most recent member is the
      // one story you cannot see on the screen that exists to show them.
      onShelf: [...document.querySelectorAll("main ul li button")].filter((b) =>
        b.textContent.includes("What the Ledger Says"),
      ).length,
      cards: document.querySelectorAll("main ul li button").length,
      heading: /your stories/i.test(text) && !/your other stories/i.test(text),
      focused: document.activeElement?.getAttribute("aria-label") ?? null,
      // The rail is a flex child of a <button>, which the UA stylesheet
      // centres — so without an explicit stretch it has no height and is
      // simply not there, which is how it shipped.
      rail: (() => {
        const hero = document.querySelector(".scriare-resume-hero");
        const first = hero?.firstElementChild;
        return first ? Math.round(first.getBoundingClientRect().height) : null;
      })(),
      headerBox: JSON.parse(JSON.stringify(document.querySelector("header").getBoundingClientRect())),
    };
  });

  check(
    "one story: the hero is the scene, not the file",
    says(one.text, "Where you left off") && says(one.text, "The clerk counts twice"),
    "“Where you left off” → The clerk counts twice",
  );
  check("...and says which story and which group", says(one.text, "Act Two"), "Act Two");
  check(
    "one story: it is in the hero AND on the shelf",
    one.onShelf === 1 && one.cards === 1,
    `${one.cards} card on the shelf`,
  );
  check(
    "the heading says what is under it",
    one.heading,
    "Your stories",
  );
  check(
    "the hero carries its accent rail full height",
    one.rail !== null && one.rail > 40,
    `${one.rail}px of rail`,
  );
  check(
    "the hero is where the keyboard lands — launch, Enter, back in the scene",
    (one.focused ?? "").startsWith("Continue writing: The clerk counts twice"),
    JSON.stringify(one.focused),
  );

  // ------------------------------------------------ a shelf, then search

  const shelf = [
    { name: "What the Ledger Says", filePath: path("Ledger"), lastOpened: iso(1), shape: spine, resume },
    { name: "The Lantern Room", filePath: path("Lantern"), lastOpened: iso(3), shape: fan },
    { name: "Highland Nights", filePath: path("Highland"), lastOpened: iso(9), shape: spine },
    // No shape: a story last saved by a version before this one.
    { name: "Act One — draft 3", filePath: path("ActOne"), lastOpened: iso(20) },
    { name: "Cold Open", filePath: path("ColdOpen"), lastOpened: iso(40), missing: true },
    { name: "Nightshift", filePath: path("Nightshift"), lastOpened: iso(70), shape: fan },
  ];
  await showWelcome(shelf);

  const many = await api(() => {
    const cards = [...document.querySelectorAll("main ul li button")];
    const uncached = cards.find((b) => b.textContent.includes("Act One"));
    const cached = cards.find((b) => b.textContent.includes("Lantern"));
    const missing = cards.find((b) => b.textContent.includes("Cold Open"));
    return {
      heading: /your stories/i.test(document.body.innerText),
      cards: cards.length,
      cachedRects: cached ? cached.querySelectorAll("[data-story-map] rect").length : -1,
      uncachedRects: uncached ? uncached.querySelectorAll("[data-story-map] rect").length : -1,
      uncachedDots: uncached ? uncached.querySelectorAll("[data-story-map] circle").length : -1,
      missingText: missing ? missing.textContent : "",
      missingLabel: missing ? missing.getAttribute("aria-label") : "",
      cachedMeta: cached ? cached.textContent.replace("The Lantern Room", "").trim() : "",
      // No cached shape, so the meta line falls back to an age — and the
      // age is said in words, not as a date to the minute.
      uncachedMeta: uncached ? uncached.textContent.replace("Act One — draft 3", "").trim() : "",
      headerBox: JSON.parse(JSON.stringify(document.querySelector("header").getBoundingClientRect())),
    };
  });

  check(
    "EVERY story is on the shelf, the one in the hero included",
    many.heading && many.cards === shelf.length,
    `${many.cards} cards for ${shelf.length} stories`,
  );
  check(
    "a story with a cached shape draws its map",
    many.cachedRects === 5,
    `${many.cachedRects} scene cards`,
  );
  check(
    "a story saved before this version shows an empty canvas, not a grey box",
    many.uncachedRects === 0 && many.uncachedDots > 20,
    `${many.uncachedRects} cards, ${many.uncachedDots} grid dots`,
  );
  check(
    "the card says how big the story is",
    many.cachedMeta === `${fan.total} scenes`,
    JSON.stringify(many.cachedMeta),
  );
  check(
    "...and a story with no cached size is dated the way a person dates it",
    many.uncachedMeta === "2 weeks ago",
    JSON.stringify(many.uncachedMeta),
  );
  check(
    "a story whose file has moved says so in words, not just in colour",
    many.missingText.includes("Can’t find this file") &&
      many.missingLabel.includes("file not found"),
    JSON.stringify(many.missingLabel),
  );

  check(
    "THE FRAME DOES NOT MOVE between nought stories, one, and a shelf",
    empty.headerBox &&
      empty.headerBox.height === one.headerBox.height &&
      one.headerBox.height === many.headerBox.height &&
      empty.headerBox.bottom === many.headerBox.bottom,
    `header ${empty.headerBox?.height}px in all three states`,
  );
  check(
    "the search field is there with no stories at all",
    empty.search && empty.buttons.join("|") === "Open Project…|New Project",
    empty.buttons.join(" / "),
  );




  // ------------------------------------------------ is it the SAME graph

  /**
   * The question a reader of this file should be able to answer: is the
   * thumbnail a smaller picture of the writer's graph, or a different
   * graph?
   *
   * v0.53.0 and v0.53.1 both drew a different graph, and every check in
   * this file passed while they did — because every check asked whether
   * something was DRAWN, and none asked whether it was drawn in the right
   * PLACE. Normalising x and y independently into the panel multiplies
   * every vertical distance by (panelAspect / graphAspect): for a real
   * 7.5:1 story in a 2.3:1 card, 3.2×. A left-to-right spine with two
   * short branches comes out as a vertical scatter of blobs.
   *
   * So this measures the projection itself. A faithful miniature is a
   * SIMILARITY transform — one scale, both axes, plus a translation — and
   * the test of that is that the ratio between drawn distance and source
   * distance is the same for every pair of scenes. Under the old code the
   * horizontal pairs and the vertical pairs disagree by that same 3.2×,
   * which no tolerance can hide.
   */
  await showWelcome([
    {
      name: "Geometry",
      filePath: path("Geometry"),
      lastOpened: iso(1),
      shape: fixtures.wide,
    },
  ]);

  const geometry = await api((source) => {
    const card = document.querySelector("main ul li button");
    const rects = [...(card?.querySelectorAll("[data-story-map] rect") ?? [])].map((r) => ({
      x: Number(r.getAttribute("x")),
      y: Number(r.getAttribute("y")),
      w: Number(r.getAttribute("width")),
      h: Number(r.getAttribute("height")),
    }));
    if (rects.length !== source.length) return { rects: rects.length, ratios: null };

    const ratios = [];
    for (let i = 0; i < source.length; i++) {
      for (let j = i + 1; j < source.length; j++) {
        const srcD = Math.hypot(source[i][0] - source[j][0], source[i][1] - source[j][1]);
        const drawnD = Math.hypot(rects[i].x - rects[j].x, rects[i].y - rects[j].y);
        if (srcD > 1) ratios.push(drawnD / srcD);
      }
    }
    return {
      rects: rects.length,
      ratios,
      spread: Math.max(...ratios) / Math.min(...ratios),
      // A drawn scene card must have the proportions of a real one.
      cardAspect: rects[0].w / rects[0].h,
    };
  }, fixtures.widePositions);

  check(
    "every scene is in the drawing",
    geometry.rects === fixtures.widePositions.length,
    `${geometry.rects} of ${fixtures.widePositions.length}`,
  );
  check(
    "THE MAP IS A SCALE MODEL — one scale, both axes",
    geometry.spread !== undefined && geometry.spread < 1.03,
    geometry.spread === undefined
      ? "no pairs measured"
      : `the widest disagreement between any two pairs of scenes is ${(
          (geometry.spread - 1) * 100
        ).toFixed(1)}%`,
  );
  check(
    "a drawn scene card has the proportions of a real one",
    Math.abs(geometry.cardAspect - 180 / 56) < 0.25,
    `${geometry.cardAspect?.toFixed(2)} : 1 against the graph's own ${(180 / 56).toFixed(2)} : 1`,
  );

  /**
   * And the format gate: a shape written by v0.53.0 has these very field
   * names and different meanings, so drawing it produces a confidently
   * wrong picture. It must read as no shape at all.
   */
  const stale = await api((shape) => {
    const older = { ...shape };
    delete older.v;
    return window.__scriareRecentShape.isDrawableShape(older);
  }, fixtures.wide);
  check(
    "a shape from the older format is not drawn as if it were this one",
    stale === false,
    `isDrawableShape(no version) → ${stale}`,
  );

  // Back to the shelf — the next section measures a card on it.
  await showWelcome(shelf);

  // ------------------------------------------------ filling the window

  /**
   * The bug this exists for, in one sentence: the map was drawn at its own
   * intrinsic size inside a card that was a different size.
   *
   * The cause was not the drawing. A <button> carries `align-items:
   * center` from the UA stylesheet, so a block child of a flex button is
   * sized to its CONTENT rather than stretched — the map panel measured
   * 0px, the <svg> fell back to its viewBox, and every card showed a
   * 372px stripe with the rest of the card empty. Which is why this check
   * measures the drawing against the CARD, and then resizes the window
   * and measures again: a map that merely looks right at one width is
   * exactly what shipped.
   */
  /*
    THE APP'S OWN WINDOW, via the page it is showing. The first version
    took `BrowserWindow.getAllWindows()[0]`, which is the app window when
    this spec runs alone and is the export spec's hidden window when the
    whole suite runs — so the resize silently moved a window nobody was
    looking at, and the check compared two measurements of an app window
    that had never moved. It passed. That is the failure mode this whole
    suite exists to avoid, and it survived until the first full run.
  */
  const appWindow = await app.browserWindow(page);
  const originalBounds = await appWindow.evaluate((win) => ({
    ...win.getBounds(),
    maximized: win.isMaximized(),
  }));

  const setWidth = async (w) => {
    await appWindow.evaluate((win, width) => {
      if (win.isMaximized()) win.unmaximize();
      win.setBounds({ ...win.getBounds(), width });
    }, w);
    await wait(500);
    const seen = await api(() => {
      const card = [...document.querySelectorAll("main ul li button")].find((b) =>
        b.textContent.includes("Lantern"),
      );
      const map = card?.querySelector("[data-story-map]");
      return {
        window: window.innerWidth,
        card: card ? Math.round(card.getBoundingClientRect().width) : 0,
        map: map ? Math.round(map.getBoundingClientRect().width) : 0,
        // The content column is capped, so the shelf must NOT run to the
        // window's own edges on a wide monitor.
        column: Math.round(document.querySelector("main ul").getBoundingClientRect().width),
      };
    });
    // Loud, not silent. A window that refused to resize must fail this
    // spec, not quietly let it measure the same thing twice.
    if (Math.abs(seen.window - w) > 60) {
      throw new Error(`asked for a ${w}px window, got ${seen.window}px`);
    }
    return seen;
  };

  const narrow = await setWidth(1100);
  const wide = await setWidth(1760);

  check(
    "the map fills the card it is drawn in",
    narrow.map > 0 && narrow.card - narrow.map <= 2,
    `card ${narrow.card}px, map ${narrow.map}px`,
  );
  check(
    "...and follows the card when the window is resized",
    wide.map > 0 && wide.card - wide.map <= 2 && wide.map !== narrow.map,
    `${narrow.map}px at a 1100px window → ${wide.map}px at 1760px`,
  );
  check(
    "the shelf stops growing at the content column",
    wide.column <= 1240 && wide.window >= 1700,
    `${wide.column}px of a ${wide.window}px window`,
  );

  await appWindow.evaluate((win, bounds) => {
    win.setBounds({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height });
    if (bounds.maximized) win.maximize();
  }, originalBounds);
  await wait(400);

  // ------------------------------------------------- the mark on a page

  /**
   * The logo is the one thing on this screen that is a fixed IMAGE rather
   * than a token, so it is the one thing a theme cannot repaint. Three of
   * the eight themes have light grounds, and until this version the swap
   * asked `theme === "light"` — so daylight and overcast got the mark drawn
   * for dark rooms, pale on pale, on the app's first screen.
   */
  const marks = await api(async () => {
    const themes = window.__scriareThemes;
    const seen = {};
    for (const t of themes.THEMES) {
      themes.useThemeStore.getState().setTheme(t.id);
      await new Promise((r) => setTimeout(r, 60));
      const img = document.querySelector("header img");
      seen[t.id] = { ground: t.ground, src: img ? img.getAttribute("src") : null };
    }
    themes.useThemeStore.getState().setTheme("dark");
    return seen;
  });
  const lightSrcs = new Set(
    Object.values(marks).filter((m) => m.ground === "light").map((m) => m.src),
  );
  const darkSrcs = new Set(
    Object.values(marks).filter((m) => m.ground === "dark").map((m) => m.src),
  );
  check(
    "the wordmark follows the theme's GROUND, not the theme called 'light'",
    lightSrcs.size === 1 &&
      darkSrcs.size === 1 &&
      [...lightSrcs][0] !== [...darkSrcs][0],
    `${lightSrcs.size} mark across the three light grounds, ${darkSrcs.size} across the five dark`,
  );

  // --------------------------------------------------------- searching

  await page.fill("#welcome-find", "lan");
  await wait(250);

  const found = await api(() => {
    const text = document.body.innerText;
    const lists = [...document.querySelectorAll("main ul")];
    const rows = lists.length > 1 ? [...lists[1].querySelectorAll("li")] : [];
    const faded = rows
      .map((li) => {
        // Walk up from the row: opacity anywhere above it dims it just the
        // same, which is exactly how the first draft of this screen did it.
        let node = li;
        let least = 1;
        while (node && node !== document.body) {
          const value = Number(getComputedStyle(node).opacity);
          if (Number.isFinite(value)) least = Math.min(least, value);
          node = node.parentElement;
        }
        return least;
      })
      .sort((a, b) => a - b);
    const live = document.querySelector("[aria-live]");
    return {
      heading: /matching “lan”/i.test(text),
      announced: live ? live.textContent.trim() : "",
      matchCards: lists[0] ? lists[0].querySelectorAll("li").length : -1,
      matchesHaveMaps: lists[0] ? lists[0].querySelectorAll("[data-story-map] rect").length : -1,
      restHeading: /everything else/i.test(text),
      rows: rows.length,
      // [data-story-map], not "svg" — the moved-file warning icon is an
      // <svg> too, and counting those made this check report a map on a
      // row that has none.
      rowMaps: rows.reduce((n, li) => n + li.querySelectorAll("[data-story-map]").length, 0),
      dimmest: faded[0] ?? 1,
    };
  });

  check(
    "typing filters the shelf",
    found.heading && found.matchCards === 2,
    `“lan” → ${found.matchCards} matches`,
  );
  check(
    "the count is announced, not merely drawn",
    /2 of 6 stories/.test(found.announced),
    JSON.stringify(found.announced),
  );
  check(
    "matches keep their maps",
    found.matchesHaveMaps > 0,
    `${found.matchesHaveMaps} scene cards across the matches`,
  );
  check(
    "everything else becomes a row — no map, because a map is for hunting",
    found.restHeading && found.rows === 4 && found.rowMaps === 0,
    `${found.rows} rows, ${found.rowMaps} maps`,
  );
  check(
    "NOTHING IS DIMMED — the non-matching stories are at full contrast",
    found.dimmest === 1,
    `lowest opacity on any non-matching row: ${found.dimmest}`,
  );

  const none = await (async () => {
    await page.fill("#welcome-find", "zzzz");
    await wait(200);
    return api(() => {
      const live = document.querySelector("[aria-live]");
      return {
        said: live ? live.textContent.trim() : "",
        rows: document.querySelectorAll("main ul li").length,
      };
    });
  })();
  check(
    "no match says so, and still shows the shelf",
    /No stories match/.test(none.said) && none.rows === 6,
    `${JSON.stringify(none.said)}, ${none.rows} rows still reachable`,
  );

  // --------------------------------------------------------- put it back

  await api(() => {
    window.__scriareProjectStore.setState({ recentProjects: [] });
  });
  await seedProject();
  await wait(150);
  const restored = await api(() =>
    Boolean(window.__scriareProjectStore.getState().project),
  );
  check("the workspace is handed back to the next spec", restored);
}
