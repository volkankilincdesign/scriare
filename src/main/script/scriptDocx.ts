import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TabStopType,
  TextRun,
} from "docx";
import type { ScriptChoice, ScriptDocument, ScriptScene } from "../../shared/script/model";

/**
 * The same script, as a Word file (v0.64.0).
 *
 * It reads the SAME `ScriptDocument` the PDF is typeset from, so the two
 * formats cannot disagree about what the story says — only about how it
 * looks. Built in the main process because `Packer.toBuffer` is Node and
 * because the file is written here anyway.
 *
 * THE PAGE RULES, TRANSLATED. Word has no `break-inside: avoid` for an
 * arbitrary run of paragraphs; it has two per-paragraph properties, and
 * every rule the stylesheet states has to be rebuilt out of them:
 *
 *   break-inside: avoid   →  keepNext on every paragraph but the last
 *   break-after:  avoid   →  keepNext on that paragraph
 *   orphans/widows        →  keepLines on the paragraph
 *   break-before: page    →  pageBreakBefore
 *
 * Which is why `keepWhole` is decided in the model rather than in the
 * CSS: the renderer that cannot express the rule still has to obey it.
 */

const FONT = "Courier New";
const MONO = { font: FONT };

/** Half-points, which is what docx measures type in. */
const pt = (size: number): number => Math.round(size * 2);
/** Twips. 1440 to the inch, 567 to the centimetre. */
const mm = (value: number): number => Math.round((value * 1440) / 25.4);

interface Opts {
  keepNext?: boolean;
  keepLines?: boolean;
  indent?: { left?: number; right?: number };
  spacing?: { before?: number; after?: number };
  bold?: boolean;
  size?: number;
  color?: string;
  align?: (typeof AlignmentType)[keyof typeof AlignmentType];
}

function line(text: string, o: Opts = {}): Paragraph {
  return new Paragraph({
    keepNext: o.keepNext ?? false,
    keepLines: o.keepLines ?? true,
    alignment: o.align,
    indent: o.indent,
    spacing: { before: o.spacing?.before ?? 0, after: o.spacing?.after ?? mm(2) },
    children: [
      new TextRun({ ...MONO, text, bold: o.bold, size: pt(o.size ?? 11), color: o.color }),
    ],
  });
}

const destination = (choice: ScriptChoice): string =>
  choice.target ? `${choice.target.n}. ${choice.target.title}` : "not linked yet";

function choiceMeta(choice: ScriptChoice): string[] {
  const bits: string[] = [];
  if (choice.unmet === "hide" && choice.conditions.length) bits.push("hidden when unmet");
  if (choice.conditions.length) {
    bits.push(
      `${choice.unmet === "lock" ? "locked unless" : "only if"} ${choice.conditions.join(" and ")}`,
    );
  }
  if (choice.actions.length) bits.push(choice.actions.join(", "));
  return bits;
}

// ── screenplay ──────────────────────────────────────────────────────────

