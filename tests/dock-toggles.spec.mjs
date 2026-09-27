/**
 * The control that folds a panel away (v0.45.0, reported).
 *
 * "The docking button on the panels must be consistent across every single
 * theme. They have the same functionality. Make them buttons in every theme,
 * but give them a bit more space."
 *
 * Three panels dock — Content, Inspector, Story Graph — and each had grown
 * its own version: a different glyph at a different size, one of them baked
 * into a header label that was itself the button. On top of that, the
 * Content panel's ghost buttons were being caught by an elevation rule meant
 * for selected rows, so its toggle was drawn as a raised box while the
 * identical control in the Inspector was flat text. Two failures, one
 * symptom: the same job not looking like the same thing.
 *
 * What is checked here is therefore sameness rather than appearance — the
 * three are measured against EACH OTHER, in every theme, so this cannot be
 * satisfied by three controls that happen to match the day they were
 * written. Plus the space that was asked for, and the elevation rule's
 * actual job, which has to keep working.
 */
export default async function ({ page, api, check, seedProject }) {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  await seedProject();
  await wait(600);

  /** The three dock toggles, in panel order, as the DOM has them. */
  const toggles = () =>
    api(() => {
      const find = (name) =>
        [...document.querySelectorAll("button")].find(
          (b) => (b.getAttribute("aria-label") ?? "") === name,
        );
      const describe = (el) => {
        if (!el) return null;
        const box = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        // A border you cannot see is not a border. Computed colours arrive as
        // "oklch(0.23 0.01 75)", "oklch(… / 0.4)" or "rgba(0, 0, 0, 0)", so the
        // alpha is read off whichever shape came back: a transparent border
        // passed the first version of this check, which made it no check at
        // all — confirmed by setting one and watching nothing go red.
        const alphaOf = (colour) => {
          const slash = /\/\s*([\d.]+)\s*\)/.exec(colour);
          if (slash) return Number(slash[1]);
          const rgba = /rgba?\(([^)]+)\)/.exec(colour);
          if (rgba) {
            const parts = rgba[1].split(",").map((v) => Number(v.trim()));
            return parts.length > 3 ? parts[3] : 1;
          }
          return 1;
        };
        return {
          tag: el.tagName,
          name: el.getAttribute("aria-label"),
          w: Math.round(box.width),
          h: Math.round(box.height),
          x: Math.round(box.x),
          y: Math.round(box.y),
          radius: cs.borderTopLeftRadius,
          borderWidth: cs.borderTopWidth,
          borderColor: cs.borderTopColor,
          borderAlpha: alphaOf(cs.borderTopColor),
          background: cs.backgroundColor,
          shadow: cs.boxShadow === "none" ? "none" : "some",
          svg: el.querySelector("svg")
            ? el.querySelector("svg").getAttribute("viewBox")
            : null,
        };
      };
      return {
        content: describe(find("Collapse Content")),
        inspector: describe(find("Collapse Inspector")),
        graph: describe(find("Collapse Story Graph")),
      };
    });

  let r = await toggles();
  check(
    "all three panels have a dock toggle, and each is a real button",
    r.content?.tag === "BUTTON" &&
      r.inspector?.tag === "BUTTON" &&
      r.graph?.tag === "BUTTON",
    JSON.stringify([r.content?.tag, r.inspector?.tag, r.graph?.tag]),
  );
  check(
    "...each with a name that says which panel it folds",
    ["Collapse Content", "Collapse Inspector", "Collapse Story Graph"].every(
      (n) => [r.content?.name, r.inspector?.name, r.graph?.name].includes(n),
    ),
    JSON.stringify([r.content?.name, r.inspector?.name, r.graph?.name]),
  );
  check(
    "...and each draws its chevron rather than typing one",
    [r.content, r.inspector, r.graph].every((t) => t?.svg === "0 0 24 24"),
    JSON.stringify([r.content?.svg, r.inspector?.svg, r.graph?.svg]),
  );

  // 1 — the same object. Measured against each other rather than against
  // numbers written here, so the check is "these three match", which is what
  // was actually reported.
  const sameness = (rows) => {
    const key = (t) =>
      `${t.w}x${t.h} r${t.radius} b${t.borderWidth} ${t.borderColor} ${t.background}`;
    return new Set(rows.map(key)).size === 1;
  };
  check(
    "the three are one control: same size, radius, border and fill",
    sameness([r.content, r.inspector, r.graph]),
    JSON.stringify(
      [r.content, r.inspector, r.graph].map(
        (t) => `${t.w}x${t.h} ${t.borderColor} ${t.background}`,
      ),
    ),
  );
  check(
    "...and each reads as a button rather than as a bare glyph",
    [r.content, r.inspector, r.graph].every(
      (t) =>
        Number.parseFloat(t.borderWidth) >= 1 &&
        t.borderAlpha >= 0.5 &&
        t.borderColor !== t.background,
    ),
    JSON.stringify(
      [r.content, r.inspector, r.graph].map(
        (t) => `${t.borderWidth} ${t.borderColor} on ${t.background}`,
      ),
    ),
  );

  // 2 — in EVERY theme, which is the half of the report that a single
  // measurement would miss: a border that resolves to the same colour as the
  // fill in one palette is a bare glyph again, in that palette only.
  const themes = await api(() =>
    window.__scriareThemes.THEMES.map((t) => t.id),
  );
  const perTheme = [];
  for (const id of themes) {
    await api(
      (t) => window.__scriareThemes.useThemeStore.getState().setTheme(t),
      id,
    );
    await wait(120);
    const t = await toggles();
    perTheme.push({
      id,
      same: sameness([t.content, t.inspector, t.graph]),
      bordered: [t.content, t.inspector, t.graph].every(
        (b) =>
          Number.parseFloat(b.borderWidth) >= 1 &&
          b.borderAlpha >= 0.5 &&
          b.borderColor !== b.background,
      ),
    });
  }
  check(
    "every theme draws all three the same way",
    perTheme.every((t) => t.same),
    JSON.stringify(perTheme.filter((t) => !t.same)),
  );
  check(
    "...and in every theme they are visibly buttons",
    perTheme.every((t) => t.bordered),
    JSON.stringify(perTheme.filter((t) => !t.bordered)),
  );
  await api(() =>
    window.__scriareThemes.useThemeStore.getState().setTheme("dark"),
  );
  await wait(150);

  // 3 — the room that was asked for. The Content toggle was the third item
  // in a row of three, hard against the header's own buttons; the graph's
  // sat directly under the splitter, all but touching the editor above it.
  // Re-aimed in v0.59.0: "+ Scene" and "+ Group" became one "+ New", so the
  // neighbour the toggle must keep its distance from is that button now.
  // The claim is unchanged — only the thing it stands next to is.
  const room = await api(() => {
    const byLabel = (name) =>
      [...document.querySelectorAll("button")].find(
        (b) => (b.getAttribute("aria-label") ?? "") === name,
      );
    const byText = (text) =>
      [...document.querySelectorAll("button")].find(
        (b) => b.textContent?.trim() === text,
      );
    const dock = byLabel("Collapse Content")?.getBoundingClientRect();
    const group = document.querySelector("[data-new-content]")?.getBoundingClientRect();
    const graphDock = byLabel("Collapse Story Graph")?.getBoundingClientRect();
    const splitter = document
      .querySelector('[title="Drag to resize"]')
      ?.getBoundingClientRect();
    return {
      fromGroup: dock && group ? Math.round(dock.x - group.right) : null,
      fromSplitter:
        graphDock && splitter
          ? Math.round(graphDock.y - splitter.bottom)
          : null,
    };
  });
  check(
    "the Content toggle is not crowded against + New",
    room.fromGroup !== null && room.fromGroup >= 8,
    `${room.fromGroup}px`,
  );
  check(
    "the Story Graph toggle is not crowded against the editor above it",
    room.fromSplitter !== null && room.fromSplitter >= 8,
    `${room.fromSplitter}px`,
  );

  // 4 — and they still do the job. A control that looks right and folds
  // nothing is worse than an ugly one that works.
  for (const [name, panel] of [
    ["Collapse Content", ".scriare-panel-l"],
    ["Collapse Inspector", ".scriare-panel-r"],
  ]) {
    const before = await api(
      (sel) => Boolean(document.querySelector(sel)),
      panel,
    );
    await api((n) => {
      [...document.querySelectorAll("button")]
        .find((b) => (b.getAttribute("aria-label") ?? "") === n)
        ?.click();
    }, name);
    await wait(300);
    const after = await api(
      (sel) => Boolean(document.querySelector(sel)),
      panel,
    );
    check(
      `${name} folds its panel away`,
      before === true && after === false,
      `${before} → ${after}`,
    );

    // Coming back is the same control in its collapsed form — one wide
    // strip, with the same box drawn inside it.
    const back = await api(() => {
      const strip = [...document.querySelectorAll("button")].find((b) =>
        (b.getAttribute("title") ?? "").startsWith("Expand"),
      );
      return strip
        ? {
            title: strip.title,
            hasBox: Boolean(strip.querySelector(".scriare-dock-btn")),
          }
        : null;
    });
    check(
      `...and the collapsed strip shows the same control`,
      back !== null && back.hasBox === true,
      JSON.stringify(back),
    );
    await api(() => {
      [...document.querySelectorAll("button")]
        .find((b) => (b.getAttribute("title") ?? "").startsWith("Expand"))
        ?.click();
    });
    await wait(300);
  }

  // 5 — the elevation rule this shook loose still does its own job: a
  // selected row rises, and a button in the same panel that merely lights
  // up on hover does not. Both halves, because the fix was to stop the
  // second from happening without stopping the first.
  //
  // v0.59.0 re-aimed the second half. It used to watch "+ Scene", a ghost
  // button that drew no border; its replacement, "+ New", DOES draw the
  // border token, and index.css's rule is explicit that anything drawing
  // that border is a made object and gets the lift — so the button rising
  // is the rule working, not the bug returning. The claim itself is
  // unchanged and still worth guarding, so it now watches a tree row,
  // which is the kind of control the v0.45.0 report was actually about.
  const lift = await api(() => {
    const panel = document.querySelector(".scriare-panel-l");
    const row = document.querySelector(".scriare-panel-l .scriare-row-on");
    // Two probes rather than whichever buttons happen to be on screen at
    // this point in the spec: the claim is about the RULE — a control that
    // draws the border token is a made object and rises; one that only
    // lights up on hover is a ghost and stays flat — and a probe of each
    // kind measures exactly that, in the real stylesheet, in this panel.
    const probe = (className) => {
      const el = document.createElement("button");
      el.className = className;
      panel.appendChild(el);
      const shadow = getComputedStyle(el).boxShadow;
      el.remove();
      return shadow;
    };
    return {
      row: row ? getComputedStyle(row).boxShadow !== "none" : null,
      ghost: probe("rounded px-1.5 text-xs hover:bg-[var(--surface-2)]"),
      made: probe("rounded border border-[var(--border)] px-2 py-0.5 text-xs"),
    };
  });
  check(
    "a made object in the panel rises — the rule still applies to bordered controls",
    lift.made !== "none",
    String(lift.made).slice(0, 40),
  );
  check(
    "a selected row in Content still rises off the panel",
    lift.row === true,
    JSON.stringify(lift.row),
  );
  check(
    "...while a button that merely lights up on hover stays flat",
    lift.ghost === "none",
    String(lift.ghost),
  );

  await seedProject();
  await wait(200);
}
