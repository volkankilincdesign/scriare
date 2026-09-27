import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useProjectStore } from "../../state/projectStore";
import { useInspectorStore } from "../../state/inspectorStore";
import type { InspectorTarget } from "../../state/inspectorStore";
import { useUIStore } from "../../state/uiStore";
import { useEditorRefStore } from "../../state/editorStore";
import { extractChoices, findChoiceBlockOptions } from "../../utils/choiceBlocks";
import { mentionResolver } from "../../utils/mentions";
import { countWords } from "../../utils/storyCheck";
import type { ChoiceOption } from "../../utils/choiceBlocks";
import { PLAYER_SPEAKER, PLAYER_SPEAKER_LABEL, canSpeak } from "../../types/speaker";
import type { Entity } from "../../types/entities";
import {
  DEFAULT_CHOICE_STYLE_ID,
  choiceBoxCss,
  hasOverrides,
  resolveChoiceBox,
} from "../../types/choiceStyles";
import type { ChoiceBox } from "../../types/choiceStyles";
import { BoxControls } from "../choices/ChoiceStylesDialog";
import { DockGlyph, DockToggle } from "../common/DockToggle";
import {
  appendChoiceOption,
  applyChoiceOptionAttrs,
  applyConditionalBlockConditions,
  findConditionalBlockConditions,
  removeChoiceOption,
  reorderChoiceOptions,
} from "../../utils/choiceBlockEditing";
import {
  COMPARATORS_BY_TYPE,
  OPERATIONS_BY_TYPE,
  VARIABLE_TYPE_LABELS,
  buildVariableAction,
  buildVariableCondition,
  defaultValueForType,
} from "../../types/variables";
import type {
  Variable,
  VariableAction,
  VariableCondition,
  VariableType,
  VariableValue,
} from "../../types/variables";

interface InspectorPanelProps {
  collapsed: boolean;
  onToggle: () => void;
}

/** Sentinel `<option>` values for the Inspector's inline "create instead of
 * leaving the editor" affordances (Sprint 9C) — distinguishable from any
 * real scene/variable id (which come from nanoid and never look like this). */
const CREATE_SCENE_VALUE = "__create_scene__";
const CREATE_VARIABLE_VALUE = "__create_variable__";

/**
 * Sprint 9A — "the Inspector should become the central property editor of
 * Scriare... it should adapt depending on what the user selects." This
 * component is a thin switch over `useInspectorStore`'s `target.kind`:
 * `{kind: "scene"}` renders Scene Properties, `{kind: "choice"}` renders
 * Choice Properties. A future target kind (Character, Location, ...) is one
 * more union member in inspectorStore.ts and one more case below.
 *
 * `key={target.blockId}` on ChoiceProperties is deliberate: switching to a
 * different Choice Block (or away and back) should reset that component's
 * local UI state (which accordions are expanded, any in-progress drag) —
 * remounting via key is simpler and more reliable than manually resetting
 * every piece of that state in an effect.
 */
export function InspectorPanel({ collapsed, onToggle }: InspectorPanelProps) {
  const target = useInspectorStore((s) => s.target);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="flex w-8 shrink-0 flex-col items-center gap-2 border-l border-[var(--border-soft)] bg-[var(--surface)] pt-2.5 text-[var(--text-3)] hover:text-[var(--text)]"
        title="Expand Inspector"
      >
        <DockGlyph direction="left" />
        <span className="[writing-mode:vertical-rl] text-xs font-semibold uppercase tracking-wide">
          Inspector
        </span>
      </button>
    );
  }

  return (
    <aside className="scriare-panel-r flex w-80 shrink-0 flex-col border-l border-[var(--border-soft)] bg-[var(--surface)]">
      <div className="flex items-center gap-2.5 border-b border-[var(--border-soft)] px-4 py-3">
        <DockToggle direction="right" onClick={onToggle} title="Collapse Inspector" />
        <span className="scriare-section-label text-[var(--text-3)]">
          Inspector
        </span>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 text-sm">
        {target.kind === "choice" ? (
          <ChoiceProperties target={target} key={target.blockId} />
        ) : target.kind === "conditional" ? (
          <ConditionalProperties target={target} key={target.blockId} />
        ) : (
          <SceneProperties />
        )}
      </div>
    </aside>
  );
}

/**
 * Scene Properties, rebuilt in v0.59.0.
 *
 * THE STATE THE INSPECTOR IS ACTUALLY IN. A writer selects a Choice Block
 * for a few seconds at a time; the rest of the session — the hours — the
 * panel shows this. Until now it showed a checkbox, a read-only list of
 * the choices that are already visible in the document three inches to the
 * left, and a sentence explaining that the panel does something else when
 * you click elsewhere. All nineteen hundred lines of this file went into
 * the state nobody is in for long.
 *
 * So: it names the scene, which also settles a second problem — the panel
 * never said which of its two states you were looking at, and "Choices"
 * and "Outgoing Choices" are not two different enough words for a full
 * editor and a read-only list.
 *
 * THE THREE NUMBERS ARE NOT NEW DATA. Words is the status bar's own count
 * (one implementation now, see storyCheck.countWords), choices is the list
 * already below it, and "goes nowhere" is the thing Check Story would tell
 * you about if you ran it — which the panel you are already staring at can
 * tell you now. Nothing here is a new property of a scene: no notes, no
 * tags, no colour, no word goal. A thin panel padded with fields nobody
 * asked for is worse than an honest thin one, and a scene genuinely has
 * few properties.
 */
