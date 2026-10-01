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
 * THE PLACEHOLDER COLOUR BELONGS TO THE KIT (v0.84.0).
 *
 * v0.81.2 fixed a stylesheet box whose placeholder read as real content
 * and left a comment calling `--text-3` "the colour every other
 * placeholder in the app uses". A count says otherwise: twenty-one fields
 * carry a placeholder and ten named a colour, so eleven were on whatever
 * the cascade gave them. MEASURED, that is `rgb(156, 163, 175)` — Tailwind
 * preflight's `gray-400`, not the browser's own grey, which is the detail
 * that makes it a real defect rather than a cosmetic one: it is a fixed
 * value that does not move when the theme does, so it is off-token in all
 * eight themes and brighter than the prose beside it in the dark ones.
 *
 * It is one declaration per kit class rather than eleven call sites
 * because the property is not local: a hint is not content, in every
 * field, and the only way that stays true is for the field shape to say
 * so.
 */
const PLACEHOLDER = "placeholder:text-[var(--text-3)]";

/**
 * The one text input shape. Same borders, same focus colour, same
 * padding as the selects beside it — which was true in most dialogs and
 * not in all of them.
 */
export const INPUT_CLASS =
  `w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)] disabled:text-[var(--text-3)] ${PLACEHOLDER}`;

/** The same, at row scale — inside a list item rather than a dialog body. */
export const INPUT_CLASS_SM =
  `w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)] disabled:text-[var(--text-3)] ${PLACEHOLDER}`;

/**
 * The same again, for a field sitting DIRECTLY ON A PANEL (v0.84.0).
 *
 * The kit had two and needed three. `INPUT_CLASS` is a dialog body's
 * field and `INPUT_CLASS_SM` a field inside a row card — which is why it
 * is `--surface`, and correct there, because the Variable Manager's rows
 * are `--bg` and it contrasts against them. Neither fits a control that
 * sits straight on the Inspector or the Content Browser, both of which
 * ARE `--surface`: a field painted `--surface` on a `--surface` panel is
 * a field with no fill.
 *
 * So both panels invented their own spelling, and one of the Inspector's
 * seven got it backwards — a destination picker painted exactly the
 * colour of the panel behind it, beside six siblings that were not.
 * Naming the third context is what stops the next person guessing which
 * of the other two to copy.
 */
export const INPUT_CLASS_PANEL =
  `rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 py-1 text-xs text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)] disabled:text-[var(--text-3)] ${PLACEHOLDER}`;
