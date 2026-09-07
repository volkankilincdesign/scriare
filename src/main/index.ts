import { app, shell, BrowserWindow, Menu } from "electron";
import { join } from "path";
import { is } from "@electron-toolkit/utils";
import { registerProjectHandlers } from "./ipc/projectHandlers";

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
  const mainWindow = new BrowserWindow({
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

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
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