function SceneProperties() {
  const project = useProjectStore((s) => s.project);
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
  const setStartScene = useProjectStore((s) => s.setStartScene);

  const scene = project?.scenes.find((s) => s.id === selectedSceneId) ?? null;
  // Resolved, like every other surface that names a choice. A mention
  // stores the label that was TYPED, so without this a renamed character
  // keeps her old name here while the graph, Check Story and the export all
  // show the new one — the Inspector disagreeing with the canvas about who
  // is in the scene (v0.50.0).
  const choices = scene
    ? extractChoices(scene.content, mentionResolver(project?.entities ?? []))
    : [];
  const isStartScene = Boolean(scene) && project?.startSceneId === scene?.id;

  /**
   * Where a choice ends up, in three states rather than two.
   *
   * "Not linked yet" used to cover both a choice nobody has pointed
   * anywhere and one whose destination has since been deleted. Those are
   * different things — Check Story has called them `unlinked-choice` and
   * `broken-link` since v0.36.0 — and telling a writer their choice was
   * never linked when in fact their scene is gone sends them to the wrong
   * place to fix it.
   *
   * The unlinked case keeps the words the Choice Block in the document
   * already uses, rather than a fresh phrase for the same state: two
   * names for one thing, three inches apart, is how a vocabulary rots.
   * The summary line above says "goes nowhere" because it counts BOTH
   * kinds, and is a count rather than the name of a state.
   */
  function destination(targetSceneId: string | null): { label: string; wrong: boolean } {
    if (!targetSceneId) return { label: "not linked yet", wrong: true };
    const target = project?.scenes.find((sc) => sc.id === targetSceneId);
    if (!target) return { label: "target missing", wrong: true };
    return { label: `→ ${target.title || "Untitled scene"}`, wrong: false };
  }

  if (!scene) {
    return <p className="text-[var(--text-3)]">Select a scene to see its details.</p>;
  }

  const words = countWords(scene.content);
  // Both kinds at once, deliberately: the count answers "is anything in
  // this scene unfinished", and the list below says which kind each one is.
  const goingNowhere = choices.filter((choice) => destination(choice.targetSceneId).wrong).length;

  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <h3 className="min-w-0 flex-1 truncate font-medium text-[var(--text)]" title={scene.title}>
          {scene.title || "Untitled scene"}
        </h3>
        <span className="shrink-0 text-xs text-[var(--text-3)]">scene</span>
      </div>

      {/* Tabular figures, like the status bar's: these change as the writer
          types, and proportional digits make a panel twitch. */}
      <div className="mb-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-xs text-[var(--text-3)]">
        <span>
          <span className="tabular-nums text-[var(--text-2)]">{words.toLocaleString()}</span> words
        </span>
        <span>
          <span className="tabular-nums text-[var(--text-2)]">{choices.length}</span>{" "}
          {choices.length === 1 ? "choice" : "choices"}
        </span>
        {goingNowhere > 0 && (
          <span className="text-[var(--warning)]">
            <span className="tabular-nums">{goingNowhere}</span>{" "}
            {goingNowhere === 1 ? "goes nowhere" : "go nowhere"}
          </span>
        )}
      </div>

      <label className="mb-3 flex items-center gap-2 text-sm text-[var(--text-2)]">
        <input
          type="checkbox"
          checked={isStartScene}
          onChange={(e) => setStartScene(e.target.checked ? scene.id : null)}
          className="h-3.5 w-3.5 accent-[var(--accent)]"
        />
        This is the Start Scene
      </label>

      <div className="border-t border-[var(--border-soft)] pt-3">
        <h4 className="scriare-section-label mb-2 text-[var(--text-3)]">Where it leads</h4>

        {choices.length === 0 ? (
          <p className="text-xs leading-relaxed text-[var(--text-3)]">
            This scene has no Choice Blocks yet. Insert one from the editor's toolbar
            (+ Choice) or by typing <code>/choice</code> to let this scene branch
            somewhere else.
          </p>
        ) : (
          <>
            <ul>
              {choices.map((choice) => {
                const to = destination(choice.targetSceneId);
                return (
                  <li
                    key={choice.id}
                    data-outgoing-choice
                    className="flex items-baseline gap-2 py-0.5 text-xs"
                  >
                    {/* One line each, not a bordered card: this is a list to
                        run your eye down, and thirteen of them in a card
                        apiece is a panel you scroll instead of read. */}
                    <span
                      className="min-w-0 flex-1 truncate text-[var(--text-2)]"
                      title={choice.text || "(untitled choice)"}
                    >
                      {choice.text || "(untitled choice)"}
                    </span>
                    <span
                      className={`shrink-0 ${
                        to.wrong ? "text-[var(--warning)]" : "text-[var(--text-3)]"
                      }`}
                    >
                      {to.label}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2.5 text-xs text-[var(--text-3)]">
              Click a choice in the page to edit where it goes.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

interface ChoiceTarget {
  kind: "choice";
  sceneId: string;
  blockId: string;
  /** Which option the caret is in — see inspectorStore's own note on why
   *  this is a focus hint rather than part of what's targeted. */
  optionId?: string | null;
}

/**
 * Everything a drag needs to know about the Choices list's geometry,
 * measured once at the instant of the grab and never re-measured for the
 * rest of the gesture — see the drag-state comment inside
 * `ChoiceProperties` for why that immutability is the entire point.
 */
interface DragLayout {
  /** Choice order at the grab; the rendered order stays this for the whole drag. */
  order: string[];
  /** Index of the dragged choice within `order`. */
  draggedIdx: number;
  /** Each choice's top edge at the grab, aligned to `order`. */
  tops: number[];
  /** Each choice's height at the grab, aligned to `order`. */
  heights: number[];
  /** Vertical space the dragged choice occupies in flow — its own height plus the list's gap. */
  shift: number;
  /**
   * Every position the dragged choice can actually land in, given as the
   * top edge it would have there: `slotTops[k]` is where it ends up if
   * dropped at index k. Derived from the layout with the dragged choice
   * lifted out, so each slot already accounts for the choices above it
   * closing up into the space it left behind.
   */
  slotTops: number[];
  /** Where inside the card the pointer grabbed it, plus the card's own box. */
  grabOffsetY: number;
  left: number;
  width: number;
  height: number;
  /**
   * The Inspector's scrolling element and its scroll position at the
   * grab. Everything above is in viewport coordinates, frozen — which is
   * only safe as long as the content itself doesn't move underneath
   * them, and a scroll does exactly that. Keeping the starting scroll
   * position lets a mid-drag scroll be subtracted back out, so the
   * frozen geometry stays valid instead of silently describing where the
   * choices used to be.
   */
  scrollEl: HTMLElement | null;
  scrollTop: number;
}

/** Nearest ancestor that actually scrolls — the Inspector's own scroll pane. */
function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let node = el?.parentElement ?? null; node; node = node.parentElement) {
    const overflowY = getComputedStyle(node).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return node;
  }
  return null;
}

/**
 * Turns one set of measurements taken at the grab into the fixed geometry
 * the rest of the drag runs on. Nothing here is estimated or assumed —
 * the list's gap is derived from the real distance between neighbours
 * rather than hardcoded, so this stays correct if the spacing ever
 * changes.
 */
function buildDragLayout(
  order: string[],
  rects: DOMRect[],
  draggedIdx: number,
  grabOffsetY: number,
  scrollEl: HTMLElement | null,
): DragLayout {
  const tops = rects.map((r) => r.top);
  const heights = rects.map((r) => r.height);
  const height = heights[draggedIdx];

  let shift = height;
  if (draggedIdx < order.length - 1) {
    shift = tops[draggedIdx + 1] - tops[draggedIdx];
  } else if (draggedIdx > 0) {
    shift = tops[draggedIdx] + height - (tops[draggedIdx - 1] + heights[draggedIdx - 1]);
  }
  const gap = shift - height;

  // Where every other choice sits once the dragged one is lifted out:
  // anything below it closes up by exactly the space it vacated.
  const closedTop = (i: number): number => tops[i] - (i > draggedIdx ? shift : 0);
  const siblingIdxs = order.map((_, i) => i).filter((i) => i !== draggedIdx);

  // A landing slot k means "sit where sibling k currently sits, pushing
  // it and everything below it back down" — so in the lifted-out layout,
  // slot k's top IS sibling k's top. The extra final slot is the one
  // after the last sibling, which has no sibling of its own to borrow a
  // position from.
  const slotTops = siblingIdxs.map(closedTop);
  const lastSibling = siblingIdxs[siblingIdxs.length - 1];
  slotTops.push(
    lastSibling === undefined
      ? tops[draggedIdx]
      : closedTop(lastSibling) + heights[lastSibling] + gap,
  );

  return {
    order,
    draggedIdx,
    tops,
    heights,
    shift,
    slotTops,
    grabOffsetY,
    left: rects[draggedIdx].left,
    width: rects[draggedIdx].width,
    height,
    scrollEl,
    scrollTop: scrollEl?.scrollTop ?? 0,
  };
}

/**
 * How far choice `i` has to be moved (by transform, never by reflow) for
 * the list to read as though the dragged choice were sitting in slot
 * `targetIdx`. For the dragged choice's own slot this positions the
 * landing-zone outline; for everything else it opens the gap.
 */
function translateForIndex(layout: DragLayout, i: number, targetIdx: number): number {
  const { draggedIdx, tops, shift, slotTops } = layout;
  if (i === draggedIdx) return slotTops[targetIdx] - tops[i];
  const siblingIdx = i < draggedIdx ? i : i - 1;
  const closedTop = tops[i] - (i > draggedIdx ? shift : 0);
  return closedTop + (siblingIdx >= targetIdx ? shift : 0) - tops[i];
}

/**
 * Picks which slot the dragged choice is headed for: simply whichever
 * one it is currently CLOSEST to landing in.
 *
 * This deliberately replaces every threshold rule this panel has tried
 * (top-edge crossing, near-edge crossing, near-edge plus a percentage of
 * the neighbour's height, each with its own constants). Those all asked
 * "have I travelled far enough past this neighbour yet?", which for a
 * list whose rows range from one line to a fully expanded form is a
 * question with no good fixed answer — and, worse, any rule that fires
 * EARLY necessarily throws the landing zone further from the pointer,
 * because with a tall neighbour the two candidate landing positions are
 * hundreds of pixels apart. Asking instead "which landing position is
 * nearest to where this choice is actually floating right now?" needs no
 * constant at all, adapts itself to any mix of collapsed and expanded
 * rows, and by construction keeps the landing zone as close to the
 * pointer as the list's real geometry allows.
 *
 * `hysteresis` is the only tuning value, and it is not a threshold: it is
 * a small dead band that stops the choice flickering between two slots
 * when the pointer sits exactly on the boundary between them.
 */
function nearestSlot(layout: DragLayout, top: number, current: number, hysteresis: number): number {
  let best = current;
  let bestDist = Infinity;
  layout.slotTops.forEach((slotTop, k) => {
    const dist = Math.abs(slotTop - top);
    if (dist < bestDist) {
      bestDist = dist;
      best = k;
    }
  });
  const currentDist = Math.abs(layout.slotTops[current] - top);
  return bestDist < currentDist - hysteresis ? best : current;
}

/**
 * Sprint 9B — Choice Block Inspector Refactor. The whole Choice Block is
 * the unit of selection now (see ChoiceBlockView.tsx); this view shows
 * every one of its options as its own collapsible accordion, so a writer
 * with a five-option Choice Block never has to click back into the editor
 * just to move from editing option 2 to option 3.
 *
 * Every mutation (add/remove/reorder a choice, edit a field, add/edit/
 * remove an Action) goes through `applyChoiceBlockOptions`, which dispatches
 * a real transaction on the live editor rather than writing to the store
 * directly — see utils/choiceBlockEditing.ts and state/editorStore.ts for
 * why that matters. `editor` can briefly be null (e.g. during initial
 * mount); every handler below no-ops if so rather than crashing.
 */
/**
 * Properties for a Conditional Text block (v0.30.0) — the conditions that
 * decide whether its prose appears at all.
 *
 * Much simpler than ChoiceProperties because there is nothing else to edit:
 * the text inside the block is written in the editor like any other prose,
 * and the only structured data the block carries is its condition list.
 * Reuses the same ConditionRow the Choice accordion does, so "a condition"
 * looks and behaves identically wherever it appears.
 */
function ConditionalProperties({
  target,
}: {
  target: Extract<InspectorTarget, { kind: "conditional" }>;
}) {
  const project = useProjectStore((s) => s.project);
  const editor = useEditorRefStore((s) => s.editor);
  const openVariableManager = useUIStore((s) => s.openVariableManager);

  const scene = project?.scenes.find((s) => s.id === target.sceneId) ?? null;
  const conditions = scene ? findConditionalBlockConditions(scene.content, target.blockId) : null;
  const variables = project?.variables ?? [];

  // The block was deleted while the Inspector still had it targeted — fall
  // back to Scene Properties rather than showing a dead panel, same as
  // ChoiceProperties does.
  useEffect(() => {
    if (!scene || !conditions) useInspectorStore.getState().clearTarget();
  }, [scene, conditions]);

  if (!scene || !conditions) return null;

  function commit(next: VariableCondition[]): void {
    if (!editor) return;
    applyConditionalBlockConditions(editor, target.blockId, next);
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="scriare-section-label mb-1 text-[var(--text-3)]">
          Conditional Text
        </div>
        <p className="text-xs text-[var(--text-3)]">
          This passage appears only when every condition below holds. With no
          conditions it always appears.
        </p>
      </div>

      {variables.length === 0 ? (
        <div className="space-y-2 rounded-md border border-dashed border-[var(--border-soft)] px-2 py-2 text-xs text-[var(--text-3)]">
          <p>Create a project Variable first to give this passage something to test.</p>
          <button
            type="button"
            onClick={openVariableManager}
            className="rounded px-1.5 py-0.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-soft-2)]"
          >
            Open Variable Manager
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {conditions.map((condition) => (
            <ConditionRow
              key={condition.id}
              condition={condition}
              variables={variables}
              onChange={(patch) =>
                commit(conditions.map((c) => (c.id === condition.id ? { ...c, ...patch } : c)))
              }
              onRemove={() => commit(conditions.filter((c) => c.id !== condition.id))}
            />
          ))}
          <button
            type="button"
            onClick={() => {
              const condition = buildVariableCondition(variables);
              if (condition) commit([...conditions, condition]);
            }}
            className="rounded px-1.5 py-0.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-soft-2)]"
          >
            + Add Condition
          </button>
        </div>
      )}
    </div>
  );
}

function ChoiceProperties({ target }: { target: ChoiceTarget }) {
  const project = useProjectStore((s) => s.project);
  const editor = useEditorRefStore((s) => s.editor);
  const openVariableManager = useUIStore((s) => s.openVariableManager);

  const scene = project?.scenes.find((s) => s.id === target.sceneId) ?? null;
  // The second unresolved reader, which the audit did not name — found by
  // measuring the first. Same bug, same fix: the summary in Choice
  // Properties showed "Ask Mara" while the graph edge read "Ask Kestrel".
  const options = scene
    ? findChoiceBlockOptions(scene.content, target.blockId, mentionResolver(project?.entities ?? []))
    : null;
  const otherScenes = project?.scenes.filter((s) => s.id !== target.sceneId) ?? [];
  const variables = project?.variables ?? [];

  const optionsRef = useRef<ChoiceOption[]>(options ?? []);
  optionsRef.current = options ?? [];

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  /**
   * v0.33.1 — follow the caret.
   *
   * The Inspector now opens whenever the writer is inside a Choice Block
   * (see SceneEditor's onSelectionUpdate), and `target.optionId` says which
   * option they're in. Opening that accordion is the difference between
   * "the Choice panel is showing" and "the thing I'm editing is in front of
   * me" — with six choices in a block, the second is the only useful one.
   *
   * The ref remembers which accordion was opened FOR the writer rather than
   * BY them, so moving the caret to another choice closes the one it opened
   * and leaves anything the writer opened by hand exactly as they left it.
   */
  const autoOpenedRef = useRef<string | null>(null);
  /** Which choices were open last time the list was measured — see the
   *  FLIP effect for why "did this row open or close?" decides whether it
   *  is animated. */
  const prevExpandedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const focused = target.optionId ?? null;
    if (!focused) return;
    setExpanded((prev) => {
      if (prev.has(focused) && autoOpenedRef.current === focused) return prev;
      const next = new Set(prev);
      if (autoOpenedRef.current && autoOpenedRef.current !== focused) {
        next.delete(autoOpenedRef.current);
      }
      next.add(focused);
      return next;
    });
    autoOpenedRef.current = focused;
  }, [target.optionId]);

  // The block was deleted (its last choice was removed, or the writer
  // deleted it from the editor directly) while the Inspector still had it
  // targeted — fall back to Scene Properties instead of showing a dead
  // panel.
  useEffect(() => {
    if (!scene || !options) useInspectorStore.getState().clearTarget();
  }, [scene, options]);

  // Polish pass — hardening against "switching choices too fast": every
  // piece of drag/animation bookkeeping below is now self-healing rather
  // than trusting that a drag always ends via a clean pointerup on THIS
  // component instance. In practice a drag can be interrupted in ways that
  // never fire pointerup on this element at all — losing pointer capture
  // (a `pointercancel`), the OS window losing focus mid-drag, or the
  // writer selecting a different Choice Block (which force-remounts this
  // whole component via its `key`, but only AFTER React processes the
  // event that triggered it — any state briefly visible in between should
  // never show a stuck, orphaned floating accordion or spacer). None of
  // this should ever be reachable in normal use, but it costs nothing and
  // means a missed edge case degrades to "the drag silently ends" instead
  // of "the Inspector is visibly broken until you reselect the block."

  // --- Drag-to-reorder state -------------------------------------------
  // A lightweight, dependency-free sortable list, rebuilt around one rule
  // that every earlier version of this code broke: THE LIST'S LAYOUT DOES
  // NOT CHANGE WHILE A DRAG IS IN PROGRESS.
  //
  // Every previous version reordered the rendered list live as the drag
  // crossed a neighbour — the choices physically moved to new flow
  // positions mid-gesture. That is the root of the whole family of bugs
  // this panel has had. Reordering mid-drag means the geometry the
  // reorder decision is *reading* is changed by the decision itself:
  // measure a sibling to decide whether to swap past it, swap, and that
  // sibling is now somewhere else — which changes the answer to the
  // question that just triggered it. That fed back as choices flickering
  // together, as swap thresholds that moved while you were reaching for
  // them, and it forced every smoothing mechanism (animations, snapshots,
  // debounce timers) to be bolted on to compensate for instability that
  // shouldn't have existed.
  //
  // So: the DOM order is frozen for the whole gesture, and choices are
  // moved only by CSS transforms computed from a single measurement taken
  // at the instant of the grab. Nothing reflows, so nothing the reorder
  // logic reads can ever move underneath it, so the feedback loop is not
  // fixed but structurally impossible — and because layout is immutable,
  // the motion can finally be animated smoothly instead of having to snap
  // instantly to stay measurable. The dragged accordion itself is lifted
  // out of flow into a `position: fixed` overlay that tracks the cursor;
  // its own slot stays behind as the landing-zone outline, transformed to
  // wherever it would land if released right now.
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragTop, setDragTop] = useState(0);
  /** Which slot the dragged choice would land in if released now. */
  const [dragTargetIdx, setDragTargetIdx] = useState<number | null>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map());
  // Tracks the pending "reset the FLIP transform" rAF per item id, so a
  // second layout pass arriving before the first one's rAF has fired
  // (e.g. an option added/removed while a sibling is still mid-animation
  // from the previous change) cancels the stale one instead of letting
  // two competing rAFs fight over the same element's inline style.
  const flipRafRef = useRef<Map<string, number>>(new Map());
  // Mirrors the two pieces of drag state synchronously, so `finishDrag`
  // can read the latest values directly rather than through a `setState`
  // updater (see finishDrag's comment for why that mattered).
  const dragTopRef = useRef(0);
  const dragTargetIdxRef = useRef<number | null>(null);
  // Set by `finishDrag` for the item that was just released, so the
  // effect below can animate it smoothly from wherever the cursor left it
  // to its real resting position, instead of it silently teleporting
  // there the instant the drag ends.
  const pendingDropRef = useRef<{ id: string; fromTop: number; fromLeft: number } | null>(null);
  /** The choice currently gliding into place after a drop — painted above
   * the rest of the list for the length of that glide. */
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragContainerRef = useRef<HTMLDivElement>(null);
  // The entire geometry of the drag, measured once at the grab and then
  // treated as immutable — see `measureDragLayout` for what each field
  // means and how the landing slots are derived.
  const dragLayoutRef = useRef<DragLayout | null>(null);

  const displayedOrder = (options ?? []).map((o) => o.id);
  const byId = new Map((options ?? []).map((o) => [o.id, o]));

  // Self-heal: if the item currently being dragged no longer exists in
  // this block's options — the fast-path way that can happen is the
  // writer removing it from elsewhere while a drag is somehow still
  // active — drop the drag entirely instead of leaving a floating
  // overlay/landing zone pointing at nothing.
  useEffect(() => {
    if (dragId && !(options ?? []).some((o) => o.id === dragId)) {
      dragLayoutRef.current = null;
      dragTargetIdxRef.current = null;
      setDragId(null);
      setDragTargetIdx(null);
      setDragTop(0);
    }
  }, [options, dragId]);

  useLayoutEffect(() => {
    // Hands off entirely while a drag is running — the effect below owns
    // every transform for the duration of the gesture, and this one's job
    // (smoothing a real reflow) has nothing to do during a drag, because
    // a drag no longer causes one.
    if (dragId) return;

    // The actual root cause of "the panel gets visibly bugged if you
    // switch choices too fast": `getBoundingClientRect()` reports an
    // element's current VISUAL position, which includes any CSS
    // transform still mid-transition — not its true flow/layout
    // position. Rapid toggling/reordering fires this effect again well
    // within the previous run's 150ms transition, so `newRects` below
    // was being measured from an in-between, still-animating position
    // instead of the real one. That wrong number then got stored as the
    // NEXT run's `oldRect`, so the error didn't just cause one bad frame
    // — it fed forward and compounded with every subsequent change,
    // which is exactly how "big empty gaps that appear between choices"
    // can show up in a spot with no reorder, no dragged item, and no
    // stuck spacer: it was a stale, contaminated distance calculation
    // driving a transform to a wrong value that never resolved back to
    // zero, on a completely normal, still-present, no-longer-animating
    // choice. Fix: before measuring anything, synchronously snap every
    // item's transform back to identity (no transition — this happens
    // before paint, under useLayoutEffect, so there's no visible flash;
    // an item mid-transition just stops where it visually was, which is
    // fine — the correct new animation below starts from the true
    // position instead of continuing to build on a wrong one). Every
    // measurement after that point is guaranteed to be the item's real,
    // current layout position.
    displayedOrder.forEach((id) => {
      const el = itemRefs.current.get(id);
      if (!el) return;
      const pendingRaf = flipRafRef.current.get(id);
      if (pendingRaf !== undefined) {
        cancelAnimationFrame(pendingRaf);
        flipRafRef.current.delete(id);
      }
      el.style.transition = "none";
      el.style.transform = "";
    });

    const newRects = new Map<string, DOMRect>();
    displayedOrder.forEach((id) => {
      const el = itemRefs.current.get(id);
      if (el) newRects.set(id, el.getBoundingClientRect());
    });
    // v0.33.2 — a choice that just opened or closed is NOT animated into
    // place, however far its top moved.
    //
    // Reported: opening choices top-down looked broken while bottom-up
    // looked fine. Both were the same code. Opening choice 2 while choice
    // 1 is open does two things at once — 1 collapses, 2 expands — and
    // collapsing 1 lifts 2 several hundred pixels up the panel. FLIP saw
    // an element whose top moved 348px and did what it is for: put it
    // back where it was and slide it to where it now is. So the choice
    // the writer had just clicked came racing up from the bottom of the
    // panel. Bottom-up never showed it because collapsing a choice BELOW
    // the one being opened doesn't move it; the row that travelled was
    // the one closing, which nobody was looking at.
    //
    // The distinction that matters is what the movement MEANS. A row that
    // shifts because something else changed size did travel, and animating
    // it explains the layout. A row that opened or closed didn't travel at
    // all — its content changed, and it belongs exactly where the new
    // layout puts it. Animating that is telling the writer a story about
    // motion that never happened.
    const wasExpanded = prevExpandedRef.current;
    const changedOpenState = (id: string): boolean => wasExpanded.has(id) !== expanded.has(id);

    displayedOrder.forEach((id) => {
      const el = itemRefs.current.get(id);
      const oldRect = prevRectsRef.current.get(id);
      const newRect = newRects.get(id);
      if (el && oldRect && newRect && !changedOpenState(id)) {
        const dy = oldRect.top - newRect.top;
        if (Math.abs(dy) > 0.5) {
          // transform/transition were already reset above; just set the
          // "jumped" starting point and let the next frame transition it
          // back to identity.
          el.style.transform = `translateY(${dy}px)`;
          const rafId = requestAnimationFrame(() => {
            el.style.transition = "transform 150ms ease";
            el.style.transform = "";
            flipRafRef.current.delete(id);
          });
          flipRafRef.current.set(id, rafId);
        }
      }
    });
    prevRectsRef.current = newRects;
    prevExpandedRef.current = expanded;
    // `expanded` is intentionally included (via its size + membership
    // changing the Set reference every toggle) so a choice expanding or
    // collapsing — which reflows every choice below it — also refreshes
    // `prevRectsRef` immediately, rather than leaving it stale until the
    // next reorder/add/remove and then animating a big, wrong "catch-up"
    // jump from a layout that's long since changed. As a bonus, siblings
    // that shift because of the expand/collapse now animate into place
    // too, instead of only reorders getting that treatment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedOrder.join(","), dragId, expanded]);

  // The whole visible effect of a drag, expressed as transforms over a
  // layout that is not allowed to move. Every choice — the dragged one's
  // own slot included — is placed by `translateForIndex` from the
  // geometry captured at the grab, so what's on screen is a preview of
  // the real final layout without any of it having actually happened yet.
  //
  // These transitions are the motion that had to be switched off in every
  // previous version: when a drag reflowed the list for real, an animating
  // choice was a choice whose measured position was a moving target, and
  // the reorder logic read those measurements, so smooth motion and
  // correct reordering were mutually exclusive. Nothing is measured during
  // a drag any more, so they aren't — the list can settle gently and stay
  // exactly as predictable as if it snapped.
  useLayoutEffect(() => {
    const layout = dragLayoutRef.current;
    if (!dragId || !layout || dragTargetIdx === null) return;
    layout.order.forEach((id, i) => {
      const el = itemRefs.current.get(id);
      if (!el) return;
      const pendingRaf = flipRafRef.current.get(id);
      if (pendingRaf !== undefined) {
        cancelAnimationFrame(pendingRaf);
        flipRafRef.current.delete(id);
      }
      const dy = translateForIndex(layout, i, dragTargetIdx);
      el.style.transition = "transform 180ms cubic-bezier(0.2, 0, 0, 1)";
      el.style.transform = dy === 0 ? "" : `translateY(${dy}px)`;
    });
  }, [dragId, dragTargetIdx]);

  // On drop, the just-released choice reappears as a normal in-flow
  // element in the committed order — at the landing zone's position,
  // which is close to where the pointer left the overlay but not usually
  // exactly it. Without this, closing that last small distance would be
  // an instant teleport; with it, the choice glides the final few pixels
  // into place. This runs after the reflow effect above (same render,
  // later in declaration order) so its more accurate starting point —
  // the overlay's real last on-screen position — wins over that effect's
  // `prevRectsRef`-based guess for this one element.
  //
  // `settlingId` lifts that glide above the rest of the list for as long
  // as it lasts. While a choice is held, it's a floating overlay above
  // everything; the instant it's released it becomes an ordinary row
  // again, and an ordinary row is painted in document order — so a choice
  // dropped ABOVE an expanded one was, for the length of this animation,
  // travelling underneath it. It read as the choice diving behind the
  // open card on release rather than landing on top of the list, and only
  // in that direction, because dropping BELOW an expanded choice puts the
  // moving row later in document order where it already won.
  useLayoutEffect(() => {
    const pending = pendingDropRef.current;
    if (!pending || dragId) return;
    pendingDropRef.current = null;
    const el = itemRefs.current.get(pending.id);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dy = pending.fromTop - rect.top;
    const dx = pending.fromLeft - rect.left;
    if (Math.abs(dy) < 0.5 && Math.abs(dx) < 0.5) return;
    const pendingRaf = flipRafRef.current.get(pending.id);
    if (pendingRaf !== undefined) cancelAnimationFrame(pendingRaf);
    setSettlingId(pending.id);
    if (settleTimerRef.current !== null) clearTimeout(settleTimerRef.current);
    // Held a little past the 150ms glide so the lift never drops while
    // the choice is still visibly moving.
    settleTimerRef.current = setTimeout(() => {
      settleTimerRef.current = null;
      setSettlingId(null);
    }, 240);
    el.style.transition = "none";
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    const rafId = requestAnimationFrame(() => {
      el.style.transition = "transform 150ms ease";
      el.style.transform = "";
      flipRafRef.current.delete(pending.id);
    });
    flipRafRef.current.set(pending.id, rafId);
  }, [dragId]);

  // Cancel any FLIP rAFs still pending when this instance goes away —
  // belt-and-suspenders alongside the effects above; harmless if there's
  // nothing pending.
  useEffect(() => {
    return () => {
      flipRafRef.current.forEach((rafId) => cancelAnimationFrame(rafId));
      flipRafRef.current.clear();
      if (settleTimerRef.current !== null) clearTimeout(settleTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!dragId) return;

    // The only tuning value left in the reorder logic, and it isn't a
    // threshold — it's a small dead band that keeps the landing zone from
    // twitching between two slots when the pointer sits exactly on the
    // boundary between them. Everything else is derived from the list's
    // own measured geometry.
    const SLOT_HYSTERESIS = 6;

    function handleMove(e: PointerEvent): void {
      const layout = dragLayoutRef.current;
      if (!layout) return;

      // If the panel has been scrolled since the grab, the frozen
      // geometry now describes where the choices WERE. Subtracting the
      // scroll back out keeps it describing where they are.
      const scrollDelta = layout.scrollEl ? layout.scrollEl.scrollTop - layout.scrollTop : 0;

      // Where the dragged card actually is on screen: the pointer, minus
      // wherever inside the card it was grabbed. Clamped to the range of
      // real landing positions — which, because reordering can't change
      // how tall the list is, works out to exactly "stays within the
      // Choices section" without any invented number. The previous
      // version reserved a flat 28px of "clearance" at the bottom, a
      // constant that had to be guessed and was wrong for any card
      // taller than it.
      const firstSlot = layout.slotTops[0] - scrollDelta;
      const lastSlot = layout.slotTops[layout.slotTops.length - 1] - scrollDelta;
      const top = Math.min(Math.max(e.clientY - layout.grabOffsetY, firstSlot), lastSlot);
      dragTopRef.current = top;
      setDragTop(top);

      // Which slot is it nearest to landing in — see `nearestSlot` for
      // why this replaced every "have I crossed far enough past this
      // neighbour" rule that came before it.
      const current = dragTargetIdxRef.current ?? layout.draggedIdx;
      const next = nearestSlot(layout, top + scrollDelta, current, SLOT_HYSTERESIS);
      if (next !== current) {
        dragTargetIdxRef.current = next;
        setDragTargetIdx(next);
      }
    }

    // Shared by every way a drag can end — a clean pointerup, a lost
    // pointer capture (pointercancel — happens on a touch/pen drag that
    // strays out of bounds, or the OS intercepting the gesture), and the
    // window losing focus mid-drag (alt-tab, a native dialog, clicking
    // another app). Whatever ends it, the in-progress reorder still
    // commits — nothing about "you didn't release cleanly" should throw
    // away work — and the drag state always resets, so nothing is ever
    // left stuck mid-drag with no way to finish it.
    //
    // The final order is built here, at the drop, from the frozen order
    // plus the single index the drag settled on — the list itself was
    // never reordered while the drag was running, so this is the one and
    // only moment anything actually changes.
    //
    // `applyChoiceBlockOptions` is called as a plain side effect rather
    // than from inside a `setState` updater: it dispatches a real
    // ProseMirror transaction which synchronously updates the project
    // store, and running that during React's render phase can knock the
    // resulting store update out of the same batch as the rest of the
    // drop, showing up as a visible pause before the list catches up.
    function finishDrag(): void {
      const layout = dragLayoutRef.current;
      const droppedId = dragId;
      const targetIdx = dragTargetIdxRef.current;
      const fromTop = dragTopRef.current;
      const fromLeft = layout?.left;

      // Hand the reflow effect the positions the choices are ACTUALLY at
      // right now — displaced by the drag's transforms, which is already a
      // preview of the committed layout — as the baseline it animates
      // from. Without this it compares the committed layout against
      // `prevRectsRef`, which has been frozen since before the drag began
      // (the reflow effect stands down for the duration), and so animates
      // every choice back to where it sat before the drag and forward
      // again. On screen that is a jump at the exact moment of release:
      // the choices had already moved into place during the drag, and
      // then re-ran that same movement from the start. Recorded here,
      // before the transforms come off, the two layouts agree and there
      // is nothing left for that effect to animate.
      const settledRects = new Map<string, DOMRect>();
      layout?.order.forEach((id) => {
        const el = itemRefs.current.get(id);
        if (el) settledRects.set(id, el.getBoundingClientRect());
      });
      if (layout) prevRectsRef.current = settledRects;

      // Drop every transform before the real reorder lands, so the list
      // never renders its new order and the old displacement at once.
      layout?.order.forEach((id) => {
        const el = itemRefs.current.get(id);
        if (!el) return;
        el.style.transition = "";
        el.style.transform = "";
      });

      if (layout && targetIdx !== null && editor) {
        const finalOrder = layout.order.filter((id) => id !== droppedId);
        finalOrder.splice(targetIdx, 0, droppedId as string);
        const finalOptions = finalOrder
          .map((id) => optionsRef.current.find((o) => o.id === id))
          .filter((o): o is ChoiceOption => Boolean(o));
        if (finalOptions.length === optionsRef.current.length && finalOptions.length > 0) {
          reorderChoiceOptions(editor, target.blockId, finalOptions.map((o) => o.id));
        }
      }

      if (droppedId && fromLeft !== undefined) {
        pendingDropRef.current = { id: droppedId, fromTop, fromLeft };
      }

      dragLayoutRef.current = null;
      dragTargetIdxRef.current = null;
      setDragTargetIdx(null);
      setDragId(null);
      setDragTop(0);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);
    window.addEventListener("blur", finishDrag);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
      window.removeEventListener("blur", finishDrag);
    };
  }, [dragId, editor, target.blockId]);

  function handleDragHandleDown(e: ReactPointerEvent, id: string): void {
    e.preventDefault();
    // If a previous drag is somehow still active (a missed pointerup —
    // see finishDrag's comment above), don't stack a second one on top of
    // it: let the effect above unwind the old one first on the next
    // render rather than starting a new drag from a half-cleaned state.
    if (dragId) return;
    const order = (options ?? []).map((o) => o.id);
    const draggedIdx = order.indexOf(id);
    if (draggedIdx < 0 || order.length < 2) return;

    // Settle anything still animating before measuring. A rect reports
    // where an element is being PAINTED, which mid-transition is a point
    // part-way through it — and a transition back to identity leaves
    // `style.transform` reading empty while the COMPUTED transform is
    // still a matrix, so an in-flight animation is invisible to every
    // obvious check. Grab a choice while the list is still settling
    // (expanding another choice slides everything below it; so does the
    // tail of a previous drop) and the measurements describe no real
    // layout at all: observed directly, a choice whose true position was
    // 514px reported 397px while its neighbour reported its full height,
    // which puts them 111px inside each other. Geometry derived from that
    // is nonsense — the measured spacing between choices came out
    // NEGATIVE — so the drag previewed a layout that was never going to
    // happen and then snapped ~190px to the real one at the drop. That
    // correction, with choices sliding past each other to reach positions
    // they should already have been in, is what reads as the movement
    // happening behind the open choice after you let go. Snapping to
    // identity first costs nothing — anything mid-animation simply
    // arrives early — and makes every number below a real layout position
    // instead of an animation frame. Same fix, same reason, as the reflow
    // effect's own snap further up.
    for (const optionId of order) {
      const itemEl = itemRefs.current.get(optionId);
      if (!itemEl) return;
      const pendingRaf = flipRafRef.current.get(optionId);
      if (pendingRaf !== undefined) {
        cancelAnimationFrame(pendingRaf);
        flipRafRef.current.delete(optionId);
      }
      itemEl.style.transition = "none";
      itemEl.style.transform = "";
    }

    // The one and only measurement of the whole gesture. It has to happen
    // here, synchronously on the grab, before any drag state exists: one
    // render later the dragged choice is already a lifted-out overlay,
    // and this would no longer be everyone's true undisturbed position.
    // Everything the drag does afterwards is arithmetic on these numbers.
    const rects: DOMRect[] = [];
    for (const optionId of order) {
      const itemEl = itemRefs.current.get(optionId);
      if (!itemEl) return;
      rects.push(itemEl.getBoundingClientRect());
    }

    const layout = buildDragLayout(
      order,
      rects,
      draggedIdx,
      e.clientY - rects[draggedIdx].top,
      findScrollParent(dragContainerRef.current),
    );
    dragLayoutRef.current = layout;
    dragTargetIdxRef.current = draggedIdx;
    dragTopRef.current = rects[draggedIdx].top;
    setDragTargetIdx(draggedIdx);
    setDragTop(rects[draggedIdx].top);
    setDragId(id);
  }
  // -----------------------------------------------------------------------

  if (!scene || !options) {
    return <p className="text-[var(--text-3)]">This Choice Block is no longer in the document.</p>;
  }

  /**
   * Since v0.32.0 an option is its own document node, so the Inspector
   * edits one option's ATTRIBUTES rather than replacing the block's whole
   * list. The label isn't among them — it's inline content the writer types
   * in the editor, and writing it from here too would give the same text
   * two writers and the desync that always follows.
   */
  function patchOption(optionId: string, patch: Partial<ChoiceOption>): void {
    if (!editor) return;
    const attrs: Record<string, unknown> = {};
    if ("targetSceneId" in patch) attrs.targetSceneId = patch.targetSceneId ?? null;
    if ("conditions" in patch) attrs.conditions = patch.conditions ?? [];
    if ("actions" in patch) attrs.actions = patch.actions ?? [];
    if ("whenUnmet" in patch) attrs.whenUnmet = patch.whenUnmet ?? "hide";
    // v0.34.0. `null` is meaningful here — it is "inherit the project
    // default" — so this passes it through rather than falling back to
    // something, unlike every line above it.
    if ("style" in patch) attrs.style = patch.style ?? null;
    // v0.37.0 — same rule as `style`: null is the answer "nobody", not a
    // missing value, so it goes through untouched.
    if ("speaker" in patch) attrs.speaker = patch.speaker ?? null;
    if (Object.keys(attrs).length === 0) return;
    applyChoiceOptionAttrs(editor, optionId, attrs);
  }

  function addChoice(): void {
    if (!editor) return;
    appendChoiceOption(editor, target.blockId);
  }

  function removeChoice(optionId: string): void {
    if (!editor) return;
    // Removing the last option takes the block with it — a branching point
    // that doesn't branch is not a thing to leave behind.
    removeChoiceOption(editor, optionId);
  }

  function toggleExpanded(optionId: string): void {
    // Touching an accordion by hand takes it out of the caret's control —
    // otherwise the writer closes the one they're typing in and it springs
    // back open on their next keystroke.
    if (autoOpenedRef.current === optionId) autoOpenedRef.current = null;
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(optionId)) next.delete(optionId);
      else next.add(optionId);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="scriare-section-label text-[var(--text-3)]">
          Choices
        </h3>
        <button
          type="button"
          onClick={addChoice}
          className="rounded px-1.5 py-0.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-soft-2)]"
        >
          + Add Choice
        </button>
      </div>

      <div className="space-y-2" ref={dragContainerRef}>
        {displayedOrder.map((id) => {
          const option = byId.get(id);
          if (!option) return null;
          const isDragging = dragId === id;

          // The dragged choice is lifted out of flow into the overlay
          // below; the element that stays here in its place is the
          // landing zone — an outline sized to the dragged choice's own
          // height, moved by transform to whichever slot it would land in
          // if released right now. It keeps its original DOM position for
          // the whole drag (that's the point — nothing reorders), so the
          // only thing that ever moves it is the transform applied by the
          // displacement effect above.
          if (isDragging) {
            return (
              <div
                key={id}
                ref={(el) => {
                  if (el) itemRefs.current.set(id, el);
                  else itemRefs.current.delete(id);
                }}
                style={{
                  height: dragLayoutRef.current?.height ?? 0,
                  // Explicitly the BOTTOM layer of the list. Without a
                  // stated depth, this placeholder and the choices around
                  // it all painted at the same level, where the winner is
                  // decided by document order — and because this element
                  // keeps the dragged choice's original position for the
                  // whole gesture, that order flips with the direction of
                  // travel. Dragging down, the choices painted over the
                  // placeholder and it read correctly; dragging up, the
                  // placeholder painted over them, so a choice sliding
                  // aside appeared to pass BEHIND an empty outline. Same
                  // code, opposite appearance, decided purely by which way
                  // the drag happened to go. The choices are solid objects
                  // and this is the gap they move around, so it belongs
                  // underneath them in both directions.
                  position: "relative",
                  zIndex: 0,
                }}
                className="rounded-lg border-2 border-dashed border-[var(--accent)] bg-[var(--accent-soft-2)]"
                aria-hidden
              />
            );
          }

          return (
            <div
              key={id}
              ref={(el) => {
                if (el) itemRefs.current.set(id, el);
                else itemRefs.current.delete(id);
              }}
              // Sits above the landing placeholder — see its comment for
              // why this has to be stated rather than left to document
              // order. A choice moving aside should pass in front of the
              // gap it's moving around, whichever direction the drag goes.
              // The one choice gliding into place after a drop goes higher
              // still, so it lands on top of the list instead of sliding
              // under whatever it's passing.
              style={{ position: "relative", zIndex: id === settlingId ? 2 : 1 }}
            >
              <ChoiceAccordion
                option={option}
                expanded={expanded.has(option.id)}
                onToggle={() => toggleExpanded(option.id)}
                onDragHandleDown={(e) => handleDragHandleDown(e, option.id)}
                onPatch={(patch) => patchOption(option.id, patch)}
                onRemove={() => removeChoice(option.id)}
                otherScenes={otherScenes}
                variables={variables}
                onOpenVariableManager={openVariableManager}
                removeDisabled={options.length <= 1 && !option.text && !option.targetSceneId}
              />
            </div>
          );
        })}
      </div>

      {dragId &&
        dragLayoutRef.current &&
        (() => {
          const draggedOption = byId.get(dragId);
          if (!draggedOption) return null;
          const info = dragLayoutRef.current;
          return (
            <div
              style={{
                position: "fixed",
                top: dragTop,
                left: info.left,
                width: info.width,
                zIndex: 50,
                pointerEvents: "none",
                // This div is the second child of the "space-y-3" wrapper
                // above, so that utility's `> * + *` rule hands it a 12px
                // margin-top by default — harmless for normal-flow
                // siblings, but for a `position: fixed` box the CSS `top`
                // offset positions the MARGIN edge, not the border edge,
                // so that stray margin silently pushed this overlay 12px
                // below the intended (and clamped) position. Force it to
                // zero explicitly — inline styles beat the utility class
                // regardless of stylesheet order.
                //
                // Depth. This overlay has always been genuinely in front —
                // it clips whatever it passes over — but it didn't LOOK it,
                // and a dragged choice that doesn't read as lifted reads as
                // sliding underneath instead. Tailwind's `shadow-lg` is the
                // culprit on the dark theme: a black shadow over a near-black
                // panel is invisible, and the card's own background and
                // border are the same tokens every other choice uses, so
                // nothing separated it from what it was crossing. Three cues
                // instead, all theme-safe: a 1px ring in the brighter border
                // tone (which goes lighter on dark and darker on light, so it
                // lifts either way), and two shadow layers — a tight one for
                // the edge and a wide soft one for the cast — dark enough to
                // register against a 12%-lightness ground without blowing out
                // the light theme. Matching the card's own 6px radius keeps
                // the ring and shadow on the card's actual silhouette rather
                // than boxing a rounded card in a rectangle.
                borderRadius: 6,
                // The token, not the dark theme's two layers written out by
                // hand: on a light ground a black shadow at that strength
                // reads as dirt on paper, which is the exact thing
                // --shadow-floating exists to get right per theme (v0.46.0).
                boxShadow: "0 0 0 1px var(--border-faint), var(--shadow-floating)",
                marginTop: 0,
              }}
            >
              <ChoiceAccordion
                option={draggedOption}
                expanded={expanded.has(draggedOption.id)}
                onToggle={() => {}}
                onDragHandleDown={() => {}}
                onPatch={() => {}}
                onRemove={() => {}}
                otherScenes={otherScenes}
                variables={variables}
                onOpenVariableManager={openVariableManager}
                removeDisabled
              />
            </div>
          );
        })()}
    </div>
  );
}

interface SceneOption {
  id: string;
  title: string;
}

interface ChoiceAccordionProps {
  option: ChoiceOption;
  expanded: boolean;
  onToggle: () => void;
  onDragHandleDown: (e: ReactPointerEvent) => void;
  onPatch: (patch: Partial<ChoiceOption>) => void;
  onRemove: () => void;
  otherScenes: SceneOption[];
  variables: Variable[];
  onOpenVariableManager: () => void;
  /** True only for a single, still-empty option — removing it would just
   * delete the whole block for no reason; disabled rather than hidden so
   * the control stays in a predictable place. */
  removeDisabled: boolean;
}

/**
 * A choice's appearance (v0.34.0): which named Choice Style it wears, and
 * any one-off tweaks on top.
 *
 * The two-level shape is the whole design. Picking a style is the normal
 * case and the one that scales — change "Danger" once and every dangerous
 * choice in the story changes with it. Overriding is the escape hatch for
 * the choice that genuinely is one of a kind, and it stays visibly an
 * exception: the moment there is one, this section says so and offers to
 * take it back.
 *
 * Text is pointedly absent. The words inside a choice are real text in the
 * document (v0.32.0), and the toolbar already styles text — putting font
 * controls here as well would mean two places to set one thing, which is
 * the disagreement this app keeps deleting wherever it finds it.
 */
/**
 * Who says this choice (v0.37.0).
 *
 * A choice usually isn't spoken by anyone — it's an option on a menu, and
 * "Nobody" is both the default and the honest description of most of them.
 * But some stories make the choices themselves into voices: Disco Elysium's
 * competing inner faculties, a party game where each option is a different
 * companion pressing their case. That's a property of the choice rather
 * than something typed into it, which is why it's in the Inspector and not
 * in the editor — the writer sets it once and then writes the line.
 *
 * The player sits in the list beside the characters because it's the most
 * common answer of all after "nobody": the protagonist says most of what a
 * player picks, and demanding a Character page for someone the writer is
 * deliberately leaving unnamed would be the app arguing with the story.
 */
/** A stable empty list, so the selector above doesn't rerender on every store tick. */
const EMPTY_ENTITIES: Entity[] = [];

function ChoiceSpeaker({
  option,
  onPatch,
}: {
  option: ChoiceOption;
  onPatch: (patch: Partial<ChoiceOption>) => void;
}) {
  const entities = useProjectStore((s) => s.project?.entities ?? EMPTY_ENTITIES);
  return (
    <div>
      <select
        data-choice-speaker
        value={option.speaker ?? ""}
        onChange={(e) => onPatch({ speaker: e.target.value || null })}
        className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
      >
        <option value="">— Nobody —</option>
        <option value={PLAYER_SPEAKER}>{PLAYER_SPEAKER_LABEL} (the player)</option>
        {/* Characters only — a Location can be named in a choice but can't
            speak one. See canSpeak in types/speaker.ts. */}
        {entities.filter(canSpeak).map((entity) => (
          <option key={entity.id} value={entity.id}>
            {entity.name || "Unnamed"}
          </option>
        ))}
      </select>
    </div>
  );
}

function ChoiceAppearance({
  option,
  onPatch,
}: {
  option: ChoiceOption;
  onPatch: (patch: Partial<ChoiceOption>) => void;
}) {
  const styles = useProjectStore((s) => s.project?.choiceStyles) ?? [];
  const openChoiceStyles = useUIStore((s) => s.openChoiceStyles);
  const ref = option.style ?? null;
  const styleId = ref?.styleId ?? DEFAULT_CHOICE_STYLE_ID;
  const overridden = hasOverrides(ref);
  const resolved = resolveChoiceBox(styles, ref);

  function setStyle(nextId: string): void {
    onPatch({
      style: nextId === DEFAULT_CHOICE_STYLE_ID && !overridden
        ? null // back to "inherit", not "explicitly the default"
        : { ...ref, styleId: nextId },
    });
  }

  function setOverride(patch: Partial<ChoiceBox>): void {
    onPatch({ style: { ...ref, overrides: { ...(ref?.overrides ?? {}), ...patch } } });
  }

  function clearOverrides(): void {
    const styleId = ref?.styleId ?? null;
    onPatch({ style: styleId ? { styleId } : null });
  }

  return (
    <div data-appearance-for={option.id}>
      <div className="flex items-center gap-1.5">
        <select
          value={styleId}
          onChange={(e) => setStyle(e.target.value)}
          className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
        >
          {styles.map((style) => (
            <option key={style.id} value={style.id}>
              {style.name || "Untitled style"}
            </option>
          ))}
        </select>
        <button
          type="button"
          // No origin: this route came from the Inspector, not from
          // Settings, so the dialog must not offer a way "back" to a
          // Settings dialog the writer was never in (v0.55.0).
          onClick={() => openChoiceStyles()}
          title="Edit the project's Choice Styles"
          className="shrink-0 rounded px-1.5 py-1 text-xs text-[var(--accent)] hover:bg-[var(--accent-soft-2)]"
        >
          Edit…
        </button>
      </div>

      {/* What this choice will actually look like, resolved — including any
          override. Small, but it's the only place the two levels are
          visible as one answer. */}
      <div
        style={choiceBoxCss(resolved)}
        className="mt-2 px-2.5 py-1.5 text-xs text-[var(--text-2)]"
      >
        {option.text || "Untitled choice"}
      </div>

      <details className="mt-2 [&[open]>summary]:mb-2">
        <summary className="cursor-pointer select-none text-[11px] text-[var(--text-3)] hover:text-[var(--text-2)]">
          {overridden ? "Custom for this choice" : "Customise just this one"}
        </summary>
        <BoxControls box={resolved} onChange={setOverride} subject="choice" />
        {overridden && (
          <button
            type="button"
            onClick={clearOverrides}
            className="mt-2 rounded px-1.5 py-0.5 text-[11px] font-medium text-[var(--accent)] hover:bg-[var(--accent-soft-2)]"
          >
            Back to the style
          </button>
        )}
      </details>
    </div>
  );
}

/**
 * One Choice's accordion — collapsed, it's a single summary row (per the
 * brief: destination, condition count, action count) with a drag handle;
 * expanded, it exposes Display Text, Destination, a Conditions placeholder,
 * and Actions — everything Choice Block Integration (Sprint 9A) already
 * had, just relocated here instead of living in the editor.
 */
/**
 * A field and the word for it, side by side (v0.65.0).
 *
 * The Inspector is 320px wide with 16px of padding either side, so a
 * label ABOVE its control costs a whole row of height to say one word.
 * Three of those — speaker, style, destination — were three rows of
 * height spent on labels in a panel whose problem was height.
 *
 * The label column is fixed rather than auto so the three controls line
 * up with each other; a ragged left edge on three stacked selects reads
 * as three unrelated things.
 */
function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[52px_minmax(0,1fr)] items-start gap-2">
      <span className="pt-1.5 text-[11px] leading-none text-[var(--text-3)]">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/**
 * A rule that is not set, stated rather than drawn (v0.65.0).
 *
 * "Shown always" and "Changes nothing" are facts about the choice, and
 * they are exactly the two facts a writer would otherwise open two
 * sections to confirm. Saying them costs one line; drawing the empty
 * sections cost a heading, a control and the gaps around both — on every
 * choice, and most choices have neither a condition nor an action.
 */
function QuietRule({
  says,
  action,
  onAction,
  ...rest
}: {
  says: string;
  action: string;
  onAction: () => void;
} & Record<`data-${string}`, string>) {
  return (
    <div
      {...rest}
      className="flex items-center justify-between gap-2 border-t border-[var(--border-soft)] pt-2.5 text-xs text-[var(--text-3)]"
    >
      <span className="text-[var(--text-2)]">{says}</span>
      <button
        type="button"
        onClick={onAction}
        className="shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-soft-2)]"
      >
        {action}
      </button>
    </div>
  );
}

function ChoiceAccordion({
  option,
  expanded,
  onToggle,
  onDragHandleDown,
  onPatch,
  onRemove,
  otherScenes,
  variables,
  onOpenVariableManager,
  removeDisabled,
}: ChoiceAccordionProps) {
  const conditionCount = option.conditions.length;
  const actionCount = option.actions.length;

  function destinationLabel(targetSceneId: string | null): string {
    if (!targetSceneId) return "Not linked yet";
    const target = otherScenes.find((sc) => sc.id === targetSceneId);
    return target ? `→ ${target.title || "Untitled scene"}` : "Not linked yet";
  }

  function addCondition(): void {
    const condition = buildVariableCondition(variables);
    if (!condition) return;
    onPatch({ conditions: [...option.conditions, condition] });
  }

  function updateCondition(conditionId: string, patch: Partial<VariableCondition>): void {
    onPatch({
      conditions: option.conditions.map((c) => (c.id === conditionId ? { ...c, ...patch } : c)),
    });
  }

  function removeCondition(conditionId: string): void {
    onPatch({ conditions: option.conditions.filter((c) => c.id !== conditionId) });
  }

  function addAction(): void {
    const action = buildVariableAction(variables);
    if (!action) return;
    onPatch({ actions: [...option.actions, action] });
  }

  function updateAction(actionId: string, patch: Partial<VariableAction>): void {
    onPatch({ actions: option.actions.map((a) => (a.id === actionId ? { ...a, ...patch } : a)) });
  }

  function removeAction(actionId: string): void {
    onPatch({ actions: option.actions.filter((a) => a.id !== actionId) });
  }

  return (
    <div
      // Which option this accordion is for. The drag code addresses rows by
      // index and the writer addresses them by reading them; this is for
      // anything that needs to find one option's controls by identity —
      // tests today, and any future "scroll the focused choice into view".
      data-option-id={option.id}
      data-expanded={expanded ? "true" : "false"}
      className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg)]"
    >
      <div className="flex items-center gap-1">
        <span
          onPointerDown={onDragHandleDown}
          title="Drag to reorder"
          className="shrink-0 cursor-grab select-none px-1.5 py-2 text-[var(--text-3)] hover:text-[var(--text)] active:cursor-grabbing"
          style={{ touchAction: "none" }}
        >
          ⠿
        </span>
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-1.5 py-2 pr-1 text-left"
        >
          <span aria-hidden className="shrink-0 text-[10px] text-[var(--text-3)]">
            {expanded ? "▾" : "▸"}
          </span>
          <span
            className={`min-w-0 flex-1 truncate text-sm ${
              option.text ? "text-[var(--text)]" : "italic text-[var(--text-3)]"
            }`}
          >
            {option.text || "Untitled choice"}
          </span>
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={removeDisabled}
          title={removeDisabled ? "Add some content before removing the last choice" : "Remove this choice"}
          className="shrink-0 rounded px-1.5 py-1 text-xs text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--danger)] disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-[var(--text-3)]"
        >
          ✕
        </button>
      </div>

      {!expanded && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-2 pb-2 text-xs text-[var(--text-3)]">
          <span className={option.targetSceneId ? "text-[var(--accent)]" : ""}>
            {destinationLabel(option.targetSceneId)}
          </span>
          <span>·</span>
          <span>
            {conditionCount} {conditionCount === 1 ? "condition" : "conditions"}
          </span>
          <span>·</span>
          <span>{actionCount} {actionCount === 1 ? "action" : "actions"}</span>
        </div>
      )}

      {expanded && (
        <div className="space-y-3 border-t border-[var(--border-soft)] px-2 py-2.5">
          {/*
            I2, applied to the choice editor (v0.65.0).

            What was here was six labelled fields at one weight — Display
            Text, Who Says It, Appearance, Destination, Conditions,
            Actions — stacked in a 320px column, inside an accordion,
            inside a list of accordions. The scene panel got headings in
            v0.59.0; this did not.

            THE GROUPING IS NOT THE POINT. The panel's real problem is
            that a choice with nothing set looked exactly as complicated
            as a choice with a locked condition and two effects, and most
            choices have nothing set. So an empty rule is not a heading
            over an empty control: it is one grey line that says what is
            true — "Shown always", "Changes nothing" — with the way to
            change it beside it. Same rule the status bar already follows
            when it counts notes only if there are notes.
          */}
          <div className="space-y-2">
            <h4 className="scriare-section-label text-[var(--text-3)]">The Line</h4>

            {/* The label used to be edited here, as a plain string. As of
                v0.32.0 it's real text in the document — type it in the
                scene, and the toolbar styles it like any other sentence.
                Read-only here rather than pretending there are two places
                to write it. */}
            <div className="rounded border border-dashed border-[var(--border-soft)] px-2 py-1.5 text-xs">
              <span className={option.text ? "text-[var(--text-2)]" : "italic text-[var(--text-3)]"}>
                {option.text || "Untitled choice"}
              </span>
              <span className="mt-0.5 block text-[10px] text-[var(--text-3)]">
                Edited in the scene — select it there to restyle it.
              </span>
            </div>

            {/* Inline labels, not labels above. Three stacked
                label-over-control pairs cost six rows of height in a
                column this narrow; three rows say the same thing. */}
            <FieldRow label="Speaker">
              <ChoiceSpeaker option={option} onPatch={onPatch} />
            </FieldRow>

            <FieldRow label="Style">
              <ChoiceAppearance option={option} onPatch={onPatch} />
            </FieldRow>

            <FieldRow label="Goes to">
              <select
                value={option.targetSceneId ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === CREATE_SCENE_VALUE) {
                    // Sprint 9C — create a Scene inline without leaving the
                    // Inspector or navigating the editor away from the scene
                    // the writer is currently in (see createUnlinkedScene's
                    // doc comment in projectStore.ts). The new scene is
                    // auto-selected as this choice's destination immediately.
                    const newSceneId = useProjectStore.getState().createUnlinkedScene();
                    if (newSceneId) onPatch({ targetSceneId: newSceneId });
                    return;
                  }
                  onPatch({ targetSceneId: value || null });
                }}
                className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
              >
                <option value="">— Not linked —</option>
                {otherScenes.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    → {sc.title || "Untitled scene"}
                  </option>
                ))}
                <option value={CREATE_SCENE_VALUE}>+ Create New Scene</option>
              </select>
            </FieldRow>
          </div>

          {/* ── Shown ─────────────────────────────────────────────── */}
          {option.conditions.length === 0 ? (
            <QuietRule
              data-rule="shown"
              says="Shown always"
              action={variables.length === 0 ? "Add a variable first" : "+ Condition"}
              onAction={variables.length === 0 ? onOpenVariableManager : addCondition}
            />
          ) : (
            <div className="space-y-2 border-t border-[var(--border-soft)] pt-2.5" data-rule="shown">
              <h4 className="scriare-section-label text-[var(--text-3)]">Shown</h4>
              {option.conditions.map((condition) => (
                <ConditionRow
                  key={condition.id}
                  condition={condition}
                  variables={variables}
                  onChange={(next) => updateCondition(condition.id, next)}
                  onRemove={() => removeCondition(condition.id)}
                />
              ))}
              {/* Only meaningful once there's something to fail. On an
                  unconditional choice it would be asking about a state
                  that can never happen — which is why it lives in here
                  and not in the quiet line above. */}
              <div className="flex items-center gap-1.5 pt-0.5">
                <span className="shrink-0 text-xs text-[var(--text-3)]">If not met:</span>
                <select
                  value={option.whenUnmet}
                  onChange={(e) => onPatch({ whenUnmet: e.target.value as "hide" | "lock" })}
                  className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 py-1 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
                >
                  <option value="hide">Hide the choice</option>
                  <option value="lock">Show it locked</option>
                </select>
              </div>
              <button
                type="button"
                onClick={addCondition}
                disabled={variables.length === 0}
                className="rounded px-1.5 py-0.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-soft-2)] disabled:opacity-50"
              >
                + Add Condition
              </button>
            </div>
          )}

          {/* ── Changes ───────────────────────────────────────────── */}
          {option.actions.length === 0 ? (
            <QuietRule
              data-rule="changes"
              says="Changes nothing"
              action={variables.length === 0 ? "Add a variable first" : "+ Action"}
              onAction={variables.length === 0 ? onOpenVariableManager : addAction}
            />
          ) : (
            <div className="space-y-2 border-t border-[var(--border-soft)] pt-2.5" data-rule="changes">
              <h4 className="scriare-section-label text-[var(--text-3)]">Changes</h4>
              {option.actions.map((action) => (
                <ActionRow
                  key={action.id}
                  action={action}
                  variables={variables}
                  onChange={(next) => updateAction(action.id, next)}
                  onRemove={() => removeAction(action.id)}
                />
              ))}
              <button
                type="button"
                onClick={addAction}
                disabled={variables.length === 0}
                className="rounded px-1.5 py-0.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-soft-2)] disabled:opacity-50"
              >
                + Add Action
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ActionRowProps {
  action: VariableAction;
  variables: Variable[];
  onChange: (patch: Partial<VariableAction>) => void;
  onRemove: () => void;
}

/**
 * One Actions row — "Variable [ Trust ▼ ]  Operation [ Set ]  Value [ 5 ]"
 * from the Sprint 9A brief's mockup. Changing the Variable re-derives the
 * Operation (to that variable's own first allowed operation) and the Value
 * (to a fresh default for its type).
 *
 * Sprint 9C adds "+ Create Variable" to the Variable dropdown — per the
 * brief's own mockup this opens a small inline form (Name + Type) right
 * here rather than creating immediately, since (unlike a Scene) a Variable
 * needs a name before it's useful. Creating one calls the Variable
 * Manager's sibling action `createVariable` (see projectStore.ts) and wires
 * the result straight into this action, exactly like picking an existing
 * variable would.
 */
function ActionRow({ action, variables, onChange, onRemove }: ActionRowProps) {
  const [creatingVariable, setCreatingVariable] = useState(false);
  const [newVariableName, setNewVariableName] = useState("");
  const [newVariableType, setNewVariableType] = useState<VariableType>("number");

  const variable = variables.find((v) => v.id === action.variableId) ?? variables[0];

  if (!variable) return null;

  const operations = OPERATIONS_BY_TYPE[variable.type];

  function handleVariableChange(variableId: string): void {
    const next = variables.find((v) => v.id === variableId);
    if (!next) return;
    onChange({
      variableId,
      operation: OPERATIONS_BY_TYPE[next.type][0].value,
      value: defaultValueForType(next.type),
    });
  }

  function handleVariableSelectChange(value: string): void {
    if (value === CREATE_VARIABLE_VALUE) {
      setCreatingVariable(true);
      return;
    }
    handleVariableChange(value);
  }

  function commitNewVariable(): void {
    const name = newVariableName.trim();
    if (!name) return;
    const newVariableId = useProjectStore.getState().createVariable(name, newVariableType);
    if (newVariableId) {
      onChange({
        variableId: newVariableId,
        operation: OPERATIONS_BY_TYPE[newVariableType][0].value,
        value: defaultValueForType(newVariableType),
      });
    }
    setCreatingVariable(false);
    setNewVariableName("");
    setNewVariableType("number");
  }

  function cancelNewVariable(): void {
    setCreatingVariable(false);
    setNewVariableName("");
    setNewVariableType("number");
  }

  function handleValueChange(value: VariableValue): void {
    onChange({ value });
  }

  return (
    <div className="space-y-1 rounded-md border border-[var(--border-soft)] bg-[var(--surface)] px-2 py-1.5">
      <div className="flex items-center justify-between">
        <select
          value={creatingVariable ? CREATE_VARIABLE_VALUE : variable.id}
          onChange={(e) => handleVariableSelectChange(e.target.value)}
          className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 py-1 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
        >
          {variables.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name || "Untitled variable"}
            </option>
          ))}
          <option value={CREATE_VARIABLE_VALUE}>+ Create Variable</option>
        </select>
        <button
          type="button"
          onClick={onRemove}
          title="Remove this action"
          className="shrink-0 rounded px-1.5 text-xs text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"
        >
          ✕
        </button>
      </div>

      {creatingVariable ? (
        <div className="space-y-1.5 rounded border border-dashed border-[var(--border-soft)] px-2 py-2">
          <input
            autoFocus
            value={newVariableName}
            onChange={(e) => setNewVariableName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitNewVariable();
              if (e.key === "Escape") cancelNewVariable();
            }}
            placeholder="Variable name"
            className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 py-1 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
          />
          <select
            value={newVariableType}
            onChange={(e) => setNewVariableType(e.target.value as VariableType)}
            className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 py-1 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
          >
            {(Object.keys(VARIABLE_TYPE_LABELS) as VariableType[]).map((t) => (
              <option key={t} value={t}>
                {VARIABLE_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={cancelNewVariable}
              className="rounded px-1.5 py-0.5 text-xs text-[var(--text-3)] hover:bg-[var(--surface-2)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={commitNewVariable}
              disabled={!newVariableName.trim()}
              className="rounded px-1.5 py-0.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-soft-2)] disabled:opacity-40"
            >
              Create
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <select
            value={action.operation}
            onChange={(e) => onChange({ operation: e.target.value })}
            className="shrink-0 rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 py-1 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
          >
            {operations.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>

          {action.operation !== "toggle" && (
            <ValueInput type={variable.type} value={action.value} onChange={handleValueChange} />
          )}
        </div>
      )}
    </div>
  );
}

interface ConditionRowProps {
  condition: VariableCondition;
  variables: Variable[];
  onChange: (patch: Partial<VariableCondition>) => void;
  onRemove: () => void;
}

/**
 * One "is this true?" row. Deliberately the same shape as ActionRow — a
 * condition IS an action read instead of written, so making the two look
 * and behave differently would be inventing a distinction the model
 * doesn't have.
 *
 * The one thing it doesn't carry is ActionRow's inline "+ Create Variable".
 * A condition tests state that already exists; a variable invented at the
 * moment you gate something on it is, by definition, still at its default
 * and so the gate either always passes or never does. The Variable Manager
 * link in the empty state covers the genuine "I have no variables yet"
 * case.
 */
function ConditionRow({ condition, variables, onChange, onRemove }: ConditionRowProps) {
  const variable = variables.find((v) => v.id === condition.variableId) ?? variables[0];
  if (!variable) return null;

  const missing = !variables.some((v) => v.id === condition.variableId);
  const comparators = COMPARATORS_BY_TYPE[variable.type];

  function handleVariableChange(variableId: string): void {
    const next = variables.find((v) => v.id === variableId);
    if (!next) return;
    // The comparator and value are re-derived rather than carried across:
    // "is at least" means nothing on a boolean, and a leftover number would
    // be compared against a true/false.
    onChange({
      variableId,
      comparator: COMPARATORS_BY_TYPE[next.type][0].value,
      value: defaultValueForType(next.type),
    });
  }

  return (
    <div className="space-y-1 rounded-md border border-[var(--border-soft)] bg-[var(--surface)] px-2 py-1.5">
      <div className="flex items-center justify-between">
        <select
          value={variable.id}
          onChange={(e) => handleVariableChange(e.target.value)}
          className={`min-w-0 flex-1 rounded border bg-[var(--bg)] px-1.5 py-1 text-xs outline-none focus:border-[var(--accent)] ${
            missing
              ? "border-[var(--danger)] text-[var(--danger)]"
              : "border-[var(--border)] text-[var(--text)]"
          }`}
          title={missing ? "This condition's variable no longer exists — it will never pass" : undefined}
        >
          {variables.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name || "Untitled variable"}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onRemove}
          title="Remove this condition"
          className="shrink-0 rounded px-1.5 text-xs text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"
        >
          ✕
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange({ negate: !condition.negate })}
          aria-pressed={Boolean(condition.negate)}
          title="Invert this condition"
          className={`shrink-0 rounded border px-1.5 py-1 text-xs font-medium transition-colors ${
            condition.negate
              ? "border-[var(--accent-ring)] bg-[var(--accent-soft-2)] text-[var(--text)]"
              : "border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text-2)]"
          }`}
        >
          NOT
        </button>

        <select
          value={condition.comparator}
          onChange={(e) => onChange({ comparator: e.target.value })}
          className="shrink-0 rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 py-1 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
        >
          {comparators.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        <ValueInput
          type={variable.type}
          value={condition.value}
          onChange={(value) => onChange({ value })}
        />
      </div>
    </div>
  );
}

function ValueInput({
  type,
  value,
  onChange,
}: {
  type: Variable["type"];
  value: VariableValue;
  onChange: (value: VariableValue) => void;
}) {
  if (type === "number") {
    return (
      <input
        type="number"
        value={typeof value === "number" ? value : Number(value) || 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 py-1 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
      />
    );
  }

  if (type === "boolean") {
    return (
      <select
        value={String(Boolean(value))}
        onChange={(e) => onChange(e.target.value === "true")}
        className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 py-1 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
      >
        <option value="true">True</option>
        <option value="false">False</option>
      </select>
    );
  }

  return (
    <input
      type="text"
      value={typeof value === "string" ? value : String(value ?? "")}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Value"
      className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 py-1 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
    />
  );
}
