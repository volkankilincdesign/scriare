/**
 * Screenshots of the real app, for looking at.
 *
 * NOT A MOCKUP. Every image this writes is the shipped build rendering
 * itself — same code path the suite drives, same window, same theme
 * tokens. A hand-drawn picture of a screen is worse than no picture for
 * the one job this has, which is being compared against the screen.
 *
 * WHY IT EXISTS. v0.81.0 shipped a dead link on the Welcome screen: the
 * help panel was mounted only in App's project branch, so the one door
 * built for newcomers set a flag and rendered nothing. 1029 tests were
 * green. It was found the first time anybody looked at a picture of that
 * screen — which is the whole argument for this file. A test asserts
 * what somebody thought to assert; a picture shows what is there.
 *
 *   node tools/shots.mjs                 (under xvfb-run on a headless box)
 *   ONLY=dialogs node tools/shots.mjs    one group
 *
 * Run `npx electron-vite build --mode test` first: the test hooks this
 * drives (window.__scriare*) exist only in that build, and it launches
 * whatever is in out/ rather than the sources.
 */
import { mkdir, readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const out = join(here, "shots");
const only = process.env.ONLY;

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const app = await _electron.launch({
  executablePath: process.env.ELECTRON_PATH ?? join(root, "node_modules/electron/dist/electron"),
  args: [root],
  cwd: root,
});
const page = await app.firstWindow();
await page.waitForFunction(() => Boolean(window.__scriareProjectStore), null, { timeout: 15000 });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => {
  await wait(320);
  await page.screenshot({ path: join(out, `${name}.png`) });
  console.log(`  ${name}.png`);
};
const run = async (name, fn) => {
  if (only && only !== name) return;
  console.log(name);
  await fn();
};

const size = (w, h) => page.setViewportSize({ width: w, height: h });
const theme = (id) =>
  page.evaluate((t) => window.__scriareThemes.useThemeStore.getState().setTheme(t), id);
const noProject = () =>
  page.evaluate(() => {
    window.__scriareProjectStore.setState({ project: null, filePath: null });
  });

/**
 * HIS ACTUAL STORY, not a stand-in for it (v0.86.0).
 *
 * This built a three-scene fixture by hand and called it "The Blue Hour",
 * which is the name of the real thing — 32 scenes, five chapters, 70 choice
 * options with destinations — that has been sitting in `tests/fixtures`
 * since v0.64.0 and is what the video will be shot with.
 *
 * The difference matters most in exactly the shot that matters most. On
 * three scenes the Story Graph is a toy: two wires, no chapter boxes, no
 * merges, nothing for v0.73.0's router to route around. The visual sweep
 * exists to answer "how does this look", and a graph with three cards in it
 * cannot answer that question for a graph with thirty-two.
 *
 * The stub is kept as the fallback rather than deleted: this script has to
 * run on a checkout where the fixture has moved or been renamed, and a
 * screenshot run that dies on a missing file is a screenshot run nobody
 * does.
 */
async function loadStory() {
  const fixture = join(root, "tests/fixtures/the-blue-hour.scriare");
  let raw = null;
  try {
    raw = await readFile(fixture, "utf-8");
  } catch {
    console.log("  (no fixture at tests/fixtures — falling back to the built-in stub)");
  }

  if (raw) {
    await page.evaluate(async (json) => {
      const w = (ms) => new Promise((r) => setTimeout(r, ms));
      const project = window.__scriareProjectTypes.normalizeProject(JSON.parse(json));
      window.__scriareProjectStore.setState({ project, filePath: null, saveStatus: "saved" });
      await w(320);
      // The story's own opening, rather than whichever scene happens to be
      // first in the array — this is the screen a reader starts on.
      const start = project.startSceneId ?? project.scenes[0]?.id;
      if (start) window.__scriareProjectStore.getState().selectScene(start);
      await w(320);
    }, raw);
    const loaded = await page.evaluate(() => {
      const p = window.__scriareProjectStore.getState().project;
      return { name: p?.name, scenes: p?.scenes.length ?? 0 };
    });
    console.log(`  ${loaded.name} — ${loaded.scenes} scenes`);
    return true;
  }

  await page.evaluate(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    const now = new Date().toISOString();
    const para = (text) => ({
      type: "paragraph",
      content: text ? [{ type: "text", text }] : undefined,
    });
    window.__scriareProjectStore.setState({
      project: window.__scriareProjectTypes.normalizeProject({
        id: "shots",
        name: "The Blue Hour",
        author: "Volkan Kılınç",
        createdAt: now,
        updatedAt: now,
        startSceneId: "s1",
        variables: [
          { id: "v1", name: "Trust", type: "number", initial: 0 },
          { id: "v2", name: "Knows", type: "boolean", initial: false },
        ],
        entities: [
          { id: "e1", kind: "character", name: "Mara", aliases: [], canSpeak: true, content: null },
          { id: "e2", kind: "location", name: "The Glasshouse", aliases: [], content: null },
        ],
        scenes: [
          {
            id: "s1",
            title: "The Glasshouse",
            position: { x: 0, y: 0 },
            frameId: null,
            order: 0,
            content: {
              type: "doc",
              content: [
                para("The panes are warm and the light is going."),
                para("She has been here since before the rain."),
              ],
            },
          },
          {
            id: "s2",
            title: "Outside",
            position: { x: 320, y: -80 },
            frameId: null,
            order: 1,
            content: { type: "doc", content: [para("Cold, and further than it looked.")] },
          },
        ],
        content: [],
        favorites: [],
      }),
      filePath: null,
      saveStatus: "saved",
    });
    await w(280);
    window.__scriareProjectStore.getState().selectScene("s1");
    await w(280);
  });
  return false;
}

