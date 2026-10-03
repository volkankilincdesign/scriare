/**
 * Builds "Feature Tour" — a placeholder story that exercises every part of
 * the app, written to be REPLACED rather than kept.
 *
 *   node tools/build-feature-tour.mjs            → tests/fixtures/feature-tour.scriare
 *   OUT=/some/path.scriare node tools/...        → somewhere else
 *
 * WHY A BUILDER AND NOT A HAND-WRITTEN FILE. The same reason
 * `build-blue-hour.mjs` exists: a `.scriare` is a document tree, and a
 * hand-typed one is a guess at a schema. Every node shape here was read off
 * a file the app itself had saved, and the result is loaded, checked and
 * exported before it is believed.
 *
 * WHAT IT IS FOR. Three jobs, and the prose is deliberately flat because of
 * all three:
 *
 *   1. A story to point the test suite and the screenshot tool at that is
 *      nobody's draft, so neither can be broken by somebody editing their
 *      own writing.
 *   2. A manual pass: every scene says what it is demonstrating, so opening
 *      it is a tour of the app rather than a read.
 *   3. Something a stranger can open on first launch without being handed
 *      somebody else's novel.
 *
 * It is NOT the demo story. It has no voice on purpose — a placeholder that
 * reads well is a placeholder people keep.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const outPath = process.env.OUT ?? join(root, "tests/fixtures/feature-tour.scriare");

/* ── small helpers, matching what the app writes ──────────────────── */

const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 22);

/** A paragraph. `speaker` attributes the line to an entity id. */
const p = (text, { speaker = null, align = null, marks } = {}) => ({
  type: "paragraph",
  attrs: { speaker, textAlign: align, lineId: `t_${slug(text)}` },
  content: text ? [{ type: "text", ...(marks ? { marks } : {}), text }] : [],
});

/** A paragraph built from mixed inline pieces. */
const rich = (pieces, { speaker = null, align = null, key } = {}) => ({
  type: "paragraph",
  attrs: { speaker, textAlign: align, lineId: `t_${key}` },
  content: pieces,
});

const t = (text, marks) => ({ type: "text", ...(marks ? { marks } : {}), text });
const mention = (entityId, label) => ({ type: "mention", attrs: { entityId, label } });
const heading = (text, level = 2) => ({
  type: "heading",
  attrs: { level, textAlign: null, lineId: `h_${slug(text)}` },
  content: [{ type: "text", text }],
});
const quote = (text) => ({ type: "blockquote", content: [p(text)] });
const rule = () => ({ type: "horizontalRule" });
const callout = (text) => ({ type: "callout", content: [p(text)] });
const bullets = (items) => ({
  type: "bulletList",
  content: items.map((i) => ({ type: "listItem", content: [p(i)] })),
});
const numbers = (items) => ({
  type: "orderedList",
  attrs: { start: 1 },
  content: items.map((i) => ({ type: "listItem", content: [p(i)] })),
});

const choiceOption = (seed) => ({
  type: "choiceOption",
  attrs: {
    optionId: seed.id,
    targetSceneId: seed.to ?? null,
    actions: seed.actions ?? [],
    conditions: seed.conditions ?? [],
    whenUnmet: seed.whenUnmet ?? "hide",
    lockReason: seed.lockReason ?? "",
    style: seed.style ?? null,
    speaker: null,
  },
  content: seed.text ? [{ type: "text", text: seed.text }] : [],
});

const choiceBlock = (id, options) => ({
  type: "choiceBlock",
  attrs: { blockId: id },
  content: options.map(choiceOption),
});

const dialogueLine = (seed) => ({
  type: "dialogueLine",
  attrs: {
    lineId: seed.id,
    speaker: seed.speaker ?? "@player",
    reply: seed.reply ?? "",
    replySpeaker: seed.replySpeaker ?? null,
    after: seed.after ?? "stay",
    targetSceneId: seed.to ?? null,
    repeatable: seed.repeatable ?? false,
    conditions: seed.conditions ?? [],
    actions: seed.actions ?? [],
    whenUnmet: seed.whenUnmet ?? "hide",
    lockReason: seed.lockReason ?? "",
    style: seed.style ?? null,
  },
  content: seed.text ? [{ type: "text", text: seed.text }] : [],
});

