import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import type { SuggestionOptions } from "@tiptap/suggestion";
import { MentionView } from "../components/editor/MentionView";
import { MentionMenu } from "../components/editor/MentionMenu";
import type { MentionMenuHandle, MentionMenuItem } from "../components/editor/MentionMenu";
import { useProjectStore } from "../state/projectStore";
import { bestNameFor, matchEntities } from "../types/entities";

export const MENTION_TYPE = "mention";

/**
 * Tiptap's Suggestion plugin keys itself as plain `suggestion` unless told
 * otherwise, and the "/" block menu already claims that name — two of them
 * in one editor is a hard ProseMirror error ("Adding different instances of
 * a keyed plugin") that takes the whole editor down on mount, not a
 * degraded menu. Naming this one keeps the two menus strangers.
 */
const MENTION_SUGGESTION_KEY = new PluginKey("mentionSuggestion");

/**
 * A mention of a Character or Location (v0.35.0) — `@Mara` in the middle of
 * a sentence.
 *
 * The node stores the entity's ID, and only the id is authoritative. That
 * is the entire point: rename Mara and every sentence she appears in says
 * the new name, because none of them ever stored the old one. A mention is
 * a reference, not a copy, the same way a choice's destination is a scene
 * id rather than a scene title.
 *
 * `label` is stored alongside it, but as a RECORD OF WHAT WAS WRITTEN
 * rather than as the truth — a writer who typed "the doctor" meant "the
 * doctor", not "Mara", and a story where every alias silently collapses
 * into one name is a worse story. If that text stops being one of the
 * entity's names (the alias was deleted, the entity renamed), the mention
 * falls back to the current name, so a page can never show a name the
 * story no longer uses. And if the entity is deleted outright, the label is
 * all that's left and the sentence still reads — which is why it's stored
 * at all.
 *
 * An atom: a mention is one thing to the caret, one backspace to delete.
 * Typing inside someone's name would produce a mention that claims to be a
 * person it no longer names.
 */
export const Mention = Node.create({
  name: MENTION_TYPE,
  inline: true,
  group: "inline",
  atom: true,

  addAttributes() {
    return {
      entityId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-entity-id"),
        renderHTML: (attrs) => ({ "data-entity-id": attrs.entityId }),
      },
      label: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-label") ?? el.textContent ?? "",
        renderHTML: (attrs) => ({ "data-label": attrs.label ?? "" }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="mention"]' }];
  },

  /**
   * Renders the label as the element's text, so a mention survives the
   * HTML round trip Play Mode renders through. The runtime swaps in the
   * entity's current name before that (see utils/mentions.ts), so what a
   * player reads is never a stale name.
   */
  renderHTML({ HTMLAttributes, node }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-type": "mention", class: "scriare-mention" }),
      String(node.attrs.label ?? ""),
    ];
  },

  renderText({ node }) {
    return String(node.attrs.label ?? "");
  },

  addNodeView() {
    return ReactNodeViewRenderer(MentionView);
  },

  addProseMirrorPlugins() {
    const suggestion: Omit<SuggestionOptions<MentionMenuItem, MentionMenuItem>, "editor"> = {
      char: "@",
      // A name can have a space in it ("the doctor"), but only one: allowing
      // unlimited spaces means an unmatched "@" swallows the rest of the
      // paragraph into a menu query that will never match anything.
      allowSpaces: true,
      items: ({ query }) => {
        const project = useProjectStore.getState().project;
        const entities = project?.entities ?? [];
        const trimmed = query.trim();
        // One space is a name; two is prose that happens to follow an @.
        if (trimmed.split(/\s+/).length > 2) return [];

        const matches = matchEntities(entities, trimmed)
          .slice(0, 8)
          .map<MentionMenuItem>((entity) => ({
            kind: "entity",
            entity,
            label: bestNameFor(entity, trimmed),
          }));

        // Create-on-the-spot. The writer is mid-sentence: the point is that
        // they never have to stop, file paperwork, and come back.
        if (trimmed.length > 0 && !matches.some((m) => m.label.toLowerCase() === trimmed.toLowerCase())) {
          matches.push({ kind: "create", entityKind: "character", label: trimmed });
          matches.push({ kind: "create", entityKind: "location", label: trimmed });
        }
        return matches;
      },

      command: ({ editor, range, props }) => {
        const store = useProjectStore.getState();
        const entityId =
          props.kind === "entity"
            ? props.entity.id
            : // `select: false` — creating a character from inside a
              // sentence must not navigate away from the sentence.
              store.createEntity(props.entityKind, props.label, { select: false });
        if (!entityId) return;

        editor
          .chain()
          .focus()
          .insertContentAt(range, [
            { type: MENTION_TYPE, attrs: { entityId, label: props.label } },
            // A space after, so the writer keeps typing prose rather than
            // landing inside the mention they just made.
            { type: "text", text: " " },
          ])
          .run();
      },

      render: () => {
        let component: ReactRenderer<MentionMenuHandle> | null = null;
        let popup: HTMLDivElement | null = null;

        function position(rect: DOMRect | null): void {
          if (!popup || !rect) return;
          popup.style.left = `${rect.left}px`;
          popup.style.top = `${rect.bottom + 6}px`;
        }

        return {
          onStart: (props) => {
            component = new ReactRenderer(MentionMenu, { editor: props.editor, props });
            popup = document.createElement("div");
            popup.style.position = "fixed";
            popup.style.zIndex = "1000";
            popup.appendChild(component.element);
            document.body.appendChild(popup);
            position(props.clientRect?.() ?? null);
          },
          onUpdate: (props) => {
            component?.updateProps(props);
            position(props.clientRect?.() ?? null);
          },
          onKeyDown: (props) => {
            if (props.event.key === "Escape") {
              popup?.remove();
              return true;
            }
            return component?.ref?.onKeyDown(props) ?? false;
          },
          onExit: () => {
            popup?.remove();
            component?.destroy();
            popup = null;
            component = null;
          },
        };
      },
    };

    return [
      Suggestion<MentionMenuItem, MentionMenuItem>({
        editor: this.editor,
        pluginKey: MENTION_SUGGESTION_KEY,
        ...suggestion,
      }),
    ];
  },
});
