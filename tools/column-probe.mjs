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
  const w=(ms)=>new Promise(r=>setTimeout(r,ms));
  const p = window.__scriareProjectTypes.normalizeProject(JSON.parse(j));
  window.__scriareProjectStore.setState({ project: p, filePath: null, saveStatus: "saved" });
  await w(400); window.__scriareProjectStore.getState().selectScene(p.scenes[0].id); await w(300);
}, raw);
for (const [w,h] of [[1920,1080],[1680,1050],[1440,900],[1366,768],[1280,860],[1024,720]]) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const band = document.querySelector(".scriare-graph-band");
    const col = band?.parentElement;
    return {
      column: col ? Math.round(col.getBoundingClientRect().height) : null,
      band: band ? Math.round(band.getBoundingClientRect().height) : null,
    };
  });
  const pct = r.band && r.column ? Math.round((r.band / r.column) * 100) : null;
  console.log(`${w}x${h}  column ${r.column}  graph ${r.band}  = ${pct}% of the column`);
}
await app.close();
