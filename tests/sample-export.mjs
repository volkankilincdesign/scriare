/**
 * Produces a real exported story, for looking at.
 *
 *   node tests/sample-export.mjs <output path>
 *
 * Not a test. It runs the shipped exporter over a small specimen story so
 * the result can be opened in a browser and judged — the grounds, the
 * measure, the choice buttons, the last screen — rather than argued about
 * from a screenshot.
 *
 * The prose is filler written for the specimen. It exists to exercise
 * every mark the toolbar can apply.
 */
import { join, dirname } from "node:path";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { _electron } from "playwright-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = process.argv[2];
if (!out) {
  console.error("usage: node tests/sample-export.mjs <output path>");
  process.exit(1);
}

const app = await _electron.launch({
  executablePath: process.env.ELECTRON_PATH ?? join(root, "node_modules/electron/dist/electron"),
  args: [join(root, "out/main/index.js")],
  cwd: root,
});
const page = await app.firstWindow();
await page.waitForFunction(() => Boolean(window.__scriareExport), null, { timeout: 20000 });

const html = await page.evaluate(() => {
  const X = window.__scriareExport;
  const now = new Date().toISOString();
  const p = (content, attrs) => ({ type: "paragraph", attrs, content });
  const t = (text, marks) => ({ type: "text", text, marks });

  const scene = (id, title, content, order) => ({
    id,
    title,
    content: { type: "doc", content },
    position: { x: 0, y: 0 },
    frameId: null,
    order,
  });

  const choice = (id, target, label, extra = {}) => ({
    type: "choiceOption",
    attrs: {
      optionId: id,
      targetSceneId: target,
      actions: extra.actions ?? [],
      conditions: extra.conditions ?? [],
      whenUnmet: extra.whenUnmet ?? "hide",
      style: extra.style ?? null,
      speaker: null,
    },
    content: [{ type: "text", text: label }],
  });

  const project = {
    id: "sample-lantern",
    name: "The Lantern Room",
    createdAt: now,
    updatedAt: now,
    startSceneId: "s1",
    scenes: [
      scene(
        "s1",
        "The Lantern Room",
        [
          p([
            t("The stair ends at a door that has been painted shut and opened again more than once, each coat a slightly different white. Beyond it the room is "),
            t("colder than the corridor", [{ type: "bold" }]),
            t(", and the cold has a direction — it comes off the glass in a slow, "),
            t("deliberate", [{ type: "italic" }]),
            t(" pull, the way a draught does when a window has been left open somewhere below."),
          ]),
          p(
            [t("You said the keeper left in forty-one. Somebody has been up here since.")],
            { speaker: "e1" },
          ),
          p(
            [t("Somebody has been up here this week.")],
            { speaker: "e2" },
          ),
          p([
            t("He does not look at "),
            { type: "mention", attrs: { entityId: "e1", label: "Mara" } },
            t(" when he says it. He is looking at the lamp."),
          ]),
          {
            type: "callout",
            content: [p([t("The lamp housing is warm. Whatever else is true, it was lit within the hour.")])],
          },
          {
            type: "bulletList",
            content: [
              { type: "listItem", content: [p([t("The logbook, water-damaged from the spine outward.")])] },
              { type: "listItem", content: [p([t("Three brass weights, two of them missing.")])] },
              { type: "listItem", content: [p([t("A coat on the hook that fits nobody standing here.")])] },
            ],
          },
          {
            type: "blockquote",
            content: [
              p([
                t("Keeper's log, final entry: "),
                t("the light is not the point of the tower.", [{ type: "highlight", attrs: { color: "#ffe680" } }]),
              ]),
            ],
          },
          {
            type: "choiceBlock",
            content: [
              choice("c1", "s2", "Read the final entry before touching anything.", {
                actions: [{ id: "a1", variableId: "trust", operation: "add", value: 2 }],
              }),
              choice("c2", "s3", "Put your hand on the lamp housing.", {
                style: { overrides: { fill: "#6b1f1f", border: "#a33a34", borderWidth: 2, radius: 3 } },
              }),
              choice("c3", "s2", "Ask Halloran what he isn't saying.", {
                conditions: [{ id: "k1", variableId: "trust", comparator: "gte", value: 3 }],
                whenUnmet: "lock",
              }),
            ],
          },
        ],
        0,
      ),
      scene(
        "s2",
        "What the Glass Kept",
        [
          p([
            t("The last page is a list of times, and then it is not a list of times. The hand changes halfway down — same pen, different pressure, as if whoever finished it had been in more of a hurry than whoever began."),
          ]),
          {
            type: "conditionalBlock",
            attrs: { conditions: [{ id: "cc", variableId: "trust", comparator: "gte", value: 2 }] },
            content: [
              p([
                t("You have read enough of his handwriting this month to be sure of one thing: the second hand is not his either.", [
                  { type: "textStyle", attrs: { fontFamily: "Georgia, 'Times New Roman', serif" } },
                ]),
              ]),
            ],
          },
          {
            type: "choiceBlock",
            content: [choice("c4", "s3", "Close the book. Say nothing yet.")],
          },
        ],
        1,
      ),
      scene(
        "s3",
        "End of Act One",
        [
          p([
            t("He gets the door closed on the second try. Below them the stair is dark all the way down, and neither of them says the obvious thing about how long that has been true."),
          ]),
        ],
        2,
      ),
    ],
    content: [],
    favorites: [],
    variables: [{ id: "trust", name: "Trust", type: "number", defaultValue: 0 }],
    choiceStyles: window.__scriareChoiceStyles.normalizeChoiceStyles(undefined),
    entities: [
      { id: "e1", kind: "character", name: "Mara", aliases: [], content: null },
      { id: "e2", kind: "character", name: "Halloran", aliases: [], content: null },
    ],
  };

  return X.buildExportHtml(X.buildExportStory(project));
});

await writeFile(out, html, "utf-8");
console.log(`${out} — ${Math.round(html.length / 1024)} KB`);
await app.close();
