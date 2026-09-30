import { useMemo, useState } from "react";
import { Button } from "../common/Button";
import { Modal } from "../common/Modal";
import { useProjectStore } from "../../state/projectStore";
import { useInspectorStore } from "../../state/inspectorStore";
import { useUIStore } from "../../state/uiStore";
import { checkStory } from "../../utils/storyCheck";
import type { StoryIssue, StorySeverity } from "../../utils/storyCheck";

interface StoryCheckDialogProps {
  onClose: () => void;
}

const SEVERITY_RANK: Record<StorySeverity, number> = { problem: 0, warning: 1, note: 2 };

/**
 * Check Story (v0.36.0, regrouped in v0.36.2).
 *
 * The first version listed every finding as its own row, which was honest
 * and unusable: a Choice Block with six unlinked options produced six
 * identical lines — same scene, same sentence, six times — and the panel
 * read as a wall before it read as information.
 *
 * It groups BY SCENE now, because a branching writer works scene by scene
 * and every one of these problems is repaired in a scene. So the grouping
 * that collapses the repetition is also the grouping that matches the trip
 * the writer is about to take: one line saying "Scene 2 · 6 unlinked ·
 * unreachable", opening to the six if they want them.
 *
 * Three rules keep that line a LINE:
 *
 *  - counts become chips, never prose. "6 choices go nowhere and nothing
 *    leads here" wraps; "6 unlinked" + "unreachable" doesn't, and the
 *    colour carries the severity that the words were spending width on.
 *  - the scene name truncates rather than wrapping, because the chips are
 *    the part that has to stay visible.
 *
 * THE THIRD RULE IS GONE (v0.77.0, reported). It was "a scene with a single
 * finding is a single row — no disclosure to open for one thing", which
 * sounds like tidiness and was a dead end: that row had no arrow, no line
 * underneath and no sentence anywhere except its `title` attribute, so on
 * The Blue Hour's report nine scenes out of twelve could only be understood
 * by hovering. Two components for one kind of thing, and the smaller one
 * could not say what was wrong. Every scene opens now.
 *
 * WHAT A ROW SAYS, AND WHAT IT STOPPED SAYING. It was the thing's name plus
 * `what` on the right — "And if it fails?" … "unnamed variable" — which is
 * the app's own vocabulary rather than the writer's, and says nothing about
 * what their READER will see. The row carries `hint` under the name now,
 * and `what` came OFF the row: with the sentence there, the two-word label
 * was the same job done twice, and three texts in a 576px row is what made
 * the first mockup of this read as crowded. `what` still earns the header,
 * where it counts ("3 unnamed variable") rather than repeats.
 *
 * The row number went the same way, replaced by a severity dot. A number
 * said only where a row sat among four; inside a group that mixes a problem
 * with two warnings, the colour is what the width is worth.
 */
