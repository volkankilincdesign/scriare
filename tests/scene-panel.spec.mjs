/**
 * The Inspector's scene state, and the Content Browser's one + New
 * (v0.59.0).
 *
 * Both claims are about what a writer READS, so everything here is read
 * off the rendered panel rather than out of a store. The word count is
 * checked against a number computed in this file, not against the app's
 * own function — a test that asks the app to count and then checks it
 * printed its own answer is a test of nothing.
 */
export default async function run({ api, check, seedProject }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const PROSE = "He wet his thumb, went back to the top of the column, and counted it a second time.";
  const OPTIONS = [
    ["o1", "s2", "Ask him whose hand wrote it"],
    ["o2", "s3", "Say nothing and wait for him to look up"],
    ["o3", null, "Leave"],
    ["o4", "gone", "Follow him out"],
  ];
  // Counted here, by hand: the prose plus every choice the player reads,
  // which is what storyCheck.countWords promises and what the status bar
  // now shows too.
  const EXPECTED_WORDS =
    PROSE.split(/\s+/).length + OPTIONS.reduce((n, [, , text]) => n + text.split(/\s+/).length, 0);

  await seedProject();
  await api(
    ({ prose, options }) => {
      const store = window.__scriareProjectStore;
      const p = store.getState().project;
      const doc = {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: prose }] },
          {
            type: "choiceBlock",
            attrs: { blockId: "cb1" },
            content: options.map(([optionId, targetSceneId, text]) => ({
              type: "choiceOption",
              attrs: { optionId, targetSceneId },
              content: [{ type: "text", text }],
            })),
          },
        ],
      };
      store.setState({
        project: {
          ...p,
          entities: [
            { id: "e1", kind: "character", name: "Yseide", aliases: [], content: null },
            { id: "e2", kind: "location", name: "The Long Hall", aliases: [], content: null },
          ],
          scenes: p.scenes.map((s) => (s.id === "s1" ? { ...s, title: "The Long Hall", content: doc } : s)),
        },
      });
      store.getState().selectScene("s1");
    },
    { prose: PROSE, options: OPTIONS },
  );
  await wait(420);

  const panel = await api(() => {
    const aside = document.querySelector("aside.scriare-panel-r") ?? document.querySelectorAll("aside")[1];
    const rows = [...document.querySelectorAll("[data-outgoing-choice]")].map((row) => {
      const parts = [...row.children].map((el) => ({
        text: el.textContent.trim(),
        colour: getComputedStyle(el).color,
      }));
      return { text: parts[0]?.text, to: parts[1]?.text, toColour: parts[1]?.colour };
    });
    const warning = getComputedStyle(document.documentElement).getPropertyValue("--warning").trim();
    const probe = document.createElement("span");
    probe.style.color = `var(--warning)`;
    document.body.appendChild(probe);
    const warningPainted = getComputedStyle(probe).color;
    probe.remove();
    return {
      text: (aside?.innerText ?? "").replace(/\s+/g, " ").trim(),
      rows,
      warning,
      warningPainted,
    };
  });

  check(
    "the panel names the scene it is showing, and says it is a scene",
    /The Long Hall\s+scene/.test(panel.text.replace(/\s+/g, " ")),
    panel.text.slice(0, 60),
  );

  check(
    "it counts the words the way the rest of the app counts them",
    panel.text.includes(`${EXPECTED_WORDS} words`),
    `expected ${EXPECTED_WORDS} — panel says: ${panel.text.slice(0, 80)}`,
  );

  check(
    "...and the status bar agrees, because there is one implementation now",
    await api(() => {
      const status = document.querySelector("footer");
      const panelWords = document.querySelectorAll("aside")[1].innerText.match(/(\d+) words/);
      const statusWords = (status?.innerText ?? "").match(/([\d,]+) words/);
      return Boolean(panelWords && statusWords) &&
        panelWords[1] === statusWords[1].replace(/,/g, "");
    }),
    "same number in both places",
  );

  check(
    "it counts the choices, and how many of them go nowhere",
    panel.text.includes("4 choices") && panel.text.includes("2 go nowhere"),
    panel.text.slice(0, 110),
  );

  check(
    "the two ways of going nowhere are told apart, in the app's own words",
    // A choice nobody linked, and one whose scene was deleted, are
    // different repairs — Check Story has named them separately since
    // v0.36.0 and the panel used to call both "Not linked yet".
    rowsSay(panel.rows, "Leave") === "not linked yet" &&
      rowsSay(panel.rows, "Follow him out") === "target missing",
    JSON.stringify(panel.rows.map((r) => `${r.text} → ${r.to}`)),
  );

  check(
    "a destination that is wrong is painted in the warning colour, not merely worded",
    panel.rows
      .filter((r) => ["Leave", "Follow him out"].includes(r.text))
      .every((r) => r.toColour === panel.warningPainted),
    JSON.stringify(panel.rows.map((r) => `${r.text} ${r.toColour}`)),
  );

  check(
    "a working destination is not",
    panel.rows.find((r) => r.text === "Ask him whose hand wrote it")?.toColour !==
      panel.warningPainted,
    String(panel.rows.find((r) => r.text === "Ask him whose hand wrote it")?.toColour),
  );

  // ── one place to make a new thing ─────────────────────────────────────
  const header = await api(() => {
    const aside = document.querySelector("aside");
    const buttons = [...aside.querySelectorAll("button")].map((b) => b.textContent.trim());
    return {
      buttons,
      hasNew: Boolean(aside.querySelector("[data-new-content]")),
      perCategoryPlus: [...aside.querySelectorAll("[data-category] button")].length,
    };
  });
  check(
    "the header offers one + New instead of a button per content type",
    header.hasNew &&
      !header.buttons.includes("+ Scene") &&
      !header.buttons.includes("+ Group") &&
      header.perCategoryPlus === 0,
    JSON.stringify(header.buttons.slice(0, 5)),
  );

  const menu = await api(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    document.querySelector("[data-new-content]").click();
    await w(220);
    const items = [...document.querySelectorAll("button")]
      .map((b) => b.textContent.trim())
      .filter((t) => t.startsWith("New "));
    return items;
  });
  check(
    "...and it can make all four things the tree holds",
    menu.join(" · ") === "New Scene · New Group · New Character · New Location",
    menu.join(" · "),
  );

  const made = await api(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    const before = window.__scriareProjectStore.getState().project.entities.length;
    const item = [...document.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === "New Character",
    );
    item.click();
    await w(300);
    const after = window.__scriareProjectStore.getState().project.entities;
    return {
      added: after.length - before,
      // The row the writer just asked for has to be on screen; the old
      // per-category "+" opened the section on the way.
      visible: [...document.querySelectorAll("[data-category]")].some(
        (row) => row.getAttribute("aria-expanded") === "true",
      ),
      menuClosed: !document.querySelector("button")?.textContent.startsWith("New Scene"),
    };
  });
  check(
    "making a character from the menu opens the section it lands in",
    made.added === 1 && made.visible,
    JSON.stringify(made),
  );

  // ── the two placeholders ──────────────────────────────────────────────
  const placeholders = await api(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    const aside = document.querySelector("aside");
    const notes = [...aside.querySelectorAll("div")].find(
      (d) => d.children.length === 3 && d.textContent.trim() === "▸Notes",
    );
    const text = aside.innerText;
    // Open whatever section is called Notes and read what it says.
    const row = [...aside.querySelectorAll("[aria-expanded]")].find((r) =>
      r.textContent.includes("Notes"),
    );
    row?.click();
    await w(220);
    return {
      hasNotes: text.includes("Notes"),
      hasAssets: text.includes("Assets"),
      says: aside.innerText.replace(/\s+/g, " ").match(/Notes (.*?)(?:$|Characters|Locations)/)?.[1] ?? "",
      found: Boolean(notes),
    };
  });
  check(
    "Assets is gone — a section for a feature that will never exist",
    placeholders.hasAssets === false && placeholders.hasNotes === true,
    `Notes: ${placeholders.hasNotes}, Assets: ${placeholders.hasAssets}`,
  );
  check(
    "...and Notes says what it is for, not when it is coming",
    /what the story needs/.test(placeholders.says) && !/Coming soon/.test(placeholders.says),
    placeholders.says.slice(0, 90),
  );

  await seedProject();
  await wait(200);
  check(
    "the workspace is handed back to the next spec",
    await api(() => Boolean(window.__scriareProjectStore.getState().project)),
  );
}

function rowsSay(rows, text) {
  return rows.find((r) => r.text === text)?.to ?? null;
}
