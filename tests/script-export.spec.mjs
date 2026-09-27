import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";

/**
 * Script Export (v0.64.0) — checked on the FILES, not on the intention.
 *
 * Every assertion here reads bytes that were written to disk: the PDF is
 * run through `pdftotext` and asked what landed on which page, and the
 * DOCX is unzipped and its `document.xml` read. Asserting that the
 * renderer was asked to keep a block together would pass on a build where
 * Word ignored the request.
 *
 * `pdftotext` (poppler-utils) is required, the way xvfb already is.
 *
 * The fixture is The Blue Hour, built to be awkward on purpose: 32 scenes
 * across five chapters, six speakers, conditions that hide and one that
 * locks, gated prose, and 70 options.
 */

// ── a minimal reader for the one file we want out of a .docx ────────────
// A .docx is a zip. Rather than take a dependency or shell out to `unzip`,
// this walks the central directory for `word/document.xml` and inflates
// it — about thirty lines, and it keeps the suite to Node plus poppler.
function readDocxXml(buffer) {
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("not a zip");
  const count = buffer.readUInt16LE(eocd + 10);
  let at = buffer.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    const nameLength = buffer.readUInt16LE(at + 28);
    const extraLength = buffer.readUInt16LE(at + 30);
    const commentLength = buffer.readUInt16LE(at + 32);
    const name = buffer.toString("utf-8", at + 46, at + 46 + nameLength);
    const localAt = buffer.readUInt32LE(at + 42);
    if (name === "word/document.xml") {
      const method = buffer.readUInt16LE(localAt + 8);
      const compressed = buffer.readUInt32LE(localAt + 18);
      const localName = buffer.readUInt16LE(localAt + 26);
      const localExtra = buffer.readUInt16LE(localAt + 28);
      const start = localAt + 30 + localName + localExtra;
      const raw = buffer.subarray(start, start + compressed);
      return (method === 0 ? raw : zlib.inflateRawSync(raw)).toString("utf-8");
    }
    at += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error("word/document.xml not found");
}

/** The visible text of a .docx, with each paragraph on its own line. */
const docxText = (xml) =>
  xml
    .split("</w:p>")
    .map((p) => (p.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) ?? [])
      .map((t) => t.replace(/<[^>]+>/g, ""))
      .join(""))
    .join("\n")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#8217;|&#x2019;/g, "’");

/**
 * The lines of a page that are the SCRIPT, with the running footer taken
 * off the bottom.
 *
 * Found the hard way. `pdftotext` returns the footer like any other text,
 * so "the last line on the page" was always "Blue screenplay full   7" —
 * which meant four assertions about what a page may end on could not fail
 * for any input, and the two negative controls aimed at them came back
 * green. The page rules were not being tested at all; they were being
 * described.
 */
function contentLines(page, title) {
  const lines = page.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim().length);
  while (lines.length) {
    const last = lines[lines.length - 1].trim();
    const isFooter =
      /^\d+$/.test(last) ||
      (last.startsWith(title) && /\d+$/.test(last)) ||
      last === title;
    if (!isFooter) break;
    lines.pop();
  }
  return lines;
}

