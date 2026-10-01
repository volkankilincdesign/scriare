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
const shared = (p) => join(root, "src/shared", p);
const mainScript = (p) => join(root, "src/main", p);

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
    // v0.80.0 — the box moved out of the choice and into a table keyed
    // by the class that paints it, so the sabotage moved with it.
    name: "a default choice style baked into a fixed colour",
    file: src("export/buildStory.ts"),
    from: "    const box = resolveChoiceBox(styles, ref);",
    to: '    const box = { ...resolveChoiceBox(styles, ref), fill: "#2a2a28", border: "#3a3a37" };',
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
    from: "    const spoken = applySpeakerPrefixes(resolved, entities, playerName);",
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
    from: "      why.textContent = choice.r;",
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
    from: "      if (!hasVisibleText(node)) return node;\n\n      const speaker = nodeSpeaker(node.attrs);\n      const name = run.line(speaker) ? speakerName(speaker, entities, playerName) : null;\n      if (!name) return node;",
    to: "      const speaker = nodeSpeaker(node.attrs);\n      const name = run.line(speaker) ? speakerName(speaker, entities, playerName) : null;\n      if (!name || !hasVisibleText(node)) return node;",
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
    // NOT CAUGHT from v0.49.1 until v0.78.2, and the disk check could
    // never have caught it: the queued save still lands a moment later,
    // and `readFile` is itself an await, so by the time the test looks the
    // right text is on disk. The ordering is asserted on `saveStatus` now,
    // which is exact — saveNow sets "saved" only when nothing is queued.
    name: "a saveRun that resolves before the queued re-run",
    file: src("state/projectStore.ts"),
    from: "    if (saveQueued) {\n      saveQueued = false;\n      await get().saveNow();\n    }\n    } finally {",
    to: "    settle();\n    if (saveQueued) {\n      saveQueued = false;\n      await get().saveNow();\n    }\n    } finally {",
    spec: "close-safety",
    expect: "while a queued save is still outstanding",
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
  /* ── v0.50.0, getting around without a mouse ──────────────────── */
  {
    name: "a tree row that a keyboard cannot reach",
    file: src("utils/clickableRow.ts"),
    from: "    role: \"button\",\n    tabIndex: 0,",
    to: "    role: undefined as never,\n    tabIndex: -1 as never,",
    spec: "accessibility",
    expect: "can be focused",
  },
  {
    name: "a disclosure row that ignores Enter",
    file: src("utils/clickableRow.ts"),
    from: '      if (event.key !== "Enter" && event.key !== " ") return;',
    to: '      if (event.key !== "F13") return;',
    spec: "accessibility",
    expect: "collapses it",
  },
  {
    name: "a character row that cannot be opened by key",
    file: src("components/layout/ContentBrowser.tsx"),
    from: "            {...rowActivation(() => {\n              browser.clearSelection();\n              selectEntity(entity.id);\n            })}",
    to: "",
    spec: "accessibility",
    expect: "focused and opened with Enter",
  },
  {
    name: "the transparent focus ring, put back",
    file: src("components/layout/ContentTreeRow.tsx"),
    from: 'className={`min-w-0 flex-1 cursor-default truncate px-1 py-1.5 text-left text-sm ${',
    to: 'className={`min-w-0 flex-1 cursor-default truncate px-1 py-1.5 text-left text-sm focus:outline-none ${',
    spec: "accessibility",
    expect: "paints a ring you can see",
  },
  {
    name: "a ring that follows the mouse around",
    file: src("utils/focusModality.ts"),
    from: "  const onPointer = (): void => set(true);",
    to: "  const onPointer = (): void => set(false);",
    spec: "accessibility",
    expect: "mouse click leaves no ring",
  },
  // REMOVED. The sabotage flipped the STARTING value of the pointer flag,
  // and nothing went red — correctly. Every path into the ring checks
  // presses a real key first, and any key that moves focus resets the flag,
  // so the initial value only governs focus that arrives with no input at
  // all. It is a sensible default, not a guarantee, and the comment in
  // focusModality.ts was reworded to stop claiming otherwise.
  {
    name: "a dialog that does not say it is one",
    file: src("components/common/Modal.tsx"),
    from: '        role="dialog"\n        aria-modal="true"',
    to: "",
    spec: "accessibility",
    expect: "announces itself as a dialog",
  },
  {
    name: "a dialog that leaves focus outside itself",
    file: src("components/common/Modal.tsx"),
    from: "    (first ?? cardRef.current)?.focus();",
    to: "    void first;",
    spec: "accessibility",
    expect: "moves focus into it",
  },
  {
    name: "a dialog that never gives focus back",
    file: src("components/common/Modal.tsx"),
    from: "      if (ourFocus && returnTo?.isConnected) returnTo.focus();",
    to: "      void ourFocus;",
    spec: "accessibility",
    expect: "returns focus to whatever opened it",
  },
  {
    name: "Tab walking out of an open dialog",
    file: src("components/common/Modal.tsx"),
    from: "      if (e.key !== \"Tab\") return;",
    to: "      return;",
    spec: "accessibility",
    expect: "stays inside the dialog",
  },
  {
    name: "the Inspector reading a mention's stored label again",
    file: src("components/layout/InspectorPanel.tsx"),
    from: "    ? findChoiceBlockOptions(scene.content, target.blockId, mentionResolver(project?.entities ?? []))",
    to: "    ? findChoiceBlockOptions(scene.content, target.blockId)",
    spec: "accessibility",
    expect: "and so does Choice Properties",
  },
  {
    name: "the scene summary reading it too",
    file: src("components/layout/InspectorPanel.tsx"),
    from: "    ? extractChoices(scene.content, mentionResolver(project?.entities ?? []))",
    to: "    ? extractChoices(scene.content)",
    spec: "accessibility",
    expect: "scene summary shows a renamed character's current name",
  },
  {
    name: "one section label drifting off the ramp",
    file: src("components/layout/InspectorPanel.tsx"),
    from: 'className="scriare-section-label',
    to: 'className="text-xs font-medium uppercase tracking-wide',
    spec: "accessibility",
    expect: "same size, weight and tracking",
  },
  {
    name: "the section label ramp set to the old size",
    file: src("styles/index.css"),
    from: "  font-size: 10px;\n  line-height: 1.25;\n  font-weight: 600;",
    to: "  font-size: 12px;\n  line-height: 1.25;\n  font-weight: 600;",
    spec: "accessibility",
    expect: "steps down from the values below it",
  },
  {
    // Points at a surface the walk could not see before v0.50.0. If the
    // extended surface list were cosmetic, an off-palette colour on the
    // toast would go on passing exactly as the Choice Block's --overlay did
    // for four versions.
    name: "an off-palette colour on a newly walked surface",
    file: src("components/common/ToastHost.tsx"),
    from: 'className="pointer-events-none fixed',
    to: 'style={{ backgroundColor: "#c2410c" }} className="pointer-events-none fixed',
    spec: "themes",
    expect: "outside the palette",
  },
  /* ── v0.51.0, what a keystroke costs ──────────────────────────── */
  // REMOVED, with the change it guarded. The sabotage put the old
  // filter-and-sort back and the Content panel's cost did not move:
  // 16.5 ms with the index, 16.7 ms without. The panel really does cost
  // ~16 ms of a keystroke, but the filter was never where it went — 300
  // rows re-rendering is — so the index was a fix aimed at the wrong half
  // and it was reverted rather than shipped as one.
  {
    // Controls the MECHANISM, not the clock. The timing checks in the same
    // spec cannot guard these fixes — the graph resolves to about ±10 ms
    // over three paired runs and the fixes are worth 24 and 11 — so a
    // threshold either misses the regression or fires on a busy machine.
    // Identity reuse has the same answer everywhere.
    name: "a graph that rebuilds every node and edge on every edit",
    file: src("utils/reuseBySignature.ts"),
    from: "  const hit = cache.get(key);\n  if (hit && hit.sig === sig) return hit.value;",
    to: "  const hit = cache.get(key);\n  void hit;",
    spec: "perf",
    expect: "keeps its identity",
  },
  {
    name: "a signature cache that grows for the life of the project",
    file: src("utils/reuseBySignature.ts"),
    from: "  for (const key of cache.keys()) if (!live.has(key)) cache.delete(key);",
    to: "  void live;",
    spec: "perf",
    expect: "drops what the story no longer contains",
  },
  // ── v0.53.0 · the Welcome screen ──────────────────────────────────────
  {
    // The map is only worth drawing if it is a picture of the STORY. A
    // slice of the scene array is a picture of the order they were made in.
    name: "a story map sampled in creation order instead of story order",
    file: src("utils/recentShape.ts"),
    from: "  if (all.length <= MAX_SHAPE_NODES) return all;",
    to: "  if (all.length <= MAX_SHAPE_NODES) return all;\n  return all.slice(0, MAX_SHAPE_NODES);",
    spec: "welcome",
    expect: "the sample follows the STORY",
  },
  // Two controls lived here until v0.53.2 and are deliberately gone.
  // They sabotaged an independent per-axis normalisation and its
  // divide-by-zero guard; neither exists any more. Both axes now share one
  // scale — "each axis stretched to fill the card", below, is the control
  // for that — and the bounding box includes the scene cards themselves,
  // so a span can no longer be zero and there is nothing left to guard.
  // A control whose `from` is gone is reported stale by the pre-flight;
  // rewriting one to aim at whatever line looks similar is how a control
  // ends up testing nothing.
  {
    // The derived flag written back as though it were a fact — which is
    // how a story on a USB stick gets marked missing once and stays marked.
    name: "'missing' persisted into recent-projects.json",
    file: shared("recentEntries.ts"),
    from: 'const STORED_KEYS = ["name", "filePath", "lastOpened", "shape", "resume"] as const;',
    to: 'const STORED_KEYS = ["name", "filePath", "lastOpened", "shape", "resume", "missing"] as const;',
    spec: "welcome",
    expect: "never written to disk",
  },
  {
    name: "opening a story erasing the map it had cached",
    file: shared("recentEntries.ts"),
    from: "    shape: incoming.shape !== undefined ? incoming.shape : previous?.shape,",
    to: "    shape: incoming.shape,",
    spec: "welcome",
    expect: "keeps its cached map",
  },
  {
    // Everything else in the spec reasons about the builder or about a
    // store the test filled in itself; only the end-to-end case notices
    // that saving never calls it.
    name: "a save that never refreshes what Recent Projects knows",
    file: src("state/projectStore.ts"),
    from: "      const touched = await refreshRecentEntry(\n        project,\n        filePath,\n        get().selectedSceneId,\n        get().selectedEntityId,\n        false,\n      );",
    to: "      const touched = null;",
    spec: "welcome",
    expect: "caches its shape on the recent entry",
  },
  {
    name: "the non-matching stories faded out again",
    file: src("components/welcome/WelcomeScreen.tsx"),
    from: '          <ul className="grid gap-x-10 [grid-template-columns:repeat(auto-fill,minmax(272px,1fr))]">',
    to: '          <ul className="grid gap-x-10 opacity-50 [grid-template-columns:repeat(auto-fill,minmax(272px,1fr))]">',
    spec: "welcome",
    expect: "NOTHING IS DIMMED",
  },
  {
    // The shelf used to cut the hero's story out of itself, so the story
    // you were last in was the one story missing from "your stories".
    name: "the story in the hero missing from the shelf",
    file: src("components/welcome/WelcomeScreen.tsx"),
    from: "  const grid = recentProjects;",
    to: "  const grid = hero ? recentProjects.slice(1) : recentProjects;",
    spec: "welcome",
    expect: "EVERY story is on the shelf",
  },
  {
    name: "a story with no cached shape showing nothing at all",
    file: src("components/welcome/StoryMap.tsx"),
    from: "          <DotField width={width} height={height} />",
    to: "          {null}",
    spec: "welcome",
    expect: "an empty canvas, not a grey box",
  },
  {
    name: "a card that draws the dot field over a story that has a shape",
    file: src("components/welcome/WelcomeScreen.tsx"),
    from: "              <StoryMap shape={entry.shape} height={100} />",
    to: "              <StoryMap shape={null} height={100} />",
    spec: "welcome",
    expect: "draws its map",
  },
  {
    name: "a moved file told apart by colour alone",
    file: src("components/welcome/WelcomeScreen.tsx"),
    from: '  if (entry.missing) return "Can\u2019t find this file";',
    to: "  if (entry.missing) return sinceLabel(entry.lastOpened);",
    spec: "welcome",
    expect: "says so in words",
  },
  {
    name: "a filtered list that changes silently",
    file: src("components/welcome/WelcomeScreen.tsx"),
    from: '        <span aria-live="polite" className="text-xs text-[var(--text-3)]">',
    to: '        <span className="text-xs text-[var(--text-3)]">',
    spec: "welcome",
    expect: "announced, not merely drawn",
  },
  {
    // The claim the whole design rests on: this is ONE screen in three
    // states. A frame that is a different height on an empty shelf is
    // three screens wearing the same paint.
    name: "a header that is a different size when the shelf is empty",
    file: src("components/welcome/WelcomeScreen.tsx"),
    from: '      <header className="flex-shrink-0 border-b border-[var(--border-soft)] px-8 py-4">',
    to: '      <header className={`flex-shrink-0 border-b border-[var(--border-soft)] px-8 ${recentProjects.length ? "py-4" : "py-7"}`}>',
    spec: "welcome",
    expect: "THE FRAME DOES NOT MOVE",
  },
  {
    name: "launching and landing on nothing instead of in the scene",
    file: src("components/welcome/WelcomeScreen.tsx"),
    from: "      type=\"button\"\n      autoFocus\n",
    to: "      type=\"button\"\n",
    spec: "welcome",
    expect: "where the keyboard lands",
  },
  {
    // v0.80.0 — REPOINTED. The mark stopped being two image files picked
    // by the theme and became one inline SVG painted in `currentColor`,
    // so the old sabotage named a line that no longer exists. The claim
    // the check makes is unchanged — the mark follows the theme rather
    // than being swapped between two fixed things — so the sabotage is
    // now the modern way to get that wrong: pin the fill.
    name: "the wordmark painted in a fixed colour rather than the theme's",
    file: src("components/common/BrandMark.tsx"),
    from: '        fill="currentColor"',
    to: '        fill="#c8a96a"',
    spec: "welcome",
    // A straight apostrophe, because that is what the check's name has.
    // The first version of this line wrote a curly one and the control
    // came back NOT CAUGHT while the assertion was failing correctly
    // three lines above it — the same stale-`expect` mistake v0.49.0 made.
    // v0.80.0 — the check was reworded when the mark became one inline
    // SVG, and this string was left pointing at the old sentence. Exactly
    // the mistake the comment three lines up warns about, made in the
    // same file by the person writing that warning down.
    expect: "repainted by the theme rather than swapped",
  },
  // ── v0.53.1 · the resize and polish pass ──────────────────────────────
  {
    // A <button> carries `align-items: center` from the UA stylesheet, so
    // a block child is sized to its content, not stretched. That one line
    // is why every map was drawn at its own size inside a card of a
    // different size.
    name: "a card whose map is sized to its content instead of the card",
    file: src("components/welcome/WelcomeScreen.tsx"),
    from: '            className="scriare-story-card flex w-full flex-col items-stretch overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] text-left"',
    to: '            className="scriare-story-card flex w-full flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] text-left"',
    spec: "welcome",
    expect: "fills the card it is drawn in",
  },
  {
    name: "a map that does not follow the window",
    file: src("components/welcome/StoryMap.tsx"),
    from: "    observer.observe(node);",
    to: "    void observer;",
    spec: "welcome",
    expect: "follows the card when the window is resized",
  },
  {
    name: "a shelf that runs to the edges of a wide monitor",
    file: src("styles/index.css"),
    from: "  --welcome-column: 1240px;",
    to: "  --welcome-column: 4000px;",
    spec: "welcome",
    expect: "stops growing at the content column",
  },
  {
    name: "an accent rail with no height, which is no accent rail",
    file: src("components/welcome/WelcomeScreen.tsx"),
    from: '      className="scriare-resume-hero flex w-full flex-shrink-0 items-stretch overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-left"',
    to: '      className="scriare-resume-hero flex w-full flex-shrink-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-left"',
    spec: "welcome",
    expect: "accent rail full height",
  },
  {
    name: "two paragraphs welded into one word",
    file: src("utils/recentShape.ts"),
    from: '      if (i > 0 && !childrenAreInline) parts.push(" ");',
    to: "      void i;",
    spec: "welcome",
    expect: "not welded into one word",
  },
  {
    name: "a story map that only ever arrives after you open the story",
    file: src("components/welcome/WelcomeScreen.tsx"),
    from: "  useShapeBackfill(recentProjects, (list) =>",
    to: "  if (false) useShapeBackfill(recentProjects, (list) =>",
    spec: "welcome",
    expect: "gets one drawn, without being opened",
  },
  // ── v0.53.2 · is it the same graph ───────────────────────────────────
  {
    // The bug that shipped twice: each axis stretched to fill the panel,
    // which multiplies every vertical distance by panelAspect/graphAspect
    // — 3.2× for a real story — and draws a graph nobody laid out.
    // v0.74.0 — same sabotage, new line. The normalisation moved when the
    // shape started carrying routes: it is now against the DRAWING's box
    // rather than the cards', so both the variable names and the origin
    // changed. Re-aimed rather than retired, because the property it
    // defends — one scale for both axes — did not change at all.
    name: "each axis stretched to fill the card",
    file: src("utils/recentShape.ts"),
    from: "      x: round3((p.x - minX - drawMinX) * s2),\n      y: round3((p.y - minY - drawMinY) * s2),",
    to: "      x: round3(drawW === 0 ? 0 : (p.x - minX - drawMinX) / drawW),\n      y: round3(drawH === 0 ? 0 : (p.y - minY - drawMinY) / drawH),",
    spec: "welcome",
    expect: "SCALE MODEL",
  },
  {
    name: "scene cards drawn at a fixed size instead of to scale",
    file: src("components/welcome/StoryMap.tsx"),
    from: "  const nodeW = Math.max(3, shape.node.w * scale);\n  const nodeH = Math.max(2, shape.node.h * scale);",
    to: "  const nodeW = 38;\n  const nodeH = 15;",
    spec: "welcome",
    expect: "proportions of a real one",
  },
  {
    // A shape from v0.53.0 has these field names and different meanings,
    // so drawing it is not a crash — it is a confidently wrong picture.
    name: "an older shape drawn as though it were this format",
    file: src("utils/recentShape.ts"),
    from: "      s.v === SHAPE_FORMAT &&",
    to: "      true &&",
    spec: "welcome",
    expect: "not drawn as if it were this one",
  },
  {
    name: "a backfill that asks whether a shape is THERE rather than usable",
    file: src("components/welcome/useShapeBackfill.ts"),
    from: "              !e.missing && !isDrawableShape(e.shape) && !tried.current.has(e.filePath),",
    to: "              !e.missing && !e.shape && !tried.current.has(e.filePath),",
    spec: "welcome",
    expect: "gets one drawn, without being opened",
  },
  // ── v0.54.0 · the hero names any page ────────────────────────────────
  {
    // What it did before: read the selected SCENE and nothing else, so an
    // afternoon on a character ended with no "where you left off" at all.
    name: "a hero that only ever looks at the selected scene",
    file: src("utils/recentShape.ts"),
    from: "  const entity = selectedEntityId\n    ? project.entities.find((e) => e.id === selectedEntityId)\n    : undefined;",
    to: "  const entity = undefined;",
    spec: "welcome",
    expect: "ended on a character is remembered as one",
  },
  {
    name: "a hero that names a page without saying what kind it is",
    file: src("components/welcome/WelcomeScreen.tsx"),
    from: "            <KindIcon kind={resume.kind} />\n            {kind}",
    to: "            {null}",
    spec: "welcome",
    expect: "the hero names",
  },
  {
    name: "the kinds told apart by a word and nothing else",
    file: src("components/welcome/WelcomeScreen.tsx"),
    from: "function KindIcon({ kind }: { kind: ResumeKind }) {",
    to: "function KindIcon({ kind }: { kind: ResumeKind }) {\n  if (kind) return null;",
    spec: "welcome",
    expect: "told apart by a drawing",
  },
  {
    // Every resume already on a writer's disk is in the older shape. It
    // described a scene, which is still true — discarding it would empty
    // the hero for everyone on the day they update.
    name: "a resume written by the previous version thrown away",
    file: src("utils/recentShape.ts"),
    from: "  const title = typeof r.title === \"string\" ? r.title : r.sceneTitle;",
    to: "  const title = r.title;",
    spec: "welcome",
    expect: "old format still shows its scene",
  },
  // ── v0.55.0 · the three defects a stranger can walk into ─────────────
  {
    // The dead end: Settings hands off to Choice Styles by closing itself,
    // and for five versions there was no way back to it.
    name: "a child dialog with no way back to the one that opened it",
    file: src("components/layout/ProjectSettingsDialog.tsx"),
    from: '          useUIStore.getState().openChoiceStyles("settings");',
    to: "          useUIStore.getState().openChoiceStyles();",
    spec: "settings-navigation",
    expect: "THE WAY BACK IS ON SCREEN",
  },
  {
    // ...and the opposite mistake: offering a way "back" to a dialog the
    // writer reached this one from somewhere else entirely.
    name: "a way back offered to someone who came in another door",
    file: src("state/uiStore.ts"),
    from: "  openChoiceStyles: (from = null) => set({ choiceStylesOpen: true, choiceStylesFrom: from }),",
    to: '  openChoiceStyles: () => set({ choiceStylesOpen: true, choiceStylesFrom: "settings" }),',
    spec: "settings-navigation",
    expect: "no way back to a dialog you were never in",
  },
  {
    name: "a colour pinned to a hex without a word about it",
    file: src("components/choices/ChoiceStylesDialog.tsx"),
    from: "              onPin(e.target.value);",
    to: "              onChange(e.target.value);",
    spec: "settings-navigation",
    expect: "it offers the way back",
  },
  {
    // The notice must survive a colour input firing sixty times a second.
    name: "one notice per pointer event instead of one per pinning",
    file: src("components/choices/ChoiceStylesDialog.tsx"),
    from: "            if (!announced.current) {",
    to: "            if (true) {",
    spec: "settings-navigation",
    expect: "once, not once a frame",
  },
  {
    // The broken promise: "where you left off", then somewhere else.
    name: "Continue opening the story's first scene instead of the page it named",
    file: src("state/projectStore.ts"),
    from: "        ...landingFor(project, target),",
    to: "        selectedSceneId: project.startSceneId ?? project.scenes[0]?.id ?? null,\n        selectedEntityId: null,",
    spec: "welcome",
    expect: "CONTINUE LANDS ON THE PAGE",
  },
  {
    // ...and the other half: an id from a record written days ago, trusted
    // against a story that has changed since.
    name: "a remembered page trusted without checking it still exists",
    file: src("utils/recentShape.ts"),
    from: "    return project.scenes.some((s) => s.id === target.id)\n      ? { selectedSceneId: target.id, selectedEntityId: null }\n      : fallback;",
    to: "    return { selectedSceneId: target.id, selectedEntityId: null };",
    spec: "welcome",
    expect: "falls back to the start scene when that page is gone",
  },
  // ── v0.56.0 · one button, one title, one manager ─────────────────────
  {
    // The whole version in one sabotage: a dialog that goes back to
    // typing its own primary button instead of importing one.
    name: "a dialog that spells its own primary button again",
    file: src("components/layout/ProjectSettingsDialog.tsx"),
    from: '        <Button intent="primary" onClick={handleSave}>\n          Save\n        </Button>',
    to: '        <button type="button" onClick={handleSave} className="rounded-md bg-[var(--accent)] px-3.5 py-2 text-sm font-medium text-[var(--accent-text-on)]">Save</button>',
    spec: "kit",
    expect: "EVERY PRIMARY BUTTON IS THE SAME SIZE",
  },
  {
    // ...and the same for the type. This is the exact state New Project
    // shipped in for thirty-odd versions.
    name: "a dialog title back in a semibold sans",
    file: src("components/common/DialogHeader.tsx"),
    from: '      <h2 className="font-serif-narrative text-base italic text-[var(--text)]">{title}</h2>',
    to: '      <h2 className="text-base font-semibold text-[var(--text)]">{title}</h2>',
    spec: "kit",
    expect: "the app's own serif italic",
  },
  {
    name: "the kit's default size quietly changed under everything",
    file: src("components/common/Button.tsx"),
    from: '  md: "rounded-md px-3 py-1.5 text-sm",',
    to: '  md: "rounded-md px-3.5 py-2 text-sm",',
    spec: "kit",
    expect: "the kit's md: px-3 py-1.5",
  },
  {
    name: "Cancel drawn as a second action beside the one that acts",
    file: src("components/layout/ProjectSettingsDialog.tsx"),
    from: '        <Button intent="ghost" onClick={onClose}>',
    to: '        <Button intent="secondary" onClick={onClose}>',
    spec: "kit",
    expect: "Cancel is a ghost",
  },
  {
    // The Variable Manager's whole argument: the row answers the question
    // without being opened.
    name: "a variable's type back behind a dropdown",
    file: src("components/variables/VariableManagerDialog.tsx"),
    from: "          {VARIABLE_TYPE_LABELS[variable.type]}\n        </span>",
    to: "          {\"\"}\n        </span>",
    spec: "variables-manager",
    expect: "THE TYPE IS A WORD",
  },
  {
    name: "a row that no longer says what the variable starts as",
    file: src("components/variables/VariableManagerDialog.tsx"),
    from: '          starts <span className="text-[var(--text-2)]">{startsAs(variable)}</span>',
    to: '          {null}',
    spec: "variables-manager",
    expect: "says what it starts as",
  },
  {
    name: "an empty string drawn as nothing at all",
    file: src("components/variables/VariableManagerDialog.tsx"),
    from: '    return text.length > 0 ? `\u201c${text}\u201d` : "\u201c\u201d";',
    to: "    return text;",
    spec: "variables-manager",
    expect: "visible pair of quotes",
  },
  {
    name: "a new variable that arrives collapsed and blank",
    file: src("components/variables/VariableManagerDialog.tsx"),
    from: "    const id = addVariable();\n    if (id) setOpenId(id);",
    to: "    addVariable();",
    spec: "variables-manager",
    expect: "arrives open, ready to be named",
  },

  // ── v0.57.0 · Play Mode reads on a reading ground ────────────────────
  {
    // The whole version in one sabotage: if the ground block stops
    // matching the Play surface, the writer's theme floods back in and
    // Play is a preview of the draft again.
    name: "a ground block that no longer reaches the Play surface",
    file: src("runtime/playGroundStyles.ts"),
    from: '[data-play-root][data-ground="night"] {',
    to: '[data-play-root][data-ground="nightfall"] {',
    spec: "play-ground",
    expect: "no longer reaches the page they are rehearsing",
  },
  {
    name: "a Night that has drifted away from the export's Night",
    file: src("runtime/playGroundStyles.ts"),
    from: "${GROUND_TOKENS.night}",
    to: "  --page: oklch(19% 0.009 75);\n  --bg: oklch(15% 0.008 75);",
    spec: "play-ground",
    expect: "the export's Night, token for token",
  },
  {
    name: "a switch that offers the ground you are already on",
    file: src("runtime/PlayRuntime.tsx"),
    from: "READING_GROUNDS.find((g) => g.id !== ground) ?? READING_GROUNDS[0]",
    to: "READING_GROUNDS[0]",
    spec: "play-ground",
    expect: "offers the other ground by name",
  },
  {
    name: "a light ground that never says it is light",
    file: src("runtime/playGroundStyles.ts"),
    from: '[data-play-root][data-ground="paper"] {\n  color-scheme: light;',
    to: '[data-play-root][data-ground="paper"] {',
    spec: "play-ground",
    expect: "form controls and scrollbars follow it",
  },
  {
    // The five tokens a reading ground has no opinion about. Left to fall
    // through, they are the writer's theme leaking into the reader's page
    // through the back door — the Restart button's label, on Paper, in a
    // dark theme's --accent-text-on.
    name: "a derived token that falls through to the theme instead",
    file: src("runtime/playGroundStyles.ts"),
    from: "    --accent-text-on:        var(--page);",
    to: "",
    spec: "play-ground",
    expect: "derived from the ground, not the theme",
  },
  {
    name: "a highlight left to the browser's own yellow",
    file: src("runtime/playGroundStyles.ts"),
    from: "[data-play-root] mark {\n  background: var(--highlight);",
    to: "[data-play-root] mark.never {\n  background: var(--highlight);",
    spec: "play-ground",
    expect: "not the browser's yellow",
  },
  {
    name: "a ground the machine forgets the moment you leave Play",
    file: src("state/playGroundStore.ts"),
    from: "      window.localStorage.setItem(STORAGE_KEY, ground);",
    to: "",
    spec: "play-ground",
    expect: "remembered on this machine",
  },
  {
    // The one the widened themes walk found on its first run: every
    // container inside Play was still inheriting the writer's ink,
    // because body resolved `color` from --text before the ground
    // redefined it.
    name: "the writer's ink still inherited by everything inside Play",
    file: src("runtime/playGroundStyles.ts"),
    from: "     line. */\n  color: var(--text);",
    to: "     line. */",
    spec: "themes",
    expect: "outside the palette",
  },
  {
    // Scoped too widely is the other half of scoped too narrowly: a
    // reading ground that reaches :root repaints the editor the writer
    // came from, which is the promise this version does NOT break.
    name: "a reading ground that escapes into the writer's editor",
    file: src("runtime/playGroundStyles.ts"),
    from: '[data-play-root][data-ground="paper"] {\n  color-scheme: light;',
    to: ':root[data-theme], [data-play-root][data-ground="paper"] {\n  color-scheme: light;',
    spec: "play-ground",
    expect: "the room behind it keeps the writer's theme",
  },

  // ── v0.58.0 · how a colour reads on the two grounds ──────────────────
  {
    // The panel's whole claim: it measures against the READER's page, not
    // against whichever of the eight themes the writer is sitting in.
    name: "a reading taken against the writer's theme instead of the ground",
    file: src("components/common/ColorOnGrounds.tsx"),
    from: "  const page = GROUND_PAGE_HEX[reading.ground as ReadingGround];",
    to: "  const page = getComputedStyle(document.documentElement).getPropertyValue(\"--page\").trim();",
    spec: "color-grounds",
    expect: "painted in the grounds themselves",
  },
  {
    name: "a highlight measured as ink on the page rather than as what sits behind the words",
    file: src("export/contrastCheck.ts"),
    from: '      const backdrop = subject.kind === "ink" ? page : over(picked, page);\n      const foreground = subject.kind === "ink" ? picked : ink;',
    to: "      const backdrop = page;\n      const foreground = picked;",
    spec: "color-grounds",
    expect: "what sits BEHIND the words",
  },
  {
    // A number is a fact; the sentence is what it means. A narrative
    // designer reads "1.8:1" as nothing at all.
    name: "a panel that reports the ratio and not what it means",
    file: src("components/common/ColorOnGrounds.tsx"),
    from: '  if (ratio < 3) return "Nearly invisible";',
    to: '  if (ratio < 3) return "Low";',
    spec: "color-grounds",
    expect: "says what that MEANS",
  },
  {
    name: "previews the palette audit would report as strays",
    file: src("components/common/ColorOnGrounds.tsx"),
    from: "        data-content-colour\n        data-ground-preview={reading.ground}",
    to: "        data-ground-preview={reading.ground}",
    spec: "color-grounds",
    expect: "marked as content",
  },
  {
    // RE-AIMED in v0.63.0. The behaviour is unchanged — the caret moving
    // on still puts the panel away — but v0.58.1 moved the panel out of
    // the toolbar's own state and into uiStore, so the single line this
    // control used to break no longer exists. A control that cannot find
    // its target reports COULD NOT APPLY, which reads like a retired test
    // rather than an untested behaviour.
    name: "a reading that outstays the sentence it was about",
    file: src("components/editor/EditorToolbar.tsx"),
    from: "    setPicking(null);\n    clearColorReading();",
    to: "    setPicking(null);",
    spec: "color-grounds",
    expect: "moving the caret on puts it away",
  },
  {
    name: "a panel Escape cannot close",
    file: src("components/common/ColorOnGrounds.tsx"),
    from: '      if (event.key === "Escape") onDismiss?.();',
    to: "      return;",
    spec: "color-grounds",
    expect: "Escape puts it away",
  },
  {
    // The choice side of it, through the control the Inspector shares.
    name: "a choice fill picked with nothing said about either ground",
    file: src("components/choices/ChoiceStylesDialog.tsx"),
    from: "          onPick={() => setReadingFill(true)}",
    to: "",
    spec: "color-grounds",
    expect: "a choice fill gets the same reading",
  },
  {
    // The panel must not quietly become the pin notice's replacement:
    // they answer different questions and v0.55.0's one can be undone.
    name: "the pin notice dropped now that the panel says something",
    file: src("components/choices/ChoiceStylesDialog.tsx"),
    from: "              useToastStore\n                .getState()\n                .showUndo(",
    to: "              (() => {}) || useToastStore\n                .getState()\n                .showUndo(",
    spec: "color-grounds",
    expect: "the v0.55.0 notice still fires",
  },

  // ── v0.58.1 · where the reading is drawn ─────────────────────────────
  {
    // The whole of v0.58.1: drawn anywhere near the control, the reading
    // spends the pick behind the picker the control opens.
    name: "a reading drawn back up beside the control that opens the picker",
    file: src("components/editor/ColorReadingCorner.tsx"),
    from: 'className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-end px-4 pb-3"',
    to: 'className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-end px-4 pt-3"',
    spec: "color-grounds",
    expect: "out of the picker's way",
  },
  {
    // The stale-subject bug the move exposed: a subject captured in the
    // input's own event handler is always one frame behind, and on the
    // FIRST event it is the colour the writer had before they started.
    name: "a reading that reports the colour from before the pick began",
    file: src("components/editor/EditorToolbar.tsx"),
    from: '    if (picking === "text") showColorReading({ kind: "ink", color: currentColor });',
    to: '    if (picking === "text") showColorReading({ kind: "ink", color: "" });',
    spec: "color-grounds",
    expect: "the numbers are the real ones",
  },

  // ── v0.59.0 · the scene panel, and one place to make a new thing ─────
  {
    name: "a word count the panel does not actually take from the story",
    file: src("components/layout/InspectorPanel.tsx"),
    from: "  const words = countWords(scene.content);",
    to: "  const words = 0;",
    spec: "scene-panel",
    expect: "counts the words the way the rest of the app counts them",
  },
  {
    name: "a panel that still does not say which scene it is showing",
    file: src("components/layout/InspectorPanel.tsx"),
    from: '          {scene.title || "Untitled scene"}',
    to: '          {""}',
    spec: "scene-panel",
    expect: "names the scene it is showing",
  },
  {
    // The number that earns the panel its place: Check Story would tell
    // you, but only if you thought to run it.
    name: "unfinished choices no longer counted",
    file: src("components/layout/InspectorPanel.tsx"),
    from: "  const goingNowhere = choices.filter((choice) => destination(choice.targetSceneId).wrong).length;",
    to: "  const goingNowhere = 0;",
    spec: "scene-panel",
    expect: "how many of them go nowhere",
  },
  {
    name: "a deleted destination reported as one nobody linked",
    file: src("components/layout/InspectorPanel.tsx"),
    from: '    if (!target) return { label: "target missing", wrong: true };',
    to: '    if (!target) return { label: "not linked yet", wrong: true };',
    spec: "scene-panel",
    expect: "two ways of going nowhere are told apart",
  },
  {
    // v0.50.0's rule, in a new place: a state told by wording alone is a
    // state half the readers miss.
    name: "a broken destination told by words alone",
    file: src("components/layout/InspectorPanel.tsx"),
    from: '                        to.wrong ? "text-[var(--warning)]" : "text-[var(--text-3)]"',
    to: '                        "text-[var(--text-3)]"',
    spec: "scene-panel",
    expect: "painted in the warning colour",
  },
  {
    // The sabotage always worked and the check always caught it — what
    // drifted was this `expect` string (fixed v0.78.2). The check was
    // written as "all four things the tree holds" and rewritten in
    // v0.60.0, when Notes made it five, to say "everything"; nobody
    // updated the control, so the runner went looking for a failing line
    // that no longer existed and reported NOT CAUGHT for eighteen
    // versions. A fourth way for a control to be wrong, and the one the
    // runner could not tell apart from a real miss — see `verdictFor`.
    name: "a + New that cannot make everything the tree holds",
    file: src("components/layout/ContentBrowser.tsx"),
    from: '      {\n        label: "New Character",',
    to: '      {\n        label: "New Charactor",',
    spec: "scene-panel",
    expect: "everything the tree holds",
  },
  {
    // The old per-category "+" opened its section on the way; the menu
    // has to do the same or the writer's new character lands out of sight.
    name: "a new character that lands in a closed section",
    file: src("components/layout/ContentBrowser.tsx"),
    from: '          if (!expanded.has("root:characters")) toggleExpand("root:characters");',
    to: "",
    spec: "scene-panel",
    expect: "opens the section it lands in",
  },
  {
    // Re-aimed in v0.60.0: the placeholder table it used to sabotage no
    // longer exists, because Notes became real and it was the last one in
    // it. The claim it protects — an empty section says what it is FOR —
    // moved to the category's own empty state, so the control moved too.
    name: "a section that says when rather than what",
    file: src("components/layout/ContentBrowser.tsx"),
    from: '            ? "For what the story needs and the reader never sees."',
    to: '            ? "Coming soon."',
    spec: "scene-panel",
    expect: "says what it is for",
  },

  // ── v0.60.0 · Notes ─────────────────────────────────────────────────
  {
    // The one asymmetry that makes a note a note.
    name: "a note the story can point at",
    file: src("types/entities.ts"),
    from: '  return entity.kind !== "note";',
    to: "  return true;",
    spec: "notes",
    expect: "never a note",
  },
  {
    name: "the @ menu handed every entity, filtered nowhere",
    file: src("extensions/Mention.ts"),
    from: "        const entities = (project?.entities ?? []).filter(isMentionable);",
    to: "        const entities = project?.entities ?? [];",
    spec: "notes",
    expect: "never a note",
  },
  {
    // A permanently empty section is worse than no section.
    name: "a note asking where it is mentioned, which is nowhere, forever",
    file: src("components/editor/EntityEditor.tsx"),
    from: '              {isNote ? "Points at" : "Appears in"}',
    to: '              {"Appears in"}',
    spec: "notes",
    expect: "says Points at",
  },
  {
    name: "one row per mention rather than one per thing named",
    file: src("utils/mentions.ts"),
    from: "    counts.set(id, (counts.get(id) ?? 0) + 1);",
    to: "    counts.set(id, 1);",
    spec: "notes",
    expect: "counted once per thing",
  },
  {
    name: "aliases on a note — a control for a thing that cannot happen",
    file: src("components/editor/EntityEditor.tsx"),
    from: "          {!isNote && (\n          <div className=\"mb-6 flex flex-wrap items-center gap-1.5\">",
    to: "          {true && (\n          <div className=\"mb-6 flex flex-wrap items-center gap-1.5\">",
    spec: "notes",
    expect: "no aliases",
  },
  {
    name: "a note counted as part of the story",
    file: src("components/layout/StatusBar.tsx"),
    from: "      {notes > 0 && (",
    to: "      {notes >= 0 && (",
    spec: "notes",
    expect: "says nothing at all about notes when there are none",
  },
  {
    name: "a tree that cannot make a note",
    file: src("components/layout/ContentBrowser.tsx"),
    from: '        label: "New Note",',
    to: '        label: "New Notes",',
    spec: "notes",
    expect: "+ New can make a note",
  },

  // ── v0.61.0 · opening a story from the desktop ──────────────────────
  {
    name: "a command line read from the front, where the executable is",
    file: shared("fileArgs.ts"),
    from: "  for (let i = argv.length - 1; i >= 1; i -= 1) {",
    to: "  for (let i = 1; i < argv.length; i += 1) {",
    spec: "open-from-disk",
    expect: "the last one wins",
  },
  {
    name: "a Chromium switch mistaken for a story",
    file: shared("fileArgs.ts"),
    from: '    if (!arg || arg.startsWith("-")) continue;',
    to: "    if (!arg) continue;",
    spec: "open-from-disk",
    expect: "not a story",
  },
  {
    name: "the executable itself offered as the story to open",
    file: shared("fileArgs.ts"),
    from: "  for (let i = argv.length - 1; i >= 1; i -= 1) {",
    to: "  for (let i = argv.length - 1; i >= 0; i -= 1) {",
    spec: "open-from-disk",
    expect: "argv[0] is never it",
  },
  {
    // Two windows over one recent-projects file, each with its own
    // autosave timer, is what save-safety exists to prevent.
    name: "a second launch that opens a second window",
    file: main("index.ts"),
    from: "const gotTheLock = app.requestSingleInstanceLock();",
    to: "const gotTheLock = true;",
    spec: "open-from-disk",
    expect: "single-instance lock",
  },
  {
    // The bug the full suite caught: getAllWindows()[0] is whichever
    // window exists first, and a spec that opens one to read an exported
    // story makes that the export's. Same class as the v0.53.1 resize
    // probe, which measured the wrong window and passed.
    name: "a double-click sent to whichever window happens to be first",
    file: main("index.ts"),
    from: "    const window = mainWindow;",
    to: "    const [window] = BrowserWindow.getAllWindows();",
    spec: "open-from-disk",
    expect: "double-clicking a story while the app is running opens it",
  },
  {
    name: "a double-click the running app ignores",
    file: main("index.ts"),
    from: '    if (file) window.webContents.send("project:open-from-disk", file);',
    to: "",
    spec: "open-from-disk",
    expect: "double-clicking a story while the app is running opens it",
  },
  {
    // The whole reason this goes through closeProject rather than opening
    // over the top: a second way to put a project down is a second way to
    // lose the last second and a half of it.
    name: "a story opened over an unanswered conflict",
    file: src("hooks/useOpenFromDisk.ts"),
    from: "        if (store.saveConflict) {",
    to: "        if (false) {",
    spec: "open-from-disk",
    expect: "NOT opened over an unanswered conflict",
  },
  {
    name: "the story you already have open, reloaded under you",
    file: src("hooks/useOpenFromDisk.ts"),
    from: "        if (store.filePath === filePath) return;",
    to: "",
    spec: "open-from-disk",
    expect: "already open does nothing",
  },

  // ── v0.62.0 · what the app shows first ──────────────────────────────
  {
    // The bug itself: paint the default state while the answers are still
    // in flight and a writer with nine stories is told they have none.
    name: "the Welcome screen painted before the recent list has arrived",
    file: src("App.tsx"),
    from: '  if (boot === "booting") return <Splash />;',
    to: "",
    spec: "boot",
    expect: "THE EMPTY WELCOME IS NEVER PAINTED",
  },
  {
    // Re-aimed once: on this machine the recent list returns in a
    // millisecond, so the missing `await` was invisible and the control
    // came back green. The spec now slows the real handler to 400ms — a
    // large recent file on a synced disk — and the race it exists for
    // happens.
    name: "a boot that does not wait for the recent list",
    file: src("hooks/useBoot.ts"),
    from: "          await useProjectStore.getState().loadRecent();",
    to: "          void useProjectStore.getState().loadRecent();",
    spec: "boot",
    expect: "never paints the empty screen when the list is slow",
  },
  {
    name: "a story waiting at launch that the Welcome gets to answer first",
    file: src("hooks/useBoot.ts"),
    from: "          await useProjectStore.getState().openRecentProject(pending);",
    to: "          void useProjectStore.getState().openRecentProject(pending);",
    spec: "boot",
    expect: "without the Welcome appearing at all",
  },
  {
    name: "a splash that is not the first thing on screen",
    file: src("components/common/Splash.tsx"),
    from: '      data-screen="booting"',
    to: '      data-screen="welcome"',
    spec: "boot",
    expect: "opens on a splash",
  },

  // ── v0.63.0 — which build is this ────────────────────────────────────
  {
    // The whole point of the feature, and the only way it can be wrong
    // while looking right: a number compiled into the renderer is correct
    // until the day somebody bumps one file and not the other.
    name: "a version baked into the bundle instead of asked for",
    file: src("components/common/VersionTag.tsx"),
    from: "        if (!cancelled) setVersion(v);",
    to: '        if (!cancelled) setVersion("0.63.0");',
    spec: "version",
    expect: "comes from the app, not from the bundle",
  },
  {
    name: "a report line that is only the number",
    file: main("index.ts"),
    from: "      `Electron ${process.versions.electron}`,\n      `Chromium ${process.versions.chrome}`,",
    to: "      // the engine versions, removed by a negative control",
    spec: "version",
    expect: "the platform and the engine",
  },
  {
    name: "a copy that composes the line and never copies it",
    file: main("index.ts"),
    from: "    clipboard.writeText(line);",
    to: "    void line;",
    spec: "version",
    expect: "puts the version on the clipboard",
  },
  {
    name: "a click that copies in silence",
    file: src("components/common/VersionTag.tsx"),
    from: '      showNotice("Version details copied — paste them into a bug report.");',
    to: "      void 0;",
    spec: "version",
    expect: "it says so, so the writer knows",
  },
  {
    // Aimed at the HARNESS, which is unusual and deliberate. Launching the
    // app by file rather than by directory leaves it with no package.json
    // to read, so app.getVersion() quietly answers Electron's own "0.0" —
    // and a screen faithfully printing a fallback passes every check that
    // only compares the two against each other. One assertion noticed;
    // this keeps it the one that notices.
    name: "a suite that launches the app where it cannot find its own version",
    file: join(root, "tests/run.mjs"),
    from: "  args: [root],",
    to: '  args: [join(root, "out/main/index.js")],',
    spec: "version",
    expect: "knows its own version at all",
  },
  // ── v0.64.0 — Script Export ──────────────────────────────────────────
  // RETIRED, with the measurement that retired it.
  //
  // The rule is real: printed through this same path, a 17-page document
  // of 40 headings strands one of them without `break-after: avoid` and
  // none of them with it, so Chromium does honour it. But one in
  // seventeen pages is too rare for a suite to see reliably — the
  // 64-page stress script strands none even with the rule removed,
  // because `.speech { break-inside: avoid }` and the paragraph
  // orphan/widow rules already absorb almost every case. A control that
  // comes back green because the event is rare is worse than no control:
  // it reads as proof.
  //
  // What IS controlled is the choice-block rule below, which the same
  // script breaks seventeen times over when it is removed.
  {
    name: "a choice block allowed to split across a page",
    file: shared("script/scriptHtml.ts"),
    from: ".gate, .choices { break-inside: avoid; }",
    to: ".gate, .choices { break-inside: auto; }",
    spec: "script-export",
    // The A/B assertion, not the one about the real story: without the
    // rule the stress script splits seventeen blocks, and that is the
    // check that goes red.
    expect: "not one choice block is split across a page",
  },
  {
    // A hidden choice is one the player never sees. It still has to be
    // translated and still has to be recorded.
    name: "a script that quietly drops the choices a player never sees",
    file: src("export/script/buildScript.ts"),
    from: "          .filter((o) => o.type === CHOICE_OPTION_TYPE)",
    to: '          .filter((o) => o.type === CHOICE_OPTION_TYPE && (o.attrs?.whenUnmet ?? "hide") !== "hide")',
    spec: "script-export",
    expect: "HIDDEN choice is printed anyway",
  },
  {
    name: "a conditions checkbox that does not turn conditions off",
    file: src("export/script/buildScript.ts"),
    from: "              conditions: options.showConditions ? conditionWords(o.attrs?.conditions) : [],",
    to: "              conditions: conditionWords(o.attrs?.conditions),",
    spec: "script-export",
    expect: "with conditions off, none of them print",
  },
  {
    // Word has no break-inside, so every rule the stylesheet states has to
    // be rebuilt out of keepNext. Dropping it leaves a document that opens
    // perfectly and breaks in all the wrong places.
    name: "a Word file that never asks to keep anything together",
    file: mainScript("script/scriptDocx.ts"),
    from: "    keepNext: o.keepNext ?? false,",
    to: "    keepNext: false,",
    spec: "script-export",
    // Counting keepNext across the file is too blunt to fail; the cue
    // check is per paragraph and is the one that bites.
    expect: "every character cue in the Word file holds on to its line",
  },
  {
    name: "chapters that do not start a page in Word",
    file: mainScript("script/scriptDocx.ts"),
    from: "            pageBreakBefore: true,",
    to: "            pageBreakBefore: false,",
    spec: "script-export",
    expect: "start every chapter on a fresh page",
  },
  {
    // The two renderers must not drift over how a condition is worded: a
    // PDF and a Word file of the same script differing by one line is the
    // kind of bug nobody finds until somebody records the wrong take.
    name: "a Word file that words a locked choice differently from the PDF",
    file: mainScript("script/scriptDocx.ts"),
    from: '      `${choice.unmet === "lock" ? "locked unless" : "only if"} ${choice.conditions.join(" and ")}`,',
    to: '      choice.conditions.join(" and "),',
    spec: "script-export",
    expect: "worded the same way",
  },
  // ── v0.65.0 — the choice editor, and the script's page density ───────
  {
    // The point of L3, and the thing that is easy to lose: an unset rule
    // is a sentence, not a heading over an empty control.
    name: "empty rules drawn as sections anyway",
    file: src("components/layout/InspectorPanel.tsx"),
    from: "          {option.conditions.length === 0 ? (",
    to: "          {false ? (",
    spec: "choice-editor",
    expect: "says so instead of drawing empty sections",
  },
  {
    name: "the agreed headings renamed back to field labels",
    file: src("components/layout/InspectorPanel.tsx"),
    from: '<h4 className="scriare-section-label text-[var(--text-3)]">Shown</h4>',
    to: '<h4 className="scriare-section-label text-[var(--text-3)]">Conditions</h4>',
    spec: "choice-editor",
    expect: "the three headings are the agreed words",
  },
  {
    // If the quiet line were only a label, it would be a dead end dressed
    // as an answer.
    name: "a quiet rule whose button is decoration",
    file: src("components/layout/InspectorPanel.tsx"),
    from: "              onAction={variables.length === 0 ? onOpenVariableManager : addCondition}",
    to: "              onAction={() => undefined}",
    spec: "choice-editor",
    expect: "turns the line into the section",
  },
  {
    name: "inline field labels dropped from the choice editor",
    file: src("components/layout/InspectorPanel.tsx"),
    from: '      <span className="pt-1.5 text-[11px] leading-none text-[var(--text-3)]">{label}</span>',
    to: "      <span />",
    spec: "choice-editor",
    expect: "labelled beside their controls",
  },
  {
    // The chips are the only way to read a block of six without opening
    // six, and his call was to keep them.
    name: "a closed choice that stops saying what it does",
    file: src("components/layout/InspectorPanel.tsx"),
    from: "      {!expanded && (",
    to: "      {false && (",
    spec: "choice-editor",
    expect: "still says what it does",
  },
  {
    // v0.64.0 shipped with this at 7, which kept almost every scene whole
    // and turned 3,300 words into 29 half-empty pages.
    name: "a script that starts a fresh page for almost every scene",
    file: src("export/script/buildScript.ts"),
    from: "const KEEP_WHOLE_BLOCKS = 3;",
    to: "const KEEP_WHOLE_BLOCKS = 7;",
    spec: "script-export",
    expect: "pages carry more than one scene",
  },
  // ── v0.66.0 — the Dialogue ───────────────────────────────────────────
  //
  // HALF OF THESE BREAK THE EXPORT AND NOT THE APP, on purpose. The rules
  // are written twice — once in React, once in the exported page's plain
  // JavaScript — and a control set that only broke the app would leave the
  // riskier implementation untested while looking thorough.
  {
    name: "a Play Mode that draws the whole page while the conversation is open",
    file: src("runtime/PlayRuntime.tsx"),
    from: "      ) {\n        break;\n      }",
    to: "      ) {\n        void 0;\n      }",
    spec: "dialogue",
    expect: "THE PAGE WAITS",
  },
  {
    name: "an exported page that draws the whole page while the conversation is open",
    file: src("export/pageRuntime.ts"),
    from: "        if (dialogueHolds(segment)) { held = true; break; }",
    to: "        if (dialogueHolds(segment)) { held = true; }",
    spec: "dialogue",
    expect: "THE EXPORTED PAGE WAITS",
  },
  {
    name: "a line that is said and stays on offer",
    file: src("runtime/blocks/dialogueRuntimeBlock.tsx"),
    from: "    if (said[line.id] && !line.repeatable) return false;\n    return true;",
    to: "    return true;",
    spec: "dialogue",
    expect: "SAID IS SPENT",
  },
  {
    name: "an exported page where saying a line spends nothing",
    file: src("export/pageRuntime.ts"),
    from: "      if (talk.said[line.i] && !line.rp) continue;",
    to: "      if (false) continue;",
    spec: "dialogue",
    expect: "and spends it",
  },
  {
    // The bug this feature shipped with for ten minutes: resetting the
    // conversation inside the scene render, which runs on every click.
    name: "an exported page that forgets the conversation on every click",
    file: src("export/pageRuntime.ts"),
    from: "    if (talkScene !== scene.id) {",
    to: "    if (true) {",
    spec: "dialogue",
    expect: "saying a line in the export appends it",
  },
  {
    name: "an END line that does not end the conversation",
    file: src("runtime/blocks/dialogueRuntimeBlock.tsx"),
    from: '    if (line.after === "end") context.closeDialogue?.(blockId);',
    to: '    if (line.after === "never") context.closeDialogue?.(blockId);',
    spec: "dialogue",
    expect: "a line marked END closes the conversation",
  },
  {
    // The other half of the bug pair: a restart that lands on the scene it
    // was already on left every conversation exhausted.
    name: "a restart that does not begin the conversation again",
    file: src("runtime/PlayRuntime.tsx"),
    from: "  }, [playSceneId, playToken]);",
    to: "  }, [playSceneId]);",
    spec: "dialogue",
    expect: "a line marked LEAVE turns the scene",
  },
  {
    name: "a conversation with no way out that nobody warns about",
    file: src("utils/dialogueBlocks.ts"),
    from: "  return lines.some((line) => !line.repeatable);",
    to: "  return true;",
    spec: "dialogue",
    expect: "nothing can end is reported",
  },
  {
    // The rule every downstream surface shares.
    name: "a dialogue line counted as an edge even though it stays",
    file: src("utils/dialogueBlocks.ts"),
    from: '  return line.after === "leave";',
    to: "  return true;",
    spec: "dialogue",
    // Aimed at the graph badge, which is the surface that reads this rule
    // most directly: five lines, four of which stay, and the badge says so.
    expect: "draws one badge for the conversation",
  },
  {
    name: "a script that prints a conversation as if it were a branch",
    file: src("export/script/buildScript.ts"),
    from: '        if (spoken.length) blocks.push({ kind: "dialogue", lines: spoken });',
    to: "        void spoken;",
    spec: "dialogue",
    expect: "prints the conversation as its own kind of block",
  },
  // ── v0.66.1, where a speaker's name sits ──────────────────────────────
  // All four break what the eye complained about rather than what the code
  // says, which is the only way an alignment assertion is worth anything:
  // a test that reads the CSS back would pass with the pill still hanging.
  {
    name: "the chip baselined again, as v0.66.0 had it",
    file: src("styles/index.css"),
    from: "  top: -.12em;\n  cursor: pointer;",
    to: "  top: 0;\n  cursor: pointer;",
    spec: "speaker-alignment",
    expect: "CENTRED ON THE LINE'S CAP BAND",
  },
  {
    name: "a chip given back its leading",
    file: src("styles/index.css"),
    from: "  line-height: 1.15;\n  vertical-align: baseline;",
    to: "  line-height: 1.5;\n  vertical-align: baseline;",
    spec: "speaker-alignment",
    expect: "does not hang below the baseline",
  },
  {
    name: "the reply's name back on a hand-picked padding",
    file: src("components/editor/DialogueLineView.tsx"),
    from: 'className="shrink-0 text-[10px] font-semibold uppercase leading-[16.5px] tracking-wide text-[var(--text-3)]"',
    to: 'className="shrink-0 pt-[3px] text-[10px] font-semibold uppercase tracking-wide text-[var(--text-3)]"',
    spec: "speaker-alignment",
    expect: "SHARES A BASELINE",
  },
  {
    name: "a Dialogue button that inserts the other block",
    file: src("components/editor/EditorToolbar.tsx"),
    from: "onClick={() => editor.chain().focus().insertDialogueBlock().run()}",
    to: "onClick={() => editor.chain().focus().insertChoiceBlock().run()}",
    spec: "speaker-alignment",
    expect: "puts one in the document",
  },
  {
    name: "a reply field that never grows to its content",
    file: src("components/editor/DialogueLineView.tsx"),
    from: '  el.style.height = "auto";\n  const height = el.scrollHeight;',
    to: "  const height = 0;",
    spec: "speaker-alignment",
    expect: "TALL ENOUGH TO READ ALL OF IT",
  },
  // ── v0.67.0, the two blocks as siblings ───────────────────────────────
  {
    name: "a Dialogue row painted on its own colours again",
    file: src("components/editor/DialogueLineView.tsx"),
    from: "      style={choiceBoxCss(box)}",
    to: '      style={{ background: "var(--surface)", borderColor: "var(--border-soft)", borderWidth: 1, borderStyle: "solid", borderRadius: 4 }}',
    spec: "dialogue-parity",
    expect: "THE SAME BOX",
  },
  {
    name: "a reply that keeps the height it was first measured at",
    file: src("components/editor/DialogueLineView.tsx"),
    from: "      last = width;\n      fit(el);",
    to: "      last = width;",
    spec: "speaker-alignment",
    expect: "RE-MEASURES THE REPLY",
  },
  {
    name: "a line reorder keyed on the wrong attribute",
    file: src("utils/dialogueBlocks.ts"),
    from: "  const byId = new Map(children.map((c) => [c.attrs.lineId as string, c]));",
    to: "  const byId = new Map(children.map((c) => [c.attrs.optionId as string, c]));",
    spec: "reorder",
    expect: "A DIALOGUE LINE CAN BE DRAGGED TOO",
  },
  {
    name: "a drop that lands at the end wherever it was released",
    file: src("components/layout/useReorderableList.ts"),
    from: "        finalOrder.splice(targetIdx, 0, droppedId as string);",
    to: "        finalOrder.push(droppedId as string);",
    spec: "reorder",
    expect: "moves it in the DOCUMENT",
  },
  // ── v0.67.1, the Inspector's own rows ─────────────────────────────────
  {
    name: "the line row given back its filled header strip",
    file: src("components/layout/DialoguePanel.tsx"),
    from: '      <div className="flex items-center gap-1">\n        <span\n          onPointerDown={onDragHandleDown}',
    to: '      <div className="flex items-center gap-1 rounded-t-md bg-[var(--surface-2)]">\n        <span\n          onPointerDown={onDragHandleDown}',
    spec: "dialogue-parity",
    expect: "THE INSPECTOR'S FOLDED ROWS ARE THE SAME ROW",
  },
  {
    name: "a line row with no fill of its own — the see-through drag",
    file: src("components/layout/DialoguePanel.tsx"),
    from: 'className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg)]"',
    to: 'className="rounded-lg border border-[var(--border-soft)]"',
    spec: "dialogue-parity",
    expect: "A DIALOGUE ROW HAS A FILL OF ITS OWN",
  },
  {
    name: "the panel title back in mixed case at text weight",
    file: src("components/layout/DialoguePanel.tsx"),
    from: '        <h3 className="scriare-section-label text-[var(--text-3)]">\n          Dialogue\n        </h3>',
    to: '        <h3 className="font-medium text-[var(--text)]">Dialogue</h3>',
    spec: "dialogue-parity",
    expect: "THE PANEL HEADER IS THE SAME HEADER",
  },
  {
    name: "an open line row with the choice panel's padding dropped",
    file: src("components/layout/DialoguePanel.tsx"),
    from: '<div className="space-y-3 border-t border-[var(--border-soft)] px-2 py-2.5">',
    to: '<div className="space-y-3 border-t border-[var(--border-soft)] px-3 py-3">',
    spec: "dialogue-parity",
    expect: "AN OPEN ROW IS THE SAME CARD TOO",
  },
  {
    name: "the line's Style row taken back out of the panel",
    file: src("components/layout/DialoguePanel.tsx"),
    from: '            {FieldRow({\n              label: "Style",',
    to: '            {false && FieldRow({\n              label: "Style",',
    spec: "dialogue-parity",
    expect: "BOTH PANELS USE THE SAME SPEAKER AND STYLE CONTROLS",
  },
  // ── v0.67.3, the Inspector following a click into a line's chrome ─────
  {
    name: "a line's chrome that does not aim the Inspector",
    file: src("components/editor/DialogueLineView.tsx"),
    from: "      onPointerDown={aimInspector}",
    to: "",
    spec: "inspector-follow",
    expect: "CLICKING A REPLY OPENS ITS OWN LINE",
  },
  {
    name: "a re-aim with no guard on the line already open",
    file: src("components/editor/DialogueLineView.tsx"),
    from: "    if (\n      already.kind === \"dialogue\" &&\n      already.blockId === blockId &&\n      already.lineId === lineId\n    ) {\n      return;\n    }",
    to: "",
    spec: "inspector-follow",
    expect: "clicking again inside the line already open changes nothing",
  },
  {
    name: "the Dialogue button drawn as the quieter half again",
    file: src("components/editor/EditorToolbar.tsx"),
    from: 'className="flex h-7 shrink-0 items-center gap-1.5 rounded-[5px] bg-[var(--accent-fill-strong)] px-2.5 text-xs font-semibold text-[var(--accent-text-on)] transition-colors hover:bg-[var(--accent)]"\n        >\n          <Icon name="dialogue"',
    to: 'className="flex h-7 shrink-0 items-center gap-1.5 rounded-[5px] border border-[var(--border)] bg-[var(--surface-2)] px-2.5 text-xs font-semibold text-[var(--text-2)] transition-colors hover:border-[var(--accent)]"\n        >\n          <Icon name="dialogue"',
    spec: "dialogue-parity",
    expect: "THE TWO TOOLBAR BUTTONS ARE THE SAME BUTTON",
  },
  // ── v0.68.0, the mark in the top bar ─────────────────────────────────
  {
    name: "a mark painted in its own colour again",
    file: src("components/layout/TopBar.tsx"),
    from: 'className="h-6 w-6 shrink-0 -translate-y-[2px] text-[var(--accent)]"',
    to: 'className="h-6 w-6 shrink-0 -translate-y-[2px] text-[var(--text)]"',
    spec: "brand-mark",
    expect: "THE MARK IS THE THEME'S ACCENT",
  },
  {
    name: "the mark centred on its own box again",
    file: src("components/layout/TopBar.tsx"),
    from: 'className="h-6 w-6 shrink-0 -translate-y-[2px] text-[var(--accent)]"',
    to: 'className="h-6 w-6 shrink-0 text-[var(--accent)]"',
    spec: "brand-mark",
    expect: "IT SITS ON THE LINE OF THE WORD",
  },
  {
    name: "the disc back tangent to the edge of its element",
    file: src("components/common/BrandMark.tsx"),
    from: '      viewBox="-28 -28 956 956"',
    to: '      viewBox="0 0 900 900"',
    spec: "brand-mark",
    expect: "THE DISC DOES NOT REACH THE EDGE",
  },

  // ── v0.69.0 — the ids under column A ─────────────────────────────────
  // The audit that produced this version found three routes to a duplicate
  // id and, beneath them, one reason all three survived to v0.68.0: every
  // piece of id bookkeeping only ever filled in a MISSING id, and none
  // could see a repeated one. So most of the sabotages below are "take the
  // duplicate half back out" — the state the app was actually in.
  {
    name: "the sweep back to filling blanks only, blind to a repeat",
    file: src("utils/contentIds.ts"),
    from: "    if (current && !used.has(current)) {",
    to: "    if (current) {",
    spec: "content-ids",
    expect: "SPLITTING A SENTENCE gives the two halves different ids",
  },
  // RETIRED, and said so rather than deleted. "The first of a duplicate
  // pair keeps its id" is still asserted by content-ids — it is what keeps
  // an existing translation attached to the half that starts a split
  // sentence — but since v0.71.0 the rule lives in a two-pass walk, and
  // every single-line inversion of it makes the sweep fault the same
  // position twice. That is an invalid ProseMirror transaction, so the
  // spec dies instead of going red, and a control that crashes proves
  // nothing at all.
  //
  // What still covers it: "the sweep renaming a line every time it is
  // rewritten" attacks the same branch from the other side, and "the sweep
  // back to filling blanks only" proves the duplicate is noticed. The rule
  // about WHICH of the two is kept is, for now, asserted and uncontrolled,
  // and writing that down is better than pretending otherwise.
  // This one took two tries to aim, and both misses were findings about
  // the test. Replacing the strip left the suite green, because the sweep
  // repairs a duplicate wherever it came from — so no paste INSIDE one
  // scene can tell the two designs apart. Pasting the copy above its
  // original did not help either. What the sweep cannot do is look at a
  // scene that is not open: it makes a document internally consistent and
  // says nothing about the project. So the case is a paste into a DIFFERENT
  // scene, and the strip is the only thing in the app that holds it.
  {
    name: "the paste keeping the ids it arrived with",
    file: src("extensions/LineId.ts"),
    from: "            new Slice(stripPastedIds(slice.content), slice.openStart, slice.openEnd),",
    to: "            slice,",
    spec: "content-ids",
    expect: "PASTING INTO ANOTHER SCENE leaves no id claimed by two scenes",
  },
  {
    name: "the paste stripping paragraphs but not the Dialogue's lines",
    file: src("utils/contentIds.ts"),
    from: '  paragraph: "lineId",\n  [DIALOGUE_LINE_TYPE]: "lineId",',
    to: '  paragraph: "lineId",',
    spec: "content-ids",
    expect: "PASTING INTO ANOTHER SCENE leaves no id claimed by two scenes",
  },
  {
    name: "a scene copy that reissues the choices and leaves the prose",
    file: src("utils/contentIds.ts"),
    from: "    const attrs = { ...(node.attrs ?? {}), [attr]: freshContentId(node.type) };",
    to: '    const attrs =\n      node.type === "paragraph"\n        ? { ...(node.attrs ?? {}) }\n        : { ...(node.attrs ?? {}), [attr]: freshContentId(node.type) };',
    spec: "content-ids",
    expect: "DUPLICATING A SCENE gives the copy its own ids",
  },
  {
    name: "the open-time pass carrying a file's existing duplicates through",
    file: src("utils/contentIds.ts"),
    from: "      const stale = !current || seen.has(current) || !isCurrentIdShape(current);",
    to: "      const stale = !current || !isCurrentIdShape(current);",
    spec: "content-ids",
    expect: "OPENING AN OLD FILE with duplicate ids heals it",
  },
  {
    name: "the open-time pass rewriting a document that was already correct",
    file: src("utils/contentIds.ts"),
    from: "  const out = walk(content);\n  return changed ? out : content;",
    to: "  const out = walk(content);\n  return out;",
    spec: "content-ids",
    expect: "a document with nothing wrong with it is not rewritten",
  },
  // ── v0.70.0 — the spreadsheet ────────────────────────────────────────
  // The sabotages are aimed at the properties a translator or an engine
  // would notice weeks later, not at the ones a glance at the file finds:
  // a duplicate RowName, a Ref that does not move with the story, an
  // encoding that mangles Turkish, prose whose gate went missing.
  {
    name: "the Ref numbered from the scene list rather than from the start scene",
    file: src("export/sheet/buildSheet.ts"),
    from: "  const declared = project.startSceneId;\n  const startId =\n    (declared && sceneById.has(declared) ? declared : project.scenes[0]?.id) ?? null;",
    to: "  const startId = project.scenes[0]?.id ?? null;",
    spec: "sheet-export",
    expect: "CHANGING THE START SCENE RENUMBERS",
  },
  {
    name: "an unreachable scene given an ordinary number",
    file: src("export/sheet/buildSheet.ts"),
    from: '    label.set(scene.id, `U${unreachable}`);',
    to: "    label.set(scene.id, String(order.length + 1));",
    spec: "sheet-export",
    expect: "A SCENE NOTHING LEADS TO GETS A U",
  },
  {
    name: "scene titles left out, the way the first draft of the spec left them out",
    file: src("export/sheet/buildSheet.ts"),
    from: '    push("Scene", {\n      // The scene\'s stored title key, not its id.',
    to: '    if (false) push("Scene", {\n      // The scene\'s stored title key, not its id.',
    spec: "sheet-export",
    expect: "SCENE TITLES ARE ROWS",
  },
  {
    name: "a gate that stops being carried down to the paragraphs it gates",
    file: src("export/sheet/buildSheet.ts"),
    from: "          if (child.type === \"paragraph\") paragraph(child, gate);",
    to: "          if (child.type === \"paragraph\") paragraph(child, \"\");",
    spec: "sheet-export",
    expect: "GATED PROSE CARRIES ITS CONDITION",
  },
  {
    name: "a soft line break flattened away, joining the words either side of it",
    file: src("export/sheet/buildSheet.ts"),
    from: '  if (node.type === "hardBreak") return "\\n";',
    to: '  if (node.type === "hardBreak") return "";',
    spec: "sheet-export",
    expect: "A SOFT LINE BREAK IS A LINE BREAK",
  },
  {
    name: "a reply given a number of its own instead of hanging off its line",
    file: src("export/sheet/buildSheet.ts"),
    from: "            refSuffix: `${TYPE_LETTER.Reply}${index}r`,",
    to: "            refSuffix: `${TYPE_LETTER.Reply}${index + 100}`,",
    spec: "sheet-export",
    expect: "a reply hangs off its line",
  },
  {
    name: "the CSV written with a byte order mark, the way a spreadsheet would",
    file: main("sheet/sheetCsv.ts"),
    from: '  return Buffer.from(`${lines.join("\\r\\n")}\\r\\n`, "utf-8");',
    to: '  return Buffer.from(`\\ufeff${lines.join("\\r\\n")}\\r\\n`, "utf-8");',
    spec: "sheet-export",
    expect: "NO BYTE ORDER MARK",
  },
  {
    name: "the CSV's first column named Key rather than RowName",
    file: main("sheet/sheetCsv.ts"),
    from: 'field(index === 0 ? "RowName" : SHEET_COLUMNS[index].header),',
    to: "field(SHEET_COLUMNS[index].header),",
    spec: "sheet-export",
    expect: "THE FIRST COLUMN IS RowName",
  },
  {
    name: "a newline left real inside a CSV cell, so one row spans two lines",
    file: main("sheet/sheetCsv.ts"),
    from: '  return `"${value.replace(/"/g, \'""\').replace(/\\r\\n|\\r|\\n/g, "\\\\n")}"`;',
    to: '  return `"${value.replace(/"/g, \'""\')}"`;',
    spec: "sheet-export",
    expect: "a newline inside a cell becomes an escaped one",
  },
  {
    name: "the two columns to fill in losing the colour that marks them",
    file: shared("sheet/model.ts"),
    from: "export const EDITABLE_COLUMNS = [8, 9];",
    to: "export const EDITABLE_COLUMNS: number[] = [];",
    spec: "sheet-export",
    expect: "the two columns to fill in are still marked",
  },
  {
    name: "the header band unfrozen, leaving row 400 of a flat sheet unreadable",
    file: main("sheet/sheetXlsx.ts"),
    from: '      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>',
    to: "",
    spec: "sheet-export",
    expect: "THE HEADER IS FROZEN, AND ONLY THE HEADER",
  },
  {
    name: "Chars baked as a number instead of written as a formula",
    file: main("sheet/sheetXlsx.ts"),
    from: "            return `<c r=\"${ref}\" s=\"${banded ? STYLE.charsBand : STYLE.chars}\"><f>LEN(H${r})</f></c>`;",
    to: "            return `<c r=\"${ref}\" s=\"${banded ? STYLE.charsBand : STYLE.chars}\"><v>${row.text.length}</v></c>`;",
    spec: "sheet-export",
    expect: "CHARS IS A REAL FORMULA",
  },
  {
    name: "an unescaped ampersand, which is how a hand-written workbook refuses to open",
    file: main("sheet/sheetXlsx.ts"),
    from: '    .replace(/&/g, "&amp;")\n    .replace(/</g, "&lt;")',
    to: '    .replace(/</g, "&lt;")',
    spec: "sheet-export",
    expect: "EVERY PART IS WELL-FORMED XML",
  },
  // Aimed at the FIXED-DATE assertion rather than at the identical-bytes
  // one, and that is a finding the controls produced rather than a
  // preference. Two exports a second apart match byte for byte even with
  // `new Date()`, because a zip stores DOS time at two-second resolution —
  // so the bytes check is true today and silent about the guarantee. The
  // date on the entries is where the guarantee actually lives.
  {
    name: "a fresh timestamp in every zip entry, so two exports never match",
    file: main("sheet/sheetXlsx.ts"),
    from: '  const at = new Date("2000-01-01T00:00:00Z");',
    to: "  const at = new Date();",
    spec: "sheet-export",
    expect: "every entry carries a fixed date",
  },
  {
    name: "the dialog uncapped again, running off both ends of a short window",
    file: src("components/common/Modal.tsx"),
    from: "className={`max-h-[calc(100vh-3rem)] w-full overflow-y-auto ${widthClassName}",
    to: "className={`w-full ${widthClassName}",
    spec: "kit",
    expect: "A DIALOG FITS THE WINDOW at 520px",
  },
  // ── v0.70.1 — the two things he opened the file and saw ──────────────
  {
    name: "the header band back to black text on a near-black fill",
    file: main("sheet/sheetXlsx.ts"),
    from: '    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>',
    to: '    <font><b/><sz val="11"/><name val="Calibri"/></font>',
    spec: "sheet-export",
    expect: "THE HEADER CAN BE READ",
  },
  {
    name: "a key that stops being made of the line's own words",
    file: src("utils/ids.ts"),
    from: "export function nameId(kind: IdKind, text: string, taken: ReadonlySet<string>): string | null {\n  const body = slugWords(text);",
    to: "export function nameId(kind: IdKind, text: string, taken: ReadonlySet<string>): string | null {\n  const body = \"\";\n  void slugWords(text);",
    spec: "sheet-export",
    expect: "A KEY IS THE LINE'S OWN WORDS",
  },
  {
    name: "the open-time pass no longer rewriting an old-shaped id",
    file: src("utils/contentIds.ts"),
    from: "      const stale = !current || seen.has(current) || !isCurrentIdShape(current);",
    to: "      const stale = !current || seen.has(current);",
    spec: "content-ids",
    expect: "AN ID IN THE OLD NANOID SHAPE IS RENAMED",
  },
  {
    name: "the banding dropped, so a row cannot be followed across seventeen columns",
    file: main("sheet/sheetXlsx.ts"),
    from: "      const banded = i % 2 === 1;",
    to: "      const banded = false;",
    spec: "sheet-export",
    expect: "the rows are banded",
  },
  {
    name: "the column being typed into striped along with the rest",
    file: main("sheet/sheetXlsx.ts"),
    from: "  if (EDITABLE_COLUMNS.includes(column)) return STYLE.editable;\n  return banded ? STYLE.cellBand : STYLE.cell;",
    to: "  if (EDITABLE_COLUMNS.includes(column)) return banded ? STYLE.cellBand : STYLE.editable;\n  return banded ? STYLE.cellBand : STYLE.cell;",
    spec: "sheet-export",
    expect: "the column being typed into keeps ONE colour",
  },
  // ── v0.71.0 — the key is a name ──────────────────────────────────────
  {
    name: "Turkish dropped instead of folded, leaving a key of nothing",
    file: src("utils/ids.ts"),
    from: '    .replace(/ı/g, "i")\n    .replace(/İ/g, "i")',
    to: "",
    spec: "sheet-export",
    expect: "Turkish folds to its Latin skeleton",
  },
  {
    name: "two lines that open the same way both claiming one key",
    file: src("utils/ids.ts"),
    from: "  for (let n = 2; n < 500; n += 1) {",
    to: "  if (taken.has(base)) return base;\n  for (let n = 2; n < 500; n += 1) {",
    spec: "sheet-export",
    expect: "TWO SCENES THAT OPEN THE SAME WAY get different keys",
  },
  {
    name: "naming that only looks at the open scene, so two scenes collide",
    file: src("types/project.ts"),
    from: "    const migrated = migrateChoicesIntoContent({ ...scene }, taken);",
    to: "    const migrated = migrateChoicesIntoContent({ ...scene });",
    spec: "sheet-export",
    expect: "TWO SCENES THAT OPEN THE SAME WAY get different keys",
  },
  {
    name: "a scene's own keys counted against it, so a second open renames everything",
    file: src("types/project.ts"),
    from: "    const own = collectProjectKeys([scene]);\n    for (const key of own) taken.delete(key);",
    to: "",
    spec: "choice-schema",
    expect: "loading an already-current document changes nothing",
  },
  {
    name: "a scene title's key derived fresh each time instead of stored",
    file: src("types/project.ts"),
    from: "    if (isCurrentIdShape(scene.titleKey)) return scene;",
    to: "",
    spec: "sheet-export",
    expect: "RENAMING A SCENE DOES NOT RENAME ITS KEY",
  },
  {
    name: "the sweep renaming a line every time it is rewritten",
    file: src("utils/contentIds.ts"),
    from: "      if (!isProvisional(current)) return true;",
    to: "",
    spec: "content-ids",
    expect: "A KEY IS A BIRTHMARK",
  },
  // ── v0.71.1 — the two things he hit opening his own export ───────────
  {
    name: "the Lines sheet shipped protected again, so its owner cannot type in it",
    file: main("sheet/sheetXlsx.ts"),
    from: "  <autoFilter ref=\"A1:${lastColumn}${lastRow}\"/>",
    to: '  <sheetProtection sheet="1" objects="1" scenarios="1"/>\n  <autoFilter ref="A1:${lastColumn}${lastRow}"/>',
    spec: "sheet-export",
    expect: "THE LINES SHEET IS NOT PROTECTED",
  },
  {
    name: "a second typeface declared alongside the first",
    file: main("sheet/sheetXlsx.ts"),
    from: '    <font><sz val="11"/><color rgb="FF3E4A57"/><name val="Calibri"/></font>',
    to: '    <font><sz val="11"/><color rgb="FF3E4A57"/><name val="Consolas"/></font>',
    spec: "sheet-export",
    expect: "ONE TYPEFACE THROUGHOUT",
  },
  // ── v0.71.2 — a file that does not fence its own reader ──────────────
  {
    name: "the vertical split back, drawing a rule between Ref and Where",
    file: main("sheet/sheetXlsx.ts"),
    from: '      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>',
    to: '      <pane xSplit="2" ySplit="1" topLeftCell="C2" activePane="bottomRight" state="frozen"/>',
    spec: "sheet-export",
    expect: "THE HEADER IS FROZEN, AND ONLY THE HEADER",
  },
  {
    name: "a lock flag back on a cell, so the sheet can refuse a keystroke again",
    file: main("sheet/sheetXlsx.ts"),
    from: '    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyAlignment="1">\n      <alignment vertical="top" wrapText="1"/></xf>',
    to: '    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyAlignment="1" applyProtection="1">\n      <alignment vertical="top" wrapText="1"/><protection locked="0"/></xf>',
    spec: "sheet-export",
    expect: "NOT ONE CELL carries a lock flag",
  },
  {
    name: "the editable pair fenced off with a rule down its side",
    file: main("sheet/sheetXlsx.ts"),
    from: '    <border><left/><right/><top/><bottom style="thin"><color rgb="FFE1E5EA"/></bottom><diagonal/></border>',
    to: '    <border><left style="thin"><color rgb="FFE8C97A"/></left><right/><top/><bottom style="thin"><color rgb="FFE1E5EA"/></bottom><diagonal/></border>',
    spec: "sheet-export",
    expect: "nothing is fenced off with a rule of its own",
  },
  // ── v0.72.0 — what a locked option is allowed to tell a reader ───────
  {
    name: "the threshold printed to the reader again",
    file: src("types/variables.ts"),
    from: "  return isNegativeCondition(condition, variable) ? `not ${name}` : name;",
    to: "  return `${name} ${condition.comparator} ${String(condition.value)}`;",
    spec: "variable-names",
    expect: "A NUMBER'S THRESHOLD NEVER REACHES THE READER",
  },
  {
    name: "the display name ignored, so the identifier is back in the prose",
    file: src("types/variables.ts"),
    from: '  return variable.displayName?.trim() || variable.name || "Untitled variable";',
    to: '  return variable.name || "Untitled variable";',
    spec: "variable-names",
    expect: "no internal name survives anywhere on the page",
  },
  {
    name: "a negative condition read as a positive one, stating the opposite",
    file: src("types/variables.ts"),
    from: '  let negative = condition.comparator === "neq";\n  if (variable?.type === "boolean" && !condition.value) negative = !negative;',
    to: '  let negative = condition.comparator === "neq";',
    spec: "variable-names",
    expect: "A NEGATIVE CONDITION SAYS SO",
  },
  {
    name: "the writer's own sentence overruled by the app's",
    file: src("types/variables.ts"),
    from: "  const own = written?.trim();\n  if (own) return own;\n  if (!conditions?.length) return \"\";",
    to: "  void written;\n  if (!conditions?.length) return \"\";",
    spec: "variable-names",
    expect: "THE WRITER'S OWN SENTENCE REPLACES OURS",
  },
  {
    name: "the exported page phrasing its own reasons, so the rehearsal and the file disagree",
    file: src("export/buildStory.ts"),
    from: "            r: lockSentence(option.lockReason, option.conditions, variables),",
    to: '            r: option.conditions?.length ? `Requires ${option.conditions.length} things` : "",',
    spec: "variable-names",
    expect: "THE EXPORTED PAGE SAYS THE SAME THINGS",
  },
  {
    name: "Check Story warning on a HIDDEN option, which shows a reader nothing",
    file: src("utils/storyCheck.ts"),
    from: '  if (gated.whenUnmet !== "lock") return [];',
    to: "",
    spec: "variable-names",
    expect: "NOT for the option carrying the writer's own sentence",
  },
  {
    name: "Check Story warning on an option whose reason was written, which names nothing",
    file: src("utils/storyCheck.ts"),
    from: "  if (gated.lockReason?.trim()) return [];",
    to: "",
    spec: "variable-names",
    expect: "NOT for the option carrying the writer's own sentence",
  },
  {
    name: "a locked reason left out of the spreadsheet",
    file: src("export/sheet/buildSheet.ts"),
    from: '      if (whenUnmet !== "lock" || !reason?.trim()) return;',
    to: "      return;",
    spec: "sheet-export",
    expect: "A LOCKED OPTION'S REASON IS A ROW",
  },
  {
    name: "variable names left out of the spreadsheet",
    file: src("export/sheet/buildSheet.ts"),
    from: "  const named = project.variables.filter((v) => v.displayName?.trim());",
    to: "  const named: typeof project.variables = [];",
    spec: "sheet-export",
    expect: "A VARIABLE'S READER-FACING NAME IS A ROW",
  },
  {
    // Aimed at the FILTER, because the filter is the whole guard — the
    // label below it falls back safely, so sabotaging that changed
    // nothing and the suite stayed green. What decides whether an
    // identifier reaches a translator is which variables get a row at all.
    name: "an UNNAMED variable handed to a translator as an identifier",
    file: src("export/sheet/buildSheet.ts"),
    from: "  const named = project.variables.filter((v) => v.displayName?.trim());",
    to: "  const named = project.variables;",
    spec: "sheet-export",
    expect: "an UNNAMED variable is not handed to a translator",
  },

  // ─── v0.73.0 — the wires ────────────────────────────────────────────
  {
    // The whole premise of the anchor model. Back to one point per card,
    // and four choices leave from the same pixel again.
    name: "every choice leaving a scene from the same point again",
    file: src("utils/wireAnchors.ts"),
    from: "  const offset = (index - (count - 1) / 2) * pitch;",
    to: "  const offset = 0;",
    spec: "graph-wires",
    expect: "three choices out of one scene leave from three different points",
  },
  {
    // Slots at even fractions rather than on a fixed pitch.
    //
    // This control was written first against "the middle slot is on the
    // card's centre line" and stayed GREEN, because at even fractions an
    // odd count owns the centre too — the claim in the comment was simply
    // false, and the control is what caught it. What the two schemes
    // really disagree about is whether spacing is a constant or depends on
    // how many choices a scene has, so that is what is asserted now.
    name: "slots spread across the edge instead of set on the grid's pitch",
    file: src("utils/wireAnchors.ts"),
    from: "  const offset = (index - (count - 1) / 2) * pitch;",
    to: "  const offset = ((index + 1) / (count + 1) - 0.5) * along;",
    spec: "graph-wires",
    expect: "two exits and four exits are spaced on the same pitch",
  },
  {
    // The S-bend, restored: sides fixed to right/left whatever direction
    // the wire actually travels in.
    name: "a wire leaving sideways to reach the scene below it",
    file: src("utils/wireAnchors.ts"),
    from: "    const [sOut, sIn] = sideFor(from, to);",
    to: '    const [sOut, sIn] = ["right", "left"];',
    spec: "graph-wires",
    expect: "a wire to the scene BELOW leaves the bottom and lands on the top",
  },
  {
    // Cards stop being obstacles — the defect this whole release is
    // about, put back on purpose.
    name: "a card that a wire may route straight through",
    file: src("utils/wireRouter.ts"),
    from: "      if (horizontal ? hBlocked[ei] : vBlocked[ei]) continue;",
    to: "      if (false) continue;",
    spec: "graph-wires",
    expect: "a wire that skips three scenes goes AROUND them, not through",
  },
  {
    // The give-up path that drew a wire anyway, which is how a connection
    // ran under two scenes in the version this replaces.
    name: "a wire the router could not place, drawn anyway",
    file: src("utils/wireRouter.ts"),
    // Sabotaged at the OUTPUT rather than at the failure, because the
    // first attempt — stashing an empty node list — threw inside the path
    // builder, and a crash kills the spec rather than reddening it, which
    // reports as "CRASHED" and proves nothing. A wrong answer has to be
    // plausible to be a control.
    from: "    const nodes = laid.get(w);\n    if (!nodes) continue;",
    to: "    const nodes = laid.get(w);\n    if (!nodes) { paths.set(w.link.id, `M ${w.p1.x} ${w.p1.y} L ${w.p2.x} ${w.p2.y}`); continue; }",
    spec: "graph-wires",
    expect: "a wire with nowhere to go comes back with no path at all",
  },
  {
    // The measured limit. Removing the switch is what "it'll be fine"
    // looks like in a diff, and at a thousand scenes it is 39 seconds.
    name: "the obstacle-aware router turned loose on a story too big for it",
    file: src("utils/wireRouter.ts"),
    from: "  if (boxes.length > boardAbove) {",
    to: "  if (false) {",
    spec: "graph-wires",
    expect: "a story too big for it gets the cheap one rather than a freeze",
  },
  {
    // The straightening pass, across the flow.
    //
    // Sabotaged by switching the pass OFF for the stack rather than by
    // pointing it at the wrong axis. Aiming it at the flow axis was tried
    // first and collapsed the chapter — every scene landed on one line, on
    // top of each other — so what went red was the ordering check, not the
    // column one, and the control reported NOT CAUGHT while having found a
    // worse bug than the one it was looking for. Turning the pass off is
    // the failure this check actually exists for: a spine that slides
    // downhill, in the right order, one card at a time.
    name: "a stacked chapter that slides downhill instead of standing in a column",
    file: src("utils/autoLayout.ts"),
    from: "  straightenRuns(graph, nodeIds, live, rankdir);",
    to: '  if (rankdir === "LR") straightenRuns(graph, nodeIds, live, rankdir);',
    spec: "graph-auto-layout",
    expect: "stacked, that same spine stands in one column",
  },
  {
    // The direction a chapter runs. Sideways at every level is what
    // produced a story twenty-three times wider than it was deep.
    name: "chapters running sideways again",
    file: src("utils/autoLayoutGraph.ts"),
    from: '      containerId === null ? "LR" : "TB",',
    to: '      "LR",',
    spec: "groups",
    expect: "Auto Layout arranges the scenes INSIDE a group",
  },
  {
    // Dragging falls back to whatever was routed before the drag started —
    // which is the shape the first release of this actually shipped with,
    // reported within the hour. The wire stays a LINE, so an assertion
    // about curves would not have caught it; what goes red is that the
    // line no longer starts where the card now is.
    name: "a dragged scene whose wires stay where the scene used to be",
    file: src("components/graph/FlowPanel.tsx"),
    from: "    if (!project || !dragging) return empty;",
    to: "    if (true) return empty;",
    spec: "graph-wires",
    expect: "followed the card rather than staying where it was",
  },
  // ─── v0.75.0 — the story's own facts ────────────────────────────────
  {
    // The player, hard-coded again. Gap 2 of the v0.63.0 audit, restored.
    name: "a protagonist who cannot be named",
    file: src("types/speaker.ts"),
    from: "  if (isPlayerSpeaker(speaker)) return playerLabel(playerName);",
    to: "  if (isPlayerSpeaker(speaker)) return PLAYER_SPEAKER_LABEL;",
    spec: "story-details",
    expect: "a named protagonist is named in front of their line",
  },
  {
    // The name never reaches the prose pass, so Play Mode and the export
    // both print "You" while the Inspector and the menus say otherwise.
    name: "a player name the prose never hears about",
    file: src("utils/speakerLines.ts"),
    from: "      const name = run.line(speaker) ? speakerName(speaker, entities, playerName) : null;",
    to: "      const name = run.line(speaker) ? speakerName(speaker, entities) : null;",
    spec: "story-details",
    expect: "a named protagonist is named in front of their line",
  },
  {
    // `lang` written whether or not the story said. The wrong tag is the
    // failure the export deliberately avoided for twenty-seven versions:
    // a screen reader given `lang="en"` reads a Turkish story in English,
    // where no tag falls back to the reader's own setting.
    name: "an exported page that guesses at the story's language",
    file: src("export/pageTemplate.ts"),
    from: '  const lang = story.language ? ` lang="${escapeHtml(story.language)}"` : "";',
    to: '  const lang = ` lang="${escapeHtml(story.language ?? "en")}"`;',
    spec: "story-details",
    expect: "ships no lang at all",
  },
  {
    // An emptied field stored as "" rather than dropped. Two spellings of
    // unset in one file, and every reader of these fields then has to know
    // about both.
    name: "an emptied field stored as an empty string",
    file: src("state/projectStore.ts"),
    from: "      const text = value.trim();\n      return text.length > 0 ? text : undefined;",
    to: "      return value.trim();",
    spec: "story-details",
    expect: "an emptied field is absent, not an empty string",
  },
  {
    // The title allowed to become nothing, which empties the top bar, the
    // shelf and the exported page's <title> in one keystroke.
    name: "a story title a stray Backspace can empty",
    file: src("state/projectStore.ts"),
    from: "      const title = details.name.trim();\n      if (title.length > 0) next.name = title;",
    to: "      next.name = details.name.trim();",
    spec: "story-details",
    expect: "a title cannot be emptied by a stray Backspace",
  },
  {
    // Save with nothing changed putting a step on the undo stack and
    // marking the file dirty.
    name: "opening a dialog and closing it counted as an edit",
    file: src("state/projectStore.ts"),
    from: "    if (unchanged) return;",
    to: "    if (false) return;",
    spec: "story-details",
    expect: "saving a dialog you changed nothing in does not dirty the file",
  },
  {
    // Appearance back in Project Settings, where it says the theme is part
    // of the story. It is not: it is remembered per machine and never
    // written to the file.
    name: "the theme picker filed as a project setting again",
    file: src("components/layout/ProjectSettingsDialog.tsx"),
    from: "            useUIStore.getState().openPreferences(\"settings\");",
    to: "            useUIStore.getState().openSettings();",
    spec: "story-details",
    expect: "Preferences is where the themes went",
  },

  {
    // The way back as a footer button again — the shape v0.75.0 shipped
    // and v0.75.1 corrected. Both dialogs still offer a route home, so an
    // assertion that merely counts routes stays green; what goes red is
    // WHERE it sits.
    name: "a child dialog offering its way out among the buttons that commit",
    file: src("components/layout/PreferencesDialog.tsx"),
    from: "        back={\n          cameFrom === \"settings\"",
    to: "        back={\n          false",
    spec: "story-details",
    expect: "above its own heading, not among the buttons",
  },
  {
    // The rule applied to one dialog and not the other, which is exactly
    // how it drifted the first time: Choice Styles obeyed it for eight
    // versions while nothing checked that anything else did.
    name: "the breadcrumb rule kept for one dialog only",
    file: src("components/choices/ChoiceStylesDialog.tsx"),
    from: "  const cameFromSettings = useUIStore((s) => s.choiceStylesFrom) === \"settings\";",
    to: "  const cameFromSettings = false;",
    spec: "story-details",
    expect: "Choice Styles does the same thing, the same way",
  },

  // ─── v0.74.0 — the Welcome screen's maps ────────────────────────────
  {
    // Back to a sample. A card drawn from twenty of a writer's thirty-two
    // scenes is not a less detailed picture of their story, it is a
    // picture of a different one.
    name: "a story map that draws only some of the story again",
    file: src("utils/recentShape.ts"),
    from: "export const MAX_SHAPE_NODES = 50;",
    to: "export const MAX_SHAPE_NODES = 8;",
    spec: "welcome",
    expect: "every scene of a story under the cap is in its shape",
  },
  {
    // The routes stop being cached. The map still draws — it falls back
    // to a straight line between the two cards — so nothing about the
    // arithmetic notices; what goes red is the picture.
    name: "a map whose connections carry no route",
    file: src("utils/recentShape.ts"),
    from: "  const routed = routeWires(routeBoxes, routeLinks);",
    to: "  const routed = { polylines: new Map() } as ReturnType<typeof routeWires>;",
    spec: "welcome",
    expect: "every connection carries a route",
  },
  {
    // The drawing measured by the CARDS rather than by what was drawn. A
    // route that had to go around the outermost scene then falls outside
    // the box and is clipped against the panel edge.
    name: "a drawing sized to the cards, so a detour is clipped off it",
    file: src("utils/recentShape.ts"),
    from: "  const drawW = drawMaxX - drawMinX;\n  const drawH = drawMaxY - drawMinY;",
    to: "  const drawW = spanX;\n  const drawH = spanY;",
    spec: "welcome",
    expect: "the drawing's extent covers where it went",
  },
  {
    // The margin, gone. Reported as "it does not look premium", which is
    // a real complaint about a drawing scaled to fill the panel exactly.
    name: "a map drawn flush against the edge of its panel",
    file: src("components/welcome/StoryMap.tsx"),
    from: "const PAD = 10;",
    to: "const PAD = 0;",
    spec: "welcome",
    expect: "keeps its distance from the panel's edge",
  },
  {
    // Dim-on-select, off. The geometry is untouched, so nothing in the
    // layout or routing checks notices — which is the point of having it.
    name: "selecting a scene that no longer clears the view around it",
    file: src("components/graph/FlowPanel.tsx"),
    from: "    if (selectedGraphIds.size === 0) return null;",
    to: "    if (true) return null;",
    spec: "graph-wires",
    expect: "fades the scene it has nothing to do with",
  },
  {
    // The reported fault itself, put back: the dialog lands inside the bar
    // that owns its open flag rather than over the window. `.scriare-topbar`
    // is `position: relative; z-index: 3`, so the backdrop's z-100 stops
    // meaning anything outside it and the status bar — worth the same 3 and
    // later in the document — goes on painting over the glass.
    //
    // The sabotage moves the portal's TARGET rather than deleting the call.
    // Deleting it would leave `(<div/>, document.body)` — a comma
    // expression returning a DOM node, which crashes instead of answering
    // wrongly. This renders perfectly, traps focus, and passes every other
    // dialog check in the suite. That is what a control has to be.
    name: "a dialog drawn into the bar that opened it instead of over the window",
    file: src("components/common/Modal.tsx"),
    from: "    document.body,\n  );",
    to: "    document.querySelector(\".scriare-topbar\") ?? document.body,\n  );",
    spec: "accessibility",
    expect: "chrome is behind the dialog",
  },
  {
    // The rule kept for the two dialogs that were reported and no others.
    // `max-w-md` is exactly Project Settings and Preferences, so this is
    // the shape of a fix aimed at a bug report instead of at the app: the
    // two complained-about dialogs come out right and Choice Styles and
    // Check Story quietly go back under the chrome.
    //
    // It is here because a check that only ever opens the dialogs someone
    // complained about would stay green through this, and would have been
    // worth nothing the next time a dialog was written inside a panel.
    name: "the covering rule kept only for the dialogs that were complained about",
    file: src("components/common/Modal.tsx"),
    from: "    document.body,\n  );",
    to: "    widthClassName === \"max-w-md\"\n      ? document.body\n      : (document.querySelector(\".scriare-topbar\") ?? document.body),\n  );",
    spec: "accessibility",
    expect: "chrome is behind the dialog",
  },
  {
    // THE SLOT THAT GETS MISSED. A Dialogue line carries two speakers —
    // its own and its reply's — so a walk that handles the node rather
    // than the slots finds three of the four and looks entirely correct:
    // prose, choices and dialogue lines all report, and only the reply is
    // silently invisible. This is the control the whole four-slot walk
    // exists for.
    name: "a speaker walk that finds a line's speaker but not its reply's",
    file: src("utils/speakerLines.ts"),
    from: '      take(node.attrs?.replySpeaker, "reply", id);',
    to: "",
    spec: "story-check",
    expect: "REPLY",
  },
  {
    // The false alarm. `@player` is not an entity id and cannot dangle, so
    // counting it would put a warning on almost every story that exists —
    // the kind of wrong answer that gets a whole feature turned off.
    name: "the player counted as somebody who could have been deleted",
    file: src("utils/speakerLines.ts"),
    from: "    if (!speaker || speaker === PLAYER_SPEAKER) return;",
    to: "    if (!speaker) return;",
    spec: "story-check",
    expect: "the player is never reported",
  },
  {
    // A Location set as a speaker is still in the story. Calling that
    // "deleted" is a sentence the writer cannot act on: they go looking
    // for something that is sitting in the Content panel.
    name: "a location that cannot speak reported as one that was deleted",
    file: src("utils/storyCheck.ts"),
    from: '        kind: entity ? "silent-speaker" : "deleted-speaker",',
    to: '        kind: "deleted-speaker",',
    spec: "story-check",
    expect: "not as deleted",
  },
  {
    // Counting lines rather than references. A Dialogue line whose reply
    // is spoken by the same missing character loses two names, so a count
    // of nodes reads lower than the damage — and the report would be
    // tidier than the truth, which is the failure nobody notices.
    name: "a report that counts the lines rather than the names that vanish",
    file: src("utils/storyCheck.ts"),
    from: "      if (seen) seen.count += 1;",
    to: "      if (seen) seen.count += 0;",
    spec: "story-check",
    expect: "ONE row, not five",
  },
  {
    // The anchor dropped. Two defects from one missing field: the row
    // stands for five lines and opens none of them, AND — because
    // StoryCheckDialog decides a row's SHAPE from whether it has a
    // blockId — it silently turns from a name and a chip into a
    // truncated sentence. That second one is invisible to anything that
    // reads the issue objects rather than the screen.
    name: "a speaker row that names the scene instead of the first line in it",
    file: src("utils/storyCheck.ts"),
    from: "        ...(anchor ? { anchorId: anchor } : {}),",
    to: "",
    spec: "story-check",
    expect: "points at the FIRST line",
  },
  {
    // The reported defect, put back: one finding means a different
    // component with no way to open it. Everything else about the report
    // keeps working, which is exactly why it survived from v0.36.2.
    name: "a scene with one finding drawn as something that cannot be opened",
    file: src("components/story/StoryCheckDialog.tsx"),
    from: "                {isOpen && (",
    to: "                {isOpen && group.issues.length > 1 && (",
    spec: "story-check",
    expect: "explains itself on the page",
  },
  {
    // The hint dropped from the row, back to hover-only. The data is still
    // perfect — `checkStory` returns the sentence either way — so every
    // assertion made against the issue OBJECTS stays green. Only a check
    // that reads the screen can see this, which is why they do.
    name: "an explanation that is correct in the data and drawn nowhere",
    file: src("components/story/StoryCheckDialog.tsx"),
    from: "                            {issue.hint}",
    to: "                            {(issue.anchorId ?? issue.blockId) ? \"\" : issue.hint}",
    spec: "story-check",
    expect: "explains itself on the page",
  },
  {
    // The v0.76.0 defect exactly as it shipped: the walk asks for an
    // attribute no node type in this app uses, so every anchor is null in
    // every real document and the reveal has nothing to scroll to. It went
    // unnoticed for a release because the spec's own fixture wrote the
    // same wrong attribute.
    name: "a node's id read from an attribute no node type uses",
    file: src("utils/speakerLines.ts"),
    from: "    const attr = idAttrFor(node.type);",
    to: '    const attr = "id";',
    spec: "story-check",
    expect: "points at the FIRST line",
  },
  {
    // Told the Inspector everything is a choice, which is what goTo did
    // until now — and what made v0.76.0's speaker rows point at a choice
    // that does not exist.
    name: "the Inspector told that a conversation is a choice",
    file: src("components/story/StoryCheckDialog.tsx"),
    from: "      selectTarget({ kind: issue.inspect, sceneId: issue.sceneId, blockId: issue.blockId });",
    to: '      selectTarget({ kind: "choice", sceneId: issue.sceneId, blockId: issue.blockId });',
    spec: "story-check",
    expect: "opens the Inspector on the conversation",
  },
  {
    // The scroll removed, the mark kept. The finding is still marked and
    // the caret is still in the right place — it is simply 2000px down a
    // scroller that never moved, which is the state this shipped in for
    // half an hour before it was measured.
    name: "a line marked where the writer cannot see it",
    file: src("hooks/useRevealMatch.ts"),
    from: '        dom.scrollIntoView({ block: "center", behavior: "smooth" });',
    to: "",
    spec: "story-check",
    expect: "scrolls the editor to the line",
  },
  {
    // The fade cancelled by its own cleanup — the shape the obvious
    // version of this has, where `clearReveal` re-runs the effect and
    // React tears the timer down before it can fire.
    name: "a mark that never takes itself away",
    file: src("hooks/useRevealMatch.ts"),
    from: "      }, REVEAL_FLASH_MS);\n      return;",
    to: "      }, REVEAL_FLASH_MS);\n      return () => window.clearTimeout(fadeTimer.current);",
    spec: "story-check",
    expect: "takes itself away",
  },
  {
    // The v0.77.0 defect he reported, put back: a finding raised from a
    // Dialogue line falls through to the table that is keyed on KIND, and
    // `unnamed-variable-shown` is filed there as a choice — because a
    // choice raises it too. InspectorPanel then finds no options on a
    // Dialogue block's id and falls back to Scene Properties, which is
    // exactly what he saw: the conversation lit up in the editor and the
    // panel showed the scene.
    //
    // Aimed at the reportUnnamed default rather than at the table, because
    // that is where the caller's knowledge is thrown away.
    name: "a Dialogue's finding filed as a choice's because they share a kind",
    file: src("utils/storyCheck.ts"),
    from: "      sceneId,\n      blockId,\n      anchorId,\n      inspect,\n    });\n  };",
    to: '      sceneId,\n      blockId,\n      anchorId,\n      inspect: "choice",\n    });\n  };',
    spec: "story-check",
    expect: "opens the Inspector on the conversation",
  },
  {
    // v0.77.0's shape: one field for two questions, so the mark is
    // whatever the Inspector opens on — all six options of a Choice Block
    // for a fault on one of them. It still scrolls, it still marks, it
    // still lands in the right scene; it is simply pointing at the
    // haystack. Nothing that reads the issue objects can tell.
    name: "a whole block lit up for a fault on one line inside it",
    file: src("components/story/StoryCheckDialog.tsx"),
    from: "    const mark = issue.anchorId ?? issue.blockId;",
    to: "    const mark = issue.blockId ?? issue.anchorId;",
    spec: "story-check",
    expect: "marks the OPTION",
  },
  {
    // The anchor dropped at the source instead. Same visible outcome by a
    // different route — here the finding never knew which option it was
    // about, so no consumer could.
    name: "a choice finding that does not record which option it is about",
    file: src("utils/storyCheck.ts"),
    from: "          anchorId: option.id,\n        });",
    to: "        });",
    spec: "story-check",
    expect: "the option for the mark",
  },
  {
    // The Inspector opened on the conversation's FIRST line whatever was
    // clicked — the state before the anchor was passed through as a
    // lineId. The editor and the panel then disagree about which line the
    // writer came for, which is worse than either being wrong alone.
    name: "a Dialogue panel opened on a different line from the one marked",
    file: src("components/editor/SceneEditor.tsx"),
    from: 'inspector.selectTarget({ kind: "dialogue", sceneId, blockId, lineId });',
    to: 'inspector.selectTarget({ kind: "dialogue", sceneId, blockId });',
    spec: "story-check",
    expect: "not the conversation's first",
  },
  {
    // v0.67.4's mistake made a third time: the newest block type drawn as
    // the quieter control. It still works and it still says the thing
    // having no button at all was saying.
    name: "the third block type given a lesser button than its two siblings",
    file: src("components/editor/EditorToolbar.tsx"),
    from: '          data-insert-conditional\n          className="flex h-7 shrink-0 items-center gap-1.5 rounded-[5px] bg-[var(--accent-fill-strong)] px-2.5 text-xs font-semibold text-[var(--accent-text-on)] transition-colors hover:bg-[var(--accent)]"',
    to: '          data-insert-conditional\n          className="flex h-7 shrink-0 items-center gap-1.5 rounded-[5px] border border-[var(--border)] px-2.5 text-xs font-medium text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)]"',
    spec: "conditions",
    expect: "same control as the Dialogue",
  },
  {
    // The block inserted and the caret left outside it — how the first
    // build of this button behaved, so everything typed went into the
    // page behind the block the writer had just made. Nothing says so.
    name: "a block to write in that does not put the caret in it",
    file: src("extensions/ConditionalBlock.ts"),
    from: "              if (at === -1 || !dispatch) return true;",
    to: "              if (at === -1 || !dispatch || true) return true;",
    spec: "conditions",
    expect: "the first thing typed is inside the block",
  },
  {
    // Drawn as its own kind of thing again. The v0.30.0 treatment is what
    // made three of them stacked read as one, and re-introducing any of
    // it is the same mistake in a smaller size.
    name: "the third sibling drawn as its own kind of object again",
    file: src("components/editor/ConditionalBlockView.tsx"),
    from: '          : "border-[var(--border)] bg-[var(--surface-2-faint)]"',
    to: '          : "border-dashed border-[var(--border-faint)]"',
    spec: "conditions",
    expect: "same object as the Choice",
  },
  {
    // A footer that counts instead of saying when. The count is already
    // in the header; the footer's width is worth the one fact the writer
    // opened the block to check.
    name: "a footer that counts conditions instead of naming them",
    file: src("components/editor/ConditionalBlockView.tsx"),
    from: '      : `Shown when ${conditions.map((c) => describeCondition(c, variables)).join(", and ")}.`;',
    to: '      : `${count} ${count === 1 ? "condition" : "conditions"} set.`;',
    spec: "conditions",
    expect: "says WHEN, in words",
  },
  {
    // The two rows of explanation restored. Nothing breaks; the panel
    // simply says in the abstract what the block now says about itself,
    // in the place the writer is not looking.
    name: "the Inspector explaining again what the block already says",
    file: src("components/layout/InspectorPanel.tsx"),
    from: '        <div className="scriare-section-label text-[var(--text-3)]">Conditional</div>',
    to: '        <div className="scriare-section-label text-[var(--text-3)]">Conditional</div>\n        <p className="text-xs text-[var(--text-3)]">This passage appears only when every condition below holds.</p>',
    spec: "conditions",
    expect: "no longer spends two rows explaining",
  },
  {
    // The old name back in the one place that still had it. Everything
    // works; the block is simply called two things, and the menu is where
    // a writer meets it first.
    name: "the slash menu calling the block by a name nothing else uses",
    file: src("narrativeBlocks/registry.ts"),
    from: '    title: "Conditional",',
    to: '    title: "Conditional Text",',
    spec: "conditions",
    expect: "the same word as the button and the block",
  },
  {
    // The rename done without keeping the old word findable. Nothing
    // looks wrong — the menu is consistent and the block is correct — and
    // a writer who has been typing `/text` for weeks simply stops finding
    // it, with no error to report.
    name: "a rename that quietly breaks the way somebody already finds it",
    file: src("narrativeBlocks/registry.ts"),
    from: '"state", "reactive", "text"],',
    to: '"state", "reactive"],',
    spec: "conditions",
    expect: "reachable by the word that used to be in its title",
  },
  {
    // Mentions written over. The replacement lands, the text looks right,
    // and the link between the prose and the character page is gone — so
    // renaming her later changes every other mention and not this one.
    name: "a replace that writes over a mention as if it were text",
    file: src("utils/replaceInStory.ts"),
    from: "  return !hit.touchesMention && hit.kind !== \"name\";",
    to: "  return hit.kind !== \"name\";",
    spec: "find",
    expect: "only what Replace can act on",
  },
  {
    // Applied in ascending order. Every replacement shifts the positions
    // after it, so the second hit in a line lands a few characters off —
    // and with same-length text it is invisible until you read it.
    name: "replacements applied front to back, so each one moves the next",
    file: src("utils/replaceInStory.ts"),
    from: "    .sort((a, b) => b.from - a.from);",
    to: "    .sort((a, b) => a.from - b.from);",
    spec: "find",
    expect: "the ticked hits change",
  },
  {
    // The emptied text node left in place. The replacement is correct and
    // the document will not load again, because ProseMirror's schema has
    // no empty text node.
    name: "an emptied text node left where the schema has no room for one",
    file: src("utils/replaceInStory.ts"),
    from: "  if (replaced > 0) pruneEmptyText(doc);",
    to: "",
    spec: "find",
    expect: "leaves no empty text node",
  },
  {
    // One undo step per document instead of one for the gesture — which on
    // a forty-scene rename means forty presses of Ctrl+Z.
    name: "a story-wide replace that owns none of the prose it changed",
    file: src("state/projectStore.ts"),
    from: "    pushHistory(set, get, replaced === 1 ? \"Replace\" : `Replace ${replaced}`, undefined, true);",
    to: "    pushHistory(set, get, replaced === 1 ? \"Replace\" : `Replace ${replaced}`);",
    spec: "find",
    expect: "puts every one of them back",
  },
  {
    // The preview removed. Replace still works; it is simply a destructive
    // button pressed by somebody who has not seen what it will do.
    name: "a Replace All with nothing shown before it is pressed",
    file: src("components/layout/FindResults.tsx"),
    from: "              {replacement && chosen ? (",
    to: "              {false ? (",
    spec: "find",
    expect: "shows what it will become",
  },

  /* ── Custom CSS (v0.80.0) ─────────────────────────────────────────
     The load-bearing claim is that a writer's plain rule beats the app's
     own painting of a choice. It rests on three separate things being
     true at once — the app's rules being layered, the generated box rules
     being layered, and the writer's not being — so each is broken on its
     own below. A control that only broke "the whole arrangement" would
     pass while two of the three were wrong. */
  {
    // The app's own stylesheet out of its layer. It then outranks any
    // writer rule that is less specific than one of its own — which is
    // most of what a writer types, because the app writes descendants
    // (`.scriare-prose h2`) where a writer writes `h2`.
    name: "the exported page's stylesheet escaping its cascade layer",
    file: src("export/pageStyles.ts"),
    from: "@layer scriare.base {",
    to: "@media all {",
    spec: "custom-css",
    expect: "plainer rule beats a more specific one",
  },
  {
    // The writer's stylesheet put in the same layer as the generated box
    // rules, where specificity decides again and it loses.
    name: "the writer's stylesheet folded in with the generated rules",
    file: src("export/pageTemplate.ts"),
    from: "<style>${safe}</style>`;",
    to: "<style>@layer scriare.boxes { ${safe} }</style>`;",
    spec: "custom-css",
    expect: "beats the Choice Style, with no !important",
  },
  {
    // Choice Styles back on inline styles, in the exported page. This is
    // the version of the app that shipped for two years, and it is the
    // reason the feature needed a cascade at all.
    name: "a choice painted with an inline style again",
    file: src("export/pageRuntime.ts"),
    from: 'var button = element("button", "scriare-choice " + choice.bx);',
    to: 'var button = element("button", "scriare-choice"); button.style.background = "rgb(9,9,9)";',
    spec: "custom-css",
    expect: "beats the Choice Style, with no !important",
  },
  {
    // Tailwind's preflight back out of its layer. It sets
    // `background-color: transparent` on every button, unlayered, so a
    // styled choice in PLAY MODE loses its fill — which is how this was
    // found in the first place.
    name: "Tailwind's reset outranking the generated choice boxes",
    file: src("styles/index.css"),
    from: "@layer scriare.reset {\n  @tailwind base;\n}",
    to: "@tailwind base;",
    spec: "choice-styles",
    expect: "painted in its style during Play",
  },
  {
    // Two different boxes given one class, so they share a rule and the
    // last one written wins for both.
    //
    // The first version of this control swapped the hash for the key's
    // LENGTH and was never caught, correctly: both surfaces call this one
    // function, so any consistent scheme works and "derived from the
    // values rather than from a counter" is a property that removes a
    // failure mode rather than one a test can watch fail. What a test CAN
    // watch is two distinct looks collapsing into one.
    name: "two different choice styles given the same class",
    file: src("styles/choiceBoxLayer.ts"),
    from: "  return `scriare-box-${hash.toString(36)}`;",
    to: "  return `scriare-box-same`;",
    spec: "custom-css",
    expect: "the rest of that style is still there",
  },
  {
    // The escape removed. A stylesheet containing `</style>` then ends its
    // own element and the rest of it lands on the page as text.
    name: "a stylesheet allowed to close its own element",
    file: src("export/pageTemplate.ts"),
    from: 'const safe = css.replace(/<\\/(style)/gi, "<\\\\2f$1");',
    to: "const safe = css;",
    spec: "custom-css",
    expect: "does not end the element early",
  },
  {
    // The Export button no longer held. A writer can then ship a page that
    // phones a third party without having read that it does.
    name: "an export that ships a network fetch without being asked",
    file: src("components/export/ExportDialog.tsx"),
    from: "              disabled={busy || (remoteFetches(project.stylesheet).length > 0 && !fetchesAcked)}",
    to: "              disabled={busy}",
    spec: "custom-css",
    expect: "Export is held until the writer has read what it costs",
  },
  {
    // An @import counted twice, which is what the first version did.
    name: "a fetch reported twice because it matched two patterns",
    file: src("export/stylesheetNotes.ts"),
    from: "  const byTarget = new Map<string, string>();",
    to: "  const byTarget = { set: (_k, v) => found.push(v), has: () => false, values: () => found };\n  const found = [];",
    spec: "custom-css",
    expect: "both reported",
  },
  {
    // The stylesheet trimmed on the way into the file. A writer who
    // indents their CSS finds it re-indented the next time they open it.
    name: "a stylesheet tidied up on its way into the file",
    file: src("types/project.ts"),
    from: "        ? raw.stylesheet\n        : undefined,",
    to: "        ? raw.stylesheet.trim()\n        : undefined,",
    spec: "custom-css",
    expect: "indentation is not tidied away",
  },
  {
    // Play Mode's switch that does not switch.
    name: "a Play Mode CSS switch that changes nothing",
    file: src("runtime/PlayRuntime.tsx"),
    from: "{customCss && project.stylesheet ? (",
    to: "{project.stylesheet ? (",
    spec: "custom-css",
    expect: "takes it off, back to the Choice Style underneath",
  },

  /* ── First-run teaching (v0.81.0) ─────────────────────────────────
     The claim is that a block says ONE thing about itself wherever it is
     met. Every control below breaks that in a different place, because
     the failure this guards against is not "the help is missing" — it is
     four surfaces quietly drifting apart, which is the state the app was
     in before this version and which nothing noticed for two years. */
  {
    // A tooltip typed by hand again, saying something reasonable and
    // different. This is the exact shape of the bug that shipped: the
    // Conditional's button and its slash-menu entry had two near-enough
    // sentences, and near-enough is how a newcomer concludes there are
    // two things.
    name: "a block tooltip written by hand instead of read from the catalog",
    file: src("components/editor/EditorToolbar.tsx"),
    from: 'title={blockTooltip("conditional")}',
    to: 'title="Insert a Conditional block"',
    spec: "first-run",
    expect: "tooltip is the registry's own sentence",
  },
  {
    // The Choice's tooltip back to naming itself. Grammatical, accurate,
    // and useless to the one person who needs it — which is why there is
    // a check for it by shape rather than by string.
    name: "a tooltip that is the app repeating its own noun",
    file: src("narrativeBlocks/registry.ts"),
    from: '    description: "The story branches — the reader picks one and moves on",',
    to: '    description: "Insert a choice block",',
    spec: "first-run",
    expect: "says something its own name does not",
  },
  {
    // The block's own header carrying its own copy of the words.
    name: "a block header with its own private tagline",
    file: src("components/editor/DialogueBlockView.tsx"),
    from: '          — {blockTagline("dialogue")}',
    to: "          — a conversation block",
    spec: "first-run",
    expect: "wears the same tagline as everything else",
  },
  {
    // The panel writing its own explanations. It would look right, read
    // right, and be a fifth place to keep in step.
    name: "the help panel explaining a block in its own words",
    file: src("components/layout/HelpDialog.tsx"),
    from: "                <p className=\"text-[13px] leading-relaxed text-[var(--text-2)]\">{block.teaches}</p>",
    to: "                <p className=\"text-[13px] leading-relaxed text-[var(--text-2)]\">A kind of block.</p>",
    spec: "first-run",
    expect: "in the same words the toolbar and the block itself use",
  },
  {
    // A block dropped from the panel — the failure mode a hard-coded list
    // of ids would have, which is why the list is derived from `teaches`.
    name: "a block type missing from the panel that explains them",
    file: src("narrativeBlocks/registry.ts"),
    from: "export const STORY_BLOCKS = NARRATIVE_BLOCKS.filter((block) => Boolean(block.teaches));",
    to: 'export const STORY_BLOCKS = NARRATIVE_BLOCKS.filter((block) => Boolean(block.teaches) && block.id !== "conditional");',
    spec: "first-run",
    expect: "explains exactly the blocks that have something to teach",
  },
  {
    // The door removed from the toolbar. The Welcome screen's copy would
    // still be there, and unreachable from the moment the question is
    // actually asked.
    name: "help reachable only from a screen you have already left",
    file: src("components/layout/TopBar.tsx"),
    from: "            data-open-help",
    to: "            data-open-help-disabled",
    spec: "first-run",
    expect: "a door to it wherever a writer is standing",
  },
  {
    // The empty page stops naming the way in.
    name: "an empty scene that says nothing about the three blocks",
    file: src("components/editor/SceneEditor.tsx"),
    from: '        placeholder: "Start writing this scene — or press / for a Choice, a Dialogue or a Conditional",',
    to: '        placeholder: "Start writing this scene...",',
    spec: "first-run",
    expect: "tells a newcomer how to reach the three blocks",
  },
  {
    // An FAQ entry that names a place the app does not have. The prose is
    // his to judge; a wrong signpost is not a matter of taste.
    name: "an FAQ answer pointing at a surface that does not exist",
    file: src("help/faq.ts"),
    from: "Yes — Project Settings → Stylesheet takes your own CSS.",
    to: "Yes — the Appearance tab takes your own CSS.",
    spec: "first-run",
    expect: "points at things that exist",
  },
  {
    // The panel out of the no-project branch again — the state v0.81.0
    // actually shipped in, where the Welcome screen's link set the flag
    // and rendered nothing. Eight controls were green over it, because
    // every one of them drove the door that exists only once a story is
    // open.
    name: "a help link on the Welcome screen that opens nothing",
    file: src("App.tsx"),
    from: "        {helpOpen && <HelpDialog onClose={closeHelp} />}\n        <ConfirmDialogHost />",
    to: "        <ConfirmDialogHost />",
    spec: "first-run",
    expect: "opens the panel, on a screen with no story behind it",
  },

  /* ── found by looking (v0.81.2) ───────────────────────────────────
     Two defects that 1031 passing tests could not see, because neither
     was a thing anybody had thought to assert. Both were visible in one
     screenshot. */
  {
    // The placeholder back to the browser's own colour, where two lines of
    // example CSS read as a stylesheet the story already had.
    name: "example CSS that reads as CSS the story already has",
    file: src("components/layout/StylesheetDialog.tsx"),
    from: "placeholder:text-[var(--text-3)] ",
    to: "",
    spec: "custom-css",
    expect: "cannot be mistaken for CSS already in the story",
  },
  {
    // A writer's HUD printing a programmer's word.
    name: "a variable HUD that says “undefined” at a writer",
    file: src("runtime/VariableReadout.tsx"),
    from: "  const resolved = value ?? variable.defaultValue ?? defaultValueForType(variable.type);",
    to: "  const resolved = value ?? variable.defaultValue;",
    spec: "play-ground",
    expect: "never as “undefined”",
  },

  /* ── One floating panel (v0.82.0) ─────────────────────────────────
     The sweep's own claims, plus the app-wide one it turned up: a
     Tailwind arbitrary shadow that compiles to nothing. */
  {
    // The hint removed, which is the state five surfaces shipped in.
    // NOTE the expect string. The general "actually paints a shadow"
    // check measures the CLASS, and Tailwind keeps generating it while
    // any file still uses it — ToastHost does. So the sabotage shows up
    // where it actually bites: on the panel itself.
    name: "a shadow token Tailwind reads as a colour and paints as nothing",
    file: src("components/common/surfaces.ts"),
    from: "shadow-[shadow:var(--shadow-floating)]",
    to: "shadow-[var(--shadow-floating)]",
    spec: "surfaces",
    expect: "takes the theme's own shadow",
  },
  {
    // Tailwind's own fixed black back on the panel. It looks right in a
    // dark theme and reads as dirt on paper in a light one, which is the
    // thing v0.46.0 defined the token to avoid.
    name: "a menu shadowed in Tailwind's fixed black instead of the theme's",
    file: src("components/common/surfaces.ts"),
    from: "shadow-[shadow:var(--shadow-floating)]",
    to: "shadow-xl",
    spec: "surfaces",
    expect: "shadowed differently on a light theme than on a dark one",
  },
  {
    // A menu painted on the page's own ground again, so it reads as a
    // hole cut in the page rather than a card lying on it.
    name: "a floating menu painted on the page's own ground",
    file: src("components/common/surfaces.ts"),
    from: "bg-[var(--surface)]",
    to: "bg-[var(--bg)]",
    spec: "surfaces",
    expect: "a raised surface rather than the page's own ground",
  },
  {
    // One menu keeping its own copy of the surface, which is the state
    // the app was in: four menus, three spellings.
    name: "a menu that keeps its own spelling of the panel",
    file: src("components/editor/SlashCommandMenu.tsx"),
    from: "className={`w-64 overflow-hidden py-1 ${FLOATING_PANEL}`}",
    to: 'className="w-64 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg)] py-1 shadow-xl"',
    spec: "surfaces",
    expect: "painted with the token, not with a fixed black",
  },
  {
    // THE INVERSE CONTROL, and it guards a decision rather than a
    // mechanism: applying the kit's label class to this editable field
    // breaks renaming, so the control puts the class back and watches the
    // rename check go red. It is the reason the group name keeps its own
    // spelling, kept as a test so the next sweep does not "fix" it again.
    name: "a chapter name brought onto the kit at the cost of renaming it",
    file: src("components/graph/GroupNode.tsx"),
    from: 'className="nodrag nopan min-w-0 flex-1 cursor-text bg-transparent text-xs font-semibold uppercase tracking-wide',
    to: 'className="scriare-section-label nodrag nopan min-w-0 flex-1 cursor-text bg-transparent',
    spec: "entities-and-renaming",
    expect: "selects the letters it was dragged across",
  },

  /* ── Settings' doors stop looking like fields (v0.83.0) ───────── */
  {
    // A door drawn as a field again, which is the shape that made three
    // kinds of thing read as one stack.
    name: "a door in Settings built like a text field",
    file: src("components/layout/ProjectSettingsDialog.tsx"),
    from: '      data-settings-door\n      className="flex w-full items-center gap-3',
    to: '      data-settings-door\n      className="block w-full rounded-md border border-[var(--border)] px-3 py-2',
    spec: "story-details",
    expect: "each door shows its current value on the right",
  },
  {
    // The value back inside the label, where it made a label do a value's
    // job and the control's text change length with the data.
    name: "a door whose value is hidden inside its own label",
    file: src("components/layout/ProjectSettingsDialog.tsx"),
    from: '            value={themeLabel}',
    to: '            value=""',
    spec: "story-details",
    expect: "each door shows its current value on the right",
  },
  {
    // The one sentence borrowed from the option we did not build.
    name: "a settings list that does not say what is not saved in the story",
    file: src("components/layout/ProjectSettingsDialog.tsx"),
    from: "          These open in their own place. Appearance is the only one not saved in the story.",
    to: "          These open in their own place.",
    spec: "story-details",
    expect: "says which of them is not saved in the story",
  },
  {
    // Export silent about the stylesheet again — the state that had him
    // hunting the dialog for a switch that does not exist.
    name: "an export that never mentions the stylesheet it is shipping",
    file: src("components/export/ExportDialog.tsx"),
    from: "            {project.stylesheet && (",
    to: "            {false && (",
    spec: "custom-css",
    expect: "says the stylesheet is going with the page",
  },
  {
    // The New button back to its own spelling — the state this file was
    // in, with a bordered secondary button written two ways inside it.
    name: "a secondary button re-typed instead of taken from the kit",
    file: src("components/layout/ContentBrowser.tsx"),
    from: '            <Button\n              intent="secondary"\n              size="sm"\n              ref={newButton}',
    to: '            <Button\n              intent="secondary"\n              size="md"\n              ref={newButton}',
    spec: "kit",
    expect: "the kit's secondary, measured",
  },
  {
    // The search field painted in the panel's own colour, which is what
    // "finishing the job" with the kit's row-scale input would do.
    name: "a search field painted the same colour as the panel behind it",
    file: src("components/layout/ContentBrowser.tsx"),
    from: 'className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--bg)]',
    to: 'className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface)]',
    spec: "kit",
    expect: "not painted the same as the panel behind it",
  },

  // ── v0.84.0 · the Inspector's fields, buttons and hints ─────────────
  {
    // The defect this version found, put back where it was: the kit's
    // panel field re-pointed at the panel's own colour, which paints every
    // field on the Inspector and the Content Browser with no fill.
    name: "the kit's panel field painted the colour of the panel it sits on",
    file: src("components/common/Field.tsx"),
    from: "  `rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 py-1 text-xs",
    to: "  `rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1 text-xs",
    spec: "kit",
    expect: "painted the colour of the panel behind it",
  },
  {
    // One field of the seven, rather than the shared class — because the
    // check must catch a single call site drifting, not only the kit moving
    // underneath all of them. This is the exact state the destination
    // picker shipped in.
    name: "one Inspector field back on its own spelling, in the panel's colour",
    file: src("components/layout/choiceControls.tsx"),
    from: "        className={`w-full py-1.5 ${INPUT_CLASS_PANEL}`}",
    to: '        className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--text)]"',
    spec: "kit",
    expect: "painted the colour of the panel behind it",
  },
  {
    // The accent button back to a hand-written copy — and not an obviously
    // wrong one: this is the spelling thirteen call sites actually used,
    // minus the font weight. A shape check that only notices a button drawn
    // at twice the size is not measuring anything.
    name: "an accent button re-typed beside its siblings, one declaration light",
    file: src("components/layout/choiceControls.tsx"),
    // THE WHOLE ELEMENT, not its props. The first version of this control
    // deleted `intent` and `size` and left a colour in `className`, and the
    // check PASSED — because `className` cannot recolour a kit Button (see
    // Button.tsx), so the sabotaged button came out in `--text`, fell out
    // of the set this check selects by colour, and left three buttons that
    // still agreed with each other. The sabotage has to be what the defect
    // actually looks like: a hand-written `<button>`, in the spelling
    // thirteen call sites used, missing only the font weight.
    from:
      '        <Button\n          // No origin: this route came from the Inspector, not from\n' +
      "          // Settings, so the dialog must not offer a way \"back\" to a\n" +
      "          // Settings dialog the writer was never in (v0.55.0).\n" +
      "          onClick={() => openChoiceStyles()}\n" +
      '          title="Edit the project\'s Choice Styles"\n' +
      '          intent="accentGhost"\n          size="xs"\n          className="shrink-0"\n' +
      "        >\n          Edit…\n        </Button>",
    to:
      "        <button\n          type=\"button\"\n          onClick={() => openChoiceStyles()}\n" +
      '          title="Edit the project\'s Choice Styles"\n' +
      '          className="shrink-0 rounded px-1.5 py-0.5 text-xs text-[var(--accent)] hover:bg-[var(--accent-soft-2)]"\n' +
      "        >\n          Edit…\n        </button>",
    spec: "kit",
    expect: "is one shape",
  },
  {
    // The placeholder colour out of the kit, which is the state eleven
    // fields were in. Deliberately removed from the SHARED constant rather
    // than from one call site: the claim this version makes is that the
    // field shape carries it, so the control has to break the shape.
    name: "the kit's fields back to whatever grey the cascade gives a hint",
    file: src("components/common/Field.tsx"),
    from: 'const PLACEHOLDER = "placeholder:text-[var(--text-3)]";',
    to: 'const PLACEHOLDER = "";',
    spec: "kit",
    expect: "the app's own hint colour",
  },

  // ── v0.85.0 · the wire router's key ─────────────────────────────────
  {
    // THE STATE IT SHIPPED IN for twelve versions: the router called
    // directly, so every change to `project` re-routed every wire in the
    // story. This is the control that matters, because it is the only one
    // that can tell a fixed build from a broken one — the wires themselves
    // are identical either way.
    name: "the whole story re-routed on every keystroke again",
    file: src("components/graph/FlowPanel.tsx"),
    from:
      '    return reuseBySignature(routeCache.current, "routes", routeSignature(boxes, links), () => {\n' +
      "      const result = routeWires(boxes, links);\n" +
      "      return { paths: result.paths, labels: result.labels };\n" +
      "    });",
    to:
      "    const result = routeWires(boxes, links);\n" +
      "    return { paths: result.paths, labels: result.labels };",
    spec: "perf",
    expect: "does not re-route the story",
  },
  {
    // The signature blind to one field — `ordinal`, which decides which
    // slot a wire leaves a scene from. Chosen over `x` deliberately: moving
    // a scene is the case everyone thinks of and would be caught by almost
    // any check, while two choices out of one scene swapping order is the
    // one that would ship.
    name: "a route key that cannot tell choice 1 from choice 2",
    file: src("utils/wireRouter.ts"),
    from: "    .map((x) => `${x.id}:${x.source}>${x.target}#${x.ordinal}`)",
    to: "    .map((x) => `${x.id}:${x.source}>${x.target}`)",
    spec: "perf",
    expect: "every change that CAN move a wire changes the key",
  },
  {
    // And the sort removed, which is the cheap-reuse half rather than the
    // correctness half: the key stays right and starts missing hits when
    // the content tree is reordered without anything moving.
    name: "a route key that depends on the order the boxes arrive in",
    file: src("utils/wireRouter.ts"),
    from:
      "  const b = boxes\n" +
      "    .map((x) => `${x.id}@${x.x},${x.y},${x.width},${x.height}`)\n" +
      "    .sort()\n" +
      "    .join(\"|\");",
    to:
      "  const b = boxes\n" +
      "    .map((x) => `${x.id}@${x.x},${x.y},${x.width},${x.height}`)\n" +
      "    .join(\"|\");",
    spec: "perf",
    expect: "not a change the router has to answer",
  },

  // ── v0.85.0 · the menu row ──────────────────────────────────────────
  {
    // THE STATE THE SLASH MENU SHIPPED IN: the row the keyboard is on
    // painted one step off the panel instead of two, which is also the
    // colour its siblings use for HOVER. Done on the kit rather than at
    // that one call site, because the claim this version makes is that the
    // separation belongs to the row shape.
    name: "the row the keyboard is on painted the same as a hover",
    file: src("components/common/surfaces.ts"),
    from: 'export const MENU_ITEM_SELECTED = "bg-[var(--surface-3)]";',
    to: 'export const MENU_ITEM_SELECTED = "bg-[var(--surface-2)]";',
    spec: "surfaces",
    expect: "three different colours in every theme",
  },
  {
    // And the hover taken off the row shape, which is what every one of the
    // four menus did differently before this: two had one, two had none,
    // and the two that had one disagreed about the colour.
    name: "a menu row with no hover of its own again",
    file: src("components/common/surfaces.ts"),
    from: '"flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-[var(--surface-2)]"',
    to: '"flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors"',
    spec: "surfaces",
    expect: "names the hover colour",
  },

  // ── v0.85.0 · the ✕ that removes a row ──────────────────────────────
  {
    // THE DEFECT, PUT BACK WHERE IT WAS: the ✕ on a dialogue line borrowing
    // `--surface-3`, which v0.85.0 reserves for the row the keyboard is on.
    // Done at that call site rather than on the kit, because the thing being
    // guarded is a caller painting over an intent it imported — which is the
    // way the v0.56.0 drift happened the first time.
    name: "a row's remove button borrowing the keyboard-selection colour",
    file: src("components/editor/DialogueLineView.tsx"),
    from: '            className="opacity-0 transition-opacity group-hover:opacity-100"',
    to: '            className="opacity-0 transition-opacity hover:bg-[var(--surface-3)] group-hover:opacity-100"',
    spec: "kit",
    expect: "borrows the colour that means",
  },
  {
    // The hover fill off the intent entirely — the state the choice row's ✕
    // and two others shipped in, where the control a writer is about to
    // press gives no sign of being a target at all.
    name: "a quiet remove with no fill under the pointer again",
    file: src("components/common/Button.tsx"),
    from: '    "border border-transparent bg-transparent text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--danger)]",',
    to: '    "border border-transparent bg-transparent text-[var(--text-3)] hover:text-[var(--danger)]",',
    spec: "kit",
    expect: "says the same thing under the pointer",
  },
  {
    // And the size, which is the one value in this version with a recorded
    // argument behind it: the Variable Manager grew its own ✕ because it was
    // "the smallest destructive control in the app". Shrinking the kit's
    // glyph size to the text size puts that back.
    name: "the destructive glyph shrunk to the text button's target",
    file: src("components/common/Button.tsx"),
    from: '  icon: "rounded px-1.5 py-1 text-xs",',
    to: '  icon: "rounded px-1.5 py-0.5 text-xs",',
    spec: "kit",
    // NOT "is the same shape", which is what this control was first pointed
    // at and which it can never fail: shrinking the kit's size shrinks all
    // of them together, so they agree at any size. The runner's fourth-way
    // diagnostic (v0.78.2) said so in as many words — "the sabotage DID fail
    // 1 check; none of them contain..." — which is the message existing to
    // tell a stale expectation apart from an unguarded claim.
    expect: "a real target",
  },

  // THERE IS NO CONTROL FOR THE OPPOSITE — announcing a stylesheet that
  // does not exist — and the attempt is worth recording. Forcing the
  // guard true CRASHES the render rather than failing an assertion,
  // because the guard and the value it reads are the same expression:
  // with no stylesheet there is nothing to call `.split` on. The check
  // stays; its property is enforced by the code's shape rather than by a
  // watchable failure, which is the third time this pattern has come up
  // (see v0.80.0's box-class control and v0.81.0's tooltip one).
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
// NAME=wordmark runs the one control whose name contains that text
// (v0.80.0). SKIP/TAKE index into a list that moves whenever a control is
// added above, which is how a repaired control gets "verified" by watching
// a different one go red. A name does not move.
// A COMMA MEANS "ANY OF THESE" (v0.84.0). The common job is watching the
// controls one version added, which is three or four names and never a
// shared substring. It was `ONLY=<spec>` and a twenty-minute rebuild of
// every control that spec owns, or four separate runs — so in practice it
// got done once and not again.
const named = process.env.NAME?.toLowerCase()
  .split(",")
  .map((part) => part.trim())
  .filter(Boolean);
