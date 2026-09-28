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

    // THROUGH normalizeProject, the way an opened file is. Seeding the
    // store raw skips every migration, which made the first version of
    // this fixture keep its hand-typed ids and the key-shape assertion
    // fail against ids no real project would ever hold.
    const { normalizeProject } = window.__scriareProjectTypes;
    store.setState({
      project: normalizeProject({
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
          // Opens on the very words scene 1 opens on. Two scenes phrasing
          // something the same way is ordinary English, and it is what
          // broke the first draft of named keys: eleven collisions in The
          // Blue Hour, every one a row an engine drops on import.
          scene("sy", "The Echo", [
            {
              type: "paragraph",
              attrs: { lineId: "p-echo" },
              content: [{ type: "text", text: "Işık söndü, kapı açıldı." }],
            },
          ]),
          scene("sz", "The Room Nobody Enters", [
            {
              type: "paragraph",
              attrs: { lineId: "p-lost" },
              content: [{ type: "text", text: "Dust on the sill." }],
            },
          ]),
        ],
        content: [leaf("sa", 0), leaf("sb", 1), leaf("sy", 2), leaf("sz", 3)],
      }),
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
  const styles = await part("xl/styles.xml");
  // ONLY the cellXfs block — see the note at the protection check below.
  const cellXfs = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles)?.[1] ?? "";

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

  // A KEY IS READ BY A PERSON. It was `xU40lTnJ8JVN16hgSPB2I` in v0.70.0 —
  // nanoid's default, never a decision — and the first thing a translator
  // saw in the file looked like ciphertext.
  const calm = /^[a-z]{1,2}_[a-z0-9]+(?:-[a-z0-9]+)*$/;
  // Scene titles included. A scene carries its own stored `titleKey`
  // since v0.71.0, named from the title and frozen, so the whole column
  // is one consistent thing rather than one shape for most rows and the
  // scene's raw id for the rest.
  const titleKeys = keys.filter((_, i) => types[i] === "Scene");
  const contentKeys = keys.filter((_, i) => types[i] !== "Scene");
  const noisy = keys.filter((k) => !calm.test(k));

  /** The spec's own slug, so it cannot be blinded by the app's. */
  const slug = (t) =>
    t
      .replace(/ı/g, "i").replace(/İ/g, "i").replace(/ş/g, "s").replace(/Ş/g, "s")
      .replace(/ğ/g, "g").replace(/Ğ/g, "g").replace(/ç/g, "c").replace(/Ç/g, "c")
      .replace(/ö/g, "o").replace(/Ö/g, "o").replace(/ü/g, "u").replace(/Ü/g, "u")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .split(/[^a-z0-9]+/).filter(Boolean).slice(0, 4).join("-").slice(0, 22).replace(/-+$/, "");
  // Shape alone proves nothing: `t_tr9tmhw8` is lower case, prefixed and
  // hyphen-free, so it satisfies every pattern a name does. A control that
  // emptied the slug left this green until the check became "the key is
  // made of THESE words".
  const mismatched = keys
    .map((k, i) => ({ k, want: slug(texts[i] ?? ""), type: types[i] }))
    .filter(({ k, want, type }) => type !== "Scene" && want && !k.endsWith("-r") && k.slice(2) !== want && !new RegExp(`^${want}-\\d+$`).test(k.slice(2)));
  check(
    "A KEY IS THE LINE'S OWN WORDS — readable in a sheet and in an engine's row list",
    noisy.length === 0 && mismatched.length === 0 && contentKeys.length > 0,
    noisy.length
      ? `${noisy.length} not name-shaped, e.g. ${noisy.slice(0, 2).join(", ")}`
      : mismatched.length
        ? `${mismatched.length} not made of their words, e.g. ${mismatched[0].k} for "${mismatched[0].want}"`
        : contentKeys.slice(0, 3).join(", "),
  );
  check(
    "...scene titles included, from a key the scene stores rather than its raw id",
    titleKeys.length > 0 && titleKeys.every((k) => k.startsWith("s_")),
    titleKeys.slice(0, 2).join(", "),
  );
  check(
    "TWO SCENES THAT OPEN THE SAME WAY get different keys — ordinary English repeats",
    (() => {
      const same = keys.filter((_, i) => texts[i] === "Işık söndü, kapı açıldı.");
      return same.length === 2 && new Set(same).size === 2;
    })(),
    keys.filter((_, i) => texts[i] === "Işık söndü, kapı açıldı.").join(" / "),
  );

  check(
    "...and the key really says what the line says",
    keys[texts.indexOf("Go through")] === "c_go-through" &&
      keys[texts.indexOf("Why did you wait?")] === "d_why-did-you-wait",
    `${keys[texts.indexOf("Go through")]} / ${keys[texts.indexOf("Why did you wait?")]}`,
  );
  check(
    "...and its prefix says what the row is before the Type column repeats it",
    contentKeys.some((k) => k.startsWith("t_")) &&
      contentKeys.some((k) => k.startsWith("d_")) &&
      contentKeys.some((k) => k.startsWith("c_")),
    [...new Set(contentKeys.map((k) => k.slice(0, 2)))].join(" "),
  );
  check(
    "...and Turkish folds to its Latin skeleton rather than vanishing",
    keys[texts.indexOf("Işık söndü, kapı açıldı.")] === "t_isik-sondu-kapi-acildi",
    keys[texts.indexOf("Işık söndü, kapı açıldı.")] ?? "missing",
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
    /^U\d+\.S$/.test(refs[texts.indexOf("The Room Nobody Enters")] ?? "") &&
      /^U\d+\.S$/.test(refs[texts.indexOf("The Echo")] ?? ""),
    `${refs[texts.indexOf("The Echo")]} and ${refs[texts.indexOf("The Room Nobody Enters")]}`,
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
    "THE HEADER AND THE KEY COLUMNS ARE FROZEN — both axes, not just the top",
    /<pane xSplit="2" ySplit="1"[^>]*state="frozen"/.test(lines),
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
  // The cellXfs block only. A first attempt matched every <xf> in the
  // file, which swept up the one cellStyleXfs entry as well and shifted
  // every index by one — so the assertion was reading a different style
  // from the one the cells actually point at, and said so.
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
  // NOTHING IS LOCKED (v0.71.1). The sheet used to ship protected, with
  // only Translation and Notes writable. That guard was aimed at a
  // translator and it landed on the writer, who owns the story and could
  // not type in their own export — and it was never security anyway, since
  // Excel's protection comes off in two clicks. The shading says where to
  // type, which was always doing most of the work.
  check(
    "THE LINES SHEET IS NOT PROTECTED — it is the surface everyone works on",
    !/<sheetProtection/.test(lines),
    /<sheetProtection[^>]*>/.exec(lines)?.[0] ?? "open",
  );
  check(
    "...while the Read me is, because it is reference rather than a surface",
    /<sheetProtection/.test(readme),
    /<sheetProtection[^>]*>/.exec(readme)?.[0] ?? "unprotected",
  );
  check(
    "...and the two columns to fill in stay marked, by colour rather than by a lock",
    styleOf("I") === styleOf("J") && styleOf("I") !== styleOf("H") && unlocked.includes(styleOf("I")),
    `I→${styleOf("I")} J→${styleOf("J")} H→${styleOf("H")}`,
  );

  // THE HEADER CAN BE READ. v0.70.0 declared it bold on a near-black fill
  // and gave it no font COLOUR, so it inherited black and every heading
  // was black on black. The spec asserted the band existed and that it was
  // frozen — never that anybody could read it, which is the only thing the
  // band is for.
  // ARGB: "FF1F2933" is alpha-first, so the colour starts at index 2.
  const hex = (argb) => [2, 4, 6].map((i) => parseInt(argb.slice(i, i + 2), 16));
  const luminance = (rgb) => {
    const [r, g, b] = hex(rgb).map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const headerStyle = Number(/<c r="A1" s="(\d+)"/.exec(lines)?.[1] ?? -1);
  const xfs = cellXfs.split(/(?=<xf[\s>])/).filter((c) => c.trim().startsWith("<xf"));
  const headerXf = xfs[headerStyle] ?? "";
  const fontId = Number(/fontId="(\d+)"/.exec(headerXf)?.[1] ?? -1);
  const fillId = Number(/fillId="(\d+)"/.exec(headerXf)?.[1] ?? -1);
  const fonts = [...(/<fonts[^>]*>([\s\S]*?)<\/fonts>/.exec(styles)?.[1] ?? "").matchAll(/<font>[\s\S]*?<\/font>/g)].map((m) => m[0]);
  const fills = [...(/<fills[^>]*>([\s\S]*?)<\/fills>/.exec(styles)?.[1] ?? "").matchAll(/<fill>[\s\S]*?<\/fill>/g)].map((m) => m[0]);
  const ink = /<color rgb="(FF[0-9A-F]{6})"/.exec(fonts[fontId] ?? "")?.[1] ?? null;
  const ground = /<fgColor rgb="(FF[0-9A-F]{6})"/.exec(fills[fillId] ?? "")?.[1] ?? null;
  const ratio =
    ink && ground
      ? (Math.max(luminance(ink), luminance(ground)) + 0.05) /
        (Math.min(luminance(ink), luminance(ground)) + 0.05)
      : 0;
  // ONE TYPEFACE. Three columns were set in Consolas, on the argument that
  // a monospaced id makes a mistyped character visible — true while a key
  // was `xU40lTnJ8JVN16hgSPB2I`, meaningless once it became words.
  // Asserted over the FONT TABLE rather than by sampling columns. With one
  // family declared there is no single edit that can give one column a
  // different face, so sampling columns is a check nothing can fail —
  // which the negative control said out loud by staying green.
  const faces = [
    ...new Set(
      [...styles.matchAll(/<name val="([^"]+)"/g)].map((m) => m[1]),
    ),
  ];
  check(
    "ONE TYPEFACE THROUGHOUT — the whole workbook declares a single family",
    faces.length === 1,
    faces.join(", "),
  );

  check(
    "THE HEADER CAN BE READ — its ink and its ground are not the same colour",
    ink !== null && ground !== null && ratio >= 4.5,
    `${ink} on ${ground} — ${ratio.toFixed(1)}:1`,
  );

  check(
    "the rows are banded, so one row can be followed across seventeen columns",
    /<c r="C2" s="(\d+)"/.exec(lines)?.[1] !== /<c r="C3" s="(\d+)"/.exec(lines)?.[1],
    `row 2 → ${/<c r="C2" s="(\d+)"/.exec(lines)?.[1]}, row 3 → ${/<c r="C3" s="(\d+)"/.exec(lines)?.[1]}`,
  );
  check(
    "...and the column being typed into keeps ONE colour through the banding",
    /<c r="I2" s="(\d+)"/.exec(lines)?.[1] === /<c r="I3" s="(\d+)"/.exec(lines)?.[1],
    `I2 → ${/<c r="I2" s="(\d+)"/.exec(lines)?.[1]}, I3 → ${/<c r="I3" s="(\d+)"/.exec(lines)?.[1]}`,
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

  // A scene's title key is STORED, not derived. Deriving it would rename
  // the key whenever the scene was renamed — precisely the failure the
  // design document warns about one level up, where an engine grouping by
  // title decides a rename created a new scene full of new lines.
  const renamed = await api(() => {
    const store = window.__scriareProjectStore;
    const { normalizeProject } = window.__scriareProjectTypes;
    const project = store.getState().project;
    const before = project.scenes.find((s) => s.id === "sb")?.titleKey;
    const moved = normalizeProject({
      ...project,
      scenes: project.scenes.map((s) => (s.id === "sb" ? { ...s, title: "Something Else Entirely" } : s)),
    });
    return { before, after: moved.scenes.find((s) => s.id === "sb")?.titleKey };
  });
  check(
    "RENAMING A SCENE DOES NOT RENAME ITS KEY — the key is stored, not derived",
    renamed.before !== undefined && renamed.before === renamed.after,
    `${renamed.before} → ${renamed.after}`,
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