function screenplay(scene: ScriptScene): Paragraph[] {
  const out: Paragraph[] = [];
  // keepNext on both: a slug line and a scene number may never be the last
  // thing on a page.
  out.push(
    line(scene.location ? `${scene.location.toUpperCase()} — CONTINUOUS` : "<LOCATION NOT SET>", {
      bold: true,
      keepNext: true,
      spacing: { before: mm(5), after: 0 },
    }),
  );
  out.push(
    line(`${scene.n}. ${scene.title.toUpperCase()}`, {
      size: 9,
      color: "595959",
      keepNext: true,
      spacing: { after: mm(4) },
    }),
  );

  const speech = (speaker: string | null, text: string, keepNext: boolean): Paragraph[] =>
    speaker
      ? [
          line(speaker.toUpperCase(), { bold: true, keepNext: true, indent: { left: mm(52) }, spacing: { after: 0 } }),
          line(text, { keepNext, indent: { left: mm(30), right: mm(26) }, spacing: { after: mm(3.5) } }),
        ]
      : [line(text, { keepNext, indent: { right: mm(14) }, spacing: { after: mm(3.5) } })];

  const blocks = scene.blocks;
  blocks.forEach((block, bi) => {
    // Inside a scene we keep whole, every paragraph but the very last
    // holds on to the next one. That is Word's only way to say "do not
    // split this run".
    const holdAll = scene.keepWhole && bi < blocks.length - 1;

    if (block.kind === "line") {
      out.push(...speech(block.line.speaker, block.line.text, holdAll));
    } else if (block.kind === "gate") {
      out.push(
        line(`IF ${block.conditions.join(" AND ")}`, {
          size: 9,
          color: "404040",
          keepNext: true,
          indent: { left: mm(4) },
          spacing: { after: mm(1.5) },
        }),
      );
      block.lines.forEach((l, i) =>
        out.push(...speech(l.speaker, l.text, holdAll || i < block.lines.length - 1)),
      );
    } else if (block.kind === "dialogue") {
      // A conversation prints as one unbreakable run: keepNext on every
      // paragraph but the last, which is Word's only way to say
      // break-inside: avoid.
      out.push(
        line("CONVERSATION", {
          bold: true, size: 9, keepNext: true, spacing: { before: mm(4), after: mm(1.5) },
        }),
      );
      block.lines.forEach((spoken, i) => {
        const last = i === block.lines.length - 1;
        out.push(...speech(spoken.speaker, spoken.text, !last || holdAll));
        if (spoken.after !== "leave" && spoken.reply) {
          out.push(...speech(spoken.replySpeaker, spoken.reply, !last || holdAll));
        }
        const meta = [
          spoken.repeatable ? "can be said again" : "",
          spoken.conditions.length
            ? `${spoken.unmet === "lock" ? "locked unless" : "only if"} ${spoken.conditions.join(" and ")}`
            : "",
          spoken.actions.length ? spoken.actions.join(", ") : "",
          spoken.after === "end"
            ? "ends the conversation"
            : spoken.after === "leave"
              ? `leaves to ${spoken.target ? `${spoken.target.n}. ${spoken.target.title}` : "nowhere yet"}`
              : "",
        ].filter(Boolean);
        if (meta.length) {
          out.push(
            line(meta.join("   ·   "), {
              size: 8.5, color: "595959", keepNext: !last || holdAll,
              indent: { left: mm(30) }, spacing: { after: mm(2) },
            }),
          );
        }
      });
    } else {
      out.push(
        line("CHOICES", { bold: true, size: 9, keepNext: true, spacing: { before: mm(4), after: mm(1.5) } }),
      );
      block.options.forEach((option, i) => {
        const meta = choiceMeta(option);
        // keepNext across every option and its metadata: a choice block
        // splitting across a page is the exact clutter this avoids.
        const last = i === block.options.length - 1 && meta.length === 0;
        out.push(
          new Paragraph({
            keepNext: !last || holdAll,
            keepLines: true,
            indent: { left: mm(9), hanging: mm(9) },
            spacing: { after: meta.length ? 0 : mm(1) },
            tabStops: [{ type: TabStopType.RIGHT, position: mm(160) }],
            children: [
              new TextRun({ ...MONO, size: pt(11), text: `${i + 1}.\t${option.text || "(untitled choice)"}` }),
              new TextRun({ ...MONO, size: pt(9), color: "404040", text: `   → ${destination(option)}` }),
            ],
          }),
        );
        if (meta.length) {
          out.push(
            line(meta.join("   ·   "), {
              size: 8.5,
              color: "595959",
              keepNext: i < block.options.length - 1 || holdAll,
              indent: { left: mm(14) },
              spacing: { after: mm(1) },
            }),
          );
        }
      });
    }
  });
  return out;
}

// ── production script ───────────────────────────────────────────────────

