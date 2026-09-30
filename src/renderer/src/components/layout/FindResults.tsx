import { useMemo, useState } from "react";
import { useProjectStore } from "../../state/projectStore";
import { useUIStore } from "../../state/uiStore";
import { useInspectorStore } from "../../state/inspectorStore";
import { findInStory } from "../../utils/findInStory";
import { isReplaceable, skipped } from "../../utils/replaceInStory";
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

  const replaceHits = useProjectStore((s) => s.replaceHits);
  const [replacement, setReplacement] = useState("");
  /**
   * Hits the writer has UNTICKED, by id.
   *
   * Held as exclusions rather than as a selection so that everything is
   * chosen by default: a writer who types a replacement and presses the
   * button means "all of them" far more often than "none of them", and a
   * list that starts empty makes the common case the laborious one.
   */
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const inStory = result.hits.filter((hit) => hit.sceneId);
  const onPages = result.hits.filter((hit) => hit.entityId);

  const replaceable = result.hits.filter(isReplaceable);
  const chosen = replaceable.filter((hit) => !excluded.has(hit.id));
  const left = skipped(result.hits);

  function toggle(hit: FindHit): void {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(hit.id)) next.delete(hit.id);
      else next.add(hit.id);
      return next;
    });
  }

  function runReplace(): void {
    if (!replacement || chosen.length === 0) return;
    replaceHits(chosen, replacement);
    // The query still matches whatever was NOT replaced, so the panel
    // refreshes itself from the store. The exclusions go: they were about
    // hits that no longer exist.
    setExcluded(new Set());
  }

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
      {/* THE REPLACE BAR (v0.79.0). Above the results rather than below,
          because what it does is about all of them and a control that acts
          on a list belongs at the head of it. */}
      <div className="mb-1.5 flex flex-col gap-1.5 px-2 pt-1">
        <div className="flex items-center gap-1.5">
          <input
            id="find-replace-with"
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            placeholder="Replace with…"
            data-replace-with
            className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
          />
          <button
            type="button"
            onClick={runReplace}
            disabled={!replacement || chosen.length === 0}
            data-replace-all
            title={
              chosen.length === 0
                ? "Nothing here can be replaced"
                : `Replace ${chosen.length} in one step — Ctrl+Z puts it all back`
            }
            className="shrink-0 rounded-md bg-[var(--accent-fill-strong)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-text-on)] transition-colors hover:bg-[var(--accent)] disabled:pointer-events-none disabled:bg-transparent disabled:text-[var(--border-faint)]"
          >
            Replace {chosen.length}
          </button>
        </div>
        {/* What Replace will NOT do, said before it is pressed rather than
            discovered afterwards. His wording, and the reason it is not
            "will not change": they WILL change — by renaming the
            character, which is the only thing that changes a mention. */}
        {left.mentions > 0 && (
          <p data-replace-skips className="text-[11px] leading-snug text-[var(--text-3)]">
            {left.mentions === 1
              ? "1 is a mention, not text. It follows the character\u2019s own name."
              : `${left.mentions} are mentions, not text. They follow the character\u2019s own name.`}
          </p>
        )}
        {left.names > 0 && (
          <p data-replace-skips-names className="text-[11px] leading-snug text-[var(--text-3)]">
            {left.names === 1
              ? "1 is a page\u2019s own name. Rename the page to change it."
              : `${left.names} are pages\u2019 own names. Rename the page to change them.`}
          </p>
        )}
      </div>

      <Section
        title="In the story"
        icon="scene"
        hits={inStory}
        onGo={go}
        replacement={replacement}
        excluded={excluded}
        onToggle={toggle}
      />
      <Section
        title="On pages"
        icon="character"
        hits={onPages}
        onGo={go}
        replacement={replacement}
        excluded={excluded}
        onToggle={toggle}
      />
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
  replacement,
  excluded,
  onToggle,
}: {
  title: string;
  icon: "scene" | "character";
  hits: FindHit[];
  onGo: (hit: FindHit) => void;
  replacement: string;
  excluded: Set<string>;
  onToggle: (hit: FindHit) => void;
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
          {group.hits.map((hit) => {
            const canReplace = isReplaceable(hit);
            const chosen = canReplace && !excluded.has(hit.id);
            return (
            <div key={hit.id} className="flex items-start gap-1">
              {/* One tick per hit, and only where there is something to
                  tick. A checkbox beside a mention would be a control that
                  does nothing, which is worse than no control. */}
              {canReplace ? (
                <input
                  type="checkbox"
                  id={`find-pick-${hit.id}`}
                  checked={chosen}
                  onChange={() => onToggle(hit)}
                  data-replace-pick
                  aria-label={`Replace this occurrence in ${hit.where}`}
                  className="mt-[7px] ml-2 shrink-0 accent-[var(--accent)]"
                />
              ) : (
                <span className="mt-[7px] ml-2 h-3 w-3 shrink-0" aria-hidden />
              )}
            <button
              type="button"
              data-find-hit={hit.kind}
              onClick={() => onGo(hit)}
              className="block min-w-0 flex-1 rounded-md px-2 py-1 text-left text-xs leading-snug text-[var(--text-3)] hover:bg-[var(--bg)] hover:text-[var(--text-2)]"
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
              {/* THE PREVIEW. With a replacement typed, a hit that is going
                  to change shows what it will become — the old words struck
                  through, the new ones in their place — so Replace All is
                  pressed by somebody who has already read the result. A hit
                  that is not going to change keeps its plain highlight, so
                  the list says at a glance which is which. */}
              {replacement && chosen ? (
                <>
                  {/* Struck through in the same grey as the text, NOT in
                      --danger. The first build of this used the danger
                      colour and it read as a warning: grep says --danger
                      is spoken everywhere else in the app by things that
                      destroy something — the danger items in the content
                      context menu, the remove buttons in the Dialogue
                      panel and the Inspector. Nothing here is dangerous.
                      A preview of a rename is not an alarm, and the app's
                      own rule is that colour is reserved for meaning the
                      writer assigned. The highlight on the NEW word is
                      already the whole signal; the old one only has to
                      get out of its way. */}
                  <span
                    data-replace-was
                    className="text-[var(--text-3)] line-through decoration-[var(--text-3)]"
                  >
                    {hit.snippet.slice(hit.markStart, hit.markEnd)}
                  </span>{" "}
                  <mark className="scriare-find-mark" data-replace-will>
                    {replacement}
                  </mark>
                </>
              ) : (
                <mark className="scriare-find-mark">
                  {hit.snippet.slice(hit.markStart, hit.markEnd)}
                </mark>
              )}
              {hit.snippet.slice(hit.markEnd)}
            </button>
            </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
