/**
 * What a project is CALLED on disk (v0.48.0).
 *
 * Projects were `.json` and are now `.scriare`. The change is small and the
 * ways it can go wrong are not: a writer who types a bare name gets a file
 * the OS has no opinion about; a writer with an existing `.json` finds their
 * story has become unopenable; a "Save a Copy" lands under a different
 * extension from the original.
 *
 * These run against the REAL main-process handlers, with only
 * `dialog.showSaveDialog` / `showOpenDialog` stubbed — a headless run cannot
 * drive a native dialog, but everything after it is the code that ships,
 * including the atomic write. Stubbing the dialog rather than calling
 * `withProjectExtension` directly is deliberate: the bug this is guarding
 * against lives in the wiring between the dialog's answer and the file that
 * gets written, and a unit test of the helper would have nothing to say
 * about it.
 */
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdir, readFile, rm, writeFile, stat } from "node:fs/promises";

export default async function run({ page, check, app }) {
  const dir = join(tmpdir(), `scriare-ext-${process.pid}`);

  /** Makes the next save dialog answer with `answer`, and the next open
   *  dialog answer with it too. Returns what the dialogs were offered, so
   *  the defaults and filters can be asserted rather than assumed. */
  async function stubDialogs(answer) {
    return app.evaluate(async ({ dialog }, reply) => {
      // Kept so they can be put back: these are monkey-patches on
      // Electron's own module, and leaving them in place would quietly
      // change the behaviour of every spec that runs after this one.
      if (!globalThis.__scriareRealDialogs) {
        globalThis.__scriareRealDialogs = {
          save: dialog.showSaveDialog,
          open: dialog.showOpenDialog,
        };
      }
      const seen = { save: null, open: null };
      globalThis.__scriareDialogSeen = seen;
      dialog.showSaveDialog = async (...args) => {
        const options = args.length > 1 ? args[1] : args[0];
        seen.save = { defaultPath: options.defaultPath, filters: options.filters };
        return { canceled: false, filePath: reply };
      };
      dialog.showOpenDialog = async (...args) => {
        const options = args.length > 1 ? args[1] : args[0];
        seen.open = { filters: options.filters };
        return { canceled: false, filePaths: [reply] };
      };
      return true;
    }, answer);
  }

  const seen = () => app.evaluate(() => globalThis.__scriareDialogSeen);

  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });

  /* ── a name typed with no extension ───────────────────────────── */

  const bare = join(dir, "My Story");
  await stubDialogs(bare);
  const created = await page.evaluate(() =>
    window.api.project.create(JSON.stringify({ name: "v0" }), "My Story"),
  );

  check(
    "a name typed without an extension is saved as .scriare",
    created.filePath.endsWith(".scriare"),
    created.filePath,
  );
  check(
    "the file is actually there under that name",
    await stat(created.filePath).then(() => true, () => false),
  );

  const offered = await seen();
  check(
    "the New Project dialog offers Documents/Scriare",
    /[\\/]Scriare[\\/]/.test(offered.save.defaultPath),
    offered.save.defaultPath,
  );
  check(
    "the New Project dialog offers a .scriare name",
    offered.save.defaultPath.endsWith(".scriare"),
    offered.save.defaultPath,
  );
  check(
    "the save dialog filters to .scriare",
    offered.save.filters.some((f) => f.extensions.includes("scriare")),
    JSON.stringify(offered.save.filters),
  );

  /* ── an extension the writer chose deliberately ───────────────── */

  const chosen = join(dir, "Deliberate.json");
  await stubDialogs(chosen);
  const kept = await page.evaluate(() =>
    window.api.project.create(JSON.stringify({ name: "v0" }), "Deliberate"),
  );
  check(
    "an extension the writer typed is left exactly as typed",
    kept.filePath.endsWith("Deliberate.json"),
    kept.filePath,
  );

  /* ── every project that already exists ────────────────────────── */

  const legacy = join(dir, "From Last Year.json");
  await writeFile(legacy, JSON.stringify({ name: "From Last Year", scenes: [] }), "utf-8");
  await stubDialogs(legacy);
  const opened = await page.evaluate(() => window.api.project.open());
  const openOffered = await seen();

  check(
    "a .json project written by an older version still opens",
    opened && opened.filePath === legacy,
    opened ? opened.filePath : "did not open",
  );
  check(
    "the open dialog still lists .json alongside .scriare",
    openOffered.open.filters.some(
      (f) => f.extensions.includes("json") && f.extensions.includes("scriare"),
    ),
    JSON.stringify(openOffered.open.filters),
  );

  /* ── the backup follows the name ──────────────────────────────── */

  // The file already holds "v0", written by the create above. Saving over
  // it must leave that version beside it under the PROJECT's own name —
  // `My Story.scriare.bak`, not `My Story.bak`, so a folder holding two
  // projects cannot produce one ambiguous backup.
  //
  // One save, not two: the first version of this test did two and then
  // asserted the backup held the first save's content. It holds the
  // create's, because a backup is taken at most every five minutes (see
  // BACKUP_EVERY_MS in main/projectFile.ts) and the first save already
  // took it. The cadence was right and the test's model of it was wrong.
  const target = created.filePath;
  await page.evaluate(
    (filePath) => window.api.project.save(filePath, JSON.stringify({ name: "v1" }), null),
    target,
  );

  const backup = `${target}.bak.1`;
  const backupText = await readFile(backup, "utf-8").catch(() => null);
  check(
    "the newest backup sits beside the project under the project's own name",
    backupText !== null,
    backupText === null ? `${backup} is not there` : backup,
  );
  check(
    "the backup holds the version that was replaced",
    backupText !== null && JSON.parse(backupText).name === "v0",
    backupText ? JSON.parse(backupText).name : "—",
  );

  /* ── the rotation, and the version it exists to keep ──────────── */

  // Measured on v0.48.0, against the real writeProjectFile: the backup
  // that "overwrite it with my version" takes was written to the same
  // single `.bak` the routine five-minute cadence uses, AND set
  // `lastBackupAt` — so the next cadence backup, triggered by nothing but
  // continued typing, copied the writer's own file over the other
  // machine's work. The one undo of last resort deleted itself on a timer.
  //
  //   after overwrite, .bak = {"v":"OTHER-MACHINE-WORK"}
  //   routine autosave 6 min later: .bak = {"v":"MINE-v1"}   ← GONE
  const rotated = join(dir, "Rotation.scriare");
  await writeFile(rotated, JSON.stringify({ v: "v0" }), "utf-8");
  await page.evaluate(async (filePath) => {
    const save = (json, expected, force) =>
      window.api.project.save(filePath, JSON.stringify(json), expected, force);
    // v0 is on disk. Force a backup, as the conflict overwrite does.
    const first = await save({ v: "v1" }, null, true);
    return first;
  }, rotated);

  check(
    "a forced backup keeps the version it replaced",
    JSON.parse(await readFile(`${rotated}.bak.1`, "utf-8")).v === "v0",
    await readFile(`${rotated}.bak.1`, "utf-8"),
  );

  // A second forced backup stands in for "five minutes later, an ordinary
  // autosave" — same code path, same rotation.
  await page.evaluate(
    (filePath) => window.api.project.save(filePath, JSON.stringify({ v: "v2" }), null, true),
    rotated,
  );

  // Read tolerantly. The first version of this used a bare `readFile`, and
  // when the negative control switched the rotation off, `.bak.2` was not
  // there — so the spec THREW instead of failing, and the control run
  // reported CRASHED rather than a red assertion. A test that cannot tell
  // "the value is wrong" from "the whole file is missing" reports the
  // second as a broken harness, which is exactly the case this exists for.
  const slotValue = async (slot) => {
    const text = await readFile(`${rotated}.bak.${slot}`, "utf-8").catch(() => null);
    if (text === null) return "— not there";
    try {
      return JSON.parse(text).v;
    } catch {
      return "— unreadable";
    }
  };
  const slot1 = await slotValue(1);
  const slot2 = await slotValue(2);
  check(
    "a later backup pushes the older one down instead of destroying it",
    slot1 === "v1" && slot2 === "v0",
    `bak.1=${slot1}, bak.2=${slot2}`,
  );

  /* ── a name that ends in something extension-shaped ───────────── */

  // `path.extname("My Story v1.2")` is ".2" — verified — so the v0.48.0
  // guard `extname(p) === ""` did not fire and the project was saved with
  // no extension at all: absent from the open dialog's default filter, and
  // never opened by a double-click in Explorer.
  const versioned = join(dir, "My Story v1.2");
  await stubDialogs(versioned);
  const versionedResult = await page.evaluate(() =>
    window.api.project.create(JSON.stringify({ name: "v0" }), "My Story v1.2"),
  );
  check(
    "a title ending in something extension-shaped still gets .scriare",
    versionedResult.filePath.endsWith("My Story v1.2.scriare"),
    versionedResult.filePath,
  );

  /* ── the export cannot land on the project file ───────────────── */

  // The export dialog opens in the project's OWN folder, so the .scriare
  // is in the file list; clicking it fills the name box with it. On
  // v0.48.0 any non-empty extension was honoured verbatim, with no
  // conflict check and no backup — the story was replaced by a web page.
  const decoy = join(dir, "Precious.scriare");
  await writeFile(decoy, JSON.stringify({ name: "Precious", scenes: [] }), "utf-8");
  await stubDialogs(decoy);
  const misdirected = await page.evaluate(
    (near) => window.api.exportStory.html("x.html", "<!doctype html><title>page</title>", near),
    target,
  );

  check(
    "an export aimed at a project file is redirected to a web page",
    misdirected.filePath.endsWith(".html") && !misdirected.filePath.endsWith(".scriare"),
    misdirected.filePath,
  );
  check(
    "and the project it was aimed at is untouched",
    JSON.parse(await readFile(decoy, "utf-8")).name === "Precious",
    (await readFile(decoy, "utf-8")).slice(0, 40),
  );

  /* ── the export names itself ──────────────────────────────────── */

  const bareHtml = join(dir, "Reader Copy");
  await stubDialogs(bareHtml);
  const exported = await page.evaluate(
    (near) => window.api.exportStory.html("Anything.html", "<!doctype html><title>t</title>", near),
    target,
  );
  check(
    "an export typed without an extension becomes .html",
    exported.filePath.endsWith(".html"),
    exported.filePath,
  );
  const exportOffered = await seen();
  check(
    "the export is offered beside the project, not in Documents",
    exportOffered.save.defaultPath.startsWith(dir),
    exportOffered.save.defaultPath,
  );

  // Export reuses the project save path for its atomic write, which is
  // right — a failed export must leave the previous one intact rather than
  // a half-written page. The backup logic came along with it and had to be
  // switched off: an export is derived, regenerable in one click, and a
  // `.html.bak` beside it is clutter in the one folder this version argues
  // should hold a story and nothing surprising.
  await stubDialogs(exported.filePath);
  await page.evaluate(
    (near) =>
      window.api.exportStory.html("Anything.html", "<!doctype html><title>again</title>", near),
    target,
  );
  // `.bak.1`, not `.bak`. The first version of this check looked for the
  // v0.48.0 single-slot name, which v0.49.0's rotation no longer writes
  // under ANY circumstances — so the check passed whether the export took
  // a backup or not, and the negative control that switches `noBackup`
  // off went uncaught. The rotation rename landed and the test that
  // guarded the export's one interaction with it was not updated.
  const strayBackup = `${exported.filePath}.bak.1`;
  check(
    "exporting twice leaves no backup beside the page",
    await stat(strayBackup).then(() => false, () => true),
    strayBackup,
  );
  check(
    "the second export replaced the first",
    (await readFile(exported.filePath, "utf-8")).includes("again"),
  );

  /* ── put the dialogs back ─────────────────────────────────────── */

  await app.evaluate(({ dialog }) => {
    const real = globalThis.__scriareRealDialogs;
    if (real) {
      dialog.showSaveDialog = real.save;
      dialog.showOpenDialog = real.open;
      delete globalThis.__scriareRealDialogs;
    }
    delete globalThis.__scriareDialogSeen;
  });
  await rm(dir, { recursive: true, force: true });
}