export default async function run({ page, api, check, seedProject, app }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = await fs.mkdtemp(path.join(os.tmpdir(), "scriare-script-"));

  // ── the fixture ───────────────────────────────────────────────────────
  const fixture = path.join(out, "The Blue Hour.scriare");
  await fs.writeFile(fixture, await fs.readFile(new URL("./fixtures/the-blue-hour.scriare", import.meta.url)));

  await api(async (p) => {
    await window.__scriareProjectStore.getState().openRecentProject(p);
  }, fixture);
  await wait(400);

  const opened = await api(() => window.__scriareProjectStore.getState().project?.name ?? null);
  check("the fixture is open", opened === "The Blue Hour", String(opened));

  // ── the save dialog answers with a path instead of a person ───────────
  await app.evaluate(({ dialog }, directory) => {
    globalThis.__realShowSaveDialog = dialog.showSaveDialog;
    globalThis.__scriptTarget = null;
    dialog.showSaveDialog = async (...args) => {
      const options = args.length > 1 ? args[1] : args[0];
      const suggested = String(options.defaultPath ?? "script");
      const name = suggested.split(/[\\/]/).pop();
      const filePath = `${directory}/${name}`;
      globalThis.__scriptTarget = filePath;
      return { canceled: false, filePath };
    };
  }, out);

  /** Drives the real IPC path, exactly as the dialog's button does. */
  const exportScript = (format, layout, showConditions) =>
    api(
      async ({ format, layout, showConditions }) => {
        const project = window.__scriareProjectStore.getState().project;
        const model = window.__scriareBuildScript(project, { layout, showConditions });
        const html = window.__scriareScriptHtml(model);
        return window.api.script.save({
          format,
          model,
          html,
          suggestedName: `Blue ${layout} ${showConditions ? "full" : "clean"}`,
          nearPath: null,
        });
      },
      { format, layout, showConditions },
    );

  const hasHooks = await api(() =>
    Boolean(window.__scriareBuildScript && window.__scriareScriptHtml),
  );
  check("the script builder is reachable from the renderer", hasHooks);
  if (!hasHooks) return;

  // ── the PDF ───────────────────────────────────────────────────────────
  const pdf = await exportScript("pdf", "screenplay", true);
  check("a PDF is written", Boolean(pdf?.filePath?.endsWith(".pdf")) && pdf.bytes > 5000,
    `${pdf?.filePath} ${pdf?.bytes} bytes`);

  const pages = execFileSync("pdftotext", ["-layout", pdf.filePath, "-"], { encoding: "utf-8" })
    .split("\f")
    .filter((p) => p.trim().length);
  const pdfText = pages.join("\n");

  check("...with more than one page", pages.length > 3, `${pages.length} pages`);

  check(
    "every scene reaches the page",
    ["The Blue Hour", "The Sixth Vat", "The Gate House", "The List", "The Vote Carries"].every((t) =>
      pdfText.includes(t.toUpperCase()),
    ),
    `${pages.length} pages of it`,
  );

  check(
    "the cast list names the inner voices as speakers",
    ["ARITHMETIC", "THE HANDS", "APPETITE", "Nesrin Aydın"].every((n) => pdfText.includes(n)),
  );

  // ── the page ends, which is the whole point of the pagination work ────
  // His words asking for it: "some branches could go off the page, make it
  // seem organized regarding the pages, don't wanna see it clutter in the
  // page ends."
  const lastLines = pages.map((p) => {
    const lines = contentLines(p, "Blue screenplay full");
    return lines[lines.length - 1] ?? "";
  });

  const strandedSlug = lastLines.filter((l) => /—\s*CONTINUOUS$|^<LOCATION NOT SET>$/.test(l.trim()));
  check(
    "NO PAGE ENDS ON A SLUG LINE — a scene heading is never the last thing on a page",
    strandedSlug.length === 0,
    strandedSlug.join(" | ") || "none of them do",
  );

  const strandedNumber = lastLines.filter((l) => /^\d+\.\s+[A-ZÇĞİÖŞÜ' ]+$/.test(l.trim()));
  check(
    "...nor on a scene number with its scene overleaf",
    strandedNumber.length === 0,
    strandedNumber.join(" | ") || "none of them do",
  );

  const strandedChoices = lastLines.filter((l) => l.trim() === "CHOICES");
  check(
    "...nor on the word CHOICES with the choices overleaf",
    strandedChoices.length === 0,
    strandedChoices.join(" | ") || "none of them do",
  );

  const strandedCue = lastLines.filter((l) => /^(ARITHMETIC|THE HANDS|APPETITE|HIKMET BAL|NESRİN AYDIN|NESRIN AYDIN|DENIZ|YOU)$/.test(l.trim()));
  check(
    "...nor on a character's name with their line overleaf",
    strandedCue.length === 0,
    strandedCue.join(" | ") || "none of them do",
  );

  // ── conditions, and the choices a player never sees ───────────────────
  check(
    "a locked choice prints the reason it is locked",
    /locked unless\s+resolve is at least 3/.test(pdfText.replace(/\s+/g, " ")),
    "the vote's one gated line",
  );
  check(
    "a HIDDEN choice is printed anyway — a line left out is a line nobody records",
    pdfText.includes("Walk out under the barrier") &&
      /not shown to the player/.test(pdfText),
  );
  check(
    "gated prose says what gates it",
    /IF\s+hikmet_offer is true/.test(pdfText.replace(/\s+/g, " ")),
  );

  // ── the checkbox, off ─────────────────────────────────────────────────
  const clean = await exportScript("pdf", "screenplay", false);
  const cleanText = execFileSync("pdftotext", ["-layout", clean.filePath, "-"], { encoding: "utf-8" });
  check(
    "with conditions off, none of them print",
    !/locked unless|only if|hikmet_offer/.test(cleanText),
    "clean reading script",
  );
  check(
    "...but the gated prose is still there, because it is part of the story",
    cleanText.includes("He said two"),
  );
  check(
    "...and so is the hidden choice",
    cleanText.includes("Walk out under the barrier"),
  );

  // ── the page rules, measured against a control ───────────────────────
  //
  // Two earlier attempts at this failed in opposite directions. Asserting
  // that the stylesheet CONTAINS the rule tests the stylesheet, not the
  // PDF. Asserting that a real story never strands a heading passes for
  // the wrong reason: a stranded heading turns out to be about a one-in-
  // seventeen-pages event, so a thirty-page script is silent about a rule
  // that has stopped working, and the negative control aimed at it came
  // back green twice.
  //
  // So the rule is measured the way a drug is: the same document is
  // printed twice, once with the page rules and once with them neutered,
  // and the difference is the assertion. The control render states its
  // own precondition — if IT strands nothing, this proves nothing, and
  // the spec says so rather than passing.
  const stress = await api(() => {
    const say = (speaker, text) => ({
      type: "paragraph",
      attrs: { speaker },
      content: [{ type: "text", text }],
    });
    const filler = (i) =>
      `Line ${i}. ` +
      "The vat breathes and the cloth comes up bronze and goes blue in the air. ".repeat(2);
    // Forty scenes of UNEVEN length, every one past the keep-whole
    // threshold so the scene is not wrapped as a single unbreakable
    // block. Uneven is the point: it walks the headings across the page
    // grid instead of landing them all at the same height.
    const scenes = Array.from({ length: 40 }, (_, n) => {
      const blocks = 8 + (n % 7);
      return {
        id: `L${n}`,
        title: `Long Scene ${n + 1}`,
        position: { x: 0, y: n * 216 },
        content: {
          type: "doc",
          content: [
            ...Array.from({ length: blocks }, (_, i) => say(i % 3 === 0 ? "c1" : null, filler(i))),
            {
              type: "choiceBlock",
              attrs: { blockId: `b${n}` },
              content: Array.from({ length: 12 }, (_, j) => ({
                type: "choiceOption",
                attrs: {
                  optionId: `o${n}-${j}`,
                  targetSceneId: `L${(n + 1) % 40}`,
                  actions: [],
                  conditions: [],
                  whenUnmet: "hide",
                  style: null,
                  speaker: null,
                },
                content: [
                  { type: "text", text: `Option ${j + 1} of a block that must not be split` },
                ],
              })),
            },
          ],
        },
      };
    });
    const project = {
      id: "stress",
      name: "Long Scenes",
      createdAt: "",
      updatedAt: "",
      startSceneId: "L0",
      scenes,
      favorites: [],
      variables: [],
      choiceStyles: [],
      entities: [
        { id: "c1", kind: "character", name: "The Foreman", aliases: [], content: { type: "doc", content: [] } },
      ],
      content: [
        { id: "chap", kind: "folder", name: "One Long Chapter", category: "story", parentId: null, order: 0 },
        ...scenes.map((s, i) => ({
          id: s.id, kind: "leaf", refType: "scene", category: "story", parentId: "chap", order: i,
        })),
      ],
    };
    const model = window.__scriareBuildScript(project, { layout: "screenplay", showConditions: true });
    return window.__scriareScriptHtml(model);
  });

  /** Prints a given page and reports what each page ended and began with. */
  const printAndRead = async (html, name) => {
    const written = await api(
      async ({ html, name }) =>
        window.api.script.save({
          format: "pdf",
          model: { title: name, layout: "screenplay", showConditions: true, generatedAt: "", cast: [], chapters: [], stats: {} },
          html,
          suggestedName: name,
          nearPath: null,
        }),
      { html, name },
    );
    const pdfPages = execFileSync("pdftotext", ["-layout", written.filePath, "-"], { encoding: "utf-8" })
      .split("\f")
      .filter((p) => p.trim().length);
    return {
      pages: pdfPages.length,
      ends: pdfPages.map((p) => {
        const l = contentLines(p, name);
        return l[l.length - 1] ?? "";
      }),
      starts: pdfPages.map((p) => {
        const l = p.split("\n").map((x) => x.trim()).filter(Boolean);
        return l[0] ?? "";
      }),
    };
  };

  // The control: the same script with the two page rules turned off. The
  // replacements are asserted to have landed, so a rename in the
  // stylesheet cannot quietly turn this into a comparison of two
  // identical documents.
  const neutered = stress
    .replace(".head { break-inside: avoid; break-after: avoid; }", ".head { }")
    .replace(".gate, .choices { break-inside: avoid; }", ".gate, .choices { }");
  check(
    "the control render really is missing the page rules",
    // Checked as the two exact rules, not as the absence of the words:
    // `.cue` uses break-after: avoid too, so a global search says the
    // substitution failed when it did not.
    !neutered.includes(".head { break-inside: avoid; break-after: avoid; }") &&
      !neutered.includes(".gate, .choices { break-inside: avoid; }") &&
      neutered !== stress,
    "both substitutions landed",
  );

  const real = await printAndRead(stress, "Long Scenes");
  const control = await printAndRead(neutered, "Long Scenes Control");

  const STRANDED = /—\s*CONTINUOUS$|^<LOCATION NOT SET>$|^\d+\.\s+LONG SCENE|^CHOICES$/;
  const SPLIT = /^([2-9]|1[0-2])\.\s+Option/;

  const realStranded = real.ends.filter((l) => STRANDED.test(l.trim()));
  const controlStranded = control.ends.filter((l) => STRANDED.test(l.trim()));
  const realSplit = real.starts.filter((l) => SPLIT.test(l));
  const controlSplit = control.starts.filter((l) => SPLIT.test(l));

  check(
    "the stress story is long enough to prove anything",
    real.pages >= 40,
    `${real.pages} pages from 40 scenes`,
  );
  // Stated per rule rather than as one total, because the two are not
  // equally visible here. Splitting a twelve-option choice block across a
  // page happens constantly without the rule; stranding a heading turns
  // out to be roughly a one-in-seventeen-pages event even unprotected,
  // and the paragraph orphan/widow rules already absorb most of it. So
  // this suite can demonstrate the choice rule and cannot demonstrate the
  // heading rule — which is worth saying out loud rather than implying by
  // a control that quietly never fails.
  check(
    "WITHOUT the choice rule, blocks DO split across pages",
    controlSplit.length > 0,
    `${controlSplit.length} split blocks in the control — if this is 0 the comparison below means nothing`,
  );
  check(
    "WITH them, not one page ends on a heading or the word CHOICES",
    realStranded.length === 0,
    realStranded.join(" | ") || `0 of ${real.pages} pages`,
  );
  check(
    "...and not one choice block is split across a page",
    realSplit.length === 0,
    realSplit.join(" | ") || `0 of ${real.pages} pages`,
  );
  // ── the DOCX ──────────────────────────────────────────────────────────
  const docx = await exportScript("docx", "production", true);
  check("a DOCX is written", Boolean(docx?.filePath?.endsWith(".docx")) && docx.bytes > 5000,
    `${docx?.filePath} ${docx?.bytes} bytes`);

  const xml = readDocxXml(await fs.readFile(docx.filePath));
  const text = docxText(xml);

  check(
    "Word gets the same story the PDF got",
    ["THE GATE HOUSE", "THE OFFER, SAID PLAINLY", "THE VOTE CARRIES"].every((t) => text.includes(t)),
  );
  check(
    "...and the same locked choice, worded the same way",
    text.replace(/\s+/g, " ").includes("locked unless resolve is at least 3"),
    "one phrasing, shared by both renderers",
  );

  // The page rules, as Word actually stores them. `break-inside: avoid`
  // has no equivalent, so the renderer has to spell it as keepNext on
  // every paragraph of the run — if these are absent the document still
  // opens and still reads correctly, and breaks in all the wrong places.
  const keepNext = (xml.match(/<w:keepNext\s*\/>/g) ?? []).length;
  const keepLines = (xml.match(/<w:keepLines\s*\/>/g) ?? []).length;
  const pageBreaks = (xml.match(/<w:pageBreakBefore\s*\/>/g) ?? []).length;

  check("Word is told to keep headings with what follows them", keepNext > 50, `${keepNext} keepNext`);

  // Counting keepNext across the whole file is too blunt to fail: the
  // production layout builds most of its rows itself and only a handful
  // through the shared helper, so breaking that helper barely moved the
  // number and the control came back green. The property that actually
  // matters is per paragraph — EVERY character cue must hold on to the
  // line underneath it, or a name ends up alone at the foot of a page.
  const screenplayDocx = await exportScript("docx", "screenplay", true);
  const spXml = readDocxXml(await fs.readFile(screenplayDocx.filePath));
  const paragraphs = spXml
    .split("</w:p>")
    .map((chunk) => ({
      text: (chunk.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) ?? [])
        .map((t) => t.replace(/<[^>]+>/g, ""))
        .join(""),
      keeps: /<w:keepNext\s*\/>/.test(chunk),
    }));
  const cues = paragraphs.filter((p) => /^(ARITHMETIC|THE HANDS|APPETITE|HIKMET BAL|DENIZ|YOU)$/.test(p.text.trim()));
  check(
    "every character cue in the Word file holds on to its line",
    cues.length > 20 && cues.every((c) => c.keeps),
    `${cues.filter((c) => c.keeps).length}/${cues.length} cues keep the next paragraph`,
  );
  check("...and to keep a paragraph's lines together", keepLines > 100, `${keepLines} keepLines`);
  check(
    "...and to start every chapter on a fresh page",
    pageBreaks === 5,
    `${pageBreaks} page breaks for 5 chapters`,
  );

  // ── put it back ───────────────────────────────────────────────────────
  await app.evaluate(({ dialog }) => {
    dialog.showSaveDialog = globalThis.__realShowSaveDialog;
  });
  await fs.rm(out, { recursive: true, force: true });
  await api((p) => window.api.recent.remove(p), fixture);
  await seedProject();
  await wait(200);
  check(
    "the workspace is handed back to the next spec",
    await api(() => Boolean(window.__scriareProjectStore.getState().project)),
  );
}
