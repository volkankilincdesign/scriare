import type { JSONContent } from "@tiptap/react";
import { DEFAULT_CHOICE_BOX, resolveChoiceBox } from "../types/choiceStyles";
import type { ChoiceBox, ChoiceStyle, ChoiceStyleRef } from "../types/choiceStyles";
import { readChoiceBlockOptions } from "../utils/choiceBlocks";
import { extractDialogueLines, DIALOGUE_BLOCK_TYPE } from "../utils/dialogueBlocks";
import type { Project } from "../types/project";

/**
 * Choice Styles as CSS RULES rather than inline styles (v0.80.0).
 *
 * WHY THIS FILE EXISTS. A writer's own stylesheet has to be able to say
 * `.scriare-choice { background: red }` and be obeyed. For two years the
 * app painted a choice's box with `element.style.background`, and an inline
 * style beats every stylesheet there is — measured, not assumed, in
 * tests/custom-css.spec.mjs: an inline declaration wins over an unlayered
 * rule, which is why moving off inline was not optional.
 *
 * THE CASCADE, IN ONE PICTURE:
 *
 *     @layer scriare.boxes   ← generated from this file, per story
 *     @layer scriare.base    ← the app's own stylesheet
 *     (unlayered)            ← the writer's CSS
 *
 * Unlayered beats every layer REGARDLESS OF SPECIFICITY. That is the whole
 * reason for layers here: without them a writer's `.scriare-choice` rule
 * would lose to the generated `.scriare-choice.scriare-box-x1y` on
 * specificity, and the fix would be teaching everybody to type `!important`
 * — which is the single most common complaint about Twine's stylesheet.
 *
 * BOXES COME FIRST, ON PURPOSE. `.scriare-choice.is-locked` in the base
 * layer sets a locked choice's transparent fill and dashed border, and it
 * has to keep winning over the generated box rule, exactly as it did when
 * the box was inline and locked buttons were given nothing but a radius. A
 * later layer wins, so base sits after boxes and the locked treatment
 * survives while the radius — which nothing in base sets — comes through.
 * That is why a locked choice can wear the same class as a live one and
 * still look locked, and why there is ONE generated table here rather than
 * a second one for radii.
 *
 * THE CLASS IS DERIVED FROM THE VALUES, not from a counter. A counter would
 * mean the export's numbering and Play Mode's numbering had to be kept in
 * step by two pieces of code walking the story in the same order — the
 * classic pair that drifts. A hash of the four values cannot drift: the same
 * box is the same class everywhere, including in a test that computes it
 * independently.
 */

/** Emitted once, before anything else, in both surfaces. */
export const LAYER_ORDER = "@layer scriare.boxes, scriare.base;";

/** What the app paints when a style leaves a slot at `null`. */
const FALLBACK_FILL = "var(--surface-2-translucent)";
const FALLBACK_BORDER = "var(--border)";

function key(box: ChoiceBox): string {
  return `${box.fill ?? ""}|${box.border ?? ""}|${box.borderWidth}|${box.radius}`;
}

/**
 * A short, stable, CSS-safe name for a box.
 *
 * FNV-1a over the four values. Not a cryptographic choice and not trying to
 * be: the input space is a handful of styles per project, and the cost of a
 * collision is two boxes sharing one rule — which is only wrong if they are
 * actually different, which a 32-bit hash over a dozen inputs will not do.
 */
export function boxClass(box: ChoiceBox): string {
  const text = key(box);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `scriare-box-${hash.toString(36)}`;
}

/** The distinct boxes in a list, keyed by the class that paints them. */
export function collectBoxes(boxes: ChoiceBox[]): Record<string, ChoiceBox> {
  const out: Record<string, ChoiceBox> = {};
  for (const box of boxes) out[boxClass(box)] = box;
  return out;
}

/**
 * Every box a whole project uses — what Play Mode needs, since it paints
 * one scene at a time but the reader can reach any of them.
 *
 * The EXPORT does not use this: it collects boxes as it builds, in the
 * same pass that writes the choices, so the two cannot disagree about
 * which boxes a story uses. This walk exists because Play Mode has no such
 * pass. Both end at `boxClass`, which is derived from the values, so a box
 * found by either route lands on the same class name — that is the whole
 * reason the class is a hash rather than a counter.
 */
export function collectProjectBoxes(project: Project | null | undefined): Record<string, ChoiceBox> {
  const styles: ChoiceStyle[] = project?.choiceStyles ?? [];
  const found: ChoiceBox[] = [DEFAULT_CHOICE_BOX];

  const visit = (node: JSONContent | undefined | null): void => {
    if (!node) return;
    if (node.type === "choiceBlock") {
      for (const option of readChoiceBlockOptions(node)) {
        found.push(resolveChoiceBox(styles, option.style as ChoiceStyleRef | null));
      }
      return;
    }
    if (node.type === DIALOGUE_BLOCK_TYPE) {
      for (const line of extractDialogueLines(node)) {
        found.push(resolveChoiceBox(styles, line.style as ChoiceStyleRef | null));
      }
      return;
    }
    for (const child of node.content ?? []) visit(child);
  };

  for (const scene of project?.scenes ?? []) visit(scene.content);
  // Named styles nobody wears yet are included too: a writer who has just
  // made "Dangerous" and is writing CSS against it should find a rule to
  // target before the first choice wears it.
  for (const style of styles) found.push(style.box);

  return collectBoxes(found);
}

/**
 * The generated layer.
 *
 * Every story gets the DEFAULT box whether or not any choice currently
 * wears it, because a page with no choices at all still has a stylesheet a
 * writer may be editing against, and a rule that appears only once somebody
 * uses the feature is a rule nobody can discover.
 */
export function boxLayerCss(boxes: Record<string, ChoiceBox>): string {
  const all = { ...collectBoxes([DEFAULT_CHOICE_BOX]), ...boxes };
  const rules = Object.entries(all)
    .map(
      ([cls, box]) => `  .scriare-choice.${cls} {
    background: ${box.fill || FALLBACK_FILL};
    border-color: ${box.border || FALLBACK_BORDER};
    border-width: ${box.borderWidth}px;
    border-style: ${box.borderWidth > 0 ? "solid" : "none"};
    border-radius: ${box.radius}px;
  }`,
    )
    .join("\n");
  return `@layer scriare.boxes {\n${rules}\n}`;
}
