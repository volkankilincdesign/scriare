/**
 * What a keystroke costs on a big story (v0.51.0).
 *
 * The v0.48.0 audit's tier 3. Re-measured before anything was changed, and
 * the measurement is most of what this file is worth: two of the three
 * items it named do not cost what it said, and the thing that does cost was
 * not on the list.
 *
 *   everything open ......................... 80.6 ms
 *   Content panel collapsed ................. 66.8 ms   (panel: 13.8)
 *   + Inspector collapsed ................... 66.5 ms   (inspector: ~0)
 *   + Story Graph collapsed ................. 33.3 ms   (graph: 50.2)
 *
 * 33 ms is the FLOOR — two animation frames, which this has to wait for —
 * so the graph was about 50 ms of an 80 ms keystroke, more than everything
 * else put together.
 *
 * Everything is a median of repeated runs after a warm-up, and the two
 * panel numbers are DELTAS against the same edit with that panel
 * collapsed. An absolute figure here is mostly a report about
 * requestAnimationFrame and about this machine; a delta is the thing the
 * writer would feel appearing and disappearing.
 *
 * Thresholds sit between the measured before and after with room for a
 * slow box. They are regression detectors, not records.
 */
const SCENES = 300;
const RUNS = 9;

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

export default async function run({ page, api, check, seedProject }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ── a story big enough to hurt ───────────────────────────────── */

  await api(async (count) => {
    const store = window.__scriareProjectStore;
    const now = new Date().toISOString();
    const scenes = [];
    const content = [];
    for (let i = 0; i < count; i += 1) {
      // Half the scenes carry a real choice block: a story of bare
      // paragraphs would flatter every walk this is measuring.
      const body = [{ type: "paragraph", content: [{ type: "text", text: `Body of scene ${i}.` }] }];
      if (i % 2 === 0) {
        body.push({
          type: "choiceBlock",
          attrs: { blockId: `b${i}` },
          content: [0, 1, 2].map((k) => ({
            type: "choiceOption",
            attrs: { optionId: `o${i}-${k}`, targetSceneId: `p${(i + k + 1) % count}` },
            content: [{ type: "text", text: `Option ${k}` }],
          })),
        });
      }
      scenes.push({
        id: `p${i}`,
        title: `Scene ${i}`,
        content: { type: "doc", content: body },
        position: { x: (i % 20) * 108, y: Math.floor(i / 20) * 36 },
        frameId: null,
        order: i,
      });
      content.push({
        id: `p${i}`,
        kind: "leaf",
        category: "story",
        // Every tenth scene starts a chapter, so the tree has real depth
        // rather than 300 siblings — folders are what made the row list
        // re-filter, which is half of what this measures.
        parentId: i % 10 === 0 ? null : `f${Math.floor(i / 10)}`,
        order: i,
        refType: "scene",
      });
    }
    for (let f = 0; f < count / 10; f += 1) {
      content.push({
        id: `f${f}`,
        kind: "folder",
        category: "story",
        parentId: null,
        order: 1000 + f,
        name: `Chapter ${f}`,
        rect: { x: 0, y: 0, width: 480, height: 320 },
      });
    }
    store.setState({
      project: {
        name: "Big Story",
        createdAt: now,
        updatedAt: now,
        scenes,
        content,
        favorites: [],
        variables: [],
        choiceStyles: window.__scriareChoiceStyles.normalizeChoiceStyles(undefined),
        entities: [],
        startSceneId: "p0",
      },
      filePath: null,
      selectedSceneId: "p0",
      selectedEntityId: null,
      saveStatus: "saved",
    });
  }, SCENES);

  await wait(900);

  const sceneCount = await api(() => window.__scriareProjectStore.getState().project.scenes.length);
  check("the story is the size the audit used", sceneCount === SCENES, `${sceneCount} scenes`);

  /* ── one edit, timed to paint ─────────────────────────────────── */

  const timeEdits = () =>
    api(async (n) => {
      const store = window.__scriareProjectStore;
      const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
      const once = async (k) => {
        const t0 = performance.now();
        store.setState({
          project: {
            ...store.getState().project,
            scenes: store.getState().project.scenes.map((s) =>
              s.id === "p0" ? { ...s, title: `Scene 0${"x".repeat(k % 5)}` } : s,
            ),
          },
        });
        await frame();
        await frame();
        return performance.now() - t0;
      };
      for (let k = 0; k < 4; k += 1) await once(k);
      const out = [];
      for (let k = 0; k < n; k += 1) out.push(await once(k));
      return out;
    }, RUNS);

  // Throws rather than returning false. A toggle that silently does not
  // fire leaves every later measurement taken in the wrong configuration,
  // and the deltas then come out at zero — which reads as "this costs
  // nothing" instead of "this was never measured". That happened: the
  // expand controls are titled "Expand …", not "Show …", and three checks
  // reported a tidy 0.1 ms for a panel that had never been reopened.
  const clickTitled = async (prefix) => {
    const found = await page.evaluate((p) => {
      const button = [...document.querySelectorAll("button")].find((b) =>
        (b.getAttribute("title") ?? "").startsWith(p),
      );
      button?.click();
      return Boolean(button);
    }, prefix);
    if (!found) throw new Error(`no control titled "${prefix}" — the measurement would be meaningless`);
    return found;
  };

  /**
   * A/B INTERLEAVED, not two runs one after the other.
   *
   * The first version measured everything-open, then collapsed the panel
   * and measured again, and reported the difference. Across runs that
   * difference came out as −7.9 ms and then +17.2 ms for the same build:
   * roughly ±25 ms of drift on an effect worth about 14. The machine is
   * not steady enough over tens of seconds for two separated runs to be
   * comparable, and a threshold finer than the noise is a check that
   * agrees with you except where it is being tested.
   *
   * Alternating and taking the median of PAIRED differences cancels drift
   * that is slow compared to one pair.
   */
  const paired = async (prefixShut, prefixOpen, pairs) => {
    const deltas = [];
    for (let i = 0; i < pairs; i += 1) {
      const open = median(await timeEdits());
      await clickTitled(prefixShut);
      await wait(700);
      const shut = median(await timeEdits());
      await clickTitled(prefixOpen);
      await wait(700);
      deltas.push(open - shut);
    }
    return deltas;
  };

  /**
   * IS THIS MACHINE QUIET ENOUGH TO JUDGE?
   *
   * Run on its own, this spec measures a 1.1 ms panel cost and a 36.4 ms
   * graph cost. Run at the end of the whole suite, on the same build, it
   * measured 16.0 and 68.9 — the box is loaded and thirty specs of state
   * have accumulated in the one shared application.
   *
   * Widening the thresholds to pass in both would make them too loose to
   * catch the regressions they exist for: the sabotage that rebuilds every
   * scene node lands at about 50 ms against a 45 ms threshold. So instead
   * the floor is measured — one edit with both panels shut, which is two
   * animation frames and nothing else — and if even that is slow, the
   * numbers are reported and the assertions are skipped with it said out
   * loud. A red build that means "the CI box was busy" teaches people to
   * ignore red builds.
   */
  await clickTitled("Collapse Content");
  await wait(700);
  await clickTitled("Collapse Story Graph");
  await wait(700);
  const floor = median(await timeEdits());
  await clickTitled("Expand Story Graph");
  await wait(700);
  await clickTitled("Expand Content");
  await wait(700);

  const QUIET_FLOOR = 45;
  const quiet = floor < QUIET_FLOOR;
  check(
    "the machine is quiet enough to measure on",
    true,
    quiet
      ? `floor ${floor.toFixed(1)} ms (two frames)`
      : `floor ${floor.toFixed(1)} ms — too loaded to judge, thresholds below are reported only`,
  );

  const panelDeltas = await paired("Collapse Content", "Expand Content", 3);
  const panelCost = median(panelDeltas);

  const graphDeltas = await paired("Collapse Story Graph", "Expand Story Graph", 3);
  const graphCost = median(graphDeltas);

  /* ── audit #23: the Content panel ─────────────────────────────── */

  // Measured before the fix: 13.8 ms. The panel handed every row a fresh
  // context object and each folder row then filtered and sorted the whole
  // node list to find its own children — see utils/contentTree.ts.
  check(
    "the Content panel adds little to the cost of an edit",
    !quiet || panelCost < 26,
    `${panelCost.toFixed(1)} ms, median of ${panelDeltas.length} paired runs ` +
      `(${panelDeltas.map((d) => d.toFixed(1)).join(", ")})`,
  );

  /* ── the one the audit did not name: the Story Graph ──────────── */

  // Measured before the fix: 50.2 ms, because the nodes memo depends on
  // `project` and React Flow diffs by reference, so a title edit handed it
  // 300 new node objects. Unchanged scene nodes keep their identity now.
  //
  // The floor is two animation frames, so this can never reach zero; what
  // it must not do is go back to costing more than the frames it waits for.
  check(
    "the Story Graph does not dominate the cost of an edit",
    !quiet || graphCost < 75,
    `${graphCost.toFixed(1)} ms, median of ${graphDeltas.length} paired runs ` +
      `(${graphDeltas.map((d) => d.toFixed(1)).join(", ")})`,
  );

  /* ── audit #17/#18: walking every scene's choices ─────────────── */

  // Reported as 24.8 ms at 300 scenes. It does not reproduce: this is the
  // raw CPU of the walk, away from frame quantisation, on the same story
  // with 450 real choices in it.
  const walk = await api(() => {
    const { extractChoices } = window.__scriareChoiceUtils;
    const { mentionResolver } = window.__scriareMentions;
    const project = window.__scriareProjectStore.getState().project;
    const resolve = mentionResolver(project.entities ?? []);
    const once = () => {
      const t0 = performance.now();
      let n = 0;
      for (const s of project.scenes) n += extractChoices(s.content, resolve).length;
      return { ms: performance.now() - t0, n };
    };
    once();
    once();
    const samples = [];
    for (let i = 0; i < 9; i += 1) samples.push(once().ms);
    return { samples, choices: once().n };
  });

  const walkMs = median(walk.samples);
  check(
    "walking every scene's choices is cheap",
    walkMs < 8,
    `${walkMs.toFixed(2)} ms for ${SCENES} scenes / ${walk.choices} choices`,
  );

  /* ── the mechanism, guarded deterministically ─────────────────── */

  // The timings above document and catch gross regressions, but they
  // cannot guard the graph fixes: the graph resolves to about ±10 ms over
  // three paired runs and the fixes are worth 24 and 11. So the thing the
  // fixes actually DO — hand back the same object when nothing about it
  // changed — is asserted directly, where the answer is the same on any
  // machine.
  const reuse = await api(() => {
    const { newSignatureCache, reuseBySignature, pruneSignatureCache } = window.__scriareReuse;
    const cache = newSignatureCache();
    let built = 0;
    const make = (tag) => () => {
      built += 1;
      return { tag };
    };

    const first = reuseBySignature(cache, "a", "sig-1", make("one"));
    const again = reuseBySignature(cache, "a", "sig-1", make("two"));
    const changed = reuseBySignature(cache, "a", "sig-2", make("three"));

    pruneSignatureCache(cache, new Set(["a"]));
    const keptAfterPrune = cache.has("a");
    reuseBySignature(cache, "b", "sig-b", make("four"));
    pruneSignatureCache(cache, new Set(["a"]));
    const droppedAfterPrune = !cache.has("b");

    return {
      sameObject: first === again,
      newObject: changed !== again,
      built,
      keptAfterPrune,
      droppedAfterPrune,
    };
  });

  check(
    "an unchanged node keeps its identity, so React Flow can skip it",
    reuse.sameObject === true,
    `same object: ${reuse.sameObject}`,
  );
  check(
    "...and is not even rebuilt",
    reuse.built === 3,
    `${reuse.built} builds for 4 lookups (one reused)`,
  );
  check(
    "a changed node is a new object",
    reuse.newObject === true,
    `new object: ${reuse.newObject}`,
  );
  check(
    "the cache drops what the story no longer contains",
    reuse.keptAfterPrune === true && reuse.droppedAfterPrune === true,
    `kept live: ${reuse.keptAfterPrune}, dropped dead: ${reuse.droppedAfterPrune}`,
  );

  await seedProject();
  await wait(300);
}
