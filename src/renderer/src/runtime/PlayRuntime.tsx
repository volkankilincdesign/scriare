import { useEffect, useMemo } from "react";
import { generateHTML } from "@tiptap/core";
import { useProjectStore } from "../state/projectStore";
import { EMPTY_DOC } from "../types/project";
import { extractChoices } from "../utils/choiceBlocks";
import { READING_COLUMN_CLASS, READING_PROSE_CLASS } from "../utils/readingColumn";
import { splitDocumentIntoSegments } from "./documentSegments";
import { renderRuntimeBlock } from "./registry";
import { RUNTIME_EXTENSIONS } from "./extensions";
import { VariableReadout } from "./VariableReadout";
import type { RuntimeContext } from "./types";

export function PlayRuntime() {
  const project = useProjectStore((s) => s.project);
  const playSceneId = useProjectStore((s) => s.playSceneId);
  const goToPlayScene = useProjectStore((s) => s.goToPlayScene);
  const restartPlay = useProjectStore((s) => s.restartPlay);
  const exitPlay = useProjectStore((s) => s.exitPlay);
  const applyVariableActions = useProjectStore((s) => s.applyVariableActions);
  const playVariableValues = useProjectStore((s) => s.playVariableValues);

  const scene = project?.scenes.find((s) => s.id === playSceneId) ?? null;

  // ESC returns to Edit Mode immediately, same as clicking Exit Play. The
  // editor and graph underneath were never unmounted (see App.tsx — they're
  // only CSS-hidden while playing), so the current scene, its scroll
  // position, the graph's pan/zoom, and the selected scene are all exactly
  // as the writer left them.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === "Escape") exitPlay();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [exitPlay]);

  const runtimeContext: RuntimeContext = useMemo(
    () => ({
      goToScene: goToPlayScene,
      applyActions: applyVariableActions,
      // The read side, added with Conditions (v0.30.0) — see runtime/types.ts.
      variables: project?.variables ?? [],
      values: playVariableValues,
    }),
    [goToPlayScene, applyVariableActions, project?.variables, playVariableValues],
  );

  const renderedSegments = useMemo(() => {
    if (!scene) return [];
    return splitDocumentIntoSegments(scene.content ?? EMPTY_DOC).map((segment) => {
      if (segment.kind === "block") return segment;
      try {
        return { ...segment, html: generateHTML(segment.content, RUNTIME_EXTENSIONS) };
      } catch {
        return { ...segment, html: "" };
      }
    });
  }, [scene]);

  const hasAnyLinkedChoice = useMemo(
    () => (scene ? extractChoices(scene.content).some((c) => c.targetSceneId) : false),
    [scene],
  );

  if (!project) return null;

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-[var(--bg)]">
      <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
          ▶ Playing — {project.name}
        </span>
        <button
          type="button"
          onClick={exitPlay}
          className="rounded-md border border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)]"
        >
          ■ Exit Play
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-10">
        <div className={READING_COLUMN_CLASS}>
          {!scene ? (
            <div className="text-sm text-[var(--text-3)]">
              This story doesn't have a scene to start from yet.
            </div>
          ) : (
            // Keyed by scene id so React remounts this on every scene
            // change — that remount is what triggers the CSS fade-in below,
            // a simple, dependency-free transition (see .runtime-scene-fade
            // in styles/index.css).
            <div key={scene.id} className="runtime-scene-fade">
              <h1 className="mb-6 text-2xl font-semibold text-[var(--text)]">
                {scene.title || "Untitled scene"}
              </h1>

              {renderedSegments.map((segment, index) =>
                segment.kind === "block" ? (
                  renderRuntimeBlock(segment.node, runtimeContext, index)
                ) : (
                  <div
                    key={index}
                    className={READING_PROSE_CLASS}
                    dangerouslySetInnerHTML={{ __html: segment.html }}
                  />
                ),
              )}

              {!hasAnyLinkedChoice && (
                <div className="mt-10 flex flex-col items-center gap-4 rounded-lg border border-[var(--border-soft)] bg-[var(--overlay)] px-8 py-10 text-center">
                  <div className="text-lg font-semibold tracking-wide text-[var(--text-2)]">The End</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={restartPlay}
                      className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-text-on)] hover:bg-[var(--accent-hover)]"
                    >
                      ↺ Restart Story
                    </button>
                    <button
                      type="button"
                      onClick={exitPlay}
                      className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)]"
                    >
                      ✎ Return to Editor
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <VariableReadout variables={project.variables} values={playVariableValues} />
    </div>
  );
}
