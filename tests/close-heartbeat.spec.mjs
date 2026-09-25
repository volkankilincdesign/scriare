/**
 * The close handshake's give-up timer, and why it is a liveness check
 * rather than a deadline (v0.49.1).
 *
 * v0.49.0 destroyed the window four seconds after asking the renderer to
 * get ready. The one question this app asks — "close without saving?",
 * about an hour of work — resolves when the writer clicks it, and a flush
 * to a synced folder can take longer than four seconds on its own
 * (v0.47.0 added EPERM/EBUSY retries precisely because sync clients hold
 * files open). So reading the question carefully was the failure mode.
 *
 * The renderer now pulses while it works and the timer restarts on each
 * pulse, so what it measures is what it was always for: a renderer that
 * has stopped responding cannot make the window unclosable.
 *
 * ITS OWN FILE, because it counts messages arriving in the MAIN process
 * while the renderer sits on an open question — a different process
 * boundary and a different setup from writing files and closing projects.
 *
 * It began as the second half of close-safety.spec.mjs, where it failed
 * with zero heartbeats, correct store state and no error. The cause was
 * not the close path at all: that file's earlier block closed the project
 * and the next block spread the resulting `null` into a new one, so the
 * store held a project with no scenes and the renderer was in no state to
 * run anything. The same bad fixture then broke every spec that ran after
 * it. Both are fixed there; the split stays because it is the right shape.
 */
export default async function run({ page, api, app, check, seedProject }) {
  /* ── 2. the renderer keeps saying it is alive ─────────────────── */

  // Counted in the MAIN process, where the give-up timer lives, because
  // that is the only place the answer means anything. The renderer is held
  // busy the way a real close holds it: on the unanswered question.
  await app.evaluate(({ ipcMain }) => {
    globalThis.__scriareBeats = 0;
    globalThis.__scriareBeatListener = () => {
      globalThis.__scriareBeats += 1;
    };
    ipcMain.on("app:closing-heartbeat", globalThis.__scriareBeatListener);
  });

  // A REAL project, seeded again. The first version of this section built
  // one by spreading `store.getState().project` — which is null by now,
  // because the block above closed it — so it set a `{name}` object with no
  // scenes, the app rendered the Welcome screen over the top, and no
  // question ever appeared. The check went red for a reason that had
  // nothing to do with the close path: my fixture, not the app.
  await seedProject();
  await api(async (filePath) => {
    const store = window.__scriareProjectStore;
    store.setState({
      filePath,
      saveStatus: "unsaved",
      saveConflict: { filePath, found: { mtimeMs: 1, size: 1 } },
    });
  }, "/tmp/scriare-heartbeat-probe.scriare");


  // The real signal the main process sends, so the real handler runs.
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.webContents.send("app:before-close");
  });

  await page.waitForTimeout(300);
  const questionShown = await page.evaluate(() =>
    Boolean(
      [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Close anyway"),
    ),
  );
  check("closing with an unanswered conflict asks before discarding", questionShown);

  // Sit on the question the way a person reading it would — past the
  // four seconds that used to destroy the window underneath them.
  await page.waitForTimeout(4600);

  const beats = await app.evaluate(() => globalThis.__scriareBeats);
  check(
    "the renderer keeps reporting it is alive while the question is open",
    beats >= 4,
    `${beats} beats in 4.9s (one per second expected)`,
  );

  // The window must also still be there — the point of the whole change.
  const stillOpen = await app.evaluate(
    ({ BrowserWindow }) => BrowserWindow.getAllWindows().length > 0 && !BrowserWindow.getAllWindows()[0].isDestroyed(),
  );
  check("and the window is still open past the old four-second deadline", stillOpen);

  // Answer it, so nothing is left hanging for the specs that follow.
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Go back")?.click();
  });
  await page.waitForTimeout(200);

  const beatsAfter = await app.evaluate(() => globalThis.__scriareBeats);
  await page.waitForTimeout(1500);
  const beatsLater = await app.evaluate(() => globalThis.__scriareBeats);
  check(
    "and it stops pulsing once the answer is given",
    beatsLater === beatsAfter,
    `${beatsAfter} → ${beatsLater}`,
  );

  await app.evaluate(({ ipcMain }) => {
    ipcMain.off("app:closing-heartbeat", globalThis.__scriareBeatListener);
    delete globalThis.__scriareBeats;
    delete globalThis.__scriareBeatListener;
  });

  await api(() => {
    window.__scriareProjectStore.setState({ saveConflict: null, saveStatus: "saved" });
  });
}
