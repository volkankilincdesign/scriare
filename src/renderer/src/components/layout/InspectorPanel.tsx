import { Button } from "../common/Button";
import { useEffect, useRef, useState } from "react";
import { INPUT_CLASS_PANEL } from "../common/Field";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useProjectStore } from "../../state/projectStore";
import { DialogueProperties } from "./DialoguePanel";
import { useInspectorStore } from "../../state/inspectorStore";
import type { InspectorTarget } from "../../state/inspectorStore";
import { useUIStore } from "../../state/uiStore";
import { useEditorRefStore } from "../../state/editorStore";
import { extractChoices, findChoiceBlockOptions } from "../../utils/choiceBlocks";
import { mentionResolver } from "../../utils/mentions";
import { countWords } from "../../utils/storyCheck";
import type { ChoiceOption } from "../../utils/choiceBlocks";
import { DockGlyph, DockToggle } from "../common/DockToggle";
import { useReorderableList } from "./useReorderableList";
import { AppearanceControl, CREATE_SCENE_VALUE, SpeakerSelect } from "./choiceControls";
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
        ) : target.kind === "dialogue" ? (
          // v0.66.0 — the condition and action rows are HANDED to the
          // Dialogue panel rather than duplicated inside it. They are the
          // two most fiddly controls in the app (a variable picker that
          // can create a variable, a comparator list that changes with the
          // variable's type), and a second copy of either would be a
          // second place to fix the next bug in them.
          <DialogueProperties
            key={target.blockId}
            sceneId={target.sceneId}
            blockId={target.blockId}
            lineId={target.lineId}
            FieldRow={FieldRow}
            QuietRule={QuietRule}
            renderConditionRow={(condition, onChange, onRemove) => (
              <ConditionRow
                key={condition.id}
                condition={condition}
                variables={useProjectStore.getState().project?.variables ?? []}
                onChange={onChange}
                onRemove={onRemove}
              />
            )}
            renderActionRow={(action, onChange, onRemove) => (
              <ActionRow
                key={action.id}
                action={action}
                variables={useProjectStore.getState().project?.variables ?? []}
                onChange={onChange}
                onRemove={onRemove}
              />
            )}
          />
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
 * Properties for a Conditional (v0.30.0, renamed in v0.78.0) — the conditions that
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
        {/* v0.78.0 — "Conditional", the one word the block's own header
            and the toolbar button also use, and the two-sentence
            explanation deleted. It was there because nothing else in the
            app said what this block did. The block now says it in its own
            footer, in one line, naming the actual conditions — where the
            writer is already looking. Two rows of panel repeating it in
            the abstract were two rows too many. */}
        <div className="scriare-section-label text-[var(--text-3)]">Conditional</div>
      </div>

      {variables.length === 0 ? (
        <div className="space-y-2 rounded-md border border-dashed border-[var(--border-soft)] px-2 py-2 text-xs text-[var(--text-3)]">
          <p>Create a project Variable first to give this passage something to test.</p>
          <Button
            onClick={openVariableManager}
            intent="accentGhost"
            size="xs"
          >
            Open Variable Manager
          </Button>
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
          <Button
            onClick={() => {
              const condition = buildVariableCondition(variables);
              if (condition) commit([...conditions, condition]);
            }}
            intent="accentGhost"
            size="xs"
          >
            + Add Condition
          </Button>
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

  // v0.67.0 — the gesture itself now lives in useReorderableList, shared
  // with the Dialogue's panel. What stays here is the only part that was
  // ever about choices: what a new order MEANS.
  const displayedOrder = (options ?? []).map((o) => o.id);
  const byId = new Map((options ?? []).map((o) => [o.id, o]));

  const reorder = useReorderableList({
    ids: displayedOrder,
    expanded,
    onCommit: (order) => {
      if (!editor) return;
      const finalOptions = order
        .map((id) => optionsRef.current.find((o) => o.id === id))
        .filter((o): o is ChoiceOption => Boolean(o));
      if (finalOptions.length !== optionsRef.current.length || finalOptions.length === 0) return;
      reorderChoiceOptions(editor, target.blockId, finalOptions.map((o) => o.id));
    },
  });
  const { dragId, dragTop, settlingId } = reorder;


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
    if ("lockReason" in patch) attrs.lockReason = patch.lockReason ?? "";
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
    <div className="space-y-3" data-panel="choices">
      <div className="flex items-center justify-between">
        <h3 className="scriare-section-label text-[var(--text-3)]">
          Choices
        </h3>
        <Button
          onClick={addChoice}
          intent="accentGhost"
          size="xs"
        >
          + Add Choice
        </Button>
      </div>

      <div className="space-y-2" ref={reorder.containerRef}>
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
                ref={reorder.registerItem(id)}
                style={{
                  height: reorder.layout?.height ?? 0,
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
              ref={reorder.registerItem(id)}
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
                onDragHandleDown={(e) => reorder.onDragHandleDown(e, option.id)}
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
        reorder.layout &&
        (() => {
          const draggedOption = byId.get(dragId);
          if (!draggedOption) return null;
          const info = reorder.layout;
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
                // The card's own radius. It was 6 against an 8px card, so
                // the ring and shadow traced a silhouette the card does not
                // have (v0.67.2).
                borderRadius: 8,
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
export function FieldRow({ label, children }: { label: string; children: ReactNode }) {
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
export function QuietRule({
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
      <Button
        onClick={onAction}
        intent="accentGhost"
        size="xs"
        className="shrink-0 whitespace-nowrap"
      >
        {action}
      </Button>
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
          // v0.84.0 — a handle, and it is not decoration. This accordion
          // is what hides the Inspector's whole field stack: with every
          // choice folded the panel renders no input at all, so a check
          // that looks at "the Inspector's fields" with nothing expanded
          // measures an empty panel and passes. That is exactly what the
          // first version of the kit check did. The Choice block got the
          // same treatment in v0.82.0, for the same reason.
          data-choice-accordion={option.id}
          aria-expanded={expanded}
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
              <SpeakerSelect value={option.speaker ?? null} onChange={(speaker) => onPatch({ speaker })} />
            </FieldRow>

            <FieldRow label="Style">
              <AppearanceControl
                id={option.id}
                value={option.style ?? null}
                onChange={(style) => onPatch({ style })}
                preview={option.text || "Untitled choice"}
                subject="choice"
              />
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
                className={`w-full ${INPUT_CLASS_PANEL}`}
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
                  className={`min-w-0 flex-1 ${INPUT_CLASS_PANEL}`}
                >
                  <option value="hide">Hide the choice</option>
                  <option value="lock">Show it locked</option>
                </select>
              </div>
              {/* Only when it is SHOWN. A hidden option tells the reader
                  nothing, so a reason on one is a string nobody can reach
                  and a row in the spreadsheet nobody can translate for. */}
              {option.whenUnmet === "lock" && (
                <input
                  value={option.lockReason ?? ""}
                  onChange={(e) => onPatch({ lockReason: e.target.value })}
                  placeholder="Why, in your words — optional"
                  data-lock-reason
                  className={`w-full ${INPUT_CLASS_PANEL}`}
                />
              )}
              <Button
                onClick={addCondition}
                disabled={variables.length === 0}
                intent="accentGhost"
                size="xs"
              >
                + Add Condition
              </Button>
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
              <Button
                onClick={addAction}
                disabled={variables.length === 0}
                intent="accentGhost"
                size="xs"
              >
                + Add Action
              </Button>
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
          className={`min-w-0 flex-1 ${INPUT_CLASS_PANEL}`}
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
            className={`w-full ${INPUT_CLASS_PANEL}`}
          />
          <select
            value={newVariableType}
            onChange={(e) => setNewVariableType(e.target.value as VariableType)}
            className={`w-full ${INPUT_CLASS_PANEL}`}
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
            <Button
              onClick={commitNewVariable}
              disabled={!newVariableName.trim()}
              intent="accentGhost"
              size="xs"
            >
              Create
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <select
            value={action.operation}
            onChange={(e) => onChange({ operation: e.target.value })}
            className={`shrink-0 ${INPUT_CLASS_PANEL}`}
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
          className={`shrink-0 ${INPUT_CLASS_PANEL}`}
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
        className={`min-w-0 flex-1 ${INPUT_CLASS_PANEL}`}
      />
    );
  }

  if (type === "boolean") {
    return (
      <select
        value={String(Boolean(value))}
        onChange={(e) => onChange(e.target.value === "true")}
        className={`min-w-0 flex-1 ${INPUT_CLASS_PANEL}`}
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
      className={`min-w-0 flex-1 ${INPUT_CLASS_PANEL}`}
    />
  );
}
