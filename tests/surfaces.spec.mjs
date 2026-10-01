/**
 * One floating panel, in every theme (v0.82.0).
 *
 * THE CLAIM IS NOT "THEY SHARE A CONSTANT" — a test that read the class
 * attribute would prove the import and nothing else. It is that the four
 * menus a writer can open are PAINTED the same, measured off the screen,
 * and that the shadow they are painted with is the theme's own rather
 * than Tailwind's fixed black.
 *
 * The second half is the one that mattered. v0.46.0 wrote down that a
 * black shadow at `shadow-xl`'s strength "reads as dirt on paper" on a
 * light ground, defined `--shadow-floating` in all eight themes to fix
 * it, and applied it twice. Four menus kept the fixed black for
 * twenty-six versions. So this is checked on a LIGHT theme, where the two
 * differ most and where nobody had looked.
 */
export default async function run({ api, check, seedProject }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await seedProject();
  await api(() => window.__scriareProjectStore.getState().selectScene("s1"));
  await wait(200);

  const setTheme = (t) =>
    api((theme) => window.__scriareThemes.useThemeStore.getState().setTheme(theme), t);

  /**
   * Every floating panel, painted, without opening any of them.
   *
   * Each menu is mounted by a different mechanism — a Tiptap suggestion
   * renderer, a right-click handler, a caret position — and driving all
   * four in one spec would be testing those mechanisms rather than the
   * surface. So the surface itself is mounted and measured: a div wearing
   * the same class string the four of them wear, which is the thing under
   * test, plus a probe painted directly from the token to compare it with.
   */
  const painted = async (theme) => {
    await setTheme(theme);
    await wait(120);
    return api(() => {
      const S = window.__scriareSurfaces;
      const host = document.createElement("div");
      document.body.appendChild(host);

      const panel = document.createElement("div");
      panel.className = S.FLOATING_PANEL;
      host.appendChild(panel);

      const probe = document.createElement("div");
      probe.style.boxShadow = "var(--shadow-floating)";
      probe.style.background = "var(--surface)";
      host.appendChild(probe);

      const p = getComputedStyle(panel);
      const q = getComputedStyle(probe);
      const out = {
        background: p.backgroundColor,
        radius: p.borderTopLeftRadius,
        shadow: p.boxShadow,
        tokenShadow: q.boxShadow,
        tokenBackground: q.backgroundColor,
      };
      host.remove();
      return out;
    });
  };

  const dark = await painted("dark");
  const light = await painted("light");

  for (const [name, seen] of [
    ["dark", dark],
    ["light", light],
  ]) {
    // ENDS WITH, not equals. A Tailwind shadow class legitimately carries
    // two empty ring layers in front of the real one
    // (`rgba(0,0,0,0) 0 0 0 0, rgba(0,0,0,0) 0 0 0 0, …`), where the probe
    // sets `box-shadow` directly and has none. Asserting equality made
    // this red against a panel that was painting correctly — a finding
    // about the check, not about the panel.
    check(
      `the floating panel takes the theme's own shadow on ${name}`,
      seen.tokenShadow.length > 0 && seen.shadow.endsWith(seen.tokenShadow),
      `${seen.shadow.slice(-60)} against the token's ${seen.tokenShadow.slice(-60)}`,
    );
    check(
      `...and a raised surface rather than the page's own ground on ${name}`,
      seen.background === seen.tokenBackground,
      `${seen.background} against --surface ${seen.tokenBackground}`,
    );
  }

  // THE POINT OF A TOKEN, stated as a measurement: the same class has to
  // paint a DIFFERENT shadow in a light theme than in a dark one. A fixed
  // Tailwind shadow passes every check above and fails this one, which is
  // why it is here.
  check(
    "the same panel is shadowed differently on a light theme than on a dark one",
    dark.shadow !== light.shadow,
    `dark ${dark.shadow.slice(0, 40)}… / light ${light.shadow.slice(0, 40)}…`,
  );

  await setTheme("dark");

  /* ── the menus themselves wear it ──────────────────────────────── */

  // One of them driven for real, so the constant is not merely defined
  // but reaching a menu a writer can actually open. The slash menu is the
  // cheapest to summon and the one whose empty state had its own second
  // copy of the surface.
  const menu = await api(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    const editor = window.__scriareEditorStore.getState().editor;
    editor.chain().focus().insertContent("/").run();
    await w(400);
    const panel = document.querySelector("[data-slash-menu]");
    const shadow = panel ? String(getComputedStyle(panel).boxShadow) : null;
    const probe = document.createElement("div");
    probe.style.boxShadow = "var(--shadow-floating)";
    document.body.appendChild(probe);
    const token = getComputedStyle(probe).boxShadow;
    probe.remove();
    // Leave the scene as it was found.
    editor.commands.setContent({ type: "doc", content: [{ type: "paragraph" }] });
    await w(150);
    // Snapshotted here, not read later: getComputedStyle is live, and the
    // slash menu is unmounted by the setContent below.
    return { found: Boolean(panel), shadow, token };
  });

  check("the slash menu is really on it", menu.found === true);
  check(
    "...painted with the token, not with a fixed black",
    typeof menu.shadow === "string" && menu.token.length > 0 && menu.shadow.endsWith(menu.token),
    `${String(menu.shadow).slice(-60)}`,
  );

  /* ── no raised surface in the app paints nothing ───────────────── */

  // THE CHECK THIS VERSION EXISTS FOR, generalised past the menus. The
  // defect was not that four menus disagreed; it was that
  // `shadow-[var(--token)]` compiles to `box-shadow: none`, because
  // Tailwind reads an arbitrary shadow value as a shadow COLOUR unless
  // told otherwise. Five surfaces across the app were written that way
  // and none of them had ever cast a shadow.
  //
  // Asserted on the CLASS STRINGS rather than by opening five screens,
  // because the bug lives in what Tailwind generates for a class, and a
  // class that generates nothing generates nothing wherever it is used.
  const everySurface = await api(() => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const measure = (cls) => {
      const el = document.createElement("div");
      el.className = cls;
      host.appendChild(el);
      const shadow = getComputedStyle(el).boxShadow;
      el.remove();
      return shadow;
    };
    const out = {
      floating: measure("shadow-[shadow:var(--shadow-floating)]"),
      raised: measure("shadow-[shadow:var(--shadow-raised)]"),
      // The spelling that silently did nothing, kept as the control's
      // other half: if Tailwind ever starts reading this one correctly,
      // this check becomes uninformative and should be retired.
      unhinted: measure("shadow-[var(--shadow-floating)]"),
    };
    host.remove();
    return out;
  });

  check(
    "the floating shadow class actually paints a shadow",
    everySurface.floating !== "none" && everySurface.floating.length > 4,
    everySurface.floating.slice(0, 50),
  );
  check(
    "the raised shadow class actually paints a shadow",
    everySurface.raised !== "none" && everySurface.raised.length > 4,
    everySurface.raised.slice(0, 50),
  );
  check(
    "...and the hint is why: without it Tailwind reads the token as a colour and paints nothing",
    everySurface.unhinted === "none",
    everySurface.unhinted,
  );

  /* ── the group name KEEPS its own spelling, and why ────────────── */

  // This spec was going to assert that a chapter's name on the graph wore
  // `.scriare-section-label` like every other uppercase heading. It does
  // not, and that is a decision rather than an omission: applying the
  // class breaks the drag-to-select rename gesture, measured three times.
  // The assertion lives next door in entities-and-renaming, where the
  // rename check already was, and a negative control puts the class back
  // and watches that check fail — so the reason is guarded rather than
  // written in a comment nobody reads.
  await api(() => window.__scriareProjectStore.getState().addGraphGroup());
  await wait(320);
  const kept = await api(() => {
    const input = document.querySelector(".react-flow__node input");
    return {
      found: Boolean(input),
      labelled: input ? input.classList.contains("scriare-section-label") : null,
    };
  });
  check("a group is on the graph to measure", kept.found === true);
  check(
    "a chapter's name is not wearing the label class, on purpose",
    kept.found && kept.labelled === false,
    `labelled: ${kept.labelled}`,
  );

  /* ── the row inside the panel (v0.85.0) ──────────────────────────── */

  // v0.82.0 COUNTED THE PANELS AND LEFT THE ROWS. One level down, the same
  // four menus had four spellings of a row, and one of the differences was
  // not cosmetic: the row the keyboard is on was `--surface-2` in the slash
  // menu and `--surface-3` in the mention menu, so "the one Enter takes"
  // was two different colours depending on which menu was open — and a
  // writer can open both on the same line within seconds.
  //
  // THE PROPERTY IS A THREE-WAY SEPARATION, and it is a property rather
  // than a preference because hover and selection can be on screen at the
  // same time: a pointer resting on row one while the arrows sit on row
  // three. If they are painted alike, nothing says which row fires.
  //
  // EVERY THEME, because a ramp that separates in the dark ones and
  // collapses in Daylight is exactly the failure this would have, and the
  // theme list comes from the app rather than from a copy kept here.
  const themeIds = await api(() => window.__scriareThemes.THEMES.map((t) => t.id ?? t));
  const rows = [];
  for (const id of themeIds) {
    await setTheme(id);
    await wait(120);
    rows.push({
      theme: id,
      ...(await api(() => {
        const S = window.__scriareSurfaces;
        const host = document.createElement("div");
        host.className = S.FLOATING_PANEL;
        document.body.appendChild(host);

        const plain = document.createElement("button");
        plain.className = S.MENU_ITEM;
        const picked = document.createElement("button");
        picked.className = `${S.MENU_ITEM} ${S.MENU_ITEM_SELECTED}`;
        host.append(plain, picked);

        // A hover cannot be provoked without a real pointer, so the colour
        // is read from the token and the class is separately asserted to
        // name that token. The two halves together are the whole claim.
        const probe = document.createElement("div");
        probe.style.background = "var(--surface-2)";
        host.appendChild(probe);

        // SNAPSHOT BEFORE REMOVING. getComputedStyle hands back a LIVE
        // object — read it after the element is gone and every value is the
        // document default. v0.82.0 lost an afternoon to that.
        const out = {
          panel: getComputedStyle(host).backgroundColor,
          plain: getComputedStyle(plain).backgroundColor,
          picked: getComputedStyle(picked).backgroundColor,
          hover: getComputedStyle(probe).backgroundColor,
          namesHover: S.MENU_ITEM.includes("hover:bg-[var(--surface-2)]"),
        };
        host.remove();
        return out;
      })),
    });
  }

  check(
    "every theme was walked for this",
    rows.length >= 8,
    `${rows.length} themes: ${rows.map((r) => r.theme).join(", ")}`,
  );
  const collapsed = rows.filter(
    (r) => r.picked === r.panel || r.picked === r.hover || r.hover === r.panel,
  );
  check(
    "a menu row, its hover and its selection are three different colours in every theme",
    collapsed.length === 0,
    collapsed.length
      ? collapsed.map((r) => `${r.theme}: panel ${r.panel} / hover ${r.hover} / picked ${r.picked}`).join(" · ")
      : `e.g. ${rows[0].theme} ${rows[0].panel} → ${rows[0].hover} → ${rows[0].picked}`,
  );
  // TRANSPARENT, NOT "THE PANEL'S COLOUR". The first version of this check
  // asserted `plain === panel` and went red in all eight themes, which was
  // a finding about the check: a row that paints nothing computes as
  // `rgba(0, 0, 0, 0)` and lets the panel show through, so it LOOKS like the
  // panel and does not read like it. Comparing the two would also have
  // passed a row that hard-coded the panel's own colour, which is the thing
  // four of this app's fields were doing wrong two versions ago.
  const opaque = rows.filter((r) => !/^rgba\(0, 0, 0, 0\)$|^transparent$/.test(r.plain));
  check(
    "...and an unselected row adds no fill of its own over the panel",
    opaque.length === 0,
    opaque.length ? opaque.map((r) => `${r.theme}: ${r.plain}`).join(", ") : "all eight paint nothing",
  );
  check(
    "the kit's row is what names the hover colour, not its callers",
    rows.every((r) => r.namesHover === true),
    `${rows.filter((r) => r.namesHover).length}/${rows.length}`,
  );

  await setTheme("dark");
  await wait(120);

  // Left as the next spec would want to find it — the runner's contract.
  await seedProject();
}
