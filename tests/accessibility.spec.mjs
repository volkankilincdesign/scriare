/**
 * Getting around without a mouse (v0.50.0).
 *
 * The v0.48.0 audit's tier 4. Every claim here was reproduced against the
 * running app before anything was changed, and the numbers in the comments
 * are what came back.
 *
 * These are dead ends rather than rough edges, which is the reason they
 * were taken before the performance work: a writer who collapses "Story"
 * with the keyboard could not reopen it, ever, and could not open a
 * character page at all.
 *
 * Driven by real key events wherever a real key is what a writer would
 * press. Poking the store instead would test that the store works, which
 * was never in doubt — the v0.38.0 notes make the same point about a
 * shortcut tested by poking the state behind it.
 */
export default async function run({ page, api, check, seedProject }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  await seedProject();
  await wait(300);

  /* ── the Content panel's rows answer to a keyboard ────────────── */

  // Measured on v0.49.1: {"tag":"DIV","tabIndex":-1,"role":null}. A bare
  // div, for the Story header, both category headers and every character
  // row.
  const reachable = await page.evaluate(() => {
    const describe = (el) =>
      el ? { tag: el.tagName, tabIndex: el.tabIndex, role: el.getAttribute("role") } : null;
    const story = [...document.querySelectorAll("div")].find((d) =>
      /^[▾▸]\s*Story$/.test(d.textContent.trim().replace(/\s+/g, " ")),
    );
    return {
      story: describe(story),
      characters: describe(document.querySelector('[data-category="root:characters"]')),
    };
  });

  check(
    "the Story header can be focused",
    reachable.story?.tabIndex === 0 && reachable.story?.role === "button",
    JSON.stringify(reachable.story),
  );
  check(
    "the Characters header can be focused",
    reachable.characters?.tabIndex === 0 && reachable.characters?.role === "button",
    JSON.stringify(reachable.characters),
  );

  /* ── and Enter actually works them ────────────────────────────── */

  const collapsedByKey = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const story = [...document.querySelectorAll("div")].find((d) =>
      /^[▾▸]\s*Story$/.test(d.textContent.trim().replace(/\s+/g, " ")),
    );
    const sceneRows = () => document.querySelectorAll("[data-content-label]").length;
    const before = sceneRows();
    story.focus();
    const focused = document.activeElement === story;
    story.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await wait(200);
    const afterCollapse = sceneRows();
    story.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await wait(200);
    return { focused, before, afterCollapse, afterReopen: sceneRows() };
  });

  check(
    "Enter on the Story header collapses it",
    collapsedByKey.focused && collapsedByKey.afterCollapse < collapsedByKey.before,
    `${collapsedByKey.before} rows → ${collapsedByKey.afterCollapse}`,
  );
  // The half that made it a dead end rather than a quirk: collapsing was
  // always possible by clicking, but a keyboard user who did it had no way
  // back.
  check(
    "and Enter reopens it",
    collapsedByKey.afterReopen === collapsedByKey.before,
    `${collapsedByKey.afterCollapse} rows → ${collapsedByKey.afterReopen}`,
  );

  /* ── a character page opens without a mouse ───────────────────── */

  const entityByKey = await api(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const store = window.__scriareProjectStore;
    store.setState({
      project: {
        ...store.getState().project,
        entities: [{ id: "a11y-e1", kind: "character", name: "Kestrel", aliases: [], content: null }],
      },
    });
    await wait(120);
    const expand = document.querySelector('[data-category="root:characters"]');
    expand.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await wait(200);
    const row = document.querySelector("[data-entity-row]");
    if (!row) return { opened: null, focusable: false };
    const focusable = row.tabIndex === 0 && row.getAttribute("role") === "button";
    row.focus();
    row.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await wait(200);
    return { focusable, opened: store.getState().selectedEntityId };
  });

  check(
    "a character row can be focused and opened with Enter",
    entityByKey.focusable && entityByKey.opened === "a11y-e1",
    `focusable: ${entityByKey.focusable}, opened: ${entityByKey.opened}`,
  );

  await api(() => window.__scriareProjectStore.getState().selectScene("s1"));
  await wait(200);

  /* ── the focus ring is actually painted ───────────────────────── */

  // Measured on v0.49.1: matches :focus-visible, outline-width 2px,
  // outline-color rgba(0, 0, 0, 0). Tailwind's `focus:outline-none`
  // (specificity 0,2,0) was beating the app's global `:focus-visible` rule
  // (0,1,0) on colour alone, so the ring was drawn in transparent.
  await page.evaluate(() => {
    const label = document.querySelector("[data-content-label]");
    label?.focus();
  });
  // A real Tab, because :focus-visible is decided by how focus arrived.
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await wait(150);

  const ring = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return { none: true };
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName,
      focusVisible: el.matches(":focus-visible"),
      color: cs.outlineColor,
      width: cs.outlineWidth,
      style: cs.outlineStyle,
    };
  });

  const transparent = (c) => !c || /rgba\(0,\s*0,\s*0,\s*0\)|transparent/.test(c);
  check(
    "a keyboard-focused row paints a ring you can see",
    ring.focusVisible === true && !transparent(ring.color) && ring.style !== "none",
    JSON.stringify(ring),
  );

  // The other half, and the reason `focus:outline-none` was there in the
  // first place: a mouse click must NOT leave a ring behind. If it does,
  // removing that class traded an invisible keyboard ring for a ring on
  // every click, which is a worse app than the one we started with.
  //
  // A REAL click, through the browser's input pipeline. The first version
  // dispatched `new MouseEvent(...)` and reported a ring — synthetic events
  // are untrusted, so Chromium scored the focus that followed as
  // programmatic and `:focus-visible` matched. That is a fact about
  // dispatched events, not about clicking, and it would have sent me to fix
  // an app that was behaving correctly.
  const box = await page.evaluate(() => {
    const el = document.querySelector("[data-content-label]");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.click(box.x, box.y);
  await wait(200);

  const afterClick = await page.evaluate(() => {
    const el = document.activeElement;
    const cs = el && el !== document.body ? getComputedStyle(el) : null;
    return {
      tag: el?.tagName ?? "none",
      focusVisible: el?.matches?.(":focus-visible") ?? false,
      outline: cs ? `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}` : "n/a",
    };
  });
  // Judged on what is PAINTED, not on whether `:focus-visible` matches.
  // Chromium goes on matching it for a `div[tabindex]` after a click — that
  // is the whole reason this needed fixing — so asserting the pseudo-class
  // was asserting the browser's heuristic rather than the app's behaviour.
  // The keyboard half above is judged the same way, which is the point: one
  // question, "is there a ring on screen", asked twice.
  check(
    "a real mouse click leaves no ring behind",
    afterClick.outline.startsWith("none") || afterClick.outline.includes("0px"),
    JSON.stringify(afterClick),
  );

  /* ── a dialog says it is one, keeps focus, and gives it back ──── */

  const dialog = await api(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const opener = [...document.querySelectorAll("button")].find(
      (b) => (b.textContent ?? "").trim() === "Check",
    );
    opener.focus();
    const openerWas = document.activeElement === opener;

    window.__scriareUIStore.getState().openStoryCheck();
    await wait(300);

    const card = document.querySelector('[role="dialog"]');
    const inside = card?.contains(document.activeElement) ?? false;

    window.__scriareUIStore.getState().closeStoryCheck();
    await wait(300);

    return {
      openerWas,
      hasRole: Boolean(card),
      ariaModal: card?.getAttribute("aria-modal") ?? null,
      focusMovedIn: inside,
      restored: document.activeElement === opener,
    };
  });

  check("a dialog announces itself as a dialog", dialog.hasRole && dialog.ariaModal === "true",
    `role: ${dialog.hasRole}, aria-modal: ${dialog.ariaModal}`);
  check("opening a dialog moves focus into it", dialog.focusMovedIn === true);
  // Gated on the move, because "focus never left the opener" and "focus
  // came back to the opener" are the same observation — the first version
  // of this check passed on v0.49.1 for exactly that reason, which is a
  // finding about the check rather than about the app.
  check(
    "closing it returns focus to whatever opened it",
    dialog.focusMovedIn === true && dialog.restored === true,
    `moved in: ${dialog.focusMovedIn}, restored: ${dialog.restored}`,
  );

  /* ── Tab does not walk out of an open dialog ──────────────────── */

  await api(() => window.__scriareUIStore.getState().openStoryCheck());
  await wait(350);
  for (let i = 0; i < 12; i += 1) await page.keyboard.press("Tab");
  const trapped = await page.evaluate(() => {
    const card = document.querySelector('[role="dialog"]');
    const el = document.activeElement;
    return {
      inside: card?.contains(el) ?? false,
      landedOn: el?.tagName + ":" + (el?.textContent ?? "").trim().slice(0, 18),
    };
  });
  check(
    "Tab stays inside the dialog instead of walking the app behind it",
    trapped.inside === true,
    JSON.stringify(trapped),
  );
  await api(() => window.__scriareUIStore.getState().closeStoryCheck());
  await wait(250);

  /* ── the Inspector agrees with the canvas about who is in it ──── */

  // READ OFF THE SCREEN, not out of the utility. The first version of this
  // called `extractChoices` and `findChoiceBlockOptions` directly, passing
  // the resolver itself — which tests that the resolver works (never in
  // doubt) and says nothing about whether the Inspector passes one. Both
  // negative controls, reverting each Inspector call site to its unresolved
  // form, went uncaught: the checks were green against the very code they
  // were supposed to be guarding.
  await api(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const store = window.__scriareProjectStore;
    store.setState({
      project: {
        ...store.getState().project,
        entities: [{ id: "a11y-m1", kind: "character", name: "Mara", aliases: [], content: null }],
        scenes: store.getState().project.scenes.map((s) =>
          s.id === "s1"
            ? {
                ...s,
                content: {
                  type: "doc",
                  content: [
                    {
                      type: "choiceBlock",
                      attrs: { blockId: "a11y-b1" },
                      content: [
                        {
                          type: "choiceOption",
                          attrs: { optionId: "a11y-o1", targetSceneId: null },
                          content: [
                            { type: "text", text: "Ask " },
                            { type: "mention", attrs: { entityId: "a11y-m1", label: "Mara" } },
                          ],
                        },
                      ],
                    },
                  ],
                },
              }
            : s,
        ),
      },
    });
    store.getState().selectScene("s1");
    await wait(150);
    // The rename. The stored label on the mention node is now stale BY
    // DESIGN — every reader is supposed to resolve it through the entity
    // list, which is what the graph and Check Story already did.
    store.setState({
      project: {
        ...store.getState().project,
        entities: [
          { id: "a11y-m1", kind: "character", name: "Kestrel", aliases: [], content: null },
        ],
      },
    });
    await wait(250);
  });

  const summaryText = await page.evaluate(() => {
    const panel =
      document.querySelector("[data-inspector]") ??
      [...document.querySelectorAll("div")].find((d) => /Start Scene/.test(d.textContent ?? ""));
    return (panel?.textContent ?? "").replace(/\s+/g, " ");
  });

  check(
    "the Inspector's scene summary shows a renamed character's current name",
    summaryText.includes("Ask Kestrel") && !summaryText.includes("Ask Mara"),
    summaryText.slice(0, 160),
  );

  // Choice Properties is a different reader on the same scene — the one the
  // audit actually named — so it is selected and read the same way.
  await api(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    window.__scriareInspectorStore.getState().selectTarget({
      kind: "choice",
      sceneId: "s1",
      blockId: "a11y-b1",
    });
    await wait(250);
  });

  const choiceText = await page.evaluate(() => {
    const panel =
      document.querySelector("[data-inspector]") ??
      [...document.querySelectorAll("div")].find((d) =>
        /Ask (Kestrel|Mara)/.test(d.textContent ?? ""),
      );
    return (panel?.textContent ?? "").replace(/\s+/g, " ");
  });

  check(
    "and so does Choice Properties",
    choiceText.includes("Ask Kestrel") && !choiceText.includes("Ask Mara"),
    choiceText.slice(0, 160),
  );

  await api(() => window.__scriareInspectorStore.getState().clearTarget());

  /* ── the section labels agree with each other ─────────────────── */

  // Every uppercase micro-label ON SCREEN, not only the ones already
  // carrying the class. The first version queried `.scriare-section-label`
  // — so the negative control that stripped the class from one header made
  // it leave the sample, the remaining labels still agreed with each other,
  // and the check stayed green. A drift detector that only looks at things
  // which have not drifted cannot detect drift.
  const labels = await page.evaluate(() => {
    const spellings = new Map();
    for (const el of document.querySelectorAll("body *")) {
      if (el.children.length > 0) continue;
      const text = (el.textContent ?? "").trim();
      if (text.length < 2 || text.length > 30) continue;
      const cs = getComputedStyle(el);
      if (cs.textTransform !== "uppercase") continue;
      if (Number.parseFloat(cs.fontSize) > 13) continue;
      if (el.closest("[data-content-colour]")) continue;
      const key = `${cs.fontSize}/${cs.fontWeight}/${cs.letterSpacing}`;
      spellings.set(key, [...(spellings.get(key) ?? []), text].slice(0, 3));
    }
    return { count: spellings.size, detail: Object.fromEntries(spellings) };
  });

  check(
    "every section label on screen is the same size, weight and tracking",
    labels.count === 1,
    `${labels.count} spelling(s): ${JSON.stringify(labels.detail)}`,
  );
  check(
    "and it is the 10px one that steps down from the values below it",
    Object.keys(labels.detail)[0]?.startsWith("10px/600/"),
    Object.keys(labels.detail).join(" | ") || "none on screen",
  );

  /* ── hand the panel back the way it was found ─────────────────── */

  // This spec collapses "Story" and toggles "Characters", and the Content
  // Browser remembers which sections are open in localStorage — so the
  // state outlives the spec and the next one inherits it. That is how
  // entities-and-renaming came to report "1 rows": nothing wrong with the
  // app, nothing wrong with that spec, just this one walking off with the
  // furniture. Specs share an application; leaving it as you found it is
  // part of the test.
  await seedProject();
  await wait(200);
  await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const press = (el) =>
      el?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    const story = [...document.querySelectorAll("div")].find((d) =>
      /^[▾▸]\s*Story$/.test(d.textContent.trim().replace(/\s+/g, " ")),
    );
    // "▸" is the collapsed glyph. Expanding what is already expanded would
    // close it, so each one is checked rather than toggled blind.
    if (story && story.textContent.trim().startsWith("▸")) {
      press(story);
      await wait(150);
    }
    // The categories default to CLOSED — `loadExpanded()` returns
    // `new Set([STORY_ROOT])` — and specs that use them click to open,
    // blind. Leaving them open is therefore just as disruptive as leaving
    // Story shut: entities-and-renaming opened its own sections, closed
    // the ones this spec had already opened, and reported no cast.
    for (const key of ["root:characters", "root:locations"]) {
      const row = document.querySelector(`[data-category="${key}"]`);
      if (row && row.textContent.trim().startsWith("▾")) {
        press(row);
        await wait(150);
      }
    }
  });
  await wait(250);
}
