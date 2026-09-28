/**
 * Siblings (v0.67.0).
 *
 * Volkan's rule, in his words: a Choice Block and a Dialogue are related,
 * like brothers, and the Dialogue takes its design from the Choice. Only
 * the behaviour is allowed to differ.
 *
 * So this spec does not check that the Dialogue's row is a particular
 * colour — a colour is a thing a theme decides and a writer can restyle.
 * It checks that the two rows are THE SAME, in every one of the eight
 * themes, whatever that same happens to be. A hard-coded expectation would
 * pass on the day it was written and say nothing afterwards; this fails
 * the moment the two blocks start disagreeing, which is the only thing
 * anybody actually cares about.
 *
 * v0.66.0's row was `bg-[var(--surface)] border-[var(--border-soft)]`
 * while a choice row painted the writer's own Choice Style — so they
 * disagreed in all eight, and a writer who restyled their choices found
 * their conversations had not moved with them.
 */
export default async function run({ api, check, seedProject }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  await api(() => {
    const store = window.__scriareProjectStore;
    store.getState().selectScene(store.getState().project.scenes[0].id);
  });
  await wait(400);

  await api(() => {
    const editor = window.__scriareEditorStore.getState().editor;
    const { buildChoiceBlockNode } = window.__scriareChoiceUtils;
    const { buildDialogueBlockNode } = window.__scriareDialogue;
    editor.commands.setContent(
      {
        type: "doc",
        content: [
          buildChoiceBlockNode([{ id: "o-1", text: "A choice" }], "blk-c"),
          buildDialogueBlockNode([{ id: "l-1", text: "A line", reply: "A reply." }], "blk-d"),
        ],
      },
      true,
    );
  });
  await wait(700);

  // ── the INSPECTOR's folded rows ───────────────────────────────────────
  // v0.67.1 — the half v0.67.0 missed. The editor's rows matched and this
  // panel's did not: a 6px card with no fill of its own and a filled strip
  // across the top, beside an 8px card filled with --bg. In eight themes
  // that is eight mismatches, and it is also why a line being dragged was
  // see-through — a card with no background has nothing to hide what is
  // behind it once it lifts out of flow.
  const readPanelRow = (selector) =>
    api((sel) => {
      const el = document.querySelector(sel);
      if (!el) return { error: `no row for ${sel}` };
      const cs = getComputedStyle(el);
      const head = el.firstElementChild;
      const hs = head ? getComputedStyle(head) : null;
      return {
        background: cs.backgroundColor,
        border: cs.borderTopColor,
        width: cs.borderTopWidth,
        radius: cs.borderTopLeftRadius,
        headFill: hs ? hs.backgroundColor : null,
        headHeight: head ? Math.round(head.getBoundingClientRect().height) : null,
        title: (() => {
          const t = el.querySelector("button span:nth-child(2)");
          return t ? getComputedStyle(t).fontSize : null;
        })(),
      };
    }, selector);

  const readPair = () =>
    api(() => {
      const choice = document.querySelector(".ProseMirror .scriare-choice-option");
      const line = document.querySelector(".ProseMirror .scriare-dialogue-line");
      if (!choice || !line) return { error: "a row is missing" };
      const of = (el) => {
        const cs = getComputedStyle(el);
        return {
          background: cs.backgroundColor,
          border: cs.borderTopColor,
          width: cs.borderTopWidth,
          radius: cs.borderTopLeftRadius,
          padding: `${cs.paddingTop} ${cs.paddingLeft}`,
        };
      };
      return { choice: of(choice), line: of(line) };
    });

  const themes = await api(() => window.__scriareThemes.THEMES.map((t) => t.id ?? t));
  check("there are themes to walk", themes.length >= 6, themes.join(", "));

  const disagreements = [];
  for (const theme of themes) {
    await api((id) => window.__scriareThemes.useThemeStore.getState().setTheme(id), theme);
    await wait(280);
    const pair = await readPair();
    if (pair.error) {
      disagreements.push(`${theme}: ${pair.error}`);
      continue;
    }
    for (const key of Object.keys(pair.choice)) {
      if (pair.choice[key] !== pair.line[key]) {
        disagreements.push(`${theme} ${key}: choice ${pair.choice[key]} vs line ${pair.line[key]}`);
      }
    }
  }

  check(
    "A DIALOGUE ROW AND A CHOICE ROW ARE THE SAME BOX, in every theme",
    disagreements.length === 0,
    disagreements.slice(0, 4).join(" | ") || `${themes.length} themes agree`,
  );

  // And when the writer restyles a choice, the conversation moves with it
  // — which is the part a shared colour token would NOT have given us.
  const restyled = await api(() => {
    const store = window.__scriareProjectStore;
    const project = store.getState().project;
    const styles = project.choiceStyles ?? [];
    if (styles.length === 0) return { error: "no choice styles" };
    store.setState({
      project: {
        ...project,
        choiceStyles: styles.map((style, i) =>
          i === 0
            ? { ...style, box: { ...style.box, fill: "#3b1d2e", border: "#8c3b63", radius: 12 } }
            : style,
        ),
      },
    });
    return { ok: true };
  });
  await wait(400);

  const afterRestyle = await readPair();
  check(
    "...and restyling the choices restyles the conversation with them",
    !restyled.error &&
      !afterRestyle.error &&
      afterRestyle.line.background === afterRestyle.choice.background &&
      afterRestyle.line.radius === afterRestyle.choice.radius &&
      afterRestyle.line.background !== "rgba(0, 0, 0, 0)",
    JSON.stringify(afterRestyle),
  );

  // Now the same question, one panel to the right.
  const panelGaps = [];
  for (const theme of themes) {
    await api((id) => window.__scriareThemes.useThemeStore.getState().setTheme(id), theme);
    await wait(200);

    await api(() => {
      const store = window.__scriareProjectStore;
      window.__scriareInspectorStore.getState().selectTarget({
        kind: "choice",
        sceneId: store.getState().selectedSceneId,
        blockId: "blk-c",
      });
    });
    await wait(320);
    const choiceRow = await readPanelRow("aside [data-option-id]");

    await api(() => {
      const store = window.__scriareProjectStore;
      window.__scriareInspectorStore.getState().selectTarget({
        kind: "dialogue",
        sceneId: store.getState().selectedSceneId,
        blockId: "blk-d",
      });
    });
    await wait(320);
    const lineRow = await readPanelRow("aside [data-dialogue-line-id]");

    if (choiceRow.error || lineRow.error) {
      panelGaps.push(`${theme}: ${choiceRow.error ?? lineRow.error}`);
      continue;
    }
    for (const key of Object.keys(choiceRow)) {
      if (choiceRow[key] !== lineRow[key]) {
        panelGaps.push(`${theme} ${key}: choice ${choiceRow[key]} vs line ${lineRow[key]}`);
      }
    }
  }

  check(
    "THE INSPECTOR'S FOLDED ROWS ARE THE SAME ROW, in every theme",
    panelGaps.length === 0,
    panelGaps.slice(0, 4).join(" | ") || `${themes.length} themes agree`,
  );

  // The card's fill is what makes a lifted row opaque. Asserted as its own
  // check, in the words of the complaint: you can see through it.
  const opacity = await api(() => {
    const row = document.querySelector("aside [data-dialogue-line-id]");
    if (!row) return { error: "no row" };
    const fill = getComputedStyle(row).backgroundColor;
    const alpha = /rgba?\(([^)]+)\)/.exec(fill);
    const parts = alpha ? alpha[1].split(",").map((n) => parseFloat(n)) : [];
    return { fill, alpha: parts.length === 4 ? parts[3] : 1 };
  });
  check(
    "A DIALOGUE ROW HAS A FILL OF ITS OWN — nothing shows through it when it is lifted",
    !opacity.error && opacity.alpha === 1 && opacity.fill !== "rgba(0, 0, 0, 0)",
    JSON.stringify(opacity),
  );

  await api(() => window.__scriareThemes.useThemeStore.getState().setTheme("dark"));
  await seedProject();
  await wait(200);
  check(
    "the workspace is handed back to the next spec",
    await api(() => Boolean(window.__scriareProjectStore.getState().project)),
  );
}
