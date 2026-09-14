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
import { useEffect, useRef, useState } from "react";
import { useProjectStore } from "../../state/projectStore";
import { useEditorRefStore } from "../../state/editorStore";
import { useRevealMatch } from "../../hooks/useRevealMatch";
import { FontSize } from "../../extensions/FontSize";
import { Callout } from "../../extensions/Callout";
import { Mention } from "../../extensions/Mention";
import { MarkerStyleSync } from "../../extensions/MarkerStyleSync";
import { TextStyleCleanup } from "../../extensions/TextStyleCleanup";
import { EditorToolbar } from "./EditorToolbar";
import { Icon } from "../common/Icon";
import { ENTITY_LABEL } from "../../types/entities";
import { mentionSites } from "../../utils/mentions";
import { READING_COLUMN_CLASS, READING_PROSE_CLASS } from "../../utils/readingColumn";

/**
 * A Character or Location page (v0.35.0).
 *
 * The same editor as a scene, minus the parts that only mean something in a
 * story being played: no Choice Blocks, no Conditional Text. A character
 * page is worldbuilding, not a branch — and the toolbar hides its Choice
 * button on its own here, because that button asks the schema whether it
 * has anywhere to put one.
 *
 * Two things a scene doesn't have:
 *
 *  - ALSO KNOWN AS. The other names this entity answers to, which is what
 *    `@the doctor` matches on. Kept beside the name rather than in a
 *    dialog, because an alias is something you think of while writing
 *    about someone, not something you plan.
 *  - APPEARS IN. Every scene and page that mentions this entity, derived
 *    by walking the documents rather than stored anywhere. A list that is
 *    computed can't be wrong; a list that is maintained goes wrong the
 *    first time an edit forgets to update it.
 */
export function EntityEditor() {
  const project = useProjectStore((s) => s.project);
  const selectedEntityId = useProjectStore((s) => s.selectedEntityId);
  const renameEntity = useProjectStore((s) => s.renameEntity);
  const setEntityAliases = useProjectStore((s) => s.setEntityAliases);
  const updateEntityContent = useProjectStore((s) => s.updateEntityContent);
  const selectScene = useProjectStore((s) => s.selectScene);
  const selectEntity = useProjectStore((s) => s.selectEntity);

  const entity = project?.entities.find((e) => e.id === selectedEntityId) ?? null;
  const lastLoadedId = useRef<string | null>(null);
  const [aliasDraft, setAliasDraft] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Who is this? What do we know?" }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      FontFamily,
      FontSize,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Callout,
      Mention,
      MarkerStyleSync,
      TextStyleCleanup,
    ],
    content: entity?.content,
    onUpdate: ({ editor: e }) => {
      // Read from the store rather than from `entity` in this closure:
      // `useEditor` binds its callbacks once, so a captured entity would be
      // whichever one was open when this editor was created — and every
      // later page would save its text onto that first one. The same trap
      // SceneEditor's selection handler was caught by in v0.33.1.
      const id = useProjectStore.getState().selectedEntityId;
      if (id) updateEntityContent(id, e.getJSON() as JSONContent);
    },
    editorProps: { attributes: { class: `${READING_PROSE_CLASS} focus:outline-none` } },
  });

  // Load the page's content when the open entity changes — same imperative
  // swap SceneEditor does, and for the same reason: recreating the editor
  // would throw away undo history and focus.
  useEffect(() => {
    if (!editor || !entity) return;
    if (lastLoadedId.current === entity.id) return;
    editor.commands.setContent(entity.content ?? { type: "doc", content: [{ type: "paragraph" }] });
    lastLoadedId.current = entity.id;
    setAliasDraft("");
  }, [editor, entity]);

  // Find sends writers here — see hooks/useRevealMatch.ts.
  useRevealMatch(editor, { entityId: entity?.id ?? null });

  // The toolbar and anything else that needs the live editor find it here,
  // exactly as they do while a scene is open.
  useEffect(() => {
    useEditorRefStore.getState().setEditor(editor);
    return () => useEditorRefStore.getState().setEditor(null);
  }, [editor]);

  if (!project || !entity) return null;

  const sites = mentionSites(project, entity.id);

  function addAlias(): void {
    const value = aliasDraft.trim();
    if (!value || !entity) return;
    if ([entity.name, ...entity.aliases].includes(value)) {
      setAliasDraft("");
      return;
    }
    setEntityAliases(entity.id, [...entity.aliases, value]);
    setAliasDraft("");
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-[var(--bg)]">
      <EditorToolbar editor={editor} />
      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className={READING_COLUMN_CLASS}>
          <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-[var(--text-3)]">
            <Icon name={entity.kind === "character" ? "character" : "location"} />
            <span>{ENTITY_LABEL[entity.kind]}</span>
          </div>

          <input
            value={entity.name}
            onChange={(e) => renameEntity(entity.id, e.target.value)}
            className="mb-3 w-full bg-transparent text-2xl font-semibold text-[var(--text)] outline-none placeholder:text-[var(--text-3)]"
            placeholder={`${ENTITY_LABEL[entity.kind]} name`}
          />

          <div className="mb-6 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
              Also known as
            </span>
            {entity.aliases.map((alias) => (
              <span
                key={alias}
                data-alias={alias}
                className="group flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--text-2)]"
              >
                {alias}
                <button
                  type="button"
                  onClick={() =>
                    setEntityAliases(
                      entity.id,
                      entity.aliases.filter((a) => a !== alias),
                    )
                  }
                  title={`Stop answering to "${alias}"`}
                  className="text-[var(--text-3)] hover:text-[var(--danger)]"
                >
                  ✕
                </button>
              </span>
            ))}
            <input
              value={aliasDraft}
              onChange={(e) => setAliasDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addAlias();
                }
              }}
              onBlur={addAlias}
              placeholder="add a name…"
              className="w-28 rounded-full border border-dashed border-[var(--border-soft)] bg-transparent px-2 py-0.5 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
            />
          </div>

          <EditorContent editor={editor} />

          <div className="mt-10 border-t border-[var(--border-soft)] pt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">
              Appears in
            </h3>
            {sites.length === 0 ? (
              <p className="text-xs text-[var(--text-3)]">
                Nowhere yet. Type{" "}
                <span className="text-[var(--text-2)]">@{entity.name || "name"}</span> in a scene.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {sites.map((site) => (
                  <li key={`${site.kind}-${site.id}`}>
                    <button
                      type="button"
                      onClick={() =>
                        site.kind === "scene" ? selectScene(site.id) : selectEntity(site.id)
                      }
                      className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-sm text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                    >
                      <Icon name={site.kind === "scene" ? "scene" : "character"} />
                      <span className="min-w-0 flex-1 truncate">{site.title}</span>
                      {site.count > 1 && (
                        <span className="shrink-0 text-xs text-[var(--text-3)]">×{site.count}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
