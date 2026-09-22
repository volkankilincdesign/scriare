import type { JSONContent } from "@tiptap/react";
import type { Project } from "../types/project";
import { MENTION_TYPE, mentionLabel } from "../types/entities";
import type { Entity } from "../types/entities";
import { CHOICE_BLOCK_TYPE, CHOICE_OPTION_TYPE } from "../types/nodeTypes";
import { foldedMatches } from "./textFold";

/** One occurrence of the query, somewhere a writer can be taken to. */
export interface FindHit {
  id: string;
  /** Which document it's in. Exactly one of these is set. */
  sceneId: string | null;
  entityId: string | null;
  /** The scene's title, or the entity's name — the row's heading. */
  where: string;
  /**
   * A line of prose, a choice's label, or an entity's own NAME.
   *
   * The name is here because nothing else searches it. A scene's title is
   * matched by the Content Browser's filter, which has always done that —
   * but that filter is scoped to the Story category, so a character called
   * Ercüment was findable in every line that mentions him and not by his
   * own name, which is the one search somebody would actually try.
   */
  kind: "prose" | "choice" | "name";
  /** Set for a choice hit, so the Inspector can be pointed at it. */
  blockId: string | null;
  /** The line the hit is in, trimmed to something that fits a panel. */
  snippet: string;
  /** Where the match sits inside `snippet`. */
  markStart: number;
  markEnd: number;
  /** ProseMirror positions in that document, for revealing the match. */
  from: number;
  to: number;
}

export interface FindResult {
  hits: FindHit[];
  /** True when the cap was reached and there are more matches than shown. */
  truncated: boolean;
}

/**
 * Hard cap. A three-letter query against a finished novel matches thousands
 * of times, and a list of thousands is not an answer to anything — it's a
 * frozen panel. The count is reported so the writer knows to narrow rather
 * than assuming they've seen everything.
 */
const MAX_HITS = 200;

/** How much of the line to show around a match. */
const SNIPPET_BEFORE = 32;
const SNIPPET_AFTER = 72;

/**
 * Find across the story (v0.38.0).
 *
 * Searches the stored documents rather than the live editor, which is what
 * makes it a STORY-wide search at all: only one scene is ever open in
 * ProseMirror, and the other forty are JSON in the store. The editor's own
 * copy is kept in step with the store on every keystroke, so the positions
 * computed here are valid in the editor the moment a scene is opened —
 * which is what lets clicking a result land the caret on the actual words.
 *
 * Those positions are computed by walking the JSON and adding up node sizes
 * exactly as ProseMirror does: a text node is its length, an atom is 1, and
 * a block is 2 plus its content. It's a small duplication of ProseMirror's
 * own arithmetic, and the alternative — mounting every scene in a headless
 * editor to ask it — would be orders of magnitude slower for an answer the
 * document already contains.
 *
 * Scene TITLES are not searched here. They're matched by the Content
 * Browser's own filter, which has always done that and shows them as
 * scenes rather than as lines; duplicating them into these results would
 * answer the same question twice in one panel.
 */
export function findInStory(project: Project | null, query: string): FindResult {
  const hits: FindHit[] = [];
  if (!project || query.trim().length === 0) return { hits, truncated: false };

  const entities = project.entities ?? [];
  let truncated = false;

  function collect(
    content: JSONContent | undefined | null,
    where: string,
    sceneId: string | null,
    entityId: string | null,
  ): void {
    if (truncated) return;
    for (const line of readLines(content, entities)) {
      for (const match of foldedMatches(line.text, query)) {
        if (hits.length >= MAX_HITS) {
          truncated = true;
          return;
        }
        const snippet = cutSnippet(line.text, match.start, match.end);
        hits.push({
          id: `${sceneId ?? entityId}:${line.key}:${match.start}`,
          sceneId,
          entityId,
          where,
          kind: line.kind,
          blockId: line.blockId,
          snippet: snippet.text,
          markStart: snippet.markStart,
          markEnd: snippet.markEnd,
          // The atom case is why these come from the per-character arrays
          // rather than from arithmetic on `match`: a mention contributes
          // several characters of text but occupies one position, so a
          // match that crosses one has a length in the document that has
          // nothing to do with its length on screen.
          from: line.starts[match.start],
          to: line.ends[match.end - 1],
        });
      }
      if (truncated) return;
    }
  }

  for (const scene of project.scenes) {
    collect(scene.content, scene.title || "Untitled scene", scene.id, null);
    if (truncated) break;
  }
  if (!truncated) {
    for (const entity of entities) {
      const shown = entity.name || "Unnamed";
      // The name and everything else it answers to: a writer who set up
      // "the doctor" as an alias is entitled to find her by it.
      for (const name of [entity.name, ...entity.aliases]) {
        if (!name.trim() || hits.length >= MAX_HITS) continue;
        if (foldedMatches(name, query).length === 0) continue;
        const match = foldedMatches(name, query)[0];
        hits.push({
          id: `name:${entity.id}:${name}`,
          sceneId: null,
          entityId: entity.id,
          where: shown,
          kind: "name",
          blockId: null,
          snippet: name,
          markStart: match.start,
          markEnd: match.end,
          // A name isn't at a position in a document — it's the page's
          // title. Clicking one opens the page; there is nothing to put a
          // caret on, and pretending otherwise would drop it at the top of
          // the body text as if that were the match.
          from: 0,
          to: 0,
        });
      }
      collect(entity.content, shown, null, entity.id);
      if (truncated) break;
    }
  }

  return { hits, truncated };
}

