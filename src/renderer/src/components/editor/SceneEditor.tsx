import { useEditor, EditorContent } from "@tiptap/react";
import type { JSONContent } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import FontFamily from "@tiptap/extension-font-family";
import { useEffect, useRef } from "react";
import { useProjectStore } from "../../state/projectStore";
import { useInspectorStore } from "../../state/inspectorStore";
import { FontSize } from "../../extensions/FontSize";
import { ChoiceBlock } from "../../extensions/ChoiceBlock";
import { Callout } from "../../extensions/Callout";
import { SlashCommand } from "../../extensions/SlashCommand";
import { MarkerStyleSync } from "../../extensions/MarkerStyleSync";
import { TextStyleCleanup } from "../../extensions/TextStyleCleanup";
import { EditorToolbar } from "./EditorToolbar";
import { READING_COLUMN_CLASS, READING_PROSE_CLASS } from "../../utils/readingColumn";

export function SceneEditor() {
  const project = useProjectStore((s) => s.project);
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
  const renameScene = useProjectStore((s) => s.renameScene);
  const updateSceneContent = useProjectStore((s) => s.updateSceneContent);

  const scene = project?.scenes.find((s) => s.id === selectedSceneId) ?? null;
  const lastLoadedSceneId = useRef<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Start writing this scene..." }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      FontFamily,
      FontSize,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      ChoiceBlock,
      Callout,
      SlashCommand,
      MarkerStyleSync,
      TextStyleCleanup,
    ],
    content: scene?.content,
    onUpdate: ({ editor }) => {
      if (scene) updateSceneContent(scene.id, editor.getJSON() as JSONContent);
    },
    // Sprint 9A — the Inspector Philosophy: when the ProseMirror selection
    // becomes a NodeSelection over a Choice Block, the Inspector switches to
    // that block's Choice Properties (see InspectorPanel.tsx); any other
    // selection (a text cursor, a different node) clears back to Scene
    // Properties. This only tracks the BLOCK — ChoiceBlockView's own
    // onFocus handlers (see ChoiceBlockView.tsx) narrow the target further
    // to a specific option once the writer focuses one of its inputs, since
    // a NodeSelection alone can't tell us which option they're editing.
    onSelectionUpdate: ({ editor: e }) => {
      if (!scene) return;
      const { selection } = e.state;
      if (selection instanceof NodeSelection && selection.node.type.name === "choiceBlock") {
        const node = selection.node;
        const blockId = node.attrs?.blockId as string | undefined;
        const options = (node.attrs?.options as { id: string }[] | undefined) ?? [];
        const firstOptionId = options[0]?.id;
        if (blockId && firstOptionId) {
          const current = useInspectorStore.getState().target;
          // Preserve the currently-tracked option if the selection is still
          // on the same block (e.g. ChoiceBlockView's onFocus already
          // narrowed it) — only default to the first option when the block
          // itself just became selected.
          const optionId =
            current.kind === "choice" && current.blockId === blockId
              ? current.optionId
              : firstOptionId;
          useInspectorStore.getState().selectTarget({ kind: "choice", sceneId: scene.id, blockId, optionId });
          return;
        }
      }
      useInspectorStore.getState().clearTarget();
    },
    editorProps: {
      attributes: {
        class: `${READING_PROSE_CLASS} focus:outline-none`,
      },
    },
  });

  // The editor instance is created once and reused across scenes — when the
  // selected scene changes, load its content in imperatively instead of
  // recreating the editor (which would reset undo history and lose focus).
  useEffect(() => {
    if (!editor || !scene) return;
    if (lastLoadedSceneId.current === scene.id) return;

    editor.commands.setContent(
      scene.content ?? { type: "doc", content: [{ type: "paragraph" }] },
    );
    lastLoadedSceneId.current = scene.id;
  }, [editor, scene]);

  if (!project) return null;

  if (!scene) {
    return (
      <div className="flex h-full flex-1 items-center justify-center bg-[var(--bg)] text-sm text-[var(--text-3)]">
        Select or create a scene to start writing.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-[var(--bg)]">
      <EditorToolbar editor={editor} />
      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className={READING_COLUMN_CLASS}>
          <input
            value={scene.title}
            onChange={(e) => renameScene(scene.id, e.target.value)}
            className="mb-6 w-full bg-transparent text-2xl font-semibold text-[var(--text)] outline-none placeholder:text-[var(--text-3)]"
            placeholder="Scene title"
          />
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
