import type { JSONContent } from "@tiptap/react";
import type { Project } from "../types/project";
import { extractChoices } from "./choiceBlocks";
import { SCENE_NODE_HEIGHT, SCENE_NODE_WIDTH } from "./graphConstants";

/**
 * The cached story shape (v0.53.0).
 *
 * The Welcome screen draws each recent story's map, and it has to draw it
 * WITHOUT opening the project. Parsing every `.scriare` on that screen is
 * the obvious answer and the wrong one: a 300-scene story is megabytes of
 * Tiptap JSON, eight of them are read before the first frame, and the one
 * screen whose entire job is "get out of the way" becomes the slowest in
 * the app.
 *
 * So the shape is written at a moment the app is already writing to disk —
 * a save — and stored beside the project's entry in recent-projects.json.
 * What is stored is deliberately not the story: it is up to
 * MAX_SHAPE_NODES node positions normalised into the unit square, plus the
 * edges between them as index pairs. No titles, no prose, no ids. That
 * matters twice over — it is under a kilobyte (see SHAPE_BUDGET_BYTES and
 * the test that measures a real one), and recent-projects.json lives in
 * userData, where a writer has no reason to expect their prose to be.
 *
 * A story saved by an older version has no shape yet. That is a state the
 * UI draws, not an error: the card shows the graph's own dot field — an
 * empty canvas rather than a grey box — and fills in the first time the
 * story is saved.
 */
export interface StoryShape {
  /**
   * Format version. A shape without it was written by v0.53.0, whose
   * coordinates mean something different (see SHAPE_FORMAT), and is
   * treated as no shape at all — the card shows an empty canvas and the
   * backfill redraws it. Migrating those would mean guessing at an aspect
   * ratio that was thrown away; redrawing takes one file read.
   */
  v: 2;
  /**
   * Node TOP-LEFT positions, in units where 1.0 is the longer side of the
   * story's own bounding box. Both axes share that one scale, so the
   * numbers are a scale model of the graph rather than two independent
   * normalisations — see SHAPE_FORMAT.
   */
  nodes: { x: number; y: number }[];
  /** Edges as [fromIndex, toIndex] into `nodes`. */
  edges: [number, number][];
  /** Index of the start scene in `nodes`, or -1 when it was not sampled. */
  start: number;
  /** How many scenes the story actually has — `nodes.length` is the sample. */
  total: number;
  /** The graph's extent in the same units. One of these is always 1. */
  w: number;
  h: number;
  /** A scene card's size in the same units, so the drawing is a miniature. */
  node: { w: number; h: number };
}

/**
 * WHY ONE SCALE FOR BOTH AXES (v0.53.2).
 *
 * v0.53.0 normalised x and y independently into the unit square, which
 * is the obvious thing to do and quietly destroys the drawing. A story
 * laid out left to right is a wide, flat graph — a real 13-scene story
 * measured 1108 × 148 canvas units, 7.5:1 — and the card it is drawn in
 * is 290 × 124, about 2.3:1. Stretching each axis to fit multiplies
 * every vertical distance by 3.2 relative to every horizontal one, so
 * the neat left-to-right spine with two short branches comes out as a
 * vertical scatter of blobs. It is not a smaller picture of the graph;
 * it is a different graph.
 *
 * So both axes are divided by the SAME number — the longer side of the
 * bounding box — and the scene-card size is divided by it too. What is
 * stored is then a scale model: every distance, every angle and the
 * cards themselves are in the proportions the writer laid out, and the
 * renderer's only job is to multiply by one number and centre the
 * result.
 *
 * The cost is honest empty space. A 7.5:1 graph in a 2.3:1 panel fills
 * the width and about a third of the height, and the rest is canvas —
 * which is what it actually is, and why the panel draws the graph's own
 * dot field behind the drawing rather than leaving a void.
 */
export const SHAPE_FORMAT = 2;

/**
 * Is this stored shape one this version knows how to draw?
 *
 * A shape from v0.53.0 has the same field names and different meanings,
 * which is the worst kind of incompatibility: it draws, and it draws the
 * wrong picture. Rather than migrate coordinates whose aspect ratio was
 * thrown away when they were written, an unrecognised shape is simply not
 * a shape — the card shows an empty canvas and the backfill redraws it
 * from the story itself, which costs one file read, once.
 */
export function isDrawableShape(shape: unknown): shape is StoryShape {
  const s = shape as StoryShape | null;
  return Boolean(
    s &&
      s.v === SHAPE_FORMAT &&
      Array.isArray(s.nodes) &&
      s.nodes.length > 0 &&
      s.node &&
      typeof s.w === "number" &&
      typeof s.h === "number",
  );
}

