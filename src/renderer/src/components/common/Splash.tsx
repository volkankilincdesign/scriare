/**
 * What the app shows while it works out what it is showing (v0.62.0).
 *
 * The complaint: opening a `.scriare` flashed the empty "no stories yet"
 * Welcome for a moment before the story appeared, and so did an ordinary
 * launch before the shelf of stories arrived. Both are the same bug — the
 * renderer painting its default state while the answer was still coming
 * over IPC — and both are worse than they sound: the one screen that says
 * YOU HAVE NOTHING is the screen a returning writer sees first.
 *
 * This is deliberately almost nothing. It is not a brand moment, a
 * progress percentage or a tip of the day: it is the app's own ground with
 * its own wordmark on it, and it exists to be BORING for a third of a
 * second. Anything livelier would make a fast launch look like an
 * animation someone decided to add.
 *
 * Most of the time nobody sees it at all — the window is held back for
 * SHELL_GRACE_MS and a fast boot finishes inside that, so the app appears
 * already showing the story or the shelf.
 */
export function Splash() {
  return (
    <div
      data-screen="booting"
      className="flex h-screen w-screen flex-col items-center justify-center gap-5 bg-[var(--bg)]"
    >
      <span className="font-serif-narrative text-[22px] italic text-[var(--text-3)]">Scriare</span>

      {/* A line that moves rather than a spinner: the app has no other
          spinner, and one control that spins would be the only thing in
          Scriare that does. 2px, on the border token, with the accent
          travelling along it. */}
      <span
        aria-hidden
        className="block h-[2px] w-40 overflow-hidden rounded-full bg-[var(--border-soft)]"
      >
        <span className="scriare-splash-sweep block h-full w-1/3 rounded-full bg-[var(--accent)]" />
      </span>

      {/* Said once, for a screen reader, since the visual answer is a
          moving line that announces nothing. */}
      <span className="sr-only" role="status">
        Opening…
      </span>
    </div>
  );
}
