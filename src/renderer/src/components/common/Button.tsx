import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * The button (v0.56.0).
 *
 * `common/` held a Modal, a toast host, a dialog back-link and a whole
 * icon set, and no button — so every dialog in the app re-typed its own
 * Done and its own Cancel from memory. Measured across the source before
 * this existed, the primary action was written NINE ways: `px-3 py-1.5
 * text-sm` six times, `px-3.5 py-1.5` twice, plus `px-3 py-2`, `px-4
 * py-2`, `px-5 py-3`, and one at `text-xs`. Two-pixel disagreements are
 * not something anyone can name when they look at the app, and they are
 * most of why the older dialogs feel unsettled beside the newer ones.
 *
 * NOTHING HERE IS NEW. The default size is `px-3 py-1.5 text-sm` — the
 * spelling six places already used — and every colour is the token that
 * was already there. This file is the language the app chose in v0.40.0
 * and v0.44.0, written down once instead of retyped forty times.
 *
 * `intent` says what the button MEANS, never what it looks like. That is
 * the whole reason a component beats a class string: "danger" survives a
 * palette change and `text-red-500` does not — which is the mistake
 * v0.46.0 had to go and find in Check Story.
 */
export type ButtonIntent =
  | "primary"
  | "secondary"
  | "ghost"
  | "accentGhost"
  | "danger"
  | "quietDanger";
export type ButtonSize = "xs" | "icon" | "sm" | "md";

const INTENT: Record<ButtonIntent, string> = {
  /** The one next step. At most one per dialog. */
  primary:
    "border border-transparent bg-[var(--accent)] text-[var(--accent-text-on)] hover:bg-[var(--accent-hover)]",
  /** An equal alternative to the primary — "Open Project…" beside "New Project". */
  secondary:
    "border border-[var(--border)] bg-transparent text-[var(--text)] hover:bg-[var(--surface-2)]",
  /** The way out. Cancel is never a bordered control competing with the action. */
  ghost: "border border-transparent bg-transparent text-[var(--text-2)] hover:bg-[var(--surface-2)]",
  /** Adds to a list — "+ Add Variable". Reads as an action, not as the action. */
  accentGhost:
    "border border-transparent bg-transparent text-[var(--accent)] hover:bg-[var(--accent-soft-2)]",
  /**
   * Destroys something. FILLED, because that is what the confirm dialog
   * has shipped since it was written and it was already right — the app's
   * one rule about colour is that it belongs to what the writer assigns
   * meaning to, and "this removes your work" is the clearest meaning
   * there is. An outlined variant was drawn in the mockup and is not
   * here: nothing in the app needs one, and a variant with no caller is
   * a decision made in advance of the question.
   */
  danger:
    "border border-transparent bg-[var(--danger)] text-[var(--danger-text-on)] hover:bg-[var(--danger-hover)]",
  /**
   * Removes ONE ROW from a list — the ✕ on a choice, a dialogue line, a
   * condition, an alias, a variable (v0.85.0).
   *
   * COUNTED: thirteen of these, in seven spellings. All of them quiet at
   * rest and red on hover, and disagreeing about everything else:
   *
   *   three block views   px-1.5 py-0.5   hover --surface-2
   *   GroupNode           px-1            hover --surface-2
   *   Inspector ×3        px-1.5 (±py-1)  hover --surface-2
   *   DialoguePanel       px-1.5 py-1     hover --surface-2
   *   Variable Manager    px-1.5 py-1     hover --surface-2 + transition
   *   Choice row ✕        px-1            NO hover fill
   *   Dialogue line ✕     px-1            hover --surface-3
   *   Choice Styles row   px-1.5          NO hover fill
   *   An entity's alias   no padding      NO hover fill
   *
   * THE LAST FOUR ARE THE DEFECT, and two of them are each other's
   * sibling: the ✕ on a choice row and the ✕ on a dialogue line are the
   * same control on the two blocks his standing rule says must match, and
   * one had no hover fill at all while the other used `--surface-3` —
   * which v0.85.0 has just reserved for the row the keyboard is on. So a
   * pointer resting on a dialogue line's ✕ now says what an arrow key
   * says, and the choice's says nothing.
   *
   * NOT the filled `danger` above. That one is an action a writer chooses
   * deliberately, in a dialog, with a confirm behind it; this is a glyph
   * beside a row, and thirteen filled red squares down the side of a
   * choice list would make a list of choices read as a list of warnings.
   * Quiet at rest, red when you are actually on it.
   */
  quietDanger:
    "border border-transparent bg-transparent text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--danger)]",
};

