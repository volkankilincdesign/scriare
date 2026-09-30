/**
 * One button, one title (v0.56.0).
 *
 * The claim this version makes is that the app now says the same thing
 * the same way everywhere. That claim is only worth making if something
 * measures it, and it can only be measured on the RENDERED screen —
 * asserting that the source imports `Button` would pass the day someone
 * imports it and then overrides its padding, which is exactly how the
 * drift happened the first time.
 *
 * So this opens each dialog for real, finds its primary action by the
 * colour it is painted, and reads the computed padding, font size and
 * radius back off the element. Every dialog must agree, and the numbers
 * must be the kit's.
 *
 * Deliberately measured, not compared to a hardcoded list of components:
 * a dialog added next year is covered by this the moment it is opened
 * here, and until then the spec says out loud how many it looked at.
 */
export default async function run({ page, api, check, seedProject, app }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const closeAll = () =>
    api(() => {
      const ui = window.__scriareUIStore.getState();
      ui.closeChoiceStyles();
      ui.closeSettings();
      ui.closeVariableManager();
      ui.closeStoryCheck();
      ui.closeExport();
      window.__scriareConfirm?.getState?.().resolve?.(false);
    });

  /** Everything the kit fixes, read off one rendered dialog. */
  const measure = (name) =>
    api((label) => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return { name: label, missing: true };

      const px = (el, prop) => Math.round(parseFloat(getComputedStyle(el)[prop]));
      const title = dialog.querySelector("h2");
      const accent = getComputedStyle(document.documentElement)
        .getPropertyValue("--accent")
        .trim();

      // The primary action is found by the paint, not by a class name or
      // a component name — the same reason the palette audit reads pixels.
      const primary = [...dialog.querySelectorAll("button")].find((b) => {
        const bg = getComputedStyle(b).backgroundColor;
        const probe = document.createElement("span");
        probe.style.color = accent;
        document.body.appendChild(probe);
        const want = getComputedStyle(probe).color;
        probe.remove();
        return bg === want;
      });

      return {
        name: label,
        title: title
          ? {
              family: getComputedStyle(title).fontFamily.split(",")[0].replace(/["']/g, ""),
              style: getComputedStyle(title).fontStyle,
              size: px(title, "fontSize"),
            }
          : null,
        primary: primary
          ? {
              text: primary.textContent.trim(),
              padX: px(primary, "paddingLeft"),
              padY: px(primary, "paddingTop"),
              size: px(primary, "fontSize"),
              radius: px(primary, "borderTopLeftRadius"),
            }
          : null,
      };
    }, name);

  const seen = [];
  const open = async (name, fn) => {
    await closeAll();
    await api(fn);
    await wait(220);
    seen.push(await measure(name));
  };

  await seedProject();

  await open("Project Settings", () => window.__scriareUIStore.getState().openSettings());
  await open("Choice Styles", () => window.__scriareUIStore.getState().openChoiceStyles());
  await open("Variables", () => window.__scriareUIStore.getState().openVariableManager());
  await open("Check Story", () => window.__scriareUIStore.getState().openStoryCheck());
  await open("New Project", () => {
    // Reached from the Welcome screen, which needs no project open.
    window.__scriareProjectStore.setState({ project: null, filePath: null, recentProjects: [] });
  });
  // The New Project dialog is opened by its own button on that screen.
  await wait(350);
  await page.getByRole("button", { name: "New Project" }).first().click();
  await wait(220);
  seen[seen.length - 1] = await measure("New Project");

  await seedProject();
  await wait(200);

  const withTitle = seen.filter((d) => d.title);
  const withPrimary = seen.filter((d) => d.primary);

  check(
    "every dialog measured actually rendered",
    seen.every((d) => !d.missing) && seen.length === 5,
    seen.map((d) => d.name).join(", "),
  );

  // ── one title ───────────────────────────────────────────────────────
  const titles = [...new Set(withTitle.map((d) => `${d.title.family}/${d.title.style}/${d.title.size}`))];
  check(
    "EVERY DIALOG TITLE IS THE SAME TYPE",
    titles.length === 1,
    `${withTitle.length} dialogs → ${titles.join("  |  ")}`,
  );
  check(
    "...and it is the app's own serif italic, not a semibold sans",
    // `startsWith`, because the shipped face is the variable one and
            // reports itself as "Newsreader Variable".
    withTitle.every((d) => d.title.family.startsWith("Newsreader") && d.title.style === "italic"),
    withTitle.map((d) => `${d.name}: ${d.title.family} ${d.title.style}`).join(", "),
  );

  // ── one button ──────────────────────────────────────────────────────
  const shapes = [
    ...new Set(withPrimary.map((d) => `${d.primary.padX}/${d.primary.padY}/${d.primary.size}/${d.primary.radius}`)),
  ];
  check(
    "EVERY PRIMARY BUTTON IS THE SAME SIZE",
    withPrimary.length >= 4 && shapes.length === 1,
    `${withPrimary.length} dialogs → ${shapes.join("  |  ")}`,
  );
  check(
    "...and it is the kit's md: px-3 py-1.5 text-sm, rounded-md",
    withPrimary.every(
      (d) =>
        d.primary.padX === 12 &&
        d.primary.padY === 6 &&
        d.primary.size === 14 &&
        d.primary.radius === 6,
    ),
    withPrimary
      .map((d) => `${d.name} ${d.primary.padX}×${d.primary.padY} ${d.primary.size}px r${d.primary.radius}`)
      .join(" · "),
  );

  // ── Cancel is not a second action ───────────────────────────────────
  await closeAll();
  await api(() => window.__scriareUIStore.getState().openSettings());
  await wait(200);
  const cancel = await api(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const b = [...dialog.querySelectorAll("button")].find((x) => x.textContent.trim() === "Cancel");
    if (!b) return null;
    const cs = getComputedStyle(b);
    return { border: cs.borderTopColor, width: Math.round(parseFloat(cs.borderTopWidth)) };
  });
  check(
    "Cancel is a ghost — the way out, not a control competing with the action",
    cancel !== null && (cancel.width === 0 || cancel.border === "rgba(0, 0, 0, 0)"),
    JSON.stringify(cancel),
  );

  // ── a dialog never runs off the window ──────────────────────────────
  // Every dialog is centred on the window, so one taller than the window
  // overflows at BOTH ends: the title goes off the top and the buttons off
  // the bottom, and with nothing scrolling neither can be reached. It was
  // measured that way before v0.70.0 — at a 620px window the Export
  // dialog's own frame started at −9px, and a writer on a short screen had
  // no way to press Export.
  //
  // The assertion is the property rather than the rule: the frame is
  // inside the window, and the action can be reached by scrolling the
  // dialog. Both halves are needed — a dialog that fits the window by
  // clipping its own content would pass the first on its own.
  // The REAL window, not Playwright's viewport. Pinning the viewport
  // stops `win.setBounds` from changing `window.innerWidth`, which broke
  // the Welcome spec two specs later — the resize it makes silently moved
  // a window nobody was looking at. Its own comment warns about exactly
  // that, and this is the second time that trap has been walked into.
  await closeAll();
  const appWindow = await app.browserWindow(page);
  const originalBounds = await appWindow.evaluate((win) => ({
    ...win.getBounds(),
    maximized: win.isMaximized(),
  }));

  for (const height of [900, 620, 520]) {
    await appWindow.evaluate((win, h) => {
      if (win.isMaximized()) win.unmaximize();
      win.setBounds({ ...win.getBounds(), height: h });
    }, height);
    await wait(450);
    await api(() => window.__scriareUIStore.getState().openExport());
    await wait(350);
    await page.click('[data-export-tab="sheet"]');
    await wait(450);

    const fit = await api(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const buttons = [...dialog.querySelectorAll("button")];
      const primary = buttons[buttons.length - 1];
      dialog.scrollTop = dialog.scrollHeight;
      const r = dialog.getBoundingClientRect();
      const b = primary.getBoundingClientRect();
      return {
        viewport: window.innerHeight,
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        actionTop: Math.round(b.top),
        actionBottom: Math.round(b.bottom),
        label: primary.textContent.trim(),
      };
    });
    check(
      `A DIALOG FITS THE WINDOW at ${height}px — both ends, not just the bottom`,
      fit.top >= 0 && fit.bottom <= fit.viewport,
      `frame ${fit.top}→${fit.bottom} in ${fit.viewport}`,
    );
    check(
      `...and its action can be reached at ${height}px`,
      fit.actionTop >= fit.top && fit.actionBottom <= fit.bottom + 1,
      `"${fit.label}" at ${fit.actionTop}→${fit.actionBottom}`,
    );
    await closeAll();
    await wait(150);
  }
  await appWindow.evaluate((win, bounds) => {
    win.setBounds({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height });
    if (bounds.maximized) win.maximize();
  }, originalBounds);
  await wait(450);

  await closeAll();
  await seedProject();
  await wait(150);
  check(
    "the workspace is handed back to the next spec",
    await api(() => Boolean(window.__scriareProjectStore.getState().project)),
  );

  /* ── the Content Browser's controls (v0.84.0) ──────────────────── */

  // COUNTED, the way v0.56.0 did it. This file held a bordered secondary
  // button in TWO spellings — `rounded-md … text-[var(--text-2)]` beside
  // `rounded … py-0.5 … text-[var(--text-2)]` — and neither was the kit's.
  // Asserted by measuring the two against each other and against a real
  // kit Button, rather than by looking for an import: what matters is
  // that a writer sees one control, not that one file imports one thing.
  const browser = await api(() => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const reference = document.createElement("button");
    reference.className =
      "inline-flex items-center justify-center gap-2 font-medium transition-colors rounded px-2.5 py-1 text-xs border border-[var(--border)] bg-transparent text-[var(--text)]";
    host.appendChild(reference);
    const r = getComputedStyle(reference);
    const want = { radius: r.borderTopLeftRadius, pad: r.paddingTop, size: r.fontSize, weight: r.fontWeight };
    host.remove();

    const seen = [...document.querySelectorAll("[data-new-content]")].map((b) => {
      const cs = getComputedStyle(b);
      return { radius: cs.borderTopLeftRadius, pad: cs.paddingTop, size: cs.fontSize, weight: cs.fontWeight };
    });
    return { want, seen };
  });

  check(
    "the Content Browser's New button is the kit's secondary, measured",
    browser.seen.length === 1 &&
      browser.seen[0].radius === browser.want.radius &&
      browser.seen[0].pad === browser.want.pad &&
      browser.seen[0].size === browser.want.size &&
      browser.seen[0].weight === browser.want.weight,
    `${JSON.stringify(browser.seen[0])} against ${JSON.stringify(browser.want)}`,
  );

  // THE SEARCH INPUT WAS LEFT ALONE, and this records why so the next
  // sweep does not "finish the job". The kit's row-scale input is
  // `bg-[var(--surface)]`, and this panel IS `--surface` — so the kit's
  // own spelling would paint an invisible field. The panel's `--bg`
  // input is correct and the kit's assumption is the thing that is
  // narrow. Asserted, so the day someone aligns them the check says what
  // it costs.
  const contrast = await api(() => {
    const panel = document.querySelector(".scriare-panel-l");
    const input = panel ? panel.querySelector("input") : null;
    return {
      panel: panel ? getComputedStyle(panel).backgroundColor : null,
      field: input ? getComputedStyle(input).backgroundColor : null,
    };
  });
  check(
    "the Content Browser's search field is not painted the same as the panel behind it",
    contrast.panel !== null && contrast.field !== null && contrast.panel !== contrast.field,
    `panel ${contrast.panel} · field ${contrast.field}`,
  );
}
