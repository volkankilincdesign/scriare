/**
 * Builds "Low Tide" — the placeholder story written to be PHOTOGRAPHED.
 *
 *   node tools/build-low-tide.mjs       → tests/fixtures/low-tide.scriare
 *   OUT=/some/path.scriare node tools/build-low-tide.mjs
 *
 * WHY A SECOND PLACEHOLDER. Feature Tour exists to be a tour: every scene in
 * it says which part of the app it is demonstrating, which is exactly right
 * for a shot of the Story Graph or the Inspector, where the shape is the
 * subject, and exactly wrong for a shot of the prose, where a reader's eye
 * lands on the words and finds instructions about an editor instead of a
 * story. This file is the other half of that: a short piece that holds up at
 * reading distance, arranged so that the shots worth taking each land on
 * something worth looking at.
 *
 * WHAT IT IS NOT. It is not the demo story and it is not a fixture. Feature
 * Tour is pointed at by the test suite and must not move; nothing here is
 * asserted on, so this one can be rewritten or thrown away freely. The prose
 * is mine, not the author's — the byline is a pen name on purpose, so that a
 * screenshot of the project settings does not quietly credit somebody for
 * sentences they did not write.
 *
 * WHAT IT IS ARRANGED FOR, scene by scene:
 *
 *   s01  a page of prose with a Choice Block in the flow — the default shot
 *   s03  a Dialogue Block carrying a real conversation, incl. a locked line
 *   s04  conditional prose, and a choice locked with a reason a reader reads
 *   s06  a hidden option, and the variables panel with human-readable names
 *   s10  an ending that pays off, for the Play Mode shot
 *   —    ten scenes in three chapters, one loop, one three-way merge, three
 *        endings: a graph with a recognisable shape rather than a sprawl
 *
 * Every node shape below was read off a file the app itself saved (see
 * build-feature-tour.mjs); none of it is a guess at the schema.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const outPath = process.env.OUT ?? join(root, "tests/fixtures/low-tide.scriare");

/* ── helpers, matching what the app writes ────────────────────────── */

const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 22);

const p = (text, { speaker = null, align = null, marks } = {}) => ({
  type: "paragraph",
  attrs: { speaker, textAlign: align, lineId: `t_${slug(text)}` },
  content: text ? [{ type: "text", ...(marks ? { marks } : {}), text }] : [],
});

const rich = (pieces, { speaker = null, align = null, key } = {}) => ({
  type: "paragraph",
  attrs: { speaker, textAlign: align, lineId: `t_${key}` },
  content: pieces,
});

