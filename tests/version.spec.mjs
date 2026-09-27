/**
 * Which build is this? (v0.63.0)
 *
 * On Windows the app never said. The number existed in the setup wizard,
 * in Apps & features and in package.json — three places a writer does not
 * look — so "the graph jumps when I drag a node" could not be answered
 * with "which version?".
 *
 * The thing this spec is really guarding is not that A number appears. It
 * is that the number is the PACKAGED app's own, asked for at runtime
 * rather than baked into the renderer at build time. A constant compiled
 * into the bundle looks identical on screen and is wrong the first time
 * somebody bumps one file and not the other — which is exactly the failure
 * a version display exists to prevent. So the middle check here moves what
 * the main process answers and demands the screen move with it.
 */
export default async function run({ page, api, check, seedProject, app }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // The tag lives on the Welcome screen — the one screen every session
  // starts on — so the spec has to be there to see it.
  const showWelcome = async () => {
    await api(() => {
      window.__scriareProjectStore.setState({ project: null, filePath: null });
    });
    await wait(350);
  };

  const tagText = () =>
    page.evaluate(() => {
      const el = document.querySelector("[data-version-tag]");
      return el ? el.textContent.trim() : null;
    });

  await showWelcome();

  // ── it is the app's own version ──────────────────────────────────────
  const real = await app.evaluate(({ app: electronApp }) => electronApp.getVersion());
  const shown = await tagText();

  // Found by accident and kept on purpose. Electron answers "0.0" when it
  // has no package.json to read — which is what the suite's own launcher
  // was doing until v0.63.0 (see tests/run.mjs). A screen that faithfully
  // prints a fallback is the failure this whole file exists to catch, and
  // it looks exactly like success unless somebody says what a version is
  // supposed to look like.
  check(
    "the app knows its own version at all, rather than falling back",
    /^\d+\.\d+\.\d+/.test(real),
    `app.getVersion() is ${JSON.stringify(real)}`,
  );

  check(
    "the Welcome screen prints the version the app was packaged with",
    shown === real,
    `screen says ${JSON.stringify(shown)}, app.getVersion() is ${JSON.stringify(real)}`,
  );

  // ── ...asked for, not baked in ───────────────────────────────────────
  // The only difference between a version read at runtime and one compiled
  // into the bundle is what happens when they disagree — and they only
  // disagree on a day nobody is looking. So make them disagree now: the
  // main process answers something no build could ever have been stamped
  // with, and the screen is expected to say it.
  await app.evaluate(({ ipcMain }) => {
    globalThis.__realVersionHandler = ipcMain._invokeHandlers.get("app:version");
    ipcMain.removeHandler("app:version");
    ipcMain.handle("app:version", () => "1.2.3-probe");
  });

  await page.reload();
  await page.waitForFunction(() => Boolean(window.__scriareProjectStore), null, { timeout: 15000 });
  await showWelcome();

  const followed = await tagText();
  check(
    "the number on screen comes from the app, not from the bundle",
    followed === "1.2.3-probe",
    `screen says ${JSON.stringify(followed)} when the app answers "1.2.3-probe"`,
  );

  await app.evaluate(({ ipcMain }) => {
    ipcMain.removeHandler("app:version");
    ipcMain.handle("app:version", globalThis.__realVersionHandler);
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__scriareProjectStore), null, { timeout: 15000 });
  await showWelcome();

  check(
    "...and it is back to the real one",
    (await tagText()) === real,
    `${JSON.stringify(await tagText())}`,
  );

  // ── clicking it copies more than it shows ────────────────────────────
  // The visible tag is short because a writer has to read it; a bug report
  // is more useful with the platform and the engine underneath, and nobody
  // types those out. Both halves of that are assertions: the line has to
  // carry the extra parts, and it has to actually reach the clipboard.
  await app.evaluate(({ clipboard }) => clipboard.writeText("scriare-clipboard-was-not-written"));

  // Defensively — a control that is missing must FAIL this spec, not crash
  // it. A crash tells a control nothing (v0.60.0).
  const tag = await page.$("[data-version-tag]");
  check("the version is a control you can click", Boolean(tag));
  if (tag) await tag.click();
  await wait(400);

  const copied = await app.evaluate(({ clipboard }) => clipboard.readText());

  check(
    "clicking it puts the version on the clipboard",
    typeof copied === "string" && copied.includes(real),
    JSON.stringify(copied),
  );
  check(
    "...along with the platform and the engine, which is what a report needs",
    typeof copied === "string" &&
      copied.includes(process.platform) &&
      /Electron \d/.test(copied) &&
      /Chromium \d/.test(copied),
    JSON.stringify(copied),
  );
  // Read off the TOAST, not off the page. `document.body.innerText` would
  // pass on any screen that happens to contain the word somewhere, which
  // is a check that cannot go red for the right reason.
  const notice = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".scriare-toast"))
      .map((el) => el.textContent.trim())
      .join(" | "),
  );
  check(
    "...and it says so, so the writer knows the click did something",
    /copied/i.test(notice),
    JSON.stringify(notice) || "no toast was on screen",
  );

  // ── put it back ──────────────────────────────────────────────────────
  await seedProject();
  await wait(200);
  check(
    "the workspace is handed back to the next spec",
    await api(() => Boolean(window.__scriareProjectStore.getState().project)),
  );
}
