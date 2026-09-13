/**
 * Characters, Locations and @ mentions (v0.35.0).
 *
 * The promise this version makes is narrow and specific: a mention is a
 * REFERENCE, not a copy. Rename a character and every sentence she appears
 * in says the new name — in the editor and for the player — because none of
 * those sentences ever stored the old one.
 *
 * So the weight is on the cases where that promise could quietly break:
 *
 *  - A RENAME MUST REACH PLAY MODE. The editor's node view reads the store
 *    live, so it can't be wrong; the runtime renders documents to HTML,
 *    where the node's own attributes are all there is. That's the half
 *    that can rot, and it's the half a player sees.
 *  - AN ALIAS MUST STAY THE ALIAS. A writer who typed "the doctor" meant
 *    it. Collapsing every mention into one canonical name would quietly
 *    rewrite their prose.
 *  - A DELETED ENTITY MUST LEAVE THE SENTENCE READABLE. Deleting a
 *    character must never blank out words in a scene.
 *
 * The matching rules are tested directly because they're pure, and because
 * "@ist finds İstanbul" is the kind of thing that works in English and
 * breaks in Turkish, which is the language half this app is written in.
 */
export default async function ({ api, check, seedProject }) {
  // ── The pure rules ───────────────────────────────────────────────────
  let r = await api(() => {
    const { matchEntities, bestNameFor } = window.__scriareEntities;
    const mara = {
      id: "e1", kind: "character", name: "Mara", aliases: ["the doctor", "Dr. Aydın"],
      content: { type: "doc", content: [] },
    };
    const istanbul = {
      id: "e2", kind: "location", name: "İstanbul", aliases: [],
      content: { type: "doc", content: [] },
    };
    const all = [mara, istanbul];
    const ids = (q) => matchEntities(all, q).map((e) => e.id);
    return {
      byName: ids("Mar"),
      byAlias: ids("the doc"),
      caseInsensitive: ids("MARA"),
      // The dotted/dotless i is exactly where a naive toLowerCase() fails.
      turkish: ids("ist"),
      accents: ids("dr. aydin"),
      midWord: ids("ara"),
      empty: ids("").length,
      // Reaching her by an alias should write that alias, not her name.
      aliasLabel: bestNameFor(mara, "the doc"),
      nameLabel: bestNameFor(mara, "Mar"),
    };
  });
  check("@ matches a name, an alias, and ignores case",
    r.byName.join() === "e1" && r.byAlias.join() === "e1" && r.caseInsensitive.join() === "e1",
    JSON.stringify(r));
  check("...and matches across Turkish casing and accents",
    r.turkish.join() === "e2" && r.accents.join() === "e1",
    `ist → ${JSON.stringify(r.turkish)}, dr. aydin → ${JSON.stringify(r.accents)}`);
  check("...but not the middle of a word, which would fill the menu with noise",
    r.midWord.length === 0 && r.empty === 2, JSON.stringify(r.midWord));
  check("reaching someone by an alias writes that alias",
    r.aliasLabel === "the doctor" && r.nameLabel === "Mara",
    `${r.aliasLabel} / ${r.nameLabel}`);

  // 2 — what a mention shows, in each of the states it can be in.
  r = await api(() => {
    const { mentionLabel } = window.__scriareEntities;
    const mara = {
      id: "e1", kind: "character", name: "Mara Aydın", aliases: ["the doctor"],
      content: { type: "doc", content: [] },
    };
    return {
      written: mentionLabel(mara, "the doctor"),
      renamed: mentionLabel(mara, "Mara"),
      deleted: mentionLabel(undefined, "Mara"),
    };
  });
  check("an alias stays as written; a stale name falls back to the current one",
    r.written === "the doctor" && r.renamed === "Mara Aydın", JSON.stringify(r));
  check("a mention of a deleted entity still reads as the words that were written",
    r.deleted === "Mara", `got "${r.deleted}"`);

  // ── End to end ───────────────────────────────────────────────────────
  // 3 — type @ mid-sentence, create the character from the menu, and keep
  // writing. This is the gesture the whole feature exists for.
  await api(() => {
    const store = window.__scriareProjectStore;
    const now = new Date().toISOString();
    store.setState({
      project: {
        name: "Cast", createdAt: now, updatedAt: now,
        scenes: [{
          id: "s1", title: "The Locked Door", position: { x: 0, y: 0 }, order: 0,
          content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Behind it, " }] }] },
        }],
        content: [{ id: "s1", kind: "leaf", category: "story", parentId: null, order: 0, refType: "scene" }],
        favorites: [], variables: [], entities: [],
        choiceStyles: window.__scriareChoiceStyles.normalizeChoiceStyles(undefined),
        startSceneId: "s1",
      },
      filePath: null, selectedSceneId: "s1", selectedEntityId: null, saveStatus: "saved",
      isPlaying: false, canUndo: false, canRedo: false, undoLabel: null, redoLabel: null, undoToken: null,
    });
  });
  await new Promise((resolve) => setTimeout(resolve, 350));

  r = await api(() => {
    const editor = window.__scriareEditorStore.getState().editor;
    editor.commands.setContent(
      { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Behind it, " }] }] },
      true,
    );
    return Boolean(editor);
  });
  check("the writing surface is ready", r === true);

  // Typed as real keystrokes: the @ menu is a suggestion plugin watching
  // input, and nothing about it is exercised by inserting a node directly.
  await api(() => {
    const editor = window.__scriareEditorStore.getState().editor;
    editor.chain().focus().setTextSelection(editor.state.doc.content.size - 1).run();
  });
  await new Promise((resolve) => setTimeout(resolve, 120));
  await (async () => {
    for (const char of "@Mara") {
      await api((c) => {
        const el = document.querySelector(".ProseMirror");
        el.dispatchEvent(new KeyboardEvent("keydown", { key: c, bubbles: true }));
        document.execCommand("insertText", false, c);
      }, char);
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
  })();
  await new Promise((resolve) => setTimeout(resolve, 250));

  r = await api(() =>
    [...document.querySelectorAll("button")]
      .map((b) => b.textContent.trim())
      .filter((t) => t.startsWith("Create")),
  );
  check("typing @ offers to create what isn't there yet",
    r.some((t) => t.includes("Create character Mara")) &&
      r.some((t) => t.includes("Create location Mara")),
    JSON.stringify(r));

  r = await api(() => {
    const create = [...document.querySelectorAll("button")].find((b) =>
      b.textContent.trim().startsWith("Create character"),
    );
    create?.click();
    return true;
  });
  await new Promise((resolve) => setTimeout(resolve, 250));

  r = await api(() => {
    const store = window.__scriareProjectStore.getState();
    const editor = window.__scriareEditorStore.getState().editor;
    return {
      entities: store.project.entities.map((e) => `${e.kind}:${e.name}`),
      // Filed in the tree, under its own category.
      leaf: store.project.content.find((n) => n.refType === "character")?.category ?? null,
      // Creating from mid-sentence must NOT navigate away.
      stillInScene: store.selectedSceneId === "s1" && store.selectedEntityId === null,
      // `textBetween` skips atom nodes unless told how to read them — a
      // mention has no text content of its own, which is the point.
      text: editor.state.doc.textBetween(
        0,
        editor.state.doc.content.size,
        " ",
        (node) => String(node.attrs.label ?? ""),
      ),
      isMentionNode: (() => {
        let found = false;
        editor.state.doc.descendants((n) => {
          if (n.type.name === "mention") found = true;
        });
        return found;
      })(),
    };
  });
  check("creating from the menu makes a real character, filed in Characters",
    r.entities.join() === "character:Mara" && r.leaf === "characters", JSON.stringify(r));
  check("...without taking the writer out of the sentence they were in", r.stillInScene);
  check("...and what lands in the prose is a mention, not typed text",
    r.isMentionNode && r.text.includes("Mara"), `"${r.text}"`);

  // 4 — the promise: rename her, and the sentence follows. Everywhere.
  await api(() => {
    const store = window.__scriareProjectStore.getState();
    store.renameEntity(store.project.entities[0].id, "Mara Aydın");
  });
  await new Promise((resolve) => setTimeout(resolve, 250));
  r = await api(() => document.querySelector(".ProseMirror").innerText.trim());
  check("renaming a character rewrites nothing, and every scene says the new name",
    r.includes("Mara Aydın"), `editor reads: "${r}"`);

  await api(() => window.__scriareProjectStore.getState().startPlay());
  await new Promise((resolve) => setTimeout(resolve, 300));
  r = await api(() => {
    // Scoped to Play Mode's own root: the editor is merely hidden during
    // Play, and its copy of the sentence is already correct, so an
    // unscoped query passes whatever the runtime does.
    const root = document.querySelector("[data-play-root]");
    return [...(root?.querySelectorAll(".prose") ?? [])]
      .map((el) => el.innerText.trim())
      .join(" | ");
  });
  check("...including for the player, who reads rendered HTML rather than the live document",
    r.includes("Mara Aydın"), `play mode reads: "${r}"`);
  await api(() => window.__scriareProjectStore.getState().exitPlay());
  await new Promise((resolve) => setTimeout(resolve, 200));

  // 5 — backlinks are derived, so they can't disagree with the documents.
  r = await api(() => {
    const project = window.__scriareProjectStore.getState().project;
    const id = project.entities[0].id;
    return window.__scriareMentions.mentionSites(project, id);
  });
  check("her page knows which scenes she appears in",
    r.length === 1 && r[0].kind === "scene" && r[0].title === "The Locked Door" && r[0].count === 1,
    JSON.stringify(r));

  // 6 — deleting her must not blank out anyone's prose.
  r = await api(() => {
    const store = window.__scriareProjectStore.getState();
    store.deleteEntity(store.project.entities[0].id);
    return {
      entities: window.__scriareProjectStore.getState().project.entities.length,
      leftInTree: window.__scriareProjectStore
        .getState()
        .project.content.filter((n) => n.refType === "character").length,
      text: document.querySelector(".ProseMirror").innerText.trim(),
    };
  });
  await new Promise((resolve) => setTimeout(resolve, 200));
  check("deleting a character removes it from the tree",
    r.entities === 0 && r.leftInTree === 0, JSON.stringify(r));
  check("...and leaves the sentence she was in exactly as written",
    r.text.includes("Mara"), `"${r.text}"`);

  await seedProject();
}
