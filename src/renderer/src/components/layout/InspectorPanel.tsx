import { useProjectStore } from "../../state/projectStore";
import { useInspectorStore } from "../../state/inspectorStore";
import { useUIStore } from "../../state/uiStore";
import { extractChoices, findChoiceOption } from "../../utils/choiceBlocks";
import type { ChoiceOption } from "../../utils/choiceBlocks";
import { OPERATIONS_BY_TYPE, buildVariableAction, defaultValueForType } from "../../types/variables";
import type { Variable, VariableAction, VariableValue } from "../../types/variables";

interface InspectorPanelProps {
  collapsed: boolean;
  onToggle: () => void;
}

/**
 * Sprint 9A — "the Inspector should become the central property editor of
 * Scriare... it should adapt depending on what the user selects." This
 * component is now a thin switch over `useInspectorStore`'s `target.kind`:
 * `{kind: "scene"}` renders Scene Properties (the original content of this
 * file, unchanged in behavior), `{kind: "choice"}` renders Choice
 * Properties. A future target kind (Character, Location, ...) is one more
 * union member in inspectorStore.ts and one more case below — nothing about
 * how Scene/Choice already work has to change.
 */
export function InspectorPanel({ collapsed, onToggle }: InspectorPanelProps) {
  const target = useInspectorStore((s) => s.target);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="flex w-8 shrink-0 flex-col items-center gap-1.5 border-l border-[var(--border-soft)] bg-[var(--surface)] pt-2 text-[var(--text-3)] hover:text-[var(--text)]"
        title="Expand Inspector"
      >
        <span aria-hidden className="text-[10px]">◂</span>
        <span className="[writing-mode:vertical-rl] text-xs font-semibold uppercase tracking-wide">
          Inspector
        </span>
      </button>
    );
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-[var(--border-soft)] bg-[var(--surface)]">
      <div className="flex items-center gap-2 border-b border-[var(--border-soft)] px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          className="rounded px-1.5 text-sm text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          title="Collapse"
        >
          <span aria-hidden>▸</span>
        </button>
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">
          Inspector
        </span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3 text-sm">
        {target.kind === "choice" ? <ChoiceProperties target={target} /> : <SceneProperties />}
      </div>
    </aside>
  );
}

