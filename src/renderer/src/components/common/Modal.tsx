import { useEffect } from "react";
import type { ReactNode } from "react";

interface ModalProps {
  children: ReactNode;
  onClose: () => void;
  /** Fired on Enter — dialogs that have a clear default action (e.g. Confirm) wire this to it. */
  onEnter?: () => void;
}

/**
 * The shared shell for every in-app dialog: a dimmed, blurred backdrop and a
 * dark, rounded card, closable with Escape or a click outside. This is what
 * replaces window.confirm()/alert() app-wide — see ConfirmDialogHost for the
 * confirmation dialog built on top of it.
 */
export function Modal({ children, onClose, onEnter }: ModalProps) {
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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-lg border border-zinc-700 bg-zinc-900 p-5 text-zinc-200 shadow-2xl"
      >
        {children}
      </div>
    </div>
  );
}
