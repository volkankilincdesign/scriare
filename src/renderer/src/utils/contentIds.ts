import { nanoid } from "nanoid";
import type { JSONContent } from "@tiptap/react";
import { Fragment } from "@tiptap/pm/model";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  CHOICE_BLOCK_TYPE,
  CHOICE_OPTION_TYPE,
  DIALOGUE_BLOCK_TYPE,
  DIALOGUE_LINE_TYPE,
} from "../types/nodeTypes";

/**
 * Every id a document carries, in one place (v0.69.0).
 *
 * Five node types carry an id, and until this file they were looked after
 * by three different pieces of code that did not know about each other:
 * `stampParagraphIds` filled in paragraphs on open, the `lineId` extension
 * filled in paragraphs while writing, and `regenerateChoiceIds` reissued
 * choice ids when a scene was copied. Each was right about its own corner
 * and none of them was responsible for the property that actually matters
 * — that no two rows of the spreadsheet can ever claim the same id.
 *
 * The audit that forced this file measured the gap. All three pieces only
 * ever filled a MISSING id; none of them could see a repeated one. So:
 *
 *   - Pressing Enter in the middle of a sentence gave both halves the same
 *     id. `keepOnSplit: false` is declared on the attribute and reads like
 *     it prevents exactly this, but Tiptap only consults it when the caret
 *     is at the END of the block — that is the one branch of `splitBlock`
 *     that passes node types to `tr.split`. Split anywhere else and
 *     ProseMirror's own default copies the attributes to both halves.
 *     Measured with a real keypress: two paragraphs, one id.
 *   - Copy and paste cloned all five kinds, because each one round-trips
 *     through a `data-*` attribute that `parseHTML` reads straight back.
 *   - Duplicating a scene reissued the choice ids and left the prose and
 *     the Dialogue carrying the original's.
 *
 * None of that showed up in a story built by a script, which is why it
 * survived to v0.68.0: the test fixtures were generated, not typed.
 *
 * The three answers are the three exported functions, and they are
 * deliberately at three different heights:
 *
 *   `stripPastedIds`  — at the paste boundary, where the editor knows
 *                       exactly which nodes are arriving.
 *   `reissueDuplicateIds` — a sweep over the live document, the safety net
 *                       for the split and for anything not yet thought of.
 *   `regenerateContentIds` — a whole-scene copy, where everything is new.
 *
 * ONE NAMESPACE FOR ALL FIVE. A paragraph's `lineId`, a dialogue line's
 * `lineId`, an option's `optionId` and both kinds of `blockId` are checked
 * against each other rather than each against its own kind. Column A of
 * the export mixes prose, choices and dialogue in one sheet and that
 * column is the CSV's RowName, so "unique among paragraphs" is not the
 * property anyone needs.
 */

/** Which attribute carries the id, per node type. */
export const ID_ATTRS: Readonly<Record<string, string>> = {
  paragraph: "lineId",
  [DIALOGUE_LINE_TYPE]: "lineId",
  [DIALOGUE_BLOCK_TYPE]: "blockId",
  [CHOICE_OPTION_TYPE]: "optionId",
  [CHOICE_BLOCK_TYPE]: "blockId",
};

/** The attribute name for a node type, or null if that type carries no id. */
export function idAttrFor(typeName: string | undefined): string | null {
  if (!typeName) return null;
  return ID_ATTRS[typeName] ?? null;
}

const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

/**
 * Fill in what is missing and reissue what is repeated (v0.69.0).
 *
 * Run on every scene as it is opened, alongside the other migrations. Two
 * jobs that used to be one:
 *
 *   MISSING — a project written before ids existed has none at all, and
 *   gets stamped exactly once, however old it is. This half is
 *   `stampParagraphIds` from v0.66.0, widened to the other four types.
 *
 *   REPEATED — a project written by v0.68.0 or earlier can hold duplicates
 *   that the app itself created, and there is no version of "leave it
 *   alone" that is kind to the writer: the duplicate is already broken,
 *   and it breaks silently, in a spreadsheet, weeks later. The FIRST
 *   occurrence in document order keeps the id and every later one is
 *   reissued, which is the same rule the live sweep uses, so a file healed
 *   on open and a file healed while typing come out the same.
 *
 * Returns `content` itself when nothing changed, so a project that is
 * already correct is not rewritten into a new object on every open.
 */
export function stampContentIds(content: JSONContent | undefined | null): JSONContent {
  if (!content) return EMPTY_DOC;

  let changed = false;
  const seen = new Set<string>();

  function walk(node: JSONContent): JSONContent {
    const kids = node.content?.map(walk);
    const next: JSONContent = kids ? { ...node, content: kids } : { ...node };

    const attr = idAttrFor(node.type);
    if (attr) {
      const current = next.attrs?.[attr] as string | undefined | null;
      if (!current || seen.has(current)) {
        changed = true;
        const fresh = nanoid();
        next.attrs = { ...(next.attrs ?? {}), [attr]: fresh };
        seen.add(fresh);
      } else {
        seen.add(current);
      }
    }
    return next;
  }

  const out = walk(content);
  return changed ? out : content;
}

