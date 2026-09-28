import { nanoid } from "nanoid";
import type { JSONContent } from "@tiptap/react";
import { extractChoices, buildChoiceBlockNode, migrateLegacyChoiceBlocks } from "../utils/choiceBlocks";
import { collectProjectKeys, stampContentIds } from "../utils/contentIds";
import { freshId, isCurrentIdShape, nameId } from "../utils/ids";
import { normalizeChoiceStyles } from "./choiceStyles";
import type { Entity, EntityKind } from "./entities";
import type { ChoiceStyle } from "./choiceStyles";
import type { Variable } from "./variables";

export interface Choice {
  id: string;
  text: string;
  targetSceneId: string | null;
}

export interface Scene {
  id: string;
  title: string;
  /**
   * The key the scene's TITLE takes in the spreadsheet export (v0.71.0).
   *
   * Stored rather than derived, and that is the whole point. A reader sees
   * the title as an `<h1>`, so it is a string to translate and needs a row
   * of its own — and that row needs an identity like any other. Deriving
   * it from the title would rename the key whenever the scene was renamed,
   * which is exactly the failure `docs/spreadsheet-export.md` warns about
   * one level up: an engine that groups by title decides that renaming
   * "Deniz In The Yard" to "The Yard" created a new scene full of new
   * lines.
   *
   * Named once from the title it had when the key was first needed, then
   * frozen. Optional so that every project written before this still
   * loads; `normalizeProject` fills it in on open.
   */
  titleKey?: string;
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
  /**
   * @deprecated v0.28.0 folded Frames into folders — a scene's group is now
   * simply the folder it sits in (its content node's `parentId`). Kept
   * optional so older project files still type-check while
   * `normalizeProject()` converts them; nothing writes to this anymore.
   */
  frameId?: string | null;
}

/**
 * @deprecated v0.28.0. Frames were a second way to group scenes, living
 * only on the canvas and knowing nothing about the Content Browser's
 * folders — so a scene could be in the Prologue folder and inside the
 * Ashfall frame at the same time, with neither answer wrong. Two
 * hierarchies over the same scenes don't stay parallel: every drag in the
 * graph made the panels disagree a little more, and only the writer knew
 * which one counted.
 *
 * A folder now carries the canvas rectangle itself (see
 * `ContentFolder.rect`), so the box you see in the graph and the folder you
 * see in the Content Browser are one object. This type survives only so
 * `normalizeProject` can read projects saved before that and convert each
 * frame into a folder.
 */
