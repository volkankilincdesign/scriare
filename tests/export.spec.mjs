/**
 * Export (v0.48.0) — what a reader actually receives.
 *
 * Everything here but one claim is asserted against the REAL exported file,
 * written to disk and opened in a browser window of its own (see
 * `openExported` in run.mjs, and the note there about why an iframe inside
 * the app silently measures nothing). The difference matters: a string
 * assertion proves a substring was written, and the bugs this feature can
 * have are all about what a browser then does with it — a choice that
 * renders but does nothing, a ground that never applies, a `</script>` in
 * someone's prose that ends the file early.
 *
 * The one claim read off the string is the one that is genuinely about the
 * file rather than the page: that it asks the network for nothing.
 *
 * The condition and action evaluators have their own spec next door
 * (export-evaluator.spec.mjs), because holding a hand-written duplicate to
 * the original needs an enumeration, not an example.
 */

/**
 * A story that uses every part of the export at once: marks the toolbar can
 * apply, a callout, a mention, a speaker, a conditional passage, four kinds
 * of choice, a variable, an ending, and a `</script>` sitting in the prose
 * waiting to end the file early.
 */
function fixture() {
  const now = new Date().toISOString();
  const paragraph = (content, attrs) => ({ type: "paragraph", attrs, content });
  const text = (value, marks) => ({ type: "text", text: value, marks });

  return {
    id: "exportfixture",
    name: "The Lantern Room",
    createdAt: now,
    updatedAt: now,
    startSceneId: "one",
    scenes: [
      {
        id: "one",
        title: "The Lantern Room",
        position: { x: 0, y: 0 },
        frameId: null,
        order: 0,
        content: {
          type: "doc",
          content: [
            paragraph([
              text("cold", [{ type: "bold" }]),
              text(" and "),
              text("deliberate", [{ type: "italic" }]),
              text(" and "),
              text("underlined", [{ type: "underline" }]),
            ]),
            // A colour and a highlight the writer chose by hand. The colour
            // reads on Night and vanishes on Paper — the exact case the
            // contrast check exists for.
            paragraph([
              text("pale blue", [{ type: "textStyle", attrs: { color: "#b4cde8" } }]),
              text(" and "),
              text("marked", [{ type: "highlight", attrs: { color: "#ffe680" } }]),
            ]),
            paragraph([
              text("set in serif", [
                { type: "textStyle", attrs: { fontFamily: "Georgia, serif", fontSize: "20px" } },
              ]),
            ]),
            { type: "heading", attrs: { level: 2 }, content: [text("A heading")] },
            {
              type: "bulletList",
              content: [
                { type: "listItem", content: [paragraph([text("the logbook")])] },
                { type: "listItem", content: [paragraph([text("three brass weights")])] },
              ],
            },
            { type: "blockquote", content: [paragraph([text("the light is not the point")])] },
            { type: "callout", content: [paragraph([text("The housing is warm.")])] },
            // A mention stored under a STALE label: the export must print
            // the entity's current name, not the one written into the node.
            paragraph([
              { type: "mention", attrs: { entityId: "e1", label: "Old Name" } },
              text(" does not look up."),
            ]),
            paragraph([text("You said the keeper left in forty-one.")], { speaker: "e1" }),
            // The prose that used to be able to end the exported file.
            paragraph([
              text("Then she wrote </script><script>window.__pwned=1;</script> on the glass."),
            ]),
            {
              type: "conditionalBlock",
              attrs: {
                conditions: [{ id: "cc", variableId: "trust", comparator: "gte", value: 3 }],
              },
              content: [paragraph([text("You already know what she is going to say.")])],
            },
            {
              type: "choiceBlock",
              content: [
                // Unstyled: resolves to the Default style, which is written
                // in theme variables and must arrive in the export still
                // written in theme variables.
                {
                  type: "choiceOption",
                  attrs: {
                    optionId: "o1",
                    targetSceneId: "two",
                    actions: [{ id: "a1", variableId: "trust", operation: "add", value: 2 }],
                    conditions: [],
                    whenUnmet: "hide",
                    style: null,
                    speaker: null,
                  },
                  content: [text("Read the final entry.")],
                },
                // A hand-picked colour. Content: it travels unchanged.
                {
                  type: "choiceOption",
                  attrs: {
                    optionId: "o2",
                    targetSceneId: "two",
                    actions: [],
                    conditions: [],
                    whenUnmet: "hide",
                    style: {
                      overrides: { fill: "#6b1f1f", border: "#a33a34", borderWidth: 2, radius: 3 },
                    },
                    speaker: null,
                  },
                  content: [text("Put your hand on the housing.")],
                },
                // Gated, shown locked, with its reason.
                {
                  type: "choiceOption",
                  attrs: {
                    optionId: "o3",
                    targetSceneId: "two",
                    actions: [],
                    conditions: [{ id: "c3", variableId: "trust", comparator: "gte", value: 3 }],
                    whenUnmet: "lock",
                    style: null,
                    speaker: null,
                  },
                  content: [text("Ask him what he isn't saying.")],
                },
                // Gated and hidden. Must not appear at all.
                {
                  type: "choiceOption",
                  attrs: {
                    optionId: "o4",
                    targetSceneId: "two",
                    actions: [],
                    conditions: [{ id: "c4", variableId: "trust", comparator: "gte", value: 9 }],
                    whenUnmet: "hide",
                    style: null,
                    speaker: null,
                  },
                  content: [text("A door that is not there yet.")],
                },
              ],
            },
          ],
        },
      },
      {
        // The payload belongs HERE, not only in the prose.
        //
        // The first version of this fixture put `</script>` in a paragraph
        // and the negative control caught it: removing the escaping from
        // pageTemplate.ts broke nothing, because Tiptap had already turned
        // the writer's `<` into `&lt;` on its way through generateHTML.
        // Prose cannot reach the embedded JSON as raw markup. A SCENE TITLE
        // can — it is copied into the story data as the writer typed it —
        // and so can a variable name by way of a locked choice's reason.
        // The test was protecting a door that was never open while the real
        // one stood unwatched.
        id: "two",
        title: "What the Glass Kept </script><script>window.__pwned=1;</script>",
        position: { x: 0, y: 0 },
        frameId: null,
        order: 1,
        content: {
          type: "doc",
          content: [paragraph([text("He gets the door closed on the second try.")])],
        },
      },
    ],
    content: [],
    favorites: [],
    variables: [{ id: "trust", name: "Trust", type: "number", defaultValue: 0 }],
    choiceStyles: null,
    entities: [{ id: "e1", kind: "character", name: "Mara", aliases: [], content: null }],
  };
}

