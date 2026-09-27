import { useEffect, useMemo, useState } from "react";
import { useProjectStore } from "../../state/projectStore";
import { NewProjectDialog } from "./NewProjectDialog";
import { StoryMap } from "./StoryMap";
import { useShapeBackfill } from "./useShapeBackfill";
import { BrandMark } from "../common/BrandMark";
import { Button } from "../common/Button";
import { VersionTag } from "../common/VersionTag";
import { RESUME_LABEL, readResume } from "../../utils/recentShape";
import type { ResumeKind, StoryShape } from "../../utils/recentShape";

interface RecentEntry {
  name: string;
  filePath: string;
  lastOpened: string;
  shape?: StoryShape | null;
  resume?: { sceneTitle: string; excerpt: string; groupName: string | null; at: string } | null;
  missing?: boolean;
}

/**
 * The Welcome screen (rebuilt in v0.53.0).
 *
 * What it replaced: a 448px column dead centre in a 1280×800 window, about
 * 85% of it flat `--bg`, using none of the app's own vocabulary — no sheet,
 * no elevation, and the loudest thing in each recent row was a file path.
 * A stranger's first thirty seconds ended at "No recent projects yet.",
 * which is a dead end on the one screen where "write stories, not syntax"
 * applies most directly.
 *
 * ONE SCREEN IN THREE STATES, not three screens. The frame — wordmark,
 * search, Open Project…, New Project — is identical whether you have
 * nought stories or ninety, and only the area below it changes. That is
 * what makes this a screen that grows with the writer: nothing you learned
 * on day one has moved by day thirty. What changes is what the hero slot
 * MEANS: on an empty shelf the next thing is "see what this is"; after
 * that it is "keep writing".
 *
 * The maps are the reason the rebuild was worth doing. A writer with nine
 * stories does not recognise one by its name — they recognise it by
 * whether it fans out early, runs as a spine, or loops. See StoryMap, and
 * utils/recentShape.ts for what it costs to know a story's shape without
 * opening it.
 */
