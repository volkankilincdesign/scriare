import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ChoiceOptionView } from "../components/editor/ChoiceOptionView";

export const CHOICE_OPTION_TYPE = "choiceOption";

/**
 * One option inside a Choice Block (v0.32.0) — and, critically, a node whose
 * LABEL IS REAL TEXT IN THE DOCUMENT.
 *
 * Until now a Choice Block was an atom (`atom: true`) holding an `options`
 * array in a node attribute, each option's label a plain string. That made
 * the label invisible to everything the editor is good at. The toolbar
 * applies marks to a ProseMirror selection over text nodes; there was no
 * text node, so no amount of UI arrangement could ever let a writer bold a
 * word in a choice. Undo didn't see it, find didn't see it, and Play Mode
 * needed its own rendering path for text that every other part of the
 * document got for free.
 *
 * `content: "inline*"` fixes all of that at once. A choice label is now the
 * same kind of thing as a sentence: the existing toolbar styles it with no
 * new code, a single word inside it can be bold or coloured, Ctrl+Z treats
 * it like prose because it IS prose, and `generateHTML` renders it for the
 * runtime alongside everything else.
 *
 * Everything about the option that ISN'T its label — where it goes, what it
 * requires, what it does, how it looks — stays in attributes, because none
 * of that is text a writer types into the flow of a scene. That split is
 * the same one the whole app draws: marks belong to text, properties belong
 * to the thing.
 */
export const ChoiceOption = Node.create({
  name: CHOICE_OPTION_TYPE,
  content: "inline*",
  defining: true,
  // Never on its own — an option outside a Choice Block is meaningless, and
  // letting one exist at the top level would put an orphan in the document
  // that the runtime has nowhere to render.
  isolating: true,

  addAttributes() {
    return {
      optionId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-option-id"),
        renderHTML: (attrs) => ({ "data-option-id": attrs.optionId }),
      },
      targetSceneId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-target") || null,
        renderHTML: (attrs) => ({ "data-target": attrs.targetSceneId ?? "" }),
      },
      // Structured lists round-trip as JSON in a data attribute for the same
      // reason ConditionalBlock's do: Play Mode renders through an HTML
      // pass, and anything not serialised there is lost on the way.
      actions: {
        default: [],
        parseHTML: (el) => safeParse(el.getAttribute("data-actions")),
        renderHTML: (attrs) => ({ "data-actions": JSON.stringify(attrs.actions ?? []) }),
      },
      conditions: {
        default: [],
        parseHTML: (el) => safeParse(el.getAttribute("data-conditions")),
        renderHTML: (attrs) => ({ "data-conditions": JSON.stringify(attrs.conditions ?? []) }),
      },
      whenUnmet: {
        default: "hide",
        parseHTML: (el) => (el.getAttribute("data-unmet") === "lock" ? "lock" : "hide"),
        renderHTML: (attrs) => ({ "data-unmet": attrs.whenUnmet ?? "hide" }),
      },
      /**
       * Per-option appearance overrides (v0.33.0's Choice Style). Absent
       * means "inherit the project's Choice Style" — an empty object here
       * would be indistinguishable from "explicitly the same as the
       * default", and the Inspector needs to tell those apart to offer a
       * reset.
       */
      style: {
        default: null,
        parseHTML: (el) => safeParse(el.getAttribute("data-style")) ?? null,
        renderHTML: (attrs) =>
          attrs.style ? { "data-style": JSON.stringify(attrs.style) } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="choice-option"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "choice-option" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ChoiceOptionView);
  },
});

function safeParse(raw: string | null): unknown[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
