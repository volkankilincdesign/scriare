import type { ReactNode } from "react";
import { DialogBackLink } from "./DialogBackLink";

/**
 * One rule for what a dialog says about itself (v0.56.0).
 *
 * Counted before this existed, the app wrote a dialog title FOUR ways:
 * `font-serif-narrative text-base italic` in five dialogs, `text-base
 * font-semibold` in three, and `text-sm font-semibold` in exactly one —
 * New Project, which is the first dialog a new writer ever sees. That
 * file's own comment is the giveaway: Sprint 8D moved it onto the shared
 * `<Modal>` shell because it had a hand-rolled backdrop, and never looked
 * at its type.
 *
 * The serif italic wins because it is not arbitrary: it is the wordmark's
 * face, it is what the Welcome hero and every scene title already use,
 * and it is the one place the app's own voice shows through chrome that
 * is otherwise deliberately quiet. `font-semibold` is what a dialog looks
 * like in every other application.
 *
 * `back` is the v0.55.0 navigation link, folded in here so a child dialog
 * gets the whole header in one line rather than remembering to stack two
 * components in the right order.
 */
export function DialogHeader({
  title,
  children,
  back,
}: {
  title: string;
  /** One sentence saying what this dialog is for. */
  children?: ReactNode;
  back?: { label: string; onBack: () => void };
}) {
  return (
    <div className="mb-4">
      {back && <DialogBackLink label={back.label} onBack={back.onBack} />}
      <h2 className="font-serif-narrative text-base italic text-[var(--text)]">{title}</h2>
      {children && (
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-3)]">{children}</p>
      )}
    </div>
  );
}
