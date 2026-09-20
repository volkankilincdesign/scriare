import { promises as fs, default as fsSync } from "fs";
import os from "os";
import path from "path";

/**
 * Saving a project without destroying it (v0.47.0).
 *
 * The old save was `fs.writeFile(filePath, json)` — which opens the writer's
 * real file, truncates it, and then writes. From the first byte until the
 * last, the file on disk is neither the old version nor the new one, and
 * anything that interrupts the write costs the lot. Two demonstrations, both
 * run by hand before this was built:
 *
 *   - A save on a filesystem with no room left: `write failed: ENOSPC`, and a
 *     16,719-byte story became 409,600 bytes of unparseable JSON.
 *   - A save in flight, read by anything else: four of five reads saw a file
 *     that did not parse. That is a sync client, a backup tool, or a second
 *     window looking at the project at the wrong moment.
 *
 * The first needs a filesystem this suite cannot conjure on every machine
 * (it was reproduced on a 400KB tmpfs), so it is recorded in the changelog
 * and in main/projectFile.ts rather than tested here. The second is testable
 * anywhere and is the first check below — it is the same defect, observed
 * from the outside.
 *
 * The rest is the contract this release adds: the version being replaced is
 * kept, no litter is left behind, and a file that changed underneath us is
 * never overwritten without being asked about.
 *
 * These specs drive the REAL main process over the real IPC — `window.api`
 * in the renderer is the same bridge the app uses — while the test file
 * itself watches the actual filesystem. Nothing here is mocked, which is the
 * only way a test of "did this write land safely" means anything.
 */
