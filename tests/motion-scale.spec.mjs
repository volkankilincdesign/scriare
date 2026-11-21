import { readFile } from "node:fs/promises";
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
