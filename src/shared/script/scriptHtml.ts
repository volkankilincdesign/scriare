import type { ScriptBlock, ScriptChoice, ScriptDocument, ScriptScene } from "./model";

/**
 * The script as a printable page (v0.64.0).
 *
 * This is what becomes the PDF: the main process loads it into an
 * offscreen window and calls `printToPDF`, so everything that decides
 * where a page ends is CSS paged media, right here.
 *
 * THE PAGE RULES ARE THE FEATURE. His words asking for it: "some branches
 * could go off the page, make it seem organized regarding the pages,
 * don't wanna see it clutter in the page ends." A script that breaks
 * wherever the text happens to run out reads as printed by accident, and
 * the specific failures all look the same to a reader — a scene heading
 * alone at the foot of a page, a character's name on one page and their
 * line on the next, three of five choices here and two overleaf. So:
 *
 *   · a chapter starts a page, always;
 *   · a scene short enough to fit is never split at all;
 *   · a heading or a cue can never be the last thing on a page;
 *   · a choice block and a gated passage are atomic;
 *   · no single line of a paragraph is left behind by itself.
 *
 * NO WEBFONTS. The offscreen window has no network by design, the same
 * rule the HTML export is built on, and a font that fails to load silently
 * re-typesets the whole document. Courier New is the screenplay
 * convention and is on every Windows machine; the DOCX renderer names the
 * same family, so the two formats set the same script.
 */

const esc = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function choiceMeta(choice: ScriptChoice): string[] {
  const bits: string[] = [];
  if (choice.conditions.length) {
    bits.push(
      `${choice.unmet === "lock" ? "locked unless" : "only if"} ${choice.conditions.join(" and ")}`,
    );
  }
  if (choice.actions.length) bits.push(choice.actions.join(", "));
  return bits;
}

const destination = (choice: ScriptChoice): string =>
  choice.target ? `${choice.target.n}. ${choice.target.title}` : "not linked yet";

// ── screenplay ──────────────────────────────────────────────────────────

function screenplayScene(scene: ScriptScene): string {
  const out: string[] = [];
  out.push(
    `<div class="head"><div class="slug">${
      scene.location ? esc(scene.location.toUpperCase()) + " — CONTINUOUS" : "&lt;LOCATION NOT SET&gt;"
    }</div><div class="sn">${scene.n}. ${esc(scene.title.toUpperCase())}</div></div>`,
  );

  const speech = (speaker: string | null, text: string): string =>
    speaker
      ? `<div class="speech"><div class="cue">${esc(speaker.toUpperCase())}</div><div class="dlg">${esc(text)}</div></div>`
      : `<p class="action">${esc(text)}</p>`;

  for (const block of scene.blocks as ScriptBlock[]) {
    if (block.kind === "line") {
      out.push(speech(block.line.speaker, block.line.text));
    } else if (block.kind === "gate") {
      out.push(
        `<div class="gate"><div class="gate-h">IF ${esc(block.conditions.join(" AND "))}</div>` +
          block.lines.map((l) => speech(l.speaker, l.text)).join("") +
          `</div>`,
      );
    } else {
      out.push(
        `<div class="choices"><div class="choices-h">CHOICES</div>` +
          block.options
            .map((option, i) => {
              const meta = choiceMeta(option);
              return (
                `<div class="opt"><span class="opt-n">${i + 1}.</span>` +
                `<span class="opt-t">${esc(option.text || "(untitled choice)")}</span>` +
                `<span class="opt-g">&rarr; ${esc(destination(option))}</span></div>` +
                (option.unmet === "hide" && option.conditions.length
                  ? `<div class="opt-m">not shown to the player when this fails</div>`
                  : "") +
                (meta.length ? `<div class="opt-m">${esc(meta.join("   ·   "))}</div>` : "")
              );
            })
            .join("") +
          `</div>`,
      );
    }
  }
  return `<section class="scene${scene.keepWhole ? " keep" : ""}">${out.join("")}</section>`;
}

// ── production script ───────────────────────────────────────────────────

