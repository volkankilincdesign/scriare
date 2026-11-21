import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * THE MOTION SCALE (v0.90.0).
 *
 * WHAT IS ACTUALLY WORTH ASSERTING HERE. Not that a duration is 150ms —
 * a test that reads a constant and confirms the constant is the constant
 * has never found anything. Two things can fail for real:
 *
 *   1. THE SYSTEM DECAYS. Someone writes `transition: opacity 180ms ease`
 *      on a new feature because it is quicker than deciding which step it
 *      is, and a year later there are nine durations again. That is
 *      exactly how the first nine happened — none of them was a mistake on
 *      the day it was written. So the first block reads the shipped
 *      stylesheet and insists no rule names its own duration or its own
 *      curve. It is the only check here that can catch a regression
 *      nobody has made yet.
 *
 *   2. THE GUARD STOPS GUARDING. Before this version, reduced motion was
 *      honoured in three hand-written places and missed in every other —
 *      including the Play Mode scene fade and every transform in the
 *      Story Graph, which are the two surfaces a writer looks at most. The
 *      second block turns the media query on for real and reads what the
 *      app computes, rather than trusting that redefining a token was
 *      enough.
 *
 * The middle block is the cheap one: the tokens exist and resolve. It is
 * here because every other check in this file is meaningless if they do
 * not, and a missing `@import` would otherwise show up as four confusing
 * failures instead of one clear one.
 */