/**
 * Puts one of each block in the open scene — ONLY when the story has none
 * (v0.86.0).
 *
 * It used to run unconditionally, which was right while the fixture was a
 * three-scene stub with no blocks in it. Against the real story it writes an
 * EMPTY Choice, Dialogue and Conditional into the opening scene, and an
 * empty choice renders to a reader as a box containing "…". So the first
 * Play Mode screenshot showed his opening page with a fourth, blank option
 * under the three he wrote — a defect that existed only in the photograph,
 * which is the worst kind to hand somebody who is judging how the app looks.
 */
async function addBlocks(real) {
  if (real) {
    const has = await page.evaluate(
      () => document.querySelectorAll("[data-choice-block], [data-dialogue-block]").length,
    );
    if (has > 0) return;
  }
  await page.evaluate(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    const editor = window.__scriareEditorStore.getState().editor;
    editor.commands.focus("end");
    editor.chain().focus().insertChoiceBlock().run();
    await w(200);
    editor.commands.focus("end");
    editor.chain().focus().insertDialogueBlock().run();
    await w(200);
    editor.commands.focus("end");
    editor.chain().focus().insertConditionalBlock().run();
    await w(200);
    editor.commands.blur();
  });
}

const openUI = (method) => page.evaluate((m) => window.__scriareUIStore.getState()[m](), method);
const closeUI = (method) => page.evaluate((m) => window.__scriareUIStore.getState()[m](), method);

/* ── the Welcome screen ─────────────────────────────────────────── */
await run("welcome", async () => {
  await size(1280, 860);
  await noProject();
  await page.evaluate(() => window.__scriareProjectStore.setState({ recentProjects: [] }));
  await shot("welcome-empty");
  await openUI("openHelp");
  await shot("welcome-help");
  await closeUI("closeHelp");
});

/* ── the writing surface ────────────────────────────────────────── */
await run("editor", async () => {
  await size(1280, 860);
  const real = await loadStory();
  await shot("editor-prose");

  // HIS BLOCKS, NOT MINE (v0.86.0). This used to insert one of each and
  // photograph the result, which on the real story meant writing three EMPTY
  // blocks into his opening page — and an empty choice renders as a box
  // containing "…". The story already uses two of the three (28 scenes with
  // a Choice, 12 with a Conditional), so the honest picture of "what a
  // scene with blocks in it looks like" is a scene he wrote.
  if (real) {
    await page.evaluate(async () => {
      const w = (ms) => new Promise((r) => setTimeout(r, ms));
      window.__scriareProjectStore.getState().selectScene("s08");
      await w(420);
    });
  }
  await addBlocks(real);
  await shot("editor-blocks");

  // THE THIRD BLOCK, WHICH HIS STORY DOES NOT USE. Zero Dialogue blocks in
  // thirty-two scenes — so this is the one place the screenshot has to
  // invent, and it is labelled as invented rather than passed off as his.
  if (real) {
    await page.evaluate(async () => {
      const w = (ms) => new Promise((r) => setTimeout(r, ms));
      const editor = window.__scriareEditorStore.getState().editor;
      editor.commands.focus("end");
      editor.chain().focus().insertDialogueBlock().run();
      await w(300);
      editor.commands.blur();
    });
    await shot("editor-dialogue-inserted");
  }
});