const dialogueBlock = (id, lines) => ({
  type: "dialogueBlock",
  attrs: { blockId: id },
  content: lines.map(dialogueLine),
});

const conditional = (id, conditions, blocks) => ({
  type: "conditionalBlock",
  attrs: { blockId: id, conditions },
  content: blocks,
});

const doc = (...blocks) => ({ type: "doc", content: blocks.flat() });

/* ── the cast, deliberately plain ─────────────────────────────────── */

const ENTITIES = [
  {
    id: "e-mara",
    kind: "character",
    name: "Mara Vance",
    aliases: ["Mara"],
    content: doc(
      p("A character, so the editor has something to attribute a line to."),
      p("She has an alias, so typing @Mara finds her as well as her full name. Rename her in this panel and every sentence in the story follows, because nothing anywhere stored her name — only who she is."),
    ),
  },
  {
    id: "e-archivist",
    kind: "character",
    name: "The Archivist",
    aliases: [],
    content: doc(p("A second character, so speaker attribution has somebody to swap to.")),
  },
  {
    id: "e-reading-room",
    kind: "location",
    name: "The Reading Room",
    aliases: ["the room"],
    content: doc(p("A location. Locations can be mentioned but cannot speak — the speaker picker will not offer this one.")),
  },
  {
    id: "e-stair",
    kind: "location",
    name: "The Lantern Stair",
    aliases: [],
    content: doc(p("A second location, mentioned in chapter two.")),
  },
  {
    id: "e-note-how",
    kind: "note",
    name: "How this story is put together",
    aliases: [],
    content: doc(
      heading("What this file is", 2),
      p("A placeholder. Every scene demonstrates one part of the app and says so in its own text."),
      bullets([
        "Three chapters, twelve scenes, three endings — one of them behind a condition.",
        "Three variables: a number, a boolean, and a second boolean used as a key.",
        "Choices that set, add and toggle; choices that hide; choices that lock with a reason.",
        "A conversation that stays on the page, with a line that repeats and a line that leaves.",
        "Prose gated behind a condition, a loop back to an earlier scene, and a merge.",
      ]),
      p("A note is writer-only: it can mention the story, and the story cannot mention it."),
    ),
  },
];

/* ── variables ────────────────────────────────────────────────────── */

const VARIABLES = [
  { id: "v-lamps", name: "lamps lit", type: "number", defaultValue: 0, description: "Counts up. Three of them open the last ending." },
  { id: "v-key", name: "has the key", type: "boolean", defaultValue: false, description: "Set in chapter two. Gates one choice and one ending." },
  { id: "v-truth", name: "told the truth", type: "boolean", defaultValue: false, description: "Toggled in the conversation. Changes nothing except which prose appears." },
];

/* ── choice styles ────────────────────────────────────────────────── */

const CHOICE_STYLES = [
  { id: "default", name: "Default", box: { fill: "var(--surface-2-translucent)", border: "var(--border)", borderWidth: 1, radius: 6 } },
  { id: "style-risk", name: "Risk", box: { fill: "rgba(170, 60, 50, 0.14)", border: "rgba(170, 60, 50, 0.55)", borderWidth: 1, radius: 6 } },
  { id: "style-quiet", name: "Quiet", box: { fill: "transparent", border: "var(--border-faint)", borderWidth: 1, radius: 14 } },
];

/* ── the scenes ───────────────────────────────────────────────────── */

