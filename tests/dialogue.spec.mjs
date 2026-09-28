/**
 * The Dialogue (v0.66.0) — a conversation that stays on the page.
 *
 * THE SAME RULES ARE CHECKED TWICE, in Play Mode and in the exported page,
 * because they are written twice: the app's runtime is React and the
 * export's is plain JavaScript in a file with no framework and no network.
 * That second implementation is the honest risk in this feature, and it is
 * the reason the negative controls for it break the EXPORT specifically
 * rather than the app — a control that only breaks the app would leave the
 * riskier half untested while looking thorough.
 *
 * The three rules, from board M / claude/dialogue-m2.md:
 *   1. said is spent
 *   2. every line has an after — stay, end, leave
 *   3. the page waits
 */
export default async function run({ page, api, check, seedProject, openExported }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ── a scene with beats: prose, a conversation, prose, a choice ───────
  await api(() => {
    const store = window.__scriareProjectStore;
    const { buildDialogueBlockNode } = window.__scriareDialogue;
    const { buildChoiceBlockNode } = window.__scriareChoiceUtils;
    const project = store.getState().project;

    const talk = project.scenes[0];
    const after = project.scenes[1];

    const para = (text) => ({
      type: "paragraph",
      attrs: { lineId: `p-${text.slice(0, 6)}` },
      content: [{ type: "text", text }],
    });

    const block = buildDialogueBlockNode(
      [
        { id: "l-short", text: "How short are you?", reply: "Nine. Out of a hundred and forty." },
        { id: "l-six", text: "Who are the six?", reply: "People who will do what you do.", repeatable: true },
        {
          id: "l-gated",
          text: "And if it fails?",
          reply: "She has not let herself finish that sentence.",
          conditions: [{ id: "c1", variableId: "v-nerve", comparator: "gte", value: 2 }],
          whenUnmet: "lock",
        },
        { id: "l-end", text: "I have to think about it.", reply: "Think at the table.", after: "end" },
        { id: "l-go", text: "I am going back to the floor.", after: "leave", targetSceneId: after.id },
      ],
      "blk-talk",
    );

    // v0.67.0 — the scene's own selection first, so the editor is mounted
    // on the scene this spec is about before anything writes to it.
    store.getState().selectScene(talk.id);

    window.__dialogueSeedDoc = {
      type: "doc",
      content: [
        para("Nesrin does not look up when you sit down."),
        block,
        para("The urn gives out at half past nine."),
        buildChoiceBlockNode(
          [{ id: "after-1", text: "Go down to the floor.", targetSceneId: after.id }],
          "blk-after",
        ),
      ],
    };

    store.setState({
      project: {
        ...project,
        variables: [{ id: "v-nerve", name: "nerve", type: "number", defaultValue: 0 }],
        startSceneId: talk.id,
        scenes: project.scenes.map((s) =>
          s.id === talk.id
            ? {
                ...s,
                content: {
                  type: "doc",
                  content: [
                    para("Nesrin does not look up when you sit down."),
                    block,
                    para("The urn gives out at half past nine."),
                    buildChoiceBlockNode(
                      [{ id: "after-1", text: "Go down to the floor.", targetSceneId: after.id }],
                      "blk-after",
                    ),
                  ],
                },
              }
            : s,
        ),
      },
    });
  });
  await wait(300);

  // v0.67.0 — and THROUGH THE EDITOR, which is the scene content's only
  // writer in this app.
  //
  // A store-only seed is a second writer. It survived for as long as this
  // spec happened to follow one that left the editor empty; the moment
  // dialogue-parity.spec landed alphabetically in front of it, the editor
  // was still holding that spec's document and its next update wrote the
  // conversation straight back out of the store. The failure read as
  // "Play shows nothing" and had nothing to do with Play.
  //
  // Rebuilt here rather than copied out of the store, because by now the
  // store may already have been overwritten by the editor it is racing.
  await api(() => {
    const store = window.__scriareProjectStore;
    const editor = window.__scriareEditorStore.getState().editor;
    const scene = store.getState().project.scenes.find((s) => s.id === store.getState().project.startSceneId);
    if (!editor || !scene) return;
    editor.commands.setContent(window.__dialogueSeedDoc ?? scene.content, true);
  });
  await wait(350);

  // ── in Play ──────────────────────────────────────────────────────────
  await api(() => window.__scriareProjectStore.getState().startPlay());
  // Wait for Play to be ON SCREEN rather than for a number of
  // milliseconds. v0.67.0 — this spec started failing on its first read
  // with `play` null, and the cause was the spec: 450ms is a guess, and a
  // guess about how long a mount takes is a guess that gets overtaken by
  // an unrelated change on a slower machine.
  for (let i = 0; i < 20; i += 1) {
    const ready = await api(() => Boolean(document.querySelector("[data-play-root] [data-dialogue]")));
    if (ready) break;
    await wait(120);
  }

  const readPlay = () =>
    api(() => {
      const root = document.querySelector("[data-play-root]");
      if (!root) return null;
      const talk = root.querySelector("[data-dialogue]");
      return {
        text: root.innerText,
        closed: talk?.getAttribute("data-closed") ?? null,
        offered: [...root.querySelectorAll("[data-dialogue-line]")].map(
          (el) => `${el.dataset.dialogueLine}${el.dataset.locked ? ":locked" : ""}`,
        ),
      };
    });

  const sayInPlay = async (lineId) => {
    const done = await api((id) => {
      const el = document.querySelector(
        `[data-play-root] button[data-dialogue-line="${id}"]`,
      );
      if (!el) return "not offered";
      el.click();
      return "said";
    }, lineId);
    await wait(280);
    return done;
  };

  let play = await readPlay();
  check("Play shows the conversation", Boolean(play) && play.offered.length > 0,
    JSON.stringify(play?.offered));

  // RULE 3, and the reason the whole feature exists.
  check(
    "THE PAGE WAITS — nothing below the conversation is on screen yet",
    !play.text.includes("The urn gives out") && !play.text.includes("Go down to the floor"),
    play.text.replace(/\n/g, " · ").slice(0, 150),
  );
  check(
    "...but what is written ABOVE it is",
    play.text.includes("Nesrin does not look up"),
  );

  // RULE 1.
  check(
    "a gated line is offered locked, not hidden, when it says so",
    play.offered.includes("l-gated:locked"),
    JSON.stringify(play.offered),
  );

  await sayInPlay("l-short");
  play = await readPlay();
  check(
    "saying a line puts it and its reply on the page",
    play.text.includes("How short are you?") && play.text.includes("Nine. Out of a hundred"),
    play.text.replace(/\n/g, " · ").slice(0, 160),
  );
  check(
    "SAID IS SPENT — it is no longer on offer",
    !play.offered.includes("l-short"),
    JSON.stringify(play.offered),
  );

  await sayInPlay("l-six");
  play = await readPlay();
  check(
    "...unless it is marked as one that can be said again",
    play.offered.includes("l-six"),
    JSON.stringify(play.offered),
  );

  check(
    "and the page is STILL waiting while the conversation is open",
    !play.text.includes("The urn gives out"),
  );

  // RULE 2 — "end".
  await sayInPlay("l-end");
  play = await readPlay();
  check(
    "a line marked END closes the conversation",
    play.closed === "true",
    `data-closed=${play.closed}`,
  );
  check(
    "...and THEN the rest of the page arrives",
    play.text.includes("The urn gives out") && play.text.includes("Go down to the floor."),
    play.text.replace(/\n/g, " · ").slice(-160),
  );
  check(
    "...with the conversation still readable above it",
    play.text.includes("Nine. Out of a hundred"),
  );

  // RULE 2 — "leave". Restart to get the conversation back.
  await api(() => window.__scriareProjectStore.getState().restartPlay());
  await wait(350);
  const before = await api(() => window.__scriareProjectStore.getState().playSceneId);
  await sayInPlay("l-go");
  const after = await api(() => window.__scriareProjectStore.getState().playSceneId);
  check(
    "a line marked LEAVE turns the scene",
    before !== after && Boolean(after),
    `${before} → ${after}`,
  );

  await api(() => window.__scriareProjectStore.getState().exitPlay());
  await wait(200);

  // ── the same rules in the exported page ──────────────────────────────
  // A second implementation, in plain JavaScript, in a file with no
  // framework and no network. This is the half most likely to be quietly
  // wrong, so it is driven exactly as a reader would drive it.
  const html = await api(() => {
    const project = window.__scriareProjectStore.getState().project;
    const story = window.__scriareExport.buildExportStory(project);
    return window.__scriareExport.buildExportHtml(story);
  });
  const exported = await openExported(html);

  const readExport = () =>
    exported.evaluate(() => {
      const talk = document.querySelector("[data-dialogue]");
      return {
        text: document.body.innerText,
        closed: talk?.getAttribute("data-closed") ?? null,
        offered: [...document.querySelectorAll("[data-dialogue-line]")].map(
          (el) => el.getAttribute("data-dialogue-line"),
        ),
        locked: document.querySelectorAll(".scriare-choice.is-locked").length,
      };
    });

  const sayInExport = async (lineId) => {
    await exported.evaluate((id) => {
      document.querySelector(`button[data-dialogue-line="${id}"]`)?.click();
    }, lineId);
    await wait(220);
  };

  let out = await readExport();
  check("the exported page shows the conversation too", out.offered.length > 0,
    JSON.stringify(out.offered));
  check(
    "THE EXPORTED PAGE WAITS as well — this is the second implementation",
    !out.text.includes("The urn gives out") && !out.text.includes("Go down to the floor."),
    out.text.replace(/\n/g, " · ").slice(0, 150),
  );
  check("...and a locked line is drawn locked there", out.locked === 1, `${out.locked} locked`);

  await sayInExport("l-short");
  out = await readExport();
  check(
    "saying a line in the export appends it and its reply",
    out.text.includes("How short are you?") && out.text.includes("Nine. Out of a hundred"),
    out.text.replace(/\n/g, " · ").slice(0, 160),
  );
  check("...and spends it", !out.offered.includes("l-short"), JSON.stringify(out.offered));

  await sayInExport("l-end");
  out = await readExport();
  check(
    "ending the conversation in the export lets the rest of the page through",
    out.closed === "true" &&
      out.text.includes("The urn gives out") &&
      out.text.includes("Go down to the floor."),
    `closed=${out.closed} | ${out.text.replace(/\n/g, " · ").slice(-140)}`,
  );

  // ── the graph badge ──────────────────────────────────────────────────
  // Board G6 settled this: ONE badge on the node — not silence, which
  // makes a scene where five things can happen look empty, and not a
  // self-loop, which would claim the scene leads to itself. The rule
  // underneath it is the shared one: a line is an edge only if it leaves,
  // so four of these five lines draw no wire at all.
  await api(() => {
    const store = window.__scriareProjectStore;
    store.getState().selectScene(store.getState().project.scenes[0].id);
  });
  await wait(600);

  const badge = await api(() => {
    const el = document.querySelector("[data-dialogue-badge]");
    return el ? el.textContent.replace(/\s+/g, " ").trim() : null;
  });
  check(
    "the Story Graph draws one badge for the conversation",
    badge === "◆ 4 in-page · 1 exit",
    String(badge),
  );

  // ── Check Story, the graph badge, and the script ─────────────────────
  const verdict = await api(() => {
    const project = window.__scriareProjectStore.getState().project;
    const check = window.__scriareStoryCheck.checkStory(project);
    const model = window.__scriareBuildScript(project, {
      layout: "screenplay",
      showConditions: true,
    });
    return {
      kinds: check.issues.map((i) => i.kind),
      // THE RULE: an option is an edge only if it leaves. One leaving line
      // plus one choice out of this scene.
      stats: check.stats,
      scriptHasDialogue: JSON.stringify(model.chapters).includes('"kind":"dialogue"'),
      scriptText: window.__scriareScriptHtml(model),
    };
  });

  check(
    "a conversation with a way out raises no warning",
    !verdict.kinds.includes("dialogue-never-ends"),
    verdict.kinds.join(", ") || "no issues",
  );
  check(
    "Script Export prints the conversation as its own kind of block",
    verdict.scriptHasDialogue &&
      verdict.scriptText.includes("CONVERSATION") &&
      verdict.scriptText.includes("Nine. Out of a hundred"),
    "third block kind, beside line and choices",
  );
  check(
    "...and says what happens after a line that ends it",
    /ends the conversation/.test(verdict.scriptText),
  );

  // The warning, on a conversation that genuinely cannot be left.
  const trapped = await api(() => {
    const store = window.__scriareProjectStore;
    const { buildDialogueBlockNode } = window.__scriareDialogue;
    const project = store.getState().project;
    const scene = project.scenes[0];
    const block = buildDialogueBlockNode(
      [
        { id: "t1", text: "Again?", reply: "Again.", repeatable: true },
        { id: "t2", text: "And again?", reply: "And again.", repeatable: true },
      ],
      "blk-trap",
    );
    const next = {
      ...project,
      scenes: project.scenes.map((s) =>
        s.id === scene.id ? { ...s, content: { type: "doc", content: [block] } } : s,
      ),
    };
    return window.__scriareStoryCheck.checkStory(next).issues.map((i) => i.kind);
  });
  check(
    "a conversation nothing can end is reported — the reader would be held there",
    trapped.includes("dialogue-never-ends"),
    trapped.join(", ") || "nothing reported",
  );

  // ── put it back ──────────────────────────────────────────────────────
  await seedProject();
  await wait(200);
  check(
    "the workspace is handed back to the next spec",
    await api(() => Boolean(window.__scriareProjectStore.getState().project)),
  );
}
