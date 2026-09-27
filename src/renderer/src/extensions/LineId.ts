import { Extension } from "@tiptap/core";
import { nanoid } from "nanoid";

/**
 * An id every paragraph keeps (v0.66.0).
 *
 * Prose had no identity: a line was "the third paragraph of scene 19",
 * which stops being true the moment somebody inserts a sentence above it.
 * Fine for a script read once; fatal for a translation memory, which keys
 * off the id — and that is the whole reason the spreadsheet export is
 * queued behind the Dialogue rather than in front of it.
 *
 * Two halves, and both are needed. `stampParagraphIds` fills in every
 * paragraph of an existing project on open; this declares the attribute so
 * the schema keeps it, and gives a NEW paragraph one as it is created.
 *
 * `keepOnSplit: false` is the load-bearing line. Tiptap's default carries
 * an attribute across a block split, which is exactly right for `speaker`
 * — press Enter and you are still the same person talking — and exactly
 * wrong here: it would hand the new paragraph the id of the one it was
 * split from, and two paragraphs sharing an id is worse than neither
 * having one.
 */
export const LineId = Extension.create({
  name: "lineId",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph"],
        attributes: {
          lineId: {
            default: null,
            keepOnSplit: false,
            parseHTML: (element) => element.getAttribute("data-line-id"),
            renderHTML: (attributes) =>
              attributes.lineId ? { "data-line-id": attributes.lineId } : {},
          },
        },
      },
    ];
  },

  /**
   * A paragraph created while writing gets its id on the next tick rather
   * than at creation: ProseMirror builds nodes from the schema's defaults
   * and there is no hook that runs per node. So the document is swept
   * after each change, and only the paragraphs still missing an id are
   * written — one transaction, and none at all in the common case.
   */
  onUpdate() {
    const { state, view } = this.editor;
    const missing: number[] = [];
    state.doc.descendants((node, pos) => {
      if (node.type.name === "paragraph" && !node.attrs.lineId) missing.push(pos);
      return true;
    });
    if (missing.length === 0) return;

    const tr = state.tr;
    for (const pos of missing) {
      const node = tr.doc.nodeAt(pos);
      if (!node) continue;
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, lineId: nanoid() });
    }
    // Not added to the undo stack and not a reason to mark the project
    // dirty on its own: this is bookkeeping the writer never asked for.
    tr.setMeta("addToHistory", false);
    tr.setMeta("scriare:lineIds", true);
    view.dispatch(tr);
  },
});