/**
 * Twenty is the number of nodes a 372×104 card can draw and a person can
 * still read as a shape. Forty fits geometrically and reads as static;
 * ten stops distinguishing a spine from a fan, which is the only thing the
 * picture is for.
 */
export const MAX_SHAPE_NODES = 20;

/** What one cached shape may cost. Asserted against a real story in tests. */
export const SHAPE_BUDGET_BYTES = 1024;

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * The scene-card size is kept finer than the positions, and for a reason
 * worth the two extra bytes: it is the one stored pair whose RATIO is
 * read back. On a 6000-unit-wide story, three decimals quantises 180×56
 * to 0.028 × 0.009 — a card of 3.11:1 instead of 3.21:1, visibly squatter
 * than any card in the app. Positions do not care: three decimals of the
 * longest side is a couple of canvas units, far under a card.
 */
function round5(n: number): number {
  return Math.round(n * 100000) / 100000;
}

/**
 * Which scenes get sampled when a story has more than MAX_SHAPE_NODES.
 *
 * Breadth-first from the start scene, following choices — NOT the first
 * twenty scenes in array order, which is the order they were created in
 * and says nothing about the story. The difference is the whole value of
 * the picture: a breadth-first sample of a branching story is a branching
 * shape, while a creation-order sample of the same story is twenty nodes
 * with whichever edges happen to fall between them, which for most stories
 * is almost none. A map of twenty disconnected boxes is worse than no map,
 * because it says the story has no shape.
 *
 * Scenes unreachable from the start are appended afterwards, in order, so
 * a story whose start scene is not wired up yet still draws something.
 */
