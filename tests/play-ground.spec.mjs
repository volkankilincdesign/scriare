/**
 * Play Mode reads on a reading ground (v0.57.0).
 *
 * The claim is not "a ground attribute is set". It is that what the writer
 * sees in Play is what the exported file paints — so almost everything
 * here reads COMPUTED values off the live Play surface and compares them
 * with the export's own table (`__scriareExport.GROUND_TOKENS`, the same
 * constant the exported stylesheet is built from), and with the app theme
 * that must no longer reach in.
 *
 * The measurement that started this version, kept as the first check: with
 * the app in Phosphor, Play used to paint --page oklch(15% 0.016 150).
 */
export default async function run({ api, check, seedProject }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const setTheme = (t) =>
    api((theme) => window.__scriareThemes.useThemeStore.getState().setTheme(theme), t);
  const setGround = (g) =>
    api((ground) => window.__scriarePlayGround.getState().setGround(ground), g);
  const play = async () => {
    await api(() => window.__scriareProjectStore.getState().startPlay());
    await wait(220);
  };
  const stop = async () => {
    await api(() => window.__scriareProjectStore.getState().exitPlay());
    await wait(120);
  };

  /** What the Play surface is actually painted in, right now. */
  const painted = () =>
    api(() => {
      const root = document.querySelector("[data-play-root]");
      if (!root) return null;
      const cs = getComputedStyle(root);
      const doc = getComputedStyle(document.documentElement);
      const token = (name) => cs.getPropertyValue(name).trim();
      const button = root.querySelector("[data-play-ground-switch]");
      return {
        ground: root.getAttribute("data-ground"),
        page: token("--page"),
        bg: token("--bg"),
        text: token("--text"),
        textReading: token("--text-reading"),
        accent: token("--accent"),
        border: token("--border"),
        highlight: token("--highlight"),
        accentTextOn: token("--accent-text-on"),
        surface: token("--surface"),
        shadowRaised: token("--shadow-raised"),
        colorScheme: cs.colorScheme,
        themePage: doc.getPropertyValue("--page").trim(),
        themeAccent: doc.getPropertyValue("--accent").trim(),
        switchLabel: button ? button.textContent.trim() : null,
        switchAria: button ? button.getAttribute("aria-label") : null,
      };
    });

  /** The export's own table, read from the app rather than copied here. */
  const table = await api(() => {
    const { GROUND_TOKENS, DEFAULT_GROUND, READING_GROUNDS } = window.__scriareExport;
    const values = {};
    for (const id of Object.keys(GROUND_TOKENS)) {
      values[id] = Object.fromEntries(
        GROUND_TOKENS[id]
          .split(";")
          .map((line) => line.trim())
          .filter((line) => line.startsWith("--"))
          .map((line) => {
            const at = line.indexOf(":");
            return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
          }),
      );
    }
    return { values, DEFAULT_GROUND, labels: READING_GROUNDS.map((g) => g.label) };
  });

  await seedProject();

  // ── the contradiction this version exists to remove ───────────────────
  await setTheme("phosphor");
  await setGround("night");
  // What the writer's room is painted in BEFORE Play opens, so the
  // "nothing escaped" checks below have something to compare against
  // while Play is still on screen — the only moment an escaped ground is
  // visible, since the style block leaves with the runtime.
  const roomBefore = await api(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--page").trim(),
  );
  await play();
  const inPhosphor = await painted();

  check(
    "the writer's theme no longer reaches the page they are rehearsing",
    inPhosphor.page !== inPhosphor.themePage && inPhosphor.accent !== inPhosphor.themeAccent,
    `play --page ${inPhosphor.page} vs theme ${inPhosphor.themePage}`,
  );

  check(
    "...and what it paints instead is the export's Night, token for token",
    inPhosphor.page === table.values.night["--page"] &&
      inPhosphor.bg === table.values.night["--bg"] &&
      inPhosphor.text === table.values.night["--text"] &&
      inPhosphor.textReading === table.values.night["--text-reading"] &&
      inPhosphor.accent === table.values.night["--accent"] &&
      inPhosphor.border === table.values.night["--border"] &&
      inPhosphor.highlight === table.values.night["--highlight"],
    `${inPhosphor.page} · ${inPhosphor.accent}`,
  );

  // ── the switch ────────────────────────────────────────────────────────
  check(
    "the bar offers the other ground by name, the way the reader's bar does",
    inPhosphor.switchLabel === "Paper" &&
      inPhosphor.switchAria === "Switch to the Paper ground" &&
      table.labels.includes(inPhosphor.switchLabel),
    `${inPhosphor.switchLabel} — ${inPhosphor.switchAria}`,
  );

  const afterClick = await api(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    document.querySelector("[data-play-ground-switch]").click();
    await w(160);
    const root = document.querySelector("[data-play-root]");
    return {
      ground: root.getAttribute("data-ground"),
      page: getComputedStyle(root).getPropertyValue("--page").trim(),
      label: root.querySelector("[data-play-ground-switch]").textContent.trim(),
      stored: window.localStorage.getItem("scriare.playGround"),
    };
  });

  check(
    "clicking it repaints the page in Paper",
    afterClick.ground === "paper" && afterClick.page === table.values.paper["--page"],
    `${afterClick.ground} · ${afterClick.page}`,
  );

  check(
    "...and the button now offers the way back",
    afterClick.label === "Night",
    afterClick.label,
  );

  const onPaper = await painted();
  check(
    "a light ground says so, so form controls and scrollbars follow it",
    onPaper.colorScheme === "light" && inPhosphor.colorScheme === "dark",
    `paper ${onPaper.colorScheme} · night ${inPhosphor.colorScheme}`,
  );

  // ── the five tokens a ground does not define ──────────────────────────
  check(
    "the tokens a page has no opinion about are derived from the ground, not the theme",
    // --accent-text-on is what the Restart button's label is painted in;
    // on Paper that has to be the light page, never the dark theme value.
    onPaper.accentTextOn === table.values.paper["--page"] &&
      onPaper.surface === table.values.paper["--surface-2"] &&
      onPaper.shadowRaised === table.values.paper["--sheet-shadow"],
    `accent-text-on ${onPaper.accentTextOn}`,
  );

  // ── the one mark the browser paints by itself ─────────────────────────
  const highlight = await api(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    const store = window.__scriareProjectStore;
    const p = store.getState().project;
    store.setState({
      project: {
        ...p,
        scenes: p.scenes.map((s) =>
          s.id === p.scenes[0].id
            ? {
                ...s,
                content: {
                  type: "doc",
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        { type: "text", marks: [{ type: "highlight" }], text: "Four hundred and twelve." },
                      ],
                    },
                  ],
                },
              }
            : s,
        ),
      },
    });
    await w(220);
    const root = document.querySelector("[data-play-root]");
    const mark = root.querySelector("mark");
    if (!mark) return { missing: true };
    // Painted, not matched: a probe painted in the ground's own --highlight
    // is the only thing worth comparing a <mark> against, because both
    // come back as resolved colours in the same spelling.
    const probe = document.createElement("div");
    probe.style.background = "var(--highlight)";
    root.appendChild(probe);
    const want = getComputedStyle(probe).backgroundColor;
    const got = getComputedStyle(mark).backgroundColor;
    probe.remove();
    return { want, got };
  });

  check(
    "a highlighted line is painted in the ground's highlight, not the browser's yellow",
    !highlight.missing && highlight.got === highlight.want && !/255,\s*255,\s*0/.test(highlight.got),
    `${highlight.got} vs ${highlight.want}`,
  );

  // ── remembered, like the reader's ─────────────────────────────────────
  check(
    "the writer's ground is remembered on this machine",
    afterClick.stored === "paper",
    String(afterClick.stored),
  );

  await stop();
  await play();
  const reopened = await painted();
  check(
    "...so pressing Play again returns to the ground they were reading on",
    reopened.ground === "paper" && reopened.page === table.values.paper["--page"],
    `${reopened.ground} · ${reopened.page}`,
  );

  // ── and the theme still owns the room ─────────────────────────────────
  check(
    "the ground stays inside Play — the room behind it keeps the writer's theme",
    // Measured WHILE playing, with Play on Paper: the editor and graph are
    // only CSS-hidden underneath, so a ground scoped one selector too wide
    // repaints them, and the writer sees it the moment they press Esc.
    onPaper.themePage === roomBefore && onPaper.themePage !== table.values.paper["--page"],
    `${onPaper.themePage} (was ${roomBefore})`,
  );

  await stop();
  const editor = await api(() => {
    const doc = getComputedStyle(document.documentElement);
    return {
      page: doc.getPropertyValue("--page").trim(),
      theme: document.documentElement.getAttribute("data-theme"),
      playRoots: document.querySelectorAll("[data-play-root]").length,
    };
  });
  check(
    "leaving Play leaves the writer in their own theme, untouched",
    editor.theme === "phosphor" &&
      editor.page !== table.values.paper["--page"] &&
      editor.page !== table.values.night["--page"] &&
      editor.playRoots === 0,
    `${editor.theme} · ${editor.page}`,
  );

  // ── the default, for a writer who has never switched ──────────────────
  await api(() => window.localStorage.removeItem("scriare.playGround"));
  check(
    "the default ground is the one the exported file opens on",
    table.DEFAULT_GROUND === "night",
    table.DEFAULT_GROUND,
  );

  // ── put it back ───────────────────────────────────────────────────────
  await setGround("night");
  await setTheme("dark");
  await seedProject();
  await wait(120);
  check(
    "the workspace is handed back to the next spec",
    await api(
      () =>
        Boolean(window.__scriareProjectStore.getState().project) &&
        document.documentElement.getAttribute("data-theme") === "dark" &&
        !window.__scriareProjectStore.getState().isPlaying,
    ),
  );

  /* ── a variable with nothing in it ──────────────────────────────── */

  // A `.scriare` file can hold a variable with no `defaultValue`:
  // `normalizeProject` passes the array through untouched, so one written
  // by hand or by a version before that field existed arrives here as
  // undefined. The readout printed the literal word "undefined" at a
  // writer, which is a programmer's word in a HUD — found by looking at a
  // screenshot of Play Mode, where nothing had ever asserted it because
  // every fixture in this suite is a well-formed project.
  //
  // READ OFF THE HUD, not off the formatter. The formatter is where the
  // bug was; the HUD is where a writer met it, and a check that calls the
  // function directly would keep passing the day the readout stopped
  // calling it.
  const malformed = await api(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    const store = window.__scriareProjectStore.getState();
    const before = store.project;
    window.__scriareProjectStore.setState({
      project: {
        ...before,
        // No `defaultValue` on any of them, which is what a hand-edited
        // file or one from an older version actually looks like.
        variables: [
          { id: "n", name: "Trust", type: "number" },
          { id: "s", name: "Note", type: "string" },
          { id: "b", name: "Knows", type: "boolean" },
        ],
      },
    });
    await w(200);
    window.__scriareProjectStore.getState().startPlay();
    await w(320);
    const hud = document.querySelector("[data-play-root] table");
    const text = hud ? hud.textContent : null;
    window.__scriareProjectStore.getState().exitPlay();
    await w(160);
    window.__scriareProjectStore.setState({ project: before });
    await w(160);
    return text;
  });

  check(
    "a variable with no default reads as its type's own zero, never as “undefined”",
    typeof malformed === "string" && !/undefined/.test(malformed),
    JSON.stringify(malformed),
  );
}
