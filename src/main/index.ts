import { app, shell, BrowserWindow, Menu, ipcMain } from "electron";
import { join } from "path";
import { is } from "@electron-toolkit/utils";
import { registerProjectHandlers } from "./ipc/projectHandlers";
import { registerExportHandlers } from "./ipc/exportHandlers";
import { projectFileFromArgv } from "../shared/fileArgs";
import { SHELL_GRACE_MS } from "../shared/boot";

// Sprint 8C (v0.18.0): `package.json`'s "name" field ("scriare", all
// lowercase — the npm-package-name convention) is what Electron otherwise
// derives app.getName() from, which in turn seeds the macOS app-menu label,
// the About panel, and native dialog titles. Setting it explicitly, once,
// before anything else touches app.getName(), is what keeps every one of
// those surfaces reading "Scriare" instead of "scriare" or the Electron
// default. Must run before app.whenReady() — several of the identity APIs
// below only take effect if set early.
app.setName("Scriare");

// Windows-only: identifies this app to the taskbar (grouping, pinning,
// jump lists, toast notifications) independently of the executable's own
// file name. Cheap to set now even though it matters most once the app is
// actually packaged/installed (see the packaging note in buildApplicationMenu
// below) — an unpackaged dev build still benefits from correct taskbar
// grouping while testing.
app.setAppUserModelId("com.volkan.scriare");

/* ── opening a story from the desktop (v0.61.0) ──────────────────────── *
 * Windows launches the app with the file's path on the command line, and
 * if the app is already running it launches a SECOND copy with that path
 * rather than telling the first. Both need answering, or the association
 * the installer registers is a lie: the icon changes and double-clicking
 * does nothing useful.
 * -------------------------------------------------------------------- */

/** The story to open once a window exists and its renderer has asked. */
let pendingOpen: string | null = projectFileFromArgv(process.argv);

/**
 * The window this app owns, as opposed to whatever `getAllWindows()`
 * happens to return first.
 *
 * The first version of the handler below took `BrowserWindow.getAllWindows()[0]`
 * and the suite caught it: a spec that opens a second window to read an
 * exported story made index 0 that window, and the double-click went to a
 * page with no renderer to hear it. The same class of mistake as the
 * v0.53.1 resize probe, which measured the wrong window and passed.
 */
let mainWindow: BrowserWindow | null = null;

/**
 * One copy of Scriare, however many times it is launched.
 *
 * Without the lock, double-clicking a second story opens a second window
 * with its own autosave timer over the same recent-projects file — and, if
 * the two ever hold the same project, two writers of one file, which is
 * the exact situation save-safety spent v0.47.0 making impossible.
 */
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const file = projectFileFromArgv(argv);
    const window = mainWindow;
    if (!window || window.isDestroyed()) {
      pendingOpen = file;
      return;
    }
    // The window comes forward whether or not there is a file: the writer
    // just double-clicked something expecting to see the app.
    if (window.isMinimized()) window.restore();
    window.focus();
    if (file) window.webContents.send("project:open-from-disk", file);
  });
}

/**
 * The macOS route, which is an event rather than a command line — and it
 * fires BEFORE `whenReady`, which is why this listener is registered out
 * here rather than inside it. Scriare ships Windows builds today; this is
 * four lines that mean a future macOS build is not silently deaf to a
 * double-click.
 */
app.on("open-file", (event, filePath) => {
  event.preventDefault();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("project:open-from-disk", filePath);
  } else {
    pendingOpen = filePath;
  }
});

