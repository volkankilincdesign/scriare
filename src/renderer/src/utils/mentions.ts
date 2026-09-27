import type { JSONContent } from "@tiptap/react";
import { MENTION_TYPE, mentionLabel } from "../types/entities";
import type { Entity } from "../types/entities";
import type { Project, Scene } from "../types/project";

/** Every entity id mentioned anywhere in a document, in document order. */
export function mentionedEntityIds(content: JSONContent | undefined | null): string[] {
  const found: string[] = [];
  if (!content) return found;
  (function walk(node: JSONContent): void {
    if (node.type === MENTION_TYPE) {
      const id = node.attrs?.entityId as string | undefined;
      if (id) found.push(id);
      return;
    }
    node.content?.forEach(walk);
  })(content);
  return found;
}

/**
 * Where an entity appears — the backlinks shown on its page.
 *
 * Derived by walking the scenes rather than stored on the entity, which is
 * the only version that can't be wrong: a list maintained alongside the
 * documents would need updating on every edit, every paste, every undo,
 * and the first missed case would leave a character claiming to appear in
 * a scene she doesn't.
 *
 * Entity pages are walked too — a character can mention a location, and a
 * location can mention the people who live there.
 */
export interface MentionSite {
  id: string;
  title: string;
  kind: "scene" | "entity";
  /** How many times this entity is mentioned there. */
  count: number;
}

export function mentionSites(project: Project | null, entityId: string): MentionSite[] {
  if (!project) return [];
  const sites: MentionSite[] = [];

  const countIn = (content: JSONContent | undefined): number =>
    mentionedEntityIds(content).filter((id) => id === entityId).length;

  project.scenes.forEach((scene: Scene) => {
    const count = countIn(scene.content);
    if (count > 0) {
      sites.push({ id: scene.id, title: scene.title || "Untitled scene", kind: "scene", count });
    }
  });

  project.entities.forEach((entity: Entity) => {
    if (entity.id === entityId) return;
    const count = countIn(entity.content);
    if (count > 0) {
      sites.push({ id: entity.id, title: entity.name || "Untitled", kind: "entity", count });
    }
  });

  return sites;
}

/**
 * What a page points AT — the other direction of the same walk (v0.60.0).
 *
 * `mentionSites` answers "where is this mentioned", which is the right
 * question for a character and a meaningless one for a NOTE: a note can
 * never be mentioned, so its "Appears in" list would be empty for as long
 * as it existed, and a section that is permanently empty is worse than no
 * section. The useful question about a note is the reverse one, and it is
 * the same data read backwards — the entities this page names, in the
 * order it names them, counted.
 *
 * Distinct rather than one row per mention: a note that says "Yseide" four
 * times has one relationship with Yseide, not four.
 */
export interface MentionTarget {
  id: string;
  name: string;
  kind: Entity["kind"];
  count: number;
}

export function mentionTargets(project: Project | null, content: JSONContent | undefined): MentionTarget[] {
  if (!project) return [];
  const counts = new Map<string, number>();
  for (const id of mentionedEntityIds(content)) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const out: MentionTarget[] = [];
  for (const [id, count] of counts) {
    const entity = project.entities.find((e: Entity) => e.id === id);
    // A mention of something deleted is dropped rather than drawn as a
    // broken row: the mention itself already falls back to its stored
    // label in the prose, and a list of links has nowhere to send you.
    if (!entity) continue;
    out.push({ id, name: entity.name || "Untitled", kind: entity.kind, count });
  }
  return out;
}

/**
 * A copy of `content` with every mention's stored label replaced by the
 * entity's CURRENT name — what Play Mode renders through.
 *
 * The editor doesn't need this (its NodeView reads the store live), but the
 * runtime renders documents to HTML, where a node's attributes are all
 * there is. Doing the swap here, once, on the way in, is what keeps "rename
 * a character and every scene says the new name" true for the player as
 * well as the writer, with nothing rewritten on disk.
 */
export function resolveMentions(
  content: JSONContent | undefined | null,
  entities: Entity[],
): JSONContent {
  const EMPTY: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };
  if (!content) return EMPTY;
  const byId = new Map(entities.map((e) => [e.id, e]));

  function walk(node: JSONContent): JSONContent {
    if (node.type === MENTION_TYPE) {
      const entity = byId.get((node.attrs?.entityId as string) ?? "");
      const label = mentionLabel(entity, (node.attrs?.label as string) ?? null);
      return { ...node, attrs: { ...node.attrs, label } };
    }
    if (!node.content) return node;
    return { ...node, content: node.content.map(walk) };
  }

  return walk(content);
}

/**
 * A resolver for the flattening helpers that can't reach the entity list
 * themselves (utils/choiceBlocks.ts's `optionPlainText` and everything
 * built on it).
 *
 * Same rule `mentionLabel` applies: what the writer typed wins while it's
 * still one of the entity's names, otherwise the current name — so an
 * alias stays the alias, and a renamed character is renamed everywhere
 * that shows her, the Story Graph included.
 */
export function mentionResolver(entities: Entity[]): (id: string | null, stored: string) => string {
  const byId = new Map(entities.map((e) => [e.id, e]));
  return (id, stored) => mentionLabel(id ? byId.get(id) : undefined, stored || null);
}
