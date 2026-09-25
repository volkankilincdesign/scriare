/**
 * Negative controls for v0.48.0 (Export) and v0.49.0 (the audit fixes).
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
    // Rewritten for v0.49.0: the guard this used to sabotage was the
    // `extname(p) === ""` test, which the audit replaced with a known-set
    // membership test. The control kept pointing at the old line and
    // reported COULD NOT APPLY — which is the harness telling the truth,
    // but only about itself. This sabotages the replacement.
    from: "  return KNOWN_PROJECT_EXTENSIONS.has(extension) ? filePath : `${filePath}.${PROJECT_EXT}`;",
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
    expect: "leaves no backup beside the page",
  },
  {
    name: "an export dropped in Documents instead of beside the story",
    file: main("ipc/exportHandlers.ts"),
    from: "      const directory = nearPath ? path.dirname(nearPath) : app.getPath(\"documents\");",
    to: "      const directory = app.getPath(\"documents\");",
    spec: "project-file",
    expect: "offered beside the project",
  },
  /* ── v0.49.0, the audit fixes ─────────────────────────────────── */
  {
    name: "a scene swap that goes back into the undo stack",
    file: src("utils/loadDocument.ts"),
    from: "  editor.view.updateState(\n    EditorState.create({\n      doc,\n      plugins: editor.state.plugins,\n    }),\n  );",
    to: "  editor.commands.setContent(content);",
    spec: "audit-fixes",
    expect: "undo cannot write one scene's text into another",
  },
  {
    name: "a conflict reload the editor does not notice",
    file: src("components/editor/SceneEditor.tsx"),
    from: "    const key = `${documentToken}:${scene.id}`;",
    to: "    const key = `${scene.id}`;",
    spec: "audit-fixes",
    expect: "does not write the discarded text back",
  },
  {
    name: "a structural undo that eats character-page prose",
    file: src("state/history.ts"),
    from: "  return changed ? { ...snapshot, scenes, entities } : snapshot;",
    to: "  return changed ? { ...snapshot, scenes } : snapshot;",
    spec: "audit-fixes",
    expect: "keeps prose written on a character page",
  },
  {
    name: "Delete reaching the selection behind an open dialog",
    file: src("utils/keyboardFocus.ts"),
    from: "export function aDialogIsOpen(): boolean {\n  return aModalIsOpen();\n}",
    to: "export function aDialogIsOpen(): boolean {\n  return false;\n}",
    spec: "audit-fixes",
    expect: "does not reach the selection behind an open dialog",
  },
  {
    name: "a new scene opened while a character page stays open",
    file: src("state/projectStore.ts"),
    // The first version of this control inserted a `// DISABLED` comment
    // ABOVE the fix and left `selectedEntityId: null` in place — a
    // sabotage that changed nothing, which the suite correctly reported
    // as unchanged and I read as "the test measures nothing". The control
    // was wrong, not the test. It now puts the v0.48.0 behaviour back:
    // the scene is selected and whatever entity was open stays open.
    from: "      selectedSceneId: scene.id,\n      // Whatever opens a scene closes an entity page: the interface\n      // comment on `selectedEntityId` promises \"exactly one of this and\n      // `selectedSceneId` is ever set\", and `selectScene`/`selectEntity`\n      // were the only two that kept it. Creating, duplicating, pasting or\n      // deleting while a Character page was open left BOTH set \u2014 and\n      // EditorGraphSplit resolves that tie as \"entity wins\", so the tree\n      // and the Inspector switched to the new scene while everything typed\n      // still went into the character (v0.49.0).\n      selectedEntityId: null,",
    to: "      selectedSceneId: scene.id,",
    spec: "audit-fixes",
    expect: "closes the page",
  },
  {
    name: "per-character folding that eats spaces again",
    file: src("utils/textFold.ts"),
    from: "    const piece = foldRun(value[i]);",
    to: "    const piece = fold(value[i]);",
    spec: "audit-fixes",
    expect: "a search with a space in it finds the words",
  },
  {
    name: "a leaf node measured as a block",
    file: src("utils/findInStory.ts"),
    from: 'const LEAF_TYPES = new Set([MENTION_TYPE, "horizontalRule", "hardBreak"]);',
    to: "const LEAF_TYPES = new Set([MENTION_TYPE]);",
    spec: "audit-fixes",
    expect: "points at the right characters",
  },
  {
    name: "an empty spoken line that consumes the run again",
    file: src("utils/speakerLines.ts"),
    from: "      if (!hasVisibleText(node)) return node;\n\n      const speaker = nodeSpeaker(node.attrs);\n      const name = run.line(speaker) ? speakerName(speaker, entities) : null;\n      if (!name) return node;",
    to: "      const speaker = nodeSpeaker(node.attrs);\n      const name = run.line(speaker) ? speakerName(speaker, entities) : null;\n      if (!name || !hasVisibleText(node)) return node;",
    spec: "audit-fixes",
    expect: "does not swallow the speaker's name",
  },
  {
    name: "a folded chapter that only hides scenes when its box was drawn by hand",
    file: src("utils/graphGroups.ts"),
    from: '    (n): n is ContentFolder => n.kind === "folder" && Boolean(n.collapsed),',
    to: '    (n): n is ContentFolder => n.kind === "folder" && Boolean(n.collapsed) && Boolean(n.rect),',
    spec: "audit-fixes",
    expect: "hides its scenes even when its box was derived",
  },
  {
    name: "a late save that stamps whichever project is open now",
    file: src("state/projectStore.ts"),
    from: "      if (get().filePath !== filePath) {\n        saveQueued = false;\n        return;\n      }",
    to: "      if (false) {\n        saveQueued = false;\n        return;\n      }",
    spec: "audit-fixes",
    expect: "does not stamp whichever project is open now",
  },
  {
    name: "closing the project cancelling its pending write again",
    file: src("state/projectStore.ts"),
    from: "    if (get().saveStatus !== \"saved\" && !get().saveConflict) {\n      await get().saveNow();\n    }",
    to: "    // DISABLED",
    spec: "audit-fixes",
    expect: "writes the pending change first",
  },
  {
    name: "a backup rotation that overwrites in place",
    file: main("projectFile.ts"),
    from: "  for (let slot = BACKUP_SLOTS; slot > 1; slot -= 1) {\n    await fs.rename(backupPathFor(filePath, slot - 1), backupPathFor(filePath, slot)).catch(() => {});\n  }",
    to: "  // DISABLED",
    spec: "project-file",
    expect: "pushes the older one down instead of destroying it",
  },
  {
    name: "an export that honours whatever extension it is handed",
    file: main("ipc/exportHandlers.ts"),
    from: "  if (WEB_PAGE_EXTENSIONS.has(extension)) return filePath;",
    to: "  if (extension !== \"\") return filePath;",
    spec: "project-file",
    expect: "redirected to a web page",
  },
  {
    name: "a project extension guard that tests for emptiness",
    file: main("ipc/projectHandlers.ts"),
    from: "  return KNOWN_PROJECT_EXTENSIONS.has(extension) ? filePath : `${filePath}.${PROJECT_EXT}`;",
    to: "  return extension !== \"\" ? filePath : `${filePath}.${PROJECT_EXT}`;",
    spec: "project-file",
    expect: "extension-shaped still gets .scriare",
  },
  /* ── v0.49.1, the close path ──────────────────────────────────── */
  {
    name: "a flush that returns without waiting for the save in flight",
    file: src("state/projectStore.ts"),
    from: "      await saveRun;\n      return;",
    to: "      return;",
    spec: "close-safety",
    expect: "keystrokes typed while a save was in flight",
  },
  {
    name: "a saveRun that resolves before the queued re-run",
    file: src("state/projectStore.ts"),
    from: "    if (saveQueued) {\n      saveQueued = false;\n      await get().saveNow();\n    }\n    } finally {",
    to: "    settle();\n    if (saveQueued) {\n      saveQueued = false;\n      await get().saveNow();\n    }\n    } finally {",
    spec: "close-safety",
    expect: "resolves only once the newest text is on disk",
  },
  // REMOVED, deliberately. The sabotage was "reset the flags before the
  // flush instead of after", and it changed nothing: `closeProject` calls
  // `saveNow`, which sets `saveQueued` itself, so clearing it beforehand is
  // overwritten a line later. v0.49.0's bug was the reset landing AFTER a
  // flush that had not waited — and `await saveRun` is what fixes that, so
  // the ordering in closeProject is belt-and-braces rather than mechanism.
  // The control passing said so, and the comment in closeProject claiming
  // the order "has to" be that way was corrected to match.
  {
    name: "a renderer that stops saying it is alive",
    file: src("hooks/useCloseGuard.ts"),
    from: "      const pulse = setInterval(() => window.api.lifecycle.stillWorking(), 1000);",
    to: "      const pulse = setInterval(() => {}, 1000);",
    spec: "close-heartbeat",
    expect: "keeps reporting it is alive",
  },
  {
    name: "a pulse that keeps running after the answer",
    file: src("hooks/useCloseGuard.ts"),
    from: "        } finally {\n          clearInterval(pulse);\n        }",
    to: "        } finally {\n          void pulse;\n        }",
    spec: "close-heartbeat",
    expect: "stops pulsing once the answer is given",
  },
  {
    name: "a close that discards an unanswered conflict without asking",
    file: src("hooks/useCloseGuard.ts"),
    from: "        if (store.project && store.saveConflict) {",
    to: "        if (!store.project && store.saveConflict) {",
    spec: "close-heartbeat",
    expect: "asks before discarding",
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
const matching = only ? CONTROLS.filter((c) => c.spec.startsWith(only)) : CONTROLS;

// SKIP/TAKE cut the selection into runs that finish inside a shell's time
// limit. Every control is a full production rebuild plus a spec run, so a
// dozen of them against one spec is beyond any sane command timeout, and a
// run that gets killed halfway is the thing the pre-flight above exists to
// clean up after. `ONLY=export.spec SKIP=6 TAKE=6` is the second half.
const skip = Number(process.env.SKIP ?? 0);
const take = Number(process.env.TAKE ?? matching.length);
const selected = matching.slice(skip, skip + take);

/**
 * The pre-flight, and why it exists.
 *
 * The restore below is in a `finally`, which covers a failing spec and a
 * thrown error and does NOT cover the runner being killed — and this thing
 * runs for a quarter of an hour, so being killed is the ordinary case, not
 * the exotic one. It happened during v0.49.0: the process was SIGKILLed
 * mid-control and `return current + operand` was left in the shipped source
 * as `return current - operand`. Nothing noticed. The next run reported
 * that control as COULD NOT APPLY, which is true and reads like a stale
 * control rather than "your source is currently broken".
 *
 * So before anything is sabotaged, every control's `from` is checked. Three
 * outcomes, and the middle one is the one worth having:
 *
 *   from present                  — fine
 *   from absent, `to` present     — THE SOURCE IS STILL SABOTAGED
 *   from absent, `to` absent too  — the control is stale, rewrite it
 *
 * `--restore` puts the second kind back. It is deliberately not automatic:
 * a file that differs from what a control expects might be a half-finished
 * edit, and silently rewriting the writer's source to match a test fixture
 * is the sort of help nobody asked for.
 */
async function preflight({ restore }) {
  const stale = [];
  const sabotaged = [];
  for (const control of CONTROLS) {
    const text = await readFile(control.file, "utf-8");
    if (text.includes(control.from)) continue;
    if (control.to !== "" && text.includes(control.to)) sabotaged.push(control);
    else stale.push(control);
  }

  for (const control of sabotaged) {
    if (restore) {
      const text = await readFile(control.file, "utf-8");
      await writeFile(control.file, text.replace(control.to, control.from), "utf-8");
      console.log(`↺  restored: ${control.file.replace(root, ".")} — ${control.name}`);
    } else {
      console.log(`!  STILL SABOTAGED: ${control.file.replace(root, ".")} — ${control.name}`);
    }
  }
  for (const control of stale) {
    console.log(`?  stale control (neither its before nor its after is there): ${control.name}`);
  }

  if (sabotaged.length && !restore) {
    console.log(
      "\nA previous run was interrupted before it could put the source back." +
        "\nRun `node tests/negative-controls.mjs --restore` before anything else.",
    );
    process.exit(2);
  }
  if (restore) {
    console.log(sabotaged.length ? `\n${sabotaged.length} restored.` : "\nNothing was left sabotaged.");
    process.exit(0);
  }
}

await preflight({ restore: process.argv.includes("--restore") });

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
