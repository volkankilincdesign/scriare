import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * Double-clicking a story (v0.61.0).
 *
 * The installer registers `.scriare` with Windows; this is the half that
 * makes that worth anything. Windows launches the app with the path on its
 * command line, or — when a copy is already running — launches a second
 * one, which is the case an app has to handle explicitly or the double
 * click does nothing.
 *
 * The packaged installer cannot be built here (it needs Windows or wine),
 * so what is tested is everything up to it: the rule that finds a story in
 * a command line, the REAL `second-instance` handler driven by emitting the
 * event Electron itself emits, and what the renderer does with the story
 * that is already open.
 */
export default async function run({ api, check, seedProject, app }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ── the rule ──────────────────────────────────────────────────────────
  const argvCases = await api(() => {
    const { projectFileFromArgv } = window.__scriareFileArgs;
    return {
      packaged: projectFileFromArgv(["C:\\Users\\v\\Scriare.exe", "C:\\Stories\\Ledger.scriare"]),
      dev: projectFileFromArgv(["/usr/bin/electron", ".", "/tmp/Ledger.scriare"]),
      none: projectFileFromArgv(["C:\\Users\\v\\Scriare.exe"]),
      // Chromium and Electron pass plenty of switches, and one of them will
      // eventually end in something that looks like a path.
      switches: projectFileFromArgv([
        "Scriare.exe",
        "--user-data-dir=C:\\temp\\x.scriare",
        "C:\\Stories\\Real.scriare",
      ]),
      // ...and the case that actually bites: the switch is there and no
      // story is. Scanning from the end finds the switch first, so without
      // the filter this launch opens a path Chromium invented.
      switchOnly: projectFileFromArgv(["Scriare.exe", "--user-data-dir=C:\\temp\\x.scriare"]),
      // Scanned from the end: a portable build sits in a folder that may
      // well contain a story of its own.
      lastWins: projectFileFromArgv(["Scriare.exe", "C:\\app\\bundled.scriare", "C:\\b\\opened.scriare"]),
      upper: projectFileFromArgv(["Scriare.exe", "C:\\Stories\\LEDGER.SCRIARE"]),
      other: projectFileFromArgv(["Scriare.exe", "C:\\Stories\\notes.txt"]),
      // The executable itself is never the answer, whatever it is called.
      exeNamed: projectFileFromArgv(["C:\\odd\\Scriare.scriare"]),
    };
  });

  check(
    "a story on the command line is found — packaged, and in development",
    argvCases.packaged === "C:\\Stories\\Ledger.scriare" && argvCases.dev === "/tmp/Ledger.scriare",
    JSON.stringify([argvCases.packaged, argvCases.dev]),
  );
  check(
    "an ordinary launch finds nothing",
    argvCases.none === null && argvCases.other === null,
    JSON.stringify([argvCases.none, argvCases.other]),
  );
  check(
    "a switch that happens to end in .scriare is not a story",
    argvCases.switches === "C:\\Stories\\Real.scriare" && argvCases.switchOnly === null,
    JSON.stringify([argvCases.switches, argvCases.switchOnly]),
  );
  check(
    "the last one wins — a story beside the executable is not the one being opened",
    argvCases.lastWins === "C:\\b\\opened.scriare",
    String(argvCases.lastWins),
  );
  check(
    "the extension is matched whatever its case, and argv[0] is never it",
    argvCases.upper === "C:\\Stories\\LEDGER.SCRIARE" && argvCases.exeNamed === null,
    JSON.stringify([argvCases.upper, argvCases.exeNamed]),
  );

  // ── one copy of the app ───────────────────────────────────────────────
  check(
    "the app holds the single-instance lock — a second launch cannot open a second window",
    // Two windows over one recent-projects file, each with its own autosave
    // timer, is the situation save-safety was written to make impossible.
    await app.evaluate(({ app }) => app.hasSingleInstanceLock()),
  );

  // ── the real handler, with a real story on disk ───────────────────────
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "scriare-open-"));
  const file = path.join(dir, "What the Ledger Says.scriare");
  const now = new Date().toISOString();
  await fs.writeFile(
    file,
    JSON.stringify({
      name: "What the Ledger Says",
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

  await seedProject();
  await wait(200);

  /**
   * A second window, made deliberately.
   *
   * The app's handler has to send the double-click to ITS OWN window, and
   * with only one window on screen any implementation looks correct —
   * including `getAllWindows()[0]`, which is what this was at first. The
   * full suite caught it, because the export spec opens a window to read
   * an exported story and that window is index 0 from then on. Creating
   * the hazard here means this spec fails on its own rather than
   * depending on the order the suite happens to run in.
   */
  const extraWindow = await app.evaluate(({ BrowserWindow }) => {
    const win = new BrowserWindow({ show: false, width: 400, height: 300 });
    return win.id;
  });

  /** Emit exactly what Electron emits when a second copy is launched. */
  const secondInstance = (argv) =>
    app.evaluate(({ app }, args) => app.emit("second-instance", {}, args), argv);

  await secondInstance(["C:\\Users\\v\\Scriare.exe", file]);
  await wait(900);

  const opened = await api(() => {
    const s = window.__scriareProjectStore.getState();
    return { name: s.project?.name ?? null, filePath: s.filePath, scene: s.selectedSceneId };
  });
  check(
    "double-clicking a story while the app is running opens it",
    opened.name === "What the Ledger Says" && opened.filePath === file,
    JSON.stringify(opened),
  );

  // ── the story that was already open ───────────────────────────────────
  const flushed = await api(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    const store = window.__scriareProjectStore;
    // Type into the open story, so there is unsaved work to lose.
    store.setState({ saveStatus: "unsaved" });
    await w(60);
    return store.getState().saveStatus;
  });
  check("...and the one that was open had unsaved work to protect", flushed === "unsaved");

  const beforeAgain = await api(() => ({
    filePath: window.__scriareProjectStore.getState().filePath,
    token: window.__scriareProjectStore.getState().documentToken,
  }));
  await secondInstance(["Scriare.exe", file]);
  await wait(500);
  const afterAgain = await api(() => {
    const s = window.__scriareProjectStore.getState();
    return { filePath: s.filePath, token: s.documentToken, status: s.saveStatus };
  });
  check(
    "opening the story that is already open does nothing — no reload, no flush",
    // The document token is what forces the editor to reload; if this
    // route had gone through close-and-open it would have moved, and the
    // unsaved status would have been flushed away with it.
    afterAgain.filePath === beforeAgain.filePath &&
      afterAgain.token === beforeAgain.token &&
      afterAgain.status === "unsaved",
    JSON.stringify(afterAgain),
  );

  // ── the one request that is refused ───────────────────────────────────
  const refused = await api(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    const store = window.__scriareProjectStore;
    window.__scriareToastStore.setState({ toasts: [] });
    store.setState({
      saveConflict: { filePath: store.getState().filePath, found: { mtimeMs: 1, size: 1 } },
    });
    await w(120);
    return store.getState().filePath;
  });

  const other = path.join(dir, "Another.scriare");
  await fs.copyFile(file, other);
  await secondInstance(["Scriare.exe", other]);
  await wait(700);

  const afterConflict = await api(() => ({
    filePath: window.__scriareProjectStore.getState().filePath,
    notices: window.__scriareToastStore.getState().toasts.map((t) => t.message),
  }));
  check(
    "a story is NOT opened over an unanswered conflict — that would throw the work away",
    // Flushing is impossible in this state by definition: the file
    // underneath changed, so `saveNow` returns early rather than overwrite
    // it, and closing would discard everything written since.
    afterConflict.filePath === refused,
    `${afterConflict.filePath === refused ? "kept" : "replaced"} the open story`,
  );
  check(
    "...and the writer is told why nothing happened",
    afterConflict.notices.some((m) => /conflict/i.test(m)),
    JSON.stringify(afterConflict.notices),
  );

  // ── the launch route ──────────────────────────────────────────────────
  const pending = await app.evaluate(async ({ ipcMain }) => {
    // The renderer asks once, on mount. Asking twice must not reopen a file
    // the writer has since closed — so the answer is cleared as it is given.
    const handler = ipcMain._invokeHandlers?.get("app:pendingOpen");
    if (!handler) return { missing: true };
    const first = await handler({}, undefined);
    const second = await handler({}, undefined);
    return { first, second };
  });
  check(
    // What this proves is the SHAPE: the handler exists, an ordinary
    // launch has nothing pending, and asking twice is safe — which is what
    // a reload does. That the path arrives at all on a real double-click
    // is the argv rule above plus Windows, and the only way to see the
    // whole route is to launch the packaged app with a story. That check
    // is his, on Windows, and it is on the list.
    "an ordinary launch has no story waiting, and asking twice is safe",
    pending.missing !== true && pending.first === null && pending.second === null,
    JSON.stringify(pending),
  );

  // ── put it back ───────────────────────────────────────────────────────
  await app.evaluate(({ BrowserWindow }, id) => {
    const win = BrowserWindow.fromId(id);
    if (win && !win.isDestroyed()) win.destroy();
  }, extraWindow);
  await api(() => {
    window.__scriareProjectStore.setState({ saveConflict: null });
    window.__scriareToastStore.setState({ toasts: [] });
  });
  await seedProject();
  await fs.rm(dir, { recursive: true, force: true });
  await wait(200);
  check(
    "the workspace is handed back to the next spec",
    await api(() => Boolean(window.__scriareProjectStore.getState().project)),
  );
}
