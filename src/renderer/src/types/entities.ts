import { nanoid } from "nanoid";
import type { JSONContent } from "@tiptap/react";
import type { ContentCategory } from "./project";
// One definition of "is this the same word", shared with Find — see the
// note in utils/textFold.ts for why Turkish makes this more than a
// toLowerCase().
import { fold } from "../utils/textFold";

/**
 * The document node type a mention is written as.
 *
 * It lives HERE rather than in extensions/Mention.ts — which defines the
 * node itself and re-exports this — because the plain utilities that have
 * to RECOGNISE a mention (choiceBlocks, storyCheck, mentions) sit well
 * below an extension that drags in React node views, a menu component and
 * the project store. A seven-character string shouldn't pull any of that
 * behind it.
 */
export const MENTION_TYPE = "mention";

/**
 * Entities (v0.35.0) — the people and places a story is about.
 *
 * A Character and a Location are ONE kind of object with a different
 * `kind`, for the same reason a folder and a graph group turned out to be
 * one object in v0.28.0: two implementations of the same idea drift apart,
 * and every feature then has to be built twice. Notes and Assets are
 * expected to join as further kinds rather than as new systems.
 *
 * An entity is three things:
 *
 *  - a NAME, and the other names it answers to. Mara is also "the doctor"
 *    and "Dr. Aydın". Aliases are here from the start because a character
 *    called exactly one thing throughout a story is the exception, and
 *    adding them later would mean migrating every mention already written.
 *  - a PAGE: ordinary document content, written in the same editor as a
 *    scene. Nothing about worldbuilding is structured enough to deserve a
 *    form.
 *  - an IDENTITY that prose can point at. A mention in a scene stores this
 *    id, never the text, which is what lets renaming a character update
 *    every sentence she appears in (see extensions/Mention.ts).
 */
export type EntityKind = "character" | "location" | "note";

export interface Entity {
  id: string;
  kind: EntityKind;
  name: string;
  /** Other names this entity answers to, for @ matching. */
  aliases: string[];
  /** The entity's page — the same document shape a Scene has. */
  content: JSONContent;
}

/** Which Content Browser category each kind lives in. */
export const ENTITY_CATEGORY: Record<EntityKind, ContentCategory> = {
  character: "characters",
  location: "locations",
  note: "notes",
};

export const ENTITY_LABEL: Record<EntityKind, string> = {
  character: "Character",
  location: "Location",
  note: "Note",
};

/**
 * The icon each kind is drawn with, named once (v0.60.0).
 *
 * It was `kind === "character" ? "character" : "location"` in two places,
 * which is a conditional that silently became wrong the moment a third
 * kind existed: every note would have been drawn as a location. The icon
 * names here are the Icon component's own.
 */
export const ENTITY_ICON: Record<EntityKind, "character" | "location" | "note"> = {
  character: "character",
  location: "location",
  note: "note",
};

/**
 * Can the story point at this? (v0.60.0)
 *
 * The one thing that makes a note a note. A mention is the story naming
 * something inside itself; a note is the writer talking to themselves
 * beside it, so it never appears in the `@` menu and can never be
 * mentioned. Written as a question about the ENTITY rather than as a
 * `kind !== "note"` test at the two call sites, because the next kind —
 * whatever it is — will have to answer the same question, and a test
 * spelled out twice is a rule that will be remembered once.
 */
export function isMentionable(entity: Entity | { kind: EntityKind }): boolean {
  return entity.kind !== "note";
}

export function buildEntity(kind: EntityKind, name = ""): Entity {
  return {
    id: nanoid(),
    kind,
    name,
    aliases: [],
    content: { type: "doc", content: [{ type: "paragraph" }] },
  };
}

/** Everything this entity answers to, name first. */
export function entityNames(entity: Entity): string[] {
  return [entity.name, ...entity.aliases].filter((n) => n.trim().length > 0);
}

/**
 * The @ menu's matching. Deliberately forgiving in one direction only: a
 * prefix match on any of the entity's names, case- and accent-insensitive,
 * so typing `@mara` finds Mara and `@doc` finds "the doctor" — but `@ara`
 * does not, because a menu that matches the middle of words fills up with
 * things the writer wasn't thinking of.
 */
export function matchEntities(entities: Entity[], query: string): Entity[] {
  const needle = fold(query);
  if (!needle) return entities;
  return entities.filter((entity) =>
    entityNames(entity).some((name) => fold(name).startsWith(needle)),
  );
}

/**
 * Which of an entity's names best answers a query — what a mention should
 * be labelled with when it's picked from the menu. Typing "the doc" and
 * choosing Mara should write "the doctor", not "Mara".
 */
export function bestNameFor(entity: Entity, query: string): string {
  const needle = fold(query);
  if (!needle) return entity.name;
  const names = entityNames(entity);
  return names.find((name) => fold(name).startsWith(needle)) ?? entity.name;
}

/**
 * The label a mention should show. A mention stores the id AND the text it
 * was written with, so an alias stays the alias the writer chose — but if
 * that text is no longer one of the entity's names (renamed, alias
 * deleted), it falls back to the current name rather than showing a name
 * the story no longer uses.
 */
export function mentionLabel(entity: Entity | undefined, stored: string | null): string {
  if (!entity) return stored ?? "";
  if (stored && entityNames(entity).some((name) => name === stored)) return stored;
  return entity.name;
}
