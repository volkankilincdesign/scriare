import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * How much work a crash can actually take (v0.86.0's measurement).
 *
 * THIS SPEC EXISTS BEFORE THE FEATURE DOES, and that order is the point. The
 * roadmap has carried crash-recovery drafts since v0.47.0 with one sentence
 * attached — "only worth it if he ever loses something to a power cut that
 * the atomic write couldn't catch" — which is a condition nobody has
 * measured. v0.51.0's lesson applies: the audit named three hot paths, one
 * did not exist, one cost nothing, and the real bottleneck was not on the
 * list. A journal is a feature with a file format and a restore dialog, and
 * building one to close a window that is 1.5 seconds wide would be a week
 * spent on a rounding error.
 *
 * So: what is the exposure, in seconds and in keystrokes, in each state the
 * save machine can be in? Everything here is REPORTED. The only assertions
 * are the ones that would be defects whatever the answer — that the normal
 * window is bounded at all, and that the app never reaches a state where it
 * silently stops trying.
 */
export default async function run({ api, check, seedProject, app }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const say = (line) => console.log(`  · ${line}`);

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "scriare-crash-"));
  const file = path.join(dir, "Exposure.scriare");

  /* ── 1 · the ordinary case ─────────────────────────────────────────── */

  // A real project on disk, opened the way the app opens one, so the store
  // holds a genuine path and stamp rather than a hand-set pair.
  //
  // WRITTEN WITH fs, NOT `project.create`. That IPC call takes a project
  // NAME and puts up a save dialog to choose where — which a headless run
  // cannot answer, so the first version of this spec hung there with no
  // output at all. The save-safety spec had already settled the pattern:
  // put a file on disk, then open it by path.
  const seed = await api(() =>
    JSON.stringify(window.__scriareProjectTypes.buildProject("Exposure"), null, 2),
  );
  await fs.writeFile(file, seed, "utf-8");
  await api(async (p) => {
    await window.__scriareProjectStore.getState().openRecentProject(p);
  }, file);
  await wait(400);

  const opened = await api(() => {
    const s = window.__scriareProjectStore.getState();
    return { path: s.filePath, status: s.saveStatus, name: s.project?.name ?? null };
  });
  check(
    "a real project is open on disk to measure against",
    opened.path !== null && opened.name === "Exposure",
    `${opened.name} · ${opened.status}`,
  );

  // ONE EDIT, THEN WATCH THE DISK. The window is "a change exists in memory
  // and not in the file", which is exactly the work a crash would take, and
  // it is measured by reading the file rather than by trusting the status
  // bar — the status bar was wrong about this twice before v0.49.0.
  const onDisk = () =>
    fs
      .readFile(file, "utf-8")
      .then((raw) => JSON.parse(raw).scenes?.[0]?.title ?? null)
      .catch(() => null);

  const marker = `edited-${Date.now()}`;
  const t0 = Date.now();
  await api((title) => {
    const store = window.__scriareProjectStore.getState();
    store.renameScene(store.project.scenes[0].id, title);
  }, marker);

  let landed = null;
  for (let i = 0; i < 60; i += 1) {
    if ((await onDisk()) === marker) {
      landed = Date.now() - t0;
      break;
    }
    await wait(100);
  }
  say(`ordinary edit → on disk in ${landed === null ? "NEVER (6s)" : `${landed} ms`}`);
  check(
    "an ordinary edit reaches the disk on its own, without being asked",
    landed !== null,
    landed === null ? "not written within 6 seconds" : `${landed} ms`,
  );
  // A BOUND, not a number. The autosave delay is 1.5s by design and the
  // write itself is a few ms, so anything under about three seconds is the
  // designed behaviour; what would be a defect is an edit that needs a
  // Ctrl+S to survive.
  check(
    "...and the window it is exposed for is seconds, not minutes",
    landed !== null && landed < 4000,
    `${landed} ms`,
  );

  /* ── 2 · while the disk refuses ────────────────────────────────────── */

  // THE STATE THE JOURNAL WOULD BE FOR, and the one nobody has measured. A
  // save that fails leaves the work in memory, says so once, and drops the
  // retry queue — so the writer carries on and every later autosave fails
  // the same way in silence. How much can pile up?
  //
  // FAILED AT THE FILESYSTEM, NOT AT THE BRIDGE, and it took two attempts to
  // find a failure this container can actually produce.
  //
  // The first version reassigned `window.api.project.save` to throw,
  // measured "0 save attempts", and reported the app as never retrying —
  // which was a finding about the probe: `contextBridge.exposeInMainWorld`
  // hands the page a FROZEN object, so the assignment did nothing and every
  // save succeeded normally while the check claimed they had all failed.
  //
  // The second made the folder read-only with `chmod 0o500` — and the saves
  // went through anyway, because the suite runs as ROOT, which bypasses
  // permission bits entirely. That is a fact about this container rather
  // than about the app, and it is the kind of thing that would otherwise
  // read as "the guard does not work".
  //
  // So the folder is REMOVED instead. Root cannot write into a directory
  // that does not exist, and "the folder it lives in is gone" is one of the
  // four causes v0.47.0 names — the USB stick pulled out, the sync folder
  // unmounted. Reproduced rather than simulated.
  await fs.rm(dir, { recursive: true, force: true });

  const failing = await api(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    const store = () => window.__scriareProjectStore.getState();
    const titles = [];
    for (let i = 0; i < 4; i += 1) {
      const title = `while-locked-${i}`;
      titles.push(title);
      store().renameScene(store().project.scenes[0].id, title);
      await w(1700);
    }
    return {
      status: store().saveStatus,
      inMemory: store().project.scenes[0].title,
      titles,
      noticeCount: window.__scriareToastStore.getState().toasts.length,
      notice: window.__scriareToastStore.getState().toasts[0]?.message ?? null,
    };
  });

  say(
    `while the folder is gone: ${failing.titles.length} edits held in memory, ` +
      `status "${failing.status}", ${failing.noticeCount} notice(s)`,
  );
  if (failing.notice) say(`the notice reads: "${failing.notice}"`);

  check(
    "a save that cannot be written leaves the story unsaved rather than claiming success",
    failing.status === "unsaved",
    `status "${failing.status}"`,
  );
  // SAID ONCE. Four failures must not be four toasts; v0.47.0 made that
  // true and this is what keeps it true.
  check(
    "...and says so once rather than once per autosave",
    failing.noticeCount === 1,
    `${failing.noticeCount} notice(s) for ${failing.titles.length} edits`,
  );
  check(
    "...and names a cause rather than failing silently",
    typeof failing.notice === "string" && /writable|room|folder|written/.test(failing.notice),
    failing.notice ?? "no notice",
  );
  check(
    "...while the work itself is still in memory, intact",
    failing.inMemory === failing.titles[failing.titles.length - 1],
    `holds "${failing.inMemory}"`,
  );

  // AND IT RECOVERS BY ITSELF when the folder comes back. This is the single
  // most important fact in this area, because it is what decides how big a
  // journal's job would actually be: if the app heals on the next keystroke,
  // the journal is only for the window between the failure and the recovery.
  await fs.mkdir(dir, { recursive: true });
  const recovered = await api(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    const store = () => window.__scriareProjectStore.getState();
    store().renameScene(store().project.scenes[0].id, "after-the-folder-came-back");
    for (let i = 0; i < 40; i += 1) {
      await w(100);
      if (store().saveStatus === "saved") return { status: "saved", waited: i * 100 };
    }
    return { status: store().saveStatus, waited: 4000 };
  });
  say(`folder back → status "${recovered.status}" after ${recovered.waited} ms`);
  check(
    "when the folder comes back, the next edit writes everything that piled up",
    recovered.status === "saved",
    `status ${recovered.status} after ${recovered.waited} ms`,
  );
  const settled = await onDisk();
  check(
    "...and the file holds the newest work, not the oldest",
    settled === "after-the-folder-came-back",
    `disk holds "${settled}"`,
  );

  /* ── 3 · while a conflict is waiting to be answered ───────────────── */

  // The other state where autosave stops: `saveNow` returns early while a
  // conflict stands, by design, because re-asking every 1.5 seconds would
  // make the app unusable behind its own dialog. So the question is whether
  // a writer can keep typing into a document that cannot save — if they can,
  // the exposure here is unbounded and this, not the power cut, is the hole.
  const underConflict = await api(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    const store = () => window.__scriareProjectStore.getState();
    window.__scriareProjectStore.setState({
      saveConflict: { filePath: store().filePath, found: { mtimeMs: Date.now(), size: 1 } },
      saveStatus: "unsaved",
    });
    await w(240);
    // WHAT THIS CAN AND CANNOT SHOW. Calling `renameScene` proves the STORE
    // accepts a change while a conflict stands, which it does — but a writer
    // reaches the store through the editor, and the dialog is modal with a
    // focus trap (v0.50.0). So this measures the store, not the person, and
    // the honest reading is below rather than in a check.
    const before = store().project.scenes[0].title;
    store().renameScene(store().project.scenes[0].id, "typed-behind-the-dialog");
    await w(2200);
    const dialog = document.querySelector('[role="dialog"]');
    const out = {
      storeAccepts: store().project.scenes[0].title !== before,
      status: store().saveStatus,
      modal: Boolean(dialog),
      // The thing that actually decides it: can focus leave the dialog?
      trapped: dialog ? dialog.contains(document.activeElement) : null,
    };
    window.__scriareProjectStore.setState({ saveConflict: null });
    return out;
  });
  say(
    `with a conflict unanswered: the STORE accepts edits = ${underConflict.storeAccepts}, ` +
      `dialog on screen = ${underConflict.modal}, focus held inside it = ${underConflict.trapped}, ` +
      `status "${underConflict.status}"`,
  );
  // THE ONE ASSERTION THIS SECTION CAN HONESTLY MAKE. Whether a writer can
  // type behind the dialog is a question about focus, and v0.50.0 already
  // owns that with a trap and a spec. What belongs here is that the state is
  // not silent: a conflict must leave the app saying "unsaved" rather than
  // "saved", because the status bar is what a writer checks before closing
  // the lid — which is half of why v0.49.0 lost work.
  check(
    "a conflict leaves the app saying unsaved, not saved",
    underConflict.status === "unsaved",
    `status "${underConflict.status}", dialog present ${underConflict.modal}`,
  );

  /* ── 4 · the way out actually writes the story ────────────────── */

  // THE ESCAPE ROUTE, end to end. `saveCopyElsewhere` already existed — it
  // was `resolveConflictSaveCopy`, reachable from exactly one dialog and
  // refusing to run unless a conflict was set. Generalising it is most of
  // what v0.86.0 is, so this checks the thing that was generalised: with no
  // conflict anywhere, a story whose own folder is gone can still be written
  // somewhere that works, and the session continues there.
  // STRANDED AGAIN, because section 3 put the folder back. The rescue is only
  // a rescue when there is nothing to rescue the story to.
  await fs.rm(dir, { recursive: true, force: true });
  await api(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    const store = () => window.__scriareProjectStore.getState();
    store().renameScene(store().project.scenes[0].id, "unsaved-at-close");
    await w(1900);
  });

  const elsewhere = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "scriare-rescue-")), "Rescued.scriare");

  // The save dialog answers with a path instead of a person — the same stub
  // script-export uses, in the MAIN process, because `window.api` is a frozen
  // contextBridge object and cannot be patched from the page (this spec
  // learned that the hard way further up).
  await app.evaluate(({ dialog }, target) => {
    globalThis.__realShowSaveDialog = dialog.showSaveDialog;
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: target });
  }, elsewhere);
  const rescue = await api(async (target) => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    const store = () => window.__scriareProjectStore.getState();
    // The file dialog answers with a path instead of a person. Patched on
    // `window.api` is impossible — it is a frozen contextBridge object — so
    // the main process's own handler is what the test replaces, which is how
    // script-export drives its save dialog too.
    const before = {
      conflict: Boolean(store().saveConflict),
      failed: store().saveFailed,
      path: store().filePath,
    };
    const written = await store().saveCopyElsewhere();
    await w(300);
    return {
      before,
      written,
      pathAfter: store().filePath,
      status: store().saveStatus,
      failedAfter: store().saveFailed,
      movedTo: store().filePath === target,
    };
  }, elsewhere);
  say(
    `rescue: conflict was ${rescue.before.conflict}, saveFailed was ${rescue.before.failed} → ` +
      `written ${rescue.written}, status "${rescue.status}"`,
  );
  await app.evaluate(({ dialog }) => {
    if (globalThis.__realShowSaveDialog) dialog.showSaveDialog = globalThis.__realShowSaveDialog;
  });

  check(
    "the escape route does not need a conflict to exist, only a story with nowhere to go",
    rescue.before.conflict === false && rescue.before.failed === true,
    `conflict ${rescue.before.conflict}, saveFailed ${rescue.before.failed}`,
  );
  check(
    "a story whose own folder is gone can still be written somewhere that works",
    rescue.written === true && rescue.movedTo === true,
    `written ${rescue.written}, now at ${rescue.pathAfter}`,
  );
  check(
    "...and the session continues there, saved rather than still failing",
    rescue.status === "saved" && rescue.failedAfter === false,
    `status "${rescue.status}", saveFailed ${rescue.failedAfter}`,
  );
  const rescued = await fs
    .readFile(elsewhere, "utf-8")
    .then((raw) => JSON.parse(raw).scenes?.[0]?.title ?? null)
    .catch(() => null);
  check(
    "...and the copy on disk holds the work that had nowhere to go",
    rescued === "unsaved-at-close",
    `the copy holds "${rescued}"`,
  );

  /* ── 5 · closing while the disk refuses ───────────────────────────── */

  // THE ONE PLACE WORK COULD ACTUALLY VANISH, and the reason this spec goes
  // one step past "how long is the window". A crash is rare; closing the app
  // is something a writer does every day, and v0.49.1 found two ways the
  // close path could discard a save it believed it had waited for. If the
  // close flush fails and the app clears the project anyway, the work is
  // gone with no crash involved at all — and that would be a defect to fix
  // today rather than a journal to build later.
  // The story is now safely in the rescue copy, so strand it ONE more time —
  // the close question is about a story that cannot be written, and after the
  // rescue this one can.
  await fs.rm(path.dirname(elsewhere), { recursive: true, force: true });
  const closing = await api(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    const store = () => window.__scriareProjectStore.getState();
    store().renameScene(store().project.scenes[0].id, "unsaved-at-close");
    await w(1800);
    const beforeStatus = store().saveStatus;
    // NOT AWAITED. The close now asks a question, so awaiting it here would
    // wait for an answer nobody is going to give — which is the correct
    // behaviour and would hang the spec. The question is what is being
    // measured, so the call is left in flight and the screen is read.
    void store().closeProject();
    await w(500);
    const dialog = document.querySelector('[role="dialog"]');
    return {
      beforeStatus,
      projectAfter: store().project === null,
      asked: Boolean(dialog),
      dialogText: dialog ? (dialog.textContent || "").replace(/\s+/g, " ") : "",
      answers: dialog
        ? [...dialog.querySelectorAll("button")].map((b) =>
            (b.textContent || "").trim().split("\n")[0].slice(0, 28),
          )
        : [],
      noticeCount: window.__scriareToastStore.getState().toasts.length,
      notices: window.__scriareToastStore.getState().toasts.map((t) => t.message),
    };
  });

  say(
    `closing with nowhere to save: status before "${closing.beforeStatus}", ` +
      `project cleared = ${closing.projectAfter}, ${closing.noticeCount} notice(s)`,
  );
  closing.notices.forEach((n) => say(`  "${n}"`));

  check(
    "closing with a failing disk does not pretend the work was saved",
    closing.beforeStatus !== "saved",
    `status was "${closing.beforeStatus}" at the moment of closing`,
  );
  // THE DEFECT, AND THE FIX (v0.86.0). Before this version the close went
  // straight through and cleared the project, while the notice on screen
  // said the work was still open. It asks now, and the question is the thing
  // asserted: the project must still be here, unanswered, because a question
  // nobody answered cannot have discarded anything.
  check(
    "...and does not discard it without asking",
    closing.projectAfter === false,
    closing.projectAfter ? "the project was cleared with no question" : "the project is still open",
  );
  check(
    "...it asks, and the question is on screen",
    closing.asked === true && closing.dialogText.includes("couldn’t be saved"),
    closing.dialogText.slice(0, 80) || "no dialog",
  );
  // EVERY ANSWER IS AN EXIT. A dialog raised at the moment someone is trying
  // to leave has to offer a way out, or it is the trap useCloseGuard's own
  // comment warned about — so the three answers are named and counted.
  check(
    "...and every answer it offers is a way out",
    closing.answers.length === 3,
    closing.answers.join(" · "),
  );

  /* ── hand the app back, with nothing left on screen ───────────────── */

  // THE QUESTION IS STILL UP. This spec deliberately left a `closeProject`
  // in flight waiting for an answer, which is the one thing a spec must not
  // hand to the next one — v0.84.0 spent four specs chasing a Stylesheet
  // dialog that rode down the run exactly this way. Answered "keep writing"
  // rather than "close", because that is the answer that leaves the store
  // holding a project this teardown can then replace cleanly.
  await api(() => {
    window.__scriareSaveFailedPrompt?.getState?.().resolve?.(false);
  });
  await wait(250);
  const handedBack = await api(() => ({
    dialog: Boolean(document.querySelector('[role="dialog"]')),
    pending: Boolean(window.__scriareSaveFailedPrompt?.getState?.().resolver),
  }));
  check(
    "no question is left standing for the next spec",
    handedBack.dialog === false && handedBack.pending === false,
    `dialog ${handedBack.dialog}, pending ${handedBack.pending}`,
  );

  await api(() => window.__scriareProjectStore.setState({ saveConflict: null, saveFailed: false }));
  await api(() => window.__scriareToastStore.setState({ toasts: [] }));
  await wait(200);
  await seedProject();
  await wait(300);
  await fs.rm(dir, { recursive: true, force: true });
}
