/**
 * The story's own facts (v0.75.0).
 *
 * Three of the five gaps found in the v0.63.0 audit were the same gap:
 * Project Settings held theme, start scene and choice styles, so there was
 * nowhere to put a title, an author, a language or the protagonist's name —
 * and every one of those is a fact about the story rather than about the
 * app. The player was hard-coded "You" and the exported page shipped with
 * no `lang` attribute, both of them for want of a field.
 *
 * What is checked here is what the fields DO, not that they exist: a name
 * that reaches the prose, a tag that reaches the page, an author that
 * reaches the file's metadata and not its first paragraph — and the three
 * ways an empty field could quietly go wrong.
 */
export default async function ({ page, api, check, seedProject, app }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await seedProject();

  // STATE THE WINDOW, DO NOT INHERIT IT. Project Settings is 713px tall
  // now, so on whatever size the previous spec happened to leave, the
  // dialog scrolls and a click lands on the scrim instead of the button —
  // which is how this spec first failed, in the full run only, having
  // passed alone. Handed back at the end.
  const win = await app.browserWindow(page);
  await win.evaluate((w) => w.setBounds({ x: 0, y: 0, width: 1280, height: 900 }));
  await wait(250);

  // ── 1. round trip, and what "unset" is stored as ──────────────────────
  let r = await api(() => {
    const store = window.__scriareProjectStore;
    store.getState().setStoryDetails({
      name: "  The Blue Hour  ",
      author: "  Volkan Kılınç ",
      language: "tr",
      playerName: "  Detective  ",
    });
    const set = store.getState().project;
    const saved = JSON.parse(JSON.stringify(set));
    const reopened = window.__scriareProjectTypes.normalizeProject(saved);
    return {
      name: set.name,
      author: set.author,
      language: set.language,
      playerName: set.playerName,
      afterReopen: {
        name: reopened.name,
        author: reopened.author,
        language: reopened.language,
        playerName: reopened.playerName,
      },
    };
  });
  check("the story's facts are kept, trimmed",
    r.name === "The Blue Hour" && r.author === "Volkan Kılınç" &&
      r.language === "tr" && r.playerName === "Detective",
    JSON.stringify({ name: r.name, author: r.author, language: r.language, player: r.playerName }));
  check("...and survive a save and a reopen unchanged",
    JSON.stringify(r.afterReopen) ===
      JSON.stringify({ name: "The Blue Hour", author: "Volkan Kılınç", language: "tr", playerName: "Detective" }),
    JSON.stringify(r.afterReopen));

  // An emptied field must be ABSENT, not "". Two spellings of unset in one
  // file means every reader of these fields has to know about both.
  r = await api(() => {
    const store = window.__scriareProjectStore;
    store.getState().setStoryDetails({ author: "   ", language: "", playerName: "" });
    const p = store.getState().project;
    return {
      keys: Object.keys(p).filter((k) => ["author", "language", "playerName"].includes(k)),
      values: [p.author, p.language, p.playerName],
      json: JSON.stringify({ a: p.author, l: p.language, n: p.playerName }),
    };
  });
  check("an emptied field is absent, not an empty string",
    r.values.every((v) => v === undefined), r.json);

  // The title is the one that may not become nothing: the top bar, the
  // shelf and the exported page's <title> all print it.
  r = await api(() => {
    const store = window.__scriareProjectStore;
    store.getState().setStoryDetails({ name: "   " });
    return store.getState().project.name;
  });
  check("a title cannot be emptied by a stray Backspace", r === "The Blue Hour", `"${r}"`);

  // Opening the dialog and changing nothing is not an edit.
  r = await api(() => {
    const store = window.__scriareProjectStore;
    const before = store.getState().saveStatus;
    store.setState({ saveStatus: "saved" });
    const p = store.getState().project;
    store.getState().setStoryDetails({
      name: p.name, author: p.author ?? "", language: p.language ?? "", playerName: p.playerName ?? "",
    });
    return { before, after: store.getState().saveStatus };
  });
  check("saving a dialog you changed nothing in does not dirty the file",
    r.after === "saved", `saveStatus ${r.after}`);

  // ── 2. the player's name reaches the prose ────────────────────────────
  //
  // Not "the field holds Detective" — what matters is the name printed in
  // front of the line, in Play Mode and in the export, which is one shared
  // pass over the document.
  r = await api(() => {
    const { applySpeakerPrefixes } = window.__scriareSpeakerLines;
    const { PLAYER_SPEAKER } = window.__scriareSpeaker;
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { speaker: PLAYER_SPEAKER },
          content: [{ type: "text", text: "I know what you did." }],
        },
      ],
    };
    const text = (d) => JSON.stringify(d);
    return {
      named: text(applySpeakerPrefixes(doc, [], "Detective")),
      unnamed: text(applySpeakerPrefixes(doc, [], undefined)),
      blank: text(applySpeakerPrefixes(doc, [], "   ")),
    };
  });
  check("a named protagonist is named in front of their line",
    r.named.includes("Detective") && !r.named.includes('"You"'), "Detective");
  check("...and a story that has not said still prints You — the control",
    r.unnamed.includes("You"), "You");
  check("...as does one whose name is all spaces",
    r.blank.includes("You"), "You");

  // ── 3. the exported page ──────────────────────────────────────────────
  r = await api(() => {
    const X = window.__scriareExport;
    const store = window.__scriareProjectStore;
    const base = store.getState().project;
    const build = (extra) =>
      X.buildExportHtml(X.buildExportStory({ ...base, ...extra }));
    const withBoth = build({ name: "Mavi Saat", author: "Volkan Kılınç", language: "tr" });
    const withNeither = build({ name: "Mavi Saat", author: undefined, language: undefined });
    const pick = (html, re) => (html.match(re) ?? [])[0] ?? null;
    return {
      lang: pick(withBoth, /<html[^>]*>/),
      noLang: pick(withNeither, /<html[^>]*>/),
      author: pick(withBoth, /<meta name="author"[^>]*>/),
      noAuthor: pick(withNeither, /<meta name="author"[^>]*>/),
      // The author belongs to the FILE, not to the first page of the story.
      //
      // Measured on the MARKUP, with the embedded story data stripped out
      // first. The page carries the whole story as JSON in a script tag,
      // author included — so a plain substring search over the body finds
      // the name whether or not a single pixel of it is ever drawn, and
      // would have passed a version that printed a byline over the first
      // paragraph. Asked wrongly the first time, and the control is what
      // said so.
      body: (withBoth.split("</head>")[1] ?? "").replace(/<script[\s\S]*?<\/script>/g, ""),
    };
  });
  check("the exported page says what language the story is in",
    r.lang === '<html lang="tr">', r.lang);
  check("...and a story that has not said ships no lang at all — the control",
    r.noLang === "<html>", r.noLang);
  check("the author reaches the page as metadata",
    r.author === '<meta name="author" content="Volkan Kılınç">', r.author);
  check("...and is absent when nobody is named",
    r.noAuthor === null, String(r.noAuthor));
  check("...and is never printed over the writer's first paragraph",
    !r.body.includes("Volkan"), "no byline in the drawn page");

  // ── 4. the dialogs ────────────────────────────────────────────────────
  //
  // Appearance is not a project setting: it is remembered per machine and
  // never written to the file. It has its own dialog now, and Project
  // Settings offers the door rather than the swatches.
  // EVERY OTHER DIALOG CLOSED FIRST, and then checked.
  //
  // This spec passed alone and failed in the full run, with the click on
  // the Appearance row landing on a modal scrim rather than the button.
  // Specs share one application instance, so the state this one inherits
  // is whatever the spec before it left — and a second dialog renders a
  // second scrim over this one. Closing them all fixed it; the check below
  // turns the assumption into something the run states rather than
  // something I am trusting.
  await api(() => {
    const ui = window.__scriareUIStore.getState();
    ui.closeVariableManager();
    ui.closeChoiceStyles();
    ui.closeStoryCheck();
    ui.closeExport();
    ui.closePreferences();
    ui.closeSettings();
  });
  await wait(300);
  const stray = await page.evaluate(() => document.querySelectorAll('[role="dialog"]').length);
  check("no other dialog is in the way — the precondition", stray === 0, `${stray} open`);

  await api(() => window.__scriareUIStore.getState().openSettings());
  await wait(400);
  let dom = await page.evaluate(() => ({
    title: document.querySelector("[data-story-title]")?.value ?? null,
    author: document.querySelector("[data-story-author]")?.value ?? null,
    language: document.querySelector("[data-story-language]")?.value ?? null,
    player: document.querySelector("[data-story-player]")?.value ?? null,
    swatches: document.querySelectorAll('[role="dialog"] [data-theme]').length,
    door: Boolean(document.querySelector("[data-open-preferences]")),
  }));
  check("Project Settings holds the story's own facts",
    dom.title !== null && dom.author !== null && dom.language !== null && dom.player !== null,
    JSON.stringify(dom));
  check("...and no longer holds the theme picker",
    dom.swatches === 0 && dom.door === true,
    `${dom.swatches} swatches, door: ${dom.door}`);

  // Scrolled to first: the card is taller than a short window and
  // `overflow-y-auto` is doing its job, so the button can genuinely be
  // below the fold.
  await page.locator("[data-open-preferences]").scrollIntoViewIfNeeded();
  await page.click("[data-open-preferences]");
  await wait(400);
  dom = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    return {
      heading: dialog?.querySelector("h2, h3")?.textContent?.trim() ?? null,
      swatches: dialog?.querySelectorAll("[data-theme]").length ?? 0,
    };
  });
  check("Preferences is where the themes went",
    dom.swatches >= 8, `${dom.swatches} swatches under "${dom.heading}"`);

  // ── 5. a child dialog says what it is part of, in one place ───────────
  //
  // Reported: Choice Styles drew the way back as a line above its heading
  // and Preferences as a ghost button in the footer, eight versions after
  // v0.55.0 settled which it should be. The rule had exactly one dialog
  // obeying it and no check, so the second one drifted.
  //
  // Checked on EVERY dialog that has a parent, not on the one that
  // prompted the report — the whole failure was a rule stated once and
  // applied once.
  const backShape = () =>
    page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return null;
      const link = dialog.querySelector("[data-dialog-back]");
      const heading = dialog.querySelector("h2, h3");
      const buttons = [...dialog.querySelectorAll("button")];
      // The footer is the last row of buttons in the card. Its job is the
      // dialog's commitments, and nothing else belongs in it.
      const footer = dialog.querySelector(".justify-end");
      return {
        title: heading?.textContent?.trim() ?? null,
        hasLink: Boolean(link),
        // Above the heading, which is what makes it a breadcrumb rather
        // than one more thing to press.
        aboveHeading:
          link && heading
            ? link.getBoundingClientRect().bottom <= heading.getBoundingClientRect().top + 1
            : false,
        footerButtons: footer ? [...footer.querySelectorAll("button")].map((b) => b.textContent.trim()) : [],
        strayBack: buttons
          .filter((b) => !b.hasAttribute("data-dialog-back"))
          .map((b) => b.textContent.trim())
          .filter((t) => /back/i.test(t)),
      };
    });

  let shape = await backShape();
  check("Preferences names the dialog it came from",
    shape?.hasLink === true, `link: ${shape?.hasLink}`);
  check("...above its own heading, not among the buttons",
    shape?.aboveHeading === true && shape?.strayBack.length === 0,
    `above: ${shape?.aboveHeading}, stray: ${shape?.strayBack.join(", ") || "none"}`);
  check("...leaving the footer to say only that you are done",
    shape?.footerButtons.length === 1, shape?.footerButtons.join(" / "));

  // The same rule, on the dialog that has had it right since v0.55.0 —
  // so this is a check on the CONVENTION rather than on one screen.
  await page.keyboard.press("Escape");
  await wait(300);
  await api(() => window.__scriareUIStore.getState().openChoiceStyles("settings"));
  await wait(400);
  shape = await backShape();
  check("Choice Styles does the same thing, the same way",
    shape?.hasLink === true && shape?.aboveHeading === true && shape?.strayBack.length === 0,
    `${shape?.title}: link ${shape?.hasLink}, above ${shape?.aboveHeading}`);

  await page.keyboard.press("Escape");
  await wait(300);
  await win.evaluate((w) => w.setBounds({ x: 0, y: 0, width: 1280, height: 800 }));
  await wait(200);
  await seedProject();

  /* ── the doors are doors (v0.83.0) ─────────────────────────────── */

  // His complaint was that the three kinds of thing in this dialog read
  // as one stack. The cause underneath it: a DOOR AND A FIELD WERE THE
  // SAME SHAPE — both full-width bordered rectangles — though one edits a
  // value here and the other closes this dialog and opens another. So
  // what is asserted is the difference, measured: a door is not built
  // like an input, it carries its value on the right instead of inside
  // its own label, and all three live in one list.
  await api(() => window.__scriareUIStore.getState().openSettings());
  await wait(260);

  const doors = await api(() => {
    const list = document.querySelector("[data-settings-doors]");
    const rows = [...document.querySelectorAll("[data-settings-door]")];
    const field = document.querySelector("[data-story-title]");
    return {
      count: rows.length,
      insideOneList: rows.every((r) => list && list.contains(r)),
      titles: rows.map((r) => r.textContent.replace(/\s+/g, " ").trim()),
      values: rows.map((r) => r.querySelector("[data-door-value]")?.textContent ?? null),
      // "ON THE RIGHT", MEASURED. The first version of this checked that
      // a value element existed, which is not the same claim: a door
      // rebuilt as a stacked block still has one, and its negative
      // control stayed green saying so. The value has to start after the
      // title ends, on the same line.
      besideNotUnder: rows.every((r) => {
        const t = r.querySelector("[data-door-title]");
        const v = r.querySelector("[data-door-value]");
        if (!t || !v) return false;
        const a = t.getBoundingClientRect();
        const b = v.getBoundingClientRect();
        return b.left >= a.right && Math.abs(b.top - a.top) < a.height * 1.5;
      }),
      // A door is a button; a field is an input. The old shape made them
      // the same rectangle, so this is the assertion that the shapes are
      // no longer interchangeable.
      areButtons: rows.every((r) => r.tagName === "BUTTON"),
      fieldIsInput: field ? field.tagName === "INPUT" : null,
      // The sentence borrowed from the option we did not build: which of
      // these is not part of the story.
      saysWhatIsNotSaved: /not saved in the story/i.test(
        document.querySelector("[data-settings-doors]")?.parentElement?.textContent ?? "",
      ),
      // And no door still hides its value inside its own label.
      noneLabelTheirValue: rows.every((r) => !/manage…|write one…|change…/.test(r.textContent)),
    };
  });

  check("all three doors are in one list", doors.count === 3 && doors.insideOneList, doors.titles.join(" / "));
  check("a door is a button and a field is an input", doors.areButtons && doors.fieldIsInput === true);
  check(
    "each door shows its current value on the right",
    doors.values.every((v) => typeof v === "string" && v.length > 0) && doors.besideNotUnder,
    `${JSON.stringify(doors.values)} · beside: ${doors.besideNotUnder}`,
  );
  check(
    "...rather than inside its own label, the way they used to",
    doors.noneLabelTheirValue === true,
    doors.titles.join(" / "),
  );
  check(
    "the list says which of them is not saved in the story",
    doors.saysWhatIsNotSaved === true,
  );

  await api(() => window.__scriareUIStore.getState().closeSettings());
  await wait(160);
}
