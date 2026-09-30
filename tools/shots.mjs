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
import { mkdir, rm } from "node:fs/promises";
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

/** A story with enough in it that every surface has something to draw. */
async function loadStory() {
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
          {
            id: "s3",
            title: "The Long Way Back",
            position: { x: 320, y: 90 },
            frameId: null,
            order: 2,
            content: { type: "doc", content: [para("Nothing has moved.")] },
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
}

async function addBlocks() {
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
  await loadStory();
  await shot("editor-prose");
  await addBlocks();
  await shot("editor-blocks");
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
  await loadStory();
  await addBlocks();
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
  await loadStory();
  await addBlocks();
  await shot("narrow-editor");
  await openUI("openHelp");
  await shot("narrow-help");
  await closeUI("closeHelp");
  await size(1280, 860);
});

/* ── Play Mode ──────────────────────────────────────────────────── */
await run("play", async () => {
  await size(1280, 860);
  await loadStory();
  await addBlocks();
  await page.evaluate(() => window.__scriareProjectStore.getState().startPlay());
  await shot("play-night");
  await page.evaluate(() => window.__scriarePlayGround.getState().setGround("paper"));
  await shot("play-paper");
  await page.evaluate(() => window.__scriarePlayGround.getState().setGround("night"));
  await page.evaluate(() => window.__scriareProjectStore.getState().exitPlay());
});

await app.close();
console.log(`\nwrote to ${out}`);
