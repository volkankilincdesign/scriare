/**
 * The Variable Manager, rebuilt (v0.56.0).
 *
 * The complaint was visual, so most of what is checked here is what the
 * collapsed row SAYS — because that is the whole argument for the
 * redesign: the row should answer the question you actually have (what is
 * it called, what kind is it, what does it start as) without being
 * opened. The old one showed a name and a dropdown you had to open to
 * read, and repeated the word "Default" on every row.
 */
export default async function run({ api, check, seedProject }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const open = async () => {
    await api(() => {
      window.__scriareUIStore.getState().closeVariableManager();
      window.__scriareToastStore.setState({ toasts: [] });
    });
    await api(() => window.__scriareUIStore.getState().openVariableManager());
    await wait(220);
  };

  await seedProject();
  await api(() => {
    const store = window.__scriareProjectStore;
    const { buildVariable, changeVariableType } = window.__scriareVariables;
    const make = (name, type, value, description) => ({
      ...changeVariableType({ ...buildVariable(), name, description }, type),
      defaultValue: value,
    });
    store.setState({
      project: {
        ...store.getState().project,
        variables: [
          make("Trust", "number", 0, "How far Yseide believes you"),
          make("HasLedger", "boolean", false, "Picked it up in the Long Hall"),
          make("Route", "string", "north", ""),
          make("PlayerName", "string", "", ""),
        ],
      },
    });
  });
  await open();

  const rows = await api(() =>
    [...document.querySelectorAll("[data-variable-id]")].map((row) => {
      const text = row.innerText.replace(/\s+/g, " ").trim();
      const chip = row.querySelector("span");
      const del = [...row.querySelectorAll("button")].find((b) =>
        (b.getAttribute("title") ?? "").startsWith("Delete"),
      );
      const box = del ? del.getBoundingClientRect() : null;
      return {
        text,
        open: row.querySelectorAll("input, select").length > 0,
        delete: box ? { w: Math.round(box.width), h: Math.round(box.height) } : null,
        chip: chip ? chip.textContent.trim() : null,
      };
    }),
  );

  check(
    "every variable is a row, closed",
    rows.length === 4 && rows.every((r) => !r.open),
    `${rows.length} rows`,
  );

  check(
    "THE TYPE IS A WORD, not a dropdown you have to open",
    // The caret is the first word; the type is the second. Read from the
    // chip itself would be reading the component — this reads what the
    // row SAYS, which is the claim.
    rows.map((r) => r.text.split(" ")[1]).join(",") === "NUMBER,BOOLEAN,STRING,STRING",
    rows.map((r) => r.text.split(" ")[1]).join(" · "),
  );

  check(
    "...and the row says what it starts as, without being opened",
    rows[0].text.includes("starts 0") &&
      rows[1].text.includes("starts False") &&
      rows[2].text.includes("starts “north”"),
    rows.map((r) => r.text).join("  |  "),
  );

  check(
    "an empty string starts as a visible pair of quotes, not as nothing",
    rows[3].text.includes("starts “”"),
    JSON.stringify(rows[3].text),
  );

  check(
    "the word “Default” is not repeated on every row",
    rows.every((r) => !/default/i.test(r.text)),
    rows[0].text,
  );

  check(
    "the delete is a real target, not a bare glyph",
    rows.every((r) => r.delete && r.delete.w >= 18 && r.delete.h >= 18),
    JSON.stringify(rows[0].delete),
  );

  // ── opening one ─────────────────────────────────────────────────────
  const opened = await api(async () => {
    const wait2 = (ms) => new Promise((r) => setTimeout(r, ms));
    const row = document.querySelector("[data-variable-id]");
    row.querySelector("button").click();
    await wait2(140);
    const fields = [...row.querySelectorAll("label")].map((l) =>
      (l.querySelector("span")?.textContent ?? "").trim(),
    );
    const others = [...document.querySelectorAll("[data-variable-id]")].slice(1);
    return {
      fields,
      othersStayClosed: others.every((r) => r.querySelectorAll("input, select").length === 0),
    };
  });
  // Five since v0.72.0. "Called, to the reader" sits above "What it is
  // for" on purpose: the second is a note to yourself, the first is prose
  // a player can end up reading off a locked choice.
  check(
    "opening a row shows the five things a variable is",
    opened.fields.join(", ") === "Name, Type, Starts at, Called, to the reader, What it is for",
    opened.fields.join(", "),
  );
  check(
    "...one at a time",
    opened.othersStayClosed,
    "the other three stayed closed",
  );

  // ── adding one ──────────────────────────────────────────────────────
  const added = await api(async () => {
    const wait2 = (ms) => new Promise((r) => setTimeout(r, ms));
    const dialog = document.querySelector('[role="dialog"]');
    const add = [...dialog.querySelectorAll("button")].find((b) =>
      b.textContent.includes("Add Variable"),
    );
    add.click();
    await wait2(160);
    const rows2 = [...document.querySelectorAll("[data-variable-id]")];
    const last = rows2[rows2.length - 1];
    return {
      count: rows2.length,
      lastIsOpen: last.querySelectorAll("input, select").length > 0,
      onlyOneOpen: rows2.filter((r) => r.querySelectorAll("input, select").length > 0).length,
    };
  });
  check(
    "a new variable arrives open, ready to be named",
    added.count === 5 && added.lastIsOpen && added.onlyOneOpen === 1,
    `${added.count} rows, ${added.onlyOneOpen} open`,
  );

  // ── put it back ─────────────────────────────────────────────────────
  await api(() => window.__scriareUIStore.getState().closeVariableManager());
  await seedProject();
  await wait(150);
  check(
    "the workspace is handed back to the next spec",
    await api(() => Boolean(window.__scriareProjectStore.getState().project)),
  );
}
