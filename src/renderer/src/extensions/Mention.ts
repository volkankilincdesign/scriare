import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import type { SuggestionOptions } from "@tiptap/suggestion";
import { MentionView } from "../components/editor/MentionView";
import { MentionMenu } from "../components/editor/MentionMenu";
import type { MentionMenuHandle, MentionMenuItem } from "../components/editor/MentionMenu";
import { useProjectStore } from "../state/projectStore";
import { MENTION_TYPE, bestNameFor, isMentionable, matchEntities } from "../types/entities";
import { PLAYER_SPEAKER, PLAYER_SPEAKER_LABEL, SPEAKER_HOSTS, canSpeak } from "../types/speaker";
import type { EditorState } from "@tiptap/pm/state";

/** Re-exported so existing importers keep working; defined in types/entities. */
export { MENTION_TYPE };

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
      items: ({ query, editor }) => {
        const project = useProjectStore.getState().project;
        // A note is the writer talking beside the story, not a thing the
        // story can name — so it never reaches the @ menu (v0.60.0). The
        // filter is here, at the source, rather than on the rendered list:
        // everything downstream (matching, best-name, the menu's keyboard
        // handling) then cannot accidentally offer one.
        const entities = (project?.entities ?? []).filter(isMentionable);
        const trimmed = query.trim();
        // One space is a name; two is prose that happens to follow an @.
        if (trimmed.split(/\s+/).length > 2) return [];

        const attributing = atLineStart(editor.state, query);
        // At the head of a line, a CHARACTER sets the speaker and a
        // LOCATION is still just a mention — a place can be named in a
        // sentence but cannot say one (see canSpeak). Both stay in the
        // list: "@İstanbul was burning" is a perfectly good opening line,
        // and a menu that hid the city to protect a rule would be worse
        // than the rule. The row says which of the two it will do.
        const matches = matchEntities(entities, trimmed)
          .slice(0, 8)
          .map<MentionMenuItem>((entity) => ({
            kind: "entity",
            entity,
            label: bestNameFor(entity, trimmed),
            attributing,
            speaks: attributing && canSpeak(entity),
          }));

        // v0.37.0 — the player, offered only where a speaker can go. An
        // unnamed protagonist is a deliberate choice in a lot of branching
        // fiction, and Scriare shouldn't make a writer invent a Character
        // page for someone they're leaving blank on purpose.
        if (attributing && (!trimmed || fitsPlayer(trimmed))) {
          matches.unshift({ kind: "player", label: PLAYER_SPEAKER_LABEL, attributing, speaks: true });
        }

        // Create-on-the-spot. The writer is mid-sentence: the point is that
        // they never have to stop, file paperwork, and come back.
        if (trimmed.length > 0 && !matches.some((m) => m.label.toLowerCase() === trimmed.toLowerCase())) {
          matches.push({
            kind: "create", entityKind: "character", label: trimmed,
            attributing, speaks: attributing,
          });
          matches.push({
            kind: "create", entityKind: "location", label: trimmed,
            attributing, speaks: false,
          });
        }
        return matches;
      },

      command: ({ editor, range, props }) => {
        const store = useProjectStore.getState();

        // ── The speaker branch (v0.37.0) ────────────────────────────────
        // An @ at the very start of an otherwise empty line doesn't put a
        // name INTO the line — it says who is saying it. Same key, same
        // menu, same create-on-the-spot: the writer already learned that @
        // means "a character", and this is the one place where naming one
        // can only mean attributing the line.
        //
        // Holding Shift while confirming is the way back out, for the rare
        // line that genuinely starts with a mention ("Mara had been
        // waiting."): see MentionMenu's footer, which says so when it
        // matters. A Location never takes this branch at all — `speaks` is
        // decided in `items` above, by canSpeak.
        const asSpeaker = props.speaks === true && props.asMention !== true;

        if (asSpeaker && props.kind === "player") {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .setSpeaker(PLAYER_SPEAKER)
            .run();
          return;
        }

        const entityId =
          props.kind === "player"
            ? null
            : props.kind === "entity"
              ? props.entity.id
              : // `select: false` — creating a character from inside a
                // sentence must not navigate away from the sentence.
                store.createEntity(props.entityKind, props.label, { select: false });
        if (!entityId) return;

        if (asSpeaker) {
          editor.chain().focus().deleteRange(range).setSpeaker(entityId).run();
          return;
        }

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
              // Ends the SUGGESTION, not just its popup. Removing the
              // popup's DOM hid the menu but left the plugin active, and
              // @tiptap/suggestion keeps forwarding keys for as long as it
              // is: Enter then inserted the invisible menu's first item,
              // arrow keys were still swallowed, and typing more characters
              // re-ran onUpdate against a detached popup so the menu never
              // came back. The only way out was to delete the trigger
              // character. Dispatching the plugin's own exit meta is what
              // actually closes it (v0.49.0).
              props.view.dispatch(
                props.view.state.tr.setMeta(MENTION_SUGGESTION_KEY, { deactivate: true }),
              );
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

/**
 * Is the caret's "@" the FIRST CHARACTER of the line (or of the choice)?
 * That — and only that — is where @ attributes instead of writing a name.
 *
 * v0.37.2 loosened this, and the loosening is the fix Volkan reported.
 * The first version also required the line to be otherwise EMPTY, on the
 * theory that a line with prose after it meant the writer was mid-sentence.
 * That theory was wrong about the commonest gesture there is: you write the
 * line first and say who said it afterwards. He wrote a choice, put the
 * caret at its head, typed `@Harun`, and got the name written INTO the
 * choice — so the choice read "Harun I don't understand" with no
 * attribution, no colon and no styling, while the paragraph above it (which
 * he had attributed while it was still empty) read "Harun:" properly.
 *
 * So position 0 is the whole test now. What it costs is the line that
 * genuinely begins with a mention — "Mara had been waiting." — and that
 * has the Shift escape hatch, which the menu's own footer advertises
 * exactly when it applies. An @ anywhere else in the line is a mention as
 * it always was, which is the overwhelming majority of them.
 */
function atLineStart(state: EditorState, query: string): boolean {
  const $from = state.selection.$from;
  const parent = $from.parent;
  if (!SPEAKER_HOSTS.includes(parent.type.name)) return false;
  // And this editor must actually HAVE speakers. A Character's own page is
  // written in the same component with a smaller extension set — no Choice
  // Blocks, no speakers — and there an @ at the head of a line is an
  // ordinary mention, not a command that would silently do nothing. Asking
  // the live schema rather than assuming keeps that true for whatever the
  // next cut-down editor turns out to be.
  if (!parent.type.spec.attrs || !("speaker" in parent.type.spec.attrs)) return false;
  // Already attributed: a second @ on the line is the writer mentioning
  // someone inside a line whose speaker is already settled.
  if (parent.attrs.speaker) return false;
  // The caret sits just after "@" + what has been typed since, so this is
  // "the @ is at offset 0". Counted in ProseMirror positions rather than
  // string indexes, so a mention sitting before it (an atom, width 1) is
  // correctly not position 0.
  return $from.parentOffset - (query.length + 1) === 0;
}

/** Does what's typed look like it's reaching for the player row? */
function fitsPlayer(query: string): boolean {
  const q = query.toLowerCase();
  return ["you", "player", "me", "self"].some((word) => word.startsWith(q));
}