function productionScene(scene: ScriptScene): string {
  const out: string[] = [];
  out.push(
    `<div class="head"><span class="p-n">${scene.n}</span><span class="p-t">${esc(
      scene.title.toUpperCase(),
    )}</span><span class="p-l">${
      scene.location ? esc(scene.location) : "&lt;location not set&gt;"
    }</span></div>`,
  );

  const row = (ref: string, speaker: string | null, text: string, cls = ""): string =>
    `<div class="row${cls ? " " + cls : ""}"><span class="ref">${scene.n}.${esc(ref)}</span>` +
    `<span class="who">${esc(speaker ?? "")}</span><span class="say">${esc(text)}</span></div>`;

  for (const block of scene.blocks as ScriptBlock[]) {
    if (block.kind === "line") {
      out.push(row(block.line.ref, block.line.speaker, block.line.text));
    } else if (block.kind === "gate") {
      out.push(
        `<div class="gate">` +
          `<div class="row cond"><span class="ref"></span><span class="who"></span>` +
          `<span class="say">if ${esc(block.conditions.join(" and "))}</span></div>` +
          block.lines.map((l) => row(l.ref, l.speaker, l.text, "in")).join("") +
          `</div>`,
      );
    } else {
      out.push(
        `<div class="choices"><div class="choices-h">CHOICES</div>` +
          block.options
            .map((option) => {
              const meta = choiceMeta(option);
              if (option.unmet === "hide" && option.conditions.length) {
                meta.unshift("hidden when unmet");
              }
              return (
                `<div class="row opt"><span class="ref">${scene.n}.${esc(option.ref)}</span>` +
                `<span class="who">&rarr; ${option.target ? option.target.n : "—"}</span>` +
                `<span class="say">${esc(option.text || "(untitled choice)")}` +
                (meta.length ? `<i>${esc(meta.join(" · "))}</i>` : "") +
                `</span></div>`
              );
            })
            .join("") +
          `</div>`,
      );
    }
  }
  return `<section class="scene${scene.keepWhole ? " keep" : ""}">${out.join("")}</section>`;
}

// ── the page ────────────────────────────────────────────────────────────

