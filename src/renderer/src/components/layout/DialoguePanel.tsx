import { Button } from "../common/Button";
import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useProjectStore } from "../../state/projectStore";
import { useEditorRefStore } from "../../state/editorStore";
import { useUIStore } from "../../state/uiStore";
import {
  appendDialogueLine,
  applyDialogueLineAttrs,
  dialogueCanClose,
  findDialogueBlockLines,
  removeDialogueLine,
  reorderDialogueLines,
} from "../../utils/dialogueBlocks";
import type { DialogueLine } from "../../utils/dialogueBlocks";
import type { DialogueAfter } from "../../types/nodeTypes";
import { mentionResolver } from "../../utils/mentions";
import { buildVariableAction, buildVariableCondition } from "../../types/variables";
import { useReorderableList } from "./useReorderableList";
import { AppearanceControl, CREATE_SCENE_VALUE, SpeakerSelect } from "./choiceControls";
import { INPUT_CLASS_PANEL } from "../common/Field";
import type { VariableAction, VariableCondition } from "../../types/variables";

/**
 * The Dialogue, in the Inspector (v0.66.0).
 *
 * Its own file rather than another three hundred lines inside
 * InspectorPanel.tsx, which is already the largest surface in the app and
 * is on the list to be broken up rather than grown.
 *
 * THE GRAMMAR IS v0.65.0's, UNCHANGED: The Line / Shown / Changes, a
 * heading only once it has something under it, and an unset rule stated in
 * one grey line rather than drawn as an empty section. A writer who has
 * learned the choice editor has learned this one; the Dialogue adds
 * exactly one control — After — and a destination that appears only when
 * After is "leave".
 */

const AFTER_LABEL: Record<DialogueAfter, string> = {
  stay: "Stay in the conversation",
  end: "End the conversation",
  leave: "Leave this scene",
};