export function WelcomeScreen() {
  const recentProjects = useProjectStore((s) => s.recentProjects) as RecentEntry[];
  const loadRecent = useProjectStore((s) => s.loadRecent);
  const openProject = useProjectStore((s) => s.openProject);
  const openRecentProject = useProjectStore((s) => s.openRecentProject);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  // Stories saved before this app cached a shape get their maps drawn
  // here, once, in the background — see useShapeBackfill.
  useShapeBackfill(recentProjects, (list) =>
    useProjectStore.setState({ recentProjects: list as typeof recentProjects }),
  );

  const needle = query.trim().toLowerCase();
  const searching = recentProjects.length > 0 && needle.length > 0;

  const { matches, rest } = useMemo(() => {
    if (!searching) return { matches: recentProjects, rest: [] as RecentEntry[] };
    const hit: RecentEntry[] = [];
    const miss: RecentEntry[] = [];
    for (const entry of recentProjects) {
      (entry.name.toLowerCase().includes(needle) ? hit : miss).push(entry);
    }
    return { matches: hit, rest: miss };
  }, [recentProjects, searching, needle]);

  // The hero is the story you were last in, and only when the app actually
  // knows what you were doing in it. A project last saved by an older
  // version has no `resume`, so it takes its place in the grid like any
  // other rather than being given a hero slot with nothing to put in it.
  const hero = !searching && recentProjects[0]?.resume ? recentProjects[0] : null;
  /**
   * THE SHELF IS THE WHOLE SHELF (v0.53.3).
   *
   * The hero used to be cut out of the grid, so the story you were last
   * in was the one story you could not see on a screen headed "your
   * stories" — a list that silently omits its most recent member, under a
   * heading that has to apologise for it ("your OTHER stories"). The hero
   * and the card are not two listings of the same thing: the hero is a
   * shortcut back to a scene, and the card is the story taking its place
   * on the shelf. Both belong.
   */
  const grid = recentProjects;

  return (
    <div
      data-screen="welcome"
      // Which of the three states this is — the empty one is the screen a
      // returning writer must never be shown, and v0.62.0 exists because
      // they were (see hooks/useBoot.ts).
      data-welcome={recentProjects.length === 0 ? "empty" : "stories"}
      className="scriare-welcome flex h-screen w-screen flex-col bg-[var(--bg)] text-[var(--text)]"
    >
      <header className="flex-shrink-0 border-b border-[var(--border-soft)] px-8 py-4">
        {/*
          The frame is full-bleed; its CONTENTS sit in the same centred
          column as everything below, so the wordmark lines up with the
          first card and New Project lines up with the last one. Before
          this the header was pinned to the window's own edges and the
          content was not, which on a wide window reads as two unrelated
          screens stacked (v0.53.1).
        */}
        <div className="mx-auto flex w-full max-w-[var(--welcome-column)] items-center gap-3">
        <BrandMark className="h-7 w-7 flex-shrink-0" />
        <span className="font-serif-narrative text-xl italic text-[var(--text)]">Scriare</span>
        {/* Attached to the wordmark, not floating in the header: it is the
            version OF that name, and it reads as one thing (v0.63.0). */}
        <VersionTag className="-ml-1.5 self-end pb-1" />

        <div className="ml-5 flex w-[250px] items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-3)"
            strokeWidth={2}
            strokeLinecap="round"
            aria-hidden
            className="flex-shrink-0"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
          <label htmlFor="welcome-find" className="sr-only">
            Find a story
          </label>
          {/*
            ALWAYS HERE, never "turned on later". A search field that
            appears once you cross some number of stories is a control you
            have to discover twice; one that is always in the same place is
            learned on the day you have one story and used on the day you
            have thirty.
          */}
          <input
            id="welcome-find"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a story"
            className="min-w-0 flex-grow border-0 bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-3)]"
          />
        </div>

        <div className="flex-grow" />
        {/* The same two buttons as every dialog footer, at the same size —
            this header used px-3.5/px-4 and nothing else in the app did. */}
        <Button intent="secondary" onClick={() => void openProject()}>
          Open Project…
        </Button>
        <Button intent="primary" onClick={() => setShowNewProjectDialog(true)}>
          New Project
        </Button>
        </div>
      </header>

      {recentProjects.length === 0 ? (
        <EmptyShelf onStart={() => setShowNewProjectDialog(true)} />
      ) : (
        <main className="flex-grow overflow-y-auto px-8 pb-12 pt-7">
          <div className="mx-auto flex w-full max-w-[var(--welcome-column)] flex-col">
          {searching ? (
            <SearchResults
              needle={query.trim()}
              matches={matches}
              rest={rest}
              total={recentProjects.length}
              onOpen={openRecentProject}
            />
          ) : (
            <>
              {hero && <ResumeHero entry={hero} onOpen={openRecentProject} />}
              {/*
                One heading, and it says what is under it. There is no
                "other" case any more: this branch only renders when there
                is at least one story, and every one of them is here.
              */}
              <h2 className="scriare-section-label mb-3.5 mt-6 text-[var(--text-3)]">
                Your stories
              </h2>
              <StoryGrid entries={grid} onOpen={openRecentProject} />
            </>
          )}
          </div>
        </main>
      )}

      {showNewProjectDialog && (
        <NewProjectDialog onClose={() => setShowNewProjectDialog(false)} />
      )}
    </div>
  );
}

/**
 * The shape drawn on the empty shelf.
 *
 * An ILLUSTRATION, not a story you can open — which is why the card it
 * sits in is not a button. Scriare does not ship a demo project yet (it is
 * a launch item, and its prose is the writer's to write), and a card that
 * looks openable and opens nothing is worse on a stranger's first screen
 * than no card at all. When the demo story exists this becomes its card,
 * with its real cached shape: the drawing and the layout are already
 * right, and only the click changes.
 *
 * Positions are in the unit square, same as a cached shape — so this is
 * drawn by exactly the code that draws a real story, and cannot drift into
 * looking like something the app does not produce.
 */
const ILLUSTRATION: StoryShape = {
  v: 2,
  // Five columns 280 canvas units apart, rows 120 apart — the spacing a
  // real story gets from Auto Layout, so the illustration is a story
  // somebody could actually have laid out rather than a decoration.
  // Expressed in the cached format's own units: 1.0 is the longer side of
  // the bounding box, and the scene cards are in those units too.
  nodes: [
    { x: 0, y: 0.154 },
    { x: 0.215, y: 0.154 },
    { x: 0.431, y: 0.062 },
    { x: 0.431, y: 0.246 },
    { x: 0.646, y: 0.062 },
    { x: 0.646, y: 0.246 },
    { x: 0.862, y: 0 },
    { x: 0.862, y: 0.154 },
    { x: 0.862, y: 0.308 },
  ],
  edges: [
    [0, 1],
    [1, 2],
    [1, 3],
    [2, 4],
    [3, 5],
    [4, 6],
    [4, 7],
    [5, 7],
    [5, 8],
  ],
  start: 0,
  total: 9,
  w: 1,
  h: 0.351,
  node: { w: 0.138, h: 0.043 },
};

