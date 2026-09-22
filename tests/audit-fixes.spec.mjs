/**
 * The v0.49.0 audit fixes (v0.49.0).
 *
 * Every assertion here was first a MEASUREMENT on the shipped v0.48.0
 * build. The audit produced sixteen confirmed defects; this file is those
 * reproductions turned around — the same input, asserting the right answer
 * instead of recording the wrong one. The wrong answer is quoted in each
 * block so a future reader can see what the test is guarding, rather than
 * a bare expectation with no memory of why it exists.
 *
 * The three fixes that could not be driven from here live elsewhere:
 * the backup rotation and the export/project extension rules are main
 * process and are covered by project-file.spec.mjs, and the window-close
 * handshake needs a real window close.
 */

import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFile, rm, stat } from "node:fs/promises";

export default async function run({ api, check, seedProject }) {
  /* ════════════════════════════════════════════════════════════════
     1. Undo after a scene switch — the worst one
     ════════════════════════════════════════════════════════════════
     Measured on v0.48.0, with no typing at all:
       open scene one, switch to scene three, press Ctrl+Z
         scene three before : "three"
         can().undo()       : true
         scene three after  : "one"      ← scene one's text
     The swap was `editor.commands.setContent`, which sets `preventUpdate`
     but not `addToHistory: false`, so changing scenes was an undoable
     step — and undoing it persisted through onUpdate. */

  await seedProject();
  const switched = await api(async () => {
    const store = window.__scriareProjectStore;
    const ed = () => window.__scriareEditorStore.getState().editor;
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    const text = (doc) => (JSON.stringify(doc).match(/"text":"[^"]*"/g) ?? []).join(" ");
    const sceneText = (id) => text(store.getState().project.scenes.find((s) => s.id === id).content);

    store.getState().selectScene("s1");
    await wait(160);
    if (!ed()) return { error: "no editor mounted" };
    store.getState().selectScene("s3");
    await wait(220);

    const before = sceneText("s3");
    const canUndo = ed().can().undo();
    ed().commands.undo();
    await wait(180);
    return { before, canUndo, after: sceneText("s3"), shows: text(ed().getJSON()) };
  });

  check(
    "arriving in a scene, there is nothing to undo",
    switched.canUndo === false,
    switched.canUndo ? "the scene swap is still in the history stack" : "history starts clean",
  );
  check(
    "undo cannot write one scene's text into another",
    switched.after === switched.before,
    `"${switched.before}" → "${switched.after}"`,
  );

  /* Typing, then switching, then undoing: the previous scene's words must
     stay in the previous scene. */
  await seedProject();
  const typed = await api(async () => {
    const store = window.__scriareProjectStore;
    const ed = () => window.__scriareEditorStore.getState().editor;
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    const text = (doc) => (JSON.stringify(doc).match(/"text":"[^"]*"/g) ?? []).join(" ");
    const sceneText = (id) => text(store.getState().project.scenes.find((s) => s.id === id).content);

    store.getState().selectScene("s1");
    await wait(160);
    ed().commands.focus("end");
    ed().commands.insertContent(" ALPHA");
    await wait(140);
    const one = sceneText("s1");

    store.getState().selectScene("s2");
    await wait(220);
    ed().commands.undo();
    await wait(180);

    return { one, oneAfter: sceneText("s1"), two: sceneText("s2") };
  });
  check(
    "typing in one scene survives an undo pressed in another",
    typed.oneAfter === typed.one && typed.one.includes("ALPHA"),
    `${typed.one} → ${typed.oneAfter}`,
  );
  check(
    "the scene being read is untouched by that undo",
    typed.two === '"text":"two"',
    typed.two,
  );

  /* ════════════════════════════════════════════════════════════════
     2. "Open the version on disk" reloads the editor
     ════════════════════════════════════════════════════════════════
     Measured on v0.48.0: the store held the disk version while the editor
     still showed the session text, and the next keystroke wrote the
     session text back — destroying the version the writer chose to keep.
     The load effect's guard was the scene id alone, and a reload does not
     change it. */

  await seedProject();
  const reloaded = await api(async () => {
    const store = window.__scriareProjectStore;
    const ed = () => window.__scriareEditorStore.getState().editor;
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    const text = (doc) => (JSON.stringify(doc).match(/"text":"[^"]*"/g) ?? []).join(" ");

    store.getState().selectScene("s1");
    await wait(160);
    ed().commands.focus("end");
    ed().commands.insertContent(" SESSION-TEXT");
    await wait(140);

    // Exactly what resolveConflictReload does: the project replaced
    // wholesale, the same scene selected, and the token bumped.
    const disk = {
      ...store.getState().project,
      scenes: store.getState().project.scenes.map((s) =>
        s.id === "s1"
          ? { ...s, content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "DISK-VERSION" }] }] } }
          : s,
      ),
    };
    store.setState({
      project: disk,
      selectedSceneId: "s1",
      saveConflict: null,
      documentToken: store.getState().documentToken + 1,
    });
    await wait(240);

    const shows = text(ed().getJSON());
    ed().commands.focus("end");
    ed().commands.insertContent("x");
    await wait(160);
    const stored = text(store.getState().project.scenes.find((s) => s.id === "s1").content);
    return { shows, stored };
  });

  check(
    "the editor shows the version that was chosen, not the one discarded",
    reloaded.shows.includes("DISK-VERSION") && !reloaded.shows.includes("SESSION"),
    reloaded.shows,
  );
  check(
    "typing after the reload does not write the discarded text back",
    !reloaded.stored.includes("SESSION"),
    reloaded.stored,
  );

  /* ════════════════════════════════════════════════════════════════
     3. Structural undo leaves character-page prose alone
     ════════════════════════════════════════════════════════════════
     Measured on v0.48.0: create a scene (which snapshots), write on a
     character page, undo — "THREE NEW PARAGRAPHS" reverted to "OLD".
     `mergeLiveProse` carried only `scenes` forward. */

  await seedProject();
  const entityProse = await api(async () => {
    const store = window.__scriareProjectStore;
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    const text = (doc) => (JSON.stringify(doc).match(/"text":"[^"]*"/g) ?? []).join(" ");

    store.setState({
      project: {
        ...store.getState().project,
        entities: [
          {
            id: "e1",
            kind: "character",
            name: "Kestrel",
            aliases: [],
            content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "OLD" }] }] },
          },
        ],
      },
    });

    const sceneCountBefore = store.getState().project.scenes.length;
    store.getState().createScene(null);
    await wait(60);
    store.getState().updateEntityContent("e1", {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "NEW PARAGRAPHS" }] }],
    });
    await wait(60);

    store.getState().undo();
    await wait(80);

    return {
      prose: text(store.getState().project.entities[0].content),
      sceneCountBefore,
      sceneCountAfter: store.getState().project.scenes.length,
    };
  });

  check(
    "a structural undo keeps prose written on a character page",
    entityProse.prose.includes("NEW PARAGRAPHS"),
    entityProse.prose,
  );
  check(
    "and still undoes the structural change it was for",
    entityProse.sceneCountAfter === entityProse.sceneCountBefore,
    `${entityProse.sceneCountBefore} → ${entityProse.sceneCountAfter}`,
  );

  /* ════════════════════════════════════════════════════════════════
     4. A dialog owns the keyboard while it is up
     ════════════════════════════════════════════════════════════════
     Measured on v0.48.0: with Check Story open and a scene selected,
     Delete removed it behind the backdrop (content.length 4 → 3), and
     Ctrl+F moved focus into the Content panel's search box behind the
     scrim. */

  await seedProject();
  const behindModal = await api(async () => {
    const store = window.__scriareProjectStore;
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    const press = (init) =>
      document.body.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...init }));

    window.__scriareSelectionStore.setState({ surface: "content", contentIds: ["s3"], graphIds: [] });
    window.__scriareUIStore.getState().openStoryCheck();
    await wait(140);

    const before = store.getState().project.content.length;
    press({ key: "Delete" });
    await wait(140);
    const afterDelete = store.getState().project.content.length;

    const focusBefore = document.activeElement?.tagName ?? "none";
    press({ key: "f", ctrlKey: true });
    await wait(220);
    const focusAfter = document.activeElement?.tagName ?? "none";
    const placeholder = document.activeElement?.getAttribute?.("placeholder") ?? null;

    window.__scriareUIStore.getState().closeStoryCheck();
    await wait(120);

    // And the gate lifts again once the dialog is gone.
    press({ key: "Delete" });
    await wait(140);
    const afterClosing = store.getState().project.content.length;

    return { before, afterDelete, focusBefore, focusAfter, placeholder, afterClosing };
  });

  check(
    "Delete does not reach the selection behind an open dialog",
    behindModal.afterDelete === behindModal.before,
    `${behindModal.before} → ${behindModal.afterDelete}`,
  );
  check(
    "Ctrl+F does not steal focus into a panel behind the scrim",
    behindModal.placeholder === null,
    behindModal.placeholder ?? `focus stayed on ${behindModal.focusAfter}`,
  );
  check(
    "and the shortcuts work again the moment the dialog closes",
    behindModal.afterClosing < behindModal.before,
    `${behindModal.before} → ${behindModal.afterClosing}`,
  );

  /* ════════════════════════════════════════════════════════════════
     5. One document is open at a time
     ════════════════════════════════════════════════════════════════
     Measured on v0.48.0: with a character page open, "+ Scene" set
     `selectedSceneId` and left `selectedEntityId` alone — both non-null,
     and EditorGraphSplit resolves that tie as "entity wins", so the tree
     said one thing and the editor was another. */

  await seedProject();
  const oneOpen = await api(async () => {
    const store = window.__scriareProjectStore;
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    store.setState({
      project: {
        ...store.getState().project,
        entities: [{ id: "e1", kind: "character", name: "Kestrel", aliases: [], content: null }],
      },
    });
    store.getState().selectEntity("e1");
    await wait(60);
    const entityOpen = store.getState().selectedEntityId;

    store.getState().createScene(null);
    await wait(60);
    const after = store.getState();
    return {
      entityOpen,
      sceneId: after.selectedSceneId,
      entityId: after.selectedEntityId,
    };
  });

  check(
    "creating a scene while a character page is open closes the page",
    oneOpen.entityOpen === "e1" && oneOpen.sceneId !== null && oneOpen.entityId === null,
    `scene ${oneOpen.sceneId}, entity ${oneOpen.entityId}`,
  );

  /* ════════════════════════════════════════════════════════════════
     6. Find, and the document transforms
     ════════════════════════════════════════════════════════════════ */

  const text = await api(() => {
    const T = window.__scriareTextFold;
    const F = window.__scriareFind;
    const S = window.__scriareSpeakerLines;
    const G = window.__scriareGroupUtils;
    const store = window.__scriareProjectStore;
    const para = (t) => ({ type: "paragraph", content: [{ type: "text", text: t }] });

    // Multi-word Find. Measured on v0.48.0: [] for "the cat", and a false
    // positive for "ecat" spanning the space.
    const multiWord = T.foldedMatches("the cat sat", "the cat");
    const acrossSpace = T.foldedMatches("the cat sat", "ecat");
    // The apostrophe is a real character, not an accent, so folding keeps
    // it — a multi-word query has to carry it too. (Checked: the earlier
    // version of this assertion expected "istanbulda bir" to match and was
    // wrong about the text, not about the folding.)
    const turkish = T.foldedMatches("İstanbul'da bir gece", "istanbul'da bir");

    // Positions after a leaf node. Measured on v0.48.0: 27–33 where the
    // word sits at 26–32, off by one per divider.
    const probe = {
      ...store.getState().project,
      scenes: [
        {
          id: "d1",
          title: "Divider scene",
          content: {
            type: "doc",
            content: [para("Before the line"), { type: "horizontalRule" }, para("Second target here")],
          },
          position: { x: 0, y: 0 },
          order: 0,
        },
      ],
      content: [{ id: "d1", kind: "leaf", category: "story", parentId: null, order: 0, refType: "scene" }],
      entities: [],
    };
    const hit = (F.findInStory(probe, "target").hits ?? F.findInStory(probe, "target"))[0];

    // An empty spoken line must not swallow the name on the next one.
    // Measured on v0.48.0: ["Rain on the glass.", "", "I found it."]
    const entities = [{ id: "e1", kind: "character", name: "Mara", aliases: [], content: null }];
    const spoken = (t, speaker) => ({
      type: "paragraph",
      attrs: { speaker },
      content: t ? [{ type: "text", text: t }] : undefined,
    });
    const lines = S.applySpeakerPrefixes(
      { type: "doc", content: [para("Rain on the glass."), spoken("", "e1"), spoken("I found it.", "e1")] },
      entities,
    ).content.map((n) => (n.content ?? []).map((c) => c.text ?? "").join(""));

    // A folded chapter whose rectangle was derived rather than drawn.
    // Measured on v0.48.0: hidden [], standIn null — the box collapsed and
    // its scenes stayed on the canvas with their wires attached.
    const scenes = [
      { id: "s1", title: "One", content: { type: "doc", content: [para("a")] }, position: { x: 100, y: 100 }, order: 0 },
      { id: "s2", title: "Two", content: { type: "doc", content: [para("b")] }, position: { x: 400, y: 100 }, order: 1 },
    ];
    const content = [
      { id: "g1", kind: "folder", category: "story", parentId: null, order: 0, name: "Act One", collapsed: true },
      { id: "s1", kind: "leaf", category: "story", parentId: "g1", order: 0, refType: "scene" },
      { id: "s2", kind: "leaf", category: "story", parentId: "g1", order: 1, refType: "scene" },
    ];

    return {
      multiWord,
      acrossSpace,
      turkish,
      hit: hit ? { from: hit.from, to: hit.to } : null,
      lines,
      hidden: [...G.hiddenSceneIds({ content, scenes })].sort(),
      standIn: G.visibleStandIn({ content, scenes }, "s1"),
    };
  });

  check(
    "a search with a space in it finds the words",
    text.multiWord.length === 1 && text.multiWord[0].start === 0 && text.multiWord[0].end === 7,
    JSON.stringify(text.multiWord),
  );
  check(
    "and a search without the space no longer matches across one",
    text.acrossSpace.length === 0,
    JSON.stringify(text.acrossSpace),
  );
  check(
    "multi-word folding still works on Turkish",
    text.turkish.length === 1,
    JSON.stringify(text.turkish),
  );
  check(
    "a Find hit after a divider points at the right characters",
    text.hit !== null && text.hit.from === 26 && text.hit.to === 32,
    JSON.stringify(text.hit),
  );
  check(
    "an empty spoken line does not swallow the speaker's name",
    text.lines[2] === "Mara: I found it.",
    JSON.stringify(text.lines),
  );
  check(
    "and it still prints no name of its own",
    text.lines[1] === "",
    JSON.stringify(text.lines[1]),
  );
  check(
    "folding a chapter hides its scenes even when its box was derived",
    text.hidden.join(",") === "s1,s2",
    JSON.stringify(text.hidden),
  );
  check(
    "and their wires land on the box that is actually on screen",
    text.standIn === "g1",
    JSON.stringify(text.standIn),
  );

  /* ════════════════════════════════════════════════════════════════
     7. The save path
     ════════════════════════════════════════════════════════════════
     Driven through the REAL IPC against real files. `window.api` is
     frozen by contextBridge, so a stub assigned from here is a silent
     no-op — the first version of these two checks stubbed the save,
     watched nothing happen, and passed anyway. Worth recording: a test
     that cannot fail is worse than no test, and this one could only be
     caught by noticing it had nothing to say. */

  await seedProject();
  const savePaths = {
    a: join(tmpdir(), `scriare-save-a-${process.pid}.scriare`),
    b: join(tmpdir(), `scriare-save-b-${process.pid}.scriare`),
    close: join(tmpdir(), `scriare-close-${process.pid}.scriare`),
  };
  for (const file of Object.values(savePaths)) await rm(file, { force: true });

  const lateSave = await api(async (paths) => {
    const store = window.__scriareProjectStore;
    store.setState({ filePath: paths.a, fileStamp: null, saveStatus: "unsaved" });

    // Started and then abandoned IN THE SAME SYNCHRONOUS TURN: saveNow
    // suspends at its `await` on the IPC, which cannot resolve before this
    // line runs, so the switch is guaranteed to land mid-flight.
    const inFlight = store.getState().saveNow();
    store.setState({ filePath: paths.b, fileStamp: { mtimeMs: 999, size: 888 } });
    await inFlight;

    return { stamp: store.getState().fileStamp };
  }, savePaths);

  check(
    "a save that lands late does not stamp whichever project is open now",
    lateSave.stamp?.mtimeMs === 999 && lateSave.stamp?.size === 888,
    JSON.stringify(lateSave.stamp),
  );
  check(
    "and the file it was for was still written",
    await stat(savePaths.a).then(() => true, () => false),
    savePaths.a,
  );

  /* Closing the project writes what is pending rather than dropping it. */
  await seedProject();
  await api(async (file) => {
    const store = window.__scriareProjectStore;
    store.setState({ filePath: file, fileStamp: null, saveStatus: "unsaved" });
    await store.getState().closeProject();
  }, savePaths.close);

  const closed = await readFile(savePaths.close, "utf-8").catch(() => null);
  check(
    "closing the project writes the pending change first",
    closed !== null,
    closed === null ? "nothing was written" : `${closed.length} bytes`,
  );
  check(
    "and what it wrote is the project, not a fragment",
    closed !== null && JSON.parse(closed).scenes?.length === 3,
    closed === null ? "—" : `${JSON.parse(closed).scenes?.length} scenes`,
  );
  check(
    "the project is closed afterwards",
    (await api(() => window.__scriareProjectStore.getState().project)) === null,
  );

  for (const file of Object.values(savePaths)) {
    await rm(file, { force: true });
    await rm(`${file}.bak.1`, { force: true });
  }
}
