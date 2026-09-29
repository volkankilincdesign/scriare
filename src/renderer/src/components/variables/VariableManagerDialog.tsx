import { useState } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { DialogHeader } from "../common/DialogHeader";
import { Field, INPUT_CLASS_SM } from "../common/Field";
import { useProjectStore } from "../../state/projectStore";
import { useToastStore } from "../../state/toastStore";
import { VARIABLE_TYPE_LABELS, changeVariableType } from "../../types/variables";
import type { Variable, VariableType, VariableValue } from "../../types/variables";

interface VariableManagerDialogProps {
  onClose: () => void;
}

const VARIABLE_TYPES: VariableType[] = ["number", "boolean", "string"];

/**
 * The Variable Manager, rebuilt in v0.56.0.
 *
 * Sprint 9A wrote this modelled on Project Settings, which was right at
 * the time and stopped being right when Choice Styles arrived in v0.34.0
 * and did the same job — a project-wide list of named things you edit one
 * at a time — in a different shape. Two managers one menu apart, from two
 * eras. This one had no section labels (the only manager without them),
 * nine distinct control spellings in 181 lines, a delete drawn as a bare
 * ✕ at `text-xs`, and the word "Default" repeated on every row. Three of
 * six variables fitted the dialog.
 *
 * It has its sibling's shape now. Chosen from three mockups drawn against
 * a real story's variables: a table and a grouped-by-type version were
 * the others. The table fits more rows and the grouped one teaches the
 * type system better; this one won on the argument that two managers
 * doing the same job should not be two designs, because a writer who
 * learns one has then learned both.
 *
 * THE COLLAPSED ROW ANSWERS THE QUESTION YOU ACTUALLY HAVE — what is it
 * called, what kind is it, what does it start as. Opening one is for
 * editing, not for reading, which is why the type is spelled out rather
 * than drawn as a glyph: a chip reading "01" is a thing a writer has to
 * be taught, and this dialog is where most people meet the type system
 * for the first time.
 *
 * Every field still commits immediately through the store — no Save step,
 * matching scene titles and choice text everywhere else in the app.
 */
export function VariableManagerDialog({ onClose }: VariableManagerDialogProps) {
  const project = useProjectStore((s) => s.project);
  const addVariable = useProjectStore((s) => s.addVariable);
  const updateVariable = useProjectStore((s) => s.updateVariable);
  const deleteVariable = useProjectStore((s) => s.deleteVariable);
  const [openId, setOpenId] = useState<string | null>(null);

  if (!project) return null;
  const variables = project.variables;

  function handleAdd(): void {
    // Opened on arrival: a row that appears collapsed and blank is a row
    // you have to work out how to edit. Choice Styles does the same.
    const id = addVariable();
    if (id) setOpenId(id);
  }

  function handleDelete(variable: Variable): void {
    deleteVariable(variable.id);
    useToastStore.getState().showUndo(`Deleted "${variable.name || "Untitled variable"}"`);
  }

  return (
    <Modal onClose={onClose} label="Variables" widthClassName="max-w-lg">
      <DialogHeader title="Variables">
        Story state you can read and change from a choice — a number for
        something like Gold or Trust, a boolean for a flag like “Met the
        Wizard”, a string for something like a chosen name.
      </DialogHeader>

      <div className="max-h-[60vh] overflow-y-auto pr-1">
        {variables.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--border-soft)] px-3 py-5 text-center text-xs leading-relaxed text-[var(--text-3)]">
            No variables yet. Add one below, then reference it from a Choice
            Block’s Actions in the Inspector to make picking a choice change
            something.
          </p>
        ) : (
          variables.map((variable) => (
            <VariableRow
              key={variable.id}
              variable={variable}
              open={openId === variable.id}
              onToggle={() => setOpenId(openId === variable.id ? null : variable.id)}
              onChange={(patch) => updateVariable(variable.id, patch)}
              onTypeChange={(type) => updateVariable(variable.id, changeVariableType(variable, type))}
              onDelete={() => handleDelete(variable)}
            />
          ))
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <Button intent="accentGhost" onClick={handleAdd}>
          + Add Variable
        </Button>
        <Button intent="primary" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}

/**
 * What a variable starts as, in one short string.
 *
 * Empty text shows as a pair of quotation marks rather than as nothing: a
 * blank in that column reads as a row that failed to load, and an empty
 * string is a real, deliberate starting value.
 */
