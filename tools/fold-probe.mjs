import { _electron } from "playwright-core";
import { readFile } from "node:fs/promises";
const app = await _electron.launch({
  executablePath: "node_modules/electron/dist/electron",
  args: ["/root/scriare"], cwd: "/root/scriare",
});
const page = await app.firstWindow();
await page.waitForTimeout(2500);
const raw = await readFile("/root/scriare/tests/fixtures/feature-tour.scriare", "utf-8");
await page.evaluate(async (json) => {
  const w = (ms) => new Promise(r => setTimeout(r, ms));
  const p = window.__scriareProjectTypes.normalizeProject(JSON.parse(json));
  window.__scriareProjectStore.setState({ project: p, filePath: null, saveStatus: "saved" });
  await w(400);
}, raw);
const expand = page.locator('[title="Expand Story Graph"]');
if (await expand.count()) { await expand.first().click(); await page.waitForTimeout(800); }

const count = () => page.evaluate(() => ({
  nodes: document.querySelectorAll(".react-flow__node").length,
  scenes: document.querySelectorAll('.react-flow__node[data-id]:not([data-id^="g"])').length,
  edges: document.querySelectorAll(".react-flow__edge").length,
  groups: window.__scriareGroupUtils.graphGroups(
    window.__scriareProjectStore.getState().project.content,
    window.__scriareProjectStore.getState().project.scenes).length,
  hidden: window.__scriareGroupUtils.graphGroups(
    window.__scriareProjectStore.getState().project.content,
    window.__scriareProjectStore.getState().project.scenes).filter(g=>g.hidden).length,
  collapsed: window.__scriareGroupUtils.graphGroups(
    window.__scriareProjectStore.getState().project.content,
    window.__scriareProjectStore.getState().project.scenes).filter(g=>g.collapsed).length,
}));
console.log("open  :", JSON.stringify(await count()));
await page.evaluate(() => {
  const s = window.__scriareProjectStore.getState();
  const gs = window.__scriareGroupUtils.graphGroups(s.project.content, s.project.scenes);
  gs.forEach(g => s.toggleFolderCollapsed(g.id));
});
await page.waitForTimeout(900);
console.log("folded:", JSON.stringify(await count()));
await app.close();