const SIZE: Record<ButtonSize, string> = {
  /** Inside a row, beside other row content. */
  sm: "rounded px-2.5 py-1 text-xs",
  /** The default, and what a dialog's footer uses. */
  md: "rounded-md px-3 py-1.5 text-sm",
  /**
   * Denser than `sm`, for a panel where controls sit between fields
   * rather than in a footer (v0.84.0). Added because the Inspector had
   * SEVEN hand-written copies of the accent button at this size — the
   * same rule that gave this component its ref: a variant with callers
   * is a question answered, a variant without one is a decision made in
   * advance.
   */
  xs: "rounded px-1.5 py-0.5 text-xs",
  /**
   * A GLYPH'S TARGET (v0.85.0): the ✕ that removes one row from a list.
   *
   * Not `xs` with a different padding, because the padding is the whole
   * point and the reasoning for it already exists in this codebase. The
   * Variable Manager's row wrote it down when it grew its own ✕: "a real
   * target, not a 12px glyph with no padding. This deletes a writer's work
   * and it was the smallest destructive control in the app." That argument
   * is true of all thirteen of them, so this size is that site's spelling
   * promoted to the kit rather than a value invented here — and unifying on
   * `xs` instead would have quietly shrunk the one button somebody had
   * already thought about.
   *
   * A glyph has no descender and no width to speak of, so `xs`'s 2px of
   * vertical padding leaves an 18px target for an action that cannot be
   * undone by looking at it.
   */
  icon: "rounded px-1.5 py-1 text-xs",
  // There is no `lg`. The mockup drew one for the Welcome hero's
  // Continue, and then that turned out to be a <span> inside a larger
  // button — nesting a button in a button is invalid — so the size had
  // no caller. Same rule as the outlined danger above: a variant nothing
  // uses is a decision made in advance of the question.
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  intent?: ButtonIntent;
  size?: ButtonSize;
  children: ReactNode;
}

/**
 * `forwardRef` since v0.84.0, and it was the kit catching up rather than
 * the kit growing. The Content Browser's "+ New ▾" anchors a menu to its
 * own element, so bringing it onto this component meant the component
 * needed a ref — and until something did, not having one was the right
 * amount of Button. The same rule the missing `lg` size is kept by: a
 * variant with no caller is a decision made ahead of the question.
 *
 * `className` CANNOT RECOLOUR THIS BUTTON, and the discovery is worth
 * writing down because the failure is silent. The class string below puts
 * the caller's `className` last, which reads like "the caller wins" and is
 * not how CSS decides: both the intent's `text-[var(--accent)]` and a
 * caller's `text-[var(--text)]` are single-class selectors of equal
 * specificity, so the one the stylesheet emits LATER wins regardless of
 * the order they appear in the attribute. Measured in the shipped sheet,
 * `--text` is 370 bytes after `--accent`. So a caller that passes a colour
 * gets the intent's colour and no error — which is why intents exist, and
 * why a new one belongs in `INTENT` rather than at a call site. Layout
 * utilities (`shrink-0`, `whitespace-nowrap`) are what `className` is for,
 * and no caller currently passes anything else.
 *
 * Found by a negative control that tried to sabotage a call site by
 * deleting its props and leaving a colour in `className`: the button came
 * out in `--text`, dropped out of the set the check measures by colour,
 * and the check passed. The control was wrong — it has to replace the
 * whole element — but what it exposed is real.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { intent = "secondary", size = "md", className = "", type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      // Spelled out rather than defaulted by the caller: a <button> inside
      // a form submits it, and this component is used inside dialogs that
      // have inputs in them.
      type={type}
      className={`inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:cursor-default disabled:opacity-50 ${SIZE[size]} ${INTENT[intent]} ${className}`}
      {...rest}
    />
  );
});
