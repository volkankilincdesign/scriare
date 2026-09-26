/**
 * How a colour reads on the reader's two grounds (v0.58.0).
 *
 * THE NUMBERS IN HERE ARE NOT READ BACK FROM THE APP. They were computed
 * independently — WCAG relative luminance over the two ground pages from
 * export/readingThemes.ts — and written down, because a test that asks the
 * app what the ratio is and then checks the app printed that ratio is a
 * test of nothing. If the app's arithmetic drifts, these fail.
 *
 *   #7a1f1f as ink      Night 1.82:1   Paper  9.54:1
 *   #2a5f8f as a wash   Night 5.29:1   Paper  2.59:1   (the ground's own ink ON it)
 *   #3d5a2a as a fill   Night 6.15:1   Paper  2.23:1
 *
 * The other claim checked here is that the previews are painted in the
 * GROUND's colours and not the app theme's — the whole point of the panel
 * — so they are measured in two different themes and must not move.
 */
export default async function run({ page, api, check, seedProject }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const NIGHT_PAGE = "rgb(21, 18, 14)"; // #15120e
  const PAPER_PAGE = "rgb(249, 246, 242)"; // #f9f6f2

  const setTheme = (t) =>
    api((theme) => window.__scriareThemes.useThemeStore.getState().setTheme(theme), t);

  /** Drive the real control: the native colour input the writer uses. */
  const pickInToolbar = (index, value) =>
    api(
      async ({ index, value }) => {
        const w = (ms) => new Promise((r) => setTimeout(r, ms));
        const editor = window.__scriareEditorStore.getState().editor;
        editor.chain().focus().setTextSelection({ from: 1, to: 4 }).run();
        await w(120);
        const input = [...document.querySelectorAll('input[type="color"]')][index];
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value",
        ).set;
        setter.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        await w(200);
        return true;
      },
      { index, value },
    );

  /** What the panel says, and what it is painted in. */
  const readPanel = () =>
    api(() => {
      const panel = document.querySelector("[data-color-on-grounds]");
      if (!panel) return null;
      const grounds = [...panel.querySelectorAll("[data-ground-preview]")].map((slab) => ({
        ground: slab.getAttribute("data-ground"),
        name: slab.getAttribute("data-ground-preview"),
        page: getComputedStyle(slab).backgroundColor,
        content: slab.getAttribute("data-content-colour") !== null,
      }));
      // Where it is, measured — the v0.58.1 complaint was entirely about
      // placement: the panel sat where the browser opens the picker.
      const box = panel.getBoundingClientRect();
      const control = [...document.querySelectorAll("label[title]")].find(
        (l) => l.querySelector('input[type="color"]'),
      );
      const pane = panel.closest(".relative");
      const paneBox = pane ? pane.getBoundingClientRect() : null;
      const controlBox = control ? control.getBoundingClientRect() : null;
      return {
        text: panel.innerText.replace(/\s+/g, " ").trim(),
        grounds,
        insideTheControl: Boolean(panel.closest("label")),
        // How far below the colour control it starts. The picker Chromium
        // draws is about 290px tall and opens against that control.
        belowControl: controlBox ? Math.round(box.top - controlBox.bottom) : null,
        inBottomHalf: paneBox ? box.top > paneBox.top + paneBox.height / 2 : null,
        // Pinned to the pane's own bottom edge: as far from the control
        // as this pane goes, whatever the window size.
        offTheBottom: paneBox ? Math.round(paneBox.bottom - box.bottom) : null,
      };
    });

  await seedProject();
  await setTheme("dark");
  await wait(400);

  // ── ink ───────────────────────────────────────────────────────────────
  await pickInToolbar(0, "#7a1f1f");
  const ink = await readPanel();

  check(
    "picking a text colour opens the reading",
    Boolean(ink),
    ink ? "panel shown" : "no panel",
  );

  check(
    "...in the writing pane's own corner, out of the picker's way",
    // v0.58.1. It was drawn under the control, which is where the browser
    // opens the colour picker — so the reading spent the whole pick behind
    // the thing it was about. Nothing here can measure a browser popup, so
    // what is asserted is the design: not inside the control, in the
    // bottom half of the pane, and pinned to its bottom edge — which is as
    // far from the picker as this pane goes at any window size.
    ink.insideTheControl === false &&
      ink.inBottomHalf === true &&
      ink.offTheBottom !== null &&
      ink.offTheBottom < 24,
    `${ink.belowControl}px below the control, ${ink.offTheBottom}px off the pane's bottom`,
  );

  check(
    "both grounds are measured, and the numbers are the real ones",
    ink.text.includes("Night 1.8:1") && ink.text.includes("Paper 9.5:1"),
    ink.text,
  );

  check(
    "...and it says what that MEANS, not just the number",
    /Nearly invisible on Night/.test(ink.text),
    ink.text,
  );

  check(
    "the previews are painted in the grounds themselves",
    ink.grounds.length === 2 &&
      ink.grounds[0].page === NIGHT_PAGE &&
      ink.grounds[1].page === PAPER_PAGE,
    ink.grounds.map((g) => `${g.name} ${g.page}`).join(" · "),
  );

  check(
    "...and they are marked as content, so the palette audit leaves them alone",
    ink.grounds.every((g) => g.content),
    JSON.stringify(ink.grounds.map((g) => g.content)),
  );

  // The claim the whole version rests on: the writer's room does not reach
  // the reader's page, here either.
  await setTheme("phosphor");
  await wait(400);
  const inPhosphor = await readPanel();
  check(
    "a different theme does not move either ground",
    inPhosphor &&
      inPhosphor.grounds[0].page === NIGHT_PAGE &&
      inPhosphor.grounds[1].page === PAPER_PAGE &&
      inPhosphor.text.includes("Night 1.8:1"),
    inPhosphor ? inPhosphor.grounds.map((g) => g.page).join(" · ") : "no panel",
  );
  await setTheme("dark");
  await wait(300);

  // ── dismissing ────────────────────────────────────────────────────────
  const escaped = await api(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await w(160);
    return document.querySelector("[data-color-on-grounds]") === null;
  });
  check("Escape puts it away, like everything else the app puts on top", escaped);

  const movedOn = await api(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    const editor = window.__scriareEditorStore.getState().editor;
    const input = [...document.querySelectorAll('input[type="color"]')][0];
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, "#3f6f2f");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await w(200);
    const opened = Boolean(document.querySelector("[data-color-on-grounds]"));
    // The caret moving on is the writer saying they are done with it.
    editor.chain().focus().setTextSelection({ from: 6, to: 6 }).run();
    await w(200);
    return { opened, afterCaretMove: Boolean(document.querySelector("[data-color-on-grounds]")) };
  });
  check(
    "moving the caret on puts it away too",
    movedOn.opened && !movedOn.afterCaretMove,
    JSON.stringify(movedOn),
  );

  // ── a highlight is measured the other way round ───────────────────────
  await pickInToolbar(1, "#2a5f8f");
  const wash = await readPanel();
  check(
    "a highlight is measured as what sits BEHIND the words, not as the words",
    // The ground's own ink ON the highlight: light text on a mid blue
    // (5.3:1) on Night, dark text on it (2.6:1) on Paper. Measured the
    // wrong way round — this colour as ink on the page — the same value
    // reads 2.8:1 and 6.2:1, so the two are not merely different numbers,
    // they name the opposite ground as the broken one.
    Boolean(wash) && wash.text.includes("Night 5.3:1") && wash.text.includes("Paper 2.6:1"),
    wash ? wash.text : "no panel",
  );
  check(
    "...and picking on the other control replaces the reading rather than adding one",
    // One panel, whichever control is in use: the numbers above are the
    // highlight's, and there is exactly one of it on screen.
    (await api(() => document.querySelectorAll("[data-color-on-grounds]").length)) === 1,
    "one panel",
  );

  // ── a choice's fill, in the dialog that owns it ───────────────────────
  await api(() => {
    window.__scriareUIStore.getState().closeChoiceStyles();
    window.__scriareToastStore.setState({ toasts: [] });
  });
  await api(() => window.__scriareUIStore.getState().openChoiceStyles());
  await wait(320);

  const style = await api(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    const dialog = document.querySelector('[role="dialog"]');
    const row = [...dialog.querySelectorAll("button")].find((b) => /▸|▾/.test(b.textContent));
    if (row) row.click();
    await w(220);
    const before = Boolean(dialog.querySelector("[data-color-on-grounds]"));
    const input = dialog.querySelector('input[type="color"]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, "#3d5a2a");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await w(260);
    const panel = dialog.querySelector("[data-color-on-grounds]");
    return {
      before,
      text: panel ? panel.innerText.replace(/\s+/g, " ").trim() : null,
      // The v0.55.0 notice still fires alongside — the panel is not a
      // replacement for being told the style stopped following the theme.
      toasts: window.__scriareToastStore.getState().toasts.map((t) => t.message),
    };
  });

  check(
    "a choice fill gets the same reading, in the dialog that owns it",
    style.text !== null &&
      style.text.includes("Night 6.2:1") &&
      style.text.includes("Paper 2.2:1") &&
      /Nearly invisible on Paper/.test(style.text),
    String(style.text),
  );
  check(
    "...and it was not there before a colour was picked",
    style.before === false,
    `panel present before the pick: ${style.before}`,
  );
  check(
    "the v0.55.0 notice still fires — the panel did not quietly replace it",
    style.toasts.some((m) => /no longer follows the theme/.test(m)),
    JSON.stringify(style.toasts),
  );

  // ── put it back ───────────────────────────────────────────────────────
  await api(() => {
    window.__scriareUIStore.getState().closeChoiceStyles();
    window.__scriareToastStore.setState({ toasts: [] });
  });
  await seedProject();
  await wait(200);
  check(
    "the workspace is handed back to the next spec",
    await api(() => Boolean(window.__scriareProjectStore.getState().project)),
  );
}
