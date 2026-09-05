/**
 * Shared "reading column" sizing/typography, used by both the writing editor
 * (SceneEditor) and Play Mode (runtime/PlayRuntime) so a story looks the same whether
 * you're writing it or playing it — same width, same wrap points, same
 * typography. Defined once here instead of duplicated in each component so
 * the two can never quietly drift apart again.
 */

/** Centers the content and caps its width — identical in both places, and
 * independent of how much horizontal space the surrounding layout happens
 * to give that screen (Play Mode has more, since the Content Browser and
 * Inspector are hidden while playing, but the reading column stays the same
 * width either way, just with more empty margin on wide windows). */
export const READING_COLUMN_CLASS = "mx-auto w-full max-w-2xl";

/** Typography for the actual story text. `break-words` guarantees a long
 * unbroken token (a URL, a run-on word) wraps inside the column instead of
 * pushing it wider. */
export const READING_PROSE_CLASS = "prose prose-invert max-w-none break-words";