/** One searchable line: a paragraph, a heading, or a choice's label. */
interface Line {
  key: string;
  kind: "prose" | "choice";
  blockId: string | null;
  text: string;
  /** ProseMirror position of each character of `text`. */
  starts: number[];
  /** ProseMirror position just after each character of `text`. */
  ends: number[];
}

/**
 * Every textblock in a document, with its text and the position of each
 * character in it.
 *
 * A mention contributes the name a reader would SEE — resolved to the
 * entity's current name, the same as everywhere else — rather than nothing
 * at all. Searching for a character and not finding the lines she's named
 * in would be a strange kind of find, and it's the same omission that hid
 * her from the Story Graph until v0.37.0. Every one of her characters maps
 * to the single position the atom occupies, so selecting a match that
 * crosses a mention selects the whole name, which is the only selection
 * that exists for an atom anyway.
 */
function readLines(content: JSONContent | undefined | null, entities: Entity[]): Line[] {
  const lines: Line[] = [];
  if (!content) return lines;
  const byId = new Map(entities.map((e) => [e.id, e]));
  let counter = 0;

  function walk(node: JSONContent, pos: number, blockId: string | null): void {
    const type = node.type ?? "";
    const isChoice = type === CHOICE_OPTION_TYPE;
    const ownBlockId =
      type === CHOICE_BLOCK_TYPE ? ((node.attrs?.blockId as string) ?? null) : blockId;

    // A textblock: its children are inline, so this is a line.
    if (isChoice || type === "paragraph" || type === "heading") {
      const line: Line = {
        key: `l${(counter += 1)}`,
        kind: isChoice ? "choice" : "prose",
        blockId: isChoice ? ownBlockId : null,
        text: "",
        starts: [],
        ends: [],
      };
      let at = pos + 1;
      for (const child of node.content ?? []) {
        if (child.type === MENTION_TYPE) {
          const entity = byId.get((child.attrs?.entityId as string) ?? "");
          const label = mentionLabel(entity, (child.attrs?.label as string) ?? null);
          for (let i = 0; i < label.length; i += 1) {
            line.text += label[i];
            line.starts.push(at);
            line.ends.push(at + 1);
          }
          at += 1;
          continue;
        }
        if (typeof child.text === "string") {
          for (let i = 0; i < child.text.length; i += 1) {
            line.text += child.text[i];
            line.starts.push(at + i);
            line.ends.push(at + i + 1);
          }
          at += child.text.length;
          continue;
        }
        // Any other inline node (none today) still occupies its position.
        at += nodeSize(child);
      }
      if (line.text.length > 0) lines.push(line);
      return;
    }

    let at = pos + 1;
    for (const child of node.content ?? []) {
      walk(child, at, ownBlockId);
      at += nodeSize(child);
    }
  }

  // The doc node itself is not addressable; its children start at 0.
  let at = 0;
  for (const child of content.content ?? []) {
    walk(child, at, null);
    at += nodeSize(child);
  }
  return lines;
}

/**
 * ProseMirror's own arithmetic: text is its length, a LEAF is 1, and a node
 * with content is 2 + what it holds (an opening token and a closing one).
 *
 * The leaf case is what this got wrong until v0.49.0. It read "text is its
 * length, an atom is 1, a block is 2 + content", treated `mention` as the
 * only atom, and gave everything else `inner + 2` — but a leaf is size 1
 * whether or not it is a mention, and this schema has two more of them:
 * `horizontalRule` (the toolbar's Divider and the slash menu's) and
 * `hardBreak` (Shift+Enter). Each one made every position after it in the
 * document one too large, cumulatively. Measured, on
 * `<p>Before the line</p><hr><p>Second target here</p>` searching "target":
 * reported 27–33; the word is at 26–32.
 *
 * `useRevealMatch` feeds these straight into `setTextSelection`, and the
 * whole point of that hook is that the next thing typed replaces what it
 * selected — so in any scene containing a divider, clicking a Find result
 * handed the writer the wrong words to overwrite.
 *
 * Listed rather than inferred, because nothing in the JSON says "leaf": a
 * node with no `content` is an empty paragraph (size 2) just as often as a
 * divider (size 1), and the difference lives in the schema, not in the
 * document. Anything added to the schema as a leaf belongs here too.
 */
const LEAF_TYPES = new Set([MENTION_TYPE, "horizontalRule", "hardBreak"]);

function nodeSize(node: JSONContent): number {
  if (typeof node.text === "string") return node.text.length;
  if (node.type && LEAF_TYPES.has(node.type)) return 1;
  let inner = 0;
  for (const child of node.content ?? []) inner += nodeSize(child);
  return inner + 2;
}

/**
 * A window of the line around the match, with the match's offsets inside
 * it. More room after than before, because the words that explain a hit
 * are usually the ones that follow it.
 */
function cutSnippet(
  text: string,
  start: number,
  end: number,
): { text: string; markStart: number; markEnd: number } {
  const from = Math.max(0, start - SNIPPET_BEFORE);
  const to = Math.min(text.length, end + SNIPPET_AFTER);
  const head = from > 0 ? "…" : "";
  const tail = to < text.length ? "…" : "";
  return {
    text: `${head}${text.slice(from, to)}${tail}`,
    markStart: head.length + (start - from),
    markEnd: head.length + (end - from),
  };
}
