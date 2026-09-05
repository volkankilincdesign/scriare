import { useEffect, useMemo } from "react";
import { generateHTML } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import FontFamily from "@tiptap/extension-font-family";
import { useProjectStore } from "../state/projectStore";
import { EMPTY_DOC } from "../types/project";
import { extractChoices } from "../utils/choiceBlocks";
import { FontSize } from "../extensions/FontSize";
import { Callout } from "../extensions/Callout";
import { READING_COLUMN_CLASS, READING_PROSE_CLASS } from "../utils/readingColumn";
import { splitDocumentIntoSegments } from "./documentSegments";
import { renderRuntimeBlock } from "./registry";
import type { RuntimeContext } from "./types";

// The runtime's own extension set, deliberately independent of the editor's
// `useEditor()` instance in SceneEditor.tsx — this file (and everything else
// under runtime/) never imports an editor UI component (SceneEditor,
// EditorToolbar, ChoiceBlockView, SlashCommandMenu, ...). It only consumes
// the same document *model* Tiptap produces: a one-shot static render
// (generateHTML) for ordinary content, plus the registry-driven block
// renderers in registry.ts for anything interactive. Same mark/extension set
// the writing editor supports, so anything a writer formats (bold, italic,
// headings, lists, underline, alignment, font, color, highlight, callouts)
// renders identically here.
const PLAY_EXTENSIONS = [
  StarterKit,
  Underline,
  TextStyle,
  Color,
  Highlight,
  FontFamily,
  FontSize,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Callout,
];

export function PlayRuntime() {
  const project = useProjectStore((s) => s.project);
  const playSceneId = useProjectStore((s) => s.playSceneId);
  const goToPlayScene = useProjectStore((s) => s.goToPlayScene);
  const restartPlay = useProjectStore((s) => s.restartPlay);
  const exitPlay = useProjectStore((s) => s.exitPlay);

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

  const runtimeContext: RuntimeContext = useMemo(() => ({ goToScene: goToPlayScene }), [goToPlayScene]);

  const renderedSegments = useMemo(() => {
    if (!scene) return [];
    return splitDocumentIntoSegments(scene.content ?? EMPTY_DOC).map((segment) => {
      if (segment.kind === "block") return segment;
      try {
        return { ...segment, html: generateHTML(segment.content, PLAY_EXTENSIONS) };
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
    <div className="absolute inset-0 z-10 flex flex-col bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
          ▶ Playing — {project.name}
        </span>
        <button
          type="button"
          onClick={exitPlay}
          className="rounded-md border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
        >
          ■ Exit Play
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-10">
        <div className={READING_COLUMN_CLASS}>
          {!scene ? (
            <div className="text-sm text-zinc-500">
              This story doesn't have a scene to start from yet.
            </div>
          ) : (
            // Keyed by scene id so React remounts this on every scene
            // change — that remount is what triggers the CSS fade-in below,
            // a simple, dependency-free transition (see .runtime-scene-fade
            // in styles/index.css).
            <div key={scene.id} className="runtime-scene-fade">
              <h1 className="mb-6 text-2xl font-semibold text-zinc-100">
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
                <div className="mt-10 flex flex-col items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-950/40 px-8 py-10 text-center">
                  <div className="text-lg font-semibold tracking-wide text-zinc-300">The End</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={restartPlay}
                      className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                    >
                      ↺ Restart Story
                    </button>
                    <button
                      type="button"
                      onClick={exitPlay}
                      className="rounded-md border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800"
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
    </div>
  );
}
