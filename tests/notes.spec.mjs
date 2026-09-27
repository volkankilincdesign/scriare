/**
 * Notes (v0.60.0).
 *
 * A note is an entity with one asymmetry: it can mention the story and the
 * story can never mention it. Almost everything here checks that
 * asymmetry from both ends, on the rendered app, because five of the six
 * exclusions were already true and a test that only asserts the new
 * `kind` string would pass while the app offered notes in the @ menu.
 */
export default async function run({ page, api, check, seedProject }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const seedNotes = () =>
    api(async () => {
      const w = (ms) => new Promise((r) => setTimeout(r, ms));
      const store = window.__scriareProjectStore;
      const p = store.getState().project;
      const mention = (entityId, label) => ({ type: "mention", attrs: { entityId, label } });
      store.setState({
        project: {
          ...p,
          entities: [
            { id: "e1", kind: "character", name: "Yseide", aliases: ["the clerk"], content: { type: "doc", content: [{ type: "paragraph" }] } },
            { id: "e2", kind: "location", name: "The Long Hall", aliases: [], content: { type: "doc", content: [{ type: "paragraph" }] } },
            {
              id: "n1",
              kind: "note",
              name: "Act One — beats",
              aliases: [],
              content: {
                type: "doc",
                content: [
                  { type: "paragraph", content: [{ type: "text", text: "The ledger is wrong and " }, mention("e1", "Yseide"), { type: "text", text: " knows it. " }, mention("e1", "the clerk"), { type: "text", text: " keeps it anyway." }] },
                  { type: "paragraph", content: [{ type: "text", text: "Gate " }, mention("e2", "The Long Hall"), { type: "text", text: " behind the coin box." }] },
                ],
              },
            },
          ],
        },
      });
      await w(260);
    });

  await seedProject();
  await seedNotes();
  await wait(300);

  // ── the story cannot point at a note ──────────────────────────────────
  const menu = await api(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    const editor = window.__scriareEditorStore.getState().editor;
    editor.chain().focus().insertContent(" @").run();
    await w(420);
    const items = [...document.querySelectorAll("[data-mention-option], [role='option'], button")]
      .map((el) => el.textContent.trim())
      .filter((t) => /Yseide|Long Hall|Act One/.test(t));
    // Leave the editor as it was.
    editor.commands.undo();
    await w(160);
    return items;
  });

  check(
    "the @ menu offers the story's people and places",
    menu.some((t) => t.includes("Yseide")) && menu.some((t) => t.includes("Long Hall")),
    JSON.stringify(menu),
  );
  check(
    "...and never a note — the one thing that makes a note a note",
    !menu.some((t) => t.includes("Act One")),
    JSON.stringify(menu),
  );

  check(
    "a note can never be a speaker either",
    await api(() => {
      const { canSpeak } = window.__scriareSpeaker;
      const byId = (id) => window.__scriareProjectStore.getState().project.entities.find((e) => e.id === id);
      return canSpeak(byId("e1")) === true && canSpeak(byId("n1")) === false;
    }),
    "character yes, note no",
  );

  // ── a note can point at the story ─────────────────────────────────────
  const notePage = await api(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    window.__scriareProjectStore.getState().selectEntity("n1");
    await w(500);
    const main = document.querySelectorAll("aside")[0].parentElement;
    const text = main.innerText.replace(/\s+/g, " ");
    // innerText is what is PAINTED, and these section labels are uppercased
    // by CSS — so every match on one is case-insensitive here.
    const points = [...document.querySelectorAll("[data-points-at]")].map((b) =>
      b.innerText.replace(/\s+/g, " ").trim(),
    );
    return {
      text,
      points,
      sawAliases: /also known as/i.test(text),
      heading: /points at/i.test(text),
      oldHeading: /appears in/i.test(text),
    };
  });

  check(
    "a note's page says Points at, not Appears in",
    notePage.heading && !notePage.oldHeading,
    notePage.text.slice(-120),
  );
  check(
    "...and lists what it names, counted once per thing rather than once per mention",
    // Yseide is named twice in the note, under two different names.
    notePage.points.some((t) => /Yseide/.test(t) && /×2/.test(t)) &&
      notePage.points.some((t) => /The Long Hall/.test(t)) &&
      notePage.points.length === 2,
    JSON.stringify(notePage.points),
  );
  check(
    "a note has no aliases — a control for a thing that cannot happen",
    notePage.sawAliases === false,
    `"Also known as" present: ${notePage.sawAliases}`,
  );

  const charPage = await api(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    window.__scriareProjectStore.getState().selectEntity("e1");
    await w(500);
    const text = document.querySelectorAll("aside")[0].parentElement.innerText.replace(/\s+/g, " ");
    return {
      keepsAliases: /also known as/i.test(text),
      heading: /appears in/i.test(text),
      // The other end of the asymmetry: the note shows up as a place she
      // is mentioned, because mentionSites walks every entity page.
      listsTheNote: /Act One/.test(text),
    };
  });
  check(
    "a character's page is unchanged — aliases, and Appears in",
    charPage.keepsAliases && charPage.heading,
    JSON.stringify(charPage),
  );
  check(
    "...and it counts the note as a place she is mentioned",
    charPage.listsTheNote,
    `note listed on the character's page: ${charPage.listsTheNote}`,
  );

  // ── the reader never sees one ─────────────────────────────────────────
  const reader = await api(() => {
    const { buildExportStory, buildExportHtml } = window.__scriareExport;
    const project = window.__scriareProjectStore.getState().project;
    const html = buildExportHtml(buildExportStory(project));
    const { checkStory } = window.__scriareStoryCheck;
    const report = checkStory(project);
    return {
      inExport: /Act One/.test(html),
      words: report.stats.words,
      issues: report.issues.filter((i) => /Act One/.test(i.label ?? "")).length,
    };
  });
  check(
    "a note is not in the exported story",
    reader.inExport === false,
    `found in the export: ${reader.inExport}`,
  );
  check(
    "...nor in the story's word count, nor in Check Story",
    // The note's own 20-odd words must not reach a number a writer quotes.
    reader.words < 20 && reader.issues === 0,
    `${reader.words} words, ${reader.issues} issues about it`,
  );

  // ── and it is the writer's, so they can find it ───────────────────────
  check(
    "search finds a note — one a writer cannot find again is one they stop writing",
    await api(async () => {
      const w = (ms) => new Promise((r) => setTimeout(r, ms));
      const input = document.querySelector("[data-find-input]");
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(input, "Act One");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await w(420);
      const found = document.querySelectorAll("aside")[0].innerText.includes("Act One");
      setter.call(input, "");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await w(260);
      return found;
    }),
  );

  // ── the tree, and the menu that makes one ─────────────────────────────
  const tree = await api(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    const aside = document.querySelector("aside");
    document.querySelector("[data-new-content]").click();
    await w(240);
    const items = [...document.querySelectorAll("button")]
      .map((b) => b.textContent.trim())
      .filter((t) => t.startsWith("New "));
    const before = window.__scriareProjectStore.getState().project.entities.length;
    // Reported rather than thrown: a missing menu item is the thing under
    // test, and a spec that crashes instead of failing tells a negative
    // control nothing (found while running one — v0.60.0).
    const item = [...document.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === "New Note",
    );
    item?.click();
    await w(360);
    const after = window.__scriareProjectStore.getState().project.entities;
    return {
      items,
      added: after.length - before,
      kind: after.length > before ? after[after.length - 1].kind : null,
      categories: [...aside.querySelectorAll("[data-category]")].map((c) =>
        c.getAttribute("data-category"),
      ),
      status: document.querySelector("footer").innerText.replace(/\s+/g, " "),
    };
  });

  check(
    "+ New can make a note",
    tree.items.includes("New Note") && tree.added === 1 && tree.kind === "note",
    JSON.stringify({ added: tree.added, kind: tree.kind }),
  );
  check(
    "Notes is a real category now — no placeholder left in the tree",
    tree.categories.join(",") === "root:characters,root:locations,root:notes",
    tree.categories.join(", "),
  );
  check(
    "the status bar counts notes now that there are some",
    /2 notes/.test(tree.status),
    tree.status,
  );

  const quiet = await api(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    const store = window.__scriareProjectStore;
    store.setState({
      project: {
        ...store.getState().project,
        entities: store.getState().project.entities.filter((e) => e.kind !== "note"),
      },
    });
    await w(300);
    return document.querySelector("footer").innerText.replace(/\s+/g, " ");
  });
  check(
    "...and says nothing at all about notes when there are none",
    !/note/i.test(quiet),
    quiet,
  );

  await seedProject();
  await wait(200);
  check(
    "the workspace is handed back to the next spec",
    await api(() => Boolean(window.__scriareProjectStore.getState().project)),
  );
}