const SCENES = [
  {
    id: "s01",
    title: "Start Here",
    group: "g-basics",
    content: doc(
      p("This is a placeholder story. Every scene in it demonstrates one part of the app and says which, so you can open any of them and see that thing working."),
      rich([
        t("Prose carries marks: "),
        t("bold", [{ type: "bold" }]),
        t(", "),
        t("italic", [{ type: "italic" }]),
        t(", "),
        t("underline", [{ type: "underline" }]),
        t(", "),
        t("colour", [{ type: "textStyle", attrs: { color: "#7a5cff" } }]),
        t(" and "),
        t("highlight", [{ type: "highlight", attrs: { color: "#ffe08a" } }]),
        t("."),
      ], { key: "prose-carries-marks" }),
      rich([
        t("It also carries mentions: "),
        mention("e-mara", "Mara Vance"),
        t(" is waiting in "),
        mention("e-reading-room", "The Reading Room"),
        t("."),
      ], { key: "mentions-line" }),
      callout("A callout. Use it for the aside that is not part of the scene."),
      rule(),
      p("Below is a Choice Block. It sits in the paragraph flow — the page does not stop being a page because the story branches."),
      choiceBlock("b-start", [
        { id: "o-start-1", text: "Go through to the basics.", to: "s02" },
        { id: "o-start-2", text: "Skip ahead to the logic.", to: "s05", style: { ...CHOICE_STYLES[2].box } },
        { id: "o-start-3", text: "Light a lamp and go through.", to: "s02", actions: [{ id: "a1", variableId: "v-lamps", operation: "add", value: 1 }] },
      ]),
    ),
  },
  {
    id: "s02",
    title: "Prose and Marks",
    group: "g-basics",
    content: doc(
      heading("A heading", 2),
      p("Headings, quotes, rules, lists and callouts are all ordinary blocks. Nothing here is special to this app."),
      quote("A blockquote, for the thing somebody else said."),
      bullets(["A bulleted list.", "Which has three items.", "Because two looked accidental."]),
      numbers(["A numbered list.", "Same idea.", "Different marker."]),
      p("A line can also be attributed to a speaker, which is the next scene.", { align: "center" }),
      choiceBlock("b-prose", [
        { id: "o-prose-1", text: "On to the conversation.", to: "s03" },
      ]),
    ),
  },
  {
    id: "s03",
    title: "A Conversation",
    group: "g-basics",
    content: doc(
      p("Speaker attribution puts a name in front of a line, and the name is a reference rather than text:"),
      p("The lamps are not lit. Nobody has been up here in a while.", { speaker: "e-mara" }),
      p("Then we should start at the bottom.", { speaker: "e-archivist" }),
      p("Below is a Dialogue Block: a whole conversation as one object on the page. Each line is something you can say, with the reply underneath it."),
      dialogueBlock("b-talk", [
        { id: "d-1", text: "\"What is this place?\"", reply: "A reading room, mostly. The stair above it is the part people remember.", replySpeaker: "e-mara", after: "stay" },
        { id: "d-2", text: "\"Ask again about the stair.\"", reply: "Still a stair. Still above us.", replySpeaker: "e-mara", after: "stay", repeatable: true },
        { id: "d-3", text: "\"I will tell you the truth: I am lost.\"", reply: "That is the first useful thing anybody has said today.", replySpeaker: "e-mara", after: "stay", actions: [{ id: "a2", variableId: "v-truth", operation: "set", value: true }] },
        { id: "d-4", text: "\"Give me the key.\"", reply: "Not until you have lit something.", replySpeaker: "e-mara", after: "stay", conditions: [{ id: "c1", variableId: "v-lamps", comparator: "gte", value: 1 }], whenUnmet: "lock", lockReason: "Light a lamp first." },
        { id: "d-5", text: "\"Let us go up.\"", reply: "", replySpeaker: null, after: "leave", to: "s04", actions: [{ id: "a3", variableId: "v-lamps", operation: "add", value: 1 }] },
        { id: "d-6", text: "\"Say nothing and wait.\"", reply: "The silence is comfortable enough.", replySpeaker: null, after: "end" },
      ]),
    ),
  },
  {
    id: "s04",
    title: "Gated Prose",
    group: "g-basics",
    content: doc(
      p("A Conditional Block hides prose rather than a choice. The paragraph below only appears if you told the truth in the conversation."),
      conditional("b-cond", [{ id: "c2", variableId: "v-truth", comparator: "eq", value: true }], [
        p("You told her you were lost, and she has not mentioned it since. That is its own kind of answer."),
      ]),
      p("The choices below use the other half of the same idea: one is hidden when its condition fails, one is shown locked with the reason visible."),
      choiceBlock("b-gated", [
        { id: "o-gate-1", text: "Take the stair.", to: "s05" },
        { id: "o-gate-2", text: "Mention what you admitted downstairs.", to: "s05", conditions: [{ id: "c3", variableId: "v-truth", comparator: "eq", value: true }], whenUnmet: "hide" },
        { id: "o-gate-3", text: "Open the locked door.", to: "s12", conditions: [{ id: "c4", variableId: "v-key", comparator: "eq", value: true }], whenUnmet: "lock", lockReason: "You do not have the key." },
      ]),
    ),
  },

  {
    id: "s05",
    title: "Variables",
    group: "g-logic",
    content: doc(
      rich([t("You are on "), mention("e-stair", "The Lantern Stair"), t(". Every choice here changes a variable, and Play Mode shows the values as they change.")], { key: "stair-line" }),
      p("Set, add and toggle are the three operations. There is no expression field anywhere in this app — each of these was built from two dropdowns and a number."),
      choiceBlock("b-vars", [
        { id: "o-var-1", text: "Light another lamp. (adds 1)", to: "s06", actions: [{ id: "a4", variableId: "v-lamps", operation: "add", value: 1 }] },
        { id: "o-var-2", text: "Take the key from the hook. (sets true)", to: "s06", actions: [{ id: "a5", variableId: "v-key", operation: "set", value: true }], style: { ...CHOICE_STYLES[1].box } },
        { id: "o-var-3", text: "Change your mind about the truth. (toggles)", to: "s06", actions: [{ id: "a6", variableId: "v-truth", operation: "toggle" }] },
      ]),
    ),
  },
  {
    id: "s06",
    title: "Locked and Hidden",
    group: "g-logic",
    content: doc(
      p("The same condition can hide a choice or lock it. Hiding is for a choice that should not exist yet; locking is for one the reader should know they have not earned."),
      choiceBlock("b-lock", [
        { id: "o-lock-1", text: "Carry on up.", to: "s07" },
        { id: "o-lock-2", text: "Unlock the cabinet.", to: "s08", conditions: [{ id: "c5", variableId: "v-key", comparator: "eq", value: true }], whenUnmet: "lock", lockReason: "The cabinet needs the key." },
        { id: "o-lock-3", text: "Something only a well-lit stair would show you.", to: "s08", conditions: [{ id: "c6", variableId: "v-lamps", comparator: "gte", value: 2 }], whenUnmet: "hide" },
      ]),
    ),
  },
  {
    id: "s07",
    title: "A Loop Back",
    group: "g-logic",
    content: doc(
      p("This scene leads back to an earlier one, which makes the story a graph rather than a tree. Check Story reports that the story loops and refuses to invent a longest route, because a loop does not have one."),
      choiceBlock("b-loop", [
        { id: "o-loop-1", text: "Go back down to the variables.", to: "s05" },
        { id: "o-loop-2", text: "Carry on to the merge.", to: "s08" },
      ]),
    ),
  },
  {
    id: "s08",
    title: "A Merge",
    group: "g-logic",
    content: doc(
      p("Three scenes lead here. A merge is the case a layout engine gets wrong most often, which is why there is one in the placeholder."),
      quote("Several routes, one room."),
      choiceBlock("b-merge", [
        { id: "o-merge-1", text: "Take the long way.", to: "s09" },
        { id: "o-merge-2", text: "Leave now.", to: "s11" },
      ]),
    ),
  },

  {
    id: "s09",
    title: "The Long Way",
    group: "g-ends",
    content: doc(
      p("A plain scene with one way out, so the shortest-route number has something to be shorter than."),
      choiceBlock("b-long", [
        { id: "o-long-1", text: "Keep going.", to: "s10" },
      ]),
    ),
  },
  {
    id: "s10",
    title: "Ending — Everything Seen",
    group: "g-ends",
    content: doc(
      heading("End of the tour", 2),
      p("A scene with no outgoing choice is an ending. There are three here so the endings count has something to count, and one of them is behind a condition."),
      conditional("b-end-cond", [{ id: "c7", variableId: "v-lamps", comparator: "gte", value: 3 }], [
        p("Three lamps are lit behind you and the stair is visible all the way down."),
      ]),
    ),
  },
  {
    id: "s11",
    title: "Ending — Early Exit",
    group: "g-ends",
    content: doc(p("You left before the lamps were lit. This ending is reachable in three moves, which is what makes the shortest-route number interesting.")),
  },
  {
    id: "s12",
    title: "Ending — The Locked Door",
    group: "g-ends",
    content: doc(p("Reachable only with the key, from the gated choice in chapter one. An ending behind a condition is the thing worth checking in Play Mode.")),
  },
];

