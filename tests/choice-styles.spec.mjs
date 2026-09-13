/**
 * Choice Styles (v0.34.0).
 *
 * A choice's box is named once, project-wide, and worn by any number of
 * choices — with per-choice overrides for the one that genuinely is an
 * exception. Three things here can hurt someone:
 *
 *  - AN UNTOUCHED STORY MUST NOT CHANGE. Every choice written before this
 *    version has no style at all, and must resolve to exactly the look it
 *    has always had. A styling feature whose arrival restyles everyone's
 *    existing work is a styling feature nobody trusts again.
 *  - A DELETED STYLE MUST NOT BREAK THE CHOICES WEARING IT. Deletion does
 *    not rewrite documents (that would be a full content walk of every
 *    scene for a cheap edit), so resolution has to survive a dangling id.
 *  - ONE CHOICE'S OVERRIDE IS ONE CHOICE'S. The whole promise is that a
 *    style is shared and an override isn't.
 *
 * The resolution rules are tested directly rather than only through the UI,
 * because they're pure, they're the part everything else depends on, and a
 * colour is far easier to assert than to look at.
 */
export default async function ({ api, check, seedProject }) {
  // 1 — the backwards-compatibility guarantee.
  let r = await api(() => {
    const { resolveChoiceBox, DEFAULT_CHOICE_BOX, normalizeChoiceStyles } =
      window.__scriareChoiceStyles;
    return {
      noStyles: resolveChoiceBox(undefined, null),
      styledProject: resolveChoiceBox(normalizeChoiceStyles([]), null),
      expected: DEFAULT_CHOICE_BOX,
    };
  });
  check("a choice with no style resolves to exactly the default look",
    JSON.stringify(r.noStyles) === JSON.stringify(r.expected) &&
      JSON.stringify(r.styledProject) === JSON.stringify(r.expected),
    JSON.stringify(r.noStyles));

  // 2 — every project has a Default, whatever its file says, and it is
  // always first.
  r = await api(() => {
    const { normalizeChoiceStyles, DEFAULT_CHOICE_STYLE_ID } = window.__scriareChoiceStyles;
    const fromNothing = normalizeChoiceStyles(undefined);
    const fromOthersOnly = normalizeChoiceStyles([
      { id: "danger", name: "Danger", box: { fill: "#900", border: "#f00", borderWidth: 2, radius: 2 } },
    ]);
    return {
      first: fromNothing[0]?.id,
      count: fromNothing.length,
      rescued: fromOthersOnly[0]?.id === DEFAULT_CHOICE_STYLE_ID && fromOthersOnly.length === 2,
      keptTheirs: fromOthersOnly[1]?.name,
    };
  });
  check("a project always has a Default style, and it comes first",
    r.first === "default" && r.count === 1 && r.rescued && r.keptTheirs === "Danger",
    JSON.stringify(r));

  // 3 — a named style is worn, and an override sits on top of it.
  r = await api(() => {
    const { resolveChoiceBox, normalizeChoiceStyles } = window.__scriareChoiceStyles;
    const styles = normalizeChoiceStyles([
      { id: "danger", name: "Danger", box: { fill: "#900000", border: "#ff0000", borderWidth: 3, radius: 2 } },
    ]);
    return {
      named: resolveChoiceBox(styles, { styleId: "danger" }),
      overridden: resolveChoiceBox(styles, { styleId: "danger", overrides: { borderWidth: 5 } }),
      overrideOnly: resolveChoiceBox(styles, { overrides: { radius: 14 } }),
    };
  });
  check("a named style is applied whole",
    r.named.fill === "#900000" && r.named.borderWidth === 3 && r.named.radius === 2,
    JSON.stringify(r.named));
  check("an override changes only what it names",
    r.overridden.fill === "#900000" && r.overridden.borderWidth === 5 && r.overridden.radius === 2,
    JSON.stringify(r.overridden));
  check("an override with no style sits on top of the default",
    r.overrideOnly.radius === 14 && r.overrideOnly.borderWidth === 1,
    JSON.stringify(r.overrideOnly));

  // 4 — the deleted-style case. Deletion deliberately doesn't rewrite
  // documents, so this is the only thing standing between a deleted style
  // and an unreadable choice.
  r = await api(() => {
    const { resolveChoiceBox, DEFAULT_CHOICE_BOX, normalizeChoiceStyles } =
      window.__scriareChoiceStyles;
    const styles = normalizeChoiceStyles([]);
    const gone = resolveChoiceBox(styles, { styleId: "a-style-that-was-deleted" });
    const goneButTweaked = resolveChoiceBox(styles, {
      styleId: "a-style-that-was-deleted",
      overrides: { radius: 12 },
    });
    return {
      fellBack: JSON.stringify(gone) === JSON.stringify(DEFAULT_CHOICE_BOX),
      keptTheTweak: goneButTweaked.radius === 12 && goneButTweaked.fill === DEFAULT_CHOICE_BOX.fill,
    };
  });
  check("a choice wearing a deleted style falls back to Default rather than breaking",
    r.fellBack, `fell back: ${r.fellBack}`);
  check("...keeping its own overrides while it does", r.keptTheTweak);

  // 5 — through the store: adding, editing and deleting a style, and the
  // Default's undeletability.
  r = await api(() => {
    const store = window.__scriareProjectStore;
    const id = store.getState().addChoiceStyle("Danger");
    store.getState().updateChoiceStyle(id, { box: { fill: "#7f1d1d", borderWidth: 3 } });
    const after = store.getState().project.choiceStyles;
    store.getState().deleteChoiceStyle("default");
    const afterDefaultDelete = store.getState().project.choiceStyles.length;
    store.getState().deleteChoiceStyle(id);
    return {
      added: after.length,
      name: after[1]?.name,
      // Merged by key: setting the fill must not wipe the radius.
      box: after[1]?.box,
      defaultSurvived: afterDefaultDelete,
      afterDelete: store.getState().project.choiceStyles.length,
    };
  });
  check("adding a style starts it from the Default's values, not from nothing",
    r.added === 2 && r.name === "Danger" && r.box.radius === 6,
    JSON.stringify(r.box));
  check("editing one value of a style leaves its other values alone",
    r.box.fill === "#7f1d1d" && r.box.borderWidth === 3 && r.box.radius === 6,
    JSON.stringify(r.box));
  check("the Default style cannot be deleted", r.defaultSurvived === 2, `${r.defaultSurvived} styles`);
  check("any other style can", r.afterDelete === 1, `${r.afterDelete} styles`);

  // 6 — end to end: two choices in one block, one styled, one not, painted
  // in Play Mode. This is the only assertion that proves the resolved box
  // actually reaches a pixel.
  await api(() => {
    const store = window.__scriareProjectStore;
    const { buildChoiceBlockNode } = window.__scriareChoiceUtils;
    const now = new Date().toISOString();
    store.setState({
      project: {
        name: "Styled", createdAt: now, updatedAt: now,
        scenes: [
          {
            id: "start", title: "Start", position: { x: 0, y: 0 }, order: 0,
            content: {
              type: "doc",
              content: [
                buildChoiceBlockNode(
                  [
                    { id: "plain", text: "Ordinary choice", targetSceneId: "end" },
                    {
                      id: "loud", text: "Dangerous choice", targetSceneId: "end",
                      style: { styleId: "danger", overrides: { borderWidth: 4 } },
                    },
                  ],
                  "b1",
                ),
              ],
            },
          },
          { id: "end", title: "End", position: { x: 0, y: 0 }, order: 1,
            content: { type: "doc", content: [{ type: "paragraph" }] } },
        ],
        content: ["start", "end"].map((id, i) => ({
          id, kind: "leaf", category: "story", parentId: null, order: i, refType: "scene",
        })),
        favorites: [], variables: [],
        choiceStyles: [
          { id: "default", name: "Default",
            box: { fill: "var(--surface-2-translucent)", border: "var(--border)", borderWidth: 1, radius: 6 } },
          { id: "danger", name: "Danger",
            box: { fill: "rgb(127, 29, 29)", border: "rgb(239, 68, 68)", borderWidth: 1, radius: 2 } },
        ],
        startSceneId: "start",
      },
      filePath: null, selectedSceneId: "start", saveStatus: "saved",
      canUndo: false, canRedo: false, undoLabel: null, redoLabel: null, undoToken: null,
    });
    store.getState().startPlay();
  });
  await new Promise((resolve) => setTimeout(resolve, 250));

  r = await api(() => {
    const buttons = [...document.querySelectorAll("button")].filter((b) =>
      b.textContent.includes("choice"),
    );
    return buttons.map((b) => {
      const css = getComputedStyle(b);
      return {
        text: b.textContent.trim(),
        background: css.backgroundColor,
        borderWidth: css.borderTopWidth,
        radius: css.borderTopLeftRadius,
      };
    });
  });
  const loud = r.find((b) => b.text.includes("Dangerous"));
  const plain = r.find((b) => b.text.includes("Ordinary"));
  check("a styled choice is painted in its style during Play",
    Boolean(loud) && loud.background === "rgb(127, 29, 29)" &&
      loud.borderWidth === "4px" && loud.radius === "2px",
    JSON.stringify(loud));
  check("the choice beside it is untouched",
    Boolean(plain) && plain.borderWidth === "1px" && plain.radius === "6px" &&
      plain.background !== "rgb(127, 29, 29)",
    JSON.stringify(plain));

  await api(() => window.__scriareProjectStore.getState().exitPlay());
  await seedProject();
}
