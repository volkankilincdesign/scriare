/**
 * WHICH DICTIONARY, FOR A STORY THAT SAYS WHICH LANGUAGE IT IS IN (v0.88.6).
 *
 * THE BUG. Electron's spellchecker defaults to on, with the dictionary
 * chosen from the app's locale — which on Windows is the Windows display
 * language. Scriare was built on a Turkish Windows, so an English story
 * was checked against a Turkish dictionary, and every single word in it
 * came back misspelled: "The", "tide", "had", all of them, every
 * paragraph, under a red line. Not one typo found in a year of writing,
 * and the first screenshot anybody takes of the editor is ruined.
 *
 * `renderer/index.html` already carries `<html lang="en">`, which is what
 * made this hard to believe. It makes no difference: Chromium's
 * spellchecker reads the SESSION's configured languages, not the
 * document's. The page can say what it is written in as loudly as it
 * likes; nothing is listening.
 *
 * THE FIX. A `.scriare` already records which language the story is
 * written in — the writer picks it in Project Settings and it travels with
 * the file (v0.75.0). That is the only honest source for this: the
 * operating system knows what language the writer's MENUS are in, which is
 * a different question and routinely a different answer.
 *
 * WHY THE AVAILABLE LIST IS PASSED IN. The first version of this file
 * carried a hardcoded table mapping each of the nineteen story languages
 * to a Chromium code, written from memory. That is a guess about another
 * project's internals dressed up as a constant, and it rots the first time
 * Electron's bundled dictionary set changes. `session.availableSpellCheckerLanguages`
 * is the real answer, read at runtime; this function takes it as an
 * argument so the decision is pure and can be tested against any list,
 * including ones this machine does not have.
 *
 * WHY OFF IS A LEGITIMATE ANSWER. Four of the nineteen languages Scriare
 * offers (Arabic, Chinese, Japanese, and anything else Chromium has no
 * Hunspell dictionary for) cannot be checked at all. The choice there is
 * between no spellchecker and the WRONG spellchecker, and the wrong one is
 * what this version is fixing. Off, every time.
 */

export type SpellcheckReason =
  /** The story's tag is a dictionary Chromium has, exactly. */
  | "exact"
  /** The story named a bare language; a region had to be picked. */
  | "region"
  /** Chromium has no dictionary for this language. Spellcheck off. */
  | "unsupported"
  /** No story open, or no language set on it. Spellcheck off. */
  | "none";

export interface SpellcheckChoice {
  /** What to hand `setSpellCheckerLanguages`. Empty means turn it off. */
  languages: string[];
  reason: SpellcheckReason;
}

/**
 * Which region to prefer when a story names a bare language and Chromium
 * offers several.
 *
 * ONLY where the choice is real and has a defensible default. "en" has
 * four dictionaries and picking alphabetically would hand an English story
 * en-AU, which would flag "color" for most of the people who write in it.
 * Portuguese gets pt-PT because the tag is `pt` and not `pt-BR`; a writer
 * who wants Brazilian spelling can say so, once the language list grows
 * regional tags.
 *
 * A language not listed here is not a problem: the fallback picks the
 * first candidate in sorted order, which for every other case in Scriare's
 * list is the only candidate there is.
 *
 * Chinese had an entry here until it was measured. Chromium ships no
 * Chinese Hunspell dictionary, so the line could never fire — a constant
 * that looks like coverage and is not. Removed.
 */
const PREFERRED_REGION: Record<string, string> = {
  en: "en-US",
  pt: "pt-PT",
};

/**
 * @param tag      the story's BCP-47 tag, as stored in the `.scriare`
 * @param available what `session.availableSpellCheckerLanguages` reports
 */
export function resolveSpellcheckLanguage(
  tag: string | null | undefined,
  available: readonly string[],
): SpellcheckChoice {
  const wanted = (tag ?? "").trim();
  if (!wanted) return { languages: [], reason: "none" };

  // Case-insensitively, because a hand-edited file can carry "EN-gb" and a
  // writer who did that meant English.
  const exact = available.find((a) => a.toLowerCase() === wanted.toLowerCase());
  if (exact) return { languages: [exact], reason: "exact" };

  const base = (wanted.split("-")[0] ?? "").toLowerCase();
  if (!base) return { languages: [], reason: "none" };

  const candidates = available
    .filter((a) => {
      const low = a.toLowerCase();
      return low === base || low.startsWith(`${base}-`);
    })
    .sort();
  if (!candidates.length) return { languages: [], reason: "unsupported" };

  const preferred = PREFERRED_REGION[base];
  const chosen =
    (preferred && candidates.find((c) => c.toLowerCase() === preferred.toLowerCase())) ||
    candidates[0];
  // `candidates` is non-empty by the guard above, so this cannot be
  // undefined — spelled out rather than asserted, because the day somebody
  // turns on noUncheckedIndexedAccess should not be the day this breaks.
  return chosen ? { languages: [chosen], reason: "region" } : { languages: [], reason: "unsupported" };
}