/* ── layout, groups, and the file ─────────────────────────────────── */

const GROUPS = [
  { id: "g-basics", name: "I — The Basics", order: 0 },
  { id: "g-logic", name: "II — Logic", order: 1 },
  { id: "g-ends", name: "III — Ends", order: 2 },
];

const byGroup = new Map(GROUPS.map((g) => [g.id, []]));
SCENES.forEach((s) => byGroup.get(s.group).push(s));

const scenes = [];
const content = [];

GROUPS.forEach((g, gi) => {
  const mine = byGroup.get(g.id);
  content.push({
    id: g.id,
    kind: "folder",
    name: g.name,
    category: "story",
    parentId: null,
    order: g.order,
    rect: { x: 72 + gi * 420, y: 72, width: 300, height: 120 + mine.length * 150 },
  });
  mine.forEach((s, i) => {
    scenes.push({
      id: s.id,
      title: s.title,
      content: s.content,
      position: { x: 110 + gi * 420, y: 120 + i * 150 },
      titleKey: `title_${s.id}`,
    });
    content.push({
      id: s.id,
      kind: "leaf",
      refType: "scene",
      category: "story",
      parentId: g.id,
      order: i,
    });
  });
});

ENTITIES.forEach((e, i) => {
  content.push({
    id: e.id,
    kind: "leaf",
    refType: "entity",
    category: e.kind === "character" ? "characters" : e.kind === "location" ? "locations" : "notes",
    parentId: null,
    order: i,
  });
});

