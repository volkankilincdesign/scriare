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

  // v0.67.2 — and the panel's own header, which is two elements and had
  // three differences: a mixed-case title at text weight instead of the
  // section label, a count where the choices panel puts its add button,
  // and the add button itself at the foot of the list.
  const showPanel = async (kind, blockId) => {
    await api(({ kind, blockId }) => {
      const store = window.__scriareProjectStore;
      window.__scriareInspectorStore.getState().selectTarget({
        kind,
        sceneId: store.getState().selectedSceneId,
        blockId,
      });
    }, { kind, blockId });
    await wait(340);
  };

  const readHeader = (root) =>
    api((sel) => {
      const panel = document.querySelector(sel);
      if (!panel) return { error: `no ${sel}` };
      const h3 = panel.querySelector("h3");
      const add = [...panel.querySelectorAll("button")].find((b) =>
        b.textContent.trim().startsWith("+ Add"),
      );
      if (!h3 || !add) return { error: `${root}: h3 ${Boolean(h3)}, add ${Boolean(add)}` };
      const cs = getComputedStyle(h3);
      return {
        size: cs.fontSize,
        weight: cs.fontWeight,
        transform: cs.textTransform,
        tracking: cs.letterSpacing,
        colour: cs.color,
        // The add button is beside the title, not at the foot of the list.
        addBesideTitle: Math.abs(add.getBoundingClientRect().top - h3.getBoundingClientRect().top) < 12,
      };
    }, root);

  await showPanel("choice", "blk-c");
  const choiceHeader = await readHeader("[data-panel='choices']");
  await showPanel("dialogue", "blk-d");
  const lineHeader = await readHeader("[data-panel='dialogue']");
  const headerGap = { choice: choiceHeader, line: lineHeader };

  check(
    "THE PANEL HEADER IS THE SAME HEADER — label, weight, and the add button beside it",
    !headerGap.choice.error &&
      !headerGap.line.error &&
      JSON.stringify(headerGap.choice) === JSON.stringify(headerGap.line) &&
      headerGap.line.addBesideTitle === true,
    JSON.stringify(headerGap),
  );

  check(
    "THE INSPECTOR'S FOLDED ROWS ARE THE SAME ROW, in every theme",
    panelGaps.length === 0,
    panelGaps.slice(0, 4).join(" | ") || `${themes.length} themes agree`,
  );

  // ── the expanded body ────────────────────────────────────────────────
  // The rows are the same shut; this asks whether they are the same open.
  // Everything compared here is chrome — the panel's own furniture — and
  // not the fields, which differ because a conversation has facts a choice
  // does not.
  const openBody = async (panel, rowSelector) => {
    await api(({ panel, rowSelector }) => {
      const row = document.querySelector(`[data-panel='${panel}'] ${rowSelector}`);
      row.querySelector("button").click();
    }, { panel, rowSelector });
    await wait(320);
    return api(({ panel, rowSelector }) => {
      const row = document.querySelector(`[data-panel='${panel}'] ${rowSelector}`);
      const body = row.lastElementChild;
      const cs = getComputedStyle(body);
      const heading = body.querySelector("h4");
      const hs = heading ? getComputedStyle(heading) : null;
      const note = body.querySelector(".border-dashed");
      const ns = note ? getComputedStyle(note) : null;
      return {
        padding: `${cs.paddingTop} ${cs.paddingLeft}`,
        rule: `${cs.borderTopWidth} ${cs.borderTopColor}`,
        headingSize: hs ? hs.fontSize : null,
        headingWeight: hs ? hs.fontWeight : null,
        headingTracking: hs ? hs.letterSpacing : null,
        headingColour: hs ? hs.color : null,
        noteBorder: ns ? `${ns.borderTopWidth} ${ns.borderTopStyle}` : null,
        // The label column both panels lay their fields out in.
        labelWidth: (() => {
          const label = body.querySelector("span, label");
          return label ? getComputedStyle(label).width : null;
        })(),
        // Counted, not measured: an open choice has one remove control and
        // the line had two — the ✕ in the header plus a "Remove line"
        // button at the foot. That is the kind of extra that makes two
        // panels read as two components even when every colour matches.
        removes: [...row.querySelectorAll("button")].filter((b) => {
          const t = b.textContent.trim().toLowerCase();
          return t === "✕" || t.startsWith("remove");
        }).length,
      };
    }, { panel, rowSelector });
  };

  await showPanel("choice", "blk-c");
  const choiceBody = await openBody("choices", "[data-option-id]");

  await showPanel("dialogue", "blk-d");
  const lineBody = await openBody("dialogue", "[data-dialogue-line-id]");

  check(
    "AN OPEN ROW IS THE SAME CARD TOO — padding, rule, headings, label column",
    JSON.stringify(choiceBody) === JSON.stringify(lineBody),
    `choice ${JSON.stringify(choiceBody)} | line ${JSON.stringify(lineBody)}`,
  );

  // The two controls that were copied by hand and drifted: one component
  // each now, so the assertion is that the same element is on screen.
  const has = (panel) =>
    api((sel) => ({
      speaker: Boolean(document.querySelector(`[data-panel='${sel}'] [data-choice-speaker]`)),
      style: Boolean(document.querySelector(`[data-panel='${sel}'] [data-appearance-for]`)),
    }), panel);

  const lineControls = await has("dialogue");
  await showPanel("choice", "blk-c");
  await api(() => document.querySelector("[data-panel='choices'] [data-option-id] button").click());
  await wait(320);
  const choiceControls = await has("choices");

  check(
    "BOTH PANELS USE THE SAME SPEAKER AND STYLE CONTROLS",
    lineControls.speaker && lineControls.style && choiceControls.speaker && choiceControls.style,
    `line ${JSON.stringify(lineControls)} | choice ${JSON.stringify(choiceControls)}`,
  );

  // The card's fill is what makes a lifted row opaque. Back to the
  // Dialogue's panel first — the check above left the choices' on screen.
  // Asserted as its own check, in the words of the complaint: you can see
  // through it.
  await showPanel("dialogue", "blk-d");
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
