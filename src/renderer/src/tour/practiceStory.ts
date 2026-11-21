import { buildProject } from "../types/project";
import type { Project, Scene } from "../types/project";
import { nanoid } from "nanoid";

/**
 * The practice story the first-launch tour runs on (v0.91.0).
 *
 * WHY A STORY AT ALL. Every stop of the tour points at something: a page
 * with prose on it, a choice the Inspector can be about, wires on the map,
 * rows in the Content panel. A brand-new project has one empty scene, so
 * four of the six stops would be pointing at nothing and asking the reader
 * to imagine it. Three scenes and one choice is the smallest story in which
 * every stop is true.
 *
 * IT IS THEIRS. A real project in their own Scriare folder, not a read-only
 * demo — the decision made on 30 Sep for the example story, for the same
 * reason: a story you cannot touch teaches you that this is a demo, and the
 * point is to show that writing here is easy. They can write in it, rename
 * it or delete it.
 *
 * NOT THE DEMO STORY. The demo story is Volkan's to write and is a launch
 * item; this is a scaffold small enough to read in ten seconds. The prose
 * is deliberately plain and has no names in it, so nothing here competes
 * with what a writer brings.
 */
export const PRACTICE_STORY_NAME = "My first story";

function paragraph(text: string) {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

function option(text: string, targetSceneId: string) {
  return {
    type: "choiceOption",
    attrs: {
      optionId: nanoid(),
      targetSceneId,
      actions: [],
      conditions: [],
      whenUnmet: "hide",
      lockReason: "",
      style: null,
      speaker: null,
    },
    content: [{ type: "text", text }],
  };
}

function scene(id: string, title: string, content: unknown[], x: number, y: number): Scene {
  return {
    id,
    title,
    content: { type: "doc", content } as Scene["content"],
    position: { x, y },
    frameId: null,
  };
}

/**
 * Positions are on the graph's 18px lattice and in Auto Layout's own
 * column rhythm, so the map the tour's fourth stop points at already looks
 * like something the app drew — one scene on the left, its two choices
 * fanning out to the right.
 */
export function buildPracticeProject(): Project {
  const base = buildProject(PRACTICE_STORY_NAME);
  const start = nanoid();
  const wait = nanoid();
  const walk = nanoid();

  const scenes: Scene[] = [
    scene(
      start,
      "The last train",
      [
        paragraph("The last train left an hour ago. The platform lamps hum, and the timetable has nothing more to say."),
        paragraph("Somewhere past the ticket office a dog barks twice, then stops."),
        {
          type: "choiceBlock",
          attrs: { blockId: nanoid() },
          content: [option("Wait for the night train", wait), option("Walk into town", walk)],
        },
      ],
      108,
      144,
    ),
    scene(
      wait,
      "The night train",
      [
        paragraph("Headlights, at last, low on the rails. The doors open on an empty carriage, warm and lit."),
        paragraph("This scene has no choices, so it is an ending. Add a Choice to keep the story going."),
      ],
      468,
      54,
    ),
    scene(
      walk,
      "Into town",
      [
        paragraph("The road is longer in the dark. One window is still lit above the bakery."),
        paragraph("Another ending. Write what happens next, then press Play to read it from the start."),
      ],
      468,
      234,
    ),
  ];

  return {
    ...base,
    startSceneId: start,
    scenes,
    content: scenes.map((s, order) => ({
      id: s.id,
      kind: "leaf" as const,
      category: "story" as const,
      parentId: null,
      order,
      refType: "scene" as const,
    })),
  };
}