/**
 * Replaces Electron's own default application menu, which otherwise shows
 * literally "Electron" as the first (macOS) or only meaningfully-branded
 * menu, plus a Help submenu linking out to Electron's own project site,
 * docs, and community Discord — real, user-visible "Electron" branding this
 * sprint's brief explicitly asked to hunt down and remove. This is NOT the
 * app's in-document "/" slash menu or its own toolbar/dialogs — those were
 * always Scriare's own UI; this is the native OS-level menu bar Electron
 * builds for you if you never call Menu.setApplicationMenu yourself.
 *
 * On macOS the menu bar is a permanent, OS-level fixture that can't be
 * hidden the way `autoHideMenuBar` hides it on Windows/Linux, so it needs a
 * real (if minimal) replacement: an App menu (role: "appMenu", which reads
 * app.getName() — "Scriare" as of the setName() call above — instead of
 * hardcoding it, so it can't drift out of sync with the app's own identity
 * again), Edit (role: "editMenu", needed for Cmd+C/V/X/A and macOS's
 * Services menu to keep working — Chromium's text inputs handle basic
 * copy/paste on their own, but the Services integration and a few other
 * OS-level behaviors are wired through this role), and Window (role:
 * "windowMenu", minimize/zoom/close). No File or Help menu — this app has
 * no native-menu-driven file operations (all project actions already have
 * their own in-app UI) and no documentation site to link to.
 *
 * On Windows/Linux, `autoHideMenuBar` already hides this bar by default,
 * but pressing Alt still reveals it — and revealed Electron's own default
 * Help menu (again, links to Electron's own site) with nothing Scriare-
 * specific in it. Removing the menu outright (`null`) there is correct
 * rather than rebuilding a trimmed one: Chromium's native text-input
 * copy/paste doesn't depend on an application menu existing on these
 * platforms the way macOS's Edit-menu role matters, so there's nothing this
 * app would lose by not having one.
 */
function buildApplicationMenu(): Menu | null {
  if (process.platform !== "darwin") return null;

  return Menu.buildFromTemplate([
    { role: "appMenu" },
    { role: "editMenu" },
    { role: "windowMenu" },
  ]);
}