export default async function ({ api, check, seedProject }) {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "scriare-save-"));
  const file = path.join(dir, "story.json");
  /**
   * A project file the app can actually OPEN. The first version of this
   * helper wrote `{name, scenes:[{id, text}]}` — enough for the file-level
   * checks, and not a project: reloading one left the editor with a scene
   * that had no document, which crashed the next spec in the suite rather
   * than this one. A fixture that only satisfies the assertion it was
   * written for is a trap for whoever runs next.
   */
  const story = (name, padding = 40) => {
    const now = new Date().toISOString();
    return JSON.stringify(
      {
        name,
        createdAt: now,
        updatedAt: now,
        scenes: [
          {
            id: "s1",
            title: "One",
            order: 0,
            position: { x: 0, y: 0 },
            content: {
              type: "doc",
              content: [{ type: "paragraph", content: [{ type: "text", text: "x".repeat(padding) }] }],
            },
          },
        ],
        content: [{ id: "s1", kind: "leaf", category: "story", parentId: null, order: 0, refType: "scene" }],
        favorites: [],
        variables: [],
        entities: [],
        startSceneId: "s1",
      },
      null,
      2,
    );
  };

  /** Save through the app, exactly as the app does. */
  const save = (filePath, json, expected) =>
    api(
      ([p, j, e]) => window.api.project.save(p, j, e),
      [filePath, json, expected ?? null],
    );
  const parses = (raw) => {
    try {
      JSON.parse(raw);
      return true;
    } catch {
      return false;
    }
  };

  // 1 — the reported defect, tested by what the app DOES rather than by
  // racing it. The first version of this check watched the file during a
  // save and asserted no read ever saw a half-written document — and it
  // passed on the old plain-writeFile build, because what it was really
  // sampling was the time the JSON spends crossing the IPC bridge, not the
  // time it spends being written. A control that passes is a finding about
  // the test, so this checks the mechanism instead, in two ways that cannot
  // race:
  //
  //   - a temp file appears beside the project while the save is in flight,
  //     and
  //   - the project's identity on disk CHANGES, because it was replaced by a
  //     rename rather than written into.
  //
  // Both are true of a safe save and neither can be true of `writeFile`.
  const first = await save(file, story("First draft"), null);
  check("a save reports what it did", first.status === "saved", JSON.stringify(first.status));

  const before = await fs.stat(file);
  const seen = new Set();
  const watcher = fsSync.watch(dir, (_event, name) => {
    if (name) seen.add(String(name));
  });
  // Big enough that the write is not instantaneous, small enough that
  // shipping it over the bridge doesn't dominate the test.
  const big = story("A long draft", 2_000_000);
  await save(file, big, null);
  await wait(150);
  watcher.close();
  const after = await fs.stat(file);

  const temps = [...seen].filter((n) => n.includes(".tmp-"));
  check("a save writes a temp file beside the project rather than into it",
    temps.length > 0, JSON.stringify([...seen]));
  check("...and replaces the project, so its identity on disk changes",
    before.ino !== 0 && after.ino !== 0 && before.ino !== after.ino,
    `inode ${before.ino} → ${after.ino}`);
  check("...and the save still lands",
    parses(await fs.readFile(file, "utf-8")) &&
      JSON.parse(await fs.readFile(file, "utf-8")).name === "A long draft",
    `${(await fs.stat(file)).size} bytes`);

  // 2 — the version that was replaced is kept.
  await save(file, story("Second draft"), null);
  const backup = `${file}.bak`;
  const hasBackup = await fs
    .readFile(backup, "utf-8")
    .then((raw) => JSON.parse(raw).name)
    .catch(() => null);
  check("the version being replaced is kept beside the project",
    hasBackup === "First draft", `backup holds "${hasBackup}"`);

  // 2b — but not on every save. Autosave fires 1.5 seconds after every
  // change, so a backup per save would copy the whole project several times
  // a minute — churn on disk and on every machine the folder syncs to — and
  // would make the backup useless for what it is for: a copy from a second
  // ago is the same mistake you just made. The backup is taken on a cadence,
  // so a second save straight after the first leaves the older version in
  // place.
  await save(file, story("Third draft"), null);
  const stillOlder = await fs
    .readFile(backup, "utf-8")
    .then((raw) => JSON.parse(raw).name)
    .catch(() => null);
  check("a second save moments later does not overwrite the backup",
    stillOlder === "First draft", `backup holds "${stillOlder}"`);

  // 3 — and nothing else is. A temp file left in the writer's folder is
  // litter they have to understand, and one left in a synced folder is
  // litter on every machine they own.
  const leftovers = (await fs.readdir(dir)).filter((n) => n.includes(".tmp-"));
  check("no temp files are left behind", leftovers.length === 0, JSON.stringify(leftovers));

  // 4 — the file changed underneath us. This is the OneDrive case: the app
  // holds the stamp of what it read, the file on disk is now something else,
  // and the save must refuse rather than decide.
  const stamp = await api(
    ([p]) => window.api.project.openPath(p).then((r) => r.stamp),
    [file],
  );
  // The other machine's version arrives. The mtime has to actually differ —
  // filesystems with coarse timestamps would otherwise make this a race.
  await wait(1100);
  await fs.writeFile(file, story("From the laptop"), "utf-8");

  const refused = await save(file, story("From the desktop"), stamp);
  check("a save refuses a file that changed underneath it",
    refused.status === "changed", JSON.stringify(refused.status));
  const onDisk = JSON.parse(await fs.readFile(file, "utf-8")).name;
  check("...and writes nothing, so the other version is still there",
    onDisk === "From the laptop", `disk holds "${onDisk}"`);
  check("...while reporting the version it actually found",
    refused.status === "changed" && typeof refused.stamp?.mtimeMs === "number",
    JSON.stringify(refused.stamp ?? null));

  // 5 — the same thing through the store, which is where the writer meets
  // it. A conflict must raise ONE question and stop autosaving: re-asking
  // every 1.5 seconds would make the app unusable behind its own dialog.
  await api(
    ([p, s]) => {
      const store = window.__scriareProjectStore;
      store.setState({
        project: window.__scriareProjectTypes.buildProject("Desktop version"),
        filePath: p,
        fileStamp: s,
        saveConflict: null,
        saveStatus: "unsaved",
      });
    },
    [file, stamp],
  );
  await api(() => window.__scriareProjectStore.getState().saveNow());
  await wait(200);
  let state = await api(() => {
    const s = window.__scriareProjectStore.getState();
    return { conflict: Boolean(s.saveConflict), status: s.saveStatus, path: s.saveConflict?.filePath };
  });
  check("the app raises the conflict instead of saving",
    state.conflict === true && state.status === "unsaved", JSON.stringify(state));

  const untouched = JSON.parse(await fs.readFile(file, "utf-8")).name;
  check("...and the file on disk is untouched while the question stands",
    untouched === "From the laptop", `disk holds "${untouched}"`);

  // A second save while the question is open must not even be attempted —
  // autosave keeps firing every 1.5 seconds, and each attempt would raise
  // the question again behind the dialog that is already asking it.
  //
  // Read in the SAME javascript turn as the call, deliberately: saveNow()
  // sets "saving" synchronously before it awaits anything, so one turn tells
  // the two cases apart with no timing to lose. Asserting on the file
  // instead does not work — the main process refuses the write either way,
  // which is what the first version of this check was accidentally
  // measuring, confirmed by removing the guard and watching it pass.
  const attempted = await api(() => {
    const store = window.__scriareProjectStore;
    void store.getState().saveNow();
    return store.getState().saveStatus;
  });
  check("...and a save while the question stands is not even attempted",
    attempted === "unsaved", `status went to "${attempted}"`);
  await wait(250);
  const stillThere = JSON.parse(await fs.readFile(file, "utf-8")).name;
  check("...so the file is still the other version",
    stillThere === "From the laptop", `disk holds "${stillThere}"`);

  // 6 — overwrite: the writer chooses their own version, deliberately.
  await api(() => window.__scriareProjectStore.getState().resolveConflictOverwrite());
  await wait(300);
  state = await api(() => {
    const s = window.__scriareProjectStore.getState();
    return { conflict: Boolean(s.saveConflict), status: s.saveStatus, stamped: Boolean(s.fileStamp) };
  });
  const afterOverwrite = JSON.parse(await fs.readFile(file, "utf-8")).name;
  check("overwriting writes our version and clears the question",
    afterOverwrite === "Desktop version" && state.conflict === false && state.status === "saved",
    `disk holds "${afterOverwrite}", ${JSON.stringify(state)}`);
  check("...and the session is stamped with what it just wrote, so the next save is clean",
    state.stamped === true, JSON.stringify(state));
  // The cadence is suspended for this one save: overwriting is the moment
  // the writer destroys a version of the story on purpose, and it is exactly
  // what they may want back. (Found by reviewing this file's own failures
  // after the cadence went in — the backup was still the one from before.)
  const overwritten = await fs
    .readFile(backup, "utf-8")
    .then((raw) => JSON.parse(raw).name)
    .catch(() => null);
  check("...keeping the version it destroyed, whatever the backup cadence says",
    overwritten === "From the laptop", `backup holds "${overwritten}"`);

  // 7 — reload: the writer chooses the version on disk instead.
  await wait(1100);
  await fs.writeFile(file, story("From the laptop, again"), "utf-8");
  await api(() => {
    const store = window.__scriareProjectStore;
    store.setState({
      saveConflict: { filePath: store.getState().filePath, found: { mtimeMs: 1, size: 1 } },
    });
  });
  await api(() => window.__scriareProjectStore.getState().resolveConflictReload());
  await wait(400);
  state = await api(() => {
    const s = window.__scriareProjectStore.getState();
    return { name: s.project?.name, conflict: Boolean(s.saveConflict), status: s.saveStatus };
  });
  check("reloading gives back the version on disk and clears the question",
    state.name === "From the laptop, again" && state.conflict === false && state.status === "saved",
    JSON.stringify(state));

  // 7a — two saves at once must not fight each other. Ctrl+S while autosave
  // is already in flight is one gesture away at any moment, and without a
  // guard the second save reads the file the first has just replaced, finds
  // a stamp it does not recognise, and raises a conflict dialog against the
  // app's own writing. Found by reading the code rather than by testing it,
  // then reproduced here.
  const racePath = path.join(dir, "race.json");
  await save(racePath, story("Start"), null);
  const raceStamp = await api(([p]) => window.api.project.openPath(p).then((r) => r.stamp), [racePath]);
  await api(
    ([p, s2]) => {
      const store = window.__scriareProjectStore;
      // A big version, so this save is still in flight when the next one
      // starts — an autosave of the whole story.
      const big = window.__scriareProjectTypes.buildProject("Raced");
      big.scenes = Array.from({ length: 400 }, (_, i) => ({
        id: `r${i}`,
        title: `Scene ${i}`,
        order: i,
        position: { x: 0, y: 0 },
        content: {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "word ".repeat(600) }] }],
        },
      }));
      store.setState({
        project: big,
        filePath: p,
        fileStamp: s2,
        saveConflict: null,
        saveStatus: "unsaved",
      });
    },
    [racePath, raceStamp],
  );
  // What the guard actually promises is that two saves are never in flight
  // TOGETHER — not that a second save never happens, since the queued re-run
  // is a second save by design. So the measurement is how many temp files
  // exist at the same moment: one save, one temp, always.
  //
  // Counting issued saves instead reports two and says nothing (that was the
  // first version of this check), and trying to observe the damage — a lost
  // update, a conflict against ourselves — depends on how the main process
  // schedules two file writes, which the suite cannot force: three framings
  // of that all passed against the unguarded build.
  let concurrent = 0;
  const poller = setInterval(async () => {
    try {
      const now = (await fs.readdir(dir)).filter((n) => n.includes(".tmp-")).length;
      if (now > concurrent) concurrent = now;
    } catch {
      // the folder is busy; the next tick will do
    }
  }, 5);
  await api(() => {
    const store = window.__scriareProjectStore;
    // Autosave goes out with the long version. The writer then cuts a
    // chapter and presses Ctrl+S, so the SECOND save is small and finishes
    // first — and without a guard the first save's rename lands last and
    // quietly puts the deleted chapter back. That is a lost update, not a
    // dialog: the app would report "saved" and mean the wrong thing.
    const first = store.getState().saveNow();
    const small = window.__scriareProjectTypes.buildProject("Raced, and then cut back");
    store.setState({ project: small });
    const second = store.getState().saveNow();
    return Promise.all([first, second]);
  });
  await wait(600);
  clearInterval(poller);
  check("a save already in flight is never joined by a second one",
    concurrent <= 1, `${concurrent} saves were in flight at once`);
  const raced = await api(() => {
    const s2 = window.__scriareProjectStore.getState();
    return { conflict: Boolean(s2.saveConflict), status: s2.saveStatus };
  });
  check("two saves at once do not raise a conflict against ourselves",
    raced.conflict === false && raced.status === "saved", JSON.stringify(raced));
  const racedName = JSON.parse(await fs.readFile(racePath, "utf-8")).name;
  check("...and the later save is the one on disk, not whichever finished last",
    racedName === "Raced, and then cut back", `disk holds "${racedName}"`);
  await api(([p]) => window.api.recent.remove(p), [racePath]);

  // 7b — a file that has been MOVED or deleted is not a conflict. Recreating
  // it is what "save" means, and refusing would leave a writer holding work
  // they cannot put anywhere — the worst possible answer to a sync client
  // having shuffled a folder.
  const moved = path.join(dir, "moved.json");
  await save(moved, story("Before the move"), null);
  const movedStamp = await api(([p]) => window.api.project.openPath(p).then((r) => r.stamp), [moved]);
  await fs.rm(moved);
  const recreated = await save(moved, story("After the move"), movedStamp);
  check("a project that vanished is recreated rather than refused",
    recreated.status === "saved" &&
      JSON.parse(await fs.readFile(moved, "utf-8")).name === "After the move",
    JSON.stringify(recreated.status));
  await api(([p]) => window.api.recent.remove(p), [moved]);

  // 8 — a save to a path that cannot be written fails cleanly: no partial
  // file, no temp file, nothing for the writer to find later and wonder
  // about. (The directory below does not exist.)
  const nowhere = path.join(dir, "no-such-folder", "story.json");
  const failed = await api(
    ([p, j]) =>
      window.api.project
        .save(p, j, null)
        .then(() => "wrote")
        .catch(() => "failed"),
    [nowhere, story("Nowhere")],
  );
  check("a save that cannot be written fails rather than half-writing",
    failed === "failed", failed);
  const stillClean = (await fs.readdir(dir)).filter((n) => n.includes(".tmp-"));
  check("...and leaves nothing behind", stillClean.length === 0, JSON.stringify(stillClean));

  // 9 — and a save that fails says so. Before this the status stopped at
  // "Saving…" and stayed there: the moment the writer most needs to be told
  // something — a disk with no room, a folder that went away with the drive
  // it was on — told silently.
  await api(([p]) => {
    const store = window.__scriareProjectStore;
    window.__scriareToastStore.setState({ toasts: [] });
    store.setState({
      project: window.__scriareProjectTypes.buildProject("Unsaveable"),
      filePath: p,
      fileStamp: null,
      saveConflict: null,
      saveStatus: "unsaved",
    });
  }, [path.join(dir, "gone", "story.json")]);
  await api(() => window.__scriareProjectStore.getState().saveNow());
  await wait(400);
  const failure = await api(() => ({
    status: window.__scriareProjectStore.getState().saveStatus,
    toast: window.__scriareToastStore.getState().toasts.map((t) => t.message)[0] ?? null,
  }));
  check("a save that cannot be written says so instead of hanging on \"Saving…\"",
    failure.status === "unsaved" && /Couldn't save/.test(failure.toast ?? ""),
    JSON.stringify(failure));
  check("...and names what went wrong",
    /folder it lives in is gone/.test(failure.toast ?? ""), String(failure.toast));

  // ...once. Autosave fires after every change, so a folder that has gone
  // away would otherwise raise the same notice every 1.5 seconds for as long
  // as the writer keeps typing — which is how a message that matters becomes
  // one people learn to swat away.
  await api(() => window.__scriareProjectStore.getState().saveNow());
  await wait(400);
  const repeated = await api(() => window.__scriareToastStore.getState().toasts.length);
  check("...and says it once, not once per autosave", repeated === 1, `${repeated} notices`);

  // Housekeeping: the test opened a project, so it is in the writer's Recent
  // list. Tests that run on a real machine have to put the real machine back.
  await api(([p]) => window.api.recent.remove(p), [file]);
  await fs.rm(dir, { recursive: true, force: true });
  await seedProject();
  await wait(400);
  // And the app has to be left WORKING, not merely reseeded. This file opens
  // projects from disk, which is the one thing in the suite that can leave
  // the editor unmounted for whoever runs next — it did, the first time.
  const healthy = await api(() => Boolean(window.__scriareEditorStore.getState().editor));
  check("the app is left with a mounted editor for the next spec", healthy === true, String(healthy));
}
