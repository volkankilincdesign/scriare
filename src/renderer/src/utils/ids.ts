import { customAlphabet } from "nanoid";

/**
 * A key is a NAME (v0.71.0).
 *
 * Three versions of this in three days, and the first two were wrong in
 * the same way: they kept asking what an id should look like instead of
 * who reads it.
 *
 * v0.70.0 shipped `nanoid()` — twenty-one characters of mixed case,
 * `xU40lTnJ8JVN16hgSPB2I`. Never a decision; the library's default, taken
 * in the first hour of the project, invisible for sixty-nine versions
 * because nothing outside the app ever read an id. The spreadsheet export
 * made it column A and it read as ciphertext.
 *
 * v0.70.1 made it `t_tr9tmhw8` — shorter, prefixed, no ambiguous letters.
 * Calmer, and still unreadable, because it was still trying to be opaque.
 *
 * THE AUDIT'S REASONING HAD A GAP. `docs/spreadsheet-export.md` argues
 * that identity and address pull apart — "is this the same line I sent you
 * last week" must never change, "scene 15, dialogue 2" must change the
 * moment the story does — and concludes the Key is opaque. But it weighed
 * only the translator. Column A is also the CSV's RowName, which is the
 * `FName` an engine looks a row up by and the string shown in a
 * DataTable's row list; gibberish there is gibberish in the editor and in
 * every reference to a specific line. What the audit actually established
 * is narrower than "opaque":
 *
 *     a key must never change, and must not be positional
 *
 * `t_indigo-does-not-look` satisfies both. Opacity was never the
 * requirement — it was what the only stable option happened to look like.
 *
 * SO A KEY IS NAMED ONCE AND FROZEN. A line is born empty, so it takes a
 * provisional random id; the first time it has words it takes its name,
 * and after that nothing renames it — not a rewrite, not a move, not a
 * reordering. That is what makes it an identity rather than a label.
 *
 * THE COST, stated because it is the whole cost: a key can outlive its
 * words. Rewrite "Indigo does not look blue" into something else and the
 * key still says `t_indigo-does-not-look`. That is correct — the columns
 * beside it carry the current truth — but it means the name is a
 * birthmark, not a description.
 *
 * SCOPE. Scene ids, entity ids and variable ids stay exactly as they are:
 * they are pointed at by choices, by every mention, by every condition and
 * by the content tree, so reshaping them is a project-wide remap for
 * something nobody reads. A scene's TITLE row gets its own stored key, for
 * the same reason every other row has one — deriving it from the title
 * would rename it whenever the scene was renamed, which is precisely the
 * failure the audit warned about one level up.
 */

/** No 0/O, no 1/l/I — the provisional id still gets retyped sometimes. */
export const ID_ALPHABET = "23456789abcdefghjkmnpqrstvwxyz";
const ID_BODY = 8;

/**
 * `customAlphabet` rather than a hand-rolled `Math.random` loop: taking a
 * random byte modulo an alphabet length is biased, only slightly, and in
 * exactly the way nobody ever checks.
 */
const randomBody = customAlphabet(ID_ALPHABET, ID_BODY);

/**
 * Every kind of thing that carries a content id, and the letter it takes.
 * The letter is the first thing in column A, so a glance says what a row
 * is before the Type column repeats it.
 */
export const ID_PREFIX = {
  paragraph: "t",
  dialogueLine: "d",
  dialogueBlock: "b",
  choiceOption: "c",
  choiceBlock: "b",
  condition: "q",
  action: "a",
  scene: "s",
} as const;

export type IdKind = keyof typeof ID_PREFIX;

/**
 * A provisional id, for a line that does not have its words yet.
 *
 * Every line gets one at birth and most of them last milliseconds — the
 * writer types, the sweep runs, the line takes its name. One survives when
 * a line is left genuinely empty, which is exactly when there is nothing
 * to name it after.
 */
export function freshId(kind: IdKind): string {
  return `${ID_PREFIX[kind]}_${randomBody()}`;
}

const PROVISIONAL = new RegExp(`^[a-z]{1,2}_[${ID_ALPHABET}]{${ID_BODY}}$`);
const NAMED = /^[a-z]{1,2}_[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A line still waiting for its words. */
export function isProvisional(id: unknown): boolean {
  return typeof id === "string" && PROVISIONAL.test(id);
}

/**
 * Whether a key is in the current form at all — named, or provisionally
 * waiting to be. Anything else is from a version before v0.70.1 and gets
 * reissued on open.
 */
export function isCurrentIdShape(id: unknown): boolean {
  if (typeof id !== "string") return false;
  return PROVISIONAL.test(id) || (NAMED.test(id) && !/^[a-z]{1,2}_$/.test(id));
}

/**
 * The words of a line, reduced to something that can be a key.
 *
 * Turkish folds to its bare letters rather than vanishing — `ı`, `ş`, `ğ`,
 * `ç`, `ö`, `ü` all have a Latin skeleton and a key of `s_` would be no
 * key at all. Four words and twenty-two characters is the point where a
 * key still fits a spreadsheet column and still says which line it is;
 * past that it stops being a name and becomes a quotation.
 */
export function slugWords(text: string, words = 4, cap = 22): string {
  const folded = text
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ş/g, "s")
    .replace(/Ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/Ğ/g, "g")
    .replace(/ç/g, "c")
    .replace(/Ç/g, "c")
    .replace(/ö/g, "o")
    .replace(/Ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/Ü/g, "u")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const parts = folded.split(/[^a-z0-9]+/).filter(Boolean).slice(0, words);
  return parts.join("-").slice(0, cap).replace(/-+$/, "");
}

/**
 * The key a line takes when it first has words.
 *
 * `taken` is every key already in the document, so two lines that open the
 * same way — "Keep working." twice — become `c_keep-working` and
 * `c_keep-working-2` rather than one row silently overwriting the other on
 * import. The suffix is part of the name from then on, like everything
 * else about it.
 */
export function nameId(kind: IdKind, text: string, taken: ReadonlySet<string>): string | null {
  const body = slugWords(text);
  if (!body) return null;
  const base = `${ID_PREFIX[kind]}_${body}`;
  if (!taken.has(base)) return base;
  for (let n = 2; n < 500; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return null;
}
