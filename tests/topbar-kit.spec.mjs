import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * THE TOP BAR IS THE KIT'S (v0.90.0).
 *
 * It used `Button` once, for Play, and hand-wrote the other six from one
 * copied class string — in an app whose Button component carries a long
 * argument about why a variant belongs in the kit rather than at a call
 * site. The copy had already drifted a shade dimmer than the component.
 *
 * THE CHECK THAT MATTERS MOST HERE IS NOT ABOUT LOOKS. Searching every
 * caller of `openVariableManager` turned up exactly two: this bar, and the
 * Inspector's — and the Inspector's only appears once a condition or action
 * editor is already open. There is no keyboard shortcut (the four keyboard
 * hooks are save, history, clipboard, find) and no slash command. So this
 * one button is the only way a writer who has never made a variable can
 * make their first, and an arrangement that drops it strands the feature.
 * That is asserted below, in the DOM, by role rather than by label — so it
 * survives the button becoming a glyph, which it just did.
 */
export default async function run({ page, api, check, seedProject }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");

  await seedProject();
  await wait(350);

  // ── 1. the route to variables still exists ───────────────────────────
  const variables = await page.evaluate(() => {
    const el = document.querySelector(".scriare-topbar [data-open-variables]");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      label: el.textContent.trim(),
      title: el.getAttribute("title"),
      aria: el.getAttribute("aria-label"),
      visible: r.width > 0 && r.height > 0,
      width: Math.round(r.width),
      height: Math.round(r.height),
    };
  });
  check(
    "the only route to variables is still in the top bar",
    variables !== null && variables.visible,
    variables ? JSON.stringify(variables) : "no [data-open-variables] in the top bar",
  );
  // A glyph with no accessible name is a button nobody can find twice.
  check(
    "...and it is named, since its label is now a symbol",
    variables && (variables.aria || "").toLowerCase().includes("variable") &&
      (variables.title || "").toLowerCase().includes("variable"),
    variables ? `aria-label ${JSON.stringify(variables.aria)}, title ${JSON.stringify(variables.title)}` : "not measured",
  );

  // ── 2. the glyph sits level with the words beside it ─────────────────
  //
  // Measured rather than eyeballed, because the request was specifically
  // about alignment. All the labels share one line box inside an
  // `inline-flex items-center` button, so they share a baseline by
  // construction — the thing that could break that is somebody setting the
  // glyph in a different face, which is why it is in the bar's own.
  const row = await page.evaluate(() => {
    const bar = document.querySelector(".scriare-topbar");
    if (!bar) return null;
    const btns = [...bar.querySelectorAll("button")].filter((b) => {
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && b.textContent.trim().length > 0;
    });
    return btns.map((b) => {
      const r = b.getBoundingClientRect();
      return {
        t: b.textContent.trim().slice(0, 12),
        centre: Math.round(r.top + r.height / 2),
        h: Math.round(r.height),
        family: getComputedStyle(b).fontFamily.split(",")[0].replace(/["']/g, ""),
        size: getComputedStyle(b).fontSize,
      };
    });
  });
  check(
    "the bar has its controls to measure — the precondition",
    row && row.length >= 5,
    row ? `${row.length} labelled buttons` : "no top bar",
  );
  if (row && row.length) {
    const centres = row.map((b) => b.centre);
    check(
      "every control in the bar is centred on the same line",
      Math.max(...centres) - Math.min(...centres) <= 1,
      row.map((b) => `${b.t}@${b.centre}`).join(" "),
    );
    const families = new Set(row.map((b) => b.family));
    const sizes = new Set(row.map((b) => b.size));
    check(
      "...and they are all in one face at one size, the glyph included",
      families.size === 1 && sizes.size === 1,
      `families ${[...families].join("|")}, sizes ${[...sizes].join("|")}`,
    );
  }

  // ── 3. Play ends the row ─────────────────────────────────────────────
  const order = await page.evaluate(() => {
    const bar = document.querySelector(".scriare-topbar");
    const group = bar ? bar.lastElementChild : null;
    if (!group) return null;
    return [...group.querySelectorAll("button")].map((b) => b.textContent.trim());
  });
  check(
    "Play is the last control in the group rather than the middle of it",
    Array.isArray(order) && order.length > 0 && /play/i.test(order[order.length - 1]),
    Array.isArray(order) ? order.join(" | ") : "group not found",
  );

  // ── 4. nothing hand-rolls a button here any more ─────────────────────
  //
  // The decay guard. Six copies of one class string is how this started,
  // and each of them was the quickest thing to write on the day.
  const src = await readFile(join(root, "src/renderer/src/components/layout/TopBar.tsx"), "utf8");
  const handRolled = [...src.matchAll(/className="[^"]*\brounded-md border border-\[var\(--border\)\][^"]*"/g)].map(
    (m) => m[0].slice(0, 70),
  );
  check(
    "no button in the top bar is hand-written any more",
    handRolled.length === 0,
    handRolled.join(" | ") || "none",
  );
  // Undo and redo stay raw on purpose: they are icon targets with their own
  // reasoning beside them, not members of this row. Stated so that a future
  // reader does not "finish the job" by converting them too.
  check(
    "...while undo and redo are deliberately still their own thing",
    /Icon name="undo"/.test(src) && /Icon name="redo"/.test(src),
    "the two icon buttons are untouched",
  );

  // ── 5. the Story Graph's chapter box ─────────────────────────────────
  //
  // Thinned from 2px to 1px in this version so a chapter stops competing
  // with the scene cards inside it — but the two states where the box has
  // to be unmissable, being dragged and being dropped into, put the weight
  // back. A thinner resting border that also thinned the drop target would
  // have traded a small readability win for a real usability loss, so both
  // halves are asserted together.
  const frame = await readFile(join(root, "src/renderer/src/components/graph/GroupNode.tsx"), "utf8");
  const css = await readFile(join(root, "src/renderer/src/styles/index.css"), "utf8");
  check(
    "a chapter box rests at one pixel, not two",
    /scriare-frame-box[^`]*\bborder border-dashed/.test(frame) && !/scriare-frame-box[^`]*border-2/.test(frame),
    frame.match(/scriare-frame-box[^`]{0,60}/)?.[0] ?? "not found",
  );
  check(
    "...and gets the weight back when it is dragged or dropped into",
    (css.match(/\.scriare-frame-box \{\s*\n\s*border-color: var\(--accent\);\s*\n\s*border-width: 2px;/g) || []).length === 2,
    `${(css.match(/border-width: 2px;/g) || []).length} rules restore the weight`,
  );

  await seedProject();
  await wait(200);
  check(
    "the workspace is handed back to the next spec",
    await api(() => Boolean(window.__scriareProjectStore.getState().project)),
  );
}
