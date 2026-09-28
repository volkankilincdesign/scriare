import { customAlphabet } from "nanoid";

/**
 * What a CONTENT id looks like (v0.70.1).
 *
 * A paragraph, a spoken line, a choice and a block each carry an id, and
 * for sixty-nine versions that id was `nanoid()` — twenty-one characters
 * of mixed case with dashes and underscores, `xU40lTnJ8JVN16hgSPB2I`.
 * Nothing outside the app ever read one, so nothing ever objected.
 *
 * Then the spreadsheet export made that id column A, the Key, and the
 * first thing a translator sees in the file looked like ciphertext. It had
 * never been a decision: it was nanoid's default, taken in the first hour
 * of the project and never revisited, while the design document wrote the
 * Key as `ln-1q` throughout — which is what somebody imagines an id looks
 * like when they have not looked at one.
 *
 *   PREFIXED BY KIND. `t_` a paragraph, `d_` a spoken line, `c_` a choice,
 *   `b_` a block. Column A then says what the row is before the Type
 *   column repeats it, and a key quoted on its own — in a bug report, in
 *   an email about one line — is still legible.
 *
 *   EIGHT CHARACTERS, lower case, from an alphabet with no `0`/`o` and no
 *   `1`/`l`/`i`. A key gets retyped, and every removed character is a
 *   class of mistake that can no longer be made. Thirty to the eighth is
 *   6.5e11 against a story with a few thousand lines — and uniqueness does
 *   not rest on that arithmetic anyway, because the sweep in
 *   `contentIds.ts` reissues a repeat wherever it finds one.
 *
 * SCOPE, deliberately. Scene ids, entity ids and variable ids are left
 * exactly as they are. They are pointed at from half a dozen places each —
 * a choice's destination, every mention, every condition — and rewriting
 * them means a project-wide remap for a column nobody objected to. His
 * call, and the right one: the Key is what is read, so the Key is what
 * changed.
 *
 * WHAT IS NOT FIXED, on purpose: an id is still opaque. A key carrying the
 * scene name or the line's first few words would have to change when the
 * line moved or the words did, and changing is the one thing an identity
 * may never do — which is the whole reason the Ref is a separate column.
 * What changed is that a key now looks like a name instead of a hash.
 */

/** No 0/O, no 1/l/I. Everything here survives being read aloud. */
export const ID_ALPHABET = "23456789abcdefghjkmnpqrstvwxyz";
const ID_BODY = 8;

/**
 * `customAlphabet` rather than a hand-rolled `Math.random` loop: taking a
 * random byte modulo an alphabet length is biased, only slightly, and in
 * exactly the way nobody ever checks.
 */
const randomBody = customAlphabet(ID_ALPHABET, ID_BODY);

/** Every kind of thing that carries an id, and the letter it takes. */
export const ID_PREFIX = {
  paragraph: "t",
  dialogueLine: "d",
  dialogueBlock: "b",
  choiceOption: "c",
  choiceBlock: "b",
  condition: "q",
  action: "a",
} as const;

export type IdKind = keyof typeof ID_PREFIX;

/** A fresh id of the given kind. */
export function freshId(kind: IdKind): string {
  return `${ID_PREFIX[kind]}_${randomBody()}`;
}

const SHAPE = new RegExp(`^[a-z]{1,2}_[${ID_ALPHABET}]{${ID_BODY}}$`);

/** Whether an id is already in the current shape — the migration's test. */
export function isCurrentIdShape(id: unknown): boolean {
  return typeof id === "string" && SHAPE.test(id);
}
