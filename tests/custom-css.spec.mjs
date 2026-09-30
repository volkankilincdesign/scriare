/**
 * The story's own stylesheet (v0.80.0).
 *
 * THE ONE CLAIM EVERYTHING ELSE RESTS ON: a writer's plain
 * `.scriare-choice { background: ... }` beats the app's own painting of
 * that choice, with no `!important` and no knowledge of specificity. It is
 * asserted against the REAL exported file, opened in a window of its own,
 * by reading the computed background off the button a reader would click —
 * not by looking for the rule in the text of the file, which would prove
 * only that a string was written.
 *
 * The mechanism is cascade layers, and the two halves of it are measured
 * separately at the top of this file, because if either turns out not to
 * hold in the browser the app actually ships, the whole design is wrong
 * rather than slightly off:
 *
 *   1. an UNLAYERED rule beats a LAYERED one of higher specificity
 *   2. an INLINE style still beats an unlayered rule
 *
 * (2) is why Choice Styles had to move out of inline styles at all. It is
 * asserted here rather than assumed so that the next person to wonder why
 * a perfectly good inline style was replaced has the answer in a test.
 */

function fixture(stylesheet) {
  const now = new Date().toISOString();
  const paragraph = (content) => ({ type: "paragraph", content });
  const text = (value) => ({ type: "text", text: value });
  const option = (optionId, label, style) => ({
    type: "choiceOption",
    attrs: {
      optionId,
      targetSceneId: "two",
      style,
      conditions: [],
      actions: [],
      whenUnmet: "hide",
    },
    content: [paragraph([text(label)])],
  });

  return {
    id: "cssfixture",
    name: "The Glasshouse",
    createdAt: now,
    updatedAt: now,
    startSceneId: "one",
    stylesheet,
    choiceStyles: [
      { id: "default", name: "Default", box: { fill: null, border: null, borderWidth: 1, radius: 6 } },
      {
        id: "loud",
        name: "Loud",
        // A fill nothing else in this story or the app uses, so a computed
        // colour equal to it can only have come from this style.
        box: { fill: "#6b1f1f", border: "#6b1f1f", borderWidth: 3, radius: 2 },
      },
    ],
    scenes: [
      {
        id: "one",
        title: "The Glasshouse",
        position: { x: 0, y: 0 },
        frameId: null,
        order: 0,
        content: {
          type: "doc",
          content: [
            // A heading, so the writer's plain `h2` rule has something to
            // beat the app's own `.scriare-prose h2` on.
            { type: "heading", attrs: { level: 2 }, content: [text("Under glass")] },
            paragraph([text("The panes are warm.")]),
            {
              type: "choiceBlock",
              attrs: { blockId: "b1" },
              content: [
                // Two choices wearing ONE style and a third wearing the
                // default: the point of the box table is that the first two
                // share a rule rather than carrying a copy each.
                option("o1", "Break it", { styleId: "loud" }),
                option("o2", "Break it again", { styleId: "loud" }),
                option("o3", "Leave", null),
              ],
            },
          ],
        },
      },
      {
        id: "two",
        title: "Outside",
        position: { x: 300, y: 0 },
        frameId: null,
        order: 1,
        content: { type: "doc", content: [paragraph([text("Cold.")])] },
      },
    ],
    content: [],
    favorites: [],
    variables: [],
    entities: [],
  };
}

const WRITER_CSS = `
/* Plain, low-specificity, no !important — exactly what a writer types. */
.scriare-choice { background: rgb(0, 128, 0); }
.scriare-prose { letter-spacing: 0.5px; }
/* DELIBERATELY WEAKER than the rule it has to beat. The app's own
   stylesheet says \`.scriare-prose h2 { color: var(--text) }\` — a
   two-part selector against this one-part one — so on specificity alone
   the writer loses. Layers are what make them win anyway, and this is the
   line that proves it: without the app's stylesheet being in a layer, a
   writer's plain element rule is silently outranked by any app rule that
   happens to be written as a descendant. */
h2 { color: rgb(1, 2, 3); }
`;