function EmptyShelf({ onStart }: { onStart: () => void }) {
  return (
    <main className="flex flex-grow flex-col justify-center px-8">
      <div className="mx-auto w-full max-w-[var(--welcome-column)]">
      <div className="mb-8 max-w-[620px]">
        {/*
          The whole pitch in four words. The two lines under it answer the
          only two questions a stranger has — what does it do, and where
          does my work live — and then the screen stops talking.
        */}
        <h1 className="font-serif-narrative mb-3 text-[42px] italic leading-[1.1] text-[var(--text)]">
          Write stories, not syntax.
        </h1>
        <p className="mb-2 text-[15px] leading-relaxed text-[var(--text-2)]">
          You write the scenes. The map draws itself.
        </p>
        <p className="text-[13px] leading-normal text-[var(--text-3)]">
          Your stories stay on your disk.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-raised)]">
          <div className="border-b border-[var(--border-soft)] bg-[var(--bg)]">
            <StoryMap shape={ILLUSTRATION} height={150} />
          </div>
          <div className="px-5 pb-5 pt-4">
            <div className="text-[17px] font-medium text-[var(--text)]">This is a story here</div>
            <div className="mt-1.5 text-[13px] leading-normal text-[var(--text-3)]">
              Scenes read left to right; every choice is a line to somewhere. You write the prose —
              the map is drawn for you.
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onStart}
          className="flex flex-col rounded-xl bg-[var(--accent)] p-6 text-left text-[var(--accent-text-on)] shadow-[var(--shadow-raised)] transition-colors hover:bg-[var(--accent-hover)]"
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span className="flex-grow" />
          <span className="text-[19px] font-medium">Start a story</span>
          <span className="mt-1.5 text-[13px] leading-normal opacity-80">
            One scene, one choice. You can be writing in about ten seconds.
          </span>
        </button>
      </div>
      </div>
    </main>
  );
}

/**
 * "Where you left off" — the sentence you stopped in, not the file you
 * stopped in.
 *
 * Every editor worth the comparison opens on the thing you were doing:
 * VS Code reopens the file, Scrivener the document, every DAW the session.
 * Scriare already knows which scene was selected when it last saved, so
 * the hero can name the SCENE — and it is deliberately the first thing the
 * keyboard reaches, so the whole gesture is: launch, Enter, you are back.
 */