const matching = CONTROLS.filter(
  (c) =>
    (!only || c.spec.startsWith(only)) &&
    (!named?.length || named.some((part) => c.name.toLowerCase().includes(part))),
);

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

    /**
     * A blind spot this had until v0.63.0, found the hard way.
     *
     * Some controls do not REPLACE a line, they wrap one — `to` contains
     * `from` and adds something around it (the toast's off-palette
     * background is the standing example). After such a sabotage the
     * original text is still there, so the first test below ("from
     * present — fine") said fine about a file that was currently broken.
     * Two interrupted runs left that style attribute in ToastHost.tsx,
     * the pre-flight cleared it twice, and the next full suite failed in
     * themes.spec with an off-palette toast nobody had written.
     *
     * For a control that wraps, the presence of `to` is the only honest
     * question — `from` tells you nothing either way.
     */
    const wraps = control.to !== "" && control.to.includes(control.from);
    if (wraps) {
      if (text.includes(control.to)) sabotaged.push(control);
      else if (!text.includes(control.from)) stale.push(control);
      continue;
    }

    if (text.includes(control.from)) continue;
    if (control.to !== "" && text.includes(control.to)) sabotaged.push(control);
    else stale.push(control);
  }

  for (const control of sabotaged) {
    if (restore) {
      // In a LOOP, because a wrapping sabotage can be applied more than
      // once — two interrupted runs put that toast background in twice,
      // and a single replace takes one of them back out and reports the
      // file restored.
      let text = await readFile(control.file, "utf-8");
      let passes = 0;
      while (text.includes(control.to) && passes < 20) {
        text = text.replace(control.to, control.from);
        passes += 1;
      }
      await writeFile(control.file, text, "utf-8");
      console.log(
        `↺  restored${passes > 1 ? ` (${passes} layers)` : ""}: ${control.file.replace(root, ".")} — ${control.name}`,
      );
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

  /**
   * THE FOURTH WAY A CONTROL CAN BE WRONG (v0.78.2).
   *
   * The three in the file's header are all about the sabotage or the
   * spec. This one is about the control's own `expect` string, and it
   * looked exactly like a real miss for eighteen versions: "a + New that
   * cannot make everything the tree holds" reported NOT CAUGHT while its
   * sabotage worked perfectly and the check caught it every time. The
   * check had been reworded in v0.60.0 — four things became five, "all
   * four" became "everything" — and the control was still looking for the
   * old sentence.
   *
   * "Nothing failed" and "something failed, but not the thing you named"
   * are different problems with different fixes, and the runner used to
   * print the same three words for both. It says which now.
   */
  const stale = !caught && !crashed && failedLines.length > 0;

  verdicts.push({
    name: control.name,
    verdict: caught
      ? "caught"
      : crashed
        ? "CRASHED (no assertion failed)"
        : stale
          ? "EXPECT STRING MATCHES NOTHING (the sabotage did fail a check)"
          : "NOT CAUGHT",
    detail: failedLines.slice(0, 3).join(" | ") || "nothing failed",
  });
  console.log(`${caught ? "✓ " : "✗ "} ${control.name} — ${caught ? "caught" : stale ? "its expect string matches nothing" : "NOT CAUGHT"}`);
  if (stale) {
    console.log(`     the sabotage DID fail ${failedLines.length} check(s); none of them contain "${control.expect}":`);
  }
  if (!caught) console.log(`     ${failedLines.slice(0, 4).join("\n     ") || "the whole suite stayed green"}`);
}

console.log("\n──────── negative controls ────────");
for (const v of verdicts) console.log(`${v.verdict === "caught" ? "✓" : "✗"} ${v.name}: ${v.verdict}`);
const clean = verdicts.filter((v) => v.verdict === "caught").length;
console.log(`\n${clean}/${verdicts.length} sabotages were caught`);
process.exit(clean === verdicts.length ? 0 : 1);
