import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * Check Story on the demo story (2 Oct 2026).
 *
 * THIS SPEC EXISTS BECAUSE OF A CONDITION, NOT BECAUSE OF A FEATURE.
 * `claude/demo-story.md` scoped the demo story as a vertical slice back on
 * 17 Sep and named the two things that decide whether it reads as a slice
 * or as abandoned: a written ending, and a clean Check Story report. The
 * story has been written — 32 scenes in five chapters — and nobody had ever
 * run the second condition against it. story-check.spec.mjs covers the
 * RULES on small hand-built graphs, which is the right shape for a rule.
 * This runs the real validator over the real story, which is the only thing
 * that can answer the condition.
 *
 * BOTH FILES ARE CHECKED, deliberately. The suite and the screenshot tool
 * load `the-blue-hour.scriare`, which has no Dialogue blocks; the three
 * conversations live only in `the-blue-hour-conversations.scriare`. A
 * report on one is not a report on the other, and the Dialogue block brings
 * its own two warning kinds with it ("this conversation cannot be left",
 * "this line can never be said") which the plain file cannot produce at
 * all. Checking only the fixture would be checking the wrong story; this
 * way the swap can be made knowing what it changes.
 *
 * WHAT IS ASSERTED AND WHAT IS ONLY REPORTED. The bar is PROBLEM-severity
 * issues: a choice that goes nowhere, a choice pointing at a deleted scene,
 * a gate that can never open. Those are defects at any magnitude and the
 * spec fails on them. Warnings are REPORTED and not asserted — on
 * perf.spec's precedent that a number with no agreed threshold is
 * documentation — because an unreachable scene can be a mistake or can be a
 * chapter he has not wired yet, and `check(name, true)` beside a count I
 * cannot interpret would be a pass dressed as an assertion. HIS judgement
 * closes a warning; mine cannot.
 *
 * ON THE ENDING CONDITION: Check Story counts endings, and it cannot tell a
 * written *End of Act One* from a scene that ran out of choices — both are
 * scenes with no outgoing link. So the ending count and the ending TITLES
 * are logged for him to read, and nothing here claims to have verified the
 * first condition. Measuring what is measurable and saying so beats
 * asserting what isn't.
 */