export default async function run({ page, api, check, seedProject }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");

  await seedProject();
  await wait(300);

  // ── 1. the stylesheet names no durations of its own ──────────────────
  const cssPath = join(root, "src/renderer/src/styles/index.css");
  const css = await readFile(cssPath, "utf8");

  // Only `transition:` and `animation:` declarations — a literal elsewhere
  // (a `@keyframes` percentage, a z-index, a colour) is not what this is
  // about, and matching the whole file would make the check noise.
  const declarations = [...css.matchAll(/^\s*(transition|animation)[^;]*;/gm)].map((m) => ({
    text: m[0].replace(/\s+/g, " ").trim(),
    line: css.slice(0, m.index).split("\n").length,
  }));

  check(
    "the stylesheet still has transitions to check — the precondition",
    declarations.length >= 15,
    `${declarations.length} transition/animation declarations found`,
  );

  // The splash sweep is the one documented exception: an infinite loader
  // whose curve has to start and end at the same velocity, which neither
  // easing token does. It is argued for in motion.css and beside itself.
  const EXEMPT = /splashSweep/;

  const literalTime = declarations.filter(
    (d) => !EXEMPT.test(d.text) && /\b\d+(\.\d+)?m?s\b/.test(d.text),
  );
  const literalEase = declarations.filter(
    (d) =>
      !EXEMPT.test(d.text) &&
      /(cubic-bezier|\bease-in\b|\bease-out\b|\bease\b|\blinear\b|\bstep)/.test(d.text),
  );

  check(
    "no rule names its own duration",
    literalTime.length === 0,
    literalTime.map((d) => `index.css:${d.line} ${d.text}`).join(" | ") || "none",
  );
  check(
    "no rule names its own easing curve",
    literalEase.length === 0,
    literalEase.map((d) => `index.css:${d.line} ${d.text}`).join(" | ") || "none",
  );
  check(
    "...and the one documented exception is still exactly one",
    declarations.filter((d) => EXEMPT.test(d.text)).length === 1,
    `${declarations.filter((d) => EXEMPT.test(d.text)).length} exempt declarations`,
  );

  // ── 1b. the SECOND stylesheet, and the drift it invites ──────────────
  //
  // An exported page is a standalone document: it cannot import
  // motion.css, so pageStyles.ts declares the same six tokens again. Two
  // declarations of one decision is a real cost and this is the check
  // that pays it — change the scale in one file and forget the other and
  // this goes red immediately, rather than six months later when somebody
  // notices the export feels different from Play Mode.
  const motionPath = join(root, "src/renderer/src/styles/motion.css");
  const pagePath = join(root, "src/renderer/src/export/pageStyles.ts");
  const motionCss = await readFile(motionPath, "utf8");
  const pageCss = await readFile(pagePath, "utf8");

  const readTokens = (text) => {
    const out = {};
    // Only the first (non-reduced) declaration of each: the guard block
    // redefines them all to 1ms and would otherwise overwrite these.
    for (const name of ["--d-instant", "--d-quick", "--d-settle", "--d-considered", "--e-standard", "--e-exit"]) {
      const m = text.match(new RegExp(`${name}\\s*:\\s*([^;]+);`));
      if (m) out[name] = m[1].trim();
    }
    return out;
  };
  const inApp = readTokens(motionCss);
  const inExport = readTokens(pageCss);

  check(
    "the exported page declares the whole scale, not part of it",
    Object.keys(inExport).length === 6,
    `${Object.keys(inExport).length}/6: ${JSON.stringify(inExport)}`,
  );
  check(
    "the app's scale and the exported page's scale are the same scale",
    JSON.stringify(inApp) === JSON.stringify(inExport),
    `app ${JSON.stringify(inApp)} vs export ${JSON.stringify(inExport)}`,
  );

  const pageDecls = [...pageCss.matchAll(/^\s*(transition|animation)[^;]*;/gm)].map((m) =>
    m[0].replace(/\s+/g, " ").trim(),
  );
  check(
    "the exported page names no durations of its own either",
    pageDecls.every((d) => !/\b\d+(\.\d+)?m?s\b/.test(d)),
    pageDecls.filter((d) => /\b\d+(\.\d+)?m?s\b/.test(d)).join(" | ") || "none",
  );

  // ── 1c. the siblings rule, where it was being broken ─────────────────
  //
  // In Play Mode the Choice block hovered with `brightness-110` and the
  // Dialogue block with `border-[var(--accent)]` — two different drawings
  // for two blocks whose whole arrangement is that they are one. Worse,
  // the Dialogue's version set a BORDER COLOUR, which belongs to the
  // writer's Choice Style and sits in an earlier cascade layer, so a
  // writer who chose a border watched the app overwrite it on hover.
  // Both now inherit one rule in index.css; this is what keeps them there.
  const blocks = await Promise.all(
    ["choiceRuntimeBlock.tsx", "dialogueRuntimeBlock.tsx"].map((f) =>
      readFile(join(root, "src/renderer/src/runtime/blocks", f), "utf8"),
    ),
  );
  const strayUtilities = blocks.flatMap((text, i) =>
    [...text.matchAll(/className=\{`scriare-choice[^`]*`\}/g)]
      .map((m) => m[0])
      .filter((c) => /\bhover:|\btransition-|\bactive:/.test(c))
      .map((c) => `${i === 0 ? "choice" : "dialogue"}: ${c.slice(0, 90)}`),
  );
  check(
    "neither Play Mode block draws its own hover — the siblings rule, enforced",
    strayUtilities.length === 0,
    strayUtilities.join(" | ") || "none",
  );

  // ── 1d. the press exists on all three surfaces that draw a choice ────
  //
  // The point of this version's second half. Before it, nothing anywhere
  // in Scriare responded to being HELD: a row lit under the pointer and
  // then said nothing between mousedown and the click landing, which is
  // the exact moment a writer is most certain they have done something.
  // Three surfaces draw a choice — the editor, Play Mode, and the
  // exported page — and a press that exists on two of them is worse than
  // one that exists on none, because then the app disagrees with itself.
  const pressing = [
    ["the editor", css, /\.scriare-choice-option:active[^{]*\{/],
    ["Play Mode", css, /\[data-play-root\] \.scriare-choice:active/],
    ["the exported page", pageCss, /\.scriare-choice:active/],
  ];
  const missingPress = pressing.filter(([, text, re]) => !re.test(text)).map(([where]) => where);
  check(
    "a choice responds to being held down on all three surfaces",
    missingPress.length === 0,
    missingPress.length ? `missing on: ${missingPress.join(", ")}` : "editor, Play Mode, export",
  );
  // The siblings rule, stated once more where it can fail: the Dialogue
  // line is under the same editor rule as the Choice option rather than a
  // copy of it, so the two cannot drift apart by someone editing one.
  check(
    "...and the Dialogue line is in that rule rather than beside it",
    /\.scriare-choice-option:active,\s*\n\s*(\.ProseMirror\s+)?\.scriare-dialogue-line:active/.test(css),
    "the two selectors share one :active block",
  );

  // ── 1e. the transitions a CSS grep cannot see ────────────────────────
  //
  // The sweep that tokenised index.css could only see declarations in a
  // stylesheet. Tailwind's `transition-colors` is a utility class in TSX —
  // 150ms on cubic-bezier(.4, 0, .2, 1), a twentieth duration and a sixth
  // easing — and it was in nineteen class lists including Button's own,
  // which is to say in every control the kit draws. An inline style object
  // in FlowPanel was invisible for the same reason.
  const [buttonSrc, flowSrc, groupSrc] = await Promise.all([
    readFile(join(root, "src/renderer/src/components/common/Button.tsx"), "utf8"),
    readFile(join(root, "src/renderer/src/components/graph/FlowPanel.tsx"), "utf8"),
    readFile(join(root, "src/renderer/src/components/graph/GroupNode.tsx"), "utf8"),
  ]);
  check(
    "the kit's own button no longer carries Tailwind's transition",
    !/transition-colors/.test(buttonSrc) && /scriare-colors/.test(buttonSrc),
    `transition-colors ${/transition-colors/.test(buttonSrc)}, scriare-colors ${/scriare-colors/.test(buttonSrc)}`,
  );
  // The sweep, finished rather than counted. Walks every .tsx in the
  // renderer, because the whole lesson of this version is that a motion
  // literal hides wherever nobody is grepping.
  const walk = async (dir) => {
    const out = [];
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) out.push(...(await walk(full)));
      else if (e.name.endsWith(".tsx")) out.push(full);
    }
    return out;
  };
  const tsx = await walk(join(root, "src/renderer/src"));
  const offenders = [];
  for (const f of tsx) {
    const text = await readFile(f, "utf8");
    const hits = text.match(/\btransition-colors\b|\btransition-opacity\b|\btransition duration-\d+|\bduration-\d+/g);
    if (hits) offenders.push(`${f.split(/[\\/]/).pop()}: ${[...new Set(hits)].join(",")}`);
  }
  check(
    "no Tailwind motion utility is left anywhere in the renderer",
    offenders.length === 0,
    offenders.join(" | ") || `${tsx.length} files clean`,
  );

  check(
    "...and neither does the Story Graph",
    !/transition-colors/.test(groupSrc) && !/duration-\d/.test(groupSrc),
    groupSrc.match(/transition-colors|duration-\d+/g)?.join(" ") ?? "clean",
  );
  check(
    "a graph edge's inline transition is on the scale too",
    /transition:\s*"opacity var\(--d-/.test(flowSrc),
    flowSrc.match(/transition:\s*"[^"]*"/)?.[0] ?? "no inline transition found",
  );
  const utility = await page.evaluate(() => {
    const el = document.createElement("span");
    el.className = "scriare-colors";
    el.style.position = "fixed";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    const v = {
      duration: getComputedStyle(el).transitionDuration,
      timing: getComputedStyle(el).transitionTimingFunction,
    };
    el.remove();
    return v;
  });
  check(
    "...and the named utility they all point at resolves from the tokens",
    /\d/.test(utility.duration) && !/^0s/.test(utility.duration) && utility.timing.includes("cubic-bezier"),
    JSON.stringify(utility),
  );

  // ── 2. the tokens resolve in the running app ─────────────────────────
  const tokens = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return {
      instant: s.getPropertyValue("--d-instant").trim(),
      quick: s.getPropertyValue("--d-quick").trim(),
      settle: s.getPropertyValue("--d-settle").trim(),
      considered: s.getPropertyValue("--d-considered").trim(),
      standard: s.getPropertyValue("--e-standard").trim(),
      exit: s.getPropertyValue("--e-exit").trim(),
    };
  });

  check(
    "all six motion tokens resolve — i.e. motion.css is actually imported",
    Object.values(tokens).every((v) => v.length > 0),
    JSON.stringify(tokens),
  );
  check(
    "the durations are a rising scale rather than four similar numbers",
    (() => {
      const ms = (v) => (v.endsWith("ms") ? parseFloat(v) : parseFloat(v) * 1000);
      const [a, b, c, d] = [tokens.instant, tokens.quick, tokens.settle, tokens.considered].map(ms);
      return a < b && b < c && c < d && a > 0;
    })(),
    `${tokens.instant} < ${tokens.quick} < ${tokens.settle} < ${tokens.considered}`,
  );

  // ── 3. a real element computes a real duration from a token ──────────
  //
  // Read off the page rather than off the file: a token that resolves on
  // :root but never reaches an element would pass everything above.
  const measured = await page.evaluate(() => {
    const el = document.createElement("div");
    el.className = "scriare-story-card";
    el.style.position = "fixed";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    const d = getComputedStyle(el).transitionDuration;
    const t = getComputedStyle(el).transitionTimingFunction;
    el.remove();
    return { duration: d, timing: t };
  });
  check(
    "a story card's transition duration comes from the scale, not from zero",
    /\d/.test(measured.duration) && !/^0s/.test(measured.duration),
    `transition-duration: ${measured.duration}`,
  );
  check(
    "...and its curve is the standard one rather than the browser default",
    measured.timing.includes("cubic-bezier"),
    `transition-timing-function: ${measured.timing}`,
  );

  // ── 4. reduced motion actually reduces, everywhere ───────────────────
  //
  // The real test of this version. Turning the media query on and reading
  // what the app computes is the only way to know the guard covers the
  // surfaces nobody wrote a guard for — the Play Mode fade and the graph.
  let emulated = true;
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
  } catch {
    emulated = false;
  }
  check(
    "the suite can turn prefers-reduced-motion on — the precondition",
    emulated,
    emulated ? "emulateMedia accepted" : "emulateMedia is unavailable on this page",
  );

  if (emulated) {
    await wait(200);
    const reduced = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      const probe = (cls) => {
        const el = document.createElement("div");
        el.className = cls;
        el.style.position = "fixed";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        const v = getComputedStyle(el).transitionDuration;
        el.remove();
        return v;
      };
      return {
        tokens: ["--d-instant", "--d-quick", "--d-settle", "--d-considered"].map((n) =>
          s.getPropertyValue(n).trim(),
        ),
        card: probe("scriare-story-card"),
        mention: probe("scriare-mention"),
      };
    });

    check(
      "every duration token collapses under reduced motion",
      reduced.tokens.every((v) => v === "1ms"),
      JSON.stringify(reduced.tokens),
    );
    // The two surfaces that had NO hand-written guard before this version.
    check(
      "...and it reaches elements that never had a guard of their own",
      /^(0\.001s|1ms)/.test(reduced.card) && /^(0\.001s|1ms)/.test(reduced.mention),
      `story card ${reduced.card}, mention ${reduced.mention}`,
    );

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await wait(200);
    const restored = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--d-quick").trim(),
    );
    check(
      "...and it comes back when the preference is cleared",
      restored === tokens.quick,
      `${restored} (was ${tokens.quick})`,
    );
  }

  // ── put it back ──────────────────────────────────────────────────────
  await seedProject();
  await wait(200);
  check(
    "the workspace is handed back to the next spec",
    await api(() => Boolean(window.__scriareProjectStore.getState().project)),
  );
}
