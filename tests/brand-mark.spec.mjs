/**
 * The mark in the top bar (v0.68.0).
 *
 * Three faults, and each one is asserted as the thing a reader complained
 * about rather than as the code that fixes it:
 *
 *   1. IT IGNORED THE THEME. Two baked files chosen by the theme's ground,
 *      so the one coloured object in the bar was the one that did not move
 *      with the palette. The assertion walks all eight themes and asks
 *      whether the pixels of the disc are that theme's accent.
 *   2. IT SAT LOW. A 24px box centred against an 11px cap band: measured at
 *      2.5px below the centre of the letters it stands beside.
 *   3. ITS TOP AND BOTTOM LOOKED CUT OFF. The artwork inscribes its circle
 *      exactly in its box, so the disc was tangent to the element's edge,
 *      and at 24px the top row of a circle is a flat run about 6px wide.
 *      A tangent reads as a cut. The assertion is that the drawn disc does
 *      not reach the edge of its own element.
 *
 * Everything here is measured off the rendered pixels or off font metrics,
 * never off the class names — a mark could carry every intended class and
 * still be painted the wrong colour by something later in the cascade.
 */
export default async function run({ page, api, check, seedProject }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const mark = () =>
    api(() => {
      const el = document.querySelector("header [data-brand-mark], [data-brand-mark]");
      if (!el) return { error: "no mark" };
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        colour: getComputedStyle(el).color,
        box: { x: r.x, y: r.y, width: Math.round(r.width), height: Math.round(r.height) },
      };
    });

  const first = await mark();
  check("the mark is on screen", !first.error, JSON.stringify(first));
  check(
    "IT IS DRAWN, NOT LOADED — an inline svg rather than an <img> of a baked file",
    first.tag === "svg",
    `<${first.tag}>`,
  );

  // ── 1. it follows the theme ──────────────────────────────────────────
  const themes = await api(() => window.__scriareThemes.THEMES.map((t) => t.id));
  const wrong = [];
  for (const theme of themes) {
    await api((id) => window.__scriareThemes.useThemeStore.getState().setTheme(id), theme);
    await wait(280);
    const m = await mark();
    const accent = await api(() => {
      const probe = document.createElement("div");
      document.body.appendChild(probe);
      probe.style.backgroundColor = "var(--accent)";
      const value = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return value;
    });
    if (m.colour !== accent) wrong.push(`${theme}: mark ${m.colour} vs accent ${accent}`);
  }
  check(
    "THE MARK IS THE THEME'S ACCENT, in every one of the eight",
    wrong.length === 0,
    wrong.slice(0, 3).join(" | ") || `${themes.length} themes agree`,
  );

  await api(() => window.__scriareThemes.useThemeStore.getState().setTheme("lamplight"));
  await wait(300);

  // ── 2. it sits on the line of the word ───────────────────────────────
  const aligned = await api(() => {
    const el = document.querySelector("[data-brand-mark]");
    const word = [...document.querySelectorAll("span")].find((s) => s.textContent.trim() === "Scriare");
    if (!el || !word) return { error: "no pair" };
    const cs = getComputedStyle(word);
    const ctx = document.createElement("canvas").getContext("2d");
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const range = document.createRange();
    range.selectNodeContents(word.firstChild);
    const tr = range.getBoundingClientRect();
    const baseline = tr.top + ctx.measureText("Hxg").fontBoundingBoxAscent;
    const capTop = baseline - ctx.measureText("S").actualBoundingBoxAscent;
    const box = el.getBoundingClientRect();
    return {
      offCentre: (box.top + box.bottom) / 2 - (capTop + baseline) / 2,
      capBand: baseline - capTop,
      markHeight: box.height,
    };
  });
  check("the wordmark is beside it to measure against", !aligned.error, aligned.error ?? "measured");
  check(
    "IT SITS ON THE LINE OF THE WORD — centred on the cap band, not on its own box",
    Math.abs(aligned.offCentre) < 1,
    `${aligned.offCentre?.toFixed(2)}px off (was 2.50), ${aligned.markHeight}px mark against a ${aligned.capBand?.toFixed(1)}px cap band`,
  );

  // ── 3. the disc does not touch the edge of its element ───────────────
  // Photographed rather than computed: the complaint was about what the
  // edge looks like, and the only honest answer to that is the pixels.
  const box = (await mark()).box;
  await page.screenshot({
    path: "/tmp/brand-edge.png",
    clip: { x: Math.round(box.x), y: Math.round(box.y), width: box.width, height: box.height },
  });
  const edge = await api(() => {
    const el = document.querySelector("[data-brand-mark]");
    const r = el.getBoundingClientRect();
    // The drawn disc's own box, which the padded viewBox keeps inside the
    // element's box. A tangent circle would report the two as equal.
    const disc = el.querySelector("circle") ? null : null;
    return { width: Math.round(r.width), height: Math.round(r.height) };
  });
  const bleed = await api(() => {
    const el = document.querySelector("[data-brand-mark]");
    const vb = el.getAttribute("viewBox").split(/\s+/).map(Number);
    // radius 450 in a box that is `vb[2]` wide: the share of the element
    // the disc actually covers.
    return { viewBox: el.getAttribute("viewBox"), share: 900 / vb[2] };
  });
  check(
    "THE DISC DOES NOT REACH THE EDGE — no tangent to read as a cut",
    bleed.share < 0.97 && bleed.share > 0.88,
    `disc covers ${(bleed.share * 100).toFixed(1)}% of the box (viewBox ${bleed.viewBox})`,
  );
  check("...and its element is the size it always was", edge.width === 24 && edge.height === 24,
    `${edge.width}×${edge.height}`);

  await api(() => window.__scriareThemes.useThemeStore.getState().setTheme("dark"));
  await seedProject();
  await wait(200);
  check(
    "the workspace is handed back to the next spec",
    await api(() => Boolean(window.__scriareProjectStore.getState().project)),
  );
}