/** The original Scene Details content — unchanged behavior, just renamed to match the Inspector's new adaptive shell. */
function SceneProperties() {
  const project = useProjectStore((s) => s.project);
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
  const setStartScene = useProjectStore((s) => s.setStartScene);

  const scene = project?.scenes.find((s) => s.id === selectedSceneId) ?? null;
  const choices = scene ? extractChoices(scene.content) : [];
  const isStartScene = Boolean(scene) && project?.startSceneId === scene?.id;

  function destinationLabel(targetSceneId: string | null): string {
    if (!targetSceneId) return "Not linked yet";
    const target = project?.scenes.find((sc) => sc.id === targetSceneId);
    return target ? `→ ${target.title || "Untitled scene"}` : "Not linked yet";
  }

  if (!scene) {
    return <p className="text-[var(--text-3)]">Select a scene to see its details.</p>;
  }

  return (
    <div>
      <label className="mb-4 flex items-center gap-2 text-sm text-[var(--text-2)]">
        <input
          type="checkbox"
          checked={isStartScene}
          onChange={(e) => setStartScene(e.target.checked ? scene.id : null)}
          className="h-3.5 w-3.5 accent-[var(--accent)]"
        />
        This is the Start Scene
      </label>

      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">
        Outgoing Choices
      </h3>

      {choices.length === 0 ? (
        <p className="text-[var(--text-3)]">
          This scene has no Choice Blocks yet. Insert one from the editor's
          toolbar (+ Choice) or by typing <code>/choice</code> to let this
          scene branch somewhere else.
        </p>
      ) : (
        <ul className="space-y-3">
          {choices.map((choice) => (
            <li key={choice.id} className="rounded-md border border-[var(--border-soft)] px-2 py-1.5">
              <div
                className="mb-1 truncate text-[var(--text-2)]"
                title={choice.text || "(untitled choice)"}
              >
                {choice.text || "(untitled choice)"}
              </div>
              <span
                className={`text-xs ${
                  choice.targetSceneId ? "text-[var(--accent)]" : "text-[var(--text-3)]"
                }`}
              >
                {destinationLabel(choice.targetSceneId)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs text-[var(--text-3)]">
        Edit choice text and destinations directly in the document, or select
        a Choice Block to edit its Actions here.
      </p>
    </div>
  );
}

interface ChoiceTarget {
  kind: "choice";
  sceneId: string;
  blockId: string;
  optionId: string;
}

/**
 * Choice Block Integration (Sprint 9A). Per the brief: Destination,
 * Conditions (placeholder — Sprint 9B), Actions (implemented, visual only —
 * a Variable dropdown, an Operation dropdown drawn from that variable's own
 * allowed operations, and a plain-typed Value matching the variable's type;
 * never a free-text expression field).
 */
function ChoiceProperties({ target }: { target: ChoiceTarget }) {
  const project = useProjectStore((s) => s.project);
  const updateChoiceOption = useProjectStore((s) => s.updateChoiceOption);
  const openVariableManager = useUIStore((s) => s.openVariableManager);

  const scene = project?.scenes.find((s) => s.id === target.sceneId) ?? null;
  const option = scene ? findChoiceOption(scene.content, target.blockId, target.optionId) : null;
  const otherScenes = project?.scenes.filter((s) => s.id !== target.sceneId) ?? [];
  const variables = project?.variables ?? [];

  if (!scene || !option) {
    return <p className="text-[var(--text-3)]">This choice is no longer in the document.</p>;
  }

  function patch(next: Partial<ChoiceOption>): void {
    updateChoiceOption(target.sceneId, target.blockId, target.optionId, next);
  }

  function addAction(): void {
    const action = buildVariableAction(variables);
    if (!action) return;
    patch({ actions: [...option!.actions, action] });
  }

  function updateAction(actionId: string, next: Partial<VariableAction>): void {
    patch({
      actions: option!.actions.map((a) => (a.id === actionId ? { ...a, ...next } : a)),
    });
  }

  function removeAction(actionId: string): void {
    patch({ actions: option!.actions.filter((a) => a.id !== actionId) });
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">
          Choice
        </h3>
        <p className="truncate text-[var(--text-2)]" title={option.text || "(untitled choice)"}>
          {option.text || "(untitled choice)"}
        </p>
      </div>

      <div>
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">
          Destination
        </h3>
        <select
          value={option.targetSceneId ?? ""}
          onChange={(e) => patch({ targetSceneId: e.target.value || null })}
          className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
        >
          <option value="">— Not linked —</option>
          {otherScenes.map((sc) => (
            <option key={sc.id} value={sc.id}>
              → {sc.title || "Untitled scene"}
            </option>
          ))}
        </select>
      </div>

      <div>
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">
          Conditions
        </h3>
        <p className="rounded-md border border-dashed border-[var(--border-soft)] px-2 py-2 text-xs text-[var(--text-3)]">
          Coming in a future sprint — Choice Blocks will be able to require a
          variable's state before this option is offered.
        </p>
      </div>

      <div>
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">
          Actions
        </h3>

        {variables.length === 0 ? (
          <div className="space-y-2 rounded-md border border-dashed border-[var(--border-soft)] px-2 py-2 text-xs text-[var(--text-3)]">
            <p>Create a project Variable first to give this choice something to act on.</p>
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
              className="rounded px-1.5 py-0.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-soft-2)]"
            >
              + Add Action
            </button>
          </div>
        )}
      </div>
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
 * from the sprint brief's mockup. Changing the Variable re-derives the
 * Operation (to that variable's own first allowed operation) and the Value
 * (to a fresh default for its type), the same way changeVariableType keeps
 * a Variable itself sound when its type changes — an Action's operation and
 * value are only ever meaningful relative to the variable it targets.
 */
function ActionRow({ action, variables, onChange, onRemove }: ActionRowProps) {
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

  function handleValueChange(value: VariableValue): void {
    onChange({ value });
  }

  return (
    <div className="space-y-1 rounded-md border border-[var(--border-soft)] px-2 py-1.5">
      <div className="flex items-center justify-between">
        <select
          value={variable.id}
          onChange={(e) => handleVariableChange(e.target.value)}
          className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 py-1 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
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
          title="Remove this action"
          className="shrink-0 rounded px-1.5 text-xs text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"
        >
          ✕
        </button>
      </div>

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