const PAGE_CSS = `
/* The page MARGINS are set by printToPDF, not here: Chromium draws the
   footer's page numbers in its own margin band, and a CSS @page margin
   leaves that band zero pixels tall and clips them without a word. The
   screen rule below is so the same file is readable if it is opened in a
   browser. */
@page { size: A4; }
@media screen { body { max-width: 170mm; margin: 0 auto; padding: 14mm 6mm; } }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: #111; }
body { font-family: "Courier New", Courier, monospace; font-size: 11pt; line-height: 1.45; }

/* ── where pages are allowed to end ───────────────────────────────── */
.chapter { break-before: page; }
.chapter:first-of-type { break-before: auto; }
.chapter-h {
  font-size: 13pt; font-weight: bold; letter-spacing: .06em;
  margin: 0 0 14mm; padding-bottom: 2mm; border-bottom: 1.5pt solid #111;
  break-after: avoid;
}
.scene { margin-bottom: 9mm; }
.scene.keep { break-inside: avoid; }
/* BOTH, and the second was a bug the stress case found. break-after
   keeps the heading with what follows it and says nothing about a break
   INSIDE it, so a page could end between the slug line and the scene
   number: the two halves of one heading, split across a page.
   (No backticks in this file's comments — they are inside a template
   literal, which is how v0.57.0 broke the build twice.) */
.head { break-inside: avoid; break-after: avoid; }
.speech { break-inside: avoid; }
.cue { break-after: avoid; }
.gate, .choices { break-inside: avoid; }
p, .dlg, .say { orphans: 2; widows: 2; }

/* ── the title page ───────────────────────────────────────────────── */
.title-page { break-after: page; padding-top: 28mm; }
.title-page h1 { font-size: 22pt; margin: 0 0 3mm; letter-spacing: .04em; }
.title-page .kind { font-size: 11pt; letter-spacing: .18em; margin: 0 0 24mm; }
.title-page dl { display: grid; grid-template-columns: 34mm 1fr; gap: 2mm 6mm; margin: 0 0 16mm; font-size: 10pt; }
.title-page dt { font-weight: bold; }
.title-page dd { margin: 0; }
.cast { border-top: 1pt solid #111; padding-top: 4mm; font-size: 10pt; }
.cast h2 { font-size: 10pt; letter-spacing: .14em; margin: 0 0 4mm; }
.cast li { list-style: none; display: flex; justify-content: space-between; max-width: 90mm; }
.cast ul { margin: 0; padding: 0; }
.cast .n { color: #555; }

/* ── screenplay ───────────────────────────────────────────────────── */
.k-screenplay .slug { font-weight: bold; letter-spacing: .04em; }
.k-screenplay .sn { font-size: 9pt; color: #555; letter-spacing: .08em; margin-bottom: 5mm; }
.k-screenplay .action { margin: 0 0 4mm; max-width: 148mm; }
.k-screenplay .cue { margin: 0 0 0 52mm; font-weight: bold; letter-spacing: .05em; }
.k-screenplay .dlg { margin: 0 0 4mm 30mm; max-width: 92mm; }
.k-screenplay .gate { margin: 0 0 4mm; border-left: 1.5pt solid #777; padding-left: 4mm; }
.k-screenplay .gate-h { font-size: 9pt; letter-spacing: .06em; color: #444; margin-bottom: 2mm; }
.k-screenplay .choices-h { font-size: 9pt; font-weight: bold; letter-spacing: .14em; margin: 5mm 0 2mm; }
.k-screenplay .opt { display: flex; gap: 3mm; align-items: baseline; }
.k-screenplay .opt-n { width: 6mm; flex: none; }
.k-screenplay .opt-t { flex: 1 1 auto; }
.k-screenplay .opt-g { font-size: 9pt; color: #444; white-space: nowrap; }
.k-screenplay .opt-m { margin: 0 0 2mm 9mm; font-size: 8.5pt; color: #555; }

/* ── production ───────────────────────────────────────────────────── */
.k-production { font-size: 10pt; }
.k-production .head {
  display: flex; gap: 5mm; align-items: baseline;
  border-bottom: 1.5pt solid #111; padding-bottom: 1.5mm; margin-bottom: 3mm;
}
.k-production .p-n { font-weight: bold; font-size: 12pt; }
.k-production .p-t { font-weight: bold; letter-spacing: .05em; flex: 1; }
.k-production .p-l { font-size: 8.5pt; color: #555; }
.k-production .row { display: flex; gap: 4mm; padding: .6mm 0; }
.k-production .ref { width: 16mm; flex: none; font-size: 8.5pt; color: #666; }
.k-production .who { width: 28mm; flex: none; font-weight: bold; font-size: 8.5pt; }
.k-production .say { flex: 1; }
.k-production .say i { display: block; font-size: 8.5pt; color: #555; }
.k-production .cond .say { color: #444; }
.k-production .in { background: #f2f2f2; }
.k-production .choices-h { font-size: 8.5pt; font-weight: bold; letter-spacing: .14em; margin: 3mm 0 1mm; }
.k-production .opt { border-top: .5pt solid #bbb; }
`;

export function buildScriptHtml(doc: ScriptDocument): string {
  const renderScene = doc.layout === "screenplay" ? screenplayScene : productionScene;
  const body = doc.chapters
    .map(
      (chapter) =>
        `<div class="chapter">` +
        (chapter.name ? `<h2 class="chapter-h">${esc(chapter.name)}</h2>` : "") +
        chapter.scenes.map(renderScene).join("") +
        `</div>`,
    )
    .join("");

  const when = new Date(doc.generatedAt);
  const stamp = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, "0")}-${String(
    when.getDate(),
  ).padStart(2, "0")}`;

  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>${esc(doc.title)}</title><style>${PAGE_CSS}</style></head>
<body class="k-${doc.layout}">
<section class="title-page">
  <h1>${esc(doc.title.toUpperCase())}</h1>
  <p class="kind">${doc.layout === "screenplay" ? "SCRIPT" : "PRODUCTION SCRIPT"}</p>
  <dl>
    <dt>Scenes</dt><dd>${doc.stats.scenes}</dd>
    <dt>Lines</dt><dd>${doc.stats.lines}</dd>
    <dt>Choices</dt><dd>${doc.stats.choices}</dd>
    <dt>Endings</dt><dd>${doc.stats.endings}</dd>
    <dt>Conditions</dt><dd>${doc.showConditions ? "printed" : "omitted"}</dd>
    <dt>Exported</dt><dd>${stamp} &middot; Scriare</dd>
  </dl>
  <div class="cast">
    <h2>CAST</h2>
    <ul>${doc.cast
      .map((c) => `<li><span>${esc(c.name)}</span><span class="n">${c.lines}</span></li>`)
      .join("")}</ul>
  </div>
</section>
${body}
</body>
</html>`;
}
