import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const revealFlashKey = new PluginKey<DecorationSet>("revealFlash");

/** How long the mark stays before it fades itself out. */
export const REVEAL_FLASH_MS = 1800;

/**
 * A temporary mark on the node a writer was just sent to (v0.77.0).
 *
 * WHY A DECORATION AND NOT A CLASS. The obvious version of this is to find
 * the element with `view.nodeDOM(pos)` and add a class to it, and it works
 * until ProseMirror re-renders that node — which it does on the next
 * keystroke, the next decoration pass, or the empty transaction SceneEditor
 * dispatches whenever the entity list changes. The class goes with it, and
 * nothing says so. A decoration is part of what the view is drawing, so it
 * survives re-renders and is mapped through edits for free.
 *
 * WHY IT EXISTS AT ALL, given that Find has scrolled and selected since
 * v0.38.0. Find SELECTS its match, which marks it as a side effect — the
 * selection highlight is the mark. Check Story cannot do that: a finding is
 * something to look at before deciding, and arriving with a whole Choice
 * Block selected means the next keystroke deletes it. So the caret lands
 * collapsed, nothing is selected, and without this the writer arrives at a
 * scene with no indication of which of its six choices they came for.
 *
 * It fades on a timer rather than on the next click, because the mark is an
 * answer to "which one", and that question is answered within a second of
 * arriving. A mark that waits to be dismissed becomes one more thing on
 * screen the writer has to deal with.
 */
export const RevealFlash = Extension.create({
  name: "revealFlash",

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: revealFlashKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, current) {
            const note = tr.getMeta(revealFlashKey) as
              | { from: number; to: number }
              | null
              | undefined;
            if (note === null) return DecorationSet.empty;
            if (note) {
              return DecorationSet.create(tr.doc, [
                Decoration.node(note.from, note.to, { class: "scriare-revealed" }),
              ]);
            }
            // No instruction this transaction: carry the mark through
            // whatever the edit did to the document. `mapping` is why the
            // mark stays on the right node when the writer types above it.
            return current.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return revealFlashKey.getState(state) ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});
