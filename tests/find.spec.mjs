/**
 * Find across the story (v0.38.0).
 *
 * The weight is on the two things that make this a real Find rather than a
 * filtered list:
 *
 *  - IT FINDS WHAT'S THERE, IN TURKISH. Half of what Volkan writes is
 *    Turkish, and the dotted/dotless i breaks the obvious implementation in
 *    both directions — `ist` must reach "İstanbul" and `aydin` must reach
 *    "Aydın". The @ menu already solved this; the point of the test is that
 *    Find solved it the SAME way, from the same function, so the two can't
 *    disagree about what counts as the same word.
 *
 *  - CLICKING A RESULT LANDS ON THE WORDS. Anything can list matches. The
 *    expensive, breakable part is that a hit in a scene you don't have
 *    open turns into a caret sitting on those exact characters — which
 *    means the positions computed from stored JSON have to be the
 *    positions ProseMirror agrees with. A mention is where that goes
 *    wrong: it reads as eight characters and occupies one, so a match
 *    after one is off by seven unless the arithmetic is right.
 */
export default async function ({ api, check }) {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // ── The folding, and the index map it has to carry ───────────────────
  let r = await api(() => {
    const { fold, foldedMatches } = window.__scriareTextFold;
    const hits = (text, q) => foldedMatches(text, q).map((m) => text.slice(m.start, m.end));
    return {
      turkishUp: hits("Gece İstanbul'da yağmur vardı.", "ist"),
      turkishDown: hits("Dr. Aydın kapıyı açtı.", "aydin"),
      accents: hits("Ercüment geldi.", "ercument"),
      caseBoth: hits("MARA. mara. Mara.", "mara").length,
      // Overlapping matches are one match, the way a reader would count.
      overlap: hits("aaa", "aa").length,
      empty: hits("anything", "   ").length,
      folded: fold("İSTANBUL"),
      // Text that arrives DECOMPOSED — pasted from a browser, a PDF, or
      // another editor — is where an index map stops being pedantry. Here
      // "ü" is two code points and folds to one, so every index after it
      // is a character out unless the match is mapped back rather than
      // measured. The match must still be the writer's own characters,
      // combining marks and all.
      decomposed: hits("C\u0327ok gu\u0308zel bir gece", "guzel"),
      decomposedTail: hits("C\u0327ok gu\u0308zel bir gece", "gece"),
    };
  });
  check("Find reads Turkish the way the @ menu does, in both directions",
    r.turkishUp.join() === "İst" && r.turkishDown.join() === "Aydın",
    JSON.stringify(r));
  check("...and across accents and case",
    r.accents.join() === "Ercüment" && r.caseBoth === 3, JSON.stringify(r));
  check("...while counting occurrences the way a reader would",
    r.overlap === 1 && r.empty === 0, JSON.stringify(r));

  // The index map is the part that can be quietly wrong: folding is not
  // length-preserving, so a folded index is not an original index.
  check("a match is reported where the writer's own characters are, not where the folded ones are",
    r.turkishUp.join() === "İst", `got ${JSON.stringify(r.turkishUp)}`);
  check("...including in decomposed text, where one letter is two characters",
    r.decomposed.join() === "gu\u0308zel" && r.decomposedTail.join() === "gece",
    JSON.stringify({ d: r.decomposed, t: r.decomposedTail }));

  // ── A story to search ────────────────────────────────────────────────
  await api(() => {
    const store = window.__scriareProjectStore;
    const { buildChoiceBlockNode } = window.__scriareChoiceUtils;
    const now = new Date().toISOString();
    const block = buildChoiceBlockNode([{ id: "o1", targetSceneId: "s2" }], "b1");
    block.content[0].content = [{ type: "text", text: "Follow her to İstanbul" }];
    const p = (...content) => ({ type: "paragraph", content });
    store.setState({
      project: {
        name: "Find", createdAt: now, updatedAt: now,
        scenes: [
          {
            id: "s1", title: "The Landing", position: { x: 0, y: 0 }, order: 0, frameId: null,
            content: {
              type: "doc",
              content: [
                // A mention BEFORE the word being searched for: it reads as
                // eight characters and occupies one, so everything after it
                // is where the arithmetic either holds or doesn't.
                p(
                  { type: "mention", attrs: { entityId: "e1", label: "Ercüment" } },
                  { type: "text", text: " bekledi. Gece yağmur vardı." },
                ),
                block,
              ],
            },
          },
          {
            id: "s2", title: "Gece Yarısı", position: { x: 400, y: 0 }, order: 1, frameId: null,
            content: { type: "doc", content: [p({ type: "text", text: "Nothing happens here." })] },
          },
        ],
        content: ["s1", "s2"].map((id, i) => ({
          id, kind: "leaf", category: "story", parentId: null, order: i, refType: "scene",
        })),
        favorites: [], variables: [],
        entities: [
          {
            id: "e1", kind: "character", name: "Ercüment", aliases: [],
            content: { type: "doc", content: [p({ type: "text", text: "Gece çalışır, gündüz uyur." })] },
          },
        ],
        choiceStyles: window.__scriareChoiceStyles.normalizeChoiceStyles(undefined),
        startSceneId: "s1",
      },
      filePath: null, selectedSceneId: "s1", selectedEntityId: null, saveStatus: "saved",
      isPlaying: false, canUndo: false, canRedo: false, undoLabel: null, redoLabel: null, undoToken: null,
    });
  });
  await wait(400);
  // One app instance runs every spec, and the editor only reloads when the
  // selected scene CHANGES — so a scene called s1 in the previous spec
  // leaves its content in place here. Loading it explicitly is what makes
  // the position check below a check of this document.
  await api(() => {
    const store = window.__scriareProjectStore.getState();
    window.__scriareEditorStore
      .getState()
      .editor.commands.setContent(store.project.scenes[0].content, true);
  });
  await wait(250);

  r = await api(() => {
    const { findInStory } = window.__scriareFind;
    const project = window.__scriareProjectStore.getState().project;
    const run = (q) =>
      findInStory(project, q).hits.map((h) => `${h.kind}:${h.where}:${h.snippet}`);
    return {
      gece: run("gece"),
      istanbul: run("istanbul"),
      // A character's name is part of the line she's named in — the same
      // omission that hid her from the Story Graph until v0.37.0.
      byName: run("ercüment").length,
      nothing: run("zzzz").length,
    };
  });
  check("Find reaches the prose in scenes and the prose on pages alike",
    r.gece.length === 2 &&
      r.gece.some((h) => h.startsWith("prose:The Landing")) &&
      r.gece.some((h) => h.startsWith("prose:Ercüment")),
    JSON.stringify(r.gece));
  // The scene CALLED "Gece Yarısı" is deliberately absent from these hits:
  // a title is answered by the tree above them, and answering it twice in
  // one panel is how a results list stops being readable. The panel check
  // further down is where both halves are seen together.
  check("...and leaves scene titles to the filter that has always matched them",
    !r.gece.some((h) => h.includes("Gece Yarısı")), JSON.stringify(r.gece));
  check("...including a choice's label",
    r.istanbul.length === 1 && r.istanbul[0].startsWith("choice:The Landing"),
    JSON.stringify(r.istanbul));
  check("...and a character named in a line is part of that line",
    r.byName === 2, `hits for her name: ${r.byName}`);
  check("a query nothing matches finds nothing", r.nothing === 0);

  // ── The positions have to be ProseMirror's ───────────────────────────
  // Computed from stored JSON; checked against the live editor, which is
  // the only authority. A mention sits before the match on purpose.
  r = await api(() => {
    const { findInStory } = window.__scriareFind;
    const store = window.__scriareProjectStore.getState();
    const hit = findInStory(store.project, "yağmur").hits.find((h) => h.sceneId === "s1");
    const editor = window.__scriareEditorStore.getState().editor;
    return {
      hit: hit ? { from: hit.from, to: hit.to } : null,
      inTheEditor: hit ? editor.state.doc.textBetween(hit.from, hit.to) : null,
    };
  });
  check("a position computed from the stored document is the position the editor agrees with",
    r.inTheEditor === "yağmur", JSON.stringify(r));

  // ── End to end, through the panel ────────────────────────────────────
  await api(() => window.__scriareProjectStore.getState().selectScene("s2"));
  await wait(250);
  await api(() => {
    // The real key, not the store call behind it: the shortcut is the
    // feature, and a test that pokes the store would stay green with no
    // shortcut at all.
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "f", ctrlKey: true, bubbles: true, cancelable: true }),
    );
  });
  await wait(250);
  r = await api(() => {
    const input = document.querySelector("[data-find-input]");
    return { present: Boolean(input), focused: document.activeElement === input };
  });
  check("Ctrl+F puts the caret in the search box", r.present && r.focused, JSON.stringify(r));

  await api(() => {
    const input = document.querySelector("[data-find-input]");
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    setter.call(input, "yağmur");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await wait(350);
  r = await api(() => {
    const results = document.querySelector("[data-find-results]");
    return {
      sections: [...document.querySelectorAll("[data-find-section]")].map((s) =>
        s.getAttribute("data-find-section"),
      ),
      hits: [...(results?.querySelectorAll("[data-find-hit]") ?? [])].map((b) => b.textContent),
      marks: [...(results?.querySelectorAll(".scriare-find-mark") ?? [])].map((m) => m.textContent),
    };
  });
  check("typing in the box lists the matches, with the matched words marked",
    r.hits.length === 1 && r.marks.join() === "yağmur" && r.sections.join() === "In the story",
    JSON.stringify(r));

  // One box, two questions: which scenes are CALLED this, and where the
  // words appear. A query that answers both has to show both.
  await api(() => {
    const input = document.querySelector("[data-find-input]");
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    setter.call(input, "gece");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await wait(350);
  r = await api(() => {
    const panel = document.querySelector("aside");
    const results = document.querySelector("[data-find-results]");
    return {
      // The scene named Gece Yarısı, from the tree's own filter.
      named: panel?.textContent.includes("Gece Yarısı") ?? false,
      written: [...(results?.querySelectorAll("[data-find-hit]") ?? [])].length,
      sections: [...document.querySelectorAll("[data-find-section]")].map((x) =>
        x.getAttribute("data-find-section"),
      ),
    };
  });
  check("one box answers both questions: the scene by that name, and the lines with those words",
    r.named && r.written === 2 && r.sections.join() === "In the story,On pages",
    JSON.stringify(r));

  await api(() => {
    const input = document.querySelector("[data-find-input]");
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    setter.call(input, "yağmur");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await wait(350);

  await api(() => {
    document.querySelector("[data-find-hit]")?.click();
  });
  await wait(450);
  r = await api(() => {
    const store = window.__scriareProjectStore.getState();
    const editor = window.__scriareEditorStore.getState().editor;
    const { from, to } = editor.state.selection;
    return {
      scene: store.selectedSceneId,
      selected: editor.state.doc.textBetween(from, to),
      // The panel must still be showing its results — that's the whole
      // reason it's a panel and not a dialog.
      stillListed: document.querySelectorAll("[data-find-hit]").length,
    };
  });
  check("clicking a result opens that scene and selects the words themselves",
    r.scene === "s1" && r.selected === "yağmur", JSON.stringify(r));
  check("...and the list is still there for the next one",
    r.stillListed === 1, `rows left: ${r.stillListed}`);

  // A hit on a page goes to the page, not to a scene.
  await api(() => {
    const input = document.querySelector("[data-find-input]");
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    setter.call(input, "gündüz");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await wait(350);
  r = await api(() => ({
    sections: [...document.querySelectorAll("[data-find-section]")].map((s) =>
      s.getAttribute("data-find-section"),
    ),
  }));
  check("a hit in someone's notes is filed under pages, not mixed in with the story",
    r.sections.join() === "On pages", JSON.stringify(r));

  await api(() => document.querySelector("[data-find-hit]")?.click());
  await wait(450);
  r = await api(() => {
    const store = window.__scriareProjectStore.getState();
    const editor = window.__scriareEditorStore.getState().editor;
    const { from, to } = editor.state.selection;
    return { entity: store.selectedEntityId, selected: editor.state.doc.textBetween(from, to) };
  });
  check("...and clicking it opens the page with the words selected",
    r.entity === "e1" && r.selected === "gündüz", JSON.stringify(r));
}
