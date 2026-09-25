import { useMemo } from "react";
import { useProjectStore } from "../../state/projectStore";
import { useUIStore } from "../../state/uiStore";
import { useInspectorStore } from "../../state/inspectorStore";
import { findInStory } from "../../utils/findInStory";
import type { FindHit } from "../../utils/findInStory";
import { Icon } from "../common/Icon";

interface FindResultsProps {
  query: string;
}

/**
 * Find across the story (v0.38.0) — the results half.
 *
 * It lives under the Content Browser's existing search box rather than in
 * a window of its own, and that's the main decision in this file. Scriare
 * already had a box labelled "Search Story" that filtered the tree by
 * scene name. Adding a second search — a different box, a different
 * shortcut, a different panel — would have meant an app where "search"
 * means two things and the writer has to know which one they wanted before
 * they start typing. One box answers both questions instead: the tree
 * above says which scenes are CALLED this, these sections say where the
 * words actually APPEAR.
 *
 * The two sections exist for the same reason the results are grouped at
 * all. A line Harun speaks and a line of notes on Harun's own page are
 * different kinds of answer, and a flat list would let the second
 * masquerade as the first.
 */
export function FindResults({ query }: FindResultsProps) {
  const project = useProjectStore((s) => s.project);
  const selectScene = useProjectStore((s) => s.selectScene);
  const selectEntity = useProjectStore((s) => s.selectEntity);
  const requestReveal = useUIStore((s) => s.requestReveal);
  const selectTarget = useInspectorStore((s) => s.selectTarget);

  // Recomputed when the query or the project changes — which includes every
  // keystroke in the scene being edited. That's deliberate and cheap enough:
  // the walk is over plain JSON with no allocation per character beyond the
  // lines it finds, and a result list that went stale while you fixed the
  // thing it pointed at would be worse than the work saved.
  const result = useMemo(() => findInStory(project, query), [project, query]);

  const inStory = result.hits.filter((hit) => hit.sceneId);
  const onPages = result.hits.filter((hit) => hit.entityId);

  function go(hit: FindHit): void {
    if (hit.sceneId) {
      selectScene(hit.sceneId);
      // A choice is repaired in the Inspector, so land there as well as on
      // the words — the same landing Check Story makes.
      if (hit.blockId) {
        selectTarget({ kind: "choice", sceneId: hit.sceneId, blockId: hit.blockId });
      }
    } else if (hit.entityId) {
      selectEntity(hit.entityId);
    }
    // A name has no position to land on — opening the page IS the landing.
    if (hit.kind === "name") return;
    requestReveal({
      sceneId: hit.sceneId,
      entityId: hit.entityId,
      from: hit.from,
      to: hit.to,
    });
  }

  if (result.hits.length === 0) {
    return (
      <div className="px-2 py-2 text-sm text-[var(--text-3)]">
        Nothing in the writing either.
      </div>
    );
  }

  return (
    <div data-find-results>
      <Section title="In the story" icon="scene" hits={inStory} onGo={go} />
      <Section title="On pages" icon="character" hits={onPages} onGo={go} />
      {result.truncated && (
        <p className="px-2 py-2 text-[11px] text-[var(--text-3)]">
          Showing the first {result.hits.length}. Type a little more to narrow it.
        </p>
      )}
    </div>
  );
}

/** One group of hits, itself grouped by the document they're in. */
function Section({
  title,
  icon,
  hits,
  onGo,
}: {
  title: string;
  icon: "scene" | "character";
  hits: FindHit[];
  onGo: (hit: FindHit) => void;
}) {
  if (hits.length === 0) return null;

  // Grouped by document, in the order the hits came out — which is the
  // order of the story, since findInStory walks the scenes in order.
  const groups: { where: string; hits: FindHit[] }[] = [];
  for (const hit of hits) {
    const last = groups[groups.length - 1];
    if (last && last.where === hit.where) last.hits.push(hit);
    else groups.push({ where: hit.where, hits: [hit] });
  }

  return (
    <div className="mb-2">
      <div
        data-find-section={title}
        className="scriare-section-label flex items-baseline gap-1.5 px-2 py-1 text-[var(--text-3)]"
      >
        <span>{title}</span>
        <span className="font-normal tabular-nums">{hits.length}</span>
      </div>
      {groups.map((group) => (
        <div key={group.where} className="mb-1">
          <div className="flex items-center gap-1.5 px-2 py-0.5 text-xs text-[var(--text-2)]">
            <Icon name={icon} className="h-3 w-3 shrink-0 text-[var(--text-3)]" />
            <span className="min-w-0 truncate">{group.where}</span>
          </div>
          {group.hits.map((hit) => (
            <button
              key={hit.id}
              type="button"
              data-find-hit={hit.kind}
              onClick={() => onGo(hit)}
              className="block w-full rounded-md px-2 py-1 pl-6 text-left text-xs leading-snug text-[var(--text-3)] hover:bg-[var(--bg)] hover:text-[var(--text-2)]"
            >
              {/* A choice reads differently from a line of prose and is
                  repaired somewhere else, so it says which it is. */}
              {hit.kind === "choice" && (
                <span className="mr-1 text-[var(--accent)]" aria-hidden>
                  ↳
                </span>
              )}
              {/* A name is the page itself rather than a line on it, and
                  the two sitting in one list need telling apart. */}
              {hit.kind === "name" && (
                <span className="mr-1 text-[10px] uppercase tracking-wide text-[var(--text-3)]">
                  name
                </span>
              )}
              {hit.snippet.slice(0, hit.markStart)}
              <mark className="scriare-find-mark">
                {hit.snippet.slice(hit.markStart, hit.markEnd)}
              </mark>
              {hit.snippet.slice(hit.markEnd)}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
