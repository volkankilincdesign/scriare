import { nanoid } from "nanoid";

/**
 * Sprint 9A — runtime foundation.
 *
 * A Variable is the first "runtime entity" Scriare has: a piece of story
 * state that lives on the Project (not a Scene — see Project.variables in
 * project.ts) and that Play Mode can read and change while a story runs.
 * Conditions, Runtime Blocks, Characters, Locations, Inventory,
 * Relationships and Quests (Sprint 9B+) are all variations on the same
 * shape — "a named, typed piece of state the runtime cares about" — so the
 * types and the small pure-function helpers below are written to be the
 * seam those systems attach to, not a Variable-specific one-off:
 *
 *  - A new variable TYPE (e.g. "list", "enum") is one new member of the
 *    `Variable` union plus one new entry in VARIABLE_TYPE_META /
 *    OPERATIONS_BY_TYPE / applyVariableAction's switch — nothing that
 *    touches a variable already has to change.
 *  - A new ACTION OPERATION for an existing type (e.g. "multiply" for
 *    numbers) is one entry in OPERATIONS_BY_TYPE plus one `case` in
 *    applyVariableAction.
 *  - Sprint 9B's Conditions will almost certainly want the exact same
 *    "variable + operator + value" shape a VariableAction already has,
 *    just read instead of written — VariableCondition can reuse
 *    VariableType/VariableValue/OPERATIONS_BY_TYPE wholesale rather than
 *    duplicating them.
 */
export type VariableType = "number" | "boolean" | "string";

/** The value a variable of a given type actually holds, at rest or at runtime. */
export type VariableValue = number | boolean | string;

/**
 * A discriminated union (rather than one `Variable` interface with a loose
 * `value: number | boolean | string`) so the Variable Manager and Choice
 * Action UI can narrow on `variable.type` and get the *matching* input
 * widget/type-checking for free, instead of every call site re-deriving
 * "what kind of value does this variable hold" from a separate field.
 */
export interface VariableBase {
  id: string;
  name: string;
  /** Optional author-facing note — shown in the Variable Manager only, never at runtime. */
  description?: string;
}

export interface NumberVariable extends VariableBase {
  type: "number";
  defaultValue: number;
}

export interface BooleanVariable extends VariableBase {
  type: "boolean";
  defaultValue: boolean;
}

export interface StringVariable extends VariableBase {
  type: "string";
  defaultValue: string;
}

export type Variable = NumberVariable | BooleanVariable | StringVariable;

/**
 * One "do something to a variable" step, attached to a Choice Block option
 * (ChoiceOption.actions — see utils/choiceBlocks.ts). Deliberately NOT a
 * script or expression string — `operation` is always one of a fixed,
 * per-type list (OPERATIONS_BY_TYPE), chosen from a dropdown, and `value`
 * is a plain literal typed into a field that matches the variable's type.
 * That's what keeps this "visual, no syntax" per the sprint brief: there is
 * no field anywhere a writer can type an expression into.
 *
 * `variableId` is a soft reference, not a foreign key with cascading
 * deletes — deleting a Variable does not walk every scene rewriting
 * content (see deleteVariable in state/projectStore.ts for why). An action
 * whose variable was deleted is left in place but ignored at runtime
 * (applyVariableAction is only ever called with a resolved Variable) and
 * flagged in the Inspector, the same way a Choice option whose
 * targetSceneId points at a deleted scene already renders as "Not linked
 * yet" instead of the app trying to keep every reference perfectly in sync.
 */
export interface VariableAction {
  id: string;
  variableId: string;
  operation: string;
  value: VariableValue;
}

interface OperationOption {
  value: string;
  label: string;
}

/**
 * The allowed operations per variable type — this is what keeps "Operation"
 * a dropdown instead of free text. Adding an operation to an existing type
 * (e.g. "multiply" for numbers) means adding one entry here and one `case`
 * in applyVariableAction; nothing else changes.
 */
export const OPERATIONS_BY_TYPE: Record<VariableType, OperationOption[]> = {
  number: [
    { value: "set", label: "Set to" },
    { value: "add", label: "+ Add" },
    { value: "subtract", label: "− Subtract" },
  ],
  boolean: [
    { value: "set", label: "Set to" },
    { value: "toggle", label: "Toggle" },
  ],
  string: [{ value: "set", label: "Set to" }],
};

export const VARIABLE_TYPE_LABELS: Record<VariableType, string> = {
  number: "Number",
  boolean: "Boolean",
  string: "String",
};

export function defaultValueForType(type: VariableType): VariableValue {
  if (type === "number") return 0;
  if (type === "boolean") return false;
  return "";
}

/** A fresh, unsaved Variable — the Variable Manager's "+ Add Variable" starts from this. */
export function buildVariable(): Variable {
  return { id: nanoid(), name: "", type: "number", defaultValue: 0 };
}

/**
 * Changing a variable's type mid-edit (Number → Boolean, say) can't keep the
 * old defaultValue — a leftover number would silently become an invalid
 * BooleanVariable. Re-deriving a fresh default for the new type keeps the
 * union sound at every step instead of only at save time.
 */
export function changeVariableType(variable: Variable, type: VariableType): Variable {
  return { ...variable, type, defaultValue: defaultValueForType(type) } as Variable;
}

/**
 * A fresh action for a Choice option's "+ Add Action" — defaults to the
 * project's first variable (if any) and that type's first operation. Null
 * when the project has no variables yet, so the caller can prompt the
 * writer to create one first instead of inserting an action with nothing
 * to act on.
 */
export function buildVariableAction(variables: Variable[]): VariableAction | null {
  const first = variables[0];
  if (!first) return null;
  const operation = OPERATIONS_BY_TYPE[first.type][0].value;
  return { id: nanoid(), variableId: first.id, operation, value: defaultValueForType(first.type) };
}

/**
 * Pure — takes a current value and returns the next one. Used identically
 * by Play Mode (state/projectStore.ts's applyVariableActions) and will be
 * reusable, unchanged, by anything that needs to preview "what would this
 * action do" (e.g. a future Conditions-aware graph annotation) without
 * re-deriving the switch statement.
 */
export function applyVariableAction(
  currentValue: VariableValue,
  variable: Variable,
  action: VariableAction,
): VariableValue {
  if (variable.type === "number") {
    const current = typeof currentValue === "number" ? currentValue : Number(currentValue) || 0;
    const operand = typeof action.value === "number" ? action.value : Number(action.value) || 0;
    if (action.operation === "add") return current + operand;
    if (action.operation === "subtract") return current - operand;
    return operand; // "set" and any unrecognized operation both fall back to a plain set
  }

  if (variable.type === "boolean") {
    const current = typeof currentValue === "boolean" ? currentValue : Boolean(currentValue);
    if (action.operation === "toggle") return !current;
    return typeof action.value === "boolean" ? action.value : Boolean(action.value);
  }

  // string
  return typeof action.value === "string" ? action.value : String(action.value ?? "");
}
