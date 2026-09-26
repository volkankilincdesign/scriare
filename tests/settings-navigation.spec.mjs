/**
 * Getting around Settings, and the colour that stopped following the theme
 * (v0.55.0).
 *
 * Two defects a stranger can walk into on their own:
 *
 *  - PROJECT SETTINGS OPENS CHOICE STYLES BY CLOSING ITSELF. That swap is
 *    deliberate — two dimmed backdrops stacked is how a settings screen
 *    starts feeling like a maze — but it left no route back, so changing
 *    the Start Scene after looking at a style meant dismissing the manager
 *    and reopening Settings from the top bar.
 *  - OPENING THE COLOUR PICKER ON A THEMED COLOUR PINS IT, in the story
 *    file, permanently, and said nothing. The style stops following light
 *    and dark for good; you find out when a reader opens the export on a
 *    light ground and the choices are dark boxes.
 *
 * Both are asserted on the RENDERED dialogs rather than on the store flags
 * behind them, for the reason v0.50.0 learned: a check that calls the
 * mechanism is testing the mechanism, not the screen that is meant to be
 * using it.
 */
export default async function run({ page, api, check, seedProject }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const dialogs = () =>
    api(() => {
      const cards = [...document.querySelectorAll('[role="dialog"]')];
      const back = document.querySelector('[role="dialog"] button svg path[d^="M19 12H6"]');
      return {
        count: cards.length,
        titles: cards.map((c) => (c.querySelector("h2")?.textContent ?? "").trim()),
        // The back link is found by its drawing, not by its text, so that
        // renaming the parent dialog does not quietly disable this check.
        backLabel: back ? (back.closest("button")?.textContent ?? "").trim() : null,
      };
    });

  const closeAll = () =>
    api(() => {
      const ui = window.__scriareUIStore.getState();
      ui.closeChoiceStyles();
      ui.closeSettings();
    });

  await closeAll();

  // ── the way down, and the way back ──────────────────────────────────

  await api(() => window.__scriareUIStore.getState().openSettings());
  await wait(200);
  const settings = await dialogs();
  check(
    "Project Settings opens on its own",
    settings.count === 1 && settings.titles[0] === "Project Settings",
    settings.titles.join(" / "),
  );

  // Through the real button, so this is the route a writer takes.
  await page.getByRole("button", { name: /manage/i }).click();
  await wait(250);
  const styles = await dialogs();
  check(
    "…and hands off to Choice Styles rather than stacking on top of it",
    styles.count === 1 && styles.titles[0] === "Choice Styles",
    `${styles.count} dialog: ${styles.titles.join(" / ")}`,
  );
  check(
    "THE WAY BACK IS ON SCREEN, and it names where it goes",
    styles.backLabel === "Project Settings",
    JSON.stringify(styles.backLabel),
  );

  await page.getByRole("button", { name: "Project Settings" }).click();
  await wait(250);
  const returned = await dialogs();
  check(
    "…and it goes there — one dialog, not two",
    returned.count === 1 && returned.titles[0] === "Project Settings",
    `${returned.count} dialog: ${returned.titles.join(" / ")}`,
  );

  // ── and no way "back" to somewhere you have never been ──────────────

  await closeAll();
  await api(() => window.__scriareUIStore.getState().openChoiceStyles());
  await wait(200);
  const direct = await dialogs();
  check(
    "reached from the Inspector, it offers no way back to a dialog you were never in",
    direct.titles[0] === "Choice Styles" && direct.backLabel === null,
    `back link: ${JSON.stringify(direct.backLabel)}`,
  );

  // ── the colour that stops following the theme ───────────────────────

  await closeAll();
  await seedProject();
  await api(() => {
    window.__scriareToastStore.setState({ toasts: [] });
    window.__scriareUIStore.getState().openChoiceStyles();
  });
  await wait(250);

  // Open the Default style's editor, then drive its real colour input the
  // way the browser does: set the value through the native setter so
  // React's own value tracker sees the change, and fire `input`.
  const pinned = await api(async () => {
    const wait2 = (ms) => new Promise((r) => setTimeout(r, ms));
    const dialog = document.querySelector('[role="dialog"]');
    // The expand control is a caret, not a word — found by the row it sits
    // in (the Default style is always first; `normalizeChoiceStyles`
    // guarantees it) rather than by its text, which is "▸".
    const row = dialog.querySelector("[data-style-id]");
    const opener = row?.querySelector("button");
    if (!opener) return { error: "no style row" };
    opener.click();
    await wait2(150);

    const input = dialog.querySelector('input[type="color"]');
    if (!input) return { error: "no colour input" };

    const before = window.__scriareProjectStore.getState().project.choiceStyles[0].box.fill;
    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;

    // Three events, as a real pointer inside the picker would send — the
    // notice must be raised once, not once a frame.
    for (const hex of ["#ff0000", "#ee0000", "#dd0000"]) {
      setValue.call(input, hex);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await wait2(40);
    }
    await wait2(120);

    const toasts = window.__scriareToastStore.getState().toasts;
    return {
      before,
      after: window.__scriareProjectStore.getState().project.choiceStyles[0].box.fill,
      toasts: toasts.length,
      message: toasts[0]?.message ?? "",
      undoable: toasts[0]?.undoToken !== null && toasts[0]?.undoToken !== undefined,
    };
  });

  check(
    "an untouched style's colour is a theme variable",
    typeof pinned.before === "string" && pinned.before.startsWith("var("),
    JSON.stringify(pinned.before),
  );
  check(
    "picking a colour pins it to a fixed value",
    typeof pinned.after === "string" && pinned.after.startsWith("#"),
    `${JSON.stringify(pinned.before)} → ${JSON.stringify(pinned.after)}`,
  );
  check(
    "AND THE APP SAYS SO, at the moment it happens",
    /no longer follows the theme/i.test(pinned.message),
    JSON.stringify(pinned.message),
  );
  check(
    "…once, not once a frame",
    pinned.toasts === 1,
    `${pinned.toasts} notice(s) for three events`,
  );
  check(
    "…and it offers the way back",
    pinned.undoable === true,
    `undo token present: ${pinned.undoable}`,
  );

  const restored = await api(() => {
    const toast = window.__scriareToastStore.getState().toasts[0];
    window.__scriareToastStore.getState().undoToast(toast.id);
    return window.__scriareProjectStore.getState().project.choiceStyles[0].box.fill;
  });
  check(
    "…which puts the theme back",
    typeof restored === "string" && restored.startsWith("var("),
    JSON.stringify(restored),
  );

  // ── hand the app back the way it was found ──────────────────────────

  await closeAll();
  await api(() => window.__scriareToastStore.setState({ toasts: [] }));
  await seedProject();
  await wait(120);
  check(
    "the workspace is handed back to the next spec",
    await api(() => {
      const ui = window.__scriareUIStore.getState();
      return !ui.choiceStylesOpen && !ui.settingsOpen && Boolean(
        window.__scriareProjectStore.getState().project,
      );
    }),
  );
}
