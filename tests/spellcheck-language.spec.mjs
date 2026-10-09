/**
 * THE SPELLCHECKER FOLLOWS THE STORY, NOT THE OPERATING SYSTEM (v0.89.0).
 *
 * THE BUG THIS EXISTS FOR. Electron's spellchecker defaults to on with the
 * dictionary taken from the app's locale — on Windows, the display
 * language. Scriare was written on a Turkish Windows, so an English story
 * was being checked against a Turkish dictionary and every word in it came
 * back wrong: "The", "tide", "had", a red line under all of them, in every
 * paragraph, for twenty-four versions. The suite never saw it, and could
 * not have: a squiggle is painted by Chromium below the DOM and there is
 * no element to query. It was found in a screenshot.
 *
 * SO WHAT IS ASSERTED HERE IS NOT THE SQUIGGLE. It is the decision behind
 * it, read off the real session rather than off the handler's own return
 * value — a handler agreeing with itself proves nothing. Every check below
 * calls `session.getSpellCheckerLanguages()` and
 * `session.isSpellCheckerEnabled()` in the main process.
 *
 * THE INVARIANT, and the reason the middle block walks all nineteen
 * languages rather than spot-checking two: a story must never be checked
 * against a DIFFERENT language's dictionary. Off is allowed — four of the
 * nineteen have no Hunspell dictionary at all — but wrong is not. That is
 * the precise shape of what went wrong, so it is the precise thing stated.
 */