export interface Frame {
  id: string;
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

/** A folder's box on the Story Graph. */
export interface FolderRect {
  x: number;
  y: number;
  width: number;
  height: number;
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

/**
 * Pure organization — a group never holds data itself.
 *
 * NAMING: the writer-facing word is "Group" everywhere in the UI as of
 * v0.31.0. `kind: "folder"` stays in the data model because renaming it
 * would mean migrating every saved project to change a string nobody sees,
 * and a migration that can only break things and never fix one is not worth
 * running. The old word survives in identifiers (`createFolder`,
 * `folderSubtree`, `ContentFolder`) for the same reason; where it appears
 * in a string a person can read, it says Group.
 *
 * The rename followed the model rather than the other way round: folders
 * and graph groups were two names for one object from v0.28.0 on, and
 * calling it two things was the last place the old two-hierarchy split was
 * still visible.
 *
 * As of v0.28.0 a Story folder also carries how it's drawn on the Story
 * Graph. That looks like mixing presentation into structure, and it is —
 * but `Scene` has carried its own canvas `position` since v0.2.0 for
 * exactly the same reason, and the alternative (deriving each box from the
 * bounding rectangle of its scenes) makes a folder's box move whenever a
 * scene inside it moves, and lets two folders' boxes overlap through no
 * decision of the writer's. Owning the rectangle is what lets a chapter be
 * placed, sized, and folded as a thing in its own right.
 *
 * Both fields are optional: a folder with no `rect` simply isn't drawn on
 * the canvas (its scenes sit loose), which is what every folder from before
 * v0.28.0 starts as.
 */
export interface ContentFolder extends ContentNodeBase {
  kind: "folder";
  name: string;
  /** Where this folder's box sits on the Story Graph, if it's drawn there. */
  rect?: FolderRect;
  /** Folded to a single block on the graph, hiding everything inside it. */
  collapsed?: boolean;
}

/**
 * A reference to a real entity living elsewhere (a Scene in `project.scenes`
 * today; a Character/Location/Note/Asset once those exist). `id` always
 * equals the referenced entity's id, so a leaf is never duplicated data —
 * moving it around the tree only ever changes `parentId`/`order`.
 */
export interface ContentLeaf extends ContentNodeBase {
  kind: "leaf";
  /**
   * v0.35.0 widened this from `"scene"` to include entities, which is what
   * the comment above always said it would be. A leaf's `id` is the id of
   * the thing it refers to — a Scene in `project.scenes`, or an Entity in
   * `project.entities`.
   */
  refType: "scene" | EntityKind;
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
  /**
   * @deprecated v0.28.0 — see the `Frame` type. Read on load and converted
   * into folders by `normalizeProject`; never written, and absent from any
   * project saved by this version onward.
   */
  frames?: Frame[];
  content: ContentNode[];
  favorites: Favorite[];
  /**
   * Sprint 9A — the project's runtime state definitions. Variables belong
   * here, not on individual Scenes, because they're story-wide: any scene's
   * Choice Actions can reference any variable, and (from Sprint 9B on)
   * Conditions will need to read them regardless of which scene wrote to
   * them last. Future runtime entities (Characters, Locations, Inventory
   * items, ...) are expected to land as sibling arrays here, each with its
   * own dedicated manager UI — the same shape Variables establish now.
   */
  variables: Variable[];
  /**
   * v0.34.0 — named Choice Styles (see types/choiceStyles.ts). Project-wide
   * for the same reason variables are: a choice in any scene can wear any
   * style, and "what a dangerous choice looks like" is a fact about the
   * story, not about one scene. Always contains a Default style;
   * `normalizeChoiceStyles` guarantees that on load however old the file.
   */
  choiceStyles: ChoiceStyle[];
  /**
   * v0.35.0 — the story's people and places (see types/entities.ts). A
   * sibling array alongside `variables` and `choiceStyles`, exactly as the
   * note on `variables` predicted: an entity is project-wide, referenced
   * from any scene, and owns nothing about where it appears.
   */
  entities: Entity[];
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

/**
 * A Story folder that is drawn on the graph from the moment it exists —
 * what the graph's "+ Group" button makes. A folder created from the
 * Content Browser has no `rect` and simply isn't on the canvas until one
 * is given to it.
 *
 * The default size is roomy enough to hold a small cluster of scenes (a
 * couple of columns of SCENE_NODE_WIDTH cards with breathing room) rather
 * than forcing a resize before the group is usable — see the
 * FOLDER_MIN_WIDTH/HEIGHT comment in graphConstants.ts for the matching
 * floor on how small it can be dragged back down to.
 */
export function buildStoryFolder(
  name: string,
  parentId: string | null,
  order: number,
  rect?: FolderRect,
): ContentFolder {
  return {
    id: nanoid(),
    kind: "folder",
    category: "story",
    parentId,
    order,
    name,
    rect,
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
    content: [
      { id: opening.id, kind: "leaf", category: "story", parentId: null, order: 0, refType: "scene" },
    ],
    favorites: [],
    variables: [],
    choiceStyles: normalizeChoiceStyles(undefined),
    entities: [],
  };
}

/**
 * Fills in defaults for fields added in later versions of Scriare, so
 * project files saved by older versions keep opening correctly.
 */
export function normalizeProject(raw: Project): Project {
  // Every key the project ALREADY holds, before a single one is minted,
  // so the first scene's naming knows about the last scene's keys rather
  // than only about the scenes ahead of it.
  //
  // A SCENE'S OWN KEYS ARE LIFTED OUT WHILE IT IS PROCESSED. Leaving them
  // in makes every key look like a duplicate of itself, and the second
  // time a project was opened every line came back as `-2`. Found by the
  // idempotency check in choice-schema, which is the assertion that exists
  // precisely to catch a migration that will not sit still.
  const taken = collectProjectKeys(raw.scenes ?? []);
  const scenes = (raw.scenes ?? []).map((scene) => {
    const own = collectProjectKeys([scene]);
    for (const key of own) taken.delete(key);
    const migrated = migrateChoicesIntoContent({ ...scene }, taken);
    for (const key of collectProjectKeys([migrated])) taken.add(key);
    return migrated;
  });

  // Every scene's title row gets a key, named from the title and kept
  // even when the title changes. Uniqueness is across the project, so two
  // scenes called "The Yard" become `s_the-yard` and `s_the-yard-2`.
  const titleKeys = new Set(taken);
  const named = scenes.map((scene) => {
    if (isCurrentIdShape(scene.titleKey)) return scene;
    const key = nameId("scene", scene.title, titleKeys) ?? freshId("scene");
    titleKeys.add(key);
    return { ...scene, titleKey: key };
  });

  const content = migrateFramesIntoFolders(
    migrateContentTree(raw.content, named),
    raw.frames ?? [],
    named,
  );

  // Every scene's group is now its folder, so the old per-scene pointer is
  // dropped rather than left to rot alongside the truth.
  const cleanedScenes = named.map(({ frameId: _dropped, ...scene }) => scene);

  const { frames: _legacyFrames, ...rest } = raw;
  return {
    ...rest,
    scenes: cleanedScenes,
    content,
    favorites: raw.favorites ?? [],
    variables: raw.variables ?? [],
    choiceStyles: normalizeChoiceStyles(raw.choiceStyles),
    entities: raw.entities ?? [],
  };
}

/**
 * v0.28.0: turns every Frame from an older project into a real Story
 * folder carrying that frame's rectangle, and moves the scenes that were
 * inside it into that folder.
 *
 * Two rules keep this from quietly rearranging someone's story:
 *
 *  - A scene already filed in a folder is NOT moved. The Content Browser's
 *    tree is the structure the writer built deliberately, typed names and
 *    all; a frame was a box they dragged around a canvas. Where the two
 *    disagreed — which is the whole reason this migration exists — the
 *    folder wins, and the frame becomes an empty group they can delete or
 *    fill.
 *  - An empty frame becomes an empty folder rather than vanishing. It may
 *    be a chapter someone drew ahead of writing it, and silently deleting
 *    a named thing is never the right default.
 */
function migrateFramesIntoFolders(
  content: ContentNode[],
  frames: Frame[],
  scenes: Scene[],
): ContentNode[] {
  if (frames.length === 0) return content;

  const nodes = [...content];
  const byId = new Map(nodes.map((n, i) => [n.id, i]));
  const rootOrders = nodes
    .filter((n) => n.category === "story" && n.parentId === null)
    .map((n) => n.order);
  let nextOrderAtRoot = rootOrders.length === 0 ? 0 : Math.max(...rootOrders) + 1;

  for (const frame of frames) {
    const folder: ContentFolder = {
      id: frame.id,
      kind: "folder",
      category: "story",
      parentId: null,
      order: nextOrderAtRoot++,
      name: frame.title || "Group",
      rect: {
        x: frame.position.x,
        y: frame.position.y,
        width: frame.size.width,
        height: frame.size.height,
      },
    };
    nodes.push(folder);
    byId.set(folder.id, nodes.length - 1);

    let orderInFolder = 0;
    for (const scene of scenes) {
      if (scene.frameId !== frame.id) continue;
      const index = byId.get(scene.id);
      if (index === undefined) continue;
      const leaf = nodes[index];
      if (leaf.parentId !== null) continue; // already filed by hand — leave it
      nodes[index] = { ...leaf, parentId: folder.id, order: orderInFolder++ };
    }
  }

  return nodes;
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
function migrateChoicesIntoContent(scene: Scene, taken?: Set<string>): Scene {
  const { choices: legacyChoices, ...rest } = scene;
  // v0.66.0 — and every paragraph gets the key it will keep, in the same
  // pass, so a project is stamped exactly once however old it is.
  //
  // `taken` carries the keys every OTHER scene already holds (v0.71.0).
  // Without it each scene would be named in isolation and two scenes
  // opening on the same sentence would both claim `c_keep-working` —
  // measured at eleven collisions in The Blue Hour.
  let content = stampContentIds(migrateLegacyChoiceBlocks(scene.content ?? EMPTY_DOC), taken);

  if (legacyChoices && legacyChoices.length > 0 && extractChoices(content).length === 0) {
    content = {
      ...content,
      content: [
        ...(content.content ?? []),
        ...legacyChoices.map((choice) =>
          buildChoiceBlockNode([
            {
              id: choice.id,
              text: choice.text,
              targetSceneId: choice.targetSceneId,
              actions: [],
              conditions: [],
              whenUnmet: "hide",
            },
          ]),
        ),
      ],
    };
  }

  return { ...rest, content };
}