export function DialogueProperties({
  sceneId,
  blockId,
  lineId,
  renderConditionRow,
  renderActionRow,
  FieldRow,
  QuietRule,
}: {
  sceneId: string;
  blockId: string;
  lineId?: string | null;
  renderConditionRow: (
    condition: VariableCondition,
    onChange: (patch: Partial<VariableCondition>) => void,
    onRemove: () => void,
  ) => ReactNode;
  renderActionRow: (
    action: VariableAction,
    onChange: (patch: Partial<VariableAction>) => void,
    onRemove: () => void,
  ) => ReactNode;
  FieldRow: (props: { label: string; children: ReactNode }) => ReactNode;
  QuietRule: (props: {
    says: string;
    action: string;
    onAction: () => void;
    [key: `data-${string}`]: string;
  }) => ReactNode;
}) {
  const project = useProjectStore((s) => s.project);
  const editor = useEditorRefStore((s) => s.editor);
  const openVariableManager = useUIStore((s) => s.openVariableManager);

  const scene = project?.scenes.find((s) => s.id === sceneId) ?? null;
  const lines = scene
    ? findDialogueBlockLines(scene.content, blockId, mentionResolver(project?.entities ?? []))
    : null;
  const variables = project?.variables ?? [];
  const otherScenes = project?.scenes.filter((s) => s.id !== sceneId) ?? [];

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  /**
   * Follow the caret, exactly as Choice Properties does: the line the
   * writer is actually in is the line whose panel is open. The ref
   * remembers which one was opened FOR them, so moving on closes that one
   * and leaves anything they opened by hand alone.
   */
  /**
   * v0.67.0 — REORDERING, the one thing the Choice had that this did not.
   *
   * The order of a conversation's lines is the order the reader is offered
   * them, so it is editorial: the line you want asked first belongs first.
   * Before this the only way to move one was to retype it somewhere else.
   *
   * The gesture is not a second implementation — it is the choice panel's
   * own, lifted into `useReorderableList` and used by both. That is the
   * sibling rule applied to behaviour rather than to colour: if the two
   * lists drag differently, one of them is wrong.
   *
   * ABOVE THE EARLY RETURN, and that is not a style preference. Put below
   * it, this hook runs on some renders and not others, and React tears the
   * whole tree down the first time the block goes away — which it does
   * every time the writer presses Play. The app went blank, silently, and
   * the spec that caught it was the Dialogue's own, one file later.
   */
  const reorder = useReorderableList({
    ids: (lines ?? []).map((l) => l.id),
    expanded,
    onCommit: (order) => {
      if (editor) reorderDialogueLines(editor, blockId, order);
    },
  });

  const autoOpenedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!lineId) return;
    setExpanded((prev) => {
      if (prev.has(lineId) && autoOpenedRef.current === lineId) return prev;
      const next = new Set(prev);
      if (autoOpenedRef.current && autoOpenedRef.current !== lineId) {
        next.delete(autoOpenedRef.current);
      }
      next.add(lineId);
      return next;
    });
    autoOpenedRef.current = lineId;
  }, [lineId]);

  if (!project || !scene || !lines) {
    return (
      <p className="text-xs leading-relaxed text-[var(--text-3)]">
        This conversation is no longer in the scene.
      </p>
    );
  }

  function patch(id: string, attrs: Record<string, unknown>): void {
    if (editor) applyDialogueLineAttrs(editor, id, attrs);
  }

  const closes = dialogueCanClose(lines);

  return (
    /**
     * v0.67.2 — THE PANEL'S OWN HEADER, which v0.67.1 left alone while
     * fixing the rows under it. Same three facts as Choice Properties: the
     * section label in the label style, the add button beside it, and the
     * list spaced the same way. It read "Dialogue" in mixed case at text
     * weight with a count where the choices panel puts its button, and the
     * add button sat at the foot of the list instead — three differences in
     * a header of two elements.
     *
     * The count went with it. A conversation's size is already on the block
     * in the editor and on its badge in the Story Graph, and the choices
     * panel does not count itself; a number kept here only for this panel
     * is the kind of small difference that adds up to two components.
     */
    <div className="space-y-3" data-panel="dialogue">
      <div className="flex items-center justify-between">
        <h3 className="scriare-section-label text-[var(--text-3)]">
          Dialogue
        </h3>
        <Button
          onClick={() => editor && appendDialogueLine(editor, blockId)}
          intent="accentGhost"
          size="xs"
        >
          + Add Line
        </Button>
      </div>

      {/* The one warning that belongs on the block rather than on a line:
          it is a property of the whole conversation. Check Story says the
          same thing later; this says it while it is still being made. */}
      {!closes && (
        <p className="rounded-md border border-[var(--warning)] px-2.5 py-2 text-xs leading-relaxed text-[var(--warning)]">
          Nothing ends this conversation. Every line can be said again and none of them ends it or
          leaves — a reader would be held here, and anything written below never appears.
        </p>
      )}

      <div className="space-y-2" ref={reorder.containerRef}>
        {lines.map((line) => {
          if (reorder.dragId === line.id) {
            // The held line's slot: an outline the size of the row it
            // left, moved by the hook to whichever position it would land
            // in if released now. Same object, same reasoning, as the
            // choices' landing zone.
            return (
              <div
                key={line.id}
                ref={reorder.registerItem(line.id)}
                style={{ height: reorder.layout?.height ?? 0, position: "relative", zIndex: 0 }}
                className="rounded-lg border-2 border-dashed border-[var(--accent)] bg-[var(--accent-soft-2)]"
                aria-hidden
              />
            );
          }
          return (
            <div
              key={line.id}
              ref={reorder.registerItem(line.id)}
              style={{ position: "relative", zIndex: line.id === reorder.settlingId ? 2 : 1 }}
            >
          <LineRow
            line={line}
            onDragHandleDown={(e) => reorder.onDragHandleDown(e, line.id)}
            expanded={expanded.has(line.id)}
            onToggle={() =>
              setExpanded((prev) => {
                const next = new Set(prev);
                if (next.has(line.id)) next.delete(line.id);
                else next.add(line.id);
                return next;
              })
            }
            variables={variables}
            otherScenes={otherScenes}
            onPatch={(attrs) => patch(line.id, attrs)}
            onRemove={() => editor && removeDialogueLine(editor, line.id)}
            onOpenVariableManager={openVariableManager}
            renderConditionRow={renderConditionRow}
            renderActionRow={renderActionRow}
            FieldRow={FieldRow}
            QuietRule={QuietRule}
          />
            </div>
          );
        })}
      </div>

      {/* The line itself, following the pointer. */}
      {reorder.dragId &&
        reorder.layout &&
        (() => {
          const held = lines.find((l) => l.id === reorder.dragId);
          if (!held) return null;
          const info = reorder.layout;
          return (
            <div
              style={{
                position: "fixed",
                top: reorder.dragTop,
                left: info.left,
                width: info.width,
                zIndex: 50,
                pointerEvents: "none",
                borderRadius: 8,
                boxShadow: "0 0 0 1px var(--border-faint), var(--shadow-floating)",
                marginTop: 0,
              }}
            >
              <LineRow
                line={held}
                onDragHandleDown={() => {}}
                expanded={expanded.has(held.id)}
                onToggle={() => {}}
                variables={variables}
                otherScenes={otherScenes}
                onPatch={() => {}}
                onRemove={() => {}}
                onOpenVariableManager={openVariableManager}
                renderConditionRow={renderConditionRow}
                renderActionRow={renderActionRow}
                FieldRow={FieldRow}
                QuietRule={QuietRule}
              />
            </div>
          );
        })()}

    </div>
  );
}

