/**
 * The first-launch tour's stops (v0.91.0).
 *
 * WHY THERE IS A TOUR NOW, when v0.81.0 argued there should not be. That
 * argument was a prediction — "a tour teaches procedure to somebody who
 * does not yet know why" — and the testers answered it. Most of them got
 * stuck in all four places this file covers: the first screen, how a story
 * branches, where things are, and what the app's nouns mean. v0.81.0's
 * point-of-use teaching stays (the blocks still explain themselves where
 * they are met, and How Scriare works is still a place rather than an
 * event); this is the outline that teaching was hanging off, and testers
 * did not have one.
 *
 * SIX STOPS, ONE PER REGION, his call: page, branching, details, map, your
 * story, Play. An outline, not a lesson — each stop is a sentence or two
 * about what a region is FOR, not how to operate it. Fewer steps was the
 * brief, and the stops that survive are the ones whose absence a tester
 * reported.
 *
 * THE WORDS ARE THE APP'S WORDS. Region names are written as the app labels
 * them (Inspector, Story Graph, Content, Play), and the three blocks' lines
 * come from the narrative-blocks registry — the same sentences the toolbar
 * tooltips, the slash menu and the blocks' own headers use. A tour that
 * calls something by a name the screen does not show is a second
 * vocabulary to learn, which is the problem it is meant to remove.
 */
import { STORY_BLOCKS } from "../narrativeBlocks/registry";

export interface TourStop {
  /** Stable id: tests and the progress dots point at this, not the index. */
  id: "page" | "blocks" | "inspector" | "graph" | "content" | "play";
  /**
   * What to light up. More than one selector means the UNION of their
   * boxes — the three block buttons are three siblings in a toolbar with no
   * wrapper of their own, and adding one would change how that toolbar
   * wraps (the v0.33.1 bug toolbar.spec.mjs still guards).
   */
  targets: string[];
  kicker: string;
  title: string;
  body?: string;
  /** Term → meaning pairs, drawn as a short definition list. */
  terms?: { term: string; meaning: string }[];
}

export const TOUR_STOPS: TourStop[] = [
  {
    id: "page",
    targets: ['[data-tour="page"]'],
    kicker: "The page",
    title: "A scene is a page. Just write.",
    body: "Everything a reader sees starts as prose here. There is no syntax to learn, and it saves as you type.",
  },
  {
    id: "blocks",
    targets: ["[data-insert-choice]", "[data-insert-dialogue]", "[data-insert-conditional]"],
    kicker: "Branching",
    title: "Three ways to branch",
    // From the registry, so the tour can never describe a block in words
    // the block's own tooltip does not use — and a fourth block type joins
    // this list the moment its sentence is written.
    terms: STORY_BLOCKS.map((b) => ({ term: b.title, meaning: b.description })),
  },
  {
    id: "inspector",
    targets: ['[data-tour="inspector"]'],
    kicker: "The Inspector",
    title: "Where a choice leads is set here",
    body: "Click a choice on the page and this panel opens on it. Pick the scene it leads to, or make a new one from the same list.",
  },
  {
    id: "graph",
    targets: ['[data-tour="graph"]'],
    kicker: "The Story Graph",
    title: "The map draws itself",
    body: "Every choice becomes a line between two scenes. You never draw one, you only write.",
  },
  {
    id: "content",
    targets: ['[data-tour="content"]'],
    kicker: "Content",
    title: "Everything in your story lives here",
    body: "Scenes, groups that work as chapters, the characters you mention with @, and notes only you can see.",
  },
  {
    id: "play",
    targets: ['[data-tour="play"]'],
    kicker: "Play",
    title: "Read it the way your reader will",
    body: "Play runs the story from the start, and Esc brings you back. That is the whole outline. The ? in the top bar has the rest, and this tour.",
  },
];
