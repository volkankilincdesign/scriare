import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * Check Story on the demo story (v0.88.2, rewritten for the fixture swap in
 * v0.88.3).
 *
 * THIS SPEC EXISTS BECAUSE OF A CONDITION, NOT A FEATURE. `demo-story.md`
 * scoped the demo story as a vertical slice on 17 Sep and named the two
 * things that decide whether it reads as a slice or as abandoned: a written
 * ending, and a clean Check Story report. The story has been written — 32
 * scenes in five chapters, three conversations — and nobody had run the
 * second condition against it until v0.88.2.
 *
 * ONE FIXTURE NOW. v0.88.2 checked two files because the conversations lived
 * outside the suite; v0.88.3 made the conversations story THE fixture, so
 * there is one story and the comparison is gone. `story-check.spec.mjs`
 * covers the RULES on small hand-built graphs, which is the right shape for a
 * rule. This runs the real validator over the real story, which is the only
 * thing that can answer the condition.
 *
 * THE KNOWN-OPEN LIST IS THE INTERESTING PART. The story has one real defect
 * — a dialogue line in *The Big Table* marked `leave` with nowhere to go —
 * and fixing it means rewriting his prose, which is his and not mine. The
 * choice was between asserting zero problems (a red suite over a line nobody
 * has rewritten, which trains people to ignore the runner) and dropping the
 * assertion (which loses the condition). Neither. The assertion is that the
 * problem set is a SUBSET of a list named here, in code, with the scene in
 * it. So:
 *
 *   - a NEW problem anywhere in the story fails the spec, which is the point;
 *   - the known one is reported loudly every run, so it cannot be forgotten;
 *   - and when he fixes it the spec still passes, because a shrinking subset
 *     is still a subset — then the entry comes out of the list.
 *
 * A known-issue list is only honest while it is short, explicit, and shrinks.
 * If it ever grows, that is the signal to stop adding to it.
 *
 * WHAT IS ONLY REPORTED: warnings. On `perf.spec`'s precedent that a number
 * with no agreed threshold is documentation — an unreachable scene can be a
 * mistake or a chapter not yet wired, and `check(name, true)` beside a count
 * nobody can interpret is a pass in a costume. HIS judgement closes a
 * warning; mine cannot.
 *
 * ON THE ENDING CONDITION, WHICH THIS DOES NOT VERIFY: Check Story counts
 * endings and cannot tell a written *End of Act One* from a scene that ran
 * out of choices, because both are scenes with no outgoing link. So the
 * count and the TITLES are logged for him to read, and nothing here claims
 * the first condition is met. Measuring what is measurable and naming which
 * half is left beats asserting the whole.
 */

/**
 * Problems that are real, known, and his to fix. Scene title plus kind.
 * Remove an entry when it is fixed; think hard before adding one.
 */
const KNOWN_OPEN = [
  { kind: "unlinked-choice", title: "The Big Table" },
];

export default async function run({ api, check, seedProject }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "scriare-demo-check-"));
  const file = path.join(dir, "the-blue-hour.scriare");
  await fs.writeFile(file, await fs.readFile(new URL("./fixtures/the-blue-hour.scriare", import.meta.url)));

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

  check("the demo story opens as a project", out.opened === true, JSON.stringify(out).slice(0, 160));
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

  // The swap is what this spec is now guarding as much as the condition: a
  // fixture without the Dialogue blocks would make every screenshot and
  // every other spec a report on the wrong story.
  check("the fixture is the story WITH the conversations in it",
    out.blocks.dialogues >= 3, `${out.blocks.dialogues} dialogue blocks`);

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
