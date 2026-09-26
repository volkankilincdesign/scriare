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
export type ButtonIntent = "primary" | "secondary" | "ghost" | "accentGhost" | "danger";
export type ButtonSize = "sm" | "md";

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
};

const SIZE: Record<ButtonSize, string> = {
  /** Inside a row, beside other row content. */
  sm: "rounded px-2.5 py-1 text-xs",
  /** The default, and what a dialog's footer uses. */
  md: "rounded-md px-3 py-1.5 text-sm",
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

export function Button({
  intent = "secondary",
  size = "md",
  className = "",
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      // Spelled out rather than defaulted by the caller: a <button> inside
      // a form submits it, and this component is used inside dialogs that
      // have inputs in them.
      type={type}
      className={`inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:cursor-default disabled:opacity-50 ${SIZE[size]} ${INTENT[intent]} ${className}`}
      {...rest}
    />
  );
}