function production(scene: ScriptScene): Paragraph[] {
  const out: Paragraph[] = [];
  out.push(
    new Paragraph({
      keepNext: true,
      keepLines: true,
      spacing: { before: mm(5), after: mm(2) },
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: "000000", space: 2 } },
      tabStops: [{ type: TabStopType.RIGHT, position: mm(165) }],
      children: [
        new TextRun({ ...MONO, size: pt(12), bold: true, text: `${scene.n}  ` }),
        new TextRun({ ...MONO, size: pt(10), bold: true, text: scene.title.toUpperCase() }),
        new TextRun({
          ...MONO,
          size: pt(8.5),
          color: "595959",
          text: `\t${scene.location ?? "<location not set>"}`,
        }),
      ],
    }),
  );

  const row = (ref: string, who: string | null, say: string, keepNext: boolean, shade?: boolean): Paragraph =>
    new Paragraph({
      keepNext,
      keepLines: true,
      indent: { left: mm(44), hanging: mm(44) },
      spacing: { after: mm(0.8) },
      ...(shade ? { shading: { fill: "F2F2F2" } } : {}),
      tabStops: [
        { type: TabStopType.LEFT, position: mm(16) },
        { type: TabStopType.LEFT, position: mm(44) },
      ],
      children: [
        new TextRun({ ...MONO, size: pt(8.5), color: "666666", text: `${ref}\t` }),
        new TextRun({ ...MONO, size: pt(8.5), bold: true, text: `${who ?? ""}\t` }),
        new TextRun({ ...MONO, size: pt(10), text: say }),
      ],
    });

  const blocks = scene.blocks;
  blocks.forEach((block, bi) => {
    const holdAll = scene.keepWhole && bi < blocks.length - 1;
    if (block.kind === "line") {
      out.push(row(`${scene.n}.${block.line.ref}`, block.line.speaker, block.line.text, holdAll));
    } else if (block.kind === "gate") {
      out.push(
        line(`if ${block.conditions.join(" and ")}`, {
          size: 9,
          color: "404040",
          keepNext: true,
          indent: { left: mm(44) },
          spacing: { after: mm(0.8) },
        }),
      );
      block.lines.forEach((l, i) =>
        out.push(
          row(
            `${scene.n}.${l.ref}`,
            l.speaker,
            l.text,
            holdAll || i < block.lines.length - 1,
            true,
          ),
        ),
      );
    } else if (block.kind === "dialogue") {
      out.push(
        line("CONVERSATION", {
          bold: true, size: 8.5, keepNext: true, spacing: { before: mm(3), after: mm(1) },
        }),
      );
      block.lines.forEach((spoken, i) => {
        const last = i === block.lines.length - 1;
        out.push(row(`${scene.n}.${spoken.ref}`, spoken.speaker, spoken.text, !last || holdAll));
        if (spoken.after !== "leave" && spoken.reply) {
          out.push(
            row(`${scene.n}.${spoken.ref}r`, spoken.replySpeaker, spoken.reply, !last || holdAll, true),
          );
        }
        const meta = [
          spoken.repeatable ? "repeatable" : "",
          spoken.conditions.length
            ? `${spoken.unmet === "lock" ? "locked unless" : "only if"} ${spoken.conditions.join(" and ")}`
            : "",
          spoken.actions.length ? spoken.actions.join(", ") : "",
          spoken.after === "end" ? "ends" : "",
          spoken.after === "leave"
            ? `leaves → ${spoken.target ? spoken.target.n : "—"}`
            : "",
        ].filter(Boolean);
        if (meta.length) {
          out.push(
            line(meta.join(" · "), {
              size: 8.5, color: "595959", keepNext: !last || holdAll,
              indent: { left: mm(44) }, spacing: { after: mm(1) },
            }),
          );
        }
      });
    } else {
      out.push(
        line("CHOICES", { bold: true, size: 8.5, keepNext: true, spacing: { before: mm(3), after: mm(1) } }),
      );
      block.options.forEach((option, i) => {
        const meta = choiceMeta(option);
        out.push(
          row(
            `${scene.n}.${option.ref}`,
            `→ ${option.target ? option.target.n : "—"}`,
            option.text || "(untitled choice)",
            i < block.options.length - 1 || meta.length > 0 || holdAll,
          ),
        );
        if (meta.length) {
          out.push(
            line(meta.join(" · "), {
              size: 8.5,
              color: "595959",
              keepNext: i < block.options.length - 1 || holdAll,
              indent: { left: mm(44) },
              spacing: { after: mm(1) },
            }),
          );
        }
      });
    }
  });
  return out;
}