/**
 * A copy is new (v0.69.0).
 *
 * Returns a deep copy of `content` with EVERY id replaced, used whenever a
 * Scene is duplicated or pasted. Until v0.69.0 this only touched choices,
 * so a duplicated scene arrived with the original's prose and dialogue ids
 * and two scenes claimed the same lines.
 *
 * The decision behind reissuing rather than keeping: a duplicated scene is
 * mostly the same text, so keeping the ids would have carried the
 * translations across for free. It would also have meant two scenes
 * disagreeing about which one is the real line, and a Key that is only
 * unique once you also know the scene — which is not what the export's
 * column A is. One rule everywhere: a copy is new.
 *
 * `sceneIdMap` handles the case where a WHOLE SET of scenes is copied at
 * once (a multi-scene duplicate, or a paste). Any choice or dialogue line
 * pointing at a scene inside that set is rewritten to point at that
 * scene's copy, so copying a two-scene branch gives you a branch — the
 * copies link to each other, not back to the originals. A pointer to a
 * scene *outside* the set is left alone, which is equally deliberate:
 * copying a scene that leads to Chapter Three should still lead there.
 *
 * Omit the map (a single-scene duplicate) and every destination is left
 * untouched, which is the behaviour this has always had.
 */
export function regenerateContentIds(
  content: JSONContent | undefined | null,
  sceneIdMap?: ReadonlyMap<string, string>,
): JSONContent {
  if (!content) return EMPTY_DOC;

  const retarget = (target: unknown): unknown =>
    typeof target === "string" && sceneIdMap?.has(target) ? sceneIdMap.get(target)! : target;

  const freshIds = (list: unknown): unknown =>
    ((list as { id: string }[] | undefined) ?? []).map((item) => ({ ...item, id: nanoid() }));

  function walk(node: JSONContent): JSONContent {
    const attr = idAttrFor(node.type);
    const kids = node.content?.map(walk);
    if (!attr) return kids ? { ...node, content: kids } : node;

    const attrs = { ...(node.attrs ?? {}), [attr]: nanoid() };

    // A choice option and a dialogue line both point at a scene and both
    // carry conditions and actions whose own ids have to be distinct — the
    // Inspector addresses a condition by id, so two copies sharing one
    // would edit each other.
    if (node.type === CHOICE_OPTION_TYPE || node.type === DIALOGUE_LINE_TYPE) {
      attrs.targetSceneId = retarget(attrs.targetSceneId);
      attrs.actions = freshIds(attrs.actions);
      attrs.conditions = freshIds(attrs.conditions);
    }

    return kids ? { ...node, attrs, content: kids } : { ...node, attrs };
  }

  return walk(content);
}

/**
 * A pasted line is a new line (v0.69.0).
 *
 * Clears every id on an incoming fragment so the sweep issues fresh ones.
 * Called from `transformPasted`, which is the one moment the editor knows
 * for certain which nodes are arriving from outside the document — after
 * the transaction lands there is no way to tell a pasted copy from the
 * original it was copied from.
 *
 * This is why the rule is "a pasted line is always new" rather than
 * "a copied line is new, a moved line keeps its id": ProseMirror cannot
 * distinguish cut-then-paste from copy-then-paste, and the two costs are
 * not symmetrical. A duplicate id is fatal — two rows with one RowName is
 * a broken import. A moved line losing its id costs a translation memory
 * one fuzzy match on the source text, which is what those tools do anyway.
 *
 * Drops go through `transformPasted` too, so dragging a paragraph to a new
 * place reissues its id on the same rule.
 */
export function stripPastedIds(fragment: Fragment): Fragment {
  const out: ProseMirrorNode[] = [];

  fragment.forEach((node) => {
    const content = node.content.size > 0 ? stripPastedIds(node.content) : node.content;
    const attr = idAttrFor(node.type.name);
    // `node.type.create` rather than `node.copy` for the id-bearing types:
    // copy keeps the attributes, which is the whole thing being undone.
    out.push(
      attr
        ? node.type.create({ ...node.attrs, [attr]: null }, content, node.marks)
        : node.copy(content),
    );
  });

  return Fragment.fromArray(out);
}

/**
 * The document's duplicates, as positions to repair (v0.69.0).
 *
 * Pure, so the sweep in the extension is one `descendants` walk and this
 * decides everything. Returns the positions of every node whose id is
 * missing or already claimed by something earlier in document order —
 * which is what makes the first occurrence the keeper.
 *
 * `doc.descendants` visits in document order, so "already seen" and
 * "earlier in the document" are the same statement.
 */
export function findIdFaults(doc: ProseMirrorNode): { pos: number; attr: string }[] {
  const seen = new Set<string>();
  const faults: { pos: number; attr: string }[] = [];

  doc.descendants((node, pos) => {
    const attr = idAttrFor(node.type.name);
    if (!attr) return true;
    const current = node.attrs[attr] as string | undefined | null;
    if (!current || seen.has(current)) faults.push({ pos, attr });
    else seen.add(current);
    return true;
  });

  return faults;
}

/** A fresh id, so callers never have to reach for nanoid themselves. */
export function freshContentId(): string {
  return nanoid();
}