function createWindow(): void {
  // Kept in a local for the rest of this function — everything below was
  // written against a const and TypeScript is right that a module-level
  // `let` could be null by the time a callback runs. The module-level one
  // is set from this same value, and is what the desktop-open handlers
  // read (see the note beside its declaration).
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    // Matches --bg in the current Dark theme (themes.css' oklch(12% 0 0),
    // as of v0.12.0's Minimal redesign) so the window doesn't flash a
    // mismatched colour while the page loads. This previously named/matched
    // v0.9.0's since-removed "Crimson Noir" theme and had drifted out of
    // sync with the actual palette — fixed here, but still necessarily a
    // single static guess: this app has no theme-aware version of this
    // color, since the active theme choice lives in the renderer's
    // localStorage, invisible to the main process at window-creation time.
    // A writer using Light mode will still see a brief dark flash before
    // the page paints — see the Sprint 8C report for why that's left as a
    // future opportunity rather than fixed here (it needs a main-process-
    // readable persisted theme choice, not just a corrected constant).
    backgroundColor: "#060606",
    icon: join(__dirname, "../../build/icon.png"),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
  });

  mainWindow = window;

  /**
   * THE WINDOW APPEARS ONCE THERE IS SOMETHING WORTH SEEING (v0.62.0).
   *
   * `ready-to-show` means the first frame is painted — and the first frame
   * is the app's default state, which for a writer with nine stories is
   * the screen that says they have none. Showing it there is how a launch
   * came to flash the empty Welcome before the shelf, and how opening a
   * `.scriare` flashed it before the story.
   *
   * So the renderer says when it knows (`app:shell-ready`), and this waits
   * — but only for SHELL_GRACE_MS, because an app that stays invisible
   * while it reads a large project looks like an app that did not start.
   * Whichever comes first wins, and the timer means a renderer that never
   * reports cannot leave an invisible window behind.
   */
  window.on("ready-to-show", () => {
    let shown = false;
    const show = (): void => {
      if (shown || window.isDestroyed()) return;
      shown = true;
      window.show();
    };
    ipcMain.once("app:shell-ready", show);
    setTimeout(show, SHELL_GRACE_MS);
  });

  /**
   * Closing the window gives the renderer a chance to write first
   * (v0.49.0).
   *
   * There was no `close` handler at all, and no `beforeunload` in the
   * renderer either — so the X button destroyed the window immediately.
   * Autosave fires 1.5 seconds after the last change, which means the last
   * 1.5 seconds of typing were discarded every time; and while the
   * conflict dialog is up the project is entirely unsaved in memory —
   * `saveNow` returns early and the autosave timer is dropped — so closing
   * from there could throw away a whole session.
   *
   * The handshake rather than a synchronous guard, because the only honest
   * answer involves asynchronous work (a write, or a question) and
   * `close`'s own handler cannot wait. The renderer flushes, asks if it
   * has to, and calls back; `closing` makes the second close go through
   * rather than looping.
   *
   * THE GIVE-UP TIMER IS A LIVENESS CHECK, NOT A DEADLINE (v0.49.1). It
   * was a flat four seconds, after which the window was destroyed — which
   * put a four-second clock on two things that have no business racing
   * one. A conflict close asks the writer a question about losing an hour
   * of work, and `confirmDialog` resolves when they click: reading it
   * carefully was the failure mode. A flush on a synced folder can also
   * take longer than that on its own — v0.47.0 added EPERM/EBUSY retries
   * precisely because sync clients and scanners hold files open.
   *
   * So the renderer now sends a pulse while it is working, and the timer
   * restarts on each one. What it measures is what it was always for: a
   * renderer that has stopped responding cannot make the window
   * unclosable. A renderer that is busy, or waiting on a person, is not
   * that — and the only way to lose work here now is to wedge the script
   * engine outright.
   */
  let closing = false;
  window.on("close", (event) => {
    if (closing || window.webContents.isDestroyed()) return;
    event.preventDefault();
    closing = true;
    window.webContents.send("app:before-close");

    // Generous against a 1-second pulse: three missed beats, not one late
    // one, and nowhere near short enough to catch a slow disk.
    const SILENCE_BEFORE_GIVING_UP = 4000;
    let giveUp: ReturnType<typeof setTimeout>;
    const armGiveUp = (): void => {
      giveUp = setTimeout(() => {
        ipcMain.off("app:closing-heartbeat", onHeartbeat);
        ipcMain.off("app:ready-to-close", onReady);
        if (!window.isDestroyed()) window.destroy();
      }, SILENCE_BEFORE_GIVING_UP);
    };
    const onHeartbeat = (): void => {
      clearTimeout(giveUp);
      armGiveUp();
    };
    // Named and removed explicitly rather than `once`: when the timer
    // fired, the listener it raced was left registered for the life of the
    // process.
    const onReady = (_event: Electron.IpcMainEvent, proceed: boolean): void => {
      clearTimeout(giveUp);
      ipcMain.off("app:closing-heartbeat", onHeartbeat);
      ipcMain.off("app:ready-to-close", onReady);
      if (proceed) {
        if (!window.isDestroyed()) window.close();
      } else {
        // The writer said no. Put the window back to how it was, so the
        // next X press asks again rather than closing silently.
        closing = false;
      }
    };

    ipcMain.on("app:closing-heartbeat", onHeartbeat);
    ipcMain.once("app:ready-to-close", onReady);
    armGiveUp();
  });

  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    window.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    window.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(buildApplicationMenu());

  // macOS-native About panel (Scriare menu → About Scriare) and, where the
  // platform supports it, app.showAboutPanel() elsewhere — without this,
  // both fall back to Electron's own generic defaults (its own name/icon),
  // another spot the default install otherwise still reads as "Electron"
  // rather than "Scriare".
  app.setAboutPanelOptions({
    applicationName: "Scriare",
    applicationVersion: app.getVersion(),
    version: app.getVersion(),
    copyright: "© Volkan",
  });

  registerProjectHandlers();
  registerExportHandlers();

  /**
   * PULLED BY THE RENDERER, not pushed at it. A push has to guess when the
   * renderer is listening; this is asked for once, by the side that knows
   * it is ready, and answered once — the path is cleared as it is handed
   * over so a reload cannot reopen a file the writer has since closed.
   */
  ipcMain.handle("app:pendingOpen", () => {
    const file = pendingOpen;
    pendingOpen = null;
    return file;
  });

  createWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
