/**
 * How long the app is allowed to be invisible, and how long a splash has
 * to stay once it has been seen (v0.62.0).
 *
 * Both halves of the fix need the same two numbers — the main process
 * decides when to show the window, the renderer decides when to stop
 * drawing the splash — and a disagreement between them is exactly the
 * flicker this version exists to remove. One table, both read it.
 */

/**
 * The window stays hidden this long while the renderer works out what to
 * draw. Under it, the app appears already showing the right screen and no
 * splash is ever seen; over it, the window appears with the splash in it,
 * because a launcher that does nothing visible for half a second reads as
 * a launcher that failed.
 *
 * It is also the FALLBACK: the window is shown when this elapses whether
 * or not the renderer has said anything, so a renderer that never reports
 * cannot leave an invisible app behind.
 */
export const SHELL_GRACE_MS = 350;

/**
 * Once the splash HAS been seen, it stays at least this long.
 *
 * Without it, a boot finishing at 360ms paints a splash for ten
 * milliseconds — a flash, which is the thing being fixed, just in a
 * different costume.
 */
export const SPLASH_MIN_MS = 220;
