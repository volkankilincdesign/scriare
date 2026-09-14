import type { Entity } from "./entities";
import { CHOICE_OPTION_TYPE } from "./nodeTypes";

/**
 * Speaker attribution (v0.37.0) — a line that knows who is saying it.
 *
 * The decision this file encodes, first, because everything else follows
 * from it: a spoken line is A PARAGRAPH WITH AN ATTRIBUTE, not a new kind
 * of block and not a mode the scene is in.
 *
 * The alternatives were both worse. A "dialogue block" would make every
 * speech an island: the toolbar's marks, alignment, find, undo and the
 * runtime's prose pass all work on paragraphs, and a parallel block would
 * need its own version of each — the same trap v0.32.0 dug the Choice
 * Block out of when it stopped storing labels as strings. A scene-level
 * mode ("this scene is dialogue") is wrong about how narrative actually
 * reads: prose and speech alternate line by line, and a story that has to
 * choose one per scene is a story fighting its editor.
 *
 * An attribute costs nothing on a document that never uses it (every
 * paragraph ever written already has `speaker: null` by default), and it
 * means a spoken line is still a paragraph to everything that already
 * knows what a paragraph is.
 *
 * A `Speaker` is one of three things:
 *
 *  - `null` — nobody in particular. Narration. The default, and what the
 *    overwhelming majority of lines in any story will always be.
 *  - an entity id — a Character (or, if a writer wants it, a Location:
 *    a city can speak in the right story, and refusing that would be
 *    Scriare having an opinion about someone else's fiction).
 *  - `PLAYER_SPEAKER` — the player, who has no name and doesn't need one.
 *    This is the case Volkan asked for explicitly: "the player might be
 *    the speaker so the designer doesn't have to assign a character with a
 *    name all the time". Without it, attributing the protagonist's lines
 *    would mean inventing a Character page for someone the writer may
 *    deliberately be leaving blank.
 */
export type Speaker = string | null;

/**
 * The node types that can carry a speaker: a line, and a choice.
 *
 * Lives here rather than beside the extension that adds the attribute, so
 * that the @ menu can ask "could a speaker go here?" without importing the
 * extension that imports the @ menu's own plugin key.
 */
export const SPEAKER_HOSTS = ["paragraph", CHOICE_OPTION_TYPE];

/**
 * The sentinel for "the player is speaking".
 *
 * The `@` is what makes it safe to keep speakers in a single attribute
 * rather than a `{kind, id}` pair: entity ids come from nanoid, whose
 * alphabet is `A-Za-z0-9_-`, so no id can ever be this string. One
 * attribute means one thing to serialise, one thing to migrate, and one
 * thing for every reader to branch on.
 */
export const PLAYER_SPEAKER = "@player";

/**
 * What the player is CALLED when their lines are attributed.
 *
 * "You" rather than "Player" because it's printed in front of a line of
 * dialogue in a story, not in a debug panel. A project-level setting for
 * this ("Detective", "Ben", the protagonist's actual name) is the obvious
 * next step and deliberately isn't here yet — it belongs with the other
 * story settings rather than as a one-off.
 */
export const PLAYER_SPEAKER_LABEL = "You";

export function isPlayerSpeaker(speaker: Speaker): boolean {
  return speaker === PLAYER_SPEAKER;
}

/**
 * Can this entity say something? Only a Character can.
 *
 * Locations were offered as speakers in the first cut of v0.37.0 purely
 * because they happened to be in the same list, and İstanbul turned up in
 * a story announcing a line. That is a category error, not a missing
 * filter: "the people in a story" and "the places in a story" are one
 * OBJECT with two kinds (see the note at the top of entities.ts), and that
 * economy is worth keeping — but they are not one KIND of thing, and the
 * places don't talk. A city can be mentioned in a sentence, gate a
 * condition, and own a page. It cannot open its mouth.
 *
 * Asked as a function rather than compared inline anywhere, so that when
 * Notes and Assets arrive as further kinds they are silent by default
 * rather than silent only in the three places someone remembered.
 */
export function canSpeak(entity: Entity | undefined | null): boolean {
  return entity?.kind === "character";
}

/**
 * The name to show for a speaker, or `null` when the line is narration.
 *
 * A speaker pointing at an entity that has since been DELETED also returns
 * null: the line quietly becomes narration rather than printing an empty
 * name or a raw id in front of it. That's the same instinct as a mention
 * falling back to its stored label — a story must never render evidence of
 * its own bookkeeping.
 *
 * So does one pointing at something that cannot speak. This is the last
 * line of defence rather than the only one — the menus don't offer a
 * Location and the Inspector doesn't list one — but it is the one that
 * covers a story written against the first build of v0.37.0, where they
 * were offered. Such a line quietly becomes narration, which is what the
 * writer will have meant, and the name disappearing from in front of it is
 * how they find out.
 */
export function speakerName(speaker: Speaker, entities: Entity[]): string | null {
  if (!speaker) return null;
  if (isPlayerSpeaker(speaker)) return PLAYER_SPEAKER_LABEL;
  const entity = entities.find((e) => e.id === speaker);
  if (!canSpeak(entity)) return null;
  return entity!.name.trim() || null;
}

/** Reads the speaker off a document node's attributes, normalised. */
export function nodeSpeaker(attrs: Record<string, unknown> | undefined | null): Speaker {
  const raw = attrs?.speaker;
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}
