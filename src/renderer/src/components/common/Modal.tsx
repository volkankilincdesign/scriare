import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

interface ModalProps {
  children: ReactNode;
  onClose: () => void;
  /** Fired on Enter — dialogs that have a clear default action (e.g. Confirm) wire this to it. */
  onEnter?: () => void;
  /** Tailwind max-width class for the card. Defaults to the compact size most dialogs use. */
  widthClassName?: string;
  /**
   * What this dialog is, for anything not looking at the screen. Falls back
   * to the card's own text, which is usually its heading — but a dialog
   * whose first line is not its title should say so here.
   */
  label?: string;
}

/**
 * The shared shell for every in-app dialog: a dimmed, blurred backdrop and a
 * dark, rounded card, closable with Escape or a click outside. This is what
 * replaces window.confirm()/alert() app-wide — see ConfirmDialogHost for the
 * confirmation dialog built on top of it.
 *
 * IT RENDERS INTO document.body, NOT WHERE IT IS WRITTEN (v0.75.2,
 * reported). `z-[100]` only outranks what shares its stacking context, and
 * the app's own chrome makes several: `.scriare-topbar` and
 * `.scriare-statusbar` are `position: relative; z-index: 3`, the side
 * panels `z-index: 2`. Project Settings and Preferences were written
 * inside TopBar's `<header>`, so their backdrop's 100 was spent INSIDE a
 * box worth 3 — and the status bar, worth the same 3 and later in the
 * document, went on painting over it. Measured on v0.75.1: the scrim's
 * rectangle did span the bar (so nothing looked wrong to a geometry
 * check), while `elementFromPoint` over "Show Story Graph" still returned
 * the button. It was legible, it was clickable, and it was behind frosted
 * glass. Every dialog mounted at App level was already correct, which is
 * why this went unnoticed for as long as it did: the app was right almost
 * everywhere, and the exception was invisible unless you tried to click
 * something you were not supposed to be able to reach.
 *
 * The portal is the fix rather than moving those two mounts, because
 * moving them fixes the two dialogs that exist and not the next one
 * somebody writes inside a panel. A dialog claims the whole window; where
 * its JSX happens to live is a detail of who owns the open flag, and it
 * should not be able to decide what the dialog can cover. React events
 * still bubble through the React tree, so no handler above a portalled
 * dialog notices the difference.
 *
 * WHAT IT ALSO CHANGED, deliberately: index.css styles `.scriare-topbar
 * select` and the bar's bordered controls with `--lift-raised`, meant for
 * toolbar controls. Project Settings' fields were picking that up by
 * descent alone — measured, they carried a two-layer cast no other
 * dialog's fields have. Out of the header they are flat, like every field
 * in every other dialog. That is the rule the app already followed
 * everywhere it was not being contradicted by accident.
 */

/**
 * How many dialogs are on screen right now (v0.49.0).
 *
 * Module state rather than a store, because the only thing that reads it
 * is a synchronous test inside a keydown handler — `aDialogIsOpen()` in
 * utils/keyboardFocus.ts — and nothing renders differently because of it.
 * Putting it in a store would re-render the app every time a dialog opened
 * for no visible effect.
 */
let openModals = 0;

export function aModalIsOpen(): boolean {
  return openModals > 0;
}

/**
 * Everything in the card a keyboard can land on, in the order it will.
 *
 * `:not([disabled])` and the negative-tabindex filter matter: a disabled
 * primary button is exactly what a dialog shows while it is working, and
 * trapping focus onto something that cannot be focused sends it to the
 * document body instead — which is outside the dialog, which is the bug
 * this function exists to prevent.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableWithin(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

export function Modal({
  children,
  onClose,
  onEnter,
  widthClassName = "max-w-sm",
  label,
}: ModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Every app-wide shortcut asks whether a dialog is up before acting —
  // see utils/keyboardFocus.ts's `aDialogIsOpen`. Counted rather than
  // flagged, because two dialogs can be stacked (a confirm over the
  // Variable Manager) and the inner one closing must not announce that the
  // room is clear.
  useEffect(() => {
    openModals += 1;
    return () => {
      openModals -= 1;
    };
  }, []);

  /**
   * Focus goes in, stays in, and comes back (v0.50.0).
   *
   * Measured on v0.49.0: opening a dialog left focus on the button that
   * opened it, outside the card and underneath the backdrop. Tab then
   * walked the application behind the scrim — every control still
   * reachable, none of them visible — and closing left focus wherever it
   * had wandered to. A screen reader was never told a dialog had opened at
   * all, because nothing said one had.
   *
   * The restore is the half that is easy to forget and the most annoying
   * to live without: dismiss a dialog and the next Tab should carry on
   * from the control you were at, not from the top of the document.
   */
  useEffect(() => {
    const returnTo = document.activeElement as HTMLElement | null;

    // The first control, or the card itself when there is nothing to
    // focus — a message-only dialog is still a thing focus must be inside,
    // or the first Tab escapes it.
    const first = focusableWithin(cardRef.current)[0];
    (first ?? cardRef.current)?.focus();

    return () => {
      // Only if focus is still ours to give back. If something else has
      // taken it since — another dialog opened on top, the writer clicked
      // into the editor — moving it now would be the rude thing.
      const active = document.activeElement;
      const ourFocus =
        !active || active === document.body || cardRef.current?.contains(active);
      if (ourFocus && returnTo?.isConnected) returnTo.focus();
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Enter" && onEnter) {
        e.preventDefault();
        onEnter();
        return;
      }
      if (e.key !== "Tab") return;

      // The trap. Only the innermost dialog should act, and since every
      // Modal adds this listener, the test is "is the focus inside MY
      // card" rather than a z-index comparison.
      const card = cardRef.current;
      if (!card) return;
      const active = document.activeElement as HTMLElement | null;
      if (active && !card.contains(active)) return;

      const stops = focusableWithin(card);
      if (stops.length === 0) {
        // Nothing to move between, so there is nowhere for Tab to go that
        // is not out of the dialog.
        e.preventDefault();
        return;
      }
      const firstStop = stops[0];
      const lastStop = stops[stops.length - 1];
      if (!e.shiftKey && active === lastStop) {
        e.preventDefault();
        firstStop.focus();
      } else if (e.shiftKey && (active === firstStop || active === card)) {
        e.preventDefault();
        lastStop.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onEnter]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--overlay)] backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        // Focusable so that a dialog with no controls of its own still has
        // somewhere to put focus, but not a tab stop — Tab should move
        // between the dialog's controls, not park on its frame.
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        /**
         * The height cap is load-bearing (v0.70.0).
         *
         * A dialog taller than the window was centred on it, which puts
         * the overflow at BOTH ends: the title goes off the top and the
         * buttons off the bottom, and neither can be reached because
         * nothing scrolls. Measured before it was fixed — at a 620px
         * window the Export dialog's own frame started at −9px.
         *
         * It is on the Modal rather than on the panel that exposed it,
         * because every dialog in the app is one long panel away from the
         * same fault and none of them can see the window's height. The
         * 3rem leaves the backdrop visible at both ends, so a capped
         * dialog still reads as something laid over the app rather than
         * as a new screen.
         */
        className={`max-h-[calc(100vh-3rem)] w-full overflow-y-auto ${widthClassName} rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 text-[var(--text)] shadow-2xl focus:outline-none`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
