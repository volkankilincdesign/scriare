import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * The fixture, checked (v0.88.2; re-aimed at Feature Tour in v0.88.5).
 *
 * WHAT THIS WAS FOR. `demo-story.md` scoped the demo story as a vertical
 * slice on 17 Sep and named two conditions: a written ending, and a clean
 * Check Story report. Nobody had run the second against it until v0.88.2,
 * which found a real defect — a dialogue line marked `leave` with nowhere
 * to go.
 *
 * WHAT IT IS FOR NOW. The demo story left the repository in v0.88.5 and the
 * fixture is `feature-tour.scriare`, a generated placeholder whose whole
 * purpose is to contain one of everything. So this spec stopped being a
 * launch condition and became the guard on that purpose: the fixture opens,
 * carries every block type, reaches every scene, ends somewhere, and
 * reports nothing to fix. Four specs and the screenshot tool load this file;
 * if it quietly loses a block type, all of them become reports on less than
 * they claim. That is not hypothetical — it is what the suite did for a
 * month with a story that had no Dialogue block in it.
 *
 * `story-check.spec.mjs` covers Check Story's RULES on small hand-built
 * graphs, which is the right shape for a rule. This runs the real validator
 * over the real fixture, which is the only thing that can say the fixture is
 * sound.
 *
 * THE KNOWN-OPEN LIST stays, empty. It earned its place when the fixture was
 * the writer's own prose and one defect was his to fix rather than the
 * suite's to go red over: the assertion is that the problem set is a SUBSET
 * of a list named in code, so a NEW problem fails while a known one does
 * not, and a second check demands every listed entry still be reported, so
 * the list cannot rot into furniture. With a generated fixture there is
 * nothing to excuse, and an entry added here now has to be argued for.
 *
 * WHAT IS ONLY REPORTED: warnings. On `perf.spec`'s precedent that a number
 * with no agreed threshold is documentation — an unreachable scene can be a
 * mistake or a chapter not yet wired, and `check(name, true)` beside a count
 * nobody can interpret is a pass in a costume.
 *
 * ON ENDINGS: Check Story counts them and cannot tell a written ending from
 * a scene that ran out of choices, because both are scenes with no outgoing
 * link. The count and the titles are logged; nothing here claims more.
 */

/**
 * Problems that are real, known, and his to fix. Scene title plus kind.
 * Remove an entry when it is fixed; think hard before adding one.
 */
const KNOWN_OPEN = [
  // EMPTY, AND THAT IS THE POINT. It held one entry while the fixture was
  // the writer's own story and the defect was a line of his prose. The
  // fixture is a generated placeholder now, so a problem in it is a defect
  // in the generator and there is nothing to excuse. Keep it empty: an entry
  // added here has to be argued for.
];

