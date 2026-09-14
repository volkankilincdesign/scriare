/**
 * Case- and accent-insensitive text folding, and the index map that lets a
 * match in folded text point back at the real characters.
 *
 * The folding rule itself moved here from types/entities.ts unchanged, and
 * that file now imports it: the @ menu and Find must agree about what
 * counts as the same word, and two implementations of "is this the same
 * text" drift apart the first time one of them is fixed.
 *
 * Turkish is why this isn't `toLowerCase()`. Scriare is written in Turkish
 * as often as in English, and Turkish has two letter i's: dotted (i/İ) and
 * dotless (ı/I). That breaks the obvious implementations in both
 * directions — `toLocaleLowerCase("tr")` turns the I of "İstanbul" into a
 * dotless ı, so searching `ist` finds nothing; and a plain `toLowerCase()`
 * leaves "Aydın" with a dotless ı that `aydin` will never match.
 *
 * So: decompose, drop the combining marks (which handles ş ğ ü ö ç, é, ñ
 * and the rest for free), fold the dotless i onto the dotted one
 * explicitly, and only then lowercase — with the invariant locale, because
 * the Turkish one is the thing being worked around.
 */
export function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u0131\u0130]/g, "i")
    .toLowerCase()
    .trim();
}

/**
 * The same folding, character by character, with a map back to where each
 * folded character came from.
 *
 * Find needs this and matching alone doesn't: once "İSTANBUL'DA" has been
 * folded to "istanbulda" and the query matches at folded index 0, the
 * snippet has to highlight the characters the WRITER typed, in their
 * original case and with their original accents. Folding is not
 * length-preserving in either direction — "İ" decomposes to two code
 * points and folds back to one, "ß" lowercases to two — so a folded index
 * is not an original index and pretending otherwise puts the highlight a
 * few characters off in exactly the languages this app exists to support.
 *
 * `map[i]` is the index in the ORIGINAL string of the character that
 * produced folded character `i`. A character that folds to nothing (a
 * lone combining mark) contributes no entry; one that folds to several
 * contributes the same original index several times.
 *
 * Deliberately NOT trimmed, unlike `fold` above: an index map has to line
 * up with the string it came from.
 */
export function foldWithMap(value: string): { folded: string; map: number[] } {
  let folded = "";
  const map: number[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const piece = fold(value[i]);
    for (const char of piece) {
      folded += char;
      map.push(i);
    }
  }
  return { folded, map };
}

/**
 * Every place `needle` occurs in `haystack`, ignoring case and accents,
 * as ranges in the ORIGINAL string.
 *
 * Overlapping matches are not reported — a search for "aa" in "aaa" finds
 * one match, not two — because a reader counting occurrences on the page
 * would count one too.
 */
export function foldedMatches(
  haystack: string,
  needle: string,
): { start: number; end: number }[] {
  const query = fold(needle);
  if (!query) return [];
  const { folded, map } = foldWithMap(haystack);
  const found: { start: number; end: number }[] = [];

  let at = folded.indexOf(query);
  while (at !== -1) {
    const start = map[at];
    // The end is one PAST the last character that matched, in original
    // indexes — not `start + query.length`, which is the folded length and
    // would cut "İstanbul" short by the code point that folding dropped.
    const end = map[at + query.length - 1] + 1;
    if (start !== undefined && end !== undefined) found.push({ start, end });
    at = folded.indexOf(query, at + query.length);
  }
  return found;
}
