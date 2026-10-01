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
      // THE ONE THIS HELPER DID NOT CLOSE (v0.84.0). Named `closeAll` and
      // closing five of six, which was true and harmless until the
      // placeholder sweep opened the sixth — and then a Stylesheet dialog
      // rode four specs down the run and failed eight checks inside
      // settings-navigation, which passed when run alone. A helper whose
      // name is a promise has to keep it.
      ui.closeStylesheet();
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
    "the window is handed back the size it was found",
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

  /* ── the Inspector's fields (v0.84.0) ──────────────────────────── */

  // COUNTED: eleven fields in one panel, ten of them on the ground token
  // and ONE painted the colour of the panel behind it — a destination
  // picker with `bg-[var(--surface)]` on a `--surface` panel, which is a
  // field with no fill. The check is the same one the Content Browser
  // earned in v0.84.0, asked of every field rather than of the search box,
  // because the defect turned out not to be unique to one panel.
  // ON A CHOICE, not on a scene. With a scene selected the Inspector shows
  // ONE field and the first version of this check measured it and passed
  // — the easy half again. The field stack that had the defect (a
  // destination picker, conditions, actions) only exists when a choice is
  // selected, so the fixture puts it there.
  await api(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    const store = window.__scriareProjectStore;
    const scene = store.getState().project.scenes[0];
    store.getState().selectScene(scene.id);
    await w(300);
    const editor = window.__scriareEditorStore.getState().editor;
    editor.chain().focus().insertChoiceBlock().run();
    await w(260);
    // A DIALOGUE TOO, and it is not decoration. The ✕ on a choice row and
    // the ✕ on a dialogue line are the pair v0.85.0 found disagreeing —
    // one with no hover fill, one borrowing the keyboard's colour — so a
    // fixture with only a choice in it cannot see the defect this version
    // exists to fix. A control proved it: reverting the dialogue line's ✕
    // went uncaught, because the line was never on screen.
    editor.chain().focus().insertDialogueBlock().run();
    await w(320);
    const block = document.querySelector("[data-choice-block]");
    window.__scriareInspectorStore.getState().selectTarget({
      kind: "choice",
      sceneId: scene.id,
      blockId: block ? block.getAttribute("data-choice-block") : "blk",
      optionId: null,
    });
  });
  await wait(360);

  // EXPAND ONE, or the panel renders no field at all: every choice is a
  // folded accordion and the field stack lives inside it.
  await api(() => {
    const first = document.querySelector("[data-choice-accordion]");
    if (first) first.click();
  });
  await wait(300);

  const panelFields = await api(() => {
    const panel = document.querySelector(".scriare-panel-r");
    if (!panel) return { found: 0 };
    const ground = getComputedStyle(panel).backgroundColor;
    const fields = [...panel.querySelectorAll("input, select, textarea")];
    const painted = fields.map((f) => getComputedStyle(f).backgroundColor);
    return {
      found: fields.length,
      ground,
      target: JSON.stringify(window.__scriareInspectorStore.getState().target ?? null),
      heading: panel.textContent.replace(/\s+/g, " ").slice(0, 90),
      // Colour inputs are excluded: their fill IS the value the writer
      // picked, so "the same colour as the panel" is a thing a writer can
      // legitimately choose.
      sameAsPanel: fields.filter(
        (f, i) => f.type !== "color" && painted[i] === ground,
      ).length,
      // NAMED, not counted. "2 of 7" sends the reader hunting; the tag, the
      // type and the class list say which two, and the failure message is
      // where a person actually reads it.
      offenders: fields
        .filter((f, i) => f.type !== "color" && painted[i] === ground)
        .map(
          (f) =>
            `${f.tagName.toLowerCase()}${f.type ? `[${f.type}]` : ""}:${
              f.getAttribute("placeholder") || f.getAttribute("aria-label") || "—"
            }:${f.className.slice(0, 70)}`,
        ),
      distinct: [...new Set(painted)].length,
    };
  });

  // A NUMBER, not "more than nothing". The panel showed one field when
  // the fixture was wrong, and "> 0" called that a pass.
  check(
    "the Inspector's field stack is on screen to measure",
    panelFields.found >= 4,
    `${panelFields.found} fields`,
  );
  check(
    "no field in the Inspector is painted the colour of the panel behind it",
    panelFields.sameAsPanel === 0,
    `${panelFields.sameAsPanel} of ${panelFields.found} · panel ${panelFields.ground}${
      panelFields.sameAsPanel ? ` · ${panelFields.offenders.join(" | ")}` : ""
    }`,
  );

  /* ── the Inspector's small accent buttons (v0.84.0) ────────────── */

  // COUNTED: fourteen hand-written copies of one button — "+ Add
  // Condition", "+ Add Change", "Open Variable Manager", "Edit…", "+ Line",
  // "+ Add Choice" — across five files, thirteen of them character for
  // character identical and the fourteenth differing only in the opacity it
  // gave a disabled button (40 where its two siblings wrote 50). A
  // difference nobody chose, in a button nobody noticed, which is the
  // definition of drift.
  //
  // MEASURED AS A SHAPE, NOT AS AN IMPORT. `<Button intent="accentGhost">`
  // could be imported and then overridden by a className on the call site
  // — v0.56.0's lesson — so this reads padding, size and radius back off
  // every accent-coloured button the Inspector has mounted and requires
  // them to agree. It does not name a count of buttons it expects to find,
  // because the panel's contents depend on what is selected; it requires
  // more than one, since one button always agrees with itself.
  const accents = await api(() => {
    const panel = document.querySelector(".scriare-panel-r");
    if (!panel) return { found: 0 };
    const accent = getComputedStyle(document.documentElement)
      .getPropertyValue("--accent")
      .trim();
    // Resolve the token to the same colour space the computed style reports,
    // rather than string-matching a var() name that never appears there.
    const probe = document.createElement("div");
    probe.style.color = `var(--accent)`;
    panel.appendChild(probe);
    const want = getComputedStyle(probe).color;
    probe.remove();

    const buttons = [...panel.querySelectorAll("button")].filter(
      (b) => getComputedStyle(b).color === want,
    );
    const shape = (b) => {
      const s = getComputedStyle(b);
      return `${s.paddingLeft}/${s.paddingTop}/${s.fontSize}/${s.borderRadius}/${s.fontWeight}`;
    };
    return {
      found: buttons.length,
      accent,
      shapes: [...new Set(buttons.map(shape))],
      labels: buttons.map((b) => (b.textContent || "").trim().slice(0, 18)),
    };
  });

  check(
    "the Inspector has more than one accent button to compare",
    accents.found >= 2,
    `${accents.found} · ${(accents.labels ?? []).join(", ")}`,
  );
  check(
    "every accent button in the Inspector is one shape",
    accents.shapes?.length === 1,
    `${accents.shapes?.length} shape(s): ${(accents.shapes ?? []).join(" vs ")}`,
  );

  /* ── the ✕ that removes a row (v0.85.0) ────────────────────────── */

  // COUNTED: thirteen of them, in seven spellings, and the two that most
  // had to agree did not. The ✕ on a choice row and the ✕ on a dialogue
  // line are the same control on the two blocks the siblings rule binds
  // together — one had NO hover fill and the other used `--surface-3`,
  // which v0.85.0 reserves for the row the keyboard is on.
  //
  // MEASURED BY WHAT IT TURNS INTO, not by what it is at rest. At rest all
  // thirteen were already quiet `--text-3`, so a check on the resting state
  // would have passed on the broken app — the disagreement was entirely in
  // the hover, which is the state a writer is in when they are about to
  // destroy something. `:hover` cannot be provoked without a real pointer,
  // so the rule is read off the class the kit applies and the colours it
  // names are resolved live.
  const removers = await api(() => {
    const live = (expr) => {
      const probe = document.createElement("div");
      probe.style.color = expr;
      document.body.appendChild(probe);
      const value = getComputedStyle(probe).color;
      probe.remove();
      return value;
    };
    const quiet = live("var(--text-3)");
    const danger = live("var(--danger)");

    // THE ✕ ITSELF, and both halves of that selector were learned by getting
    // it wrong. Matching on a title starting with "remove" swept in the
    // editor toolbar's "Remove highlight", which is a formatting control at
    // 16px — nothing to do with a row. And matching every button wearing the
    // red-on-hover rule swept in the three block headers' "Remove block",
    // which removes a whole BLOCK and is a text button in its own right: a
    // different control, allowed to be a different size.
    //
    // So: a one-glyph button that promises to go red. The red-on-hover was
    // already universal across all thirteen before this version, so
    // selecting on it is not circular — what is being asserted is the FILL
    // and the shape, which is where the seven spellings disagreed.
    const found = [...document.querySelectorAll("button")].filter(
      (b) =>
        (b.textContent || "").trim() === "✕" &&
        b.className.includes("hover:text-[var(--danger)]"),
    );
    const shape = (b) => {
      const s = getComputedStyle(b);
      return `${s.paddingLeft}/${s.paddingTop}/${s.fontSize}/${s.borderRadius}`;
    };
    // offsetHeight, NOT getBoundingClientRect. The Story Graph draws its
    // nodes inside a CSS transform, so a rect is the on-screen size AFTER
    // the canvas zoom — GroupNode's ✕ measured 12px against its siblings'
    // 26 purely because the graph was zoomed out to fit the story. The
    // layout box is the thing the kit controls; the zoom is the writer's.
    const heights = found.map((b) => b.offsetHeight);
    return {
      quiet,
      danger,
      count: found.length,
      titles: found.map((b) => (b.getAttribute("title") || "").slice(0, 26)),
      heights,
      resting: [...new Set(found.map((b) => getComputedStyle(b).color))],
      shapes: [...new Set(found.map(shape))],
      // THE HOVER, WHICH IS WHERE THE DISAGREEMENT WAS. It cannot be
      // provoked without a real pointer, so the claim is read off each
      // rendered element's own class list — which is better than asking the
      // kit, because it also catches a call site that imported the intent
      // and then painted over its hover.
      missingHover: found
        .filter((b) => !b.className.includes("hover:bg-[var(--surface-2)]"))
        .map((b) => (b.getAttribute("title") || "?").slice(0, 26)),
      wrongHover: found
        .filter((b) => b.className.includes("hover:bg-[var(--surface-3)]"))
        .map((b) => (b.getAttribute("title") || "?").slice(0, 26)),
    };
  });

  check(
    "there is more than one row-remover on screen to compare",
    removers.count >= 2,
    `${removers.count}: ${removers.titles.join(" · ")}`,
  );
  check(
    "every row-remover is quiet at rest — one colour, and it is the muted one",
    removers.resting.length === 1 && removers.resting[0] === removers.quiet,
    `${removers.resting.join(" vs ")} against --text-3 ${removers.quiet}`,
  );
  check(
    "...and every one of them is the same shape",
    removers.shapes.length === 1,
    `${removers.shapes.length} shape(s): ${removers.shapes.join(" vs ")}`,
  );
  check(
    "...and every one says the same thing under the pointer",
    removers.missingHover.length === 0,
    removers.missingHover.length
      ? `no hover fill on: ${removers.missingHover.join(", ")}`
      : `${removers.count} on --surface-2`,
  );
  check(
    "no row-remover borrows the colour that means 'the keyboard is here'",
    removers.wrongHover.length === 0,
    removers.wrongHover.length ? removers.wrongHover.join(", ") : "none on --surface-3",
  );
  // A NUMBER, BECAUSE "ALL THE SAME SHAPE" SURVIVES SHRINKING ALL OF THEM.
  // A control proved that twice over. Dropping the kit's glyph size to the
  // text size leaves every remover agreeing with every other, so the shape
  // check stayed green while the target got smaller — and the first floor
  // written here, 21px, was then ALSO too generous: the shrunk button
  // measures 22. Both numbers are measured rather than reasoned, which is
  // the only way a threshold is worth anything: `py-1` is 26px and `py-0.5`
  // is 22px, so the floor sits between them.
  //
  // The size is the one value in this version with an argument already
  // recorded behind it — the Variable Manager grew its own ✕ because it was
  // "the smallest destructive control in the app" — so the argument is what
  // gets asserted, rather than the padding string that happens to produce it.
  check(
    "a row-remover is a real target, not a 12px glyph with no padding",
    removers.heights.every((h) => h >= 24),
    `heights ${[...new Set(removers.heights)].join(", ")}px (floor 24, and 22 is the shrunk one)`,
  );

  /* ── every placeholder in the app, at once (v0.84.0) ───────────── */

  // WHY A SWEEP AND NOT ANOTHER SINGLE FIELD. v0.81.2 measured one box
  // whose placeholder read as real content, fixed it, and left a comment
  // calling `--text-3` the colour every other placeholder uses. It was not:
  // eleven of twenty-one fields were on the browser's own default. A check
  // written for one field would have kept passing while ten others were
  // wrong, so this one asks the property of every placeholder that happens
  // to be mounted — and says how many it looked at, so a screen this
  // fixture never opens is visibly not covered rather than silently passing.
  const sweepHints = () =>
    api(() => {
      // Live-resolved, not a hex: asserting a literal would pass the day the
      // token moves and the placeholders do not follow it.
      const probe = document.createElement("div");
      probe.style.color = "var(--text-3)";
      document.body.appendChild(probe);
      const muted = getComputedStyle(probe).color;
      probe.remove();

      const fields = [...document.querySelectorAll("[placeholder]")];
      return {
        muted,
        seen: fields.map((f) => (f.getAttribute("placeholder") || "").slice(0, 28)),
        wrong: fields
          .filter((f) => getComputedStyle(f, "::placeholder").color !== muted)
          .map(
            (f) =>
              `${f.tagName.toLowerCase()}("${(f.getAttribute("placeholder") || "").slice(0, 24)}")=${
                getComputedStyle(f, "::placeholder").color
              }`,
          ),
      };
    });

  // THREE FIELDS IS NOT A SWEEP. The Inspector alone has three placeholders
  // mounted and the first version of this check measured those and called
  // it app-wide. The dialogs hold most of the rest — the Variable Manager
  // has four, the stylesheet one, New Project one — so the sweep runs on
  // each screen and the counts add up, and the failure message names every
  // hint it read so a screen this fixture never opens is visibly absent
  // rather than silently passing.
  const hints = await sweepHints();
  const hintsSeen = new Set(hints.seen);
  const wrong = [...hints.wrong];

  // A VARIABLE FIRST, or the Variable Manager draws an empty shelf and its
  // four fields — name, printed-as, initial value, the value cell — are
  // never mounted. The first run of this sweep opened that dialog, measured
  // nothing inside it, and reported five hints as though that were the app.
  await api(() => {
    window.__scriareProjectStore.getState().createVariable?.("Trust", "number");
  });
  await wait(220);

  for (const open of ["openVariableManager", "openStylesheet", "openSettings"]) {
    await api(async (name) => {
      const w = (ms) => new Promise((r) => setTimeout(r, ms));
      window.__scriareUIStore.getState()[name]?.();
      await w(260);
    }, open);
    // AND OPEN WHAT FOLDS. The Variable Manager's five fields live inside a
    // collapsed row, so a sweep that only opens the dialog measures its
    // shelf. Same lesson as the Inspector's accordion, one screen over.
    await api(async () => {
      const w = (ms) => new Promise((r) => setTimeout(r, ms));
      const row = document.querySelector("[data-variable-id] button");
      if (row) row.click();
      await w(240);
    });
    const round = await sweepHints();
    round.seen.forEach((s) => hintsSeen.add(s));
    wrong.push(...round.wrong);
    await closeAll();
    await wait(200);
  }

  check(
    "the placeholder sweep covered most of the app's fields",
    hintsSeen.size >= 8,
    `${hintsSeen.size} distinct hints: ${[...hintsSeen].join(" · ")}`,
  );
  check(
    "every placeholder measured is the app's own hint colour, not the browser's",
    wrong.length === 0,
    `${hintsSeen.size - wrong.length} clean of ${hintsSeen.size} on ${hints.muted}${
      wrong.length ? ` · ${[...new Set(wrong)].join(" | ")}` : ""
    }`,
  );

  /* ── hand the app back, at the END ──────────────────────────────── */

  // THE HANDBACK HAS TO BE LAST, and this spec learned that the hard way:
  // v0.84.0 appended three blocks of checks AFTER the reseed that used to
  // close this file, so the next spec inherited a choice block inserted
  // into scene one, a variable called Trust and whatever dialog the last
  // loop had open. It failed four specs later, in a toast queue, which is
  // exactly as hard to trace as it sounds. A spec that leaves state behind
  // is a spec that breaks a different file.
  await closeAll();
  await api(() => window.__scriareToastStore?.setState?.({ toasts: [] }));
  await seedProject();
  await wait(200);
  check(
    "the workspace is handed back to the next spec",
    await api(() => {
      const project = window.__scriareProjectStore.getState().project;
      return Boolean(project) && project.variables.length === 0;
    }),
    "a project, with none of this spec's leavings in it",
  );
}
