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
import { useRevealMatch } from "../../hooks/useRevealMatch";
import { FontSize } from "../../extensions/FontSize";
import { ChoiceBlock } from "../../extensions/ChoiceBlock";
import { Callout } from "../../extensions/Callout";
import { ConditionalBlock } from "../../extensions/ConditionalBlock";
import { ChoiceOption } from "../../extensions/ChoiceOption";
import { Mention } from "../../extensions/Mention";
import { Speaker } from "../../extensions/Speaker";
import { SlashCommand } from "../../extensions/SlashCommand";
import { MarkerStyleSync } from "../../extensions/MarkerStyleSync";
import { TextStyleCleanup } from "../../extensions/TextStyleCleanup";
import { EditorToolbar } from "./EditorToolbar";
import { SpeakerMenu } from "./SpeakerMenu";
import { READING_COLUMN_CLASS, READING_PROSE_CLASS } from "../../utils/readingColumn";
import { EMPTY_EDITOR_DOC, loadDocumentIntoEditor } from "../../utils/loadDocument";

export function SceneEditor() {
  const project = useProjectStore((s) => s.project);
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
  const renameScene = useProjectStore((s) => s.renameScene);
  const updateSceneContent = useProjectStore((s) => s.updateSceneContent);
  // Bumped whenever the whole project is replaced underneath the editor —
  // see the load effect below, and projectStore's own note on the field.
  const documentToken = useProjectStore((s) => s.documentToken);

  const scene = project?.scenes.find((s) => s.id === selectedSceneId) ?? null;
  const lastLoadedKey = useRef<string | null>(null);

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
      ChoiceOption,
      Mention,
      Speaker,
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
    onSelectionUpdate: ({ editor: e, transaction }) => {
      // v0.34.1 — landing IN something always targets it; landing in
      // nothing only clears the Inspector if the writer is actually in the
      // editor.
      //
      // Reported: dragging a choice into a new order and releasing the
      // mouse threw the Inspector back to Scene Properties, mid-edit. This
      // handler was treating every selection change as the writer moving
      // their caret, when some of them are side effects of the Inspector's
      // own work — reordering rewrites the block's children, which remaps
      // the selection, and releasing the mouse outside the editor can make
      // ProseMirror resync its selection from the DOM. The caret ends up
      // somewhere neutral, the handler concluded "they've left the choice",
      // and the panel being actively used closed itself.
      //
      // The asymmetry below is the fix, and it is not a special case: a
      // selection inside a choice is unambiguous evidence about what the
      // writer is working on, whoever moved it. A selection that is inside
      // nothing is only evidence when the writer moved it there themselves
      // — otherwise it is just where a rewrite happened to leave the caret.
      //
      // Two tests, both needed:
      //  - `docChanged` catches every edit the Inspector itself makes —
      //    reorder, remove, add, change a destination — since all of them
      //    rewrite the document and remap the selection as a side effect.
      //    None of them is the writer leaving the choice.
      //  - focus (or an explicitly set selection) catches the rest. This
      //    can't be a blanket `if (!isFocused) return`, because `.focus()`
      //    lands a frame AFTER the selection it sets, so the update for a
      //    deliberate click arrives while `isFocused` is still false.
      const cameFromAnEdit = transaction.docChanged;
      const theWriterMovedIt = e.isFocused || transaction.selectionSet;
      // The scene id comes from the store rather than from `scene` in this
      // closure. `useEditor`'s callbacks are bound when the editor is
      // created — which happens on the first render, when `project` may
      // still be loading and `scene` is therefore null — so a captured
      // `scene` can be permanently stale, and every branch below would
      // silently do nothing forever. Reading the store at call time is the
      // only version of this that can't go quietly wrong.
      const sceneId = useProjectStore.getState().selectedSceneId;
      if (!sceneId) return;
      const { selection } = e.state;
      const inspector = useInspectorStore.getState();

      if (selection instanceof NodeSelection && selection.node.type.name === "choiceBlock") {
        const blockId = selection.node.attrs?.blockId as string | undefined;
        if (blockId) {
          inspector.selectTarget({ kind: "choice", sceneId, blockId });
          return;
        }
      }

      // One walk up the ancestors, answering all three questions at once:
      // which Choice Block the caret is in, which option inside it, and —
      // failing those — whether it's inside a Conditional Block.
      //
      // v0.33.1 added the Choice half. Before v0.32.0 a Choice Block was an
      // atom: there was nowhere for a caret to go, so a NodeSelection over
      // the whole block (above) was the only way to be "in" one. Now that a
      // choice label is real text the writer types into, the ordinary way
      // to work on a choice is to have the caret in it — and until this
      // version that showed Scene Properties, telling the writer to select
      // a Choice Block while they were typing inside one.
      const { $from } = selection;
      let optionId: string | null = null;
      for (let depth = $from.depth; depth > 0; depth -= 1) {
        const ancestor = $from.node(depth);
        const name = ancestor.type.name;

        if (name === "choiceOption") {
          optionId = (ancestor.attrs?.optionId as string) ?? null;
          continue;
        }
        if (name === "choiceBlock") {
          const blockId = ancestor.attrs?.blockId as string | undefined;
          if (blockId) {
            // An edit never re-aims the Inspector inside the block it is
            // already showing. Reordering moves options past the caret, so
            // the caret ends up in a DIFFERENT choice than the one the
            // writer was working on — following that would swap which
            // accordion is open underneath their hands, halfway through
            // the gesture that caused it.
            const already = inspector.target;
            if (cameFromAnEdit && already.kind === "choice" && already.blockId === blockId) return;
            // Otherwise the option rides along so the Inspector can open
            // that option's accordion; the block is still what's targeted.
            inspector.selectTarget({ kind: "choice", sceneId, blockId, optionId });
            return;
          }
        }
        // A Conditional Block holds real prose, so the writer's cursor sits
        // inside it rather than selecting it as a node — which is what lets
        // "I'm typing in a gated paragraph" show that gate's conditions in
        // the Inspector, with no separate handle to click.
        if (name === "conditionalBlock") {
          const blockId = ancestor.attrs?.blockId as string | undefined;
          if (blockId) {
            inspector.selectTarget({ kind: "conditional", sceneId, blockId });
            return;
          }
        }
      }

      if (!cameFromAnEdit && theWriterMovedIt) inspector.clearTarget();
    },
    editorProps: {
      attributes: {
        class: `${READING_PROSE_CLASS} focus:outline-none`,
      },
    },
  });

  // The editor instance is created once and reused across scenes — when the
  // selected scene changes, load its content in imperatively instead of
  // recreating the editor (which would lose focus and remount every node
  // view). See utils/loadDocument.ts for why the load replaces the editor
  // state rather than calling `setContent`: with `setContent`, a scene
  // switch was an undoable step, and Ctrl+Z on arrival wrote the previous
  // scene's text into this one.
  //
  // KEYED ON THE LOAD TOKEN AS WELL AS THE SCENE ID. The guard used to be
  // `lastLoadedSceneId.current === scene.id` alone, which is right while
  // the writer is moving between scenes and wrong the moment the whole
  // project is replaced underneath them — opening another project, or
  // answering "open the version on disk" in the conflict dialog. The scene
  // id is usually unchanged across a reload, so the guard short-circuited
  // and ProseMirror kept displaying the text the writer had just chosen to
  // discard. Measured:
  //
  //   store says   : "DISK-VERSION"
  //   editor shows : "SESSION-TEXT-TO-DISCARD"     ← split brain
  //   type one character:
  //   store now    : "SESSION-TEXT-TO-DISCARDx"    ← disk version destroyed
  //
  // `fileStamp` is valid by then, so no second conflict stops it — the one
  // answer that means "keep the other machine's work" was the one that
  // destroyed it.
  useEffect(() => {
    if (!editor || !scene) return;
    const key = `${documentToken}:${scene.id}`;
    if (lastLoadedKey.current === key) return;

    loadDocumentIntoEditor(editor, scene.content ?? EMPTY_EDITOR_DOC);
    lastLoadedKey.current = key;
  }, [editor, scene, documentToken]);

  // Find sends writers here — see hooks/useRevealMatch.ts.
  useRevealMatch(editor, { sceneId: scene?.id ?? null });

  // Sprint 9B — publishes the live editor instance so the Inspector (a
  // sibling panel, not a child of this component) can dispatch real
  // ProseMirror transactions against it for Choice Block edits instead of
  // writing to the store directly. See editorStore.ts's comment for why
  // that distinction matters.
  useEffect(() => {
    useEditorRefStore.getState().setEditor(editor);
    return () => useEditorRefStore.getState().setEditor(null);
  }, [editor]);

  // v0.37.0 — the speaker names in front of spoken lines are decorations
  // built from the entity list, not from the document (see
  // extensions/Speaker.ts). Renaming a character therefore changes nothing
  // ProseMirror can see, and the editor would happily keep drawing the old
  // name until the next keystroke. An empty transaction is the cheapest
  // honest way to say "redraw": it changes no content, so it makes no undo
  // step and no save, and it lands in the decoration pass as an ordinary
  // update.
  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(editor.state.tr.setMeta("addToHistory", false));
  }, [editor, project?.entities]);

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
        <div className={`scriare-page ${READING_COLUMN_CLASS}`}>
          <input
            value={scene.title}
            onChange={(e) => renameScene(scene.id, e.target.value)}
            className="mb-6 w-full bg-transparent text-2xl font-semibold text-[var(--text)] outline-none placeholder:text-[var(--text-3)]"
            placeholder="Scene title"
          />
          <EditorContent editor={editor} />
          <SpeakerMenu editor={editor} />
        </div>
      </div>
    </div>
  );
}
