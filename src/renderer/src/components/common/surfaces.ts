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

/**
 * A row inside one of those menus (v0.85.0).
 *
 * v0.82.0 counted the panels and left the rows alone, and the rows had the
 * same problem one level down. Four menus, four spellings — all
 * `px-3 py-1.5 text-left`, differing in the gap, in whether the row is a
 * flex box at all, and in the one thing that is not cosmetic:
 *
 *   SlashCommandMenu    selected  --surface-2      hover  (none)
 *   MentionMenu         selected  --surface-3      hover  (none)
 *   SpeakerMenu         selected  (accent text)    hover  --surface-3
 *   ContentContextMenu  selected  (n/a)            hover  --surface-2
 *
 * SO "THE ROW YOU ARE ABOUT TO PICK" WAS TWO DIFFERENT COLOURS, and which
 * one you got depended on which menu you were in — in the slash menu and
 * the mention menu, which a writer can open within seconds of each other on
 * the same line.
 *
 * THE RULE IS NOT A PREFERENCE, and that is why it could be settled without
 * asking. Hover and keyboard-selection can be on screen AT THE SAME TIME: a
 * mouse resting over row one while the arrow keys sit on row three. If both
 * are painted the same, nothing on screen says which row Enter will take.
 * So they have to be two steps of the same ramp, and all eight themes
 * define `--surface` → `--surface-2` → `--surface-3` evenly spaced, with
 * the panel itself on `--surface`:
 *
 *   hover     --surface-2   one step off the panel — "the pointer is here"
 *   selected  --surface-3   two steps — "this is the one that fires"
 *
 * Selection is the louder of the two on purpose. It is the one that acts on
 * a key press, and it is the one a writer navigating by keyboard has to find
 * without moving their hand to the mouse.
 *
 * Class strings rather than a component, for the reason FLOATING_PANEL
 * gives: only the row's shape repeats. What is inside one — an icon, a
 * tagline, a speaker's name, a danger colour — differs in every menu.
 */
export const MENU_ITEM =
  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-[var(--surface-2)]";

/** The row the keyboard is on. Applied in addition to `MENU_ITEM`. */
export const MENU_ITEM_SELECTED = "bg-[var(--surface-3)]";