export function startsAs(variable: Variable): string {
  if (variable.type === "boolean") return variable.defaultValue ? "True" : "False";
  if (variable.type === "string") {
    const text = String(variable.defaultValue ?? "");
    return text.length > 0 ? `“${text}”` : "“”";
  }
  return String(variable.defaultValue ?? 0);
}

function VariableRow({
  variable,
  open,
  onToggle,
  onChange,
  onTypeChange,
  onDelete,
}: {
  variable: Variable;
  open: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<Variable>) => void;
  onTypeChange: (type: VariableType) => void;
  onDelete: () => void;
}) {
  const name = variable.name || "Untitled variable";
  return (
    <div
      data-variable-id={variable.id}
      className="mb-2 rounded-lg border border-[var(--border-soft)] bg-[var(--bg)]"
    >
      <div className="flex items-center gap-2.5 p-2">
        <button
          type="button"
          onClick={onToggle}
          title={open ? "Collapse" : "Edit this variable"}
          className="shrink-0 rounded px-1 text-xs text-[var(--text-3)] hover:text-[var(--text)]"
        >
          {open ? "▾" : "▸"}
        </button>

        {/*
          THE TYPE, IN WORDS. It was a dropdown you had to open to read, so
          the one fact that decides what a variable can do was the one fact
          the list did not show. Fixed width, so the names stay a column
          and the variable names line up beside them.
        */}
        <span className="inline-flex w-[66px] shrink-0 items-center justify-center rounded border border-[var(--border)] bg-[var(--surface-2)] py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.04em] text-[var(--text-3)]">
          {VARIABLE_TYPE_LABELS[variable.type]}
        </span>

        <span
          className={`min-w-0 flex-1 truncate text-sm ${
            variable.name ? "text-[var(--text)]" : "text-[var(--text-3)]"
          }`}
        >
          {name}
        </span>

        <span className="shrink-0 text-xs text-[var(--text-3)]">
          starts <span className="text-[var(--text-2)]">{startsAs(variable)}</span>
        </span>

        {/*
          A real target, not a 12px glyph with no padding. This deletes a
          writer's work and it was the smallest destructive control in the
          app.
        */}
        <button
          type="button"
          onClick={onDelete}
          title={`Delete "${name}"`}
          className="shrink-0 rounded px-1.5 py-1 text-xs text-[var(--text-3)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"
        >
          ✕
        </button>
      </div>

      {open && (
        <div className="grid grid-cols-2 gap-2.5 border-t border-[var(--border-soft)] p-3">
          <Field label="Name">
            <input
              value={variable.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="e.g. Trust"
              className={INPUT_CLASS_SM}
            />
          </Field>
          <Field label="Type">
            <select
              value={variable.type}
              onChange={(e) => onTypeChange(e.target.value as VariableType)}
              className={INPUT_CLASS_SM}
            >
              {VARIABLE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {VARIABLE_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Starts at">
            <DefaultValueInput
              variable={variable}
              onChange={(defaultValue) => onChange({ defaultValue })}
            />
          </Field>
          {/* The one field here a READER can end up looking at. Placed
              above "What it is for" because that one is a note to yourself
              and this one is prose in the story. */}
          <Field label="Called, to the reader">
            <input
              value={variable.displayName ?? ""}
              onChange={(e) => onChange({ displayName: e.target.value })}
              placeholder={variable.name ? `Optional — otherwise "${variable.name}"` : "Optional"}
              data-variable-display-name
              className={INPUT_CLASS_SM}
            />
          </Field>
          <Field label="What it is for">
            <input
              value={variable.description ?? ""}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Optional"
              className={INPUT_CLASS_SM}
            />
          </Field>
        </div>
      )}
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
        value={variable.defaultValue as number}
        onChange={(e) => onChange(Number(e.target.value))}
        className={INPUT_CLASS_SM}
      />
    );
  }

  if (variable.type === "boolean") {
    return (
      <select
        value={String(variable.defaultValue)}
        onChange={(e) => onChange(e.target.value === "true")}
        className={INPUT_CLASS_SM}
      >
        <option value="true">True</option>
        <option value="false">False</option>
      </select>
    );
  }

  return (
    <input
      type="text"
      value={variable.defaultValue as string}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Empty"
      className={INPUT_CLASS_SM}
    />
  );
}
