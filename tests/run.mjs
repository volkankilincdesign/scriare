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
import { readdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
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
  // And the editor/graph splitter, for a sharper reason than tidiness: the
  // graph fits its camera to the panel it's given, so the panel's height
  // sets the zoom, and the zoom sets how many screen pixels a node occupies.
  // Any spec that measures or drives something in screen coordinates — the
  // Group-name drag in entities-and-renaming.spec.mjs does both — is then
  // working on a different-sized node than it was written against, and
  // passes or fails on a splitter position someone dragged days ago. Same
  // class of leak as the collapsed panels above, found the same way.
  window.localStorage.removeItem("scriare:flowHeight");
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

/**
 * Opens an EXPORTED story the way a reader does — as a file, in a browser
 * window of its own (v0.48.0).
 *
 * The obvious way to test an exported page is to drop it into an iframe
 * inside the app and drive that. It does not work, and finding out why was
 * worth the detour: the app ships a Content Security Policy of
 * `script-src 'self'`, an `srcdoc` frame inherits it, and the exported
 * page's inline script is therefore never executed. Every assertion still
 * "ran" — against a page whose markup was present, whose stylesheet
 * applied, and whose behaviour did not exist. That is the shape of a test
 * that measures its own harness, and it would have reported an entirely
 * dead export as working the moment the checks were loosened enough to go
 * green.
 *
 * A real BrowserWindow loading a real `file://` URL has no such policy, so
 * this runs the artefact under the conditions it will actually meet: on
 * disk, opened from a filesystem, with nothing of Scriare in scope. It also
 * quietly proves something the iframe never could — that the file works
 * when it is opened as a file.
 *
 * One window for the whole suite, reloaded per case. Creating a window per
 * assertion is the difference between a spec that runs in seconds and one
 * nobody waits for.
 */
const exportTempFiles = [];
let exportWindow = null;
let exportFileCount = 0;

async function openExported(html) {
  if (!exportWindow) {
    const created = app.waitForEvent("window");
    await app.evaluate(({ BrowserWindow }) => {
      const win = new BrowserWindow({ show: false, width: 960, height: 900 });
      void win.loadURL("about:blank");
    });
    exportWindow = await created;
  }
  const file = join(tmpdir(), `scriare-export-${process.pid}-${exportFileCount++}.html`);
  await writeFile(file, html, "utf-8");
  exportTempFiles.push(file);
  await exportWindow.goto(pathToFileURL(file).href);
  return exportWindow;
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
  await mod.default({ page, api, check, seedProject, openExported, app });
}

const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} passed`);
await Promise.all(exportTempFiles.map((file) => rm(file, { force: true }).catch(() => {})));
await app.close();
process.exit(passed === results.length ? 0 : 1);
