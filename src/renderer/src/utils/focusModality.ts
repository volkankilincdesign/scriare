/**
 * Focus rings for keyboards, not for mice (v0.50.0).
 *
 * `:focus-visible` is supposed to settle this on its own, and for native
 * controls it does — clicking a `<button>` does not match it. For a `div`
 * with `tabindex="0"` it does NOT: Chromium keeps `:focus-visible` after a
 * pointer click, because a generic element receiving focus from a click is
 * unusual enough that the heuristic assumes the ring is wanted.
 *
 * The Content panel is built from exactly those — rows that must stay divs
 * because they are drag handles (the argument is at the label row in
 * ContentTreeRow.tsx). So the app had a choice between a ring after every
 * click and no ring at all, and v0.44.0 chose no ring: `focus:outline-none`
 * on each row, which compiles to a TRANSPARENT 2px outline at specificity
 * (0,2,0) and beat the global `:focus-visible` rule at (0,1,0). Measured on
 * v0.49.1, a keyboard-focused tree row reported `outline-color:
 * rgba(0, 0, 0, 0)` — drawn, at full width, in nothing.
 *
 * Removing that class alone was not the fix, and the test said so: a real
 * trusted click then painted a ring on every row. (A synthetic
 * `new MouseEvent(...)` does not — it is untrusted, so the focus that
 * follows scores as programmatic — which is worth knowing, because the
 * first version of that check measured a synthetic click and would have
 * sent me off to fix an app that was behaving correctly.)
 *
 * So the modality is tracked instead, which is what the app actually means:
 * while the writer is using a pointer, no rings; the moment they use a key
 * that moves focus, rings. Both halves are tested in accessibility.spec.mjs.
 */
const KEYS_THAT_MOVE_FOCUS = new Set([
  "Tab",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

export function installFocusModality(): () => void {
  const set = (usingPointer: boolean): void => {
    document.documentElement.dataset.pointerFocus = usingPointer ? "true" : "false";
  };

  // Assume keyboard until a pointer says otherwise: it is the safer way
  // round for someone who navigates by keyboard from the moment the window
  // opens. A DEFAULT rather than a guarantee, and said that way because a
  // negative control proved it — flipping this start value changes nothing
  // any test can see, since every key that moves focus resets the flag
  // before focus lands anywhere.
  set(false);

  const onPointer = (): void => set(true);
  const onKey = (event: KeyboardEvent): void => {
    // Typing is not navigating. Without this, every character typed into
    // the editor would arm the ring, and the next click would flash one.
    if (KEYS_THAT_MOVE_FOCUS.has(event.key)) set(false);
  };

  // Capture phase: this has to be true before anything downstream reads a
  // focus state, and nothing here can be stopped by a handler that calls
  // stopPropagation on its own row.
  window.addEventListener("pointerdown", onPointer, true);
  window.addEventListener("keydown", onKey, true);
  return () => {
    window.removeEventListener("pointerdown", onPointer, true);
    window.removeEventListener("keydown", onKey, true);
  };
}
