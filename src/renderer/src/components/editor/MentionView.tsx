import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useProjectStore } from "../../state/projectStore";
import { mentionLabel } from "../../types/entities";

/**
 * A mention as it appears in prose (v0.35.0).
 *
 * Deliberately quiet. This is a writing tool, and the sentence is the
 * point: "Mara" reads as the word it is, with a faint underline that only
 * becomes visible when the pointer is over it. A chip or a coloured pill
 * would announce a database record in the middle of someone's paragraph.
 *
 * The name is read from the store on every render, never from the node's
 * own text — which is what makes a rename appear instantly in every scene
 * she's in, with nothing rewritten and nothing to go stale.
 */
export function MentionView({ node }: NodeViewProps) {
  const entities = useProjectStore((s) => s.project?.entities);
  const selectEntity = useProjectStore((s) => s.selectEntity);

  const entityId = (node.attrs.entityId as string | null) ?? null;
  const stored = (node.attrs.label as string | null) ?? null;
  const entity = entities?.find((e) => e.id === entityId);
  const text = mentionLabel(entity, stored);

  return (
    <NodeViewWrapper
      as="span"
      className={`scriare-mention${entity ? "" : " scriare-mention-missing"}`}
      data-entity-id={entityId ?? undefined}
      // Ctrl/Cmd-click opens the page, the way a link behaves everywhere
      // else. A plain click stays a plain click: the caret has to be able
      // to move through a sentence containing a name without the app
      // navigating somewhere.
      onClick={(e) => {
        if ((e.ctrlKey || e.metaKey) && entity) {
          e.preventDefault();
          selectEntity(entity.id);
        }
      }}
      title={
        entity
          ? `${entity.name} — Ctrl+click to open`
          : "This character or location was deleted; the text stays as written"
      }
    >
      {text}
    </NodeViewWrapper>
  );
}
