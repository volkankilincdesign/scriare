import { promises as fs } from "fs";
import path from "path";

/**
 * Writing a project file without destroying it (v0.47.0).
 *
 * Until now this was one line — `fs.writeFile(filePath, json)` — which opens
 * the writer's real file, TRUNCATES it, and then writes. The previous good
 * version is gone from the moment the write starts, so anything that
 * interrupts it leaves a project that no longer opens. That is not
 * theoretical: filling a disk and saving is enough to reproduce it, and it
 * turns a 16KB story into 400KB of half-written JSON.
 *
 *   before:  16719 bytes, parses: true
 *   write failed: ENOSPC
 *   after:  409600 bytes, parses: false
 *
 * A full disk, a quota, a sync folder out of room, a laptop losing power, a
 * process killed mid-save — all the same shape of accident, and all of them
 * used to cost the whole file.
 *
 * Three rules here, in the order they matter:
 *
 *   1. The real file is only ever REPLACED, never written into. The new
 *      version is written to a temp file beside it, flushed to the platter,
 *      and then renamed over the target. A rename within one directory is
 *      atomic: readers see the old file or the new one, never a half of
 *      either, and a failure at any earlier step leaves the old one exactly
 *      as it was.
 *   2. The version being replaced is kept, as `<project>.bak`. One undo of
 *      last resort, for the case where what was saved is correct and what
 *      the writer wanted is what was there before.
 *   3. A file that changed underneath us is not overwritten. The caller says
 *      which version it believes it is editing; if the file on disk is no
 *      longer that one, this reports the conflict and writes nothing, so the
 *      decision belongs to the person rather than to whichever machine saved
 *      last. That is the OneDrive case: desktop, laptop, desktop.
 */

/**
 * Identity of a file as the app last saw it. Modification time AND size,
 * because either alone misses cases: a same-size edit keeps the size, and
 * some filesystems and sync clients rewrite the timestamp without touching
 * the bytes. A false "this changed" costs one dialog; a missed change costs
 * the other machine's work, so the comparison errs toward asking.
 */
export interface FileStamp {
  mtimeMs: number;
  size: number;
}

export type SaveOutcome =
  | { status: "saved"; stamp: FileStamp; backedUp: boolean }
  | { status: "changed"; stamp: FileStamp };

/** How the file looks now, or null when it isn't there. */
export async function readStamp(filePath: string): Promise<FileStamp | null> {
  try {
    const info = await fs.stat(filePath);
    return { mtimeMs: info.mtimeMs, size: info.size };
  } catch {
    return null;
  }
}

function sameFile(a: FileStamp, b: FileStamp): boolean {
  return a.mtimeMs === b.mtimeMs && a.size === b.size;
}

/** Where the backup of `filePath` lives. */
function backupPathFor(filePath: string): string {
  return `${filePath}.bak`;
}

/**
 * How often a backup is actually taken.
 *
 * Autosave fires 1.5 seconds after every change, so backing up on every save
 * would copy the whole project a few times a minute while someone is simply
 * typing — churn on the disk, and on every machine the folder is synced to.
 * It would also make the backup useless for the thing it exists for: a copy
 * from 1.5 seconds ago is the same mistake you just made.
 *
 * Every five minutes instead, plus always the first time (so a project that
 * has never been backed up gets one immediately). What that buys is a
 * version from a few minutes ago — which is what "I've just wrecked this,
 * give me the last good one" actually means.
 */
const BACKUP_EVERY_MS = 5 * 60 * 1000;
const lastBackupAt = new Map<string, number>();

/**
 * Temp names have to be unique per WRITE, not per millisecond. The first
 * version of this used the pid and the clock, and two saves landing in the
 * same millisecond — autosave and Ctrl+S, which is one keystroke away at any
 * moment — produced the same name: one rename took the file and the other
 * failed with ENOENT, so the save the writer asked for is the one that got
 * lost. A counter cannot collide with itself.
 */
let writeCounter = 0;


/**
 * Windows hands out EPERM and EBUSY for a file another process has open for
 * a moment — a sync client reading it, an indexer, an antivirus scanner —
 * and the honest answer to those is to wait and try again rather than to
 * tell the writer their save failed. Three tries over about half a second;
 * anything still locked after that is a real problem worth reporting.
 */
