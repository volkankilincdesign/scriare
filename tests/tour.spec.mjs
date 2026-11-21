import { existsSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * THE FIRST-LAUNCH TOUR (v0.91.0).
 *
 * What can fail here for real, and so what this checks:
 *
 *   1. A STOP POINTS AT NOTHING. The tour finds its regions by selector,
 *      and the components that carry those selectors are edited all the
 *      time. A renamed attribute leaves a card floating in the middle of a
 *      dimmed window, talking about a panel nobody can see. So every stop
 *      is walked on a real window and the lit hole is measured against the
 *      region the stop names, on screen.
 *
 *   2. IT FIRES WHEN IT SHOULD NOT, OR NEVER. Once per install, on the
 *      empty Welcome screen, and never again after Finish or Skip. Both
 *      halves are checked, because a guard that always says "already seen"
 *      passes the second half perfectly.
 *
 *   3. THE PRACTICE STORY. It is the one project the app writes without a
 *      dialog, so it must never land on top of anything: taking the tour
 *      twice has to give two files.
 *
 *   4. THE ROOM IS EDITABLE BEHIND IT. Keys pressed during the tour must
 *      not reach the app — Delete and Ctrl+Z are measured against the
 *      story, not against whether a listener exists.
 */
export default async function run({ page, api, check, seedProject }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const settle = () => wait(650); // past --d-considered, so the hole has arrived
  const stepId = () => api(() => document.querySelector("[data-tour-step]")?.dataset.tourStep ?? null);
  const record = () => api(() => window.localStorage.getItem("scriare:tour"));
  const practiceFiles = [];


  /* ── the stops, as data ─────────────────────────────────────────────── */

  const stops = await api(() => window.__scriareTourStops.map((s) => ({ id: s.id, targets: s.targets, ring: s.ring ?? "inside", terms: s.terms ?? null })));
  check(
    "the block buttons are the ONE stop whose ring sits outside — his exception, and only that one",
    stops.filter((s) => s.ring === "outside").map((s) => s.id).join(",") === "blocks",
    stops.map((s) => `${s.id}:${s.ring}`).join(" "),
  );
  check(
    "six stops, one per region, in the order he agreed",
    stops.map((s) => s.id).join(",") === "page,blocks,inspector,graph,content,play",
    stops.map((s) => s.id).join(","),
  );

  const termsMatch = await api(() => {
    const stop = window.__scriareTourStops.find((s) => s.id === "blocks");
    const reg = window.__scriareBlocks.STORY_BLOCKS;
    return {
      ok:
        stop.terms.length === reg.length &&
        stop.terms.every((t, i) => t.term === reg[i].title && t.meaning === reg[i].description),
      said: stop.terms.map((t) => `${t.term}: ${t.meaning}`),
    };
  });
  check(
    "the branching stop names the blocks in the registry's own words — no second vocabulary",
    termsMatch.ok,
    termsMatch.said.join(" | "),
  );

  /* ── first launch: offered once, on the empty shelf ────────────────── */

  const showEmptyWelcome = async () => {
    await api(() => {
      window.__scriareTourStore.setState({ active: false, step: -1, starting: false });
      window.__scriareProjectStore.setState({ project: null, filePath: null, recentProjects: [] });
    });
    await wait(400);
  };

  await api(() => window.localStorage.removeItem("scriare:tour"));
  await showEmptyWelcome();
  check(
    "a FIRST LAUNCH offers the tour by itself, on the empty Welcome screen",
    (await stepId()) === "welcome",
    `step: ${await stepId()}`,
  );

  // Not now = skipped, and skipped means never again on its own.
  await page.click("[data-tour-skip]");
  await wait(200);
  check("“Not now” closes it and records the answer", (await stepId()) === null && (await record()) === "skipped", await record());

  await showEmptyWelcome();
  check(
    "...and an install that has answered is NOT offered it again",
    (await stepId()) === null,
    `step: ${await stepId()}`,
  );

  check(
    "the empty shelf still has a way back to it",
    await api(() => Boolean(document.querySelector("[data-empty-shelf-tour]"))),
  );

  /* ── Start: the practice story ──────────────────────────────────────── */

  await page.click("[data-empty-shelf-tour]");
  await wait(200);
  check("“Take the tour” on the shelf opens the welcome card", (await stepId()) === "welcome");

  // Every frame's hole position from the moment Start is pressed, so the
  // ARRIVAL at stop 1 can be judged on what was painted (v0.91.0, his
  // report: the ring flew in from the window's top-left corner).
  await api(() => {
    window.__tourFrames = [];
    const t0 = performance.now();
    const tick = () => {
      const h = document.querySelector("[data-tour-hole]");
      if (h) {
        const r = h.getBoundingClientRect();
        window.__tourFrames.push(`${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}`);
      }
      if (performance.now() - t0 < 2500) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.click("[data-tour-next]");
  await page.waitForFunction(() => document.querySelector("[data-tour-step]")?.dataset.tourStep === "page", null, {
    timeout: 8000,
  });
  const first = await api(() => {
    const s = window.__scriareProjectStore.getState();
    const p = s.project;
    const start = p.scenes.find((x) => x.id === p.startSceneId);
    const block = start.content.content.find((n) => n.type === "choiceBlock");
    const targets = (block?.content ?? []).map((o) => o.attrs.targetSceneId);
    return {
      filePath: s.filePath,
      name: p.name,
      scenes: p.scenes.length,
      targets,
      allReal: targets.every((t) => p.scenes.some((x) => x.id === t && x.id !== start.id)),
    };
  });
  practiceFiles.push(first.filePath);
  check(
    "Start writes a practice story to disk, without a dialog, and opens it",
    Boolean(first.filePath) && existsSync(first.filePath) && first.name === "My first story",
    first.filePath,
  );
  check(
    "...and it is a story every stop can point at: three scenes, one choice, two real wires",
    first.scenes === 3 && first.targets.length === 2 && first.allReal,
    JSON.stringify(first),
  );
  check(
    "...in the folder the suite pointed it at, never the writer's Documents",
    Boolean(first.filePath) && dirname(first.filePath).includes("scriare-practice-"),
    first.filePath,
  );

  /* ── every stop lights what it names ────────────────────────────────── */

  await settle();
  await wait(1200);
  const arrival = await api(() => window.__tourFrames.slice(0, 60));
  const firstSeen = arrival[0] ?? "";
  const [fx, fy] = firstSeen.split(",").map(Number);
  // A ring that SLIDES in is ~25 different boxes over 420ms; one that
  // appears is the final box, perhaps one or two more while the panels it
  // has just opened finish laying out.
  const distinct = new Set(arrival).size;
  check(
    "STOP 1 APPEARS WHERE IT IS — it does not fly in from the window's corner",
    arrival.length > 0 && distinct <= 4 && !(fx < 40 && fy < 40),
    `${distinct} distinct boxes in ${arrival.length} frames, first ${firstSeen}`,
  );

  const misses = [];
  const overlaps = [];
  const offWindow = [];
  for (const stop of stops) {
    const id = await stepId();
    if (id !== stop.id) {
      misses.push(`expected ${stop.id}, on ${id}`);
      break;
    }
    await settle();
    const m = await api((targets) => {
      const hole = document.querySelector("[data-tour-hole]")?.getBoundingClientRect();
      const card = document.querySelector("[data-tour-card]")?.getBoundingClientRect();
      let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
      for (const sel of targets)
        for (const el of document.querySelectorAll(sel)) {
          const x = el.getBoundingClientRect();
          if (!x.width || !x.height) continue;
          l = Math.min(l, x.left); t = Math.min(t, x.top); r = Math.max(r, x.right); b = Math.max(b, x.bottom);
        }
      const vw = window.innerWidth, vh = window.innerHeight;
      const target = Number.isFinite(l)
        ? { l: Math.max(l, 0), t: Math.max(t, 0), r: Math.min(r, vw), b: Math.min(b, vh) }
        : null;
      return {
        hole: hole && { l: hole.left, t: hole.top, r: hole.right, b: hole.bottom },
        card: card && { l: card.left, t: card.top, r: card.right, b: card.bottom },
        target,
        vw,
        vh,
      };
    }, stop.targets);
    const { hole, card, target } = m;
    // HIS RULE: the ring's OUTER edge sits 2px inside the region, on every
    // side, on every stop. The box is drawn with a 2px ring outside it, so
    // ring edge = box + 2, and that must equal region - 2 (±1 for rounding).
    // Exact rather than "covers": a hole the size of the window also covers
    // every target, and one drawn outside the region is the overflow he saw.
    //
    // HIS ONE EXCEPTION: the block buttons, where the ring's INNER edge (the
    // box itself) sits 2px clear of the region instead.
    const ring = hole && { l: hole.l - 2, t: hole.t - 2, r: hole.r + 2, b: hole.b + 2 };
    const near = (a, b) => Math.abs(a - b) <= 1;
    const placed =
      stop.ring === "outside"
        ? hole && target && near(hole.l, target.l - 2) && near(hole.t, target.t - 2) && near(hole.r, target.r + 2) && near(hole.b, target.b + 2)
        : ring && target && near(ring.l, target.l + 2) && near(ring.t, target.t + 2) && near(ring.r, target.r - 2) && near(ring.b, target.b - 2);
    if (!placed) misses.push(`${stop.id} (${stop.ring}): ring ${JSON.stringify(ring)} region ${JSON.stringify(target)}`);
    const ringInWindow = ring && ring.l >= 0 && ring.t >= 0 && ring.r <= m.vw && ring.b <= m.vh;
    if (!ringInWindow) offWindow.push(`${stop.id}: ${JSON.stringify(ring)} in ${m.vw}×${m.vh}`);
    const inWindow = card && card.l >= 0 && card.t >= 0 && card.r <= m.vw && card.b <= m.vh;
    const coversHole =
      card && hole && card.l < hole.r - 2 && card.r > hole.l + 2 && card.t < hole.b - 2 && card.b > hole.t + 2;
    // A card over its own region is allowed ONLY when there is no room
    // anywhere around it — the Play button and the page always have room.
    if (!inWindow || (coversHole && (stop.id === "play" || stop.id === "blocks")))
      overlaps.push(`${stop.id}: card ${JSON.stringify(card)}`);
    if (stop.id !== "play") await page.keyboard.press("ArrowRight");
  }
  check("EVERY STOP LIGHTS THE REGION IT NAMES — its ring sits 2px inside it, on every side (2px clear of the block buttons)", misses.length === 0, misses.join(" ; ") || "6/6");
  check("THE RING NEVER LEAVES THE WINDOW — the panels against its edges included", offWindow.length === 0, offWindow.join(" ; ") || "6/6");
  const slidesLater = await api(() => getComputedStyle(document.querySelector("[data-tour-hole]")).transitionDuration);
  check("...while moving BETWEEN stops still slides", slidesLater !== "0s" && slidesLater !== "", slidesLater);
  check("every card stays inside the window and off the small regions it points at", overlaps.length === 0, overlaps.join(" ; ") || "ok");

  const dims = await api(() => {
    const hole = document.querySelector("[data-tour-hole]");
    return hole ? getComputedStyle(hole).boxShadow : "";
  });
  check("the rest of the room is dimmed, by the hole's own shadow", /9999px/.test(dims), dims.slice(0, 80));

  /* ── keys belong to the tour ────────────────────────────────────────── */

  await page.keyboard.press("ArrowLeft");
  await wait(100);
  check("← goes back a stop", (await stepId()) === "content", await stepId());

  // THE AMBIGUOUS CASE, ON PURPOSE. A freshly opened practice story has no
  // undo history and nothing selected, so Delete and Ctrl+Z would do
  // nothing even if they DID reach the app — and the first version of this
  // check passed with the key handling sabotaged. So the room is armed
  // first: a scene is made (one undo step) and selected in the Content
  // panel, which is exactly the state in which either key would change the
  // story if it got through.
  await api(() => window.__scriareProjectStore.getState().createScene());
  // After the Content panel has re-published its own selection for the new
  // scene, or it overwrites this one on the next frame.
  await wait(250);
  await api(() => {
    const id = window.__scriareProjectStore.getState().selectedSceneId;
    const sel = window.__scriareSelectionStore.getState();
    sel.claimSurface("content");
    sel.setContentIds([id]);
  });
  await wait(100);
  const armedState = await api(() => ({
    canUndo: window.__scriareProjectStore.getState().canUndo,
    selected: window.__scriareSelectionStore.getState().contentIds.length,
    surface: window.__scriareSelectionStore.getState().surface,
  }));
  const armed = armedState.canUndo && armedState.selected === 1;

  const before = await api(() => JSON.stringify(window.__scriareProjectStore.getState().project.scenes.map((s) => s.id)));
  // ONE KEY AT A TIME, compared after each. Pressed back to back, a Delete
  // that got through and a Ctrl+Z that got through undo each other, and the
  // story comes out exactly as it went in — which is how the first version
  // of this check passed with every key leaking.
  const sceneIds = () => api(() => JSON.stringify(window.__scriareProjectStore.getState().project.scenes.map((s) => s.id)));
  await page.keyboard.press("Delete");
  await wait(150);
  const afterDelete = await sceneIds();
  await page.keyboard.press("Control+z");
  await wait(150);
  const afterUndo = await sceneIds();
  await page.keyboard.type("xyz");
  await wait(150);
  const after = afterDelete === before && afterUndo === before ? await sceneIds() : afterDelete !== before ? afterDelete : afterUndo;
  const typed = await api(() =>
    JSON.stringify(window.__scriareProjectStore.getState().project.scenes).includes("xyz"),
  );
  check("the room is armed — an undo step and a selection Delete would act on", armed, JSON.stringify(armedState));
  check("NOTHING PRESSED DURING THE TOUR REACHES THE STORY — Delete, Ctrl+Z and typing", armed && before === after && !typed, `${before.length} → ${after.length} chars of ids${typed ? " (typed into)" : ""}`);

  await page.keyboard.press("ArrowRight");
  await wait(100);
  await page.click("[data-tour-next]");
  await wait(250);
  check(
    "the last stop's button finishes it, and finishing is remembered",
    (await stepId()) === null && (await record()) === "finished",
    `${await stepId()} / ${await record()}`,
  );

  /* ── replay from the ? on the open story ────────────────────────────── */

  const openPath = await api(() => window.__scriareProjectStore.getState().filePath);
  // All three panels folded first, so the check that the tour opens them is
  // asked of a window where they are genuinely shut.
  for (const title of ["Collapse Content", "Collapse Inspector", "Collapse Story Graph"]) {
    await page.click(`button[title="${title}"]`);
  }
  await wait(250);
  const shut = await api(() => !document.querySelector('[data-tour="inspector"]') && !document.querySelector('[data-tour="content"]'));
  await page.click('button[aria-label="How Scriare works"]');
  await wait(250);
  await page.click("[data-help-tour]");
  await wait(250);
  const welcomeText = await api(() => document.querySelector("#scriare-tour-body")?.textContent ?? "");
  check(
    "“Take the tour” in Help replays it, and says it will use the story that is open",
    (await stepId()) === "welcome" && /story you have open/.test(welcomeText),
    welcomeText,
  );
  await page.keyboard.press("ArrowRight");
  await wait(300);
  check(
    "...and a replay with a story open does NOT make another practice story",
    (await stepId()) === "page" && (await api(() => window.__scriareProjectStore.getState().filePath)) === openPath,
  );
  await settle();
  const panelsOpen = await api(() =>
    ["content", "inspector", "graph"].every((id) => {
      const r = document.querySelector(`[data-tour="${id}"]`)?.getBoundingClientRect();
      return r && r.width > 120 && r.height > 120;
    }),
  );
  check("the tour opens the panels a writer had folded away, before it points at them", shut && panelsOpen, `shut before: ${shut}`);

  await page.keyboard.press("Escape");
  await wait(150);
  check("Esc ends it from any stop", (await stepId()) === null && (await record()) === "skipped");

  /* ── Play takes the room away, so the tour ends ─────────────────────── */

  await api(() => window.__scriareTourStore.getState().offer());
  await page.keyboard.press("ArrowRight");
  await wait(200);
  await api(() => window.__scriareProjectStore.getState().startPlay());
  await wait(200);
  check("starting Play mid-tour ends the tour rather than dimming the reader's page", (await stepId()) === null);
  await api(() => window.__scriareProjectStore.getState().exitPlay());

  /* ── never over anything ────────────────────────────────────────────── */

  // Past the 1.5s autosave, so the first story is at rest before its bytes
  // are taken — the scene made above is still being written otherwise.
  await wait(2000);
  const firstBytes = readFileSync(first.filePath, "utf8");
  await api(() => window.__scriareProjectStore.setState({ project: null, filePath: null }));
  await wait(200);
  await api(() => window.__scriareTourStore.getState().offer());
  await page.click("[data-tour-next]");
  await page.waitForFunction(() => document.querySelector("[data-tour-step]")?.dataset.tourStep === "page", null, {
    timeout: 8000,
  });
  const second = await api(() => window.__scriareProjectStore.getState().filePath);
  practiceFiles.push(second);
  check(
    "TAKING IT TWICE GIVES TWO STORIES — the second is written beside the first, never over it",
    second !== first.filePath && existsSync(second) && readFileSync(first.filePath, "utf8") === firstBytes,
    second,
  );

  /* ── hand the app back ──────────────────────────────────────────────── */

  await page.keyboard.press("Escape");
  await api(async (files) => {
    window.localStorage.setItem("scriare:tour", "finished");
    window.localStorage.setItem(
      "scriare:panelCollapsed",
      JSON.stringify({ content: false, inspector: false, flow: false }),
    );
    // The practice stories went into Recent Projects, which this build
    // shares with the writer's own copy of the app. Out again.
    for (const f of files) await window.api.recent.remove(f);
    window.__scriareTourStore.setState({ active: false, step: -1, starting: false });
  }, practiceFiles);
  await seedProject();
  await wait(200);
  check("the workspace is handed back with no tour on screen", (await stepId()) === null);
}