export default async function run({ api, check, seedProject }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "scriare-demo-check-"));
  const file = path.join(dir, "feature-tour.scriare");
  await fs.writeFile(file, await fs.readFile(new URL("./fixtures/feature-tour.scriare", import.meta.url)));

  await api(async (p) => {
    await window.__scriareProjectStore.getState().openRecentProject(p);
  }, file);
  await wait(600);

  const out = await api(() => {
    const project = window.__scriareProjectStore.getState().project;
    if (!project) return { opened: false };
    const r = window.__scriareStoryCheck.checkStory(project);
    // The block counts are here so that a report on a story missing the
    // Dialogue blocks can never again be mistaken for a report on one that
    // has them — which is the whole reason the fixture was swapped.
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
        title: project.scenes.find((s) => s.id === i.sceneId)?.title ?? i.sceneId,
        detail: i.detail ?? i.message ?? null,
      })),
      endings: (r.endings ?? []).map((e) => ({
        title: project.scenes.find((s) => s.id === e.id)?.title ?? e.id,
      })),
    };
  });

  check("the fixture opens", out.opened === true, JSON.stringify(out).slice(0, 160));
  if (!out.opened) return;

  const problems = out.issues.filter((i) => i.severity === "problem");
  const warnings = out.issues.filter((i) => i.severity !== "problem");
  const isKnown = (i) => KNOWN_OPEN.some((k) => k.kind === i.kind && k.title === i.title);
  const unexpected = problems.filter((i) => !isKnown(i));
  const stillOpen = KNOWN_OPEN.filter((k) =>
    problems.some((i) => i.kind === k.kind && i.title === k.title));

  console.log(`\n──────── Check Story · the demo story ────────`);
  console.log(`${out.name} · ${out.scenes} scenes · ${out.blocks.choices} choice blocks · ` +
    `${out.blocks.dialogues} dialogue blocks · ${out.blocks.conditionals} conditionals`);
  console.log(`reachable ${out.stats.reachable} · endings ${out.stats.endings} · ` +
    `loops ${out.stats.loops} · shortest route ${out.stats.shortestRoute} · ` +
    `longest route ${out.stats.longestRoute} · words ${out.stats.words ?? "n/a"}`);
  console.log(`PROBLEMS: ${problems.length} (${unexpected.length} unexpected) · ` +
    `WARNINGS: ${warnings.length}`);
  for (const i of problems) {
    console.log(`  ${isKnown(i) ? "known" : "✗ NEW"} [${i.kind}] ${i.title}\n      ${i.detail ?? ""}`);
  }
  for (const i of warnings) console.log(`  ! [${i.kind}] ${i.title}\n      ${i.detail ?? ""}`);
  console.log(`ENDINGS: ${out.endings.map((e) => e.title).join(" · ") || "none"}`);
  if (stillOpen.length) {
    console.log(`\n  ⚠ ${stillOpen.length} known problem(s) still open and his to fix: ` +
      `${stillOpen.map((k) => `${k.kind} in "${k.title}"`).join("; ")}`);
  }

  // THE LAUNCH CONDITION, as a subset rather than a count.
  check("Check Story reports no problem that is not already known",
    unexpected.length === 0,
    unexpected.map((i) => `${i.kind} in "${i.title}"`).join("; ") || "none");

  // A known-issue list that has stopped shrinking is a list that has become
  // furniture. This fails if an entry is fixed and left in, which is the
  // only way the list gets shorter on purpose.
  check("every entry on the known-open list is still a real problem",
    stillOpen.length === KNOWN_OPEN.length,
    `${stillOpen.length} of ${KNOWN_OPEN.length} still reported — remove the fixed ones`);

  // A story nothing can reach past scene one would satisfy the subset check
  // and still be broken.
  check("every scene is reachable from the start",
    out.stats.reachable === out.scenes,
    `${out.stats.reachable} of ${out.scenes} reachable`);

  check("the story has at least one ending", out.stats.endings >= 1, `endings: ${out.stats.endings}`);

  // THE FIXTURE'S OWN JOB, asserted. Feature Tour exists to exercise every
  // part of the app, and a fixture quietly missing a block type would make
  // every spec that loads it a report on less than it claims — which is
  // exactly how the suite spent a month photographing and testing a story
  // with no Dialogue block in it.
  check("the fixture carries every block type",
    out.blocks.choices >= 1 && out.blocks.dialogues >= 1 && out.blocks.conditionals >= 1,
    `${out.blocks.choices} choice · ${out.blocks.dialogues} dialogue · ${out.blocks.conditionals} conditional`);

  // ------------------------------------------------------------ put it back
  //
  // This spec opens a real project from disk, so it leaves an entry on the
  // recent shelf and a story loaded. first-run.spec runs after it and tests
  // the EMPTY shelf — it clears recentProjects in state after the mount, but
  // WelcomeScreen's loadRecent() effect reads the shelf back off disk, so a
  // populated shelf repopulates it and the empty branch never renders. Two of
  // its checks went red exactly that way on this spec's first full run.
  await api(() => {
    window.__scriareProjectStore.setState({ recentProjects: [] });
  });
  await seedProject();
  await wait(150);
  const restored = await api(() => Boolean(window.__scriareProjectStore.getState().project));
  check("the workspace is handed back to the next spec", restored);
}
