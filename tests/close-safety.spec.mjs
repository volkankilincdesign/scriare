/**
 * Closing the window, and the two ways v0.49.0 still lost work (v0.49.1).
 *
 * v0.49.0 was a release about data loss, and both of these shipped inside
 * the fixes for it — which is the reason this file exists as its own spec
 * rather than as three more checks in audit-fixes: the close path has its
 * own timing, its own process boundary, and its own way of looking correct.
 *
 * THE FLUSH THAT DID NOT FLUSH. `closeProject` awaited `saveNow()`,
 *   but `saveNow`'s first branch is "one is already on its way, queue
 *   and return" — a resolved promise having written nothing. So the
 *   await waited for nothing, `closeProject` cleared the very flag that
 *   call had just set, and the real save landed afterwards to find the
 *   path had changed and dropped the queue too.
 *
 * The handshake's other v0.49.1 fix — the give-up timer that used to give
 * the writer four seconds to answer a question — is measured in
 * close-heartbeat.spec.mjs, which needs a clean app instance of its own.
 *
 * These run against the real store and real files on disk.
 */
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdir, readFile, rm } from "node:fs/promises";

export default async function run({ page, api, app, check, seedProject }) {
  const dir = join(tmpdir(), `scriare-close-${process.pid}`);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const file = join(dir, "Close.scriare");

  await seedProject();

  /* ── a real file to close over ────────────────────────────────── */

  await api(async (filePath) => {
    const store = window.__scriareProjectStore;
    store.setState({
      project: { ...store.getState().project, name: "V1" },
      filePath,
      fileStamp: null,
    });
    await store.getState().saveNow();
  }, file);

  check(
    "the baseline save wrote the file",
    JSON.parse(await readFile(file, "utf-8")).name === "V1",
    JSON.parse(await readFile(file, "utf-8")).name,
  );

  /* ── 1. closing over the top of a save in flight ──────────────── */

  // One synchronous turn on purpose. Awaiting between these steps would
  // let the first write land and the window this is about would never
  // open — which is exactly why v0.49.0's own tests did not see it: they
  // exercised the STAMP during flight and never the close.
  const timeline = await api(async () => {
    const store = window.__scriareProjectStore;
    const named = (name) => ({ ...store.getState().project, name });

    store.setState({ project: named("V2"), saveStatus: "unsaved" });
    const inFlight = store.getState().saveNow(); // deliberately not awaited

    store.setState({ project: named("V3"), saveStatus: "unsaved" });

    await store.getState().closeProject();
    await inFlight;
    return { statusAfterClose: store.getState().saveStatus };
  });

  const onDisk = JSON.parse(await readFile(file, "utf-8")).name;
  check(
    "closing writes the keystrokes typed while a save was in flight",
    onDisk === "V3",
    `on disk: ${onDisk} (expected V3)`,
  );
  check(
    "and it does not report success over a file that is behind",
    onDisk === "V3" && timeline.statusAfterClose === "saved",
    `on disk ${onDisk}, store says "${timeline.statusAfterClose}"`,
  );

  /* ── the property underneath it ───────────────────────────────── */

  // Stated directly rather than only through closeProject, because every
  // caller of `await saveNow()` — Ctrl+S, quit, close — relies on it
  // meaning "the disk is current" and nothing said so before.
  const file2 = join(dir, "Await.scriare");
  // Seeded again, and this is not a formality. The block above CLOSED the
  // project, so `store.getState().project` is null here — and the first
  // version of this spec spread that null into `{ ...null, name: "A1" }`,
  // leaving the store holding a "project" with no scenes and no content.
  // Saving it works (it is just JSON), so these checks still passed, while
  // the app itself rendered over a project that could not exist.
  //
  // That is what made the heartbeat half of this file unreachable — the
  // renderer was in no state to run the close guard, so `before-close`
  // produced zero beats with no error — and what broke every spec that ran
  // after this one in a full suite, since specs share one app.
  await seedProject();
  const savedAt = await api(async (filePath) => {
    const store = window.__scriareProjectStore;
    store.setState({
      project: { ...store.getState().project, name: "A1" },
      filePath,
      fileStamp: null,
      saveStatus: "unsaved",
    });
    await store.getState().saveNow();

    const named = (name) => ({ ...store.getState().project, name });
    store.setState({ project: named("A2"), saveStatus: "unsaved" });
    store.getState().saveNow(); // in flight
    store.setState({ project: named("A3"), saveStatus: "unsaved" });
    // The second caller queues behind the first. When THIS resolves, the
    // newest text must already be on disk.
    await store.getState().saveNow();
    // READ AT THE INSTANT IT RESOLVES, in the same tick, with nothing
    // awaited in between — see the check below for why that matters.
    return store.getState().saveStatus;
  }, file2);

  check(
    "await saveNow() resolves only once the newest text is on disk",
    JSON.parse(await readFile(file2, "utf-8")).name === "A3",
    JSON.parse(await readFile(file2, "utf-8")).name,
  );

  /**
   * THE ORDERING, ASSERTED WHERE THE CLOCK CANNOT HIDE IT (v0.78.2).
   *
   * The disk check above cannot catch a promise that settles too early,
   * and its negative control proved it: resolving `saveRun` BEFORE the
   * queued re-run leaves the suite entirely green. The queued save still
   * happens a moment later, and `readFile` is itself an await — so by the
   * time the test looks, the right text is there. The control reported
   * NOT CAUGHT from v0.49.1 until this was written, which made it the
   * second false assurance found in one day.
   *
   * `saveStatus` is the mechanism, and it is exact: saveNow sets "saved"
   * only when `saveQueued` is false at the end of the write. So if the
   * awaited promise resolves while anything is still queued, the status
   * at that instant is not "saved" — no timing, no threshold, the same
   * answer on any machine.
   */
  check(
    "...and not while a queued save is still outstanding",
    savedAt === "saved",
    `saveStatus at the moment await saveNow() resolved: ${savedAt}`,
  );

  // Hand the app back in a state the next spec can use. Specs share one
  // application instance, so a spec that leaves a half-closed project
  // behind does not fail — it makes the NEXT one fail, somewhere else,
  // for reasons that look nothing like this file.
  await seedProject();
  await rm(dir, { recursive: true, force: true });
}
