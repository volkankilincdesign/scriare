/**
 * Test runner.
 *
 *   npm test
 *
 * which is `electron-vite build --mode test` followed by this file. The
 * test-mode build is what exposes the app's stores on `window` (see the
 * guarded block in src/renderer/src/main.tsx); a production build does not,
 * and is checked not to.
 *
 * There is no test framework here on purpose. What these tests need is to
 * launch the real packaged Electron app, reach into its real stores and
 * assert on what actually happened — a runner adds configuration and a
 * vocabulary without adding any of that. If this ever grows past a few
 * files, the thing to reach for is Playwright's own test runner, which is
 * already the dependency.
 *
 * A spec file default-exports `async ({ page, api, check, seedProject })`.
 * Every spec shares one app launch, so specs must leave the store in a
 * state the next one can seed over — `seedProject()` does that for you.
 */
import { readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { _electron } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass });
  console.log(`  ${pass ? "✓" : "✗"} ${name}${detail ? `  — ${detail}` : ""}`);
}

const app = await _electron.launch({
  executablePath: process.env.ELECTRON_PATH ?? join(root, "node_modules/electron/dist/electron"),
  args: [join(root, "out/main/index.js")],
  cwd: root,
});
const page = await app.firstWindow();

// The stores arrive via a dynamic import, so they are not on `window` the
// instant the first frame paints.
await page.waitForFunction(() => Boolean(window.__scriareProjectStore), null, { timeout: 15000 });

/**
 * Put the workspace into a known shape before anything is measured.
 *
 * Electron gives an app one userData directory per app NAME, so the test
 * build and the writer's own copy of Scriare share it — including the
 * localStorage key that remembers which panels they collapsed. A writer
 * who had folded away the Inspector and the graph to write distraction-free
 * therefore ran a suite in which seven assertions measured panels that
 * weren't on screen. They failed on their machine and passed on everyone
 * else's, which is the worst way for a test to be wrong: it looks like a
 * bug in the app.
 *
 * So the runner states the layout rather than inheriting it. The panels are
 * part of what's under test, and a test that doesn't control its own
 * preconditions isn't measuring what it claims to.
 *
 * Written before a reload rather than after, because App reads these keys
 * once when it mounts.
 */
await page.evaluate(() => {
  window.localStorage.setItem(
    "scriare:panelCollapsed",
    JSON.stringify({ content: false, inspector: false, flow: false }),
  );
  // Which tree sections are open is remembered the same way, and leaks the
  // same way — a spec that clicks "Characters" to open it CLOSES it if the
  // writer left it open. Cleared rather than set, so the app's own
  // documented default (Story open, everything else closed) is what runs.
  window.localStorage.removeItem("scriare:contentExpanded");
});
await page.reload();
await page.waitForFunction(() => Boolean(window.__scriareProjectStore), null, { timeout: 15000 });

const api = (fn, arg) => page.evaluate(fn, arg);

/**
 * Puts a known project into the store. Bypasses the file dialogs, which a
 * headless run can't drive, and gives every spec the same starting point.
 */
function seedProject() {
  return api(() => {
    const store = window.__scriareProjectStore;
    const now = new Date().toISOString();
    const scene = (id, title, text) => ({
      id,
      title,
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] },
      position: { x: 0, y: 0 },
      frameId: null,
      order: 0,
    });
    store.setState({
      project: {
        name: "Test Story",
        createdAt: now,
        updatedAt: now,
        scenes: [scene("s1", "One", "one"), scene("s2", "Two", "two"), scene("s3", "Three", "three")],
        content: [
          ...["s1", "s2", "s3"].map((id, i) => ({
            id,
            kind: "leaf",
            category: "story",
            parentId: null,
            order: i,
            refType: "scene",
          })),
          // An empty drawn group — the graph-side half of the model, and
          // what the rename-coalescing case types into.
          {
            id: "g1",
            kind: "folder",
            category: "story",
            parentId: null,
            order: 3,
            name: "Group",
            rect: { x: 0, y: 0, width: 480, height: 320 },
          },
        ],
        favorites: [],
        variables: [],
        // Real projects get this from normalizeProject on load; this seed
        // writes the store directly, so it supplies it the same way.
        choiceStyles: window.__scriareChoiceStyles.normalizeChoiceStyles(undefined),
        entities: [],
        startSceneId: "s1",
      },
      filePath: null,
      selectedSceneId: "s1",
      selectedEntityId: null,
      saveStatus: "saved",
      isPlaying: false,
      canUndo: false,
      canRedo: false,
      undoLabel: null,
      redoLabel: null,
      undoToken: null,
    });
    window.__scriareToastStore?.setState({ toasts: [] });
  });
}

// SPEC=speaker runs one file. The whole suite is the only thing that ever
// proves anything, and CI has no business running a subset — but a
// negative control (sabotage the code, watch the right test go red) is run
// over and over while building one feature, and waiting for every spec
// each time is how people stop bothering to do them.
const only = process.env.SPEC;
const specs = (await readdir(here))
  .filter((f) => f.endsWith(".spec.mjs"))
  .filter((f) => !only || f.startsWith(only))
  .sort();
for (const file of specs) {
  console.log(`\n${file}`);
  const mod = await import(pathToFileURL(join(here, file)).href);
  await seedProject();
  await mod.default({ page, api, check, seedProject });
}

const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} passed`);
await app.close();
process.exit(passed === results.length ? 0 : 1);
