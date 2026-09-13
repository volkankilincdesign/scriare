import { Modal } from "../common/Modal";
import { useProjectStore } from "../../state/projectStore";
import { useToastStore } from "../../state/toastStore";
import { VARIABLE_TYPE_LABELS, changeVariableType } from "../../types/variables";
import type { Variable, VariableType, VariableValue } from "../../types/variables";

interface VariableManagerDialogProps {
  onClose: () => void;
}

const VARIABLE_TYPES: VariableType[] = ["number", "boolean", "string"];

/**
 * Sprint 9A's Variable Manager — "a dedicated Variable Manager... [that]
 * should feel like a native part of Scriare. Keep it clean and
 * writing-focused." Modeled directly on ProjectSettingsDialog.tsx (the only
 * other project-wide dialog in the app): the same Modal shell, the same
 * card layout, so this reads as "another one of Scriare's dialogs" rather
 * than a bolted-on feature screen. Every field commits immediately through
 * projectStore's addVariable/updateVariable/deleteVariable — there's no
 * separate Save step, matching how the rest of the app's inline editing
 * (scene titles, choice text) already behaves.
 */
export function VariableManagerDialog({ onClose }: VariableManagerDialogProps) {
  const project = useProjectStore((s) => s.project);
  const addVariable = useProjectStore((s) => s.addVariable);
  const updateVariable = useProjectStore((s) => s.updateVariable);
  const deleteVariable = useProjectStore((s) => s.deleteVariable);

  if (!project) return null;
  const variables = project.variables;

  function handleDelete(variable: Variable): void {
    deleteVariable(variable.id);
    useToastStore
      .getState()
      .showUndo(`Deleted "${variable.name || "Untitled variable"}"`);
  }

  return (
    <Modal onClose={onClose} widthClassName="max-w-lg">
      <h2 className="mb-1 font-serif-narrative text-base italic text-[var(--text)]">Variables</h2>
      <p className="mb-4 text-xs text-[var(--text-3)]">
        Project-wide story state — reference these from a Choice Block's
        Actions in the Inspector to make picking a choice change something.
      </p>

      <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
        {variables.length === 0 ? (
          <p className="rounded-md border border-dashed border-[var(--border-soft)] px-3 py-4 text-center text-xs text-[var(--text-3)]">
            No variables yet. Add one below — a number for something like
            Gold or Trust, a boolean for a flag like "Met the Wizard", or a
            string for something like a chosen name.
          </p>
        ) : (
          variables.map((variable) => (
            <VariableRow
              key={variable.id}
              variable={variable}
              onChange={(patch) => updateVariable(variable.id, patch)}
              onTypeChange={(type) => updateVariable(variable.id, changeVariableType(variable, type))}
              onDelete={() => handleDelete(variable)}
            />
          ))
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={addVariable}
          className="rounded-md px-2 py-1.5 text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent-soft-2)]"
        >
          + Add Variable
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-text-on)] hover:bg-[var(--accent-hover)]"
        >
          Done
        </button>
      </div>
    </Modal>
  );
}

interface VariableRowProps {
  variable: Variable;
  onChange: (patch: Partial<Variable>) => void;
  onTypeChange: (type: VariableType) => void;
  onDelete: () => void;
}

function VariableRow({ variable, onChange, onTypeChange, onDelete }: VariableRowProps) {
  return (
    <div className="rounded-md border border-[var(--border-soft)] px-3 py-2.5">
      <div className="mb-2 flex items-center gap-1.5">
        <input
          value={variable.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Variable name (e.g. Trust)"
          className="min-w-0 flex-1 rounded bg-transparent px-1 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-3)]"
        />
        <select
          value={variable.type}
          onChange={(e) => onTypeChange(e.target.value as VariableType)}
          className="shrink-0 rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 py-1 text-xs text-[var(--text-2)] outline-none focus:border-[var(--accent)]"
        >
          {VARIABLE_TYPES.map((type) => (
            <option key={type} value={type}>
              {VARIABLE_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onDelete}
          title="Delete this variable"
          className="shrink-0 rounded px-1.5 text-xs text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"
        >
          ✕
        </button>
      </div>

      <div className="mb-2 flex items-center gap-2">
        <label className="shrink-0 text-xs text-[var(--text-3)]">Default</label>
        <DefaultValueInput variable={variable} onChange={(defaultValue) => onChange({ defaultValue })} />
      </div>

      <input
        value={variable.description ?? ""}
        onChange={(e) => onChange({ description: e.target.value })}
        placeholder="Optional description"
        className="w-full rounded bg-transparent px-1 text-xs text-[var(--text-3)] outline-none placeholder:text-[var(--text-3)]"
      />
    </div>
  );
}

function DefaultValueInput({
  variable,
  onChange,
}: {
  variable: Variable;
  onChange: (value: VariableValue) => void;
}) {
  if (variable.type === "number") {
    return (
      <input
        type="number"
        value={variable.defaultValue}
        onChange={(e) => onChange(Number(e.target.value))}
        className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 py-1 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
      />
    );
  }

  if (variable.type === "boolean") {
    return (
      <select
        value={String(variable.defaultValue)}
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
      value={variable.defaultValue}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Default text"
      className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 py-1 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
    />
  );
}