const RENAME_RETRY_MS = [40, 120, 320];
const RETRYABLE = new Set(["EPERM", "EBUSY", "EACCES"]);

async function renameWithRetry(from: string, to: string): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await fs.rename(from, to);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code ?? "";
      if (!RETRYABLE.has(code) || attempt >= RENAME_RETRY_MS.length) throw error;
      await new Promise((resolve) => setTimeout(resolve, RENAME_RETRY_MS[attempt]));
    }
  }
}

/**
 * Saves `contents` to `filePath`, replacing whatever is there.
 *
 * `expected` is the stamp the caller believes the file still has — pass null
 * to write regardless (a brand-new file, a deliberate overwrite the writer
 * has just confirmed, or "save a copy" to a path nobody is editing).
 */
export async function writeProjectFile(
  filePath: string,
  contents: string,
  expected: FileStamp | null,
  options?: {
    /**
     * Take a backup whatever the cadence says. For the one save that
     * deliberately destroys another version of the story — the writer
     * choosing "overwrite it with mine" — where the thing being replaced is
     * precisely what they might want back in ten minutes.
     */
    forceBackup?: boolean;
    /**
     * Skip the backup entirely. For a file that is DERIVED rather than
     * authored — an exported page, which can be regenerated from the
     * project in one click.
     *
     * Added in v0.48.0 after review, not after a test. Export reuses this
     * function for its atomic write, which is right: a failed export should
     * leave the previous one intact rather than a half-written page.
     * Nothing stopped the backup logic coming along with it, so a writer
     * who exported twice would have found `My Story.html.bak` sitting in
     * their folder — a backup of a file that is a copy of something else,
     * cluttering the one folder this version just finished arguing should
     * hold a story and nothing surprising.
     */
    noBackup?: boolean;
  },
): Promise<SaveOutcome> {
  const current = await readStamp(filePath);

  // A file that has vanished is not a conflict: recreating it is what the
  // writer means by "save", and refusing would leave them with a document
  // they cannot store anywhere. A file that is THERE but different is the
  // case this exists for.
  if (expected && current && !sameFile(current, expected)) {
    return { status: "changed", stamp: current };
  }

  const directory = path.dirname(filePath);
  writeCounter += 1;
  const temp = path.join(
    directory,
    `.${path.basename(filePath)}.tmp-${process.pid}-${writeCounter.toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
  );

  let handle: fs.FileHandle | null = null;
  try {
    handle = await fs.open(temp, "w");
    await handle.writeFile(contents, "utf-8");
    // Flushed before the rename, or the rename can land while the new
    // contents are still only in the page cache — which is the power-cut
    // case this whole exercise is about, arriving one step later.
    await handle.sync();
  } catch (error) {
    await handle?.close().catch(() => {});
    await fs.unlink(temp).catch(() => {});
    throw error;
  }
  await handle.close();

  // The backup is taken before the rename, so it holds the version being
  // replaced. Deliberately best-effort: it is a convenience, and a project
  // that cannot be backed up (a full disk — where a second copy is exactly
  // what there is no room for) should still be saved. The complete new
  // version already exists at this point; refusing to finish would be the
  // worse failure.
  let backedUp = false;
  if (current && options?.noBackup !== true) {
    const since = Date.now() - (lastBackupAt.get(filePath) ?? 0);
    const due =
      options?.forceBackup === true ||
      since >= BACKUP_EVERY_MS ||
      !(await readStamp(backupPathFor(filePath)));
    if (due) {
      try {
        await fs.copyFile(filePath, backupPathFor(filePath));
        lastBackupAt.set(filePath, Date.now());
        backedUp = true;
      } catch {
        backedUp = false;
      }
    }
  }

  try {
    await renameWithRetry(temp, filePath);
  } catch (error) {
    await fs.unlink(temp).catch(() => {});
    throw error;
  }

  const stamp = (await readStamp(filePath)) ?? {
    mtimeMs: Date.now(),
    size: Buffer.byteLength(contents, "utf-8"),
  };
  return { status: "saved", stamp, backedUp };
}
