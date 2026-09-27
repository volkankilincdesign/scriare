import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useProjectStore } from "../../state/projectStore";
import { useEditorRefStore } from "../../state/editorStore";
import { useUIStore } from "../../state/uiStore";
import {
  appendDialogueLine,
  applyDialogueLineAttrs,
  dialogueCanClose,
  findDialogueBlockLines,
  removeDialogueLine,
} from "../../utils/dialogueBlocks";
import type { DialogueLine } from "../../utils/dialogueBlocks";
import type { DialogueAfter } from "../../types/nodeTypes";
import { mentionResolver } from "../../utils/mentions";
import { PLAYER_SPEAKER, PLAYER_SPEAKER_LABEL, canSpeak } from "../../types/speaker";
import { buildVariableAction, buildVariableCondition } from "../../types/variables";
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
  const entities = project?.entities ?? [];
  const otherScenes = project?.scenes.filter((s) => s.id !== sceneId) ?? [];

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  /**
   * Follow the caret, exactly as Choice Properties does: the line the
   * writer is actually in is the line whose panel is open. The ref
   * remembers which one was opened FOR them, so moving on closes that one
   * and leaves anything they opened by hand alone.
   */
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
  const exits = lines.filter((l) => l.after === "leave").length;

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="font-medium text-[var(--text)]">Dialogue</h3>
        <span className="text-xs text-[var(--text-3)]">
          {lines.length} {lines.length === 1 ? "line" : "lines"}
          {exits > 0 && ` · ${exits} ${exits === 1 ? "exit" : "exits"}`}
        </span>
      </div>

      {/* The one warning that belongs on the block rather than on a line:
          it is a property of the whole conversation. Check Story says the
          same thing later; this says it while it is still being made. */}
      {!closes && (
        <p className="mb-3 rounded-md border border-[var(--warning)] px-2.5 py-2 text-xs leading-relaxed text-[var(--warning)]">
          Nothing ends this conversation. Every line can be said again and none of them ends it or
          leaves — a reader would be held here, and anything written below never appears.
        </p>
      )}

      <div className="space-y-2">
        {lines.map((line, index) => (
          <LineRow
            key={line.id}
            line={line}
            index={index}
            expanded={expanded.has(line.id)}
            onToggle={() =>
              setExpanded((prev) => {
                const next = new Set(prev);
                if (next.has(line.id)) next.delete(line.id);
                else next.add(line.id);
                return next;
              })
            }
            entities={entities}
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
        ))}
      </div>

      <button
        type="button"
        onClick={() => editor && appendDialogueLine(editor, blockId)}
        className="mt-3 rounded px-1.5 py-0.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-soft-2)]"
      >
        + Add Line
      </button>
    </div>
  );
}

function LineRow({
  line,
  index,
  expanded,
  onToggle,
  entities,
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
  index: number;
  expanded: boolean;
  onToggle: () => void;
  entities: { id: string; kind: string; name: string }[];
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
  const speakers = entities.filter((e) => canSpeak(e as never));

  function addCondition(): void {
    const condition = buildVariableCondition(variables as never);
    if (condition) onPatch({ conditions: [...line.conditions, condition] });
  }
  function addAction(): void {
    const action = buildVariableAction(variables as never);
    if (action) onPatch({ actions: [...line.actions, action] });
  }

  const select =
    "w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]";

  return (
    <div
      className="rounded-md border border-[var(--border-soft)]"
      data-dialogue-line-id={line.id}
      data-expanded={expanded ? "true" : "false"}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 rounded-t-md bg-[var(--surface-2)] px-2 py-1.5 text-left"
      >
        <span className="shrink-0 text-xs text-[var(--text-3)]">{expanded ? "▾" : "▸"}</span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--text)]">
          {line.text || "Untitled line"}
        </span>
        {/* The chips, same call as v0.65.0: the only way to read a
            conversation of eight lines without opening eight. */}
        <span className="shrink-0 text-[10px] text-[var(--text-3)]">
          {after === "leave" ? "↪ exit" : after === "end" ? "✓ ends" : line.repeatable ? "↻" : "·"}
        </span>
      </button>

      {!expanded && (
        <div className="flex flex-wrap items-center gap-x-2 px-2 pb-2 text-xs text-[var(--text-3)]">
          <span>{index + 1}.</span>
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
                <select
                  value={line.speaker ?? ""}
                  onChange={(e) => onPatch({ speaker: e.target.value || null })}
                  className={select}
                >
                  <option value="">— Nobody —</option>
                  <option value={PLAYER_SPEAKER}>{PLAYER_SPEAKER_LABEL} (the player)</option>
                  {speakers.map((entity) => (
                    <option key={entity.id} value={entity.id}>
                      {entity.name || "Unnamed"}
                    </option>
                  ))}
                </select>
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
                      className="w-full resize-y rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs leading-snug text-[var(--text)] outline-none focus:border-[var(--accent)]"
                    />
                  ),
                })}
                {FieldRow({
                  label: "Said by",
                  children: (
                    <select
                      value={line.replySpeaker ?? ""}
                      onChange={(e) => onPatch({ replySpeaker: e.target.value || null })}
                      className={select}
                    >
                      <option value="">— Nobody —</option>
                      <option value={PLAYER_SPEAKER}>{PLAYER_SPEAKER_LABEL} (the player)</option>
                      {speakers.map((entity) => (
                        <option key={entity.id} value={entity.id}>
                          {entity.name || "Unnamed"}
                        </option>
                      ))}
                    </select>
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
                    onChange={(e) => onPatch({ targetSceneId: e.target.value || null })}
                    className={select}
                  >
                    <option value="">— Not linked —</option>
                    {otherScenes.map((sc) => (
                      <option key={sc.id} value={sc.id}>
                        → {sc.title || "Untitled scene"}
                      </option>
                    ))}
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
                      className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 py-1 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
                    >
                      <option value="hide">Hide the line</option>
                      <option value="lock">Show it locked</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={addCondition}
                    className="rounded px-1.5 py-0.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-soft-2)]"
                  >
                    + Add Condition
                  </button>
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
                  <button
                    type="button"
                    onClick={addAction}
                    className="rounded px-1.5 py-0.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-soft-2)]"
                  >
                    + Add Action
                  </button>
                </div>
              )}

          <button
            type="button"
            onClick={onRemove}
            className="rounded px-1.5 py-0.5 text-xs text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"
          >
            Remove line
          </button>
        </div>
      )}
    </div>
  );
}
