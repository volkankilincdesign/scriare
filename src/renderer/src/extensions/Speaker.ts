import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { EditorState } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";
import { useProjectStore } from "../state/projectStore";
import { CHOICE_OPTION_TYPE } from "../types/nodeTypes";
import { speakerRun } from "../utils/speakerLines";
import { PLAYER_SPEAKER, SPEAKER_HOSTS, speakerName } from "../types/speaker";
import type { Speaker as SpeakerValue } from "../types/speaker";

export const SPEAKER_PLUGIN_KEY = new PluginKey("speakerChips");

/** Fired on the editor's DOM when a writer clicks a speaker chip. */
export const SPEAKER_CLICK_EVENT = "scriare:speaker-click";

export interface SpeakerClickDetail {
  /** Position of the node carrying the speaker. */
  pos: number;
  speaker: SpeakerValue;
  /** Where the chip is on screen, for placing the menu under it. */
  rect: DOMRect;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    speaker: {
      /** Sets (or, with null, clears) the speaker of the node at `pos`. */
      setSpeakerAt: (pos: number, speaker: SpeakerValue) => ReturnType;
      /** Sets the speaker of whatever node the caret is in. */
      setSpeaker: (speaker: SpeakerValue) => ReturnType;
    };
  }
}

/**
 * Speaker attribution in the writing editor (v0.37.0).
 *
 * Three things, which together are the whole authoring story:
 *
 *  1. the `speaker` ATTRIBUTE on a paragraph and on a choice option (see
 *     types/speaker.ts for why an attribute and not a block), carried
 *     across an Enter by `keepOnSplit`;
 *  2. the NAME, drawn in front of the line as a widget decoration;
 *  3. one key — Backspace at the head of a spoken line gives it back to
 *     narration, which is the way out that Enter's carrying makes
 *     necessary.
 *
 * The name is a DECORATION rather than part of the document, which is the
 * load-bearing decision here. As document content it would be text a writer
 * could put the caret inside, select half of, bold, or delete a letter from
 * — producing a line attributed to "Mar". As a decoration it is a fact
 * about the line rendered next to the line: uneditable, unselectable, not
 * in the text, not in the word count, and free to re-read the entity's
 * CURRENT name every time it draws, so renaming a character renames every
 * line she speaks with no migration of anything.
 *
 * It is drawn on EVERY spoken line, including the ones Play Mode will keep
 * quiet about (see speakerRun) — dimmed, but there. The writer is the one
 * person who must always be able to see who is talking; the reader is the
 * one person who mustn't be told three times.
 */
