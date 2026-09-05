import { nanoid } from "nanoid";
import type { JSONContent } from "@tiptap/react";
import { extractChoices, buildChoiceBlockNode, migrateLegacyChoiceBlocks } from "../utils/choiceBlocks";

export interface Choice {
  id: string;
  text: string;
  targetSceneId: string | null;
}

export interface Scene {
  id: string;
  title: string;
  content: JSONContent;
  summary?: string;
  tags?: string[];
  color?: string;
  /**
   * @deprecated Choices now live inside `content` as `choiceBlock` nodes.
   * Kept optional here only so older project files still type-check while
   * `normalizeProject()` migrates them; nothing writes to this anymore.
   */
  choices?: Choice[];
  position: { x: number; y: number };
  /** Which Frame (if any) this scene is currently grouped into, for the graph view only. */
  frameId?: string | null;
}

export interface Frame {
  id: string;
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

/**
 * The Content Browser's categories. Only "story" has real content today —
 * the rest exist so the same tree/UI can grow into them later without a
 * data-model change: adding a Character editor, for instance, means adding
 * a `refType: "character"` leaf and a new editor, not touching this file.
 */
export type ContentCategory = "story" | "characters" | "locations" | "notes" | "assets";

interface ContentNodeBase {
  id: string;
  category: ContentCategory;
  /** Parent folder's id, or null for a category root. */
  parentId: string | null;
  /** Sibling sort position within the same parent (0-based, no gaps required). */
  order: number;
  /** Reserved for future customization — unused by the MVP UI. */
  color?: string;
  icon?: string;
  tags?: string[];
}

/** Pure organization — a folder never holds data itself. */
export interface ContentFolder extends ContentNodeBase {
  kind: "folder";
  name: string;
}

/**
 * A reference to a real entity living elsewhere (a Scene in `project.scenes`
 * today; a Character/Location/Note/Asset once those exist). `id` always
 * equals the referenced entity's id, so a leaf is never duplicated data —
 * moving it around the tree only ever changes `parentId`/`order`.
 */
export interface ContentLeaf extends ContentNodeBase {
  kind: "leaf";
  refType: "scene";
}

export type ContentNode = ContentFolder | ContentLeaf;

/**
 * A reference-only favorite: never a copy, never a move. Any current or
 * future content type can be favorited just by adding an entry here with
 * its `refType` — nothing about this shape is Scene-specific.
 */
export interface Favorite {
  id: string;
  refType: "scene";
  refId: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  startSceneId: string | null;
  scenes: Scene[];
  frames: Frame[];
  content: ContentNode[];
  favorites: Favorite[];
}

export const EMPTY_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export function buildScene(title: string, index = 0): Scene {
  return {
    id: nanoid(),
    title,
    content: EMPTY_DOC,
    position: { x: 80 + index * 220, y: 120 },
    frameId: null,
  };
}

export function buildFrame(title: string, index = 0): Frame {
  return {
    id: nanoid(),
    title,
    position: { x: 60 + index * 40, y: 320 + index * 40 },
    size: { width: 360, height: 260 },
  };
}

export function buildProject(name: string): Project {
  const opening = buildScene("Opening", 0);
  const now = new Date().toISOString();
  return {
    id: nanoid(),
    name,
    createdAt: now,
    updatedAt: now,
    startSceneId: opening.id,
    scenes: [opening],
    frames: [],
    content: [
      { id: opening.id, kind: "leaf", category: "story", parentId: null, order: 0, refType: "scene" },
    ],
    favorites: [],
  };
}

/**
 * Fills in defaults for fields added in later versions of Scriare, so
 * project files saved by older versions keep opening correctly.
 */
export function normalizeProject(raw: Project): Project {
  const scenes = raw.scenes.map((scene) =>
    migrateChoicesIntoContent({
      ...scene,
      frameId: scene.frameId ?? null,
    }),
  );

  return {
    ...raw,
    frames: raw.frames ?? [],
    scenes,
    content: migrateContentTree(raw.content, scenes),
    favorites: raw.favorites ?? [],
  };
}

/**
 * Projects saved before v0.5.0 had no Content Browser tree at all — every
 * scene just lived in the flat `project.scenes` array. On load, give any
 * scene that isn't already referenced by a leaf a leaf at the Story root,
 * in their existing array order, so nothing goes missing from the browser.
 */
function migrateContentTree(rawContent: ContentNode[] | undefined, scenes: Scene[]): ContentNode[] {
  const content = rawContent ?? [];
  const referencedSceneIds = new Set(
    content.filter((n): n is ContentLeaf => n.kind === "leaf").map((n) => n.id),
  );
  const rootOrders = content
    .filter((n) => n.category === "story" && n.parentId === null)
    .map((n) => n.order);
  let nextRootOrder = rootOrders.length === 0 ? 0 : Math.max(...rootOrders) + 1;

  const missingLeaves: ContentLeaf[] = scenes
    .filter((scene) => !referencedSceneIds.has(scene.id))
    .map((scene) => ({
      id: scene.id,
      kind: "leaf",
      category: "story",
      parentId: null,
      order: nextRootOrder++,
      refType: "scene",
    }));

  return [...content, ...missingLeaves];
}

/**
 * Projects saved before v0.4.0 stored choices as a separate `scene.choices`
 * array, edited from the Inspector panel. Choices now live inside the
 * document itself as `choiceBlock` nodes, so on load we migrate any legacy
 * choices into the end of the scene's content (once — if the content
 * already has choice blocks, e.g. from a v0.4.0+ save, this is a no-op) and
 * drop the old field so nothing stale lingers around. Separately, a scene's
 * content may already have `choiceBlock` nodes in the pre-this-milestone
 * single-option shape (no `options` array) — those get upgraded first via
 * `migrateLegacyChoiceBlocks` so both migrations always leave the same,
 * current shape behind.
 */
function migrateChoicesIntoContent(scene: Scene): Scene {
  const { choices: legacyChoices, ...rest } = scene;
  let content = migrateLegacyChoiceBlocks(scene.content ?? EMPTY_DOC);

  if (legacyChoices && legacyChoices.length > 0 && extractChoices(content).length === 0) {
    content = {
      ...content,
      content: [
        ...(content.content ?? []),
        ...legacyChoices.map((choice) =>
          buildChoiceBlockNode([{ id: choice.id, text: choice.text, targetSceneId: choice.targetSceneId }]),
        ),
      ],
    };
  }

  return { ...rest, content };
}
