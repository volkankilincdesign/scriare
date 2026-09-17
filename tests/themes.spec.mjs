/**
 * The eight themes (v0.44.0).
 *
 * A theme is a block of custom properties and nothing else — no component
 * names a colour — which makes two failures possible, and both are silent:
 *
 *   - A theme that MISSES a token doesn't break. It inherits the default
 *     theme's value, so Nocturne without its own --page would quietly draw
 *     the dark theme's near-black sheet on a violet desk, and nothing would
 *     say so. That is checked by comparing each theme's token set against
 *     the default's, taken from the stylesheet itself rather than from a
 *     list kept here, which would drift.
 *   - A theme whose values are pretty and unreadable. Every palette is
 *     therefore measured, not eyeballed: the real contrast ratios, computed
 *     from what the browser actually paints, against the sizes each token is
 *     actually used at.
 *
 * Plus the one rule the whole elevation treatment rests on: the page is a
 * sheet of paper on a desk, so --page must be a step from --bg TOWARD the
 * light in every theme. It was not, in the light theme, for four versions.
 */
export default async function ({ page, api, check, seedProject }) {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Colour, as actually painted. getComputedStyle hands back the token's
  // own text ("oklch(61% 0.008 75)"), which says nothing about what lands on
  // screen; painting it and reading the pixel back does, and it is the same
  // path the screen takes.
  const install = () =>
    api(() => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      window.__themeProbe = {
        rgb(color) {
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = "#000";
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, 1, 1);
          const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
          return [r, g, b];
        },
        luminance(color) {
          const channel = (v) => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          };
          const [r, g, b] = window.__themeProbe.rgb(color);
          return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
        },
        contrast(a, b) {
          const la = window.__themeProbe.luminance(a);
          const lb = window.__themeProbe.luminance(b);
          const [hi, lo] = la > lb ? [la, lb] : [lb, la];
          return (hi + 0.05) / (lo + 0.05);
        },
        // Perceptual lightness of what was painted, 0–100. A hairline is
        // judged by this rather than by a WCAG luminance ratio: that ratio is
        // built for text and collapses at the dark end, where a five-point
        // difference in lightness is plainly visible but scores about 1.07 —
        // so a luminance floor would either pass everything on a light theme
        // or fail every dark one, whatever the border actually looks like.
        okL(color) {
          const lin = (v) => {
            const s = v / 255;
            return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          };
          const [r, g, b] = window.__themeProbe.rgb(color).map(lin);
          const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
          const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
          const s2 = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
          return (0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s2) * 100;
        },
        token(name) {
          return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        },
      };
      return true;
    });

  await install();

  const list = await api(() => {
    const mod = window.__scriareThemes;
    return mod ? mod.THEMES.map((t) => t.id) : null;
  });
  check("the app ships the eight themes", list !== null && list.length === 8, JSON.stringify(list));

  // 1 — token completeness, read out of the stylesheet. The default block is
  // the contract; every other theme has to meet it exactly.
  const sets = await api(() => {
    const found = {};
    for (const sheet of document.styleSheets) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        continue; // a cross-origin sheet, which none of ours are
      }
      for (const rule of rules) {
        if (!rule.selectorText || !rule.style) continue;
        const names = [];
        for (const prop of rule.style) if (prop.startsWith("--")) names.push(prop);
        if (names.length === 0) continue;
        const ids = [...rule.selectorText.matchAll(/\[data-theme="([^"]+)"\]/g)].map((m) => m[1]);
        if (rule.selectorText.includes(":root") && !ids.includes("dark")) ids.push("dark");
        for (const id of ids) found[id] = [...new Set([...(found[id] ?? []), ...names])];
      }
    }
    return found;
  });
  const base = sets.dark ?? [];
  check("the default theme's token list was found in the stylesheet",
    base.length > 30, `${base.length} tokens`);
  const missing = {};
  for (const id of list ?? []) {
    const have = new Set(sets[id] ?? []);
    const gaps = base.filter((t) => !have.has(t));
    if (gaps.length) missing[id] = gaps;
  }
  check("every theme defines every token the default one does",
    Object.keys(missing).length === 0, JSON.stringify(missing));

  // 2 — switching. Both that it applies and that the ground actually changes:
  // a theme whose block never matched would leave the default's colours in
  // place and every other check here would still pass.
  const applied = [];
  for (const id of list ?? []) {
    await api((themeId) => window.__scriareThemes.useThemeStore.getState().setTheme(themeId), id);
    await wait(90);
    const state = await api(() => ({
      attr: document.documentElement.getAttribute("data-theme"),
      bg: window.__themeProbe.rgb(window.__themeProbe.token("--bg")).join(","),
      stored: window.localStorage.getItem("scriare.theme"),
    }));
    applied.push({ id, ...state });
  }
  check("choosing a theme applies it and remembers it",
    applied.every((a) => a.attr === a.id && a.stored === a.id),
    JSON.stringify(applied.map((a) => `${a.id}:${a.attr}/${a.stored}`)));
  check("...and every theme paints a different ground",
    new Set(applied.map((a) => a.bg)).size === applied.length,
    JSON.stringify(applied.map((a) => `${a.id} ${a.bg}`)));

  // 3 — the sheet on a desk. --page must be lighter than --bg everywhere;
  // in the light theme it was darker, which is the bug this release fixes.
  const paper = [];
  for (const id of list ?? []) {
    await api((themeId) => window.__scriareThemes.useThemeStore.getState().setTheme(themeId), id);
    await wait(60);
    const r = await api(() => {
      const p = window.__themeProbe;
      return { page: p.luminance(p.token("--page")), bg: p.luminance(p.token("--bg")) };
    });
    paper.push({ id, lighter: r.page > r.bg, gap: Number((r.page - r.bg).toFixed(4)) });
  }
  check("the page is always a sheet on a desk, never a hole in one",
    paper.every((p) => p.lighter), JSON.stringify(paper));

  // 4 — legibility, measured at the weights these tokens are actually used
  // at: --text-3 carries the status bar and every caption at 11px, --text-2
  // the tree and the Inspector at 12–13, --text-reading the prose on the
  // page, and --accent-text-on sits on the accent in the Play button.
  const FLOORS = [
    { fg: "--text", bg: "--surface", min: 7, what: "UI text on a panel" },
    { fg: "--text-2", bg: "--surface", min: 4.5, what: "secondary text on a panel" },
    { fg: "--text-3", bg: "--surface", min: 4.5, what: "captions on a panel" },
    { fg: "--text-reading", bg: "--page", min: 7, what: "prose on the page" },
    { fg: "--accent-text-on", bg: "--accent", min: 4.5, what: "the label on the primary button" },
  ];
  const failures = [];
  for (const id of list ?? []) {
    await api((themeId) => window.__scriareThemes.useThemeStore.getState().setTheme(themeId), id);
    await wait(60);
    const rows = await api((floors) => {
      const p = window.__themeProbe;
      return floors.map((f) => ({
        ...f,
        ratio: Number(p.contrast(p.token(f.fg), p.token(f.bg)).toFixed(2)),
      }));
    }, FLOORS);
    for (const row of rows) {
      if (row.ratio < row.min) failures.push(`${id}: ${row.what} ${row.ratio} < ${row.min}`);
    }
  }
  check("every theme is legible where it is read", failures.length === 0, JSON.stringify(failures));

  // 5 — and a border has to be visible against what it divides, which is the
  // failure the v0.24.0 note describes and which the six new palettes walked
  // straight back into: they were drawn with soft borders three points from
  // their own surface, where the polished dark theme uses five and a half.
  // Measured in perceptual lightness, which is the unit the palettes are
  // written in and the only one that means the same thing at both ends of
  // the range.
  const GAPS = [
    { line: "--border-soft", on: "--surface", min: 4 },
    { line: "--border", on: "--surface-2", min: 5 },
    { line: "--border-faint", on: "--surface-3", min: 7.5 },
  ];
  const flat = [];
  for (const id of list ?? []) {
    await api((themeId) => window.__scriareThemes.useThemeStore.getState().setTheme(themeId), id);
    await wait(60);
    const rows = await api((gaps) => {
      const p = window.__themeProbe;
      return gaps.map((g) => ({
        ...g,
        gap: Number(Math.abs(p.okL(p.token(g.line)) - p.okL(p.token(g.on))).toFixed(2)),
      }));
    }, GAPS);
    for (const row of rows) {
      if (row.gap < row.min) flat.push(`${id}: ${row.line} is ${row.gap} from ${row.on} (needs ${row.min})`);
    }
  }
  check("every theme's borders are far enough from what they divide",
    flat.length === 0, JSON.stringify(flat));

  await api(() => window.__scriareThemes.useThemeStore.getState().setTheme("dark"));
  await seedProject();
  await wait(200);
}
