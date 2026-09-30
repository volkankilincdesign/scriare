/**
 * The floating panel (v0.82.0) — the surface every menu in this app floats on.
 *
 * FOUND BY COUNTING, which is the method v0.56.0 established when it
 * discovered the primary action existed in nine spellings. Four floating
 * menus, three spellings, and a token nobody used:
 *
 *   SpeakerMenu        rounded-lg  bg --surface  shadow-xl
 *   MentionMenu        rounded-lg  bg --surface  shadow-xl
 *   SlashCommandMenu   rounded-md  bg --bg       shadow-xl
 *   ContentContextMenu rounded-md  bg --bg       shadow-xl
 *
 * THE SHADOW IS THE PART THAT WAS ACTUALLY WRONG, and the app had already
 * said so. `shadow-xl` is Tailwind's own: a fixed black at fixed
 * opacities, identical in all eight themes. v0.46.0 diagnosed exactly
 * that and wrote it down in InspectorPanel — "on a light ground a black
 * shadow at that strength reads as dirt on paper, which is the exact
 * thing --shadow-floating exists to get right per theme" — then defined
 * the token in every theme and applied it in two places. Four menus never
 * got the memo, and every one of them is a surface a writer sees on a
 * light theme.
 *
 * THE BACKGROUND HAD A PRINCIPLE TOO. `--bg` is the ground the page
 * itself is painted on, so a menu wearing it reads as a hole cut in the
 * page rather than a card lying on it. `--surface` is what the Modal,
 * the Speaker menu and the Mention menu already used, and it is what a
 * raised thing is for.
 *
 * `shadow-[shadow:...]` AND NOT `shadow-[...]`, AND THE HINT IS LOAD-BEARING.
 * Tailwind cannot tell whether an arbitrary `shadow-[var(--x)]` is a shadow
 * or a shadow COLOUR, and it guesses colour:
 *
 *     .shadow-\[var\(--shadow-floating\)\] {
 *       --tw-shadow-color: var(--shadow-floating);
 *       --tw-shadow: var(--tw-shadow-colored);
 *     }
 *
 * With no shape to colour, that computes to `box-shadow: none`. Five
 * places in this app wrote it that way — the toast, both Welcome cards,
 * the colour-on-grounds preview and Play Mode's variable readout — and
 * every one of them has been painting no shadow at all since the day it
 * was written. Nobody noticed because a missing shadow reads as a design
 * decision. The two places that DID work, in InspectorPanel and
 * DialoguePanel, both set `boxShadow` as an inline style and so never met
 * Tailwind's guess.
 *
 * Found by a test written for something else entirely: the check below
 * asked whether this panel's shadow equalled the token's, and the answer
 * was "none".
 *
 * A CLASS STRING RATHER THAN A COMPONENT, deliberately. `Button` is a
 * component because the whole control repeated — its padding, its
 * colours, its type and its states. Here only the container repeats;
 * the four menus differ in everything inside, in how they are positioned
 * and in how they take the keyboard. Wrapping four different things in
 * one component to share nine words of CSS would be the kind of
 * abstraction that has to be unwound later.
 */
export const FLOATING_PANEL =
  "rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-[shadow:var(--shadow-floating)]";
