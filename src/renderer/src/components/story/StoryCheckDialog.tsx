import { useMemo } from "react";
import { Modal } from "../common/Modal";
import { useProjectStore } from "../../state/projectStore";
import { useInspectorStore } from "../../state/inspectorStore";
import { checkStory } from "../../utils/storyCheck";
import type { StoryIssue, StorySeverity } from "../../utils/storyCheck";

interface StoryCheckDialogProps {
  onClose: () => void;
}

const SEVERITY_LABEL: Record<StorySeverity, string> = {
  problem: "Problems",
  warning: "Worth a look",
  note: "Notes",
};

/**
 * Check Story (v0.36.0).
 *
 * Everything here is already knowable from the project; the point is that
 * none of it is VISIBLE while writing. A scene nobody can reach looks
 * exactly like a scene not linked up yet, and a choice pointing at a
 * deleted scene looks exactly like a choice.
 *
 * Two decisions shape the whole panel:
 *
 *  - It is a REPORT YOU CAN WALK. Every row is a button that opens the
 *    scene and, for a choice, points the Inspector at the block it's in.
 *    A list of problems you then have to go and find yourself is a list of
 *    reasons to close the window.
 *  - It is not a grader. Dead ends are counted as ENDINGS, in the numbers
 *    rather than the problems, because a branching story is supposed to
 *    have them. Only things that are definitely broken are called
 *    problems; "written but not wired up yet" is a normal Tuesday and gets
 *    the softer heading.
 */
export function StoryCheckDialog({ onClose }: StoryCheckDialogProps) {
  const project = useProjectStore((s) => s.project);
  const selectScene = useProjectStore((s) => s.selectScene);
  const selectTarget = useInspectorStore((s) => s.selectTarget);

  // Computed when the dialog opens rather than continuously: this walks
  // every scene's document, which is exactly the per-keystroke cost the
  // architecture notes warn against.
  const result = useMemo(() => checkStory(project), [project]);

  if (!project) return null;
  const { issues, stats } = result;
  const grouped: Record<StorySeverity, StoryIssue[]> = {
    problem: issues.filter((i) => i.severity === "problem"),
    warning: issues.filter((i) => i.severity === "warning"),
    note: issues.filter((i) => i.severity === "note"),
  };

  function goTo(issue: StoryIssue): void {
    if (!issue.sceneId) return;
    selectScene(issue.sceneId);
    // Landing on the scene is half of it; landing on the choice is the
    // other half, and the Inspector is where a choice is repaired.
    if (issue.blockId) {
      selectTarget({ kind: "choice", sceneId: issue.sceneId, blockId: issue.blockId });
    }
    onClose();
  }

  return (
    <Modal onClose={onClose} widthClassName="max-w-xl">
      <h2 className="mb-1 font-serif-narrative text-base italic text-[var(--text)]">Check Story</h2>
      <p className="mb-4 text-xs text-[var(--text-3)]">
        What the story looks like from the outside — and anything a player would
        run into. Click a line to go there.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--border-soft)] bg-[var(--border-soft)] sm:grid-cols-4">
        <Stat label="Scenes" value={`${stats.reachable}/${stats.scenes}`} hint="reachable" />
        <Stat label="Words" value={stats.words.toLocaleString()} />
        <Stat label="Choices" value={String(stats.choices)} />
        <Stat label="Endings" value={String(stats.endings)} />
        <Stat
          label="Shortest route"
          value={stats.shortestRoute ? `${stats.shortestRoute} scenes` : "—"}
          hint="to an ending"
        />
        <Stat
          label="Longest route"
          value={stats.longestRoute ? `${stats.longestRoute} scenes` : stats.loops ? "loops" : "—"}
          hint={stats.loops ? "some route returns" : undefined}
        />
      </div>

      <div className="max-h-[50vh] space-y-4 overflow-y-auto pr-1">
        {issues.length === 0 ? (
          <p className="rounded-md border border-dashed border-[var(--border-soft)] px-3 py-6 text-center text-sm text-[var(--text-3)]">
            Nothing to fix. Every choice leads somewhere and every scene can be reached.
          </p>
        ) : (
          (["problem", "warning", "note"] as StorySeverity[]).map((severity) =>
            grouped[severity].length === 0 ? null : (
              <section key={severity} data-severity={severity}>
                <h3 className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 rounded-full ${
                      severity === "problem"
                        ? "bg-[var(--danger)]"
                        : severity === "warning"
                          ? "bg-amber-400"
                          : "bg-[var(--text-3)]"
                    }`}
                  />
                  {SEVERITY_LABEL[severity]}
                  <span className="font-normal normal-case">({grouped[severity].length})</span>
                </h3>
                <ul className="flex flex-col gap-1">
                  {grouped[severity].map((issue) => (
                    <li key={issue.id}>
                      <button
                        type="button"
                        data-issue={issue.kind}
                        onClick={() => goTo(issue)}
                        disabled={!issue.sceneId}
                        className="w-full rounded-md border border-[var(--border-soft)] px-2.5 py-2 text-left transition-colors hover:border-[var(--border)] hover:bg-[var(--surface-2)] disabled:cursor-default disabled:hover:bg-transparent"
                      >
                        <span className="block truncate text-sm text-[var(--text-2)]">
                          {issue.title}
                        </span>
                        <span className="block text-xs text-[var(--text-3)]">{issue.detail}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ),
          )
        )}
      </div>

      <div className="mt-4 flex justify-end">
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

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-[var(--bg)] px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
        {label}
      </div>
      <div className="text-sm text-[var(--text)]">{value}</div>
      {hint && <div className="text-[10px] text-[var(--text-3)]">{hint}</div>}
    </div>
  );
}
