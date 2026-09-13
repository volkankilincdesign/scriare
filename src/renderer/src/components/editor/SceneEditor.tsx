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
import { useEditorRefStore } from "../../state/editorStore";
import { FontSize } from "../../extensions/FontSize";
import { ChoiceBlock } from "../../extensions/ChoiceBlock";
import { Callout } from "../../extensions/Callout";
import { ConditionalBlock } from "../../extensions/ConditionalBlock";
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
      ConditionalBlock,
      SlashCommand,
      MarkerStyleSync,
      TextStyleCleanup,
    ],
    content: scene?.content,
    onUpdate: ({ editor }) => {
      if (scene) updateSceneContent(scene.id, editor.getJSON() as JSONContent);
    },
    // Sprint 9A/9B — the Inspector Philosophy: when the ProseMirror
    // selection becomes a NodeSelection over a Choice Block, the Inspector
    // switches to that block's Choice Properties (see InspectorPanel.tsx);
    // any other selection (a text cursor, a different node) clears back to
    // Scene Properties. As of Sprint 9B the whole block is the unit of
    // Inspector targeting — clicking anywhere in a Choice Block selects it
    // as one object (see ChoiceBlockView.tsx), and the Inspector shows
    // every one of its options as its own accordion, rather than the
    // Inspector tracking one option at a time the way 9A did.
    onSelectionUpdate: ({ editor: e }) => {
      if (!scene) return;
      const { selection } = e.state;
      if (selection instanceof NodeSelection && selection.node.type.name === "choiceBlock") {
        const blockId = selection.node.attrs?.blockId as string | undefined;
        if (blockId) {
          useInspectorStore.getState().selectTarget({ kind: "choice", sceneId: scene.id, blockId });
          return;
        }
      }
      // A Conditional Block holds real prose, so the writer's cursor sits
      // inside it rather than selecting it as a node. Walking up the
      // selection's ancestors is what lets "I'm typing in a gated
      // paragraph" show that gate's conditions in the Inspector, without
      // requiring a click on some separate handle.
      const { $from } = selection;
      for (let depth = $from.depth; depth > 0; depth -= 1) {
        const ancestor = $from.node(depth);
        if (ancestor.type.name === "conditionalBlock") {
          const blockId = ancestor.attrs?.blockId as string | undefined;
          if (blockId) {
            useInspectorStore
              .getState()
              .selectTarget({ kind: "conditional", sceneId: scene.id, blockId });
            return;
          }
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

  // Sprint 9B — publishes the live editor instance so the Inspector (a
  // sibling panel, not a child of this component) can dispatch real
  // ProseMirror transactions against it for Choice Block edits instead of
  // writing to the store directly. See editorStore.ts's comment for why
  // that distinction matters.
  useEffect(() => {
    useEditorRefStore.getState().setEditor(editor);
    return () => useEditorRefStore.getState().setEditor(null);
  }, [editor]);

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