function LineRow({
  line,
  onDragHandleDown,
  expanded,
  onToggle,
  variables,
  otherScenes,
  onPatch,
  onRemove,
  onOpenVariableManager,
  renderConditionRow,
  renderActionRow,
  FieldRow,
  QuietRule,
}: {
  line: DialogueLine;
  onDragHandleDown: (e: ReactPointerEvent) => void;
  expanded: boolean;
  onToggle: () => void;
  variables: { id: string; name: string }[];
  otherScenes: { id: string; title: string }[];
  onPatch: (attrs: Record<string, unknown>) => void;
  onRemove: () => void;
  onOpenVariableManager: () => void;
  renderConditionRow: (
    condition: VariableCondition,
    onChange: (patch: Partial<VariableCondition>) => void,
    onRemove: () => void,
  ) => ReactNode;
  renderActionRow: (
    action: VariableAction,
    onChange: (patch: Partial<VariableAction>) => void,
    onRemove: () => void,
  ) => ReactNode;
  FieldRow: (props: { label: string; children: ReactNode }) => ReactNode;
  QuietRule: (props: {
    says: string;
    action: string;
    onAction: () => void;
    [key: `data-${string}`]: string;
  }) => ReactNode;
}) {
  const after = line.after;

  function addCondition(): void {
    const condition = buildVariableCondition(variables as never);
    if (condition) onPatch({ conditions: [...line.conditions, condition] });
  }
  function addAction(): void {
    const action = buildVariableAction(variables as never);
    if (action) onPatch({ actions: [...line.actions, action] });
  }

  // v0.84.0 — ONTO THE KIT, AND A COLOUR CORRECTION IN THE SAME MOVE.
  //
  // This constant said `bg-[var(--surface)]`, which is the colour of the
  // Inspector this panel is drawn inside: two selects and a textarea with
  // no fill of their own, reading as text sitting on the panel rather than
  // as fields you can type in. Two other fields further down this same
  // file were already hand-spelled on `--bg` and looked right, which is
  // how it survived — the panel held both answers and the correct one was
  // sitting next to the wrong one.
  const select = `w-full py-1.5 ${INPUT_CLASS_PANEL}`;

  /**
   * v0.67.1 — THE CHOICE ROW, wearing a conversation's facts.
   *
   * Every value below is the one `ChoiceAccordion` uses, not one chosen to
   * look similar: the card's own fill, the 8px radius, the 14px title, the
   * handle's padding, the ✕ in the header. v0.67.0 matched the two blocks
   * inside the scene editor and left this panel alone — which is the half
   * Volkan was looking at, and in all eight themes it read as a different
   * component: a 6px card with no fill of its own and a filled strip
   * across its top.
   *
   * THE FILL IS ALSO THE DRAG BUG. A card with no background is see-through
   * everywhere below its header strip; against the panel that nearly
   * passes, and the moment the row lifts out of flow it is obviously
   * transparent. Nothing about the gesture was wrong — it was this.
   *
   * The second line carries what a choice's carries in the same slot: a
   * choice says where it goes, a line says what happens after it, in the
   * accent when it leads somewhere and quiet when it stays.
   */
  const target = line.targetSceneId
    ? otherScenes.find((sc) => sc.id === line.targetSceneId)
    : undefined;
  const afterPhrase =
    after === "leave"
      ? `↪ ${target ? target.title || "Untitled scene" : "not linked yet"}`
      : after === "end"
        ? "Ends the conversation"
        : line.repeatable
          ? "Stays, can be said again"
          : "Stays in the conversation";

  return (
    <div
      className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg)]"
      data-dialogue-line-id={line.id}
      data-expanded={expanded ? "true" : "false"}
    >
      <div className="flex items-center gap-1">
        <span
          onPointerDown={onDragHandleDown}
          title="Drag to reorder"
          className="shrink-0 cursor-grab select-none px-1.5 py-2 text-[var(--text-3)] hover:text-[var(--text)] active:cursor-grabbing"
          style={{ touchAction: "none" }}
          data-dialogue-drag-handle={line.id}
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
              line.text ? "text-[var(--text)]" : "italic text-[var(--text-3)]"
            }`}
          >
            {line.text || "Untitled line"}
          </span>
        </button>
        {/* The after-mark keeps the place a choice leaves empty: it is the
            one fact a conversation has and a choice does not. */}
        <span
          className="shrink-0 select-none text-[10px] text-[var(--text-3)]"
          title={AFTER_LABEL[after]}
        >
          {after === "leave" ? "↪" : after === "end" ? "✓" : line.repeatable ? "↻" : "·"}
        </span>
        <Button
          type="button"
          onClick={onRemove}
          title="Remove this line"
          intent="quietDanger"
          size="icon"
          className="shrink-0"
        >
          ✕
        </Button>
      </div>

      {!expanded && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-2 pb-2 text-xs text-[var(--text-3)]">
          <span className={after === "leave" ? "text-[var(--accent)]" : ""}>{afterPhrase}</span>
          <span>·</span>
          <span>
            {line.conditions.length} {line.conditions.length === 1 ? "condition" : "conditions"}
          </span>
          <span>·</span>
          <span>
            {line.actions.length} {line.actions.length === 1 ? "action" : "actions"}
          </span>
        </div>
      )}

      {expanded && (
        <div className="space-y-3 border-t border-[var(--border-soft)] px-2 py-2.5">
          <div className="space-y-2">
            <h4 className="scriare-section-label text-[var(--text-3)]">The Line</h4>

            <div className="rounded border border-dashed border-[var(--border-soft)] px-2 py-1.5 text-xs">
              <span className={line.text ? "text-[var(--text-2)]" : "italic text-[var(--text-3)]"}>
                {line.text || "Untitled line"}
              </span>
              <span className="mt-0.5 block text-[10px] text-[var(--text-3)]">
                Edited in the scene — select it there to restyle it.
              </span>
            </div>

            {FieldRow({
              label: "Speaker",
              children: (
                <SpeakerSelect
                  value={line.speaker ?? null}
                  onChange={(speaker) => onPatch({ speaker })}
                />
              ),
            })}

            {/* v0.67.2 — the Style row the choice panel has had since
                v0.34.0. A line already carries a style and the editor and
                Play Mode both paint it; the panel was the one place a
                writer could not reach it. */}
            {FieldRow({
              label: "Style",
              children: (
                <AppearanceControl
                  id={line.id}
                  value={line.style ?? null}
                  onChange={(style) => onPatch({ style })}
                  preview={line.text || "Untitled line"}
                  subject="line"
                />
              ),
            })}

            {/* A leaving line has no reply: it is an exit, and a reply the
                reader never finishes is a reply nobody should write. */}
            {after !== "leave" && (
              <>
                {FieldRow({
                  label: "Reply",
                  children: (
                    <textarea
                      value={line.reply}
                      rows={2}
                      placeholder="…and the reply"
                      onChange={(e) => onPatch({ reply: e.target.value })}
                      data-reply-field={line.id}
                      className={`w-full resize-y py-1.5 leading-snug ${INPUT_CLASS_PANEL}`}
                    />
                  ),
                })}
                {FieldRow({
                  label: "Said by",
                  children: (
                    <SpeakerSelect
                      value={line.replySpeaker ?? null}
                      onChange={(replySpeaker) => onPatch({ replySpeaker })}
                    />
                  ),
                })}
              </>
            )}

            {FieldRow({
              label: "After",
              children: (
                <select
                  value={after}
                  data-after-select={line.id}
                  onChange={(e) => onPatch({ after: e.target.value as DialogueAfter })}
                  className={select}
                >
                  {(["stay", "end", "leave"] as DialogueAfter[]).map((value) => (
                    <option key={value} value={value}>
                      {AFTER_LABEL[value]}
                    </option>
                  ))}
                </select>
              ),
            })}

            {after === "leave" &&
              FieldRow({
                label: "Goes to",
                children: (
                  <select
                    value={line.targetSceneId ?? ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      // The same inline create the choice's destination
                      // offers: a line that leaves usually leaves for a
                      // scene that does not exist yet.
                      if (value === CREATE_SCENE_VALUE) {
                        const newSceneId = useProjectStore.getState().createUnlinkedScene();
                        if (newSceneId) onPatch({ targetSceneId: newSceneId });
                        return;
                      }
                      onPatch({ targetSceneId: value || null });
                    }}
                    className={select}
                  >
                    <option value="">— Not linked —</option>
                    {otherScenes.map((sc) => (
                      <option key={sc.id} value={sc.id}>
                        → {sc.title || "Untitled scene"}
                      </option>
                    ))}
                    <option value={CREATE_SCENE_VALUE}>+ Create New Scene</option>
                  </select>
                ),
              })}

            {after !== "leave" && (
              <label className="flex items-start gap-2 pt-0.5 text-xs text-[var(--text-2)]">
                <input
                  type="checkbox"
                  checked={line.repeatable}
                  data-repeatable-for={line.id}
                  onChange={(e) => onPatch({ repeatable: e.target.checked })}
                  className="mt-0.5 h-3.5 w-3.5 accent-[var(--accent)]"
                />
                <span>
                  Can be said again
                  <span className="mt-0.5 block text-[10px] text-[var(--text-3)]">
                    Otherwise it leaves the list once it has been said.
                  </span>
                </span>
              </label>
            )}
          </div>

          {line.conditions.length === 0
            ? QuietRule({
                "data-rule": "shown",
                says: "Shown always",
                action: variables.length === 0 ? "Add a variable first" : "+ Condition",
                onAction: variables.length === 0 ? onOpenVariableManager : addCondition,
              })
            : (
                <div className="space-y-2 border-t border-[var(--border-soft)] pt-2.5" data-rule="shown">
                  <h4 className="scriare-section-label text-[var(--text-3)]">Shown</h4>
                  {line.conditions.map((condition) =>
                    renderConditionRow(
                      condition,
                      (next) =>
                        onPatch({
                          conditions: line.conditions.map((c) =>
                            c.id === condition.id ? { ...c, ...next } : c,
                          ),
                        }),
                      () =>
                        onPatch({
                          conditions: line.conditions.filter((c) => c.id !== condition.id),
                        }),
                    ),
                  )}
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span className="shrink-0 text-xs text-[var(--text-3)]">If not met:</span>
                    <select
                      value={line.whenUnmet}
                      onChange={(e) => onPatch({ whenUnmet: e.target.value })}
                      className={`min-w-0 flex-1 ${INPUT_CLASS_PANEL}`}
                    >
                      <option value="hide">Hide the line</option>
                      <option value="lock">Show it locked</option>
                    </select>
                  </div>
                  {/* The siblings rule: anything drawn for one of these two
                      blocks is drawn for both unless the difference is
                      behavioural, and a locked line reads to a player
                      exactly as a locked choice does. */}
                  {line.whenUnmet === "lock" && (
                    <input
                      value={line.lockReason ?? ""}
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

          {line.actions.length === 0
            ? QuietRule({
                "data-rule": "changes",
                says: "Changes nothing",
                action: variables.length === 0 ? "Add a variable first" : "+ Action",
                onAction: variables.length === 0 ? onOpenVariableManager : addAction,
              })
            : (
                <div className="space-y-2 border-t border-[var(--border-soft)] pt-2.5" data-rule="changes">
                  <h4 className="scriare-section-label text-[var(--text-3)]">Changes</h4>
                  {line.actions.map((action) =>
                    renderActionRow(
                      action,
                      (next) =>
                        onPatch({
                          actions: line.actions.map((a) =>
                            a.id === action.id ? { ...a, ...next } : a,
                          ),
                        }),
                      () => onPatch({ actions: line.actions.filter((a) => a.id !== action.id) }),
                    ),
                  )}
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
