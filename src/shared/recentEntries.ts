/**
 * The rules for a Recent Projects record (v0.53.0).
 *
 * Shared between the main process, which owns recent-projects.json, and
 * the test build, which exposes these on `window` so the spec can assert
 * on the rules themselves rather than on a file in the writer's own
 * userData directory. They are pure functions over plain objects on
 * purpose: nothing here may import `electron`, or the renderer cannot load
 * it and the rules go back to being untested.
 */

export interface RecentShape {
  /**
   * Shape format version. ABSENT on anything written by v0.53.0, whose
   * coordinates mean something different — the reader treats a shape it
   * does not recognise as no shape, and the Welcome screen redraws it.
   * Everything here is optional for that reason: this is a record of what
   * some version of the app once wrote, not a promise about it.
   */
  v?: number;
  nodes: { x: number; y: number }[];
  edges: [number, number][];
  start: number;
  total: number;
  w?: number;
  h?: number;
  node?: { w: number; h: number };
}

export interface RecentResume {
  /**
   * v0.54.0 — which kind of page it was: "scene", "character" or
   * "location". Absent on anything written before that, which could only
   * ever have been a scene, so the reader treats a record without it as
   * one. Every field is optional for the same reason the cached shape's
   * are: this is a record of what some version of the app once wrote.
   */
  kind?: string;
  title?: string;
  context?: string | null;
  /** Pre-v0.54.0 spellings of `title` and `context`. */
  sceneTitle?: string;
  groupName?: string | null;
  excerpt?: string;
  at?: string;
}

export interface RecentEntry {
  name: string;
  filePath: string;
  lastOpened: string;
  shape?: RecentShape | null;
  resume?: RecentResume | null;
  /** Derived from the disk at list time. Never stored — see forStorage. */
  missing?: boolean;
}

/**
 * What is allowed to reach the file.
 *
 * `missing` is recomputed from the disk every time the list is read, and a
 * derived value written back becomes a lie the moment the file returns: a
 * story on a USB stick or in a half-synced OneDrive folder would be marked
 * missing once and stay marked, on a file sitting perfectly intact on
 * disk. That is the same mistake `openRecentProject` had to be fixed for
 * in v0.49.1, and it is easier to make here, because the wrong version
 * looks like plain serialization.
 *
 * An allow-list rather than a delete, so a field added later is not
 * persisted by accident.
 */
const STORED_KEYS = ["name", "filePath", "lastOpened", "shape", "resume"] as const;

export function forStorage(entry: RecentEntry): RecentEntry {
  const out: Record<string, unknown> = {};
  for (const key of STORED_KEYS) {
    if (entry[key] !== undefined) out[key] = entry[key];
  }
  return out as unknown as RecentEntry;
}

/**
 * Moving an entry to the front must not throw away what is cached about
 * it.
 *
 * `addRecent` announces "this story was just opened", and it did that by
 * replacing the entry with a freshly built `{name, filePath, lastOpened}`.
 * With nothing else on the record that was the same object; with a cached
 * shape on it, OPENING a story erased its map, and the Welcome screen fell
 * back to the dot field until the next save — the app forgetting the
 * picture of the story you just opened, which is the one moment it most
 * obviously knows it.
 *
 * The incoming entry still wins wherever it says something: passing an
 * explicit `null` shape clears one, which is what a project whose last
 * scene was deleted needs.
 */
export function mergeRecentEntry(
  previous: RecentEntry | undefined,
  incoming: RecentEntry,
): RecentEntry {
  return {
    ...previous,
    ...incoming,
    shape: incoming.shape !== undefined ? incoming.shape : previous?.shape,
    resume: incoming.resume !== undefined ? incoming.resume : previous?.resume,
  };
}
