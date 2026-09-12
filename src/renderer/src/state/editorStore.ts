import { create } from "zustand";
import type { Editor } from "@tiptap/react";

/**
 * Sprint 9B (Choice Block Inspector Refactor) — holds a reference to the
 * single, currently-mounted Tiptap `Editor` instance from SceneEditor.tsx.
 *
 * Why this needs to exist: the Inspector is a sibling panel, not a child of
 * SceneEditor, so it has no direct way to reach the live editor. Before this
 * sprint, the Inspector edited a Choice option by writing straight to
 * `project.scenes` via projectStore (see the old `updateChoiceOption`) — but
 * that bypassed the editor's own document entirely. SceneEditor only loads
 * `scene.content` into the live Tiptap document on a *scene switch*, so a
 * store-only write was invisible to the mounted editor until the writer
 * navigated away and back; if they typed anything in the meantime, the
 * editor's next `onUpdate` would silently overwrite the Inspector's change
 * with its own (still-stale) document. That was fine when Sprint 9A's
 * Inspector only touched one option's Actions on rare edits, but this
 * sprint makes the Inspector the primary place Choice content is edited, so
 * the bug had to be fixed at the root instead of patched around.
 *
 * The fix: every Choice edit — from the editor's own NodeView or from the
 * Inspector — now goes through one path, a real ProseMirror transaction on
 * this same editor instance (see utils/choiceBlockEditing.ts). That
 * transaction's own `onUpdate` is what persists to `project.scenes`, so
 * there is exactly one writer of scene content, never two.
 *
 * Deliberately NOT part of projectStore: this is a live object reference
 * tied to a mounted DOM/ProseMirror view, not serializable project data —
 * mixing it into the project-data store would make it look like state that
 * belongs in the saved file.
 */
interface EditorRefState {
  editor: Editor | null;
  setEditor: (editor: Editor | null) => void;
}

export const useEditorRefStore = create<EditorRefState>((set) => ({
  editor: null,
  setEditor: (editor) => set({ editor }),
}));