const now = new Date().toISOString();

const project = {
  id: "feature-tour",
  name: "Feature Tour",
  author: "Scriare",
  language: "en",
  playerName: "Traveller",
  stylesheet: [
    "/* Your own CSS ships with the story and wins over the app's.",
    "   This one only tints the choice labels, so you can see it working",
    "   in Play Mode and in the exported page. Delete it and nothing",
    "   else changes. */",
    ".scriare-choice { letter-spacing: 0.01em; }",
    ".scriare-ending { font-style: italic; }",
  ].join("\n"),
  createdAt: now,
  updatedAt: now,
  startSceneId: "s01",
  scenes,
  content,
  favorites: [{ id: "s03", refType: "scene" }],
  variables: VARIABLES,
  choiceStyles: CHOICE_STYLES,
  entities: ENTITIES,
};

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(project, null, 2));

const blob = JSON.stringify(project);
const count = (type) => blob.split(`"type":"${type}"`).length - 1;
console.log(`wrote ${outPath}`);
console.log(
  `${scenes.length} scenes · ${GROUPS.length} chapters · ` +
    `${count("choiceBlock")} choice blocks · ${count("choiceOption")} options · ` +
    `${count("dialogueBlock")} dialogue blocks · ${count("dialogueLine")} lines · ` +
    `${count("conditionalBlock")} conditionals · ${count("mention")} mentions · ` +
    `${VARIABLES.length} variables · ${ENTITIES.length} entities · ` +
    `${CHOICE_STYLES.length} choice styles`,
);
