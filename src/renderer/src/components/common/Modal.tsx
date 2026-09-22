import { useEffect } from "react";
import type { ReactNode } from "react";

interface ModalProps {
  children: ReactNode;
  onClose: () => void;
  /** Fired on Enter — dialogs that have a clear default action (e.g. Confirm) wire this to it. */
  onEnter?: () => void;
  /** Tailwind max-width class for the card. Defaults to the compact size most dialogs use. */
  widthClassName?: string;
}

/**
 * The shared shell for every in-app dialog: a dimmed, blurred backdrop and a
 * dark, rounded card, closable with Escape or a click outside. This is what
 * replaces window.confirm()/alert() app-wide — see ConfirmDialogHost for the
 * confirmation dialog built on top of it.
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
export function Modal({ children, onClose, onEnter, widthClassName = "max-w-sm" }: ModalProps) {
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

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Enter" && onEnter) {
        e.preventDefault();
        onEnter();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onEnter]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--overlay)] backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className={`w-full ${widthClassName} rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 text-[var(--text)] shadow-2xl`}
      >
        {children}
      </div>
    </div>
  );
}