function ResumeHero({
  entry,
  onOpen,
}: {
  entry: RecentEntry;
  onOpen: (p: string, target?: { kind: ResumeKind; id: string | null } | null) => void;
}) {
  const resume = readResume(entry.resume);
  if (!resume) return null;
  const where = [entry.name, resume.context, sinceLabel(resume.at)]
    .filter(Boolean)
    .join(" · ");
  const kind = RESUME_LABEL[resume.kind];

  return (
    <button
      type="button"
      autoFocus
      /*
        The hero carries the page it named (v0.55.0). Until then this
        opened the story at its start scene, so the one line on this
        screen that makes a promise — "where you left off" — broke it on
        the most-repeated action in the app. A story CARD still passes
        nothing and still lands on the start scene: a card says "open this
        story", the hero says "go back to this page".
      */
      onClick={() => void onOpen(entry.filePath, { kind: resume.kind, id: resume.id })}
      aria-label={`Continue: ${resume.title}, a ${kind.toLowerCase()} in ${entry.name}`}
      /* Same UA `align-items: center` on <button>: without this the
         accent rail below has no height and never appears at all. */
      className="scriare-resume-hero flex w-full flex-shrink-0 items-stretch overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-left"
    >
      <span className="w-1 flex-shrink-0 bg-[var(--accent)]" />
      <span className="flex flex-grow items-center gap-7 px-6 py-5">
        <span className="min-w-0 flex-grow">
          <span className="scriare-section-label block text-[var(--text-3)]">Where you left off</span>
          <span className="font-serif-narrative mt-2 block truncate text-[25px] italic leading-tight text-[var(--text)]">
            {resume.title || `Untitled ${kind.toLowerCase()}`}
          </span>
          {/*
            WHICH KIND OF PAGE, on its own line under the name (v0.54.0).
            Beside the name was the other candidate and lost on two
            counts: a bordered chip is a component that exists nowhere
            else in the app, and setting a rectangular uppercase box
            against a 25px serif italic — the one place on this screen
            where the type is doing the work — reads as pinned on. This
            reuses the label the app already uses everywhere to say what
            a thing is, and it leaves the title's line to the title,
            which matters when a name is long.
          */}
          <span className="mt-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--text-3)]">
            <KindIcon kind={resume.kind} />
            {kind}
          </span>
          {resume.excerpt && (
            <span className="font-serif-narrative mt-2 block max-w-[640px] truncate text-[15px] leading-relaxed text-[var(--text-2)]">
              {resume.excerpt}
            </span>
          )}
          <span className="mt-2.5 block truncate text-xs text-[var(--text-3)]">{where}</span>
        </span>
        {/* A <span>, not the kit's Button: it sits INSIDE the hero's own
            button, and a button inside a button is invalid markup. Its
            metrics are its own for the same reason the hero is its own
            thing — see the note on ButtonSize. */}
        <span className="flex flex-shrink-0 items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-3 text-sm font-medium text-[var(--accent-text-on)]">
          Continue
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M5 12h13M13 6l6 6-6 6" />
          </svg>
        </span>
      </span>
    </button>
  );
}