function sampleSceneIds(project: Project, edgesBySource: Map<string, string[]>): string[] {
  const all = project.scenes.map((s) => s.id);
  if (all.length <= MAX_SHAPE_NODES) return all;

  const known = new Set(all);
  const picked: string[] = [];
  const seen = new Set<string>();
  const queue: string[] = [];

  const first = project.startSceneId && known.has(project.startSceneId)
    ? project.startSceneId
    : all[0];
  queue.push(first);
  seen.add(first);

  while (queue.length > 0 && picked.length < MAX_SHAPE_NODES) {
    const id = queue.shift() as string;
    picked.push(id);
    for (const next of edgesBySource.get(id) ?? []) {
      if (!seen.has(next) && known.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }

  for (const id of all) {
    if (picked.length >= MAX_SHAPE_NODES) break;
    if (!seen.has(id)) picked.push(id);
  }

  return picked;
}

/**
 * Builds the cached shape for a project, or null when there is nothing to
 * draw (no scenes at all — a project that exists but has not been started).
 *
 * Positions are normalised by the bounding box of the SAMPLED scenes, so
 * the drawing fills the card whatever coordinates the writer's canvas
 * happens to use. A story whose scenes all sit in one row has zero height;
 * that axis collapses to 0.5 rather than dividing by zero, which draws the
 * row down the middle of the card — which is what a single row is.
 */
export function buildStoryShape(project: Project): StoryShape | null {
  if (project.scenes.length === 0) return null;

  const edgesBySource = new Map<string, string[]>();
  for (const scene of project.scenes) {
    const targets: string[] = [];
    for (const choice of extractChoices(scene.content as JSONContent)) {
      if (choice.targetSceneId) targets.push(choice.targetSceneId);
    }
    edgesBySource.set(scene.id, targets);
  }

  const sampled = sampleSceneIds(project, edgesBySource);
  const index = new Map<string, number>();
  sampled.forEach((id, i) => index.set(id, i));

  const positions = sampled.map((id) => {
    const scene = project.scenes.find((s) => s.id === id);
    return { x: scene?.position?.x ?? 0, y: scene?.position?.y ?? 0 };
  });

  // The bounding box includes the cards themselves, not just their
  // top-left corners — otherwise the rightmost card hangs off the edge of
  // its own drawing by a whole card width.
  const minX = Math.min(...positions.map((p) => p.x));
  const minY = Math.min(...positions.map((p) => p.y));
  const maxX = Math.max(...positions.map((p) => p.x)) + SCENE_NODE_WIDTH;
  const maxY = Math.max(...positions.map((p) => p.y)) + SCENE_NODE_HEIGHT;
  const spanX = maxX - minX;
  const spanY = maxY - minY;

  // One scale, the longer side. See SHAPE_FORMAT for why this is the
  // whole difference between a scale model and a different graph.
  const longest = Math.max(spanX, spanY);
  const scale = longest > 0 ? 1 / longest : 0;

  const nodes = positions.map((p) => ({
    x: round3((p.x - minX) * scale),
    y: round3((p.y - minY) * scale),
  }));

  const edges: [number, number][] = [];
  const written = new Set<string>();
  for (const [sourceId, targets] of edgesBySource) {
    const from = index.get(sourceId);
    if (from === undefined) continue;
    for (const targetId of targets) {
      const to = index.get(targetId);
      // A choice pointing at a scene outside the sample, or at nothing, is
      // simply not drawn; and one scene offering three choices to the same
      // next scene is one line, not three stacked on each other.
      if (to === undefined || to === from) continue;
      const key = `${from}>${to}`;
      if (written.has(key)) continue;
      written.add(key);
      edges.push([from, to]);
    }
  }

  const startId = project.startSceneId;
  return {
    v: SHAPE_FORMAT,
    nodes,
    edges,
    start: startId && index.has(startId) ? (index.get(startId) as number) : -1,
    total: project.scenes.length,
    w: round3(spanX * scale),
    h: round3(spanY * scale),
    node: {
      w: round5(SCENE_NODE_WIDTH * scale),
      h: round5(SCENE_NODE_HEIGHT * scale),
    },
  };
}

/**
 * The first prose of a scene, flattened to one line.
 *
 * Deliberately the OPENING rather than the tail, though the tail is the
 * sentence you actually stopped in the middle of. Two reasons, and the
 * second is the real one: the opening is what identifies the scene when
 * you are looking for it a week later, and the opening does not change
 * while you type, so the cached snapshot does not churn on every save.
 */
export function sceneExcerpt(content: JSONContent | undefined | null, limit = 140): string {
  if (!content) return "";
  const parts: string[] = [];

  /**
   * BLOCKS ARE SEPARATED (v0.53.1). The first version concatenated every
   * text node it found, so a scene of three paragraphs came out as
   * "...I don't know...But I know... We're in scene 2We are sooo in scene
   * 3" — two sentences welded at the seam, on the most prominent line of
   * the Welcome screen. A paragraph boundary is a space in flat text;
   * only INLINE runs (a bold word mid-sentence) join with nothing.
   */
  function walk(node: JSONContent, inline: boolean): void {
    if (parts.length > 400) return;
    if (typeof node.text === "string") {
      parts.push(node.text);
      return;
    }
    const children = node.content;
    if (!children) return;
    // A node whose children carry text directly is an inline container
    // (a paragraph, a heading); anything else is a stack of blocks.
    const childrenAreInline = children.some((c) => typeof c.text === "string");
    children.forEach((child, i) => {
      if (i > 0 && !childrenAreInline) parts.push(" ");
      walk(child, childrenAreInline);
    });
    void inline;
  }
  walk(content, false);

  const flat = parts.join("").replace(/\s+/g, " ").trim();
  if (flat.length <= limit) return flat;
  // Cut on a word boundary when there is one nearby, so the excerpt ends
  // mid-sentence rather than mid-word.
  const cut = flat.slice(0, limit);
  const space = cut.lastIndexOf(" ");
  return (space > limit - 24 ? cut.slice(0, space) : cut).trimEnd();
}

/** The name of the group a scene sits in, or null when it sits loose. */
export function sceneGroupName(project: Project, sceneId: string): string | null {
  const node = project.content.find((n) => n.id === sceneId);
  if (!node || !node.parentId) return null;
  const parent = project.content.find((n) => n.id === node.parentId);
  return parent && parent.kind === "folder" ? parent.name : null;
}

/* ── What the writer was in the middle of (v0.54.0) ──────────────────── */

/**
 * The kinds of page the hero can name.
 *
 * Mirrors `EntityKind` plus scenes, and it is a string on the stored
 * record rather than a boolean pair because Notes and Assets are expected
 * to join as further entity kinds (see types/entities.ts) — a
 * `isCharacter` flag would have to be replaced the day they do.
 */
export type ResumeKind = "scene" | "character" | "location";

export interface ResumeSnapshot {
  kind: ResumeKind;
  /**
   * The scene's or entity's id, so "Continue" can put the writer back on
   * the page the hero is naming (v0.55.0). Absent on anything written
   * before that, and never trusted on the way back in: a page can be
   * deleted between two launches, so the id is checked against the story
   * that was actually loaded — see `landingFor`.
   */
  id: string | null;
  /** The scene's title, or the entity's name. */
  title: string;
  /** The opening of its page. */
  excerpt: string;
  /** Where it sits — a scene's group. Entities have none. */
  context: string | null;
  at: string;
}

/**
 * What the writer had open when the project was last saved.
 *
 * SCENES ARE NOT THE ONLY THING YOU WORK ON (v0.54.0). Until now this
 * read `selectedSceneId` and nothing else, so an afternoon spent on a
 * character or a location ended with a Welcome screen that had no "where
 * you left off" at all — the app quietly deciding that those hours were
 * not work. A Character and a Location are the same object as a Scene
 * with a different `kind`, each with a page written in the same editor,
 * so there was nothing to build for them but the decision to look.
 *
 * Only one of the two ids is ever set — `selectScene` and `selectEntity`
 * each clear the other, because one document is open at a time — so the
 * entity is checked first and the scene is the fallback rather than the
 * two being ranked against each other.
 */
export function buildResume(
  project: Project,
  selectedSceneId: string | null,
  selectedEntityId: string | null,
): ResumeSnapshot | null {
  const entity = selectedEntityId
    ? project.entities.find((e) => e.id === selectedEntityId)
    : undefined;
  if (entity) {
    return {
      kind: entity.kind,
      id: entity.id,
      title: entity.name,
      excerpt: sceneExcerpt(entity.content),
      context: null,
      at: new Date().toISOString(),
    };
  }

  const scene = selectedSceneId
    ? project.scenes.find((s) => s.id === selectedSceneId)
    : undefined;
  if (!scene) return null;

  return {
    kind: "scene",
    id: scene.id,
    title: scene.title,
    excerpt: sceneExcerpt(scene.content),
    context: sceneGroupName(project, scene.id),
    at: new Date().toISOString(),
  };
}

/**
 * Reads back whatever version of the record is on disk.
 *
 * A resume written before v0.54.0 has `sceneTitle` and `groupName` and no
 * `kind` — and it described a scene, because a scene was the only thing
 * that could be recorded. So it is read as one rather than discarded:
 * unlike the cached shape, nothing about the old fields is WRONG, only
 * narrower, and the next save writes the current shape over it.
 */
export function readResume(stored: unknown): ResumeSnapshot | null {
  const r = stored as Partial<ResumeSnapshot> & { sceneTitle?: string; groupName?: string | null };
  if (!r || typeof r !== "object") return null;

  const title = typeof r.title === "string" ? r.title : r.sceneTitle;
  if (typeof title !== "string") return null;

  const kind: ResumeKind =
    r.kind === "character" || r.kind === "location" || r.kind === "scene" ? r.kind : "scene";

  return {
    kind,
    id: typeof r.id === "string" ? r.id : null,
    title,
    excerpt: typeof r.excerpt === "string" ? r.excerpt : "",
    context: typeof r.context === "string" ? r.context : (r.groupName ?? null),
    at: typeof r.at === "string" ? r.at : "",
  };
}

/** What the hero calls each kind. Characters and Locations use the app's own words. */
export const RESUME_LABEL: Record<ResumeKind, string> = {
  scene: "Scene",
  character: "Character",
  location: "Location",
};

/**
 * Where opening a project should LAND (v0.55.0).
 *
 * The Welcome screen's hero says "where you left off" and names a scene,
 * a character or a location — and until now `Continue` opened the story
 * at its start scene, so the screen made a promise on the most-repeated
 * action in the app and then broke it. It now carries the page it named.
 *
 * The id is checked against the project that was actually loaded rather
 * than trusted. A page can be deleted, or the file can have been edited
 * by another copy of the app, between the save that wrote this record and
 * the launch that reads it — and landing on nothing is worse than landing
 * on the start scene, because the editor would open on a blank document
 * the writer cannot account for.
 *
 * With no target at all — opening a story from its card, or from the file
 * dialog — the answer is the start scene, which is what opening a STORY
 * has always meant. The distinction is the point: a card says "open this
 * story", the hero says "go back to this page".
 */
export function landingFor(
  project: Project,
  target: { kind: ResumeKind; id: string | null } | null | undefined,
): { selectedSceneId: string | null; selectedEntityId: string | null } {
  const fallback = {
    selectedSceneId: project.startSceneId ?? project.scenes[0]?.id ?? null,
    selectedEntityId: null,
  };
  if (!target?.id) return fallback;

  if (target.kind === "scene") {
    return project.scenes.some((s) => s.id === target.id)
      ? { selectedSceneId: target.id, selectedEntityId: null }
      : fallback;
  }
  return project.entities.some((e) => e.id === target.id)
    ? { selectedSceneId: null, selectedEntityId: target.id }
    : fallback;
}
