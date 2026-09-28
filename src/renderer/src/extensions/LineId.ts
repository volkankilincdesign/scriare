import { Extension } from "@tiptap/core";
import { Slice } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { findIdFaults, freshContentId, stripPastedIds } from "../utils/contentIds";

/**
 * The ids a document keeps, and the two places they can go wrong (v0.66.0,
 * rebuilt v0.69.0).
 *
 * Prose had no identity: a line was "the third paragraph of scene 19",
 * which stops being true the moment somebody inserts a sentence above it.
 * Fine for a script read once; fatal for a translation memory, which keys
 * off the id — and that is the whole reason the spreadsheet export is
 * queued behind the Dialogue rather than in front of it.
 *
 * v0.66.0 declared the attribute, stamped existing projects on open, and
 * filled in new paragraphs as they were created. That was three quarters
 * of the job. The quarter it missed is that NONE of it could see a
 * duplicate — every piece only ever filled a missing id — and the app
 * produced duplicates in two ordinary ways:
 *
 *   SPLITTING. `keepOnSplit: false` is still declared below and still
 *   reads like it prevents this, but it only holds at the end of a block.
 *   Tiptap consults the flag in the one branch of `splitBlock` that passes
 *   node types to `tr.split`, which is the `atEnd` branch; a caret in the
 *   middle of a sentence takes the other path and ProseMirror's own
 *   default copies every attribute to both halves. Measured with a real
 *   keypress before any of this was written: Enter at the end of a
 *   paragraph gave two ids, Enter mid-sentence gave one, twice.
 *
 *   PASTING. Every id round-trips through a `data-*` attribute, so the
 *   clipboard carried them back in verbatim.
 *
 * So there are now two mechanisms rather than one, at two heights:
 *
 *   `transformPasted` clears ids on the way in, because that is the only
 *   moment the editor can tell an arriving node from the one it was copied
 *   from. After the transaction lands, nothing can.
 *
 *   The sweep repairs whatever is left — a missing id, or one already
 *   claimed earlier in the document. Document order decides the keeper, so
 *   splitting a sentence leaves the id on the half that starts it.
 *
 * Both are deliberately blunt and cheap: the common case is a document
 * with no faults, which costs one walk and no transaction.
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
            /**
             * Kept, even though the audit showed it only bites at the end
             * of a block. Where it does work it is the cheaper answer —
             * the new paragraph simply arrives without an id and the sweep
             * fills it, rather than arriving with a wrong one that has to
             * be noticed and replaced. Removing it would make the common
             * Enter slower for no gain, and would leave a reader of the
             * sweep wondering why end-of-block splits never appear in it.
             */
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
   * Clearing the ids off anything pasted or dropped (v0.69.0).
   *
   * A ProseMirror plugin rather than an editor option because `paste-rules`
   * and the other Tiptap internals also register `transformPasted`, and
   * ProseMirror composes every plugin's version in order — an editor-level
   * option would have to be the only one.
   */
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("lineIdPaste"),
        props: {
          // The open depths are carried through untouched: they describe
          // where the slice's edges join the document, which stripping an
          // attribute cannot change. Rebuilding them would be the bug
          // where pasting into the middle of a sentence starts a new one.
          transformPasted: (slice) =>
            new Slice(stripPastedIds(slice.content), slice.openStart, slice.openEnd),
        },
      }),
    ];
  },

  /**
   * The sweep, and since v0.71.0 it does two jobs rather than one.
   *
   * A paragraph created while writing gets its id here rather than at
   * creation: ProseMirror builds nodes from the schema's defaults and
   * there is no hook that runs per node. So the document is checked after
   * each change, and only the nodes actually at fault are written — one
   * transaction, and none at all in the common case.
   *
   * The second job is NAMING. A line is born empty and takes a provisional
   * id; the first sweep after it has words replaces that with a key made
   * of the words themselves, and no sweep after that ever touches it. The
   * naming is therefore a one-way door that swings exactly once per line,
   * which is what makes the key an identity rather than a caption that
   * follows the writer around.
   */
  onUpdate() {
    const { state, view } = this.editor;
    const faults = findIdFaults(state.doc);
    if (faults.length === 0) return;

    const tr = state.tr;
    for (const { pos, attr, name } of faults) {
      const node = tr.doc.nodeAt(pos);
      if (!node) continue;
      // `name` is the key the line's own words earn it. Null means it has
      // no words yet, so it takes a provisional id and will be named by a
      // later sweep — the first one that runs after the writer types.
      tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        [attr]: name ?? freshContentId(node.type.name),
      });
    }
    // Not added to the undo stack and not a reason to mark the project
    // dirty on its own: this is bookkeeping the writer never asked for.
    tr.setMeta("addToHistory", false);
    tr.setMeta("scriare:lineIds", true);
    view.dispatch(tr);
  },
});
