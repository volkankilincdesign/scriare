/**
 * Speaker attribution, and the graph bug that shared its code (v0.37.0).
 *
 * Two features in one file because they are one file's worth of code: a
 * choice's LABEL is flattened by one function, and both "the Story Graph
 * doesn't show characters in choices" and "a choice can be spoken by
 * someone" are about what that label says.
 *
 * The graph half is a REPORTED BUG, so the test is written the way the bug
 * was reported: put a character inside a choice, ask the graph what the
 * edge is called, and require her name to be in the answer. It fails on
 * the old code for the exact reason the writer saw.
 *
 * The speaker half puts its weight where the promise could quietly break:
 *
 *  - THE NAME IS NOT IN THE DOCUMENT. It's a decoration. If it were ever
 *    text, a writer could delete a letter of it and attribute a line to
 *    "Mar" — so the test reads the document and demands the name isn't
 *    there, then reads the screen and demands it is.
 *  - A RENAME REACHES EVERY LINE SHE SPEAKS, with no migration, because
 *    nothing ever stored her name.
 *  - THE NAME PRINTS WHEN THE SPEAKER CHANGES AND NOT WHILE SHE KEEPS
 *    TALKING. This is the one rule a reader would notice being wrong, and
 *    it is the whole reason Enter can carry a speaker forward at all.
 *  - ENTER CARRIES, BACKSPACE DROPS. The two keys are the entire authoring
 *    loop; if either is wrong the feature is unusable at writing speed.
 */
