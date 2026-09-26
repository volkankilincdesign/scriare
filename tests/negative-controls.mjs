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
    from: "      const touched = await refreshRecentEntry(project, filePath, get().selectedSceneId, false);",
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
    from: "      type=\"button\"\n      autoFocus\n      onClick={() => void onOpen(entry.filePath)}",
    to: "      type=\"button\"\n      onClick={() => void onOpen(entry.filePath)}",
    spec: "welcome",
    expect: "where the keyboard lands",
  },
  {
    name: "the wordmark swapped by the theme's NAME rather than its ground",
    file: src("components/common/BrandMark.tsx"),
    from: "  const src = isLightGround(theme) ? logoPrimaryLight : logoPrimaryDark;",
    to: '  const src = theme === "light" ? logoPrimaryLight : logoPrimaryDark;',
    spec: "welcome",
    // A straight apostrophe, because that is what the check's name has.
    // The first version of this line wrote a curly one and the control
    // came back NOT CAUGHT while the assertion was failing correctly
    // three lines above it — the same stale-`expect` mistake v0.49.0 made.
    expect: "follows the theme's GROUND",
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
    name: "each axis stretched to fill the card",
    file: src("utils/recentShape.ts"),
    from: "    x: round3((p.x - minX) * scale),\n    y: round3((p.y - minY) * scale),",
    to: "    x: round3(spanX === 0 ? 0 : (p.x - minX) / spanX),\n    y: round3(spanY === 0 ? 0 : (p.y - minY) / spanY),",
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
