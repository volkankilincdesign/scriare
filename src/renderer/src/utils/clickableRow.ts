import type { KeyboardEvent as ReactKeyboardEvent } from "react";

/**
 * A div that behaves like a button (v0.50.0).
 *
 * The Content panel is built from `<div onClick>` rows rather than real
 * `<button>`s, and that is deliberate rather than lazy: these rows are drag
 * handles, and a native button nested inside a draggable ancestor can
 * swallow the mousedown Chromium needs to recognise a drag gesture — the
 * reason is written out at the label row in ContentTreeRow.tsx.
 *
 * What was lazy was stopping there. A div is not focusable, does not
 * announce itself, and does not respond to Enter or Space, so before this
 * a writer navigating by keyboard could collapse the "Story" section and
 * then never reopen it, and could never open a character page at all — a
 * dead end rather than a rough edge.
 *
 * Spread onto the row. `aria-expanded` is set by the caller where the row
 * is a disclosure, because only the caller knows.
 *
 * Space is `preventDefault`ed because its default is to scroll the panel,
 * which on a long story means the row you just activated leaves the
 * screen. Enter is not — nothing here is inside a form, and letting it
 * through costs nothing.
 */
export function rowActivation(activate: () => void): {
  role: "button";
  tabIndex: 0;
  onKeyDown: (event: ReactKeyboardEvent) => void;
} {
  return {
    role: "button",
    tabIndex: 0,
    onKeyDown: (event: ReactKeyboardEvent) => {
      // Only when the row ITSELF has focus. Without this, Enter on the
      // "+" button inside a category header would fire the button and then
      // toggle the section under it, so a new character arrived with its
      // own list collapsed on top of it.
      if (event.target !== event.currentTarget) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.key === " ") event.preventDefault();
      activate();
    },
  };
}
