/**
 * First-run teaching (v0.81.0).
 *
 * THE CLAIM IS NOT "THERE IS A HELP PANEL". It is that a newcomer meets
 * ONE description of each block wherever they meet the block — the toolbar
 * tooltip, the slash menu, the block's own header and the panel all saying
 * the same thing, because they all read the same string. Before this
 * version those four places were typed separately and disagreed: the
 * Conditional was "a passage that only appears sometimes" on the button
 * and "Prose that only appears when a condition holds" in the menu, and
 * the Choice button said "Insert a Choice Block".
 *
 * So the checks below compare the SURFACES AGAINST EACH OTHER rather than
 * against a string written down here. A test that asserted the expected
 * sentence would pass the day somebody changed the registry and forgot the
 * toolbar — which is the exact bug this version exists to make impossible.
 */
export default async function run({ api, check, seedProject }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await seedProject();
  await api(() => window.__scriareProjectStore.getState().selectScene("s1"));
  await wait(200);

  /* ── one sentence per block, in every place it is met ──────────── */

  const said = await api(() => {
    const reg = window.__scriareBlocks;
    const byId = {};
    for (const id of ["choice", "dialogue", "conditional"]) {
      const def = reg.NARRATIVE_BLOCKS.find((b) => b.id === id);
      const button = document.querySelector(`[data-insert-${id}]`);
      byId[id] = {
        registryDescription: def?.description ?? null,
        registryTagline: def?.tagline ?? null,
        teaches: def?.teaches ?? null,
        tooltip: button ? button.getAttribute("title") : null,
      };
    }
    return byId;
  });

  for (const [id, one] of Object.entries(said)) {
    check(
      `the ${id} button's tooltip is the registry's own sentence`,
      typeof one.tooltip === "string" && one.tooltip.includes(one.registryDescription),
      `${JSON.stringify(one.tooltip)} vs ${JSON.stringify(one.registryDescription)}`,
    );
    check(
      `...and the ${id} has something to teach somebody who has never seen one`,
      typeof one.teaches === "string" && one.teaches.length > 40,
      String(one.teaches).slice(0, 60),
    );
    check(
      `...and a tagline for its own header`,
      typeof one.registryTagline === "string" && one.registryTagline.length > 0,
      String(one.registryTagline),
    );
  }

  // NO DESCRIPTION IS THE APP REPEATING ITS OWN NOUN. "Insert a Choice
  // Block" survived eighty versions because nothing ever objected to it:
  // it is grammatical, it is accurate, and it tells the one person who
  // needs telling absolutely nothing.
  //
  // The property is that a description must survive having its own block's
  // name taken out of it. Strip the title and the words that carry no
  // information here — insert, a, an, the, block — and what is left has to
  // still be a sentence about what the reader gets. Measured at three
  // words, which "Insert a Choice Block" cannot reach and which the
  // shortest real description clears by two.
  //
  // A heuristic, and deliberately one: the alternative is asserting the
  // exact strings, which would pass on the day somebody replaced them with
  // three new tautologies.
  const leftover = (id, description) => {
    const empty = new RegExp(`\\b(${id}|insert|a|an|the|block|blocks)\\b`, "gi");
    return String(description)
      .replace(empty, " ")
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean).length;
  };
  for (const [id, one] of Object.entries(said)) {
    check(
      `the ${id}'s description says something its own name does not`,
      leftover(id, one.registryDescription) >= 3,
      `${leftover(id, one.registryDescription)} words left of ${JSON.stringify(one.registryDescription)}`,
    );
  }

  /* ── the block's own header says the same thing ────────────────── */

  const headers = await api(async () => {
    const wait2 = (ms) => new Promise((r) => setTimeout(r, ms));
    const editor = window.__scriareEditorStore.getState().editor;
    const out = {};
    for (const [id, insert] of [
      ["choice", "insertChoiceBlock"],
      ["dialogue", "insertDialogueBlock"],
      ["conditional", "insertConditionalBlock"],
    ]) {
      editor.chain().focus()[insert]().run();
      await wait2(160);
      const block = document.querySelector(`[data-${id === "choice" ? "choice-block" : id === "dialogue" ? "dialogue-block" : "conditional-block"}]`);
      out[id] = block ? block.textContent : null;
    }
    return out;
  });

  const reg = await api(() => {
    const out = {};
    for (const b of window.__scriareBlocks.STORY_BLOCKS) out[b.id] = b.tagline;
    return out;
  });

  for (const id of Object.keys(reg)) {
    check(
      `a ${id} block in the scene wears the same tagline as everything else`,
      typeof headers[id] === "string" && headers[id].includes(reg[id]),
      `${JSON.stringify(String(headers[id]).slice(0, 70))} should contain ${JSON.stringify(reg[id])}`,
    );
  }

  /* ── the panel, and the two doors to it ────────────────────────── */

  const panel = await api(async () => {
    const wait2 = (ms) => new Promise((r) => setTimeout(r, ms));
    const door = document.querySelector("[data-open-help]");
    if (door) door.click();
    await wait2(220);

    const blocks = [...document.querySelectorAll("[data-help-block]")].map((el) => ({
      id: el.getAttribute("data-help-block"),
      text: el.textContent,
    }));

    const questionsTab = document.querySelector('[data-help-tab="questions"]');
    if (questionsTab) questionsTab.click();
    await wait2(160);
    const questions = document.querySelector("[data-help-questions]");
    const questionCount = questions ? questions.querySelectorAll("div > div > div").length : 0;
    const questionText = questions ? questions.textContent : "";

    window.__scriareUIStore.getState().closeHelp();
    await wait2(140);
    return {
      hadDoor: Boolean(door),
      blocks,
      questionText,
      questionCount,
      closed: !document.querySelector("[data-help-block]"),
    };
  });

  // IN THE TOP BAR, not the editor's toolbar. It was drawn beside the
  // three block buttons first, which is where the question gets asked —
  // and the bar wrapped to a second row the moment the Choice group
  // appeared beside it, moving the writer's own text down and back up
  // while they typed. tests/toolbar.spec.mjs caught it; the door moved up
  // one bar rather than the invariant being loosened.
  check("there is a door to it wherever a writer is standing", panel.hadDoor === true);
  check(
    "the panel explains exactly the blocks that have something to teach",
    panel.blocks.length === 3 &&
      ["choice", "dialogue", "conditional"].every((id) => panel.blocks.some((b) => b.id === id)),
    panel.blocks.map((b) => b.id).join(", "),
  );

  // The same strings again, on the fourth surface. This is the check that
  // makes the registry the single source rather than merely the intended
  // one: a panel with its own copy of the sentences would pass everything
  // above and fail here.
  const teaches = await api(() => {
    const out = {};
    for (const b of window.__scriareBlocks.STORY_BLOCKS) out[b.id] = b.teaches;
    return out;
  });
  check(
    "...in the same words the toolbar and the block itself use",
    panel.blocks.every((b) => b.text.includes(teaches[b.id]) && b.text.includes(reg[b.id])),
    panel.blocks.map((b) => b.id).join(", "),
  );

  check("the questions are there too", panel.questionCount >= 10, `${panel.questionCount} entries`);
  check("closing it leaves nothing behind", panel.closed === true);

  /* ── the OTHER door, on the screen a newcomer starts on ────────── */

  // THE HALF THAT WAS NEVER TESTED, AND WAS BROKEN. Everything above
  // drives the top bar's door, which only exists once a story is open —
  // so the Welcome screen's link set the flag and rendered nothing,
  // because App's no-project branch did not mount the panel. A dead link
  // pointing at the one thing a newcomer would click, shipped in v0.81.0
  // with eight negative controls all green.
  //
  // It was found by looking at a screenshot of the Welcome screen. The
  // lesson is not "take more screenshots": it is that a door was tested
  // where it was convenient to test rather than where it was at risk.
  const fromWelcome = await api(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    const before = window.__scriareProjectStore.getState().project;
    window.__scriareProjectStore.setState({ project: null, filePath: null });
    // EMPTIED AFTER THE MOUNT, NOT BEFORE IT. WelcomeScreen calls
    // loadRecent() in an effect, which reads the shelf back off disk — so
    // a list cleared before it mounts is repopulated by the time anything
    // is on screen, and the empty branch never renders.
    await w(320);
    window.__scriareProjectStore.setState({ recentProjects: [] });
    await w(220);

    const link = document.querySelector("[data-empty-shelf-help]");
    if (link) link.click();
    await w(260);
    const opened = Boolean(document.querySelector("[data-help-block]"));

    window.__scriareUIStore.getState().closeHelp();
    window.__scriareProjectStore.setState({ project: before });
    await w(200);
    return { hadLink: Boolean(link), opened };
  });

  check("the empty shelf offers a newcomer a way in", fromWelcome.hadLink === true);
  check(
    "...and it opens the panel, on a screen with no story behind it",
    fromWelcome.opened === true,
    String(fromWelcome.opened),
  );

  /* ── an FAQ that answers what the app DOES ─────────────────────── */

  // Not a test of the prose — that is his to judge — but of the one
  // property a written answer can be wrong about mechanically: naming a
  // place in the app that does not exist. Every answer that names a
  // surface is checked against the surface's real label.
  const named = await api(() => {
    const faq = window.__scriareFaq.FAQ;
    const text = faq.map((e) => `${e.q} ${e.a}`).join(" ");
    return {
      count: faq.length,
      groups: [...new Set(faq.map((e) => e.group))],
      mentionsPlay: /\bPlay\b/.test(text),
      mentionsCheckStory: /Check Story/.test(text),
      mentionsStylesheet: /Project Settings → Stylesheet/.test(text),
      // A question ending without a question mark is a heading pretending
      // to be a question, which is how an FAQ turns into a brochure.
      allAreQuestions: faq.every((e) => e.q.trim().endsWith("?")),
      // An answer shorter than the question it answers is not an answer.
      allAnswered: faq.every((e) => e.a.length > e.q.length),
    };
  });

  check("the FAQ is a real list rather than a gesture", named.count >= 12, `${named.count} entries`);
  check("...grouped by the order the work happens in", named.groups.length === 4, named.groups.join(", "));
  check("...and every question is one", named.allAreQuestions === true);
  check("...and every one of them is answered at length", named.allAnswered === true);
  check(
    "it points at things that exist: Play, Check Story, the Stylesheet",
    named.mentionsPlay && named.mentionsCheckStory && named.mentionsStylesheet,
    JSON.stringify(named),
  );

  /* ── the empty page names the way in ───────────────────────────── */

  const placeholder = await api(() => {
    const el = document.querySelector(".ProseMirror [data-placeholder]");
    return el ? el.getAttribute("data-placeholder") : null;
  });
  check(
    "an empty scene tells a newcomer how to reach the three blocks",
    typeof placeholder === "string" && placeholder.includes("/"),
    String(placeholder),
  );
}
