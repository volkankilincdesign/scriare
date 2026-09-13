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

/* ------------------------------------------------------------------ *
 * Conditions (Sprint 9B / v0.30.0)
 * ------------------------------------------------------------------ */

/**
 * One "is this true?" test against a variable. Deliberately the mirror
 * image of a VariableAction — variable + comparator + literal value — for
 * the reason the module comment predicted: a condition is the same shape
 * as an action, read instead of written. Reusing it means the Inspector's
 * Conditions rows are the Actions rows with a different verb, and nothing
 * about variables had to change to support them.
 *
 * There is no expression field, and deliberately no way to type one. A
 * writer picks a variable, a comparator and a value from controls that
 * already know the variable's type — the same "visual, no syntax" rule the
 * rest of the runtime follows.
 *
 * `negate` covers "only if you HAVEN'T met her" without a second operator
 * list per type: it flips whatever the comparator decided. Rendering it as
 * its own small toggle, rather than doubling every comparator into an "is
 * not" twin, keeps the dropdowns short.
 */
export interface VariableCondition {
  id: string;
  variableId: string;
  comparator: string;
  value: VariableValue;
  negate?: boolean;
}

/**
 * Comparators per variable type. Numbers get the full ordering; booleans
 * and strings only get equality, because "greater than" on a boolean is a
 * question nobody means to ask and an ordering on arbitrary strings is a
 * trap (is "Apple" < "banana"? depends on the locale). A `contains` for
 * strings would be the obvious next entry here and needs nothing else.
 */
export const COMPARATORS_BY_TYPE: Record<VariableType, OperationOption[]> = {
  number: [
    { value: "eq", label: "is" },
    { value: "neq", label: "is not" },
    { value: "gt", label: "is more than" },
    { value: "gte", label: "is at least" },
    { value: "lt", label: "is less than" },
    { value: "lte", label: "is at most" },
  ],
  boolean: [
    { value: "eq", label: "is" },
    { value: "neq", label: "is not" },
  ],
  string: [
    { value: "eq", label: "is" },
    { value: "neq", label: "is not" },
  ],
};

/** A fresh condition for "+ Add Condition" — null when there are no variables to test. */
export function buildVariableCondition(variables: Variable[]): VariableCondition | null {
  const first = variables[0];
  if (!first) return null;
  return {
    id: nanoid(),
    variableId: first.id,
    comparator: COMPARATORS_BY_TYPE[first.type][0].value,
    value: defaultValueForType(first.type),
  };
}

/**
 * Evaluates one condition. Pure, like applyVariableAction, so the Inspector
 * can preview "would this pass right now?" with the same function the
 * runtime uses to decide — there is no second implementation to drift.
 *
 * A condition whose variable has been deleted resolves to FALSE rather than
 * throwing or silently passing. False is the safe direction: a gate whose
 * question can no longer be asked stays shut, so a deleted variable can
 * never accidentally open a path the writer had locked.
 */
export function evaluateCondition(
  condition: VariableCondition,
  variable: Variable | undefined,
  currentValue: VariableValue | undefined,
): boolean {
  if (!variable) return false;

  const current = currentValue ?? variable.defaultValue;
  let result: boolean;

  if (variable.type === "number") {
    const a = typeof current === "number" ? current : Number(current) || 0;
    const b = typeof condition.value === "number" ? condition.value : Number(condition.value) || 0;
    switch (condition.comparator) {
      case "neq": result = a !== b; break;
      case "gt": result = a > b; break;
      case "gte": result = a >= b; break;
      case "lt": result = a < b; break;
      case "lte": result = a <= b; break;
      default: result = a === b;
    }
  } else if (variable.type === "boolean") {
    const a = typeof current === "boolean" ? current : Boolean(current);
    const b = typeof condition.value === "boolean" ? condition.value : Boolean(condition.value);
    result = condition.comparator === "neq" ? a !== b : a === b;
  } else {
    const a = String(current ?? "");
    const b = String(condition.value ?? "");
    result = condition.comparator === "neq" ? a !== b : a === b;
  }

  return condition.negate ? !result : result;
}

/**
 * Whether a whole list passes. Every condition must hold — there is no
 * OR, on purpose: nestable any/all groups turn a writing tool into a query
 * builder, and the overwhelming majority of real branching is a list of
 * things that all have to be true. An empty list passes, so a choice with
 * no conditions behaves exactly as it did before this existed.
 */
export function evaluateConditions(
  conditions: VariableCondition[] | undefined,
  variables: Variable[],
  values: Record<string, VariableValue>,
): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every((condition) =>
    evaluateCondition(
      condition,
      variables.find((v) => v.id === condition.variableId),
      values[condition.variableId],
    ),
  );
}

/** Human-readable summary of one condition — the Inspector's collapsed row, and a locked choice's reason. */
export function describeCondition(
  condition: VariableCondition,
  variables: Variable[],
): string {
  const variable = variables.find((v) => v.id === condition.variableId);
  if (!variable) return "an unknown variable";
  const comparator =
    COMPARATORS_BY_TYPE[variable.type].find((c) => c.value === condition.comparator)?.label ?? "is";
  const value =
    variable.type === "boolean"
      ? condition.value
        ? "true"
        : "false"
      : String(condition.value ?? "");
  const name = variable.name || "Untitled variable";
  return condition.negate ? `not (${name} ${comparator} ${value})` : `${name} ${comparator} ${value}`;
}