const t = (text, marks) => ({ type: "text", ...(marks ? { marks } : {}), text });
const it = (text) => t(text, [{ type: "italic" }]);
const mention = (entityId, label) => ({ type: "mention", attrs: { entityId, label } });
const heading = (text, level = 2) => ({
  type: "heading",
  attrs: { level, textAlign: null, lineId: `h_${slug(text)}` },
  content: [{ type: "text", text }],
});
const quote = (nodes) => ({ type: "blockquote", content: nodes });
const bullets = (items) => ({
  type: "bulletList",
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

/* ── choice styles ────────────────────────────────────────────────── */

const CHOICE_STYLES = [
  { id: "default", name: "Default", box: { fill: "var(--surface-2-translucent)", border: "var(--border)", borderWidth: 1, radius: 6 } },
  { id: "style-leaving", name: "Leaving", box: { fill: "rgba(170, 60, 50, 0.12)", border: "rgba(170, 60, 50, 0.5)", borderWidth: 1, radius: 6 } },
  { id: "style-quiet", name: "Quiet", box: { fill: "transparent", border: "var(--border-faint)", borderWidth: 1, radius: 14 } },
];
const LEAVING = { ...CHOICE_STYLES[1].box };
const QUIET = { ...CHOICE_STYLES[2].box };

/* ── the cast ─────────────────────────────────────────────────────── */

const ENTITIES = [
  {
    id: "e-wren",
    kind: "character",
    name: "Wren Calloway",
    aliases: ["Wren"],
    content: doc(
      p("Thirty-four. Left Ardhallow at twenty-three and has given a different reason every time anyone asked."),
      p("Her grandfather's boat was the Marianne. She has the letter he sent three weeks before he went out on a wrong tide, and she has never shown it to anybody."),
      p("She is the player. Her name is set in project settings, so changing it there changes it everywhere it is spoken."),
    ),
  },
  {
    id: "e-blake",
    kind: "character",
    name: "Edmund Blake",
    aliases: ["Blake", "the harbourmaster"],
    content: doc(
      p("Harbourmaster for twenty-six years, which in Ardhallow means he is the only person who writes anything down."),
      p("Keeps the ledger meticulously and the logbook separately. Only one of those is official."),
      p("He is not hiding what happened so much as declining to be the one who says it out loud."),
    ),
  },
  {
    id: "e-nell",
    kind: "character",
    name: "Nell Ashby",
    aliases: ["Nell"],
    content: doc(
      p("Runs the chandlery, which has about nine things in it and has not needed a tenth."),
      p("Went to school with Wren. Did not write either, and has decided in advance not to apologise for it."),
    ),
  },
  {
    id: "e-office",
    kind: "location",
    name: "The Harbour Office",
    aliases: ["the office"],
    content: doc(
      p("One room at the top of the slipway, with a brass plate on the door and a window facing the water."),
      p("A location can be mentioned but cannot speak, so the speaker picker will not offer it."),
    ),
  },
  {
    id: "e-sand",
    kind: "location",
    name: "The Long Sand",
    aliases: ["the sand"],
    content: doc(
      p("A quarter of a mile of ribbed sand at low water, and no cover on it at all."),
      p("Under water for nine hours out of every twelve, which is the whole of the local argument about what happened."),
    ),
  },
  {
    id: "e-note",
    kind: "note",
    name: "Still to decide",
    aliases: [],
    content: doc(
      heading("Open questions", 2),
      bullets([
        "Does Blake admit it, or does the logbook have to do it for him?",
        "Nell knows. Decide whether she is allowed to say so out loud.",
        "Eleven years or nine — eleven scans better and matches the brass plate.",
      ]),
      p("Ardhallow is on the north coast. Carrowmere is inland and has the junction, which is why the last train matters."),
      p("A note is writer-only. It can mention the story; the story cannot mention it."),
    ),
  },
];

/* ── variables ────────────────────────────────────────────────────── */

const VARIABLES = [
  { id: "v-trust", name: "Blake's trust", type: "number", defaultValue: 0, description: "Goes up when you let him finish a sentence. Two of them change the last paragraph of one ending." },
  { id: "v-logbook", name: "has the logbook", type: "boolean", defaultValue: false, description: "Blake gives it up if he has decided about you. Opens the cabinet and the third ending." },
  { id: "v-letter", name: "mentioned the letter", type: "boolean", defaultValue: false, description: "Changes one paragraph in the boathouse and what Nell does not say." },
];

/* ── the scenes ───────────────────────────────────────────────────── */

const SCENES = [
  {
    id: "s01",
    title: "Low Tide",
    group: "g-harbour",
    content: doc(
      p("The tide had gone out further than the charts allow for, and the harbour had the look of a room with its furniture carried off — bare stone, wet rope, and the long black ribs of boats nobody had come back for."),
      rich([
        t("Eleven years, and "),
        mention("e-office", "The Harbour Office"),
        t(" still had the same brass plate screwed to its door. "),
        mention("e-blake", "Edmund Blake"),
        t("'s name sat underneath the old harbourmaster's, as though he had spent a decade politely declining to be moved up."),
      ], { key: "brass-plate" }),
      p("You came, then. I had a bet with myself that you wouldn't.", { speaker: "e-blake" }),
      p("He did not get up. There was a ledger open in front of him and he kept one finger on the line he had been reading, the way a man does when he fully intends to go back to it."),
      choiceBlock("b-arrival", [
        { id: "o-arr-1", text: "Ask about the boat." , to: "s02" },
        { id: "o-arr-2", text: "Ask what he is reading.", to: "s03", style: QUIET },
        { id: "o-arr-3", text: "Say nothing, and let him get there himself.", to: "s03", actions: [{ id: "a-trust-1", variableId: "v-trust", operation: "add", value: 1 }] },
      ]),
    ),
  },
  {
    id: "s02",
    title: "The Mooring",
    group: "g-harbour",
    content: doc(
      rich([
        t("The fourth mooring from the end had been "),
        mention("e-wren", "Wren Calloway"),
        t("'s grandfather's for forty years, and the boat sitting in it was not his."),
      ], { key: "fourth-mooring" }),
      rich([
        t("Somebody had painted over the name, and not well. You could read "),
        it("Marianne"),
        t(" under the grey if you stood where the light came off the water — which is to say you could read it if you already knew it was there."),
      ], { key: "painted-name" }),
      p("I'd have told you on the phone. You'd not have come.", { speaker: "e-blake" }),
      choiceBlock("b-mooring", [
        { id: "o-moor-1", text: "Ask who painted it.", to: "s03" },
        { id: "o-moor-2", text: "Let him explain himself.", to: "s03", actions: [{ id: "a-trust-2", variableId: "v-trust", operation: "add", value: 1 }] },
        { id: "o-moor-3", text: "Put your hand on the hull and say nothing.", to: "s04", style: QUIET },
      ]),
    ),
  },
  {
    id: "s03",
    title: "What Blake Was Reading",
    group: "g-harbour",
    content: doc(
      p("The office was warmer than the quay by about one degree, and smelled of paraffin and paper that had been damp more than once."),
      p("He turned the ledger a few degrees towards you, which was as close as he was going to come to an invitation."),
      dialogueBlock("b-ledger", [
        {
          id: "d-what",
          text: "\"What is it you keep in there?\"",
          reply: "Arrivals, departures, and the weather I am supposed to pretend I measured.",
          replySpeaker: "e-blake",
          after: "stay",
        },
        {
          id: "d-again",
          text: "\"Read me the last line again.\"",
          reply: "Marianne, out, six-ten. Nothing under it. Same line every time you ask me.",
          replySpeaker: "e-blake",
          after: "stay",
          repeatable: true,
        },
        {
          id: "d-letter",
          text: "\"He wrote to me. Three weeks before.\"",
          reply: "Then you know more than the ledger does.",
          replySpeaker: "e-blake",
          after: "stay",
          actions: [{ id: "a-letter", variableId: "v-letter", operation: "set", value: true }],
        },
        {
          id: "d-logbook",
          text: "\"Give me the logbook. The real one.\"",
          reply: "Bottom drawer. Mind the step on your way down to the boathouse.",
          replySpeaker: "e-blake",
          after: "stay",
          conditions: [{ id: "c-trust", variableId: "v-trust", comparator: "gte", value: 1 }],
          whenUnmet: "lock",
          lockReason: "He has not decided about you yet.",
          actions: [{ id: "a-logbook", variableId: "v-logbook", operation: "set", value: true }],
        },
        {
          id: "d-go",
          text: "\"Then I will go and look at it myself.\"",
          reply: "",
          replySpeaker: null,
          after: "leave",
          to: "s04",
        },
        {
          id: "d-leave-him",
          text: "\"Leave him to it.\"",
          reply: "He puts his finger back on the line.",
          replySpeaker: null,
          after: "end",
        },
      ]),
    ),
  },

  {
    id: "s04",
    title: "The Boathouse",
    group: "g-boathouse",
    content: doc(
      p("The boathouse smelled of creosote and old rain. What light got in came through the gap where the roof met the wall, in one flat bar that moved while you watched it."),
      conditional("b-cond-letter", [{ id: "c-letter", variableId: "v-letter", comparator: "eq", value: true }], [
        rich([
          t("He had written that he was "),
          it("tidying up"),
          t(". You had read it as a man putting his affairs in order, and it had taken eleven years and a painted-over hull to make you wonder whether he had meant the room."),
        ], { key: "tidying-up" }),
      ]),
      p("There was a cabinet at the far end with a hasp and no lock on it, and a side door that gave straight onto the sand."),
      choiceBlock("b-boathouse", [
        {
          id: "o-bh-1",
          text: "Open the cabinet.",
          to: "s06",
          conditions: [{ id: "c-log-1", variableId: "v-logbook", comparator: "eq", value: true }],
          whenUnmet: "lock",
          lockReason: "Blake still has the logbook.",
        },
        { id: "o-bh-2", text: "Go up and find Nell Ashby.", to: "s05" },
        { id: "o-bh-3", text: "Walk to the station and leave it alone.", to: "s09", style: LEAVING },
      ]),
    ),
  },
  {
    id: "s05",
    title: "Nell",
    group: "g-boathouse",
    content: doc(
      rich([
        mention("e-nell", "Nell Ashby"),
        t(" had the chandlery now, and the chandlery had about nine things in it. She was pricing one of them with a pencil she had to keep licking."),
      ], { key: "chandlery" }),
      p("You've been to see Blake. You've got the face.", { speaker: "e-nell" }),
      conditional("b-cond-nell", [{ id: "c-letter-2", variableId: "v-letter", comparator: "eq", value: true }], [
        p("\"He wrote to you as well, then,\" she said, and did not make it a question."),
      ]),
      dialogueBlock("b-nell", [
        {
          id: "n-sold",
          text: "\"Did you know the boat had been sold?\"",
          reply: "Everyone knew. That isn't the same as anyone telling you.",
          replySpeaker: "e-nell",
          after: "stay",
        },
        {
          id: "n-story",
          text: "\"What do people here say happened?\"",
          reply: "That the tide was wrong and he went anyway. People like a story where the sea is the one who did it.",
          replySpeaker: "e-nell",
          after: "stay",
        },
        {
          id: "n-go",
          text: "\"I should get down to the boathouse.\"",
          reply: "",
          replySpeaker: null,
          after: "leave",
          to: "s06",
        },
      ]),
    ),
  },
  {
    id: "s06",
    title: "The Cabinet",
    group: "g-boathouse",
    content: doc(
      p("The hasp came away with the screws still in it, which told you something about how long it had been since anyone needed it shut."),
      p("Inside: a coil of line, a tin of brass screws gone green at the heads, and a bundle of charts rolled the wrong way so the creases had turned white."),
      choiceBlock("b-cabinet", [
        { id: "o-cab-1", text: "Take the charts out into the light.", to: "s07" },
        { id: "o-cab-2", text: "Leave them. Walk out onto the sand.", to: "s08", style: QUIET },
        {
          id: "o-cab-3",
          text: "Lay the charts beside the logbook and read both.",
          to: "s10",
          conditions: [{ id: "c-log-2", variableId: "v-logbook", comparator: "eq", value: true }],
          whenUnmet: "hide",
        },
      ]),
    ),
  },
  {
    id: "s07",
    title: "Back Along the Sand",
    group: "g-boathouse",
    content: doc(
      rich([
        t("You went back the way you had come, which at low water is a quarter of a mile of "),
        mention("e-sand", "The Long Sand"),
        t(" and no cover on it at all."),
      ], { key: "back-along" }),
      p("The boathouse looked smaller from out here, and the harbour looked like a place people had once had reasons to be."),
      choiceBlock("b-sand", [
        { id: "o-sand-1", text: "Go back inside and start again.", to: "s04" },
        { id: "o-sand-2", text: "Keep walking.", to: "s08" },
      ]),
    ),
  },

  {
    id: "s08",
    title: "The Water Comes Back",
    group: "g-ends",
    content: doc(
      p("The water came back the way it always does, without hurry, filling the ribs of the sand from underneath, so that the beach seemed to be remembering rather than drowning."),
      p("You did not find out what happened to the Marianne. You found out that Ardhallow had agreed not to, and that agreeing is a thing a town is able to do."),
      conditional("b-cond-trust", [{ id: "c-trust-2", variableId: "v-trust", comparator: "gte", value: 2 }], [
        p("Blake watched you go from the office window, and did not pretend to be reading."),
      ]),
    ),
  },
  {
    id: "s09",
    title: "The Last Train",
    group: "g-ends",
    content: doc(
      p("The sixteen-forty was the last one that did not mean changing at Carrowmere, and you were on it with eleven minutes to spare."),
      p("Somewhere behind you a man with a ledger put his finger back on the line he had been reading, and the tide started in over the sand with nobody standing on it."),
    ),
  },
  {
    id: "s10",
    title: "What the Logbook Said",
    group: "g-ends",
    content: doc(
      p("The logbook had a line for the Marianne going out, and no line for her coming back. Underneath it, in the same hand, on the same morning:"),
      quote([
        p("Marianne — out, 06:10. Not logged back."),
        p("E.B. — out, 06:25. Back 09:00."),
      ]),
      p("Blake had gone after him. Blake had come back on his own, and then spent eleven years in a room at the edge of the water keeping a careful record of other people's arrivals."),
      p("You closed the book. Out past the slipway the tide was already turning."),
    ),
  },
];

/* ── layout, groups, and the file ─────────────────────────────────── */

const GROUPS = [
  { id: "g-harbour", name: "I — The Harbour", order: 0 },
  { id: "g-boathouse", name: "II — The Boathouse", order: 1 },
  { id: "g-ends", name: "III — Endings", order: 2 },
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
  id: "low-tide",
  name: "Low Tide",
  author: "E. M. Harrow",
  language: "en",
  playerName: "Wren",
  stylesheet: [
    "/* Ships with the story and wins over the app's own CSS. */",
    ".scriare-choice { letter-spacing: 0.01em; }",
    ".scriare-ending { font-style: italic; }",
  ].join("\n"),
  createdAt: now,
  updatedAt: now,
  startSceneId: "s01",
  scenes,
  content,
  favorites: [
    { id: "s03", refType: "scene" },
    { id: "s10", refType: "scene" },
  ],
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
