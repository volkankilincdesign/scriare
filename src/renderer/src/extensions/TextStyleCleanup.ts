import { Extension } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    textStyleCleanup: {
      /**
       * Strips the `textStyle` mark from any text run in the selection whose
       * attributes (color/fontFamily/fontSize) are now all falsy — the same
       * job `@tiptap/extension-text-style`'s own `removeEmptyTextStyle()` is
       * meant to do after an unset*() call clears one attribute but may
       * leave others behind.
       */
      cleanupTextStyle: () => ReturnType;
    };
  }
}

/**
 * Replaces `removeEmptyTextStyle()` from `@tiptap/extension-text-style`,
 * which has a real bug: it calls `tr.doc.nodesBetween(from, to, ...)` and
 * runs its "does this node still carry a non-empty textStyle mark?" check
 * against EVERY node in the selection — not just the actual text leaves.
 * Its only guard is `if (node.isTextblock) return true`, which skips a
 * `paragraph` (so a plain, non-list selection works fine) but does nothing
 * for other non-textblock container nodes a selection can pass through —
 * `listItem`, `bulletList`, `orderedList`. Those containers never carry
 * marks of their own, so the check ("does this node have a non-empty
 * textStyle mark?") trivially reads "no" for them too, and the function
 * calls `tr.removeMark(pos, pos + node.nodeSize, textStyleType)` across
 * that container's ENTIRE range — stripping the whole `textStyle` mark
 * (color AND fontFamily AND fontSize together) from every text run inside
 * it, including attributes the user never touched. That step happens
 * before the text node's own (correct) check is even evaluated, so the
 * text node's individually-correct outcome gets overwritten regardless.
 * This is exactly why clicking the text-colour "✕" only appeared to also
 * reset font family/size when the selection was inside a bullet or
 * numbered list — outside a list there's no such container between the
 * paragraph and the text, so the bug never had anything to misfire on.
 *
 * This command does the same cleanup job but scoped correctly: it only
 * ever inspects actual text nodes (`node.isText`), so a listItem/bulletList
 * wrapper is walked over (to reach the text inside) but never itself
 * treated as something to strip a mark from.
 */
export const TextStyleCleanup = Extension.create({
  name: "textStyleCleanup",

  addCommands() {
    return {
      cleanupTextStyle:
        () =>
        ({ tr, state }) => {
          const textStyleType = state.schema.marks.textStyle;
          if (!textStyleType) return true;

          const { from, to } = tr.selection;
          tr.doc.nodesBetween(from, to, (node, pos) => {
            if (!node.isText) return true;
            const mark = node.marks.find((m) => m.type === textStyleType);
            if (mark && !Object.values(mark.attrs).some((value) => !!value)) {
              tr.removeMark(pos, pos + node.nodeSize, textStyleType);
            }
            return false;
          });

          return true;
        },
    };
  },
});
