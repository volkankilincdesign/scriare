import { nanoid } from "nanoid";
import type { CSSProperties } from "react";

/**
 * Choice Styles (v0.34.0) — how a choice LOOKS, as a named thing.
 *
 * The request this answers: "the Choice Boxes are just rigid blocks that
 * can't be edited visually… I want every choice editable separately, maybe
 * one of them a different colour and the other a different thickness."
 *
 * Two halves, split the way the whole app splits things. The label's
 * TYPOGRAPHY is text, so the toolbar owns it — that is what v0.32.0's
 * schema change was for, and nothing here touches it. The BOX around the
 * label is a property of the choice, so it lives here and is edited in the
 * Inspector.
 *
 * Styles are NAMED rather than only raw per-choice controls, which is the
 * one decision in this file worth defending. Raw controls are easier to
 * build and fine for five choices; at two hundred they mean that deciding
 * dangerous choices should be redder is an afternoon of clicking, and that
 * nothing in the story can state "this is what a dangerous choice looks
 * like". A named style says it once, in one place, and every choice
 * wearing it changes together. Per-choice overrides still exist for the
 * one-off that genuinely is one of a kind.
 */

/** The four things a Choice Style controls. `null` means "whatever the app's
 *  own chrome does" — deliberately not a hard-coded hex, so a style that
 *  sets only the border still follows the light/dark theme everywhere else. */
export interface ChoiceBox {
  /** Background fill. */
  fill: string | null;
  /** Border colour. */
  border: string | null;
  /** Border thickness in px. */
  borderWidth: number;
  /** Corner radius in px. */
  radius: number;
}

export interface ChoiceStyle {
  id: string;
  name: string;
  box: ChoiceBox;
}

/**
 * What an option's `style` attribute holds (see extensions/ChoiceOption.ts).
 * `null` on the attribute means "inherit the project default", which is why
 * that attribute defaults to null rather than to an empty object — the
 * Inspector has to be able to tell "never touched" from "deliberately set
 * to the same values", or it can't offer a meaningful reset.
 */
export interface ChoiceStyleRef {
  /** A named style. Absent or unknown falls back to the default style. */
  styleId?: string | null;
  /** One-off tweaks layered on top of that style. */
  overrides?: Partial<ChoiceBox>;
}

/**
 * The id of the style every project has and no project can delete. Stable
 * and readable rather than a nanoid, because it is written into documents
 * and read by code — a generated id here would mean every project had a
 * different name for the same idea.
 */
export const DEFAULT_CHOICE_STYLE_ID = "default";

/**
 * The look choices have always had. Expressed as theme variables rather
 * than colours so an untouched project renders in v0.34.0 exactly as it did
 * in v0.33.2, in both themes — a styling feature whose arrival restyles
 * everyone's existing story is a styling feature nobody trusts.
 */
export const DEFAULT_CHOICE_BOX: ChoiceBox = {
  fill: "var(--surface-2-translucent)",
  border: "var(--border)",
  borderWidth: 1,
  radius: 6,
};

export function buildDefaultChoiceStyle(): ChoiceStyle {
  return { id: DEFAULT_CHOICE_STYLE_ID, name: "Default", box: { ...DEFAULT_CHOICE_BOX } };
}

/** A new style starts as a copy of the default — a blank one would render
 *  as an invisible choice, and nobody means that. */
export function buildChoiceStyle(name: string, from: ChoiceBox = DEFAULT_CHOICE_BOX): ChoiceStyle {
  return { id: nanoid(), name, box: { ...from } };
}

/** Every project has a Default style, whatever its file says. */
export function normalizeChoiceStyles(styles: ChoiceStyle[] | undefined): ChoiceStyle[] {
  const list = Array.isArray(styles) ? styles.filter((s) => s && typeof s.id === "string") : [];
  const withoutDefault = list.filter((s) => s.id !== DEFAULT_CHOICE_STYLE_ID);
  const existingDefault = list.find((s) => s.id === DEFAULT_CHOICE_STYLE_ID);
  const base = existingDefault
    ? { ...existingDefault, box: { ...DEFAULT_CHOICE_BOX, ...existingDefault.box } }
    : buildDefaultChoiceStyle();
  return [base, ...withoutDefault.map((s) => ({ ...s, box: { ...DEFAULT_CHOICE_BOX, ...s.box } }))];
}

/**
 * Turns "what this choice says about its appearance" into "what to paint".
 *
 * Every fallback here is deliberate and all of them land in the same place:
 * the default style. A choice referring to a style that was deleted, a
 * document written by a newer version, a project whose styles array is
 * missing entirely — each renders as an ordinary choice rather than
 * disappearing or throwing. Deleting a style therefore doesn't have to
 * rewrite a single document, which is the reason this is a lookup at
 * render time rather than values copied onto each option.
 */
export function resolveChoiceBox(
  styles: ChoiceStyle[] | undefined,
  ref: ChoiceStyleRef | null | undefined,
): ChoiceBox {
  const list = normalizeChoiceStyles(styles);
  const fallback = list[0];
  const named = ref?.styleId ? list.find((s) => s.id === ref.styleId) : undefined;
  const base = named?.box ?? fallback.box;
  const overrides = ref?.overrides ?? {};
  return {
    fill: overrides.fill !== undefined ? overrides.fill : base.fill,
    border: overrides.border !== undefined ? overrides.border : base.border,
    borderWidth: overrides.borderWidth ?? base.borderWidth,
    radius: overrides.radius ?? base.radius,
  };
}

/** The resolved box as inline CSS, for the editor row and the played button. */
export function choiceBoxCss(box: ChoiceBox): CSSProperties {
  return {
    background: box.fill ?? undefined,
    borderColor: box.border ?? undefined,
    borderWidth: `${box.borderWidth}px`,
    borderStyle: box.borderWidth > 0 ? "solid" : "none",
    borderRadius: `${box.radius}px`,
  };
}

/** True when an option has one-off tweaks on top of its style — what the
 *  Inspector's "Reset" needs to know whether to offer itself. */
export function hasOverrides(ref: ChoiceStyleRef | null | undefined): boolean {
  const o = ref?.overrides;
  return Boolean(o && Object.keys(o).length > 0);
}
