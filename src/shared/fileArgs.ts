/**
 * The story a double-click hands the app (v0.61.0).
 *
 * Registering `.scriare` with Windows is the easy half; the half that
 * matters is that the app then OPENS the file, and what Windows actually
 * does is launch the executable with the path appended to its command
 * line. So this reads a command line and answers one question: which of
 * these words, if any, is a story.
 *
 * It lives in `shared/` because both sides need the same answer and
 * neither can import the other — the main process reads `process.argv` and
 * the second-instance argv, and the spec drives the same rules from the
 * renderer. A second copy of this would be a second set of rules, which is
 * the pair this project has spent several versions removing.
 *
 * Deliberately PURE — no `fs`. Whether the file exists is the opener's
 * question, and it is answered the same way whether the path arrived from
 * a double-click or from Recent Projects: by trying to open it and
 * reporting honestly (see projectStore's `openRecentProject`). A `stat`
 * here would only move that decision somewhere it cannot be undone.
 */

const EXTENSION = ".scriare";

export function projectFileFromArgv(argv: readonly string[]): string | null {
  // From the END. Electron's own argv is [exe, ...switches, entry, ...args]
  // in a packaged app and [electron, ".", ...args] in development, and in
  // both the file a shell appends is last. Scanning backwards also means a
  // project that happens to live NEXT to the app — a `.scriare` in the
  // install folder, which is exactly where a portable build sits — cannot
  // be mistaken for the one being opened.
  for (let i = argv.length - 1; i >= 1; i -= 1) {
    const arg = argv[i];
    // A switch, not a path: Electron and Chromium pass plenty of these
    // (--inspect, --remote-debugging-port, --no-sandbox) and one of them
    // will eventually end in something that looks like a file.
    if (!arg || arg.startsWith("-")) continue;
    if (arg.toLowerCase().endsWith(EXTENSION)) return arg;
  }
  return null;
}
