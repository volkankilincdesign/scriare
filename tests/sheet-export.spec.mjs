/**
 * The spreadsheet export (v0.70.0).
 *
 * Every assertion here reads the FILE THAT WAS WRITTEN — the zip is opened,
 * its XML parsed, the CSV decoded from its bytes — rather than the model
 * that was handed to the writer. That distinction is the whole point of
 * the spec: the model has been correct in every version of this feature
 * that never existed, and what a translator opens is a workbook.
 *
 * The one thing a test cannot do is open the file in Excel. So the next
 * best thing is done deliberately and named as such: every part of the zip
 * is put through a real XML parser, because a malformed part is how a
 * hand-written .xlsx fails — not with a wrong number in a cell but with
 * Excel refusing the whole workbook and offering to repair it.
 */
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import JSZip from "jszip";

export default async function run({ page, api, check, seedProject, app }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = await mkdtemp(path.join(tmpdir(), "scriare-sheet-"));

  // ── a story with one of everything that can go wrong ─────────────────
  // Purpose-built rather than the Blue Hour fixture: the interesting cases
  // (a Turkish string, a soft line break, gated prose, an unreachable
  // scene, an empty paragraph) are each one row, and a test that has to
  // hunt for them in 219 rows is a test nobody reads.
  await api(() => {
    const store = window.__scriareProjectStore;
    const { buildChoiceBlockNode } = window.__scriareChoiceUtils;
    const { buildDialogueBlockNode } = window.__scriareDialogue;
    const now = new Date().toISOString();

    const leaf = (id, i) => ({
      id,
      kind: "leaf",
      category: "story",
      parentId: null,
      order: i,
      refType: "scene",
    });
    const scene = (id, title, content) => ({
      id,
      title,
      content: { type: "doc", content },
      position: { x: 0, y: 0 },
      frameId: null,
      order: 0,
    });

    store.setState({
      project: {
        name: "Sheet Fixture",
        createdAt: now,
        updatedAt: now,
        variables: [{ id: "v1", name: "resolve", kind: "number", initial: 0 }],
        entities: [
          { id: "e1", kind: "character", name: "Nesrin", aliases: [], content: null },
          { id: "e2", kind: "location", name: "The Yard", aliases: [], content: null },
        ],
        choiceStyles: window.__scriareChoiceStyles.normalizeChoiceStyles(undefined),
        favorites: [],
        startSceneId: "sa",
        scenes: [
          scene("sa", "The Opening", [
            {
              type: "paragraph",
              attrs: { lineId: "p-open" },
              content: [{ type: "text", text: "Işık söndü, kapı açıldı." }],
            },
            {
              // The characters that break a hand-written XML file. Added
              // after a negative control removed the escaping and the
              // suite stayed green: a fixture with no ampersand in it
              // cannot notice that ampersands stopped being escaped.
              type: "paragraph",
              attrs: { lineId: "p-xml" },
              content: [{ type: "text", text: 'Dogs & Daughters <the sign said> "so"' }],
            },
            {
              type: "paragraph",
              attrs: { lineId: "p-break" },
              content: [
                { type: "text", text: "One side" },
                { type: "hardBreak" },
                { type: "text", text: "other side" },
              ],
            },
            // Empty: counted as skipped, never a row.
            { type: "paragraph", attrs: { lineId: "p-empty" } },
            {
              type: "conditionalBlock",
              attrs: {
                blockId: "cond1",
                conditions: [{ id: "c1", variableId: "v1", comparator: "gte", value: 3 }],
              },
              content: [
                {
                  type: "paragraph",
                  attrs: { lineId: "p-gated" },
                  content: [{ type: "text", text: "Only if you were brave." }],
                },
              ],
            },
            buildChoiceBlockNode(
              [
                { id: "o-go", text: "Go through", targetSceneId: "sb" },
                { id: "o-wait", text: "Wait a moment" },
              ],
              "blk-c",
            ),
          ]),
          scene("sb", "The Yard At Night", [
            {
              type: "paragraph",
              attrs: { lineId: "p-mention" },
              content: [
                { type: "text", text: "She is here: " },
                { type: "mention", attrs: { entityId: "e1", label: "Nesrin" } },
                { type: "text", text: "." },
              ],
            },
            buildDialogueBlockNode(
              [
                {
                  id: "d-ask",
                  text: "Why did you wait?",
                  reply: "Because nobody else would.",
                  speaker: "@player",
                  replySpeaker: "e1",
                  after: "stay",
                },
                {
                  id: "d-leave",
                  text: "I should go.",
                  reply: "Then go.",
                  speaker: "@player",
                  replySpeaker: "e1",
                  after: "leave",
                  targetSceneId: "sa",
                },
              ],
              "blk-d",
            ),
          ]),
          // Nothing leads here. It must still be translated, and it must
          // not be given a number that implies somebody arrives.
          scene("sz", "The Room Nobody Enters", [
            {
              type: "paragraph",
              attrs: { lineId: "p-lost" },
              content: [{ type: "text", text: "Dust on the sill." }],
            },
          ]),
        ],
        content: [leaf("sa", 0), leaf("sb", 1), leaf("sz", 2)],
      },
      filePath: null,
      selectedSceneId: "sa",
      selectedEntityId: null,
      saveStatus: "saved",
      isPlaying: false,
    });
  });
  await wait(500);

  const hasHooks = await api(() => Boolean(window.__scriareSheet?.buildSheet));
  check("the sheet builder is reachable from the renderer", hasHooks);
  if (!hasHooks) return;

  // ── the save dialog answers with a path instead of a person ──────────
  await app.evaluate(({ dialog }, directory) => {
    globalThis.__realShowSaveDialog = dialog.showSaveDialog;
    dialog.showSaveDialog = async (...args) => {
      const options = args.length > 1 ? args[1] : args[0];
      const name = String(options.defaultPath ?? "sheet.xlsx").split(/[\\/]/).pop();
      return { canceled: false, filePath: `${directory}/${name}` };
    };
  }, out);

  /** Drives the real IPC path, exactly as the panel's button does. */
  const exportSheet = (language) =>
    api(async (lang) => {
      const project = window.__scriareProjectStore.getState().project;
      const { buildSheet, suggestedSheetName } = window.__scriareSheet;
      const sheet = buildSheet(project, { language: lang });
      const result = await window.api.sheet.save({
        sheet,
        suggestedName: suggestedSheetName(sheet.title, sheet.language),
        nearPath: null,
      });
      return { result, stats: sheet.stats, rows: sheet.rows, skipped: sheet.skippedEmpty };
    }, language);

  const first = await exportSheet("Turkish");
  check(
    "BOTH FILES ARE WRITTEN, side by side from one save dialog",
    Boolean(first.result?.filePath?.endsWith(".xlsx") && first.result?.csvPath?.endsWith(".csv")),
    `${first.result?.filePath?.split(/[\\/]/).pop()} + ${first.result?.csvPath?.split(/[\\/]/).pop()}`,
  );
  check(
    "...and the language is in the file name, because it is one file per language",
    (first.result?.filePath ?? "").includes("(Turkish)"),
    first.result?.filePath?.split(/[\\/]/).pop() ?? "no file",
  );

  // ── open what was written ────────────────────────────────────────────
  const zip = await JSZip.loadAsync(await readFile(first.result.filePath));
  const part = (name) => zip.file(name)?.async("string") ?? Promise.resolve("");
  const lines = await part("xl/worksheets/sheet1.xml");
  const readme = await part("xl/worksheets/sheet2.xml");
  const workbook = await part("xl/workbook.xml");

  check(
    "the workbook holds the parts a workbook has to hold",
    ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/styles.xml",
     "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"].every((n) => zip.file(n)),
    Object.keys(zip.files).length + " entries",
  );

  // EVERY PART THROUGH A REAL PARSER. A hand-written xlsx does not fail by
  // putting the wrong number in a cell; it fails by Excel refusing to open
  // the file at all, and the commonest cause is one unescaped ampersand
  // from a story that says "Dogs & Daughters".
  const parts = {};
  // `zip.files` lists directory entries too, and a directory has no bytes.
  // Parsing one reports "document is empty", which is a fault in the test
  // rather than in the workbook.
  for (const [name, file] of Object.entries(zip.files)) {
    if (!file.dir) parts[name] = await part(name);
  }
  const malformed = await api((xml) => {
    const parser = new DOMParser();
    const bad = [];
    for (const [name, body] of Object.entries(xml)) {
      const doc = parser.parseFromString(body, "application/xml");
      const error = doc.querySelector("parsererror");
      if (error) bad.push(`${name}: ${error.textContent.slice(0, 90)}`);
    }
    return bad;
  }, parts);
  check(
    "EVERY PART IS WELL-FORMED XML — the way a hand-written workbook fails",
    malformed.length === 0,
    malformed.slice(0, 2).join(" | ") || `${Object.keys(parts).length} parts parsed`,
  );

  // ── the rows ─────────────────────────────────────────────────────────
  /** Every cell of the Lines sheet, as {A1: "text"}. */
  const cells = {};
  for (const match of lines.matchAll(
    /<c r="([A-Z]+\d+)"[^>]*t="inlineStr"><is><t(?: xml:space="preserve")?\/?>?([\s\S]*?)(?:<\/t><\/is>|<\/is>)<\/c>/g,
  )) {
    cells[match[1]] = match[2]
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&");
  }
  const column = (letter) =>
    Object.keys(cells)
      .filter((ref) => ref.startsWith(letter) && /^\D+\d+$/.test(ref))
      .filter((ref) => ref.replace(/\d+$/, "") === letter)
      .sort((a, b) => Number(a.slice(letter.length)) - Number(b.slice(letter.length)))
      .map((ref) => cells[ref]);

  const keys = column("A").slice(1);
  const refs = column("B").slice(1);
  const types = column("F").slice(1);
  const texts = column("H").slice(1);

  check(
    "the header is the seventeen agreed columns, in order",
    column("A")[0] === "Key" && column("B")[0] === "Ref" && column("H")[0] === "Text" &&
      column("I")[0] === "Translation" && column("Q")[0] === "Source hash",
    [column("A")[0], column("B")[0], column("H")[0], column("I")[0], column("Q")[0]].join(" · "),
  );

  check(
    "COLUMN A IS UNIQUE — it is the CSV's RowName, and a repeat drops a row on import",
    new Set(keys).size === keys.length && keys.every(Boolean),
    `${keys.length} keys, ${new Set(keys).size} unique`,
  );

  check(
    "EVERY KIND A READER SEES HAS ROWS — a sheet without prose cannot localise a story",
    ["Scene", "Text", "Choice", "Dialogue", "Reply"].every((kind) => types.includes(kind)),
    [...new Set(types)].join(", "),
  );

  check(
    "SCENE TITLES ARE ROWS — the reader sees them as headings, so a translator must too",
    texts.includes("The Opening") && refs.includes("1.S"),
    `"The Opening" at ${refs[texts.indexOf("The Opening")]}`,
  );

  check(
    "SCENE 1 IS WHERE THE READER BEGINS, not where the scene list begins",
    refs[texts.indexOf("The Opening")] === "1.S",
    refs.slice(0, 3).join(", "),
  );

  check(
    "A SCENE NOTHING LEADS TO GETS A U, not a number that implies somebody arrives",
    refs[texts.indexOf("The Room Nobody Enters")] === "U1.S",
    refs[texts.indexOf("The Room Nobody Enters")] ?? "missing",
  );

  check(
    "a reply hangs off its line rather than taking a number of its own",
    refs[texts.indexOf("Because nobody else would.")] === "2.D1r" &&
      refs[texts.indexOf("Why did you wait?")] === "2.D1",
    `${refs[texts.indexOf("Why did you wait?")]} → ${refs[texts.indexOf("Because nobody else would.")]}`,
  );

  check(
    "GATED PROSE CARRIES ITS CONDITION — the condition is on the block, the row is the paragraph",
    cells[`L${texts.indexOf("Only if you were brave.") + 2}`] === "resolve is at least 3",
    cells[`L${texts.indexOf("Only if you were brave.") + 2}`] || "(empty)",
  );

  check(
    "...and ungated prose says nothing rather than something",
    cells[`L${texts.indexOf("Işık söndü, kapı açıldı.") + 2}`] === "",
    JSON.stringify(cells[`L${texts.indexOf("Işık söndü, kapı açıldı.") + 2}`]),
  );

  check(
    "THE CHARACTERS THAT BREAK XML SURVIVE INTACT — & and < and a quote",
    texts.includes('Dogs & Daughters <the sign said> "so"'),
    JSON.stringify(texts.find((t) => t.startsWith("Dogs")) ?? "missing"),
  );

  check(
    "A SOFT LINE BREAK IS A LINE BREAK, not two words run together",
    texts.some((t) => t === "One side\nother side"),
    JSON.stringify(texts.find((t) => t.includes("One side")) ?? "missing"),
  );

  check(
    "an empty paragraph is skipped and COUNTED, so the omission is visible",
    first.skipped >= 1 && !texts.includes(""),
    `${first.skipped} skipped`,
  );

  check(
    "a mention is baked into the text AND listed, so renaming later is findable",
    texts.includes("She is here: Nesrin.") &&
      cells[`K${texts.indexOf("She is here: Nesrin.") + 2}`] === "Nesrin",
    `K = ${cells[`K${texts.indexOf("She is here: Nesrin.") + 2}`] || "(empty)"}`,
  );

  check(
    "a dialogue line that leaves says where it goes, in the reader's numbering",
    (cells[`N${texts.indexOf("I should go.") + 2}`] ?? "").startsWith("↪ 1 The Opening"),
    cells[`N${texts.indexOf("I should go.") + 2}`] || "(empty)",
  );

  check(
    "the two columns a translator fills arrive EMPTY",
    column("I").slice(1).every((v) => v === "") && column("J").slice(1).every((v) => v === ""),
    `${column("I").length - 1} translation cells`,
  );

  // ── what makes it usable rather than merely correct ──────────────────
  check(
    "THE HEADER IS FROZEN — row 400 of a flat sheet is unreadable without it",
    /<pane ySplit="1"[^>]*state="frozen"/.test(lines),
    /<pane[^>]*>/.exec(lines)?.[0] ?? "no pane",
  );
  check(
    "the filter is on, because filtering by Type IS the VO workflow",
    /<autoFilter ref="A1:Q\d+"/.test(lines) && /_FilterDatabase/.test(workbook),
    /<autoFilter[^>]*>/.exec(lines)?.[0] ?? "no filter",
  );
  check(
    "CHARS IS A REAL FORMULA — a length budget you watch while you spend it",
    /<c r="P2" s="\d+"><f>LEN\(H2\)<\/f><\/c>/.test(lines) && !/<f>LEN\(H2\)<\/f><v>/.test(lines),
    /<c r="P2"[\s\S]{0,40}/.exec(lines)?.[0].replace(/\s+/g, " ") ?? "no P2",
  );

  // Locking is the guard rail against the one accident that silently
  // ruins a whole file: a sort that moves one column and not the rest.
  const styles = await part("xl/styles.xml");
  // ONLY the cellXfs block. A first attempt matched every <xf> in the
  // file, which swept up the one cellStyleXfs entry as well and shifted
  // every index by one — so the assertion was reading a different style
  // from the one the cells actually point at, and said so.
  const cellXfs = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles)?.[1] ?? "";
  const unlocked = cellXfs
    .split(/(?=<xf[\s>])/)
    .filter((chunk) => chunk.trim().startsWith("<xf"))
    .map((chunk, i) => ({ i, unlocked: /locked="0"/.test(chunk) }))
    .filter((entry) => entry.unlocked)
    .map((entry) => entry.i);
  const styleOf = (letter) => {
    const match = new RegExp(`<c r="${letter}2" s="(\\d+)"`).exec(lines);
    return match ? Number(match[1]) : -1;
  };
  check(
    "THE SHEET IS PROTECTED and exactly the two editable columns are unlocked",
    /<sheetProtection sheet="1"/.test(lines) &&
      unlocked.includes(styleOf("I")) &&
      unlocked.includes(styleOf("J")) &&
      !unlocked.includes(styleOf("H")) &&
      !unlocked.includes(styleOf("A")),
    `I→${styleOf("I")} J→${styleOf("J")} unlocked=${JSON.stringify(unlocked)}, H→${styleOf("H")} A→${styleOf("A")}`,
  );

  check(
    "the Read me carries a schema version and a fingerprint, so an importer can refuse the wrong sheet",
    /Schema version/.test(readme) && /Story fingerprint/.test(readme) && /Turkish/.test(readme),
    "present",
  );

  // ── the CSV ──────────────────────────────────────────────────────────
  const csvBytes = await readFile(first.result.csvPath);
  const csv = csvBytes.toString("utf-8");
  const csvLines = csv.split("\r\n").filter(Boolean);

  check(
    "NO BYTE ORDER MARK — Unreal reads one as part of the first column's name",
    csvBytes[0] !== 0xef,
    `first bytes ${[...csvBytes.slice(0, 3)].map((b) => b.toString(16)).join(" ")}`,
  );
  check(
    "THE FIRST COLUMN IS RowName, which is what the engine compiles lookups against",
    csvLines[0].startsWith('"RowName","Ref","Type","Speaker","Text","Translation"'),
    csvLines[0],
  );
  check(
    "COMMA-DELIMITED, not the semicolons a Turkish Excel would write",
    !csvLines[0].includes(";") && csvLines[0].split(",").length === 6,
    `${csvLines[0].split(",").length} fields`,
  );
  check(
    "TURKISH SURVIVES — the ş and the ı are the reason this file is written by hand",
    csv.includes("Işık söndü, kapı açıldı."),
    csv.includes("Işık söndü, kapı açıldı.") ? "intact" : "mangled",
  );
  check(
    "a newline inside a cell becomes an escaped one, because a DataTable row cannot span lines",
    csv.includes("One side\\nother side") && !csv.includes("One side\nother side"),
    "escaped",
  );
  check(
    "one row per line, and the same count as the workbook",
    csvLines.length - 1 === keys.length,
    `${csvLines.length - 1} csv rows against ${keys.length} workbook rows`,
  );

  // ── the same story twice is the same file ────────────────────────────
  const second = await exportSheet("Turkish");
  const twice = await readFile(second.result.filePath);
  const once = await readFile(first.result.filePath);
  check(
    "EXPORTING TWICE GIVES THE SAME BYTES — so a writer can tell a stale sheet by comparing it",
    Buffer.compare(once, twice) === 0,
    `${once.length} vs ${twice.length} bytes`,
  );
  // The bytes alone are a weak proof and a negative control said so: two
  // exports a second apart share a zip timestamp anyway, because DOS time
  // has two-second resolution. So the guarantee is asserted where it
  // actually lives — every entry carries a FIXED date rather than the
  // moment it was written, which is what makes it hold across days.
  const stamps = [...new Set(Object.values(zip.files).map((f) => f.date?.getUTCFullYear()))];
  check(
    "...because every entry carries a fixed date, not the moment it was written",
    stamps.length === 1 && stamps[0] === 2000,
    `entry years: ${stamps.join(", ")}`,
  );

  // ── the address moves when the story does ────────────────────────────
  // The Ref is an address, not an identity. Changing which scene the reader
  // starts in changes what scene 1 means, and the sheet has to agree.
  const renumbered = await api(async () => {
    const store = window.__scriareProjectStore;
    const project = store.getState().project;
    store.setState({ project: { ...project, startSceneId: "sb" } });
    const { buildSheet } = window.__scriareSheet;
    const sheet = buildSheet(store.getState().project, { language: "" });
    const row = sheet.rows.find((r) => r.text === "The Yard At Night");
    const opening = sheet.rows.find((r) => r.text === "The Opening");
    return { yard: row?.ref, opening: opening?.ref, key: row?.key };
  });
  check(
    "CHANGING THE START SCENE RENUMBERS — the initial passage really is the initial passage",
    renumbered.yard === "1.S" && renumbered.opening === "2.S",
    `The Yard ${renumbered.yard}, The Opening ${renumbered.opening}`,
  );
  check(
    "...and the KEY does not move with it — identity and address are different columns",
    renumbered.key === keys[refs.indexOf("2.S")],
    `${renumbered.key} then and now`,
  );

  await app.evaluate(({ dialog }) => {
    dialog.showSaveDialog = globalThis.__realShowSaveDialog;
  });
  await rm(out, { recursive: true, force: true }).catch(() => {});
  await seedProject();
  await wait(300);
  check(
    "the workspace is handed back to the next spec",
    await api(() => Boolean(window.__scriareProjectStore.getState().project)),
  );
}