const PROGRESS = "scriare:exportfixture:progress";
const GROUND = "scriare:exportfixture:ground";

export default async function run({ api, check, openExported }) {
  const built = await api((project) => {
    const X = window.__scriareExport;
    project.choiceStyles = window.__scriareChoiceStyles.normalizeChoiceStyles(undefined);
    const story = X.buildExportStory(project);
    return {
      html: X.buildExportHtml(story),
      findings: X.checkStoryContrast(story).map((f) => ({
        what: f.what,
        ground: f.ground,
        ratio: Number(f.ratio.toFixed(2)),
      })),
      pageHex: X.GROUND_PAGE_HEX,
      textHex: X.GROUND_TEXT_HEX,
    };
  }, fixture());

  const html = built.html;

  /* ── the file itself ──────────────────────────────────────────── */

  // Anything that would make the page reach out: a stylesheet link, a CSS
  // @import, a script or image src, a font fetch. Only <link> is looked for
  // rather than every href, so an http link the WRITER put in their prose
  // is not mistaken for the page phoning home.
  const reachesOut = [
    /<link\b/i.test(html),
    /@import/i.test(html),
    /src\s*=\s*["']https?:/i.test(html),
    /url\(\s*["']?https?:/i.test(html),
  ].some(Boolean);
  check("the exported page asks the network for nothing", reachesOut === false);

  const page = await openExported(html);
  await page.evaluate(
    ([progress, ground]) => {
      localStorage.removeItem(progress);
      localStorage.removeItem(ground);
    },
    [PROGRESS, GROUND],
  );
  await page.reload();

  /* ── the injection that is not one ───────────────────────────── */

  const injection = await page.evaluate(() => ({
    pwned: window.__pwned === 1,
    proseIntact: document.body.textContent.includes("on the glass"),
    // The title is checked later, once the reader has walked to that scene.
  }));
  check(
    "a </script> in the story cannot end the exported file early",
    injection.pwned === false && injection.proseIntact === true,
    injection.pwned ? "the injected script ran" : "escaped, and the sentence survived",
  );

  /* ── formatting ───────────────────────────────────────────────── */

  const marks = await page.evaluate(() => {
    const body = document.querySelector(".scriare-page").innerHTML;
    const q = (s) => document.querySelector(s);
    return {
      bold: /<strong>cold<\/strong>/.test(body),
      italic: /<em>deliberate<\/em>/.test(body),
      underline: /<u>underlined<\/u>/.test(body),
      // Either spelling: the browser re-serializes an inline `color:` when
      // the markup is read back, so the hex the writer picked comes out as
      // rgb(). Asserting only the hex was a bug in this test, not a missing
      // colour — the colour was there the whole time, wearing the other
      // notation.
      "hand-picked colour": /#b4cde8/i.test(body) || /rgb\(\s*180,\s*205,\s*232\s*\)/.test(body),
      highlight: /<mark[^>]*>marked<\/mark>/.test(body),
      "font and size": /Georgia/.test(body) && /20px/.test(body),
      heading: Boolean(q(".scriare-prose h2")),
      list: document.querySelectorAll(".scriare-prose li").length === 2,
      blockquote: Boolean(q(".scriare-prose blockquote")),
      callout: Boolean(q('[data-type="callout"]')),
    };
  });
  for (const [name, passed] of Object.entries(marks)) {
    check(`the reader gets the writer's ${name}`, passed === true);
  }

  const names = await page.evaluate(() => ({
    mention: (document.querySelector(".scriare-mention") || {}).textContent ?? null,
    speaker: (document.querySelector(".scriare-speaker") || {}).textContent ?? null,
    chips: document.querySelectorAll(".scriare-speaker-chip").length,
  }));
  check(
    "a mention arrives as the character's current name, not the one stored in the node",
    names.mention === "Mara",
    `got ${JSON.stringify(names.mention)}`,
  );
  check(
    "a spoken line arrives with its speaker's name as prose",
    typeof names.speaker === "string" && names.speaker.trim() === "Mara:",
    `got ${JSON.stringify(names.speaker)}`,
  );
  check("the editor's speaker chip never reaches a reader", names.chips === 0);

  /* ── choices ──────────────────────────────────────────────────── */

  const choices = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll(".scriare-choice"));
    const text = document.querySelector(".scriare-page").textContent;
    return {
      count: buttons.length,
      hiddenAbsent: !text.includes("A door that is not there yet"),
      lockedDisabled: Boolean(buttons[2] && buttons[2].disabled),
      // v0.72.0 — the threshold is a design quantity and never reaches a
      // reader; what they can act on is which thing they lack.
      lockedReason: Boolean(buttons[2] && buttons[2].textContent.includes("Requires Trust")),
      lockedHidesTheNumber: Boolean(buttons[2] && !buttons[2].textContent.includes("at least 3")),
      // v0.80.0 — READ OFF THE COMPUTED STYLE, NOT THE INLINE ONE. These
      // three read `button.style.*` until the box moved out of an inline
      // style and into a generated rule in a cascade layer, so that a
      // writer's own CSS could reach it. Measuring the inline attribute
      // was measuring the MECHANISM; what the reader gets is the computed
      // value, and that is what these ask for now — the assertions below
      // did not have to change, which is the point.
      defaultOnNight: getComputedStyle(buttons[0]).backgroundColor,
      customRadius: getComputedStyle(buttons[1]).borderRadius,
      customFill: getComputedStyle(buttons[1]).backgroundColor,
      gatedProseHidden: !text.includes("You already know what she is going to say"),
    };
  });

  check("three of four choices render — the hidden one does not", choices.count === 3, `rendered ${choices.count}`);
  check("a hidden choice is absent, not greyed out", choices.hiddenAbsent === true);
  check("a locked choice is disabled", choices.lockedDisabled === true);
  check("a locked choice says what it needs", choices.lockedReason === true);
  check(
    "...and NOT the number behind it — a threshold is the machine, not the story",
    choices.lockedHidesTheNumber === true,
  );
  // An untouched choice is painted from a ground token, so the proof that
  // it still follows the ground is that it MOVES when the ground does. The
  // old spelling of this check looked for the literal text
  // "var(--surface-2-translucent)" in an inline style, which proved the
  // notation and not the behaviour: a token that had been quietly renamed
  // would have failed it, and one that resolved to nothing would have
  // passed.
  const groundFollow = await page.evaluate(() => {
    const root = document.documentElement;
    const button = document.querySelector(".scriare-choice");
    const was = getComputedStyle(button).backgroundColor;
    root.setAttribute("data-ground", root.getAttribute("data-ground") === "paper" ? "night" : "paper");
    const now = getComputedStyle(button).backgroundColor;
    root.setAttribute("data-ground", root.getAttribute("data-ground") === "paper" ? "night" : "paper");
    return { was, now };
  });
  check(
    "an untouched choice still follows the reader's ground",
    groundFollow.was !== groundFollow.now &&
      groundFollow.was !== "rgba(0, 0, 0, 0)" &&
      groundFollow.now !== "rgba(0, 0, 0, 0)",
    `${groundFollow.was} → ${groundFollow.now}`,
  );
  check(
    "a hand-picked choice colour arrives exactly as chosen",
    choices.customRadius === "3px" && /107,\s*31,\s*31|#6b1f1f/i.test(choices.customFill),
    `${choices.customFill} @ ${choices.customRadius}`,
  );
  check("gated prose is absent while the gate is shut", choices.gatedProseHidden === true);

  /* ── the ground ───────────────────────────────────────────────── */

  const ground = await page.evaluate(
    (key) => {
      const root = document.documentElement;
      const opensOn = root.getAttribute("data-ground");
      const paint = () => getComputedStyle(document.querySelector(".scriare-page")).backgroundColor;
      const nightPaint = paint();
      document.getElementById("scriare-ground").click();
      const after = root.getAttribute("data-ground");
      const paperPaint = paint();
      let remembered = null;
      try {
        remembered = localStorage.getItem(key);
      } catch (e) {
        remembered = "unavailable";
      }
      document.getElementById("scriare-ground").click();
      return { opensOn, after, remembered, nightPaint, paperPaint };
    },
    GROUND,
  );

  check("the story opens on Night", ground.opensOn === "night", `opened on ${ground.opensOn}`);
  check("the reader can switch to Paper", ground.after === "paper");
  check("the reader's ground is remembered", ground.remembered === "paper", `stored ${ground.remembered}`);
  check(
    "switching ground actually repaints the page, not just the attribute",
    ground.nightPaint !== ground.paperPaint,
    `${ground.nightPaint} → ${ground.paperPaint}`,
  );

  /* ── moving through the story ─────────────────────────────────── */

  const walk = await page.evaluate((key) => {
    const text = () => document.querySelector(".scriare-page").textContent;
    const back = () => document.getElementById("scriare-back");
    const saved = () => JSON.parse(localStorage.getItem(key));

    const backDisabledAtStart = back().disabled;
    document.querySelectorAll(".scriare-choice")[0].click();

    const movedOn = text().includes("He gets the door closed");
    // The scene title carrying the payload arrives as TEXT — visible,
    // inert, and exactly as the writer typed it.
    const titleIsText =
      document.querySelector(".scriare-scene-title").textContent.includes("</script>") &&
      document.querySelectorAll(".scriare-page script").length === 0;
    const backEnabled = !back().disabled;
    const endingShown = Boolean(document.querySelector(".scriare-ending"));
    const afterChoice = saved();

    back().click();
    const wentBack = text().includes("cold and deliberate");
    const afterBack = saved();

    return {
      backDisabledAtStart,
      movedOn,
      titleIsText,
      pwnedAfterWalking: window.__pwned === 1,
      backEnabled,
      endingShown,
      actionApplied: afterChoice.values.trust === 2,
      progressSaved: afterChoice.scene === "two",
      wentBack,
      backUndoesActions: afterBack.values.trust === 0,
    };
  }, PROGRESS);

  check("Back is disabled on the first scene", walk.backDisabledAtStart === true);
  check("a choice moves the reader on", walk.movedOn === true);
  check(
    "a </script> in a scene title arrives as text, not as a script",
    walk.titleIsText === true && walk.pwnedAfterWalking === false,
    walk.pwnedAfterWalking ? "the injected script ran" : "inert",
  );
  check("a choice's actions are applied", walk.actionApplied === true);
  check("Back becomes available after a choice", walk.backEnabled === true);
  check("a scene with no choices shows an ending", walk.endingShown === true);
  check("the reader's place is kept", walk.progressSaved === true);
  check("Back returns to the previous scene", walk.wentBack === true);
  check(
    "Back undoes what the choice did to the variables, not just where it went",
    walk.backUndoesActions === true,
  );

  /* ── coming back later, and the gate opening ──────────────────── */

  await page.evaluate(
    (key) =>
      localStorage.setItem(
        key,
        JSON.stringify({ scene: "one", values: { trust: 3 }, trail: [{ scene: "one", values: { trust: 0 } }] }),
      ),
    PROGRESS,
  );
  await page.reload();

  const resume = await page.evaluate(() => {
    const text = () => document.querySelector(".scriare-page").textContent;
    const offered = Boolean(document.querySelector(".scriare-resume-yes"));
    // Offered, not applied: a returning reader who wanted to show someone
    // the opening must still be looking at the opening.
    const notApplied = !text().includes("You already know what she is going to say");
    if (offered) document.querySelector(".scriare-resume-yes").click();
    const gatedProseShown = text().includes("You already know what she is going to say");
    const lockedOpens = !document.querySelectorAll(".scriare-choice")[2].disabled;

    document.getElementById("scriare-restart").click();
    const restartResets =
      text().includes("cold and deliberate") &&
      !text().includes("You already know what she is going to say") &&
      document.getElementById("scriare-back").disabled &&
      document.querySelectorAll(".scriare-choice")[2].disabled;

    return { offered, notApplied, gatedProseShown, lockedOpens, restartResets };
  });

  check("a returning reader is offered their place", resume.offered === true);
  check("their place is offered, not forced on them", resume.notApplied === true);
  check("gated prose appears once the gate opens", resume.gatedProseShown === true);
  check("a locked choice opens when its condition is met", resume.lockedOpens === true);
  check("Restart puts the story, and its variables, back to the beginning", resume.restartResets === true);

  /* ── the two spellings of each ground ─────────────────────────── */

  // GROUND_PAGE_HEX and GROUND_TEXT_HEX exist only so the contrast check has
  // numbers to work with; the stylesheet keeps the oklch. Two spellings of
  // one colour is exactly the pair that drifts, so they are compared here.
  //
  // By PAINTING them, not by comparing what getComputedStyle returns. That
  // was the first attempt and it failed on every ground while both colours
  // were in fact identical: the computed value of an oklch token is still
  // spelled `oklch(...)` and a hex is spelled `rgb(...)`, so the assertion
  // was comparing notations. A canvas is the only comparison that answers
  // the question actually being asked — do these two put the same colour on
  // the screen.
  const paints = await page.evaluate(
    ({ pageHex, textHex }) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      const pixel = (value) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = "#000000";
        ctx.fillStyle = value;
        ctx.fillRect(0, 0, 1, 1);
        return Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3));
      };

      const out = {};
      const was = document.documentElement.getAttribute("data-ground");
      for (const ground of ["paper", "night"]) {
        document.documentElement.setAttribute("data-ground", ground);
        const styles = getComputedStyle(document.documentElement);
        out[ground] = {
          page: [pixel(styles.getPropertyValue("--page").trim()), pixel(pageHex[ground])],
          text: [pixel(styles.getPropertyValue("--text").trim()), pixel(textHex[ground])],
        };
      }
      document.documentElement.setAttribute("data-ground", was);
      return out;
    },
    { pageHex: built.pageHex, textHex: built.textHex },
  );

  // One byte of slack per channel, and no more: the two notations round
  // separately, and anything past that is a real difference in colour.
  const sameColour = ([a, b]) => a.every((v, i) => Math.abs(v - b[i]) <= 1);

  for (const name of ["paper", "night"]) {
    check(
      `${name}'s page colour paints the same from the stylesheet and from the contrast check`,
      sameColour(paints[name].page),
      `${paints[name].page[0]} vs ${paints[name].page[1]}`,
    );
    check(
      `${name}'s text colour paints the same from the stylesheet and from the contrast check`,
      sameColour(paints[name].text),
      `${paints[name].text[0]} vs ${paints[name].text[1]}`,
    );
  }

  await page.evaluate(
    ([progress, ground]) => {
      localStorage.removeItem(progress);
      localStorage.removeItem(ground);
    },
    [PROGRESS, GROUND],
  );

  /* ── the contrast check ───────────────────────────────────────── */

  const findings = built.findings;
  const paperBlue = findings.find((f) => f.ground === "paper" && f.what === "Coloured text");
  check(
    "a colour picked in the dark is flagged against Paper",
    Boolean(paperBlue) && paperBlue.ratio < 4.5,
    paperBlue ? `${paperBlue.ratio}:1` : "not flagged",
  );
  check(
    "the same colour is not flagged against Night, where it reads",
    !findings.some((f) => f.ground === "night" && f.what === "Coloured text"),
  );
  check(
    "a choice whose colours come from the theme is never flagged",
    !findings.some((f) => f.what.includes("Read the final entry")),
  );
  // This assertion was written the wrong way round the first time, and the
  // failure is worth keeping in the file. A dark red fill was ASSUMED to be
  // the Night problem; it is the Paper one. On Night the label is painted in
  // a near-white --text and reads fine against dark red — it is on Paper,
  // where the label is near-black, that dark text on a dark fill collapses
  // to 1.5:1. Which is the whole argument for measuring rather than
  // reasoning about colour: the intuition was confident and backwards.
  const redOnPaper = findings.find((f) => f.ground === "paper" && f.what.includes("Put your hand"));
  check(
    "a dark choice fill is flagged against Paper, where the label goes dark too",
    Boolean(redOnPaper) && redOnPaper.ratio < 4.5,
    redOnPaper ? `${redOnPaper.ratio}:1` : JSON.stringify(findings),
  );
  check(
    "the same fill is not flagged against Night, where the label is light and it reads",
    !findings.some((f) => f.ground === "night" && f.what.includes("Put your hand")),
  );
}
