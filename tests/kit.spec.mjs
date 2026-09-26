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
export default async function run({ page, api, check, seedProject }) {
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

  await closeAll();
  await seedProject();
  await wait(150);
  check(
    "the workspace is handed back to the next spec",
    await api(() => Boolean(window.__scriareProjectStore.getState().project)),
  );
}
