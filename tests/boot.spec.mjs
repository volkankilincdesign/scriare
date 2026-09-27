import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * What the app shows first (v0.62.0).
 *
 * Reported with two screenshots: opening a `.scriare` flashed the empty
 * "no stories yet" Welcome before the story appeared, and so did an
 * ordinary launch before the shelf. Both are the renderer painting its
 * default while the answer was still coming over IPC, and the default is
 * the one screen that tells a returning writer they have nothing.
 *
 * A claim about a FLASH cannot be tested by looking afterwards — by then
 * the wrong screen has been and gone. So this records every screen that
 * appears, from before the first script runs, and then asks what the app
 * showed. The recorder is installed with `addInitScript`, which survives
 * the reload; `data-screen` and `data-welcome` are set by the app itself.
 */
export default async function run({ page, api, check, seedProject, app }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  await page.addInitScript(() => {
    window.__bootTrace = [];
    const record = () => {
      const el = document.querySelector("[data-screen]");
      const screen = el?.getAttribute("data-screen") ?? null;
      const welcome = el?.getAttribute("data-welcome") ?? null;
      const entry = welcome ? `${screen}:${welcome}` : screen;
      if (!entry) return;
      const trace = window.__bootTrace;
      if (trace[trace.length - 1] !== entry) trace.push(entry);
    };
    // Every mutation, from the first one: a frame that exists for 16ms is
    // exactly the frame being complained about.
    // Observing `document` rather than `document.documentElement`: an init
    // script runs at document-start, where documentElement can still be
    // null — and `observe(null)` throws, which is how the first version of
    // this recorder silently recorded nothing at all.
    new MutationObserver(record).observe(document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-screen", "data-welcome"],
    });
    document.addEventListener("DOMContentLoaded", record);
  });

  const traceAfterReload = async () => {
    await page.reload();
    await page.waitForFunction(() => Boolean(window.__scriareProjectStore), null, { timeout: 15000 });
    await page.waitForFunction(
      () => (window.__bootTrace ?? []).some((s) => s !== "booting"),
      null,
      { timeout: 15000 },
    );
    await wait(400);
    return api(() => window.__bootTrace.slice());
  };

  // ── a story on disk, and a recent list that is not empty ─────────────
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "scriare-boot-"));
  const file = path.join(dir, "The Long Hall.scriare");
  const now = new Date().toISOString();
  await fs.writeFile(
    file,
    JSON.stringify({
      name: "The Long Hall",
      createdAt: now,
      updatedAt: now,
      scenes: [
        {
          id: "s1",
          title: "The Long Hall",
          order: 0,
          position: { x: 0, y: 0 },
          content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "He counted it again." }] }] },
        },
      ],
      content: [{ id: "s1", kind: "leaf", category: "story", parentId: null, order: 0, refType: "scene" }],
      favorites: [],
      variables: [],
      entities: [],
      startSceneId: "s1",
    }),
    "utf-8",
  );

  // The precondition this whole spec rests on: if Recent Projects were
  // empty, "the empty Welcome never appeared" would be true for the wrong
  // reason. Stated as a check rather than assumed.
  const recents = await api(
    async (p) => (await window.api.recent.touch(p, { name: "The Long Hall" })) ?? [],
    file,
  );
  check(
    "there are stories in Recent Projects — otherwise the empty screen is the right one",
    Array.isArray(recents) && recents.length > 0,
    `${recents.length} recent`,
  );

  // ── an ordinary launch ───────────────────────────────────────────────
  const ordinary = await traceAfterReload();

  check(
    "the app opens on a splash, not on its default screen",
    ordinary[0] === "booting",
    JSON.stringify(ordinary),
  );
  check(
    "THE EMPTY WELCOME IS NEVER PAINTED when the writer has stories",
    // The bug, exactly: `welcome:empty` for one frame, on the screen that
    // says you have nothing, to somebody who does not.
    !ordinary.includes("welcome:empty"),
    JSON.stringify(ordinary),
  );
  check(
    "...and what it settles on is the shelf",
    ordinary[ordinary.length - 1] === "welcome:stories",
    JSON.stringify(ordinary),
  );

  // ── the same launch, on a slow disk ──────────────────────────────────
  // On this machine the recent list comes back in a millisecond, so the
  // race the `await` in useBoot exists for never happens — which means a
  // version that forgot the `await` would pass. So the race is created:
  // the real handler is wrapped in a delay, exactly as a large recent file
  // on a slow or synced disk would be, and the trace is read again.
  await app.evaluate(({ ipcMain }) => {
    const original = ipcMain._invokeHandlers.get("recent:list");
    // The main process is Node, not a browser: stash it on globalThis.
    globalThis.__realRecentList = original;
    ipcMain.removeHandler("recent:list");
    ipcMain.handle("recent:list", async (...args) => {
      await new Promise((r) => setTimeout(r, 400));
      return original(...args);
    });
  });

  const slow = await traceAfterReload();

  check(
    "...and it still never paints the empty screen when the list is slow to arrive",
    !slow.includes("welcome:empty") && slow[slow.length - 1] === "welcome:stories",
    JSON.stringify(slow),
  );
  check(
    "...having sat on the splash while it waited",
    slow[0] === "booting" && slow.length === 2,
    JSON.stringify(slow),
  );

  await app.evaluate(({ ipcMain }) => {
    ipcMain.removeHandler("recent:list");
    ipcMain.handle("recent:list", globalThis.__realRecentList);
  });

  // ── launched by double-clicking a story ──────────────────────────────
  // The main process clears the pending path as it hands it over, so the
  // only way to drive the launch route twice is to answer that question
  // again — which is what Windows does when it starts the app with a path.
  await app.evaluate(({ ipcMain }, pending) => {
    ipcMain.removeHandler("app:pendingOpen");
    let handed = false;
    ipcMain.handle("app:pendingOpen", () => {
      if (handed) return null;
      handed = true;
      return pending;
    });
  }, file);

  const launched = await traceAfterReload();

  check(
    "a story waiting at launch opens without the Welcome appearing at all",
    !launched.some((screen) => screen.startsWith("welcome")) &&
      launched[launched.length - 1] === "editor",
    JSON.stringify(launched),
  );
  check(
    "...and it is that story",
    await api(() => window.__scriareProjectStore.getState().project?.name ?? null),
  );

  // ── put it back ──────────────────────────────────────────────────────
  await app.evaluate(({ ipcMain }) => {
    ipcMain.removeHandler("app:pendingOpen");
    ipcMain.handle("app:pendingOpen", () => null);
  });
  await api((p) => window.api.recent.remove(p), file);
  await fs.rm(dir, { recursive: true, force: true });
  await seedProject();
  await wait(200);
  check(
    "the workspace is handed back to the next spec",
    await api(() => Boolean(window.__scriareProjectStore.getState().project)),
  );
}
