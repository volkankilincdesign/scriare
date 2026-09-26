import type { ReactNode } from "react";

/**
 * A labelled control (v0.56.0).
 *
 * This existed already — twice, privately, in `ChoiceStylesDialog` and in
 * the Inspector — and not at all in the four dialogs that most needed it,
 * which wrote their labels as bare `text-xs` spans in whatever size the
 * file happened to use. `.scriare-section-label` is the app's one way of
 * saying what a thing is (v0.50.0 reduced 33 hand-written headers on
 * three type ramps to it); a field's label is that same sentence, so it
 * uses that same class.
 *
 * `hint` is under the control, never beside it: a sentence that explains
 * a setting is read AFTER you have seen what the setting is, and putting
 * it above pushes the control away from its own label.
 */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="scriare-section-label mb-1 block text-[var(--text-3)]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs leading-normal text-[var(--text-3)]">{hint}</span>}
    </label>
  );
}

/**
 * The one text input shape. Same borders, same focus colour, same
 * padding as the selects beside it — which was true in most dialogs and
 * not in all of them.
 */
export const INPUT_CLASS =
  "w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)] disabled:text-[var(--text-3)]";

/** The same, at row scale — inside a list item rather than a dialog body. */
export const INPUT_CLASS_SM =
  "w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)] disabled:text-[var(--text-3)]";