export function StoryCheckDialog({ onClose }: StoryCheckDialogProps) {
  const project = useProjectStore((s) => s.project);
  const selectScene = useProjectStore((s) => s.selectScene);
  const selectTarget = useInspectorStore((s) => s.selectTarget);
  const requestReveal = useUIStore((s) => s.requestReveal);
  const [open, setOpen] = useState<Set<string>>(new Set());

  // Computed when the dialog opens rather than continuously: this walks
  // every scene's document, which is exactly the per-keystroke cost the
  // architecture notes warn against.
  const result = useMemo(() => checkStory(project), [project]);

  const groups = useMemo(() => {
    const order = new Map((project?.scenes ?? []).map((scene, index) => [scene.id, index]));
    const byScene = new Map<string, { key: string; name: string; issues: StoryIssue[] }>();

    result.issues.forEach((issue) => {
      // A finding with no scene — the start scene was deleted — belongs to
      // the story rather than to anywhere in it.
      const key = issue.sceneId ?? "__story__";
      const name =
        issue.sceneId && project
          ? project.scenes.find((s) => s.id === issue.sceneId)?.title || "Untitled scene"
          : "This story";
      if (!byScene.has(key)) byScene.set(key, { key, name, issues: [] });
      byScene.get(key)!.issues.push(issue);
    });

    return [...byScene.values()].sort((a, b) => {
      const worst = (g: { issues: StoryIssue[] }) =>
        Math.min(...g.issues.map((i) => SEVERITY_RANK[i.severity]));
      // Worst first, then the order the scenes come in the story — so the
      // list reads as the story does once the urgent things are dealt with.
      return (
        worst(a) - worst(b) ||
        (order.get(a.key) ?? -1) - (order.get(b.key) ?? -1)
      );
    });
  }, [result.issues, project]);

  if (!project) return null;
  const { stats } = result;

  function goTo(issue: StoryIssue): void {
    if (!issue.sceneId) return;
    selectScene(issue.sceneId);

    // Landing on the scene is half of it. The other half was written when
    // only choices carried a blockId, so it said `kind: "choice"` for all
    // of them — and v0.76.0 broke that silently by giving speaker findings
    // a PARAGRAPH's id, which pointed the Inspector at a choice that does
    // not exist. Each finding says what its own id refers to now, and
    // `null` means the Inspector stays on the scene.
    if (issue.blockId && issue.inspect) {
      selectTarget({ kind: issue.inspect, sceneId: issue.sceneId, blockId: issue.blockId });
    }

    // And the part the dialog has promised in its own subtitle since
    // v0.36.0 — "Click a line to go there" — which until now went as far
    // as the scene and left the writer to find the line by reading it. The
    // same note Find leaves, carrying an id instead of positions; the
    // editor picks it up once the scene is loaded (useRevealMatch).
    if (issue.blockId) {
      requestReveal({
        sceneId: issue.sceneId,
        entityId: null,
        from: 0,
        to: 0,
        nodeId: issue.blockId,
      });
    }

    onClose();
  }

  function toggle(key: string): void {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <Modal onClose={onClose} widthClassName="max-w-xl">
      <h2 className="mb-1 font-serif-narrative text-base italic text-[var(--text)]">Check Story</h2>
      <p className="mb-4 text-xs text-[var(--text-3)]">
        What the story looks like from the outside — and anything a player would
        run into. Click a line to go there.
      </p>

      {/* Three columns, not four. There are six stats, and an empty grid
          track paints the container's own background — so at four columns
          the second row held two stats and two solid --border-soft
          rectangles, every time the dialog opened. Six divides by three and
          by two, so both the wide and the narrow layout come out full. */}
      <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--border-soft)] bg-[var(--border-soft)] sm:grid-cols-3">
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

      <div className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1">
        {groups.length === 0 ? (
          <p className="rounded-md border border-dashed border-[var(--border-soft)] px-3 py-6 text-center text-sm text-[var(--text-3)]">
            Nothing to fix. Every choice leads somewhere and every scene can be reached.
          </p>
        ) : (
          groups.map((group) => {
            const isOpen = open.has(group.key);
            const worst = group.issues.reduce<StorySeverity>(
              (acc, issue) =>
                SEVERITY_RANK[issue.severity] < SEVERITY_RANK[acc] ? issue.severity : acc,
              "note",
            );

            return (
              <div
                key={group.key}
                data-scene-group={group.key}
                className="overflow-hidden rounded-md border border-[var(--border-soft)]"
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  title={`${group.issues.length} to look at`}
                  onClick={() => toggle(group.key)}
                  className="flex w-full items-center gap-2 px-2.5 py-2 text-left transition-colors hover:bg-[var(--surface-2)]"
                >
                  <span
                    aria-hidden
                    className="w-2.5 shrink-0 text-[9px] leading-none text-[var(--text-3)]"
                  >
                    {isOpen ? "▾" : "▸"}
                  </span>
                  <Dot severity={worst} />
                  <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-2)]">
                    {group.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {summarise(group.issues).map((chip) => (
                      <Chip key={chip.what} severity={chip.severity} text={chip.text} />
                    ))}
                  </span>
                </button>

                {isOpen && (
                  <div className="flex flex-col gap-0.5 border-t border-[var(--border-soft)] p-1.5">
                    {group.issues.map((issue) => (
                      <button
                        key={issue.id}
                        type="button"
                        data-issue={issue.kind}
                        // The long sentence stays, as the tooltip. It holds
                        // the FIX ("give it a display name, or write this
                        // option a reason of its own") which is more than a
                        // row can carry and worth having a second away.
                        title={issue.detail}
                        onClick={() => goTo(issue)}
                        className="flex gap-2 rounded px-2 py-1.5 text-left text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                      >
                        <span className="mt-[5px] shrink-0">
                          <Dot severity={issue.severity} />
                        </span>
                        <span className="min-w-0 flex-1">
                          {/* A finding about the SCENE, inside that scene's
                              own group, would read "Scene 2" under a heading
                              that already says Scene 2 — so there the hint
                              stands alone as the row's only line. */}
                          {issue.blockId && (
                            <span className="block truncate text-[13px]">{issue.label}</span>
                          )}
                          <span
                            data-hint
                            className={`block truncate text-[11.5px] text-[var(--text-3)] ${
                              issue.blockId ? "mt-px" : "text-[13px]"
                            }`}
                          >
                            {issue.hint}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <Button intent="primary" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}

/**
 * One chip per kind of problem in this scene, counted. Scene-level
 * findings — unreachable, empty — are true once by definition, so they
 * carry no number; "1 unreachable" would be counting something that can't
 * be two.
 */
function summarise(
  issues: StoryIssue[],
): { what: string; text: string; severity: StorySeverity }[] {
  const byWhat = new Map<string, { count: number; severity: StorySeverity }>();
  issues.forEach((issue) => {
    const seen = byWhat.get(issue.what);
    if (seen) seen.count += 1;
    else byWhat.set(issue.what, { count: 1, severity: issue.severity });
  });
  return [...byWhat.entries()]
    .sort((a, b) => SEVERITY_RANK[a[1].severity] - SEVERITY_RANK[b[1].severity])
    .map(([what, { count, severity }]) => ({
      what,
      severity,
      text: count > 1 ? `${count} ${what}` : what,
    }));
}

function Dot({ severity }: { severity: StorySeverity }) {
  return (
    <span
      aria-hidden
      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
        severity === "problem"
          ? "bg-[var(--danger)]"
          : severity === "warning"
            ? "bg-[var(--warning)]"
            : "bg-[var(--text-3)]"
      }`}
    />
  );
}

/** Colour does the work the words were spending width on. */
function Chip({ severity, text }: { severity: StorySeverity; text: string }) {
  // Plain tokens, no opacity modifiers: Tailwind cannot compute an alpha for
  // an arbitrary var() colour, so `border-[var(--danger)]/50` compiled to the
  // full-strength colour anyway — a fade that was never on screen. And the
  // warning tone was Tailwind's own amber, which is legible on a dark ground
  // and nearly invisible on a light one (v0.46.0).
  const tone =
    severity === "problem"
      ? "border-[var(--danger)] text-[var(--danger)]"
      : severity === "warning"
        ? "border-[var(--warning)] text-[var(--warning)]"
        : "border-[var(--border)] text-[var(--text-3)]";
  return (
    <span
      data-chip={text}
      className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] tabular-nums ${tone}`}
    >
      {text}
    </span>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-[var(--bg)] px-3 py-2">
      <div className="scriare-section-label text-[var(--text-3)]">
        {label}
      </div>
      <div className="text-sm text-[var(--text)]">{value}</div>
      {hint && <div className="text-[10px] text-[var(--text-3)]">{hint}</div>}
    </div>
  );
}