/* ── every dialog, one after another ────────────────────────────── */
await run("dialogs", async () => {
  await size(1280, 860);
  await loadStory();
  for (const [name, open, close] of [
    ["help", "openHelp", "closeHelp"],
    ["settings", "openSettings", "closeSettings"],
    ["stylesheet", "openStylesheet", "closeStylesheet"],
    ["choice-styles", "openChoiceStyles", "closeChoiceStyles"],
    ["variables", "openVariableManager", "closeVariableManager"],
    ["export", "openExport", "closeExport"],
    ["preferences", "openPreferences", "closePreferences"],
  ]) {
    await openUI(open);
    await shot(`dialog-${name}`);
    await closeUI(close);
    await wait(140);
  }
  // Check Story runs rather than opens.
  await page.evaluate(() => window.__scriareUIStore.getState().openStoryCheck?.());
  await shot("dialog-check-story");
  await page.evaluate(() => window.__scriareUIStore.getState().closeStoryCheck?.());
});

/* ── the same surfaces on a LIGHT ground ────────────────────────── */
await run("light", async () => {
  await size(1280, 860);
  await theme("light");
  const real = await loadStory();
  await addBlocks(real);
  await shot("light-editor");
  await openUI("openHelp");
  await shot("light-help");
  await closeUI("closeHelp");
  await openUI("openStylesheet");
  await shot("light-stylesheet");
  await closeUI("closeStylesheet");
  await theme("daylight");
  await shot("daylight-editor");
  await theme("dark");
});

/* ── a narrow window ────────────────────────────────────────────── */
await run("narrow", async () => {
  await size(1024, 720);
  const real = await loadStory();
  await addBlocks(real);
  await shot("narrow-editor");
  await openUI("openHelp");
  await shot("narrow-help");
  await closeUI("closeHelp");
  await size(1280, 860);
});

/* ── the Story Graph ────────────────────────────────────────────── */

// THE SHOT THE VIDEO OPENS WITH, and this script did not take it (v0.86.0).
// Fifteen screens and not one of the graph — which was defensible while the
// fixture was three scenes, because a graph with three cards in it is not a
// picture of anything. On the real story it is the surface most likely to
// look wrong and the one a stranger forms an opinion from first.
//
// Three states, because they are three different claims: as the story sits,
// after Auto Layout has had its say, and folded — which is how the roadmap
// says to film it, since thirty-two cards at once is noise on video.
await run("graph", async () => {
  await size(1440, 900);
  await loadStory();

  // The graph shares the column with the editor and opens on a toggle found
  // by its title, the way perf.spec drives it — a label is a sturdier handle
  // here than a class, because this one is asserted by name elsewhere.
  const expand = page.locator('[title="Expand Story Graph"]');
  if (await expand.count()) {
    await expand.first().click();
    await page.waitForTimeout(700);
  }
  await shot("graph-as-found");

  await page.evaluate(() => window.__scriareProjectStore.getState().autoLayoutScenes());
  await page.waitForTimeout(900);
  await shot("graph-auto-layout");

  // Folded: every chapter down to a block. The roadmap's note for the video
  // is four boxes and then one unfolds, so this is the "before" of that shot.
  const folded = await page.evaluate(() => {
    const store = window.__scriareProjectStore.getState();
    const groups = window.__scriareGroupUtils.graphGroups(
      store.project.content,
      store.project.scenes,
    );
    groups.forEach((g) => store.toggleFolderCollapsed(g.id));
    return groups.length;
  });
  console.log(`  folded ${folded} chapter(s)`);
  await page.waitForTimeout(800);
  await shot("graph-folded");

  await size(1280, 860);
});

/* ── Play Mode ──────────────────────────────────────────────────── */
await run("play", async () => {
  await size(1280, 860);
  const real = await loadStory();
  await addBlocks(real);
  await page.evaluate(() => window.__scriareProjectStore.getState().startPlay());
  await shot("play-night");
  await page.evaluate(() => window.__scriarePlayGround.getState().setGround("paper"));
  await shot("play-paper");
  await page.evaluate(() => window.__scriarePlayGround.getState().setGround("night"));
  await page.evaluate(() => window.__scriareProjectStore.getState().exitPlay());
});

await app.close();
console.log(`\nwrote to ${out}`);