function SearchResults({
  needle,
  matches,
  rest,
  total,
  onOpen,
}: {
  needle: string;
  matches: RecentEntry[];
  rest: RecentEntry[];
  total: number;
  onOpen: (p: string) => void;
}) {
  return (
    <>
      <div className="mb-3.5 flex items-baseline gap-3">
        <h2 className="scriare-section-label text-[var(--text-3)]">Matching “{needle}”</h2>
        {/*
          Announced, not just drawn. Filtering a list by typing changes the
          page under someone who cannot see it change; the count is the one
          sentence that says what happened.
        */}
        <span aria-live="polite" className="text-xs text-[var(--text-3)]">
          {matches.length === 0
            ? `No stories match “${needle}”`
            : `${matches.length} of ${total} ${total === 1 ? "story" : "stories"}`}
        </span>
      </div>

      {matches.length > 0 && <StoryGrid entries={matches} onOpen={onOpen} />}

      {rest.length > 0 && (
        <>
          <h2 className="scriare-section-label mb-3.5 mt-6 text-[var(--text-3)]">Everything else</h2>
          {/*
            DIFFERENT BY FORM, NOT BY BEING FADED. The first draft of this
            dimmed the non-matching list to 50% opacity, which was wrong
            twice over: it taxed the contrast of a third of the screen for
            every reader, and it said "less important" about stories that
            are only "not what you typed". A rule-separated row with no
            map, no card and no shadow carries the same meaning at full
            legibility — and the map is the point, since a map is for
            recognising the story you are hunting, not for decorating the
            ones you are not.
          */}
          <ul className="grid gap-x-10 [grid-template-columns:repeat(auto-fill,minmax(272px,1fr))]">
            {rest.map((entry) => (
              <li key={entry.filePath}>
                <button
                  type="button"
                  onClick={() => void onOpen(entry.filePath)}
                  aria-label={ariaFor(entry)}
                  title={entry.filePath}
                  className="scriare-story-row flex w-full items-baseline gap-2.5 rounded-md border-t border-[var(--border-soft)] px-2 py-2.5 text-left"
                >
                  {entry.missing && <MissingIcon />}
                  <span className="min-w-0 flex-grow truncate text-sm font-medium text-[var(--text)]">
                    {entry.name}
                  </span>
                  <span
                    className={`flex-shrink-0 text-xs ${
                      entry.missing ? "text-[var(--warning)]" : "text-[var(--text-3)]"
                    }`}
                  >
                    {metaFor(entry)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function StoryGrid({ entries, onOpen }: { entries: RecentEntry[]; onOpen: (p: string) => void }) {
  return (
    /*
      auto-fill, not three fixed columns (v0.53.1). A card has a size it
      wants to be — wide enough for a legible map, narrow enough to scan
      several at once — and the number per row follows the window. Three
      fixed columns meant a 620px card on a wide monitor with a 370px
      drawing stranded in the middle of it.
    */
    <ul className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(272px,1fr))]">
      {entries.map((entry) => (
        <li key={entry.filePath}>
          <button
            type="button"
            onClick={() => void onOpen(entry.filePath)}
            aria-label={ariaFor(entry)}
            title={entry.filePath}
            /*
              A card is lifted the way a scene card on the Story Graph is
              lifted — the same --lift-node shadow and lit top edge — so
              the thing you click here and the thing it is a picture of
              are made of the same material.
            */
            /*
              `items-stretch` is not decoration. The UA stylesheet sets
              `align-items: center` on <button>, so a block child of a flex
              button is sized to its CONTENT rather than stretched — which
              made the map panel 0px wide, and the map fell back to its
              own intrinsic size and sat in a stripe inside a wider card.
              That was the "it doesn't resize" bug.
            */
            className="scriare-story-card flex w-full flex-col items-stretch overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] text-left"
          >
            <span className="block border-b border-[var(--border-soft)] bg-[var(--bg)]">
              <StoryMap shape={entry.shape} height={100} />
            </span>
            <span className="flex items-baseline gap-2.5 px-4 pb-3.5 pt-3">
              {entry.missing && <MissingIcon />}
              <span className="min-w-0 flex-grow truncate text-[15px] font-medium text-[var(--text)]">
                {entry.name}
              </span>
              <span
                className={`flex-shrink-0 text-xs ${
                  entry.missing ? "text-[var(--warning)]" : "text-[var(--text-3)]"
                }`}
              >
                {metaFor(entry)}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * What kind of page the hero is naming.
 *
 * Drawn rather than lettered — a scene, a character and a location are
 * told apart at a glance by shape, and the word beside it carries the
 * meaning for anyone the shape does not reach. Stroke SVG at the same
 * weight as every other icon in the app; no emoji anywhere near a
 * writer's own words.
 */
function KindIcon({ kind }: { kind: ResumeKind }) {
  const common = {
    width: 12,
    height: 12,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className: "flex-shrink-0",
  };
  if (kind === "character") {
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="3.4" />
        <path d="M5.2 20.5c0-3.5 3-6.1 6.8-6.1s6.8 2.6 6.8 6.1" />
      </svg>
    );
  }
  if (kind === "location") {
    return (
      <svg {...common}>
        <path d="M12 21.2s6.6-6.1 6.6-10.7a6.6 6.6 0 1 0-13.2 0c0 4.6 6.6 10.7 6.6 10.7z" />
        <circle cx="12" cy="10.2" r="2.4" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M6 2.5h7l5 5v14H6z" />
      <path d="M13 2.5v5h5" />
    </svg>
  );
}

/**
 * A story whose file has moved is told apart by an icon AND by its own
 * words — never by being greyer. Colour alone is not a difference everyone
 * can see, and "this one is dimmer" is not a sentence.
 */
function MissingIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--warning)"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden
      className="flex-shrink-0 self-center"
    >
      <path d="M12 8v5M12 17h.01" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

function metaFor(entry: RecentEntry): string {
  if (entry.missing) return "Can’t find this file";
  const total = entry.shape?.total;
  if (typeof total === "number" && total > 0) {
    return `${total} ${total === 1 ? "scene" : "scenes"}`;
  }
  return sinceLabel(entry.lastOpened);
}

function ariaFor(entry: RecentEntry): string {
  return entry.missing
    ? `${entry.name} — file not found`
    : `${entry.name}, ${metaFor(entry)}, opened ${sinceLabel(entry.lastOpened)}`;
}

/**
 * "yesterday", "last week" — not a timestamp.
 *
 * The question this answers is "which one of these is the one I mean",
 * and a date to the minute answers a question nobody is asking while
 * scanning nine cards. Deliberately coarse, and deliberately not
 * `Intl.RelativeTimeFormat`, whose "8 days ago" is less useful than "last
 * week" for exactly this job.
 */
export function sinceLabel(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "last week";
  if (days < 31) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 60) return "last month";
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return "over a year ago";
}
