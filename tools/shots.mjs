/**
 * Screenshots of the real app, for looking at somewhere the app is not.
 *
 * NOT A MOCKUP. Every image this writes is the shipped build rendering
 * itself — same code path the suite drives, same window, same theme
 * tokens. A hand-drawn picture of a screen is worse than no picture for
 * the one job this has, which is being compared against the screen.
 *
 *   node tools/shots.mjs            (under xvfb-run on a headless box)
 *
 * Writes PNGs into tools/shots/. Run `npm run build` first — this launches
 * whatever is in out/, not the sources.
 */
import { mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const out = join(here, "shots");

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const app = await _electron.launch({
  executablePath: process.env.ELECTRON_PATH ?? join(root, "node_modules/electron/dist/electron"),
  args: [root],
  cwd: root,
});
const page = await app.firstWindow();
await page.waitForFunction(() => Boolean(window.__scriareProjectStore), null, { timeout: 15000 });
await page.setViewportSize({ width: 1280, height: 860 });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => {
  await wait(320);
  await page.screenshot({ path: join(out, `${name}.png`) });
  console.log(`wrote ${name}.png`);
};

/* ── the Welcome screen, with nothing on the shelf ──────────────────
   The branch that only ever renders for somebody who has never opened a
   story — which is the one state a writer with their own work in the app
   cannot reach without hiding it. */
await page.evaluate(() => {
  window.__scriareProjectStore.setState({
    project: null,
    filePath: null,
    recentProjects: [],
  });
});
await shot("welcome-empty");

/* ── How Scriare works, both halves ─────────────────────────────── */
await page.evaluate(() => window.__scriareUIStore.getState().openHelp());
await shot("help-blocks");
await page.evaluate(() => {
  document.querySelector('[data-help-tab="questions"]')?.click();
});
await shot("help-questions");
await page.evaluate(() => window.__scriareUIStore.getState().closeHelp());

/* ── the three blocks, stacked, in a real scene ─────────────────── */
await page.evaluate(async () => {
  const w = (ms) => new Promise((r) => setTimeout(r, ms));
  const now = new Date().toISOString();
  window.__scriareProjectStore.setState({
    project: window.__scriareProjectTypes.normalizeProject({
      id: "shots",
      name: "The Blue Hour",
      createdAt: now,
      updatedAt: now,
      startSceneId: "s1",
      scenes: [
        {
          id: "s1",
          title: "The Glasshouse",
          position: { x: 0, y: 0 },
          frameId: null,
          order: 0,
          content: { type: "doc", content: [{ type: "paragraph" }] },
        },
        {
          id: "s2",
          title: "Outside",
          position: { x: 300, y: 0 },
          frameId: null,
          order: 1,
          content: { type: "doc", content: [{ type: "paragraph" }] },
        },
      ],
      content: [],
      favorites: [],
      variables: [],
      entities: [],
    }),
    filePath: null,
    saveStatus: "saved",
  });
  await w(260);
  window.__scriareProjectStore.getState().selectScene("s1");
  await w(260);
});
await shot("empty-scene");

await page.evaluate(async () => {
  const w = (ms) => new Promise((r) => setTimeout(r, ms));
  const editor = window.__scriareEditorStore.getState().editor;
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
await shot("three-blocks");

await app.close();
console.log(`\nwrote to ${out}`);
