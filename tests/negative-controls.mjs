/**
 * Negative controls for v0.48.0 (Export).
 *
 *   node tests/negative-controls.mjs
 *
 * Not part of `npm test`. This is the thing run once, while building a
 * feature, to answer the only question that matters about a green suite:
 * would it have gone red?
 *
 * Each entry below breaks ONE thing in the shipped source, runs the spec
 * that is supposed to catch it, and reports whether the named assertion
 * actually failed. A control that PASSES is not good news — it is a finding
 * about the test, and the test is what gets rewritten.
 *
 * The file is restored after every case, including on a crash.
 */
import { readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (p) => join(root, "src/renderer/src", p);
const main = (p) => join(root, "src/main", p);

const CONTROLS = [
  {
    name: "a comparator that is off by one",
    file: src("export/pageRuntime.ts"),
    from: 'case "gte": result = a >= b; break;',
    to: 'case "gte": result = a > b; break;',
    spec: "export-evaluator",
    expect: "every condition evaluates the same",
  },
  {
    name: "an action that adds when it should subtract",
    file: src("export/pageRuntime.ts"),
    from: 'if (action.operation === "add") return current + operand;',
    to: 'if (action.operation === "add") return current - operand;',
    spec: "export-evaluator",
    expect: "every variable action produces the same value",
  },
  {
    name: "a boolean toggle that stops toggling",
    file: src("export/pageRuntime.ts"),
    from: 'if (action.operation === "toggle") return !now;',
    to: 'if (action.operation === "toggle") return now;',
    spec: "export-evaluator",
    expect: "every variable action produces the same value",
  },
  {
    name: "the export opening on the wrong ground",
    file: src("export/readingThemes.ts"),
    from: 'export const DEFAULT_GROUND: ReadingGround = "night";',
    to: 'export const DEFAULT_GROUND: ReadingGround = "paper";',
    spec: "export.spec",
    expect: "the story opens on Night",
  },
  {
    name: "Back that returns the reader but keeps the key they picked up",
    file: src("export/pageRuntime.ts"),
    from: "    state.scene = previous.scene;\n    state.values = previous.values;",
    to: "    state.scene = previous.scene;",
    spec: "export.spec",
    expect: "Back undoes what the choice did",
  },
  {
    name: "the story embedded without escaping",
    file: src("export/pageTemplate.ts"),
    from: '    .replace(/</g, "\\\\u003c")',
    to: "",
    spec: "export.spec",
    expect: "cannot end the exported file early",
  },
  {
    name: "a default choice style baked into a fixed colour",
    file: src("export/buildStory.ts"),
    from: "            b: resolveChoiceBox(styles, option.style),",
    to: '            b: { ...resolveChoiceBox(styles, option.style), fill: "#2a2a28", border: "#3a3a37" },',
    spec: "export.spec",
    expect: "still follows the reader's ground",
  },
  {
    name: "a contrast check that cannot see a hex",
    file: src("export/contrastCheck.ts"),
    from: "  const hex = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(text);",
    to: "  const hex = null;",
    spec: "export.spec",
    expect: "is flagged against Paper",
  },
  {
    name: "the two spellings of a ground drifting apart",
    file: src("export/readingThemes.ts"),
    from: '  paper: "#f9f6f2",',
    to: '  paper: "#fbf8f4",',
    spec: "export.spec",
    expect: "paints the same from the stylesheet",
  },
  {
    name: "a ground switch that changes the attribute and nothing else",
    file: src("export/pageStyles.ts"),
    from: ':root[data-ground="paper"] {',
    to: ':root[data-ground="paper-never-matches"] {',
    spec: "export.spec",
    expect: "actually repaints the page",
  },
  {
    name: "a returning reader dropped straight back in",
    file: src("export/pageRuntime.ts"),
    from: "    pendingSave = saved;",
    to: "    state.scene = saved.scene; state.values = saved.values || freshValues(); state.trail = saved.trail || [];",
    spec: "export.spec",
    expect: "offered, not forced on them",
  },
  {
    name: "speaker names left out of the export",
    file: src("export/buildStory.ts"),
    from: "    const spoken = applySpeakerPrefixes(resolved, entities);",
    to: "    const spoken = resolved;",
    spec: "export.spec",
    expect: "speaker's name as prose",
  },
  {
    name: "mentions exported under their stale stored label",
    file: src("export/buildStory.ts"),
    from: "    const resolved = resolveMentions(scene.content ?? EMPTY_DOC, entities);",
    to: "    const resolved = scene.content ?? EMPTY_DOC;",
    spec: "export.spec",
    expect: "character's current name",
  },
  {
    name: "a locked choice that will not say why",
    file: src("export/pageRuntime.ts"),
    from: '      why.textContent = "Requires " + choice.r;',
    to: '      why.textContent = "";',
    spec: "export.spec",
    expect: "says what it needs",
  },
  {
    name: "a page that reaches out to a font host",
    file: src("export/pageTemplate.ts"),
    from: "<title>${title}</title>",
    to: '<title>${title}</title>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope">',
    spec: "export.spec",
    expect: "asks the network for nothing",
  },
  {
    name: "a bare name saved with no extension at all",
    file: main("ipc/projectHandlers.ts"),
    from: '  return path.extname(filePath) === "" ? `${filePath}.${PROJECT_EXT}` : filePath;',
    to: "  return filePath;",
    spec: "project-file",
    expect: "without an extension is saved as .scriare",
  },
  {
    name: "the open dialog forgetting .json",
    file: main("ipc/projectHandlers.ts"),
    from: '  { name: "Scriare Project", extensions: [PROJECT_EXT, "json"] },',
    to: '  { name: "Scriare Project", extensions: [PROJECT_EXT] },',
    spec: "project-file",
    expect: "still lists .json alongside .scriare",
  },
  {
    name: "a new project offered loose in Documents",
    file: main("ipc/projectHandlers.ts"),
    from: "  const folder = path.join(documents, \"Scriare\");",
    to: "  const folder = documents;",
    spec: "project-file",
    expect: "offers Documents/Scriare",
  },
  {
    name: "an export that leaves a .bak beside itself",
    file: main("ipc/exportHandlers.ts"),
    from: "      await writeProjectFile(filePath, html, null, { noBackup: true });",
    to: "      await writeProjectFile(filePath, html, null);",
    spec: "project-file",
    expect: "leaves no .bak beside the page",
  },
  {
    name: "an export dropped in Documents instead of beside the story",
    file: main("ipc/exportHandlers.ts"),
    from: "      const directory = nearPath ? path.dirname(nearPath) : app.getPath(\"documents\");",
    to: "      const directory = app.getPath(\"documents\");",
    spec: "project-file",
    expect: "offered beside the project",
  },
];

async function runSpec(spec) {
  try {
    const { stdout } = await run(
      "xvfb-run",
      ["-a", "npm", "test"],
      { cwd: root, env: { ...process.env, SPEC: spec }, maxBuffer: 64 * 1024 * 1024, timeout: 900_000 },
    );
    return stdout;
  } catch (error) {
    // A non-zero exit is the expected outcome here.
    return `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
}

// ONLY=project-file runs just the controls for one spec. The whole set is
// a quarter of an hour of rebuilds, and while a feature is being written
// the one that matters is the one just added.
const only = process.env.ONLY;
const selected = only ? CONTROLS.filter((c) => c.spec.startsWith(only)) : CONTROLS;

const verdicts = [];

for (const control of selected) {
  const original = await readFile(control.file, "utf-8");
  if (!original.includes(control.from)) {
    verdicts.push({ name: control.name, verdict: "COULD NOT APPLY", detail: "the source no longer contains that line" });
    console.log(`?  ${control.name} — source no longer contains that line`);
    continue;
  }

  await writeFile(control.file, original.replace(control.from, control.to), "utf-8");
  let output = "";
  try {
    output = await runSpec(control.spec);
  } finally {
    await writeFile(control.file, original, "utf-8");
  }

  const failedLines = output
    .split("\n")
    .filter((line) => line.trim().startsWith("✗"))
    .map((line) => line.trim());
  const caught = failedLines.some((line) => line.includes(control.expect));
  const crashed = /Error:|TypeError|SyntaxError/.test(output) && failedLines.length === 0;

  verdicts.push({
    name: control.name,
    verdict: caught ? "caught" : crashed ? "CRASHED (no assertion failed)" : "NOT CAUGHT",
    detail: failedLines.slice(0, 3).join(" | ") || "nothing failed",
  });
  console.log(`${caught ? "✓ " : "✗ "} ${control.name} — ${caught ? "caught" : "NOT CAUGHT"}`);
  if (!caught) console.log(`     ${failedLines.slice(0, 4).join("\n     ") || "the whole suite stayed green"}`);
}

console.log("\n──────── negative controls ────────");
for (const v of verdicts) console.log(`${v.verdict === "caught" ? "✓" : "✗"} ${v.name}: ${v.verdict}`);
const clean = verdicts.filter((v) => v.verdict === "caught").length;
console.log(`\n${clean}/${verdicts.length} sabotages were caught`);
process.exit(clean === verdicts.length ? 0 : 1);