export default async function run({ api, check, openExported }) {
  /* ── the mechanism, before anything is built on it ────────────── */

  const cascade = await api(() => {
    const host = document.createElement("div");
    host.id = "css-probe";
    document.body.appendChild(host);
    const style = document.createElement("style");
    style.textContent = `
@layer probe.a, probe.b;
@layer probe.b { #css-probe .p[data-x="1"].p { background-color: rgb(2, 2, 2); } }
#css-probe .p { background-color: rgb(3, 3, 3); }`;
    document.head.appendChild(style);
    const el = document.createElement("div");
    el.className = "p";
    el.setAttribute("data-x", "1");
    host.appendChild(el);
    const unlayeredWins = getComputedStyle(el).backgroundColor;
    el.style.backgroundColor = "rgb(4, 4, 4)";
    const inlineWins = getComputedStyle(el).backgroundColor;
    style.remove();
    host.remove();
    return { unlayeredWins, inlineWins };
  });

  check(
    "an unlayered rule beats a layered one of higher specificity",
    cascade.unlayeredWins === "rgb(3, 3, 3)",
    cascade.unlayeredWins,
  );
  check(
    "an inline style still beats an unlayered rule — why Choice Styles had to move",
    cascade.inlineWins === "rgb(4, 4, 4)",
    cascade.inlineWins,
  );

  /* ── the exported page ────────────────────────────────────────── */

  const built = await api((project) => {
    const X = window.__scriareExport;
    const story = X.buildExportStory(project);
    return { html: X.buildExportHtml(story), boxes: Object.keys(story.boxes).length };
  }, fixture(WRITER_CSS));

  check(
    "one rule per distinct box, not one per choice",
    built.boxes === 2,
    `${built.boxes} boxes for 3 choices in 2 styles`,
  );
  check(
    "the writer's stylesheet is in the file, outside every layer",
    /rgb\(0, 128, 0\)/.test(built.html) &&
      built.html.lastIndexOf("rgb(0, 128, 0)") > built.html.lastIndexOf("@layer"),
    "unlayered and last",
  );

  const page = await openExported(built.html);

  const painted = await page.evaluate(() => {
    const button = document.querySelector(".scriare-choice");
    return {
      background: getComputedStyle(button).backgroundColor,
      // The Choice Style's own border and radius are untouched by the
      // writer's rule and must survive it: overriding one property is not
      // the same as discarding the style.
      borderWidth: getComputedStyle(button).borderWidth,
      radius: getComputedStyle(button).borderTopLeftRadius,
      prose: getComputedStyle(document.querySelector(".scriare-prose")).letterSpacing,
      heading: getComputedStyle(document.querySelector(".scriare-prose h2")).color,
      classes: button.className,
      inline: button.getAttribute("style"),
    };
  });

  check(
    "the writer's plain rule beats the Choice Style, with no !important",
    painted.background === "rgb(0, 128, 0)",
    painted.background,
  );
  check(
    "...and the rest of that style is still there — one property changed, not the lot",
    painted.borderWidth === "3px" && painted.radius === "2px",
    `${painted.borderWidth} / ${painted.radius}`,
  );
  check("a rule on the prose reaches the prose", painted.prose === "0.5px", painted.prose);
  check(
    "a writer's plainer rule beats a more specific one of the app's",
    painted.heading === "rgb(1, 2, 3)",
    painted.heading,
  );
  check(
    "no choice carries an inline style any more",
    painted.inline === null || !/background/i.test(painted.inline),
    String(painted.inline),
  );

  /* ── a stylesheet that tries to end its own element ───────────── */

  const escaped = await api((project) => {
    const X = window.__scriareExport;
    return X.buildExportHtml(X.buildExportStory(project));
    // A `content:` string was the first fixture here and it proved nothing:
    // `content` DISPLAYS its string, so "escaped" appeared on the page
    // whether or not the element had ended early. What actually proves the
    // element survived is a rule written AFTER the sequence still applying,
    // plus no stray markup having been parsed out of it.
  }, fixture('/* </style><b>escaped</b> */\n.scriare-prose { letter-spacing: 3px; }'));

  const escapedPage = await openExported(escaped);
  const spill = await escapedPage.evaluate(() => ({
    afterward: getComputedStyle(document.querySelector(".scriare-prose")).letterSpacing,
    bolds: document.querySelectorAll("b").length,
    // The PAGE's text, not the body's. `document.body.textContent` picks
    // up the inline script too, and the first version of this check went
    // red because the writer's CSS was visible inside `var STORY = …` —
    // which was not a spill, and was a real defect: the stylesheet was
    // being shipped twice. It is not on the embedded story any more.
    readerSees: document.querySelector(".scriare-page").textContent,
    embedded: /escaped/.test(document.querySelector("script").textContent),
  }));
  check(
    "a </style> inside the stylesheet does not end the element early",
    spill.afterward === "3px" && spill.bolds === 0 && !spill.readerSees.includes("escaped"),
    `rule after it: ${spill.afterward}, stray <b>: ${spill.bolds}`,
  );
  check(
    "...and the stylesheet is in the page once, not also inside the story data",
    spill.embedded === false,
  );

  /* ── what the stylesheet costs, as the app reports it ─────────── */

  const notes = await api(() => {
    const N = window.__scriareStylesheetNotes;
    return {
      remote: N.remoteFetches("@import url('https://fonts.example/x.css'); .a { background: url(//cdn.example/i.png); }"),
      relative: N.remoteFetches(".a { background: url(./logo.png); }"),
      dataUri: N.remoteFetches("@import url('data:text/css,.a{}');"),
      overrides: N.overriddenGroundTokens(":root { --page: #000; --nope: 1; }"),
      none: N.overriddenGroundTokens(".scriare-page { background: #000; }"),
    };
  });

  check(
    "an @import and a protocol-relative url are both reported",
    notes.remote.length === 2,
    JSON.stringify(notes.remote),
  );
  check(
    "a file beside the page is not — it is not the network",
    notes.relative.length === 0,
    JSON.stringify(notes.relative),
  );
  check(
    "a data: URI is not either — it fetches nothing",
    notes.dataUri.length === 0,
    JSON.stringify(notes.dataUri),
  );
  check(
    "a redefined ground token is noticed, and an invented one is not",
    notes.overrides.length === 1 && notes.overrides[0] === "--page",
    JSON.stringify(notes.overrides),
  );
  check(
    "styling a ground's ELEMENT is not redefining the ground",
    notes.none.length === 0,
    JSON.stringify(notes.none),
  );

  /* ── Play Mode wears it, and can take it off ──────────────────── */

  await api((project) => {
    // Straight into the store, like every other spec: the file dialogs a
    // real open would go through cannot be driven headless.
    window.__scriareProjectStore.setState({
      project: window.__scriareProjectTypes.normalizeProject(project),
      filePath: null,
      saveStatus: "saved",
    });
  }, fixture(WRITER_CSS));
  await new Promise((r) => setTimeout(r, 150));

  const play = await api(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    window.__scriareProjectStore.getState().startPlay();
    await wait(260);

    const read = () => {
      const button = document.querySelector("[data-play-root] .scriare-choice");
      return button ? getComputedStyle(button).backgroundColor : null;
    };
    const on = read();

    const chosen = document.querySelector("[data-play-css-switch]");
    if (chosen) chosen.click();
    await wait(180);
    const off = read();
    if (chosen) chosen.click();
    await wait(180);

    window.__scriareProjectStore.getState().exitPlay();
    await wait(120);
    return { on, off, hadSwitch: Boolean(chosen) };
  });

  check("Play Mode has a switch for the stylesheet", play.hadSwitch === true);
  check(
    "a choice in Play Mode wears the writer's rule",
    play.on === "rgb(0, 128, 0)",
    String(play.on),
  );
  check(
    "...and the switch takes it off, back to the Choice Style underneath",
    play.off === "rgb(107, 31, 31)",
    String(play.off),
  );

  /* ── the Export dialog holds the door ─────────────────────────── */

  const gate = await api(async (project) => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    window.__scriareProjectStore.setState({
      project: window.__scriareProjectTypes.normalizeProject(project),
      filePath: null,
      saveStatus: "saved",
    });
    await wait(80);
    window.__scriareUIStore.getState().openExport();
    await wait(200);

    // BY ITS OWN HANDLE, not by reading every button on screen. The first
    // version of this matched on the text "Export" and found the TOP
    // BAR's button — which is never disabled, so the check passed while
    // measuring the wrong control. The same mistake the slash-menu
    // controls made in v0.78.0.
    const exportButton = document.querySelector("[data-export-go]");
    const listed = document.querySelector("[data-export-css-fetches]");
    const tick = document.querySelector("[data-export-css-ack]");
    const before = exportButton ? exportButton.disabled : null;
    if (tick) {
      tick.click();
      await wait(150);
    }
    const after = exportButton ? exportButton.disabled : null;

    window.__scriareUIStore.getState().closeExport();
    await wait(120);
    return { listed: Boolean(listed), hadTick: Boolean(tick), before, after };
  }, fixture("@import url('https://fonts.example/x.css');\n.scriare-page { color: red; }"));

  check("a stylesheet that fetches is named in the Export dialog", gate.listed === true);
  check(
    "Export is held until the writer has read what it costs",
    gate.hadTick === true && gate.before === true,
    `tick: ${gate.hadTick}, disabled: ${gate.before}`,
  );
  check(
    "...and goes ahead once they say they meant it",
    gate.after === false,
    `disabled after ticking: ${gate.after}`,
  );

  const noGate = await api(async (project) => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    window.__scriareProjectStore.setState({
      project: window.__scriareProjectTypes.normalizeProject(project),
      filePath: null,
      saveStatus: "saved",
    });
    await wait(80);
    window.__scriareUIStore.getState().openExport();
    await wait(200);
    const exportButton = document.querySelector("[data-export-go]");
    const disabled = exportButton ? exportButton.disabled : null;
    const listed = Boolean(document.querySelector("[data-export-css-fetches]"));
    window.__scriareUIStore.getState().closeExport();
    await wait(120);
    return { disabled, listed };
  }, fixture(WRITER_CSS));

  check(
    "a stylesheet that fetches nothing is not mentioned and holds nothing up",
    noGate.listed === false && noGate.disabled === false,
    `listed: ${noGate.listed}, disabled: ${noGate.disabled}`,
  );

  /* ── the editor's own surface ──────────────────────────────────── */

  // WHAT A PLACEHOLDER LOOKS LIKE, which is a thing no test had ever
  // asked. The example CSS in the empty box rendered close enough to body
  // text that it read as a stylesheet the story already had — under a
  // footer saying the story had none. Asserted as a real difference in
  // computed colour rather than as a class name, because the class is the
  // mechanism and the confusion was about the pixels.
  const box = await api(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    window.__scriareUIStore.getState().openStylesheet();
    await w(240);
    const area = document.querySelector("[data-stylesheet-input]");
    const text = getComputedStyle(area).color;
    const hint = getComputedStyle(area, "::placeholder").color;
    // The colour every other placeholder in the app uses, resolved live
    // rather than written down here — asserting a hex would pass the day
    // the token moved and the placeholder did not follow it.
    const probe = document.createElement("div");
    probe.style.color = "var(--text-3)";
    area.parentElement.appendChild(probe);
    const muted = getComputedStyle(probe).color;
    probe.remove();
    window.__scriareUIStore.getState().closeStylesheet();
    await w(160);
    return { text, hint, muted, hasPlaceholder: Boolean(area?.getAttribute("placeholder")) };
  });

  check("the empty stylesheet shows an example of what to write", box.hasPlaceholder === true);
  // NOT MERELY "DIFFERENT FROM BODY TEXT" — the browser's own default
  // placeholder is different from body text too, and it was the thing
  // that read as content. The property is that this box follows the
  // app's own placeholder colour like every other input does.
  check(
    "...in a colour that cannot be mistaken for CSS already in the story",
    box.hint !== box.text && box.hint === box.muted,
    `${box.hint} against text ${box.text} and the app's own ${box.muted}`,
  );

  /* ── it is part of the story, so it survives the file ─────────── */

  const roundTrip = await api((project) => {
    const P = window.__scriareProjectTypes;
    const reloaded = P.normalizeProject(JSON.parse(JSON.stringify(project)));
    const blanked = P.normalizeProject({ ...JSON.parse(JSON.stringify(project)), stylesheet: "   " });
    const indented = P.normalizeProject({
      ...JSON.parse(JSON.stringify(project)),
      stylesheet: "  .scriare-page { color: red; }",
    });
    return {
      kept: reloaded.stylesheet,
      blanked: blanked.stylesheet,
      indent: indented.stylesheet,
    };
  }, fixture(WRITER_CSS));

  check(
    "a stylesheet survives being written and read back",
    roundTrip.kept === WRITER_CSS,
    "verbatim",
  );
  check(
    "a blank one becomes absent rather than an empty string",
    roundTrip.blanked === undefined,
    String(roundTrip.blanked),
  );
  check(
    "indentation is not tidied away — a tool that re-indents your file is one you stop trusting",
    roundTrip.indent === "  .scriare-page { color: red; }",
    JSON.stringify(roundTrip.indent),
  );
}
