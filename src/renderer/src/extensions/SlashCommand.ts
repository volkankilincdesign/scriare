import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion from "@tiptap/suggestion";
import type { SuggestionOptions } from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import { NARRATIVE_BLOCKS } from "../narrativeBlocks/registry";
import type { NarrativeBlockDefinition } from "../narrativeBlocks/types";
import { SlashCommandMenu } from "../components/editor/SlashCommandMenu";
import type { SlashCommandMenuHandle } from "../components/editor/SlashCommandMenu";

export interface SlashCommandOptions {
  items: NarrativeBlockDefinition[];
}

// A lightweight "/" command palette, built on Tiptap's own Suggestion
// utility rather than a bespoke input-tracking system. Typing "/" opens a
// small floating menu (SlashCommandMenu, rendered via ReactRenderer and
// positioned at the caret) listing whatever's in the Narrative Blocks
// registry, filtered by what's typed after the "/". Choosing an item
// deletes the "/query" text and runs that block's own command — the same
// insertChoiceBlock/setHorizontalRule/toggleBlockquote/toggleCallout the
// toolbar already calls, so the menu is just another way to reach them.
const SLASH_SUGGESTION_KEY = new PluginKey("slashSuggestion");

export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: "slashCommand",

  addOptions() {
    return {
      items: NARRATIVE_BLOCKS,
    };
  },

  addProseMirrorPlugins() {
    const items = this.options.items;

    const suggestion: Omit<SuggestionOptions<NarrativeBlockDefinition, NarrativeBlockDefinition>, "editor"> = {
      // Named so that Escape can dispatch this plugin's own exit meta —
      // see onKeyDown below. Without a key of its own there is no way to
      // address the plugin, and Escape could only hide its popup.
      pluginKey: SLASH_SUGGESTION_KEY,
      char: "/",
      allowSpaces: false,
      startOfLine: false,
      items: ({ query }) => {
        const q = query.trim().toLowerCase();
        if (!q) return items;
        return items.filter(
          (item) =>
            item.title.toLowerCase().includes(q) || item.keywords.some((keyword) => keyword.includes(q)),
        );
      },
      // `props` here is the selected item itself (Suggestion resolves
      // TSelected to whatever the menu passed its own `command()` call) —
      // each Narrative Block already knows how to insert itself.
      command: ({ editor, range, props }) => {
        props.command(editor, range);
      },
      render: () => {
        let component: ReactRenderer<SlashCommandMenuHandle> | null = null;
        let popup: HTMLDivElement | null = null;

        function position(rect: DOMRect | null): void {
          if (!popup || !rect) return;
          popup.style.left = `${rect.left}px`;
          popup.style.top = `${rect.bottom + 6}px`;
        }

        return {
          onStart: (props) => {
            component = new ReactRenderer(SlashCommandMenu, { editor: props.editor, props });
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
                props.view.state.tr.setMeta(SLASH_SUGGESTION_KEY, { deactivate: true }),
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
      Suggestion<NarrativeBlockDefinition, NarrativeBlockDefinition>({
        editor: this.editor,
        ...suggestion,
      }),
    ];
  },
});
