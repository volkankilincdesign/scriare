import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import FontFamily from "@tiptap/extension-font-family";
import { FontSize } from "../extensions/FontSize";
import { Callout } from "../extensions/Callout";
import { ConditionalBlock } from "../extensions/ConditionalBlock";
import { ChoiceBlock } from "../extensions/ChoiceBlock";
import { ChoiceOption } from "../extensions/ChoiceOption";
import { Mention } from "../extensions/Mention";

/**
 * The runtime's own extension set, deliberately independent of the editor's
 * `useEditor()` instance in SceneEditor.tsx — nothing under runtime/ ever
 * imports an editor UI component. It only consumes the same document
 * *model* Tiptap produces: a one-shot static render (generateHTML) for
 * ordinary content, plus the registry-driven block renderers in
 * registry.ts for anything interactive. Same mark/extension set the
 * writing editor supports, so anything a writer formats (bold, italic,
 * headings, lists, underline, alignment, font, colour, highlight, callouts)
 * renders identically here.
 *
 * Lifted out of PlayRuntime.tsx in v0.30.0: the Conditional Block renders
 * its own prose, so a second file needs the same list, and two copies of it
 * would silently diverge the first time an extension is added.
 */
export const RUNTIME_EXTENSIONS = [
  StarterKit,
  Underline,
  TextStyle,
  Color,
  Highlight,
  FontFamily,
  FontSize,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Callout,
  // v0.35.0 — so a mention in someone's prose renders as the name rather
  // than vanishing. The runtime swaps each mention's stored label for the
  // entity's current name first (utils/mentions.ts's resolveMentions), so
  // renaming a character updates what a player reads too.
  Mention,
  // Registered so a conditional section nested inside other content
  // still parses; the runtime renders top-level ones through its own
  // block renderer rather than this static pass.
  ConditionalBlock,
  // Registered so a choice's LABEL can be rendered through the same
  // generateHTML pass as prose (see choiceRuntimeBlock). The block itself
  // is still drawn by its own runtime renderer — this is only here so the
  // schema knows these node types exist when a label is generated.
  ChoiceBlock,
  ChoiceOption,
];