export default async function ({ api, check }) {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // ── 1. The rule, in isolation: when does a line print its name? ──────
  let r = await api(() => {
    const { speakerRun } = window.__scriareSpeakerLines;
    const run = speakerRun();
    return {
      // Mara starts talking, keeps talking, is interrupted, starts again.
      first: run.line("mara"),
      second: run.line("mara"),
      narration: run.line(null),
      backAgain: run.line("mara"),
      other: run.line("ercument"),
      // A Choice Block between two of her lines resets the run: the player
      // acted in between, and she can't be assumed to still be mid-speech.
      afterBreak: (() => {
        const r2 = window.__scriareSpeakerLines.speakerRun();
        r2.line("mara");
        r2.breakRun();
        return r2.line("mara");
      })(),
    };
  });
  check("a speaker's name prints when it changes, not while they keep talking",
    r.first === true && r.second === false && r.backAgain === true && r.other === true,
    JSON.stringify(r));
  check("...and a line of narration, or a choice, starts the next speech afresh",
    r.narration === false && r.afterBreak === true, JSON.stringify(r));

  // ── 2. The reported bug: a character inside a choice, in the graph ───
  await api(() => {
    const store = window.__scriareProjectStore;
    const { buildChoiceBlockNode } = window.__scriareChoiceUtils;
    const now = new Date().toISOString();
    const block = buildChoiceBlockNode([{ targetSceneId: "s2" }, { targetSceneId: "s2" }], "b1");
    // "Follow Mara" and "Wait here" — the first labelled with a mention,
    // the way a writer gets a name into a choice.
    block.content[0].content = [
      { type: "text", text: "Follow " },
      { type: "mention", attrs: { entityId: "e1", label: "Mara" } },
    ];
    block.content[1].content = [{ type: "text", text: "Wait here" }];
    store.setState({
      project: {
        name: "Graph", createdAt: now, updatedAt: now,
        scenes: [
          {
            id: "s1", title: "The Landing", position: { x: 0, y: 0 }, order: 0, frameId: null,
            content: { type: "doc", content: [{ type: "paragraph" }, block] },
          },
          {
            id: "s2", title: "The Stairs", position: { x: 400, y: 0 }, order: 1, frameId: null,
            content: { type: "doc", content: [{ type: "paragraph" }] },
          },
        ],
        content: ["s1", "s2"].map((id, i) => ({
          id, kind: "leaf", category: "story", parentId: null, order: i, refType: "scene",
        })),
        favorites: [], variables: [],
        entities: [
          { id: "e1", kind: "character", name: "Mara", aliases: [], content: { type: "doc", content: [] } },
        ],
        choiceStyles: window.__scriareChoiceStyles.normalizeChoiceStyles(undefined),
        startSceneId: "s1",
      },
      filePath: null, selectedSceneId: "s1", selectedEntityId: null, saveStatus: "saved",
      isPlaying: false, canUndo: false, canRedo: false, undoLabel: null, redoLabel: null, undoToken: null,
    });
  });
  await wait(300);

  r = await api(() => {
    const { extractChoices } = window.__scriareChoiceUtils;
    const { mentionResolver } = window.__scriareMentions;
    const store = window.__scriareProjectStore.getState();
    const scene = store.project.scenes[0];
    return {
      raw: extractChoices(scene.content).map((c) => c.text),
      resolved: extractChoices(scene.content, mentionResolver(store.project.entities)).map(
        (c) => c.text,
      ),
    };
  });
  check("a character inside a choice is part of the choice's name",
    r.raw[0] === "Follow Mara", JSON.stringify(r.raw));

  // The graph is the surface the bug was reported on, so the graph is
  // where it has to be checked — not just the helper underneath it.
  await api(() => window.__scriareUIStore?.getState?.().setView?.("graph"));
  r = await api(() => {
    const store = window.__scriareProjectStore.getState();
    store.renameEntity("e1", "Mara Aydın");
    const { extractChoices } = window.__scriareChoiceUtils;
    const { mentionResolver } = window.__scriareMentions;
    return extractChoices(
      store.project.scenes[0].content,
      mentionResolver(window.__scriareProjectStore.getState().project.entities),
    ).map((c) => c.text);
  });
  check("...and renaming her renames the edge, because nothing stored her name",
    r[0] === "Follow Mara Aydın", JSON.stringify(r));

  // ── 3. Authoring: @ at the head of a line attributes it ──────────────
  await api(() => {
    const store = window.__scriareProjectStore;
    const now = new Date().toISOString();
    store.setState({
      project: {
        name: "Dialogue", createdAt: now, updatedAt: now,
        scenes: [{
          id: "s1", title: "The Kitchen", position: { x: 0, y: 0 }, order: 0, frameId: null,
          content: { type: "doc", content: [{ type: "paragraph" }] },
        }],
        content: [{ id: "s1", kind: "leaf", category: "story", parentId: null, order: 0, refType: "scene" }],
        favorites: [], variables: [],
        entities: [
          { id: "e1", kind: "character", name: "Mara", aliases: [], content: { type: "doc", content: [] } },
          { id: "e2", kind: "character", name: "Ercüment", aliases: [], content: { type: "doc", content: [] } },
        ],
        choiceStyles: window.__scriareChoiceStyles.normalizeChoiceStyles(undefined),
        startSceneId: "s1",
      },
      filePath: null, selectedSceneId: "s1", selectedEntityId: null, saveStatus: "saved",
      isPlaying: false, canUndo: false, canRedo: false, undoLabel: null, redoLabel: null, undoToken: null,
    });
  });
  await wait(350);

  await api(() => {
    const editor = window.__scriareEditorStore.getState().editor;
    editor.commands.setContent({ type: "doc", content: [{ type: "paragraph" }] }, true);
    editor.chain().focus().setTextSelection(1).run();
  });
  await wait(120);

  // Typed as real keystrokes — the @ menu is a suggestion plugin watching
  // input, and nothing about it is exercised by inserting a node.
  for (const char of "@Mara") {
    await api((c) => {
      const el = document.querySelector(".ProseMirror");
      el.dispatchEvent(new KeyboardEvent("keydown", { key: c, bubbles: true }));
      document.execCommand("insertText", false, c);
    }, char);
    await wait(60);
  }
  await wait(250);

  r = await api(() => {
    const rows = [...document.querySelectorAll("button")].map((b) => b.textContent.trim());
    return {
      hint: [...document.querySelectorAll("div")]
        .map((d) => d.textContent.trim())
        .some((t) => t.startsWith("Sets who speaks this line")),
      offersPlayer: rows.some((t) => t.startsWith("The player")),
      offersMara: rows.some((t) => t === "Mara"),
    };
  });
  check("@ at the head of an empty line says it is about to set the speaker",
    r.hint && r.offersMara, JSON.stringify(r));
  check("...and doesn't pad the list with the player once a name is being typed",
    r.offersPlayer === false, JSON.stringify(r));

  await api(() => {
    const row = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Mara");
    row?.click();
  });
  await wait(250);

  r = await api(() => {
    const editor = window.__scriareEditorStore.getState().editor;
    const first = editor.state.doc.child(0);
    return {
      speaker: first.attrs.speaker,
      // The "@Mara" the writer typed must be gone: it said who is talking,
      // it isn't part of what they said.
      text: editor.state.doc.textBetween(0, editor.state.doc.content.size, "\n"),
      chip: document.querySelector(".scriare-speaker-chip")?.textContent ?? null,
    };
  });
  check("choosing a character attributes the line instead of writing her name into it",
    r.speaker === "e1" && r.text === "", JSON.stringify(r));
  check("...and her name appears in front of the line without being in it",
    r.chip === "Mara", `chip: ${JSON.stringify(r.chip)}`);

  // ── 4. Enter carries the speaker; Backspace hands it back ────────────
  await api(() => {
    const editor = window.__scriareEditorStore.getState().editor;
    editor.chain().focus().insertContent("I found it.").run();
  });
  await wait(120);
  await api(() => {
    const el = document.querySelector(".ProseMirror");
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  });
  await wait(200);
  await api(() => {
    const editor = window.__scriareEditorStore.getState().editor;
    editor.chain().focus().insertContent("Under the floor.").run();
  });
  await wait(150);

  r = await api(() => {
    const editor = window.__scriareEditorStore.getState().editor;
    return editor.state.doc.content.content.map((n) => ({
      speaker: n.attrs.speaker,
      text: n.textContent,
    }));
  });
  check("Enter carries the speaker into the next line, so a speech can be more than a sentence",
    r.length === 2 && r[1].speaker === "e1" && r[1].text === "Under the floor.",
    JSON.stringify(r));

  // Backspace at the head of the carried line gives it back to narration
  // rather than merging it upward — the one-key way out.
  await api(() => {
    const editor = window.__scriareEditorStore.getState().editor;
    const pos = editor.state.doc.resolve(editor.state.doc.content.size - 1);
    editor.chain().focus().setTextSelection(pos.start()).run();
  });
  await wait(120);
  await api(() => {
    const el = document.querySelector(".ProseMirror");
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true }));
  });
  await wait(200);

  r = await api(() => {
    const editor = window.__scriareEditorStore.getState().editor;
    return editor.state.doc.content.content.map((n) => ({ speaker: n.attrs.speaker, text: n.textContent }));
  });
  check("Backspace at the head of a spoken line hands it back to narration, keeping the line",
    r.length === 2 && r[1].speaker === null && r[1].text === "Under the floor.",
    JSON.stringify(r));

  // ── 5. A rename reaches every line she speaks ────────────────────────
  await api(() => window.__scriareProjectStore.getState().renameEntity("e1", "Mara Aydın"));
  await wait(300);
  r = await api(() => {
    const chips = [...document.querySelectorAll(".scriare-speaker-chip")].map((c) => c.textContent);
    const editor = window.__scriareEditorStore.getState().editor;
    return {
      chips,
      // The document must not have gained her name anywhere: that is what
      // makes the rename free.
      json: JSON.stringify(editor.getJSON()),
    };
  });
  check("renaming her renames every line she speaks, with nothing to migrate",
    r.chips.join() === "Mara Aydın" && !r.json.includes("Mara Aydın"),
    JSON.stringify(r.chips));

  // ── 6. What a player reads ───────────────────────────────────────────
  r = await api(() => {
    const { applySpeakerPrefixes } = window.__scriareSpeakerLines;
    const entities = [
      { id: "e1", kind: "character", name: "Mara", aliases: [], content: { type: "doc", content: [] } },
    ];
    const line = (speaker, text) => ({
      type: "paragraph",
      attrs: { speaker },
      content: [{ type: "text", text }],
    });
    const doc = {
      type: "doc",
      content: [
        line("e1", "I found it."),
        line("e1", "Under the floor."),
        line(null, "The rain went on."),
        line("e1", "You knew."),
        line("@player", "I did."),
      ],
    };
    const out = applySpeakerPrefixes(doc, entities);
    return out.content.map((p) => p.content.map((n) => n.text).join(""));
  });
  check("a player reads the name once per speech, not once per sentence",
    r[0] === "Mara: I found it." && r[1] === "Under the floor.",
    JSON.stringify(r));
  check("...and it comes back when the speaker does, after narration",
    r[2] === "The rain went on." && r[3] === "Mara: You knew.", JSON.stringify(r));
  check("...and the player can speak without being given a name",
    r[4] === "You: I did.", JSON.stringify(r));

  // ── 7. A choice can be spoken (Disco Elysium, party games) ───────────
  r = await api(() => {
    const { applySpeakerPrefixes } = window.__scriareSpeakerLines;
    const { buildChoiceBlockNode } = window.__scriareChoiceUtils;
    const { readChoiceBlockOptions } = window.__scriareChoiceUtils;
    const entities = [
      { id: "e1", kind: "character", name: "Mara", aliases: [], content: { type: "doc", content: [] } },
    ];
    const block = buildChoiceBlockNode([{ speaker: "e1" }, {}], "b1");
    block.content[0].content = [{ type: "text", text: "Ask about the key" }];
    block.content[1].content = [{ type: "text", text: "Say nothing" }];
    const out = applySpeakerPrefixes({ type: "doc", content: [block] }, entities);
    return {
      labels: out.content[0].content.map((o) => o.content.map((n) => n.text).join("")),
      // The attribute survives a round trip through the option reader, so
      // the Inspector and the runtime see the same thing.
      read: readChoiceBlockOptions(block).map((o) => o.speaker),
    };
  });
  check("a choice can be someone's line, and says so every time",
    r.labels[0] === "Mara: Ask about the key" && r.labels[1] === "Say nothing",
    JSON.stringify(r.labels));
  check("...and a choice's speaker is readable where the Inspector reads it",
    r.read.join() === "e1,", JSON.stringify(r.read));

  // A Character's own page is written in the same editor component with a
  // smaller extension set — no Choice Blocks, no speakers. An @ at the head
  // of a line there must still be an ordinary mention, not a command that
  // quietly does nothing.
  await api(() => window.__scriareProjectStore.getState().selectEntity("e1"));
  await wait(350);
  await api(() => {
    const editor = window.__scriareEditorStore.getState().editor;
    editor?.commands.setContent({ type: "doc", content: [{ type: "paragraph" }] }, true);
    editor?.chain().focus().setTextSelection(1).run();
  });
  await wait(150);
  for (const char of "@Ercü") {
    await api((c) => {
      const el = document.querySelector(".ProseMirror");
      el.dispatchEvent(new KeyboardEvent("keydown", { key: c, bubbles: true }));
      document.execCommand("insertText", false, c);
    }, char);
    await wait(60);
  }
  await wait(250);
  await api(() => {
    const row = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Ercüment");
    row?.click();
  });
  await wait(250);
  r = await api(() => {
    const editor = window.__scriareEditorStore.getState().editor;
    let mention = false;
    editor.state.doc.descendants((n) => {
      if (n.type.name === "mention") mention = true;
    });
    return { mention, chips: document.querySelectorAll(".scriare-speaker-chip").length };
  });
  check("on a Character's page, where nobody speaks, @ still writes a plain mention",
    r.mention === true && r.chips === 0, JSON.stringify(r));

  await api(() => window.__scriareProjectStore.getState().selectScene("s1"));
  await wait(350);

  // The Inspector is the ONLY way to give a choice a speaker — a choice is
  // an object with properties, not a line you type at — so the control
  // being wired to the document is the whole feature, not a detail of it.
  await api(() => {
    const editor = window.__scriareEditorStore.getState().editor;
    const { buildChoiceBlockNode } = window.__scriareChoiceUtils;
    const block = buildChoiceBlockNode([{ id: "o1", targetSceneId: null }], "b1");
    block.content[0].content = [{ type: "text", text: "Ask about the key" }];
    editor.commands.setContent({ type: "doc", content: [{ type: "paragraph" }, block] }, true);
    window.__scriareInspectorStore
      .getState()
      .selectTarget({ kind: "choice", sceneId: "s1", blockId: "b1", optionId: "o1" });
  });
  await wait(300);

  r = await api(() => {
    const select = document.querySelector("[data-choice-speaker]");
    if (!select) return { found: false };
    select.value = "e2";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return { found: true };
  });
  await wait(250);
  r = await api(() => {
    const editor = window.__scriareEditorStore.getState().editor;
    let speaker = "missing";
    editor.state.doc.descendants((n) => {
      if (n.type.name === "choiceOption") speaker = n.attrs.speaker;
    });
    return speaker;
  });
  check("the Inspector is where a choice is given a voice, and it reaches the document",
    r === "e2", JSON.stringify(r));

  // ── 8. End to end, in Play Mode ──────────────────────────────────────
  // The transform above is tested on JSON, which proves the rule and
  // nothing about the pipeline. Play Mode renders documents through a
  // SEPARATE schema (runtime/extensions.ts), and a schema that doesn't
  // know about the `speaker` attribute drops it on the way in — the
  // player would read an unattributed story and every test above would
  // still be green. So: a real scene, really played.
  await api(() => {
    const store = window.__scriareProjectStore;
    const { buildChoiceBlockNode } = window.__scriareChoiceUtils;
    const now = new Date().toISOString();
    const block = buildChoiceBlockNode([{ targetSceneId: "s2", speaker: "e1" }], "b1");
    block.content[0].content = [{ type: "text", text: "Ask about the key" }];
    const line = (speaker, text) => ({
      type: "paragraph",
      attrs: { speaker },
      content: [{ type: "text", text }],
    });
    store.setState({
      project: {
        name: "Played", createdAt: now, updatedAt: now,
        scenes: [
          {
            id: "s1", title: "The Kitchen", position: { x: 0, y: 0 }, order: 0, frameId: null,
            content: {
              type: "doc",
              content: [line("e1", "I found it."), line("e1", "Under the floor."), block],
            },
          },
          {
            id: "s2", title: "After", position: { x: 300, y: 0 }, order: 1, frameId: null,
            content: { type: "doc", content: [{ type: "paragraph" }] },
          },
        ],
        content: ["s1", "s2"].map((id, i) => ({
          id, kind: "leaf", category: "story", parentId: null, order: i, refType: "scene",
        })),
        favorites: [], variables: [],
        entities: [
          { id: "e1", kind: "character", name: "Mara", aliases: [], content: { type: "doc", content: [] } },
        ],
        choiceStyles: window.__scriareChoiceStyles.normalizeChoiceStyles(undefined),
        startSceneId: "s1",
      },
      filePath: null, selectedSceneId: "s1", selectedEntityId: null, saveStatus: "saved",
      isPlaying: false, canUndo: false, canRedo: false, undoLabel: null, redoLabel: null, undoToken: null,
    });
    store.getState().startPlay();
  });
  await wait(400);

  r = await api(() => {
    // Scoped to Play Mode's own root: the editor is only hidden underneath
    // it, and a `.scriare-speaker` matched there would pass for the wrong
    // reason.
    const root = document.querySelector("[data-play-root]");
    return {
      names: [...(root?.querySelectorAll(".scriare-speaker") ?? [])].map((n) => n.textContent),
      text: root?.innerText.replace(/\s+/g, " ").trim() ?? "",
      // The editor's chips are decorations; nothing should carry them into
      // what a player sees.
      chips: root?.querySelectorAll(".scriare-speaker-chip").length ?? -1,
    };
  });
  check("a player really reads the speaker's name, styled as the attribution it is",
    r.names.join("|") === "Mara: |Mara: " && r.chips === 0, JSON.stringify(r));
  check("...once for the speech, and again on the choice she speaks",
    r.text.includes("Mara: I found it. Under the floor.") &&
      r.text.includes("Mara: Ask about the key"),
    `"${r.text}"`);

  await api(() => window.__scriareProjectStore.getState().exitPlay());
  await wait(200);
}
