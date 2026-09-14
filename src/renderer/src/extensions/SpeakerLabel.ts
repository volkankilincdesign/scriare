import { Mark, mergeAttributes } from "@tiptap/core";
import { SPEAKER_LABEL_MARK } from "../utils/speakerLines";

/**
 * The mark on a printed speaker name in Play Mode — "MARA: " in front of
 * the line.
 *
 * Registered ONLY in the runtime's schema (runtime/extensions.ts), never in
 * the writing editor's. Nothing a writer types can produce it: it is put
 * into a throwaway copy of the document by `applySpeakerPrefixes` a moment
 * before that copy is rendered, and no document ever saved contains it.
 * Keeping it out of the editor's schema is what guarantees that — a mark
 * the editor cannot parse is a mark the editor cannot accidentally persist.
 *
 * It exists at all rather than reusing `bold` so the name is styleable as
 * what it is. A reader should be able to tell an attribution from a word
 * the writer emphasised, and a story that later wants its speakers in
 * small caps, or in the accent colour, or not visually distinct at all,
 * changes one CSS rule.
 */
export const SpeakerLabel = Mark.create({
  name: SPEAKER_LABEL_MARK,
  // Never spans a mark boundary with anything else — it is a label, not
  // formatting the writer is extending.
  inclusive: false,
  parseHTML() {
    return [{ tag: "span.scriare-speaker" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "scriare-speaker" }), 0];
  },
});
