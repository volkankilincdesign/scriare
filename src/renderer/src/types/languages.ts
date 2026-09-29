/**
 * The languages a story can say it is written in (v0.75.0).
 *
 * A SHORT LIST, not the IANA registry. There are several hundred valid
 * BCP-47 tags and a writer choosing one is answering a question about
 * their own story, which they already know the answer to — so the cost of
 * the full list is a scroll through three hundred rows to reach a line
 * they could have found in one glance, and the benefit is coverage of
 * languages nobody is currently writing in. A missing language is one
 * line added here, which is a smaller problem than the list being
 * unusable for everybody.
 *
 * Each entry is the language's own name for itself first, because that is
 * how a writer recognises it, with the tag beside it because the tag is
 * what ends up in the file and on the page.
 *
 * ORDER is deliberate: the two this app was built and tested in come
 * first, and the rest are alphabetical by their English name. Scriare's
 * search folds Turkish properly (`ist` finds İstanbul) and that was a
 * design decision, not an accident — putting Türkçe at the top of this
 * list is the same decision, stated once more.
 */
export interface StoryLanguage {
  /** The BCP-47 tag written into the file and onto `<html lang>`. */
  tag: string;
  /** The language's own name for itself. */
  native: string;
  /** Its English name, for a writer who does not read the native one. */
  english: string;
}

export const STORY_LANGUAGES: StoryLanguage[] = [
  { tag: "tr", native: "Türkçe", english: "Turkish" },
  { tag: "en", native: "English", english: "English" },
  { tag: "ar", native: "العربية", english: "Arabic" },
  { tag: "zh", native: "中文", english: "Chinese" },
  { tag: "nl", native: "Nederlands", english: "Dutch" },
  { tag: "fr", native: "Français", english: "French" },
  { tag: "de", native: "Deutsch", english: "German" },
  { tag: "el", native: "Ελληνικά", english: "Greek" },
  { tag: "hi", native: "हिन्दी", english: "Hindi" },
  { tag: "it", native: "Italiano", english: "Italian" },
  { tag: "ja", native: "日本語", english: "Japanese" },
  { tag: "ko", native: "한국어", english: "Korean" },
  { tag: "fa", native: "فارسی", english: "Persian" },
  { tag: "pl", native: "Polski", english: "Polish" },
  { tag: "pt", native: "Português", english: "Portuguese" },
  { tag: "ru", native: "Русский", english: "Russian" },
  { tag: "es", native: "Español", english: "Spanish" },
  { tag: "sv", native: "Svenska", english: "Swedish" },
  { tag: "uk", native: "Українська", english: "Ukrainian" },
];

/**
 * How a stored tag is shown back.
 *
 * A tag the list does not hold is shown AS ITSELF rather than as "Not
 * set". A story could arrive carrying `en-GB` or `pt-BR` from a hand-edited
 * file or from a future version of this list, and silently redrawing that
 * as unset — then silently dropping it on the next save — would be the app
 * quietly deleting something a writer meant.
 */
export function languageLabel(tag: string | undefined | null): string {
  if (!tag) return "Not set";
  const known = STORY_LANGUAGES.find((l) => l.tag === tag);
  if (!known) return tag;
  return known.native === known.english
    ? `${known.native} — ${known.tag}`
    : `${known.native} (${known.english}) — ${known.tag}`;
}
