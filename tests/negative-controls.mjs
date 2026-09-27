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
    name: "a + New that cannot make everything the tree holds",
    file: src("components/layout/ContentBrowser.tsx"),
    from: '      {\n        label: "New Character",',
    to: '      {\n        label: "New Charactor",',
    spec: "scene-panel",
    expect: "all four things the tree holds",
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
