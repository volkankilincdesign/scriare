import { useMemo } from "react";
import { useProjectStore } from "../../state/projectStore";
import { countWords } from "../../utils/storyCheck";

interface StatusBarProps {
  /** Whether the Story Graph is currently folded away. */
  flowCollapsed: boolean;
  onToggleFlow: () => void;
}

/**
 * The strip along the foot of the window (v0.41.0).
 *
 * Reported as a symmetry problem, and it was one: the top of the three
 * columns is a single unbroken line — Content, the toolbar and the Inspector
 * all start at the same y — while the bottom was three different edges at
 * three different heights, because each column simply ran out of content
 * wherever it happened to. A frame closed on three sides reads as unfinished
 * no matter how good the surfaces inside it are.
 *
 * So the window now ends the way it begins: one bar, full width, the same
 * line across all three columns. It earns the space it takes by carrying the
 * three things a writer actually glances down for — how big the story is,
 * how long the scene they are in is, and whether the map is open.
 */
export function StatusBar({ flowCollapsed, onToggleFlow }: StatusBarProps) {
  const project = useProjectStore((s) => s.project);
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
  const selectedEntityId = useProjectStore((s) => s.selectedEntityId);
  const scene = project?.scenes.find((s) => s.id === selectedSceneId) ?? null;
  const entity = project?.entities?.find((e) => e.id === selectedEntityId) ?? null;

  // Only the open scene is counted, never the whole project. A project-wide
  // word count would mean walking every document on every keystroke — the
  // v0.10.3 pitfall, and the reason Check Story computes its totals on
  // demand rather than continuously.
  const words = useMemo(() => countWords(scene?.content), [scene?.content]);

  if (!project) return null;

  const characters = project.entities?.filter((e) => e.kind === "character").length ?? 0;
  const locations = project.entities?.filter((e) => e.kind === "location").length ?? 0;
  // Counted only when there are any (v0.60.0). Scenes, characters and
  // locations are what a story is made of and read as zero honestly; a
  // writer who keeps no notes should not be told twice a day that they
  // have none. Same rule as "goes nowhere" in the scene panel.
  const notes = project.entities?.filter((e) => e.kind === "note").length ?? 0;

  return (
    <footer className="scriare-statusbar flex h-7 shrink-0 items-center gap-4 border-t border-[var(--border-soft)] bg-[var(--surface)] px-5 text-[11px] text-[var(--text-3)]">
      <span className="tabular-nums">
        {project.scenes.length} {project.scenes.length === 1 ? "scene" : "scenes"}
      </span>
      <Dot />
      <span className="tabular-nums">
        {characters} {characters === 1 ? "character" : "characters"}
      </span>
      <Dot />
      <span className="tabular-nums">
        {locations} {locations === 1 ? "location" : "locations"}
      </span>
      {notes > 0 && (
        <>
          <Dot />
          <span className="tabular-nums">
            {notes} {notes === 1 ? "note" : "notes"}
          </span>
        </>
      )}

      <span className="flex-1" />

      {entity ? (
        <span className="truncate text-[var(--text-2)]">{entity.name}</span>
      ) : scene ? (
        <>
          <span className="truncate text-[var(--text-2)]">{scene.title || "Untitled scene"}</span>
          <Dot />
          <span className="tabular-nums">{words.toLocaleString()} words</span>
        </>
      ) : null}

      <Dot />
      <button
        type="button"
        onClick={onToggleFlow}
        className="scriare-status-btn rounded-[4px] px-2 py-0.5 text-[11px] text-[var(--text-3)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
      >
        {flowCollapsed ? "Show Story Graph" : "Hide Story Graph"}
      </button>
    </footer>
  );
}

function Dot() {
  return (
    <span aria-hidden className="text-[var(--border-faint)]">
      ·
    </span>
  );
}