export default async function run({ page, api, check, seedProject, app }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /** What the real Electron session is doing right now. */
  const sessionState = () =>
    app.evaluate(({ session }) => ({
      enabled: session.defaultSession.isSpellCheckerEnabled(),
      languages: session.defaultSession.getSpellCheckerLanguages(),
      available: session.defaultSession.availableSpellCheckerLanguages,
    }));

  /** Set the open story's language the way Project Settings does. */
  const setStoryLanguage = async (tag) => {
    await api((t) => {
      const store = window.__scriareProjectStore.getState();
      store.setStoryDetails({
        name: store.project.name,
        author: store.project.author ?? "",
        language: t,
        playerName: store.project.playerName ?? "",
      });
    }, tag);
    await wait(250);
  };

  await seedProject();
  await wait(300);

  const before = await sessionState();
  check(
    "this Electron build offers dictionaries at all — the precondition",
    Array.isArray(before.available) && before.available.length > 0,
    `availableSpellCheckerLanguages has ${before.available?.length ?? "no"} entries`,
  );

  // ── 1. it follows the story, and demonstrably not the OS ─────────────
  //
  // The discriminating check. `app.getLocale()` is what the old behaviour
  // used; the story is told to be a language that is NOT that, and the
  // session has to go with the story. If this spec ever runs on a machine
  // whose locale happens to be Turkish, the second half picks a different
  // language so the comparison still means something.
  const locale = await app.evaluate(({ app: a }) => a.getLocale());
  const localeBase = String(locale).split("-")[0].toLowerCase();
  const away = localeBase === "tr" ? "de" : "tr";

  await setStoryLanguage(away);
  const followed = await sessionState();
  check(
    "the story's own language decides the dictionary",
    followed.enabled && followed.languages.join(",").toLowerCase().startsWith(away),
    `story says ${JSON.stringify(away)}, session says ${JSON.stringify(
      followed.languages,
    )}, enabled ${followed.enabled}`,
  );
  check(
    "...and the OS locale is not what it used, which is the whole bug",
    !followed.languages.some((l) => l.toLowerCase() === String(locale).toLowerCase()) ||
      localeBase === away,
    `locale ${JSON.stringify(locale)}, session ${JSON.stringify(followed.languages)}`,
  );

  // ── 2. English gets an English dictionary, with a region chosen ──────
  //
  // The story file carries a bare "en". Chromium has no dictionary by that
  // name — it has en-US, en-GB, en-AU, en-CA — so something has to pick,
  // and picking alphabetically would hand an English story en-AU and flag
  // "color" for most of the people writing in it.
  await setStoryLanguage("en");
  const english = await sessionState();
  check(
    "a story written in English is checked in English",
    english.enabled && english.languages.every((l) => l.toLowerCase().startsWith("en")),
    `session says ${JSON.stringify(english.languages)}`,
  );
  check(
    "...in en-US rather than whichever English sorts first",
    english.languages.includes("en-US") ||
      !english.available.includes("en-US"),
    `session says ${JSON.stringify(english.languages)}; en-US ${
      english.available.includes("en-US") ? "is" : "is not"
    } available`,
  );

  // ── 3. the invariant, across every language the app offers ───────────
  //
  // Walked from the app's own list through the test bridge, not from a
  // copy in this file — a copy stops matching the day somebody adds a
  // twentieth language, and stops matching silently.
  const tags = await api(() => window.__scriareLanguages.STORY_LANGUAGES.map((l) => l.tag));
  check(
    "the spec is walking the app's real language list",
    Array.isArray(tags) && tags.length >= 19 && tags.includes("en") && tags.includes("tr"),
    `${tags?.length ?? 0} tags`,
  );

  const wrong = [];
  const off = [];
  for (const tag of tags) {
    await setStoryLanguage(tag);
    const state = await sessionState();
    if (!state.enabled || state.languages.length === 0) {
      off.push(tag);
      continue;
    }
    const base = tag.split("-")[0].toLowerCase();
    for (const chosen of state.languages) {
      if (!chosen.toLowerCase().startsWith(base)) wrong.push(`${tag} → ${chosen}`);
    }
  }

  check(
    "no story is ever checked against another language's dictionary",
    wrong.length === 0,
    wrong.length ? wrong.join(", ") : `${tags.length - off.length} checked, ${off.length} off`,
  );
  check(
    "...and the ones with no dictionary are switched OFF rather than approximated",
    off.every((t) => !before.available.some((a) => a.toLowerCase().startsWith(t.toLowerCase()))),
    `off for: ${off.join(", ") || "none"}`,
  );
  // Stated rather than assumed: if this build turned out to have a
  // dictionary for all nineteen, the check above would be vacuously true
  // and nobody would know. This says which half of the list was exercised.
  check(
    "both halves of the rule were actually exercised by this run",
    off.length > 0 && off.length < tags.length,
    `${tags.length - off.length} languages got a dictionary, ${off.length} got none`,
  );

  // ── 4. a language nothing has a dictionary for turns it off ──────────
  await setStoryLanguage("zz");
  const nonsense = await sessionState();
  check(
    "a tag no dictionary exists for turns the spellchecker off, rather than leaving the last one",
    !nonsense.enabled || nonsense.languages.length === 0,
    `enabled ${nonsense.enabled}, ${JSON.stringify(nonsense.languages)}`,
  );

  // ── 5. closing the story puts it back to off ─────────────────────────
  //
  // Not a detail. Whatever the last story used would otherwise still be
  // loaded on the Welcome screen, whose project-name field is a text
  // input — a small place, but the bug was a wrong dictionary in a small
  // place becoming a wrong dictionary everywhere.
  await setStoryLanguage("en");
  await api(() => {
    window.__scriareProjectStore.setState({ project: null, filePath: null });
  });
  await wait(300);
  const closed = await sessionState();
  check(
    "closing the story turns the spellchecker off",
    !closed.enabled || closed.languages.length === 0,
    `enabled ${closed.enabled}, ${JSON.stringify(closed.languages)}`,
  );

  // ── 6. it is the HOOK doing this, not this spec calling the IPC ──────
  //
  // Everything above drove the project store, never window.api — so if the
  // hook in App.tsx were removed, every check above would go red. This one
  // states that out loud by proving the round trip exists at all, which is
  // the only part the store cannot show.
  await seedProject();
  await wait(300);
  await setStoryLanguage("fr");
  const viaStore = await sessionState();
  const viaApi = await api(() => window.api.spellcheck.state());
  check(
    "the renderer can read back what the main process settled on",
    viaApi && Array.isArray(viaApi.languages) && typeof viaApi.reason === "string",
    JSON.stringify(viaApi),
  );
  check(
    "...and it agrees with the session itself",
    JSON.stringify(viaApi?.languages ?? null) === JSON.stringify(viaStore.languages),
    `renderer ${JSON.stringify(viaApi?.languages)}, session ${JSON.stringify(viaStore.languages)}`,
  );

  // ── put it back ──────────────────────────────────────────────────────
  await seedProject();
  await wait(250);
  check(
    "the workspace is handed back to the next spec",
    await api(() => Boolean(window.__scriareProjectStore.getState().project)),
  );
}
