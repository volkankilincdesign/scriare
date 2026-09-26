import type { JSONContent } from "@tiptap/react";
import type { Project } from "../types/project";
import { extractChoices } from "./choiceBlocks";

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
  /** Node positions in the unit square, rounded to three decimals. */
  nodes: { x: number; y: number }[];
  /** Edges as [fromIndex, toIndex] into `nodes`. */
  edges: [number, number][];
  /** Index of the start scene in `nodes`, or -1 when it was not sampled. */
  start: number;
  /** How many scenes the story actually has — `nodes.length` is the sample. */
  total: number;
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

  const xs = positions.map((p) => p.x);
  const ys = positions.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX;
  const spanY = maxY - minY;

  const nodes = positions.map((p) => ({
    x: spanX === 0 ? 0.5 : round3((p.x - minX) / spanX),
    y: spanY === 0 ? 0.5 : round3((p.y - minY) / spanY),
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
    nodes,
    edges,
    start: startId && index.has(startId) ? (index.get(startId) as number) : -1,
    total: project.scenes.length,
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
