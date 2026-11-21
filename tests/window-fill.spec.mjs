import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * THE WINDOW IS FILLED, OR IT SCROLLS (v0.90.0).
 *
 * Maximized, the Welcome screen put its whole composition against the top
 * edge and left a little over half the window black underneath it, and Play
 * Mode did the same with about a third. Both now centre their content while
 * it fits and behave exactly as they always did once it does not.
 *
 * WHAT IS WORTH ASSERTING. Not "is it centred" on its own — that is one
 * line of CSS and a screenshot would show it. The thing that can actually
 * hurt somebody is the OTHER half: the classic way to centre a scrolling
 * column is `justify-content: center`, which keeps centring after the
 * content outgrows its container and pushes the first line up out of reach,
 * where no amount of scrolling gets it back. Auto margins do not do that,
 * because they resolve to zero once there is no free space to share.
 *
 * So this spec resizes the real window — small enough to overflow, tall
 * enough to centre — and in the small case asserts the thing a reader would
 * lose: THE TOP OF THE CONTENT IS STILL REACHABLE. That check is red for
 * the `justify-center` version and green for this one, which is the only
 * reason it is here.
 */
export default async function run({ page, api, check, seedProject, app }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");

  /** Resize the real window, and prove the resize landed before measuring. */
  const resize = async (w, h) => {
    await app.evaluate(
      ({ BrowserWindow }, size) => {
        const win = BrowserWindow.getAllWindows().find((x) => !x.isDestroyed());
        if (win) win.setSize(size.w, size.h);
      },
      { w, h },
    );
    await wait(450);
    return page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
  };

  const original = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));

  /** Where a column sits inside its own scroll container. */
  const boxes = (containerSel, columnSel) =>
    page.evaluate(
      ([cs, ls]) => {
        const box = document.querySelector(cs);
        const col = document.querySelector(ls);
        if (!box || !col) return null;
        const b = box.getBoundingClientRect();
        const c = col.getBoundingClientRect();
        const style = getComputedStyle(box);
        return {
          above: Math.round(c.top - b.top),
          below: Math.round(b.bottom - c.bottom),
          overflowing: box.scrollHeight > box.clientHeight + 1,
          scrollTop: box.scrollTop,
          padTop: Math.round(parseFloat(style.paddingTop)),
          display: style.display,
          direction: style.flexDirection,
        };
      },
      [containerSel, columnSel],
    );

  // ── 1. the Welcome screen, with room to spare ────────────────────────
  await api(() => {
    window.__scriareProjectStore.setState({ project: null, filePath: null });
  });
  await wait(400);

  const tall = await resize(1280, 960);
  check(
    "the window actually resized — the precondition for every measurement here",
    tall.h > 700,
    `innerHeight ${tall.h}`,
  );

  const wTall = await boxes("main", ".scriare-welcome-column");
  check(
    "the Welcome screen's column is inside a flex column",
    wTall && wTall.display === "flex" && wTall.direction === "column",
    wTall ? `display ${wTall.display}, direction ${wTall.direction}` : "column not found",
  );
  check(
    "...and with room to spare it sits in the middle rather than against the top",
    wTall && !wTall.overflowing && wTall.above > wTall.padTop + 8 && Math.abs(wTall.above - wTall.below) <= 2,
    wTall ? `${wTall.above}px above, ${wTall.below}px below (padding ${wTall.padTop})` : "not measured",
  );

  // ── 2. ...and with more stories than fit ─────────────────────────────
  //
  // Shrinking the window rather than inventing twenty recent projects: the
  // thing under test is what happens when the content is taller than the
  // box, and a short box tests that honestly without this spec having to
  // know the shape of a recent-projects record.
  const short = await resize(1000, 380);
  check(
    "the window shrank — the precondition for the overflow case",
    short.h < 500,
    `innerHeight ${short.h}`,
  );

  const wShort = await boxes("main", ".scriare-welcome-column");
  check(
    "once the content is taller than the window it stops centring",
    wShort && wShort.overflowing && wShort.above <= wShort.padTop + 2,
    wShort ? `overflowing ${wShort.overflowing}, ${wShort.above}px above (padding ${wShort.padTop})` : "not measured",
  );
  // THE CHECK THIS SPEC EXISTS FOR — with one caveat stated rather than
  // buried: it is NOT negative-controlled, because no single-line sabotage
  // of this markup can produce the failure. Clipping needs `justify-center`
  // on the container AND the auto margin gone from the column, and the
  // control harness applies one edit at a time. That the bug is hard to
  // reintroduce is the design working; it is still a check nobody has seen
  // go red, so it is worth less than the ones below it. The source guard at
  // the end of this file is the controlled half of the same concern.
  check(
    "...and the top of it is still reachable, which is what centring would have cost",
    wShort && wShort.above >= 0,
    wShort ? `${wShort.above}px above the scroll origin` : "not measured",
  );

  // ── 3. Play Mode, short scene and long ───────────────────────────────
  await resize(1280, 960);
  await seedProject();
  await wait(300);
  const actions = await api(() => {
    const st = window.__scriareProjectStore.getState();
    return { start: typeof st.startPlay, exit: typeof st.exitPlay };
  });
  check(
    "the store still has startPlay and exitPlay — named, not guessed",
    actions.start === "function" && actions.exit === "function",
    JSON.stringify(actions),
  );
  await api(() => window.__scriareProjectStore.getState().startPlay());
  await wait(500);

  const playing = await page.evaluate(() => Boolean(document.querySelector("[data-play-root]")));
  check("Play Mode opened — the precondition", playing);

  if (playing) {
    const pTall = await boxes("[data-play-root] .overflow-y-auto", "[data-play-root] .scriare-scene");
    check(
      "a scene shorter than the window is centred in it",
      pTall && !pTall.overflowing && pTall.above > 0 && Math.abs(pTall.above - pTall.below) <= 3,
      pTall ? `${pTall.above}px above, ${pTall.below}px below` : "not measured",
    );

    await resize(1000, 360);
    const pShort = await boxes("[data-play-root] .overflow-y-auto", "[data-play-root] .scriare-scene");
    check(
      "a scene taller than the window starts at its first line instead",
      pShort && pShort.overflowing && pShort.above <= pShort.padTop + 2 && pShort.above >= 0,
      pShort ? `overflowing ${pShort.overflowing}, ${pShort.above}px above` : "not measured",
    );

    await api(() => window.__scriareProjectStore.getState().exitPlay());
    await wait(300);
  }

  // ── 4. the technique itself, so it cannot quietly become the other one ─
  const [play, welcome] = await Promise.all([
    readFile(join(root, "src/renderer/src/runtime/PlayRuntime.tsx"), "utf8"),
    readFile(join(root, "src/renderer/src/components/welcome/WelcomeScreen.tsx"), "utf8"),
  ]);
  const centringWith = (text) => /justify-center|justify-content:\s*center/.test(text);
  check(
    "neither surface centres with justify-center, which is the version that clips",
    !centringWith(play.slice(play.indexOf("overflow-y-auto"), play.indexOf("overflow-y-auto") + 400)) &&
      !centringWith(welcome.slice(welcome.indexOf("<main"), welcome.indexOf("<main") + 400)),
    "both use auto margins",
  );
  check(
    "...and both still carry the auto margin that does the work",
    /my-auto/.test(play) && /my-auto/.test(welcome),
    `PlayRuntime ${/my-auto/.test(play)}, WelcomeScreen ${/my-auto/.test(welcome)}`,
  );

  // ── put it back ──────────────────────────────────────────────────────
  await resize(original.w, original.h);
  await seedProject();
  await wait(250);
  check(
    "the workspace is handed back to the next spec",
    await api(() => Boolean(window.__scriareProjectStore.getState().project)),
  );
}
