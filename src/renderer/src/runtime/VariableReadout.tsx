import { useEffect, useState } from "react";
import { defaultValueForType } from "../types/variables";
import type { Variable, VariableValue } from "../types/variables";

interface VariableReadoutProps {
  variables: Variable[];
  values: Record<string, VariableValue>;
}

const STORAGE_KEY = "scriare:playVariablesOpen";

function loadOpen(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function format(value: VariableValue | undefined, variable: Variable): string {
  /**
   * THE TYPE'S OWN DEFAULT IS THE LAST FALLBACK (v0.81.2), and it is not
   * belt-and-braces: `normalizeProject` passes `variables` through
   * untouched, so a variable with no `defaultValue` — hand-edited, or
   * written by a version before that field existed — reaches here as
   * `undefined`. The number branch then printed the literal word
   * "undefined" into a writer's HUD, the string branch printed
   * `"undefined"` in quotes, and the boolean branch printed "false",
   * which is worse than either because it looks like an answer.
   *
   * Found by looking at a screenshot of Play Mode. Nothing asserted it,
   * because every fixture the suite has is a well-formed project.
   */
  const resolved = value ?? variable.defaultValue ?? defaultValueForType(variable.type);
  if (variable.type === "boolean") return resolved ? "true" : "false";
  if (variable.type === "string") return String(resolved) === "" ? "—" : `"${resolved}"`;
  return String(resolved);
}

/**
 * A live readout of the playthrough's variable values (v0.30.0).
 *
 * This is a writing tool, not a debugger, and the panel is written to know
 * the difference: it is closed by default, it sits out of the reading
 * column, and it never appears at all in a story with no variables. But
 * conditions are the first feature in Scriare whose behaviour is *invisible
 * by design* — a hidden choice is indistinguishable from a choice that was
 * never written — and there is no way to tell whether a gate works without
 * being able to see the number it is testing.
 *
 * Values are read-only. Being able to poke them from here would make
 * playtesting faster and would also mean the thing you tested is not the
 * thing a player gets; reaching a state by actually playing to it is the
 * test. If that becomes too slow to live with, the honest fix is a way to
 * start a playthrough from a given scene, not an editable panel.
 *
 * The open/closed state persists, because a writer testing a gated branch
 * re-enters Play Mode over and over and should not have to reopen it each
 * time.
 */
export function VariableReadout({ variables, values }: VariableReadoutProps) {
  const [open, setOpen] = useState(loadOpen);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
    } catch {
      // Best-effort persistence only.
    }
  }, [open]);

  if (variables.length === 0) return null;

  return (
    <div className="pointer-events-auto absolute bottom-4 right-4 z-20 max-w-[280px]">
      {open && (
        <div className="mb-1.5 max-h-64 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface-translucent)] p-2.5 shadow-[shadow:var(--shadow-raised)] backdrop-blur">
          <table className="w-full border-collapse text-left">
            <tbody>
              {variables.map((variable) => (
                <tr key={variable.id} className="align-baseline">
                  <td className="max-w-[150px] truncate py-0.5 pr-3 text-xs text-[var(--text-2)]">
                    {variable.name || "Untitled"}
                  </td>
                  <td className="py-0.5 text-right font-technical text-xs text-[var(--text)]">
                    {format(values[variable.id], variable)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="ml-auto flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-3)] transition-colors hover:border-[var(--border-faint)] hover:text-[var(--text-2)]"
        title="Live variable values for this playthrough"
      >
        <span aria-hidden>{open ? "▾" : "▸"}</span>
        <span className="font-technical">𝑥</span>
        Variables
      </button>
    </div>
  );
}
