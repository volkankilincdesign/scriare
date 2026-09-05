import { useEditor, EditorContent } from "@tiptap/react";
import type { JSONContent } from "@tiptap/react";
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
import { FontSize } from "../../extensions/FontSize";
import { ChoiceBlock } from "../../extensions/ChoiceBlock";
import { Callout } from "../../extensions/Callout";
import { SlashCommand } from "../../extensions/SlashCommand";
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
    ],
    content: scene?.content,
    onUpdate: ({ editor }) => {
      if (scene) updateSceneContent(scene.id, editor.getJSON() as JSONContent);
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
      <div className="flex h-full flex-1 items-center justify-center bg-zinc-900 text-sm text-zinc-600">
        Select or create a scene to start writing.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-zinc-900">
      <EditorToolbar editor={editor} />
      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className={READING_COLUMN_CLASS}>
          <input
            value={scene.title}
            onChange={(e) => renameScene(scene.id, e.target.value)}
            className="mb-6 w-full bg-transparent text-2xl font-semibold text-zinc-100 outline-none placeholder:text-zinc-600"
            placeholder="Scene title"
          />
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
