import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { DialogueLineView } from "../components/editor/DialogueLineView";
import { DIALOGUE_LINE_TYPE } from "../types/nodeTypes";

/**
 * One thing that can be said (v0.66.0).
 *
 * The line itself is inline content, exactly as a choice option's label is
 * — so the toolbar styles it, Find searches it, and a mention inside it
 * renames with its entity.
 *
 * THE REPLY IS AN ATTRIBUTE, NOT CONTENT, and that is a decision rather
 * than an oversight. As content it could carry mentions and colour like
 * the line; as an attribute it is a plain string the writer types into one
 * field without selecting anything. Flat first, because a reply you can
 * style is also a reply you have to click into to edit, and this block is
 * meant to be quick to fill. Promoting it later is additive: the attribute
 * becomes the fallback for a document written before the change.
 *
 * Everything structured round-trips as JSON in a data attribute for the
 * same reason ChoiceOption's does — Play Mode renders through an HTML
 * pass, and anything not serialised there is lost on the way.
 */
export const DialogueLine = Node.create({
  name: DIALOGUE_LINE_TYPE,
  content: "inline*",
  defining: true,
  // Never on its own: a line outside a Dialogue has nowhere to be drawn.
  isolating: true,

  addAttributes() {
    return {
      lineId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-line-id"),
        renderHTML: (attrs) => ({ "data-line-id": attrs.lineId }),
      },
      speaker: {
        default: "@player",
        parseHTML: (el) => el.getAttribute("data-speaker") || null,
        renderHTML: (attrs) => ({ "data-speaker": attrs.speaker ?? "" }),
      },
      reply: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-reply") ?? "",
        renderHTML: (attrs) => ({ "data-reply": attrs.reply ?? "" }),
      },
      replySpeaker: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-reply-speaker") || null,
        renderHTML: (attrs) => ({ "data-reply-speaker": attrs.replySpeaker ?? "" }),
      },
      /** "stay" | "end" | "leave" — see types/nodeTypes.ts. */
      after: {
        default: "stay",
        parseHTML: (el) => {
          const raw = el.getAttribute("data-after");
          return raw === "end" || raw === "leave" ? raw : "stay";
        },
        renderHTML: (attrs) => ({ "data-after": attrs.after ?? "stay" }),
      },
      targetSceneId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-target") || null,
        renderHTML: (attrs) => ({ "data-target": attrs.targetSceneId ?? "" }),
      },
      repeatable: {
        default: false,
        parseHTML: (el) => el.getAttribute("data-repeatable") === "true",
        renderHTML: (attrs) => ({ "data-repeatable": attrs.repeatable ? "true" : "false" }),
      },
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
      style: {
        default: null,
        parseHTML: (el) => safeParseObject(el.getAttribute("data-style")),
        renderHTML: (attrs) => (attrs.style ? { "data-style": JSON.stringify(attrs.style) } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="dialogue-line"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "dialogue-line" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DialogueLineView);
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

function safeParseObject(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
