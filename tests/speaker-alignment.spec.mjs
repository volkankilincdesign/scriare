/**
 * Where a speaker's name sits (v0.66.1).
 *
 * Two places wear a name beside words that are bigger than it is: the chip
 * at the head of a prose line, and the attribution in front of a
 * Dialogue's reply. Both were out, and neither was out by enough for a
 * screenshot to prove — which is why this spec measures instead of
 * looking.
 *
 * THE RULE IS NOT "SAME BASELINE" IN BOTH PLACES, and that is the whole
 * point of the file:
 *
 *   - The CHIP is a box, not a word. What the eye lines up is the pill
 *     against the band the letters occupy — cap-height down to baseline —
 *     so the assertion is on the centre of that band. Baselining the
 *     chip's own text (what v0.66.0 did) is what made it hang low.
 *   - The REPLY'S NAME is a word, so it is baselines, measured off the
 *     textarea's first line rather than its box, because a textarea
 *     reports its bottom edge as its baseline and a two-line reply would
 *     otherwise drag the name down with it.
 *
 * Both measurements are taken from font metrics through canvas, not from
 * element boxes: an element box includes leading, and leading is exactly
 * the thing that was hiding the error.
 */
export default async function run({ page, api, check, seedProject }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  await api(() => {
    const store = window.__scriareProjectStore;
    const project = store.getState().project;
    store.setState({
      project: {
        ...project,
        entities: [
          ...project.entities,
          {
            id: "e-align",
            kind: "character",
            name: "Nesrin Aydın",
            aliases: [],
            content: { type: "doc", content: [] },
          },
        ],
      },
    });
    store.getState().selectScene(project.scenes[0].id);
  });
  await wait(450);

  await api(() => {
    const editor = window.__scriareEditorStore.getState().editor;
    const { buildDialogueBlockNode } = window.__scriareDialogue;
    editor.commands.setContent({
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { speaker: "e-align" },
          content: [{ type: "text", text: "There seems to be a misalignment, isn't there?" }],
        },
        buildDialogueBlockNode(
          [
            {
              id: "l-wrap",
              text: '"Who are the six?"',
              // Chosen to WRAP at the narrow width and not at the wide one:
              // the resize check below is only worth having if the number
              // of lines actually changes.
              reply: "People who will do what you do, once you have done it. That is all six of them.",
              replySpeaker: "e-align",
            },
            {
              id: "l-align",
              text: '"How short are you, exactly?"',
              reply: "Nine. Out of a hundred and forty, which is the part that should embarrass somebody, and it does not seem to embarrass anybody at all.",
              replySpeaker: "e-align",
            },
          ],
          "blk-align",
        ),
      ],
    });
  });
  await wait(700);

  // ── the chip against the line ────────────────────────────────────────
  const chip = await api(() => {
    const el = document.querySelector("[data-speaker-chip]");
    if (!el) return { error: "no chip" };
    const para = el.closest("p");
    const textNode = [...para.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
    if (!textNode) return { error: "no line" };

    const range = document.createRange();
    range.selectNodeContents(textNode);
    const textRect = range.getBoundingClientRect();

    const cs = getComputedStyle(para);
    const ctx = document.createElement("canvas").getContext("2d");
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const baseline = textRect.top + ctx.measureText("Hxg").fontBoundingBoxAscent;
    const capTop = baseline - ctx.measureText("H").actualBoundingBoxAscent;

    const pill = el.getBoundingClientRect();
    return {
      offCentre: (pill.top + pill.bottom) / 2 - (capTop + baseline) / 2,
      belowBaseline: pill.bottom - baseline,
      pillHeight: pill.height,
      capBand: baseline - capTop,
    };
  });

  check("the chip is on screen to be measured", !chip.error, chip.error ?? "measured");

  // The number that failed before the fix was 1.63. Half a pixel is the
  // tightest this can be held without the assertion breaking on a font
  // whose cap height rounds differently.
  check(
    "THE CHIP IS CENTRED ON THE LINE'S CAP BAND, not hung off its baseline",
    Math.abs(chip.offCentre) < 0.5,
    `${chip.offCentre?.toFixed(2)}px off centre (pill ${chip.pillHeight?.toFixed(1)}px, band ${chip.capBand?.toFixed(1)}px)`,
  );

  // The visible symptom, asserted separately from its cause: a pill that
  // drops a third of its own height below the baseline reads as falling
  // off the line even when its centre is right.
  check(
    "...and does not hang below the baseline by more than a fifth of itself",
    chip.belowBaseline < chip.pillHeight * 0.2,
    `${chip.belowBaseline?.toFixed(2)}px below a ${chip.pillHeight?.toFixed(1)}px pill`,
  );

  // ── the reply's name against the reply ───────────────────────────────
  const reply = await api(() => {
    const field = document.querySelector('[data-reply-for="l-align"]');
    if (!field) return { error: "no reply field" };
    const name = field.parentElement.querySelector("span");
    if (!name) return { error: "no attribution" };

    const ctx = document.createElement("canvas").getContext("2d");
    const baselineOf = (el, rect) => {
      const cs = getComputedStyle(el);
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const m = ctx.measureText("Hxg");
      const lineHeight = parseFloat(cs.lineHeight);
      const content = m.fontBoundingBoxAscent + m.fontBoundingBoxDescent;
      const halfLeading = (lineHeight - content) / 2;
      const top =
        rect.top + parseFloat(cs.borderTopWidth || "0") + parseFloat(cs.paddingTop || "0");
      return top + halfLeading + m.fontBoundingBoxAscent;
    };

    const nameRect = name.getBoundingClientRect();
    const fieldRect = field.getBoundingClientRect();
    return {
      delta: baselineOf(name, nameRect) - baselineOf(field, fieldRect),
      nameSize: parseFloat(getComputedStyle(name).fontSize),
      replySize: parseFloat(getComputedStyle(field).fontSize),
    };
  });

  check("the reply row is on screen to be measured", !reply.error, reply.error ?? "measured");

  // v0.66.1 — found while photographing the fix above, which is the only
  // reason it was found at all: the reply was in the file, was in the
  // field's value, and had a measured height of ZERO. ProseMirror builds a
  // node view's DOM detached, so the ref callback that grew the textarea
  // measured `scrollHeight` on an element that was not in the document and
  // wrote `0px`. Nothing recomputed it afterwards. The assertion is on the
  // height rather than the value for exactly that reason — the value was
  // never wrong.
  const field = await api(() => {
    const el = document.querySelector('[data-reply-for="l-align"]');
    return { value: el?.value ?? null, height: el?.getBoundingClientRect().height ?? 0 };
  });
  // The reply seeded above is long enough to wrap, so a field that has
  // been measured is TALLER THAN ONE LINE. Asserting "not zero" would now
  // pass on the CSS floor alone, which would make this check a decoration.
  check(
    "A REPLY THAT HAS TEXT IN IT IS TALL ENOUGH TO READ ALL OF IT",
    field.value.startsWith("Nine.") && field.height >= 28,
    `${field.height}px tall for ${field.value.length} characters`,
  );
  check(
    "THE REPLY'S NAME SHARES A BASELINE with the reply's first line",
    Math.abs(reply.delta) < 1,
    `${reply.delta?.toFixed(2)}px apart (${reply.nameSize}px name, ${reply.replySize}px reply)`,
  );

  // v0.67.0 — a height in pixels is an answer to "how many lines does
  // this wrap to", and that answer expires when the column is resized.
  // Collapse a dock or widen the window and a reply that now fits on one
  // line kept two lines' worth of height: measured at 33px drawn against
  // 17px needed, which is the gap Volkan saw under the one-line replies.
  // The column is squeezed and let go again rather than the window being
  // resized: a dock opening does this to the editor and the window never
  // hears about it, which is the case a window listener would miss.
  const squeeze = (px) =>
    api((width) => {
      let el = document.getElementById("tmp-width");
      if (!el) {
        el = document.createElement("style");
        el.id = "tmp-width";
        document.head.appendChild(el);
      }
      el.textContent = width ? `.ProseMirror { max-width: ${width}px !important; }` : "";
    }, px);

  const replyHeight = () =>
    api(() => {
      const el = document.querySelector('[data-reply-for="l-align"]');
      const drawn = el.getBoundingClientRect().height;
      const saved = el.style.height;
      el.style.height = "auto";
      const needed = el.scrollHeight;
      el.style.height = saved;
      return { drawn: +drawn.toFixed(1), needed, width: Math.round(el.getBoundingClientRect().width) };
    });

  await squeeze(280);
  await wait(500);
  const narrow = await replyHeight();
  await squeeze(0);
  await wait(500);
  const wide = await replyHeight();

  check(
    "A COLUMN THAT CHANGES WIDTH RE-MEASURES THE REPLY — no reserved lines left over",
    narrow.drawn > wide.drawn + 4 && Math.abs(wide.drawn - wide.needed) < 2,
    `${narrow.drawn}px at ${narrow.width}px wide → ${wide.drawn}px at ${wide.width}px (needs ${wide.needed})`,
  );

  // ── the button that puts one in ──────────────────────────────────────
  // The slash command existed from v0.66.0; a writer who has never typed
  // a slash had no way to find this block at all.
  const button = await api(() => {
    const el = document.querySelector("[data-insert-dialogue]");
    if (!el) return null;
    const choice = [...document.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === "Choice",
    );
    return {
      label: el.textContent.trim(),
      hasIcon: Boolean(el.querySelector("svg")),
      // Beside the Choice, not somewhere else on the bar.
      sameRow: choice ? Math.abs(el.getBoundingClientRect().top - choice.getBoundingClientRect().top) < 2 : false,
      afterChoice: choice ? el.getBoundingClientRect().left > choice.getBoundingClientRect().left : false,
    };
  });
  check(
    "the toolbar offers the Dialogue beside the Choice",
    Boolean(button) && button.label === "Dialogue" && button.hasIcon && button.sameRow && button.afterChoice,
    JSON.stringify(button),
  );

  const inserted = await api(() => {
    document.querySelector("[data-insert-dialogue]").click();
    const editor = window.__scriareEditorStore.getState().editor;
    let blocks = 0;
    editor.state.doc.descendants((node) => {
      if (node.type.name === "dialogueBlock") blocks += 1;
    });
    return blocks;
  });
  check(
    "...and clicking it puts one in the document",
    inserted === 2,
    `${inserted} dialogue blocks after the click`,
  );

  await seedProject();
  await wait(200);
  check(
    "the workspace is handed back to the next spec",
    await api(() => Boolean(window.__scriareProjectStore.getState().project)),
  );
}