export const Speaker = Extension.create({
  name: "speaker",
  // Above StarterKit's, so Backspace can drop a speaker before the default
  // binding merges the line into the one above it.
  priority: 1000,

  addGlobalAttributes() {
    return [
      {
        types: SPEAKER_HOSTS,
        attributes: {
          speaker: {
            default: null,
            /**
             * This one line IS "Enter carries the speaker forward".
             *
             * Tiptap carries an attribute across a block split when it is
             * marked this way, so a writer who ends a line and presses
             * Enter keeps talking as the same person — which is the whole
             * reason a speech can be more than one sentence without
             * re-declaring who is giving it. It is stated explicitly
             * rather than left to the default because it is a decision,
             * and because the version where it silently stops being the
             * default is a version where the feature quietly gets worse.
             *
             * An earlier draft of this did the same job with an Enter
             * keybinding, which had to be given higher priority than
             * StarterKit's and then taught to hand the key back whenever
             * the @ or / menu was open. The negative control refused to
             * go red when that handler was disabled — which is how the
             * handler was found to have never been doing anything.
             */
            keepOnSplit: true,
            parseHTML: (el) => el.getAttribute("data-speaker") || null,
            renderHTML: (attrs) =>
              attrs.speaker ? { "data-speaker": attrs.speaker as string } : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setSpeakerAt:
        (pos, speaker) =>
        ({ tr, dispatch, state }) => {
          const node = state.doc.nodeAt(pos);
          if (!node || !SPEAKER_HOSTS.includes(node.type.name)) return false;
          if (dispatch) tr.setNodeAttribute(pos, "speaker", speaker);
          return true;
        },
      setSpeaker:
        (speaker) =>
        ({ tr, dispatch, state }) => {
          const $from = state.selection.$from;
          for (let depth = $from.depth; depth > 0; depth -= 1) {
            if (SPEAKER_HOSTS.includes($from.node(depth).type.name)) {
              if (dispatch) tr.setNodeAttribute($from.before(depth), "speaker", speaker);
              return true;
            }
          }
          return false;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      /**
       * Backspace at the head of a spoken line hands it back to narration
       * instead of merging it into the line above.
       *
       * This is the way OUT, and it has to be one key: Enter gives every
       * new line a speaker, so without this a writer who wants to drop
       * back into prose has to find a menu. Pressing it again does what
       * Backspace has always done, so nothing is lost — only delayed by
       * exactly one keystroke, at the one moment where that keystroke is
       * overwhelmingly likely to be what was meant.
       */
      Backspace: ({ editor }) => {
        const { selection } = editor.state;
        if (!selection.empty) return false;
        const $from = selection.$from;
        if ($from.parent.type.name !== "paragraph") return false;
        if ($from.parentOffset !== 0) return false;
        if (!$from.parent.attrs.speaker) return false;
        return editor.commands.setSpeaker(null);
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: SPEAKER_PLUGIN_KEY,
        props: {
          /**
           * Recomputed from `state` on every view update rather than kept
           * in plugin state and mapped through transactions. The chips are
           * one small DOM node per spoken line — a rebuild is cheaper than
           * the bookkeeping would be, and it means the names can never
           * drift out of step with the document.
           *
           * Renaming a character doesn't touch the document, so the editor
           * would keep drawing the old name; SceneEditor pokes the view
           * with an empty transaction when the entity list changes, which
           * lands here as an ordinary redraw.
           */
          decorations: (state) => buildSpeakerChips(state),
        },
      }),
    ];
  },
});

function buildSpeakerChips(state: EditorState): DecorationSet {
  const entities = useProjectStore.getState().project?.entities ?? [];
  const decorations: Decoration[] = [];
  const run = speakerRun();

  state.doc.descendants((node: PMNode, pos: number) => {
    const isOption = node.type.name === CHOICE_OPTION_TYPE;
    const isParagraph = node.type.name === "paragraph";

    if (!isParagraph && !isOption) {
      // Everything else ends whatever run was going — see speakerRun.
      if (node.isBlock) run.breakRun();
      return true;
    }

    const speaker = (node.attrs.speaker as SpeakerValue) ?? null;
    // A choice is always announced; a line only when the speaker changes.
    const fresh = isOption ? true : run.line(speaker);
    if (!speaker) return false;

    const name = speakerName(speaker, entities);
    if (!name) return false;

    decorations.push(
      Decoration.widget(pos + 1, () => chipElement(pos, speaker, name, fresh), {
        // Before the line's own content, and left of the caret when the
        // caret is at position 0 — otherwise typing at the head of a line
        // would appear to happen before the name.
        side: -1,
        // Keyed so ProseMirror reuses the same DOM node across redraws
        // instead of replacing it mid-click.
        key: `speaker:${pos}:${speaker}:${name}:${fresh}`,
      }),
    );
    // Don't descend: a paragraph's children are text, and a choice
    // option's are its label.
    return false;
  });

  return DecorationSet.create(state.doc, decorations);
}

function chipElement(pos: number, speaker: SpeakerValue, name: string, fresh: boolean): HTMLElement {
  const chip = document.createElement("span");
  chip.className = `scriare-speaker-chip${fresh ? "" : " is-continuation"}`;
  chip.setAttribute("data-speaker-chip", speaker ?? "");
  chip.setAttribute("data-speaker-name", name);
  chip.setAttribute("contenteditable", "false");
  chip.textContent = name;
  chip.title =
    speaker === PLAYER_SPEAKER
      ? "The player speaks this line — click to change"
      : `${name} speaks this line — click to change`;

  // Typing is for writing, clicking is for fixing. Six weeks later the line
  // should be someone else's, and nobody should have to delete an
  // attribute they can't see to do that.
  chip.addEventListener("mousedown", (event) => {
    // The chip is not in the document, so a mousedown here would otherwise
    // put the caret somewhere arbitrary before the menu even opens.
    event.preventDefault();
    event.stopPropagation();
    const detail: SpeakerClickDetail = {
      pos,
      speaker,
      rect: chip.getBoundingClientRect(),
    };
    chip.dispatchEvent(
      new CustomEvent<SpeakerClickDetail>(SPEAKER_CLICK_EVENT, { detail, bubbles: true }),
    );
  });

  return chip;
}