// ── the document ────────────────────────────────────────────────────────

export async function buildScriptDocx(doc: ScriptDocument): Promise<Buffer> {
  const renderScene = doc.layout === "screenplay" ? screenplay : production;
  const when = new Date(doc.generatedAt);
  const stamp = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, "0")}-${String(
    when.getDate(),
  ).padStart(2, "0")}`;

  const title: Paragraph[] = [
    line(doc.title.toUpperCase(), { bold: true, size: 22, keepNext: true, spacing: { before: mm(28), after: mm(3) } }),
    line(doc.layout === "screenplay" ? "SCRIPT" : "PRODUCTION SCRIPT", {
      size: 11,
      keepNext: true,
      spacing: { after: mm(20) },
    }),
    ...(
      [
        ["Scenes", String(doc.stats.scenes)],
        ["Lines", String(doc.stats.lines)],
        ["Choices", String(doc.stats.choices)],
        ["Endings", String(doc.stats.endings)],
        ["Conditions", doc.showConditions ? "printed" : "omitted"],
        ["Exported", `${stamp} · Scriare`],
      ] as const
    ).map(([k, v]) =>
      new Paragraph({
        keepNext: true,
        keepLines: true,
        spacing: { after: mm(0.8) },
        tabStops: [{ type: TabStopType.LEFT, position: mm(34) }],
        children: [
          new TextRun({ ...MONO, size: pt(10), bold: true, text: `${k}\t` }),
          new TextRun({ ...MONO, size: pt(10), text: v }),
        ],
      }),
    ),
    line("CAST", { bold: true, size: 10, keepNext: true, spacing: { before: mm(14), after: mm(3) } }),
    ...doc.cast.map((member, i) =>
      new Paragraph({
        // The cast list holds together as one block; only the last member
        // releases the page.
        keepNext: i < doc.cast.length - 1,
        keepLines: true,
        spacing: { after: mm(0.6) },
        tabStops: [{ type: TabStopType.RIGHT, position: mm(90) }],
        children: [
          new TextRun({ ...MONO, size: pt(10), text: `${member.name}\t` }),
          new TextRun({ ...MONO, size: pt(10), color: "595959", text: String(member.lines) }),
        ],
      }),
    ),
  ];

  const chapters = doc.chapters.flatMap((chapter, ci) => {
    const heading: Paragraph[] = chapter.name
      ? [
          new Paragraph({
            // Every chapter opens a page. The first one too — it follows
            // the title page, which would otherwise run straight on.
            pageBreakBefore: true,
            keepNext: true,
            keepLines: true,
            heading: HeadingLevel.HEADING_1,
            spacing: { after: mm(10) },
            border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: "000000", space: 2 } },
            children: [
              new TextRun({ ...MONO, size: pt(13), bold: true, text: chapter.name.toUpperCase() }),
            ],
          }),
        ]
      : [
          new Paragraph({
            pageBreakBefore: ci === 0,
            keepNext: true,
            children: [new TextRun({ ...MONO, size: pt(1), text: "" })],
          }),
        ];
    return [...heading, ...chapter.scenes.flatMap(renderScene)];
  });

  const file = new Document({
    creator: "Scriare",
    title: doc.title,
    description: doc.layout === "screenplay" ? "Script" : "Production script",
    sections: [
      {
        properties: {
          page: { margin: { top: mm(20), right: mm(18), bottom: mm(18), left: mm(22) } },
        },
        children: [...title, ...chapters],
      },
    ],
  });

  return Packer.toBuffer(file);
}