export default async function run({ api, check, seedProject }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "scriare-demo-check-"));

  /** Opens a fixture the way the app opens a recent project, then checks it. */
  async function report(fixtureName, label, assertClean) {
    const file = path.join(dir, `${fixtureName}`);
    await fs.writeFile(file, await fs.readFile(new URL(`./fixtures/${fixtureName}`, import.meta.url)));

    await api(async (p) => {
      await window.__scriareProjectStore.getState().openRecentProject(p);
    }, file);
    await wait(600);

    const out = await api(() => {
      const project = window.__scriareProjectStore.getState().project;
      if (!project) return { opened: false };
      const r = window.__scriareStoryCheck.checkStory(project);
      // Count the blocks too, so a report on a story with no Dialogue in it
      // cannot be mistaken for a report on one that has them.
      let choices = 0, dialogues = 0, conditionals = 0;
      const walk = (n) => {
        if (!n || typeof n !== "object") return;
        if (Array.isArray(n)) return n.forEach(walk);
        if (n.type === "choiceBlock") choices += 1;
        if (n.type === "dialogueBlock") dialogues += 1;
        if (n.type === "conditionalBlock") conditionals += 1;
        if (n.content) walk(n.content);
      };
      project.scenes.forEach((s) => walk(s.content));
      return {
        opened: true,
        name: project.name,
        scenes: project.scenes.length,
        blocks: { choices, dialogues, conditionals },
        stats: r.stats,
        issues: r.issues.map((i) => ({
          kind: i.kind,
          severity: i.severity,
          sceneId: i.sceneId,
          title: project.scenes.find((s) => s.id === i.sceneId)?.title ?? i.sceneId,
          // `detail` is where the finding actually lives — the kind alone
          // cannot tell you WHICH variable a reader is about to be shown.
          detail: i.detail ?? i.message ?? null,
        })),
        endings: (r.endings ?? []).map((e) => ({
          id: e.id,
          title: project.scenes.find((s) => s.id === e.id)?.title ?? e.id,
        })),
      };
    });

    check(`${label}: the file opens as a project`, out.opened === true, JSON.stringify(out).slice(0, 200));
    if (!out.opened) return out;

    const problems = out.issues.filter((i) => i.severity === "problem");
    const warnings = out.issues.filter((i) => i.severity !== "problem");

    console.log(`\n──────── ${label} ────────`);
    console.log(`${out.name} · ${out.scenes} scenes · ` +
      `${out.blocks.choices} choice blocks · ${out.blocks.dialogues} dialogue blocks · ` +
      `${out.blocks.conditionals} conditionals`);
    console.log(`reachable ${out.stats.reachable} · endings ${out.stats.endings} · ` +
      `loops ${out.stats.loops} · shortest route ${out.stats.shortestRoute} · ` +
      `longest route ${out.stats.longestRoute} · words ${out.stats.words ?? "n/a"}`);
    console.log(`PROBLEMS: ${problems.length}   WARNINGS: ${warnings.length}`);
    for (const i of problems) console.log(`  ✗ [${i.kind}] ${i.title}\n      ${i.detail ?? ""}`);
    for (const i of warnings) console.log(`  ! [${i.kind}] ${i.title}\n      ${i.detail ?? ""}`);
    console.log(`ENDINGS: ${out.endings.map((e) => e.title).join(" · ") || "none"}`);

    // THE LAUNCH CONDITION, asserted only for the file the suite and the
    // screenshot tool actually load. The other file is REPORTED, not
    // asserted, on purpose: a problem in it is a defect in his PROSE, and a
    // red suite over a line nobody has rewritten yet is noise that trains
    // people to ignore the runner. When the fixture is swapped this
    // assertion follows it and starts guarding the real story.
    if (assertClean) {
      check(`${label}: Check Story reports no problems`,
        problems.length === 0,
        problems.map((i) => `${i.kind} in "${i.title}"`).join("; ") || "none");
    } else if (problems.length) {
      console.log(`  ⚠ NOT ASSERTED (not the fixture yet): ${problems.length} problem(s) above ` +
        `are real and are his to fix — see the report.`);
    }

    // Not the condition, but a story nothing can reach past scene one would
    // pass the problem check and still be broken.
    check(`${label}: every scene is reachable from the start`,
      out.stats.reachable === out.scenes,
      `${out.stats.reachable} of ${out.scenes} reachable`);

    check(`${label}: the story has at least one ending`,
      out.stats.endings >= 1, `endings: ${out.stats.endings}`);

    return out;
  }

  const plain = await report("the-blue-hour.scriare", "the fixture (no dialogue)", true);
  const convo = await report("the-blue-hour-conversations.scriare", "with conversations", false);

  // The two files are meant to be the same story plus three conversations.
  // If they differ in scene count, one of them is not what it is believed to
  // be, and every comparison between them afterwards is unsound.
  if (plain.opened && convo.opened) {
    check("the two files are the same story by scene count",
      plain.scenes === convo.scenes, `${plain.scenes} vs ${convo.scenes}`);
    check("only the conversations file has Dialogue blocks",
      plain.blocks.dialogues === 0 && convo.blocks.dialogues > 0,
      `plain ${plain.blocks.dialogues}, conversations ${convo.blocks.dialogues}`);
    console.log(`\nDIFFERENCE: conversations file has ` +
      `${convo.blocks.dialogues} dialogue blocks and ` +
      `${convo.blocks.conditionals - plain.blocks.conditionals} more conditionals; ` +
      `problems ${plain.issues.filter((i) => i.severity === "problem").length} → ` +
      `${convo.issues.filter((i) => i.severity === "problem").length}`);
  }

  // ------------------------------------------------------------ put it back
  //
  // THIS SPEC OPENS REAL PROJECTS FROM DISK, so it leaves two entries on the
  // recent shelf and a story loaded. first-run.spec runs after this one
  // alphabetically and tests the EMPTY shelf — it clears recentProjects in
  // state after the mount, but WelcomeScreen's loadRecent() effect reads the
  // shelf back off disk, so a populated shelf repopulates it and the empty
  // branch never renders. Two of its checks went red exactly that way on the
  // first full run of this spec. The handback is the convention the other
  // fixture-opening specs already follow; the comment is here because the
  // failure appeared four specs away from its cause.
  await api(() => {
    window.__scriareProjectStore.setState({ recentProjects: [] });
  });
  await seedProject();
  await wait(150);
  const restored = await api(() => Boolean(window.__scriareProjectStore.getState().project));
  check("the workspace is handed back to the next spec", restored);
}
