import { _electron } from "playwright-core";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The repository root, resolved from this file rather than hardcoded. These
// three probes carried an absolute path to the container they were first
// written in, so they ran on exactly one machine and nobody else's — this
// repository's owner included. Caught while auditing for a public push.
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const app = await _electron.launch({
  executablePath: join(root, "node_modules/electron/dist/electron"), args: [root], cwd: root,
});
const page = await app.firstWindow();
await page.waitForTimeout(2500);
const raw = await readFile(join(root, "tests/fixtures/feature-tour.scriare"), "utf-8");
await page.evaluate(async (j) => {
  const w = (ms)=>new Promise(r=>setTimeout(r,ms));
  const p = window.__scriareProjectTypes.normalizeProject(JSON.parse(j));
  window.__scriareProjectStore.setState({ project: p, filePath: null, saveStatus: "saved" });
  await w(400);
  window.__scriareProjectStore.getState().selectScene(p.scenes[0].id);
  await w(400);
}, raw);
for (const w of [1680, 1440, 1366, 1280, 1152, 1024]) {
  await page.setViewportSize({ width: w, height: 860 });
  await page.waitForTimeout(450);
  const r = await page.evaluate(() => {
    const bar = document.querySelector(".scriare-toolbar") ||
      document.querySelector('[data-toolbar]') ||
      [...document.querySelectorAll("div")].find(d => d.querySelector('[title*="Choice"],[data-insert-choice]') && d.className.includes("flex"));
    if (!bar) return { rows: null };
    const kids = [...bar.children].filter(k => k.getBoundingClientRect().height > 0);
    const tops = [...new Set(kids.map(k => Math.round(k.getBoundingClientRect().top)))];
    return { rows: tops.length, height: Math.round(bar.getBoundingClientRect().height), tops };
  });
  console.log(w, JSON.stringify(r));
}
await app.close();
