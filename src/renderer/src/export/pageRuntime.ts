/**
 * The script that runs inside an exported story (v0.48.0).
 *
 * THIS FILE IS A DUPLICATE, AND IT KNOWS IT.
 *
 * `evaluateCondition`, `evaluateConditions` and `applyVariableAction` below
 * are hand-written mirrors of the functions in types/variables.ts. They
 * have to be: a save dialog cannot ship TypeScript to a browser, and the
 * exported page has no bundler, no imports and no Scriare around it. Every
 * other part of the export avoided duplication by reusing the app's own
 * code at export time (see buildStory.ts) — this is the forty lines that
 * could not be.
 *
 * Duplication that is defended by care is duplication that drifts. So this
 * one is defended by a test instead: tests/export-evaluator.spec.mjs runs
 * THESE functions and the TypeScript ones over every variable type, every
 * comparator, both polarities of `negate`, every operation, and a spread of
 * values including the type-mismatched ones a hand-edited project file can
 * produce — and asserts they agree on every case. If someone adds a
 * comparator to types/variables.ts and forgets this file, the test fails
 * before a reader ever meets a locked door that should have opened.
 *
 * The rule, for anyone changing either side: the functions below are not
 * "similar to" the app's. They are the same functions, transliterated, and
 * a difference between them is always a bug in this file.
 */

import { DEFAULT_GROUND } from "./readingThemes";

export function pageRuntime(): string {
  return `
(function () {
  "use strict";

  var SCENES = Object.create(null);
  for (var i = 0; i < STORY.scenes.length; i++) SCENES[STORY.scenes[i].id] = STORY.scenes[i];

  var VARS = Object.create(null);
  for (var v = 0; v < STORY.variables.length; v++) VARS[STORY.variables[v].id] = STORY.variables[v];

  /* ── mirrors of types/variables.ts — see this file's header ──────── */

  function applyVariableAction(currentValue, variable, action) {
    if (variable.type === "number") {
      var current = typeof currentValue === "number" ? currentValue : Number(currentValue) || 0;
      var operand = typeof action.value === "number" ? action.value : Number(action.value) || 0;
      if (action.operation === "add") return current + operand;
      if (action.operation === "subtract") return current - operand;
      return operand;
    }
    if (variable.type === "boolean") {
      var now = typeof currentValue === "boolean" ? currentValue : Boolean(currentValue);
      if (action.operation === "toggle") return !now;
      return typeof action.value === "boolean" ? action.value : Boolean(action.value);
    }
    return typeof action.value === "string" ? action.value : String(action.value == null ? "" : action.value);
  }

  function evaluateCondition(condition, variable, currentValue) {
    if (!variable) return false;
    var current = currentValue === undefined || currentValue === null ? variable.defaultValue : currentValue;
    var result;

    if (variable.type === "number") {
      var a = typeof current === "number" ? current : Number(current) || 0;
      var b = typeof condition.value === "number" ? condition.value : Number(condition.value) || 0;
      switch (condition.comparator) {
        case "neq": result = a !== b; break;
        case "gt": result = a > b; break;
        case "gte": result = a >= b; break;
        case "lt": result = a < b; break;
        case "lte": result = a <= b; break;
        default: result = a === b;
      }
    } else if (variable.type === "boolean") {
      var ba = typeof current === "boolean" ? current : Boolean(current);
      var bb = typeof condition.value === "boolean" ? condition.value : Boolean(condition.value);
      result = condition.comparator === "neq" ? ba !== bb : ba === bb;
    } else {
      var sa = String(current == null ? "" : current);
      var sb = String(condition.value == null ? "" : condition.value);
      result = condition.comparator === "neq" ? sa !== sb : sa === sb;
    }

    return condition.negate ? !result : result;
  }

  function evaluateConditions(conditions, values) {
    if (!conditions || conditions.length === 0) return true;
    for (var i = 0; i < conditions.length; i++) {
      var c = conditions[i];
      if (!evaluateCondition(c, VARS[c.variableId], values[c.variableId])) return false;
    }
    return true;
  }

  /* ── state ───────────────────────────────────────────────────────
     \`trail\` holds a snapshot of the whole state BEFORE each choice, not
     just the scene id. Going back one scene has to undo what the choice
     did to the variables as well, or a reader walks back through a door
     and keeps the key they picked up on the way out. */

  function freshValues() {
    var values = {};
    for (var k in VARS) values[k] = VARS[k].defaultValue;
    return values;
  }

  var state = { scene: STORY.start, values: freshValues(), trail: [] };
  /* ── the Dialogue's state (v0.66.0) ───────────────────────────────
     Per VISIT, not per story: leaving a scene and coming back starts the
     conversation fresh. A writer who wants a topic exhausted for good has
     a variable and a condition, which is what the block is sugar for —
     and persisting a set of line ids into the save file to buy the other
     behaviour would be paying for what half of all conversations do not
     want. Deliberately NOT in saveProgress for the same reason. */
  var talk = { said: {}, order: [], closed: {} };
  var talkScene = null;
  var pendingSave = null;
  var firstRender = true;

  /* ── what the reader's browser remembers ─────────────────────────
     Wrapped, every call: storage throws outright in a private window and
     in some embedded viewers, and a story that refuses to open because it
     could not remember a bookmark is a worse failure than one that simply
     forgets. Everything here is a convenience; nothing is load-bearing. */

  var PROGRESS_KEY = "scriare:" + STORY.key + ":progress";
  var GROUND_KEY = "scriare:" + STORY.key + ":ground";

  function readStore(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function writeStore(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* nothing to do */ }
  }

  function saveProgress() {
    writeStore(PROGRESS_KEY, JSON.stringify({ scene: state.scene, values: state.values, trail: state.trail }));
  }

  function loadProgress() {
    var raw = readStore(PROGRESS_KEY);
    if (!raw) return null;
    try {
      var saved = JSON.parse(raw);
      // A saved position pointing at a scene that no longer exists is what
      // a reader gets when the writer re-exports after cutting a scene.
      // Dropping it silently and starting fresh is the only honest answer:
      // there is nowhere to send them.
      if (!saved || !saved.scene || !SCENES[saved.scene]) return null;
      return saved;
    } catch (e) {
      return null;
    }
  }

  /* ── ground ─────────────────────────────────────────────────────
     The reader's choice wins and is remembered. Before they have made
     one, the story opens on the ground the writer exported it with —
     deliberately not the reader's device setting, because then nobody
     knows what a stranger sees first, and the first screen is the one
     that gets judged. */

  var ground = readStore(GROUND_KEY) === "paper" || readStore(GROUND_KEY) === "night"
    ? readStore(GROUND_KEY)
    : ${JSON.stringify(DEFAULT_GROUND)};

  function applyGround() {
    document.documentElement.setAttribute("data-ground", ground);
    var button = document.getElementById("scriare-ground");
    if (button) {
      button.textContent = ground === "night" ? "Paper" : "Night";
      button.setAttribute("aria-label", ground === "night" ? "Switch to the Paper ground" : "Switch to the Night ground");
    }
  }

  /* ── rendering ─────────────────────────────────────────────────── */

  var reader = document.getElementById("scriare-reader");

  function element(tag, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function prose(html) {
    var node = element("div", "scriare-prose");
    node.innerHTML = html;
    return node;
  }

  // Structural, exactly as Play Mode decides it: a scene with no linked
  // choice at all is an ending. A scene whose every choice is currently
  // gated shows its locked options and no ending card — which matches the
  // app, and is why Restart and Back live in the bar rather than only on
  // the ending card: the reader is never actually stuck, wherever the
  // story's conditions happen to leave them.
  function hasAnyChoice(scene) {
    for (var i = 0; i < scene.seg.length; i++) {
      if (scene.seg[i].k === "c" && scene.seg[i].o.length > 0) return true;
    }
    return false;
  }

  function choiceButton(choice) {
    var button = element("button", "scriare-choice");
    button.type = "button";
    button.style.background = choice.b.fill || "var(--surface-2-translucent)";
    button.style.borderColor = choice.b.border || "var(--border)";
    button.style.borderWidth = choice.b.borderWidth + "px";
    button.style.borderStyle = choice.b.borderWidth > 0 ? "solid" : "none";
    button.style.borderRadius = choice.b.radius + "px";
    button.innerHTML = choice.l;
    button.addEventListener("click", function () { choose(choice); });
    return button;
  }

  function lockedButton(choice) {
    var button = element("button", "scriare-choice is-locked");
    button.type = "button";
    button.disabled = true;
    // The style's corner radius is borrowed so a locked option still reads
    // as one of the choices around it.
    button.style.borderRadius = choice.b.radius + "px";
    var line = element("span", null);
    var cross = element("span", "scriare-lock-x");
    cross.setAttribute("aria-hidden", "true");
    cross.textContent = "\\u2715";
    line.appendChild(cross);
    var label = element("span", null);
    label.innerHTML = choice.l;
    line.appendChild(label);
    button.appendChild(line);
    if (choice.r) {
      var why = element("span", "scriare-lock-why");
      // Verbatim: the sentence was finished at export time, and may be
      // the writer's own rather than one the app built.
      why.textContent = choice.r;
      button.appendChild(why);
    }
    return button;
  }

  function choiceList(options) {
    var shown = [];
    for (var i = 0; i < options.length; i++) {
      var option = options[i];
      var passes = evaluateConditions(option.c, state.values);
      if (passes) shown.push(choiceButton(option));
      else if (option.u === "lock") shown.push(lockedButton(option));
    }
    if (shown.length === 0) return null;
    var list = element("div", "scriare-choices");
    for (var j = 0; j < shown.length; j++) list.appendChild(shown[j]);
    return list;
  }

  /* ── the Dialogue ─────────────────────────────────────────────────
     Said is spent; every line has an "after"; and whether the page is
     still held is asked separately, by dialogueHolds, because the loop
     above needs the answer before it decides what else to draw. */
  function dialogueOffered(segment) {
    var out = [];
    for (var i = 0; i < segment.o.length; i++) {
      var line = segment.o[i];
      if (talk.said[line.i] && !line.rp) continue;
      var passes = evaluateConditions(line.c, state.values);
      if (passes || line.u === "lock") out.push({ line: line, passes: passes });
    }
    return out;
  }

  function dialogueHolds(segment) {
    if (talk.closed[segment.id]) return false;
    return dialogueOffered(segment).length > 0;
  }

  function saidLine(who, text, isPlayer) {
    var wrap = element("div", "scriare-said");
    if (who) {
      var name = element("div", "scriare-speaker");
      name.textContent = who;
      wrap.appendChild(name);
    }
    var body = element("p", isPlayer ? "scriare-said-you" : null);
    body.textContent = text;
    wrap.appendChild(body);
    return wrap;
  }

  function dialogueLineButton(line, segment) {
    var button = element("button", "scriare-choice");
    button.type = "button";
    button.setAttribute("data-dialogue-line", line.i);
    button.setAttribute("data-after", line.f);
    button.style.background = line.b.fill || "var(--surface-2-translucent)";
    button.style.borderColor = line.b.border || "var(--border)";
    button.style.borderWidth = line.b.borderWidth + "px";
    button.style.borderStyle = line.b.borderWidth > 0 ? "solid" : "none";
    button.style.borderRadius = line.b.radius + "px";
    button.innerHTML = line.l;
    button.addEventListener("click", function () { sayIt(line, segment); });
    return button;
  }

  function sayIt(line, segment) {
    for (var i = 0; i < line.a.length; i++) {
      var action = line.a[i];
      var variable = VARS[action.variableId];
      if (!variable) continue;
      state.values[action.variableId] = applyVariableAction(state.values[action.variableId], variable, action);
    }
    talk.said[line.i] = true;
    talk.order.push(line.i);

    if (line.f === "leave") {
      if (line.t) {
        // Through choose() so a leaving line takes the same route a
        // choice does: the trail, the scroll, the focus move and the save
        // are one path, not two.
        // (No backticks anywhere in this file — it is one big template
        // literal, and a backtick in a comment ends it. Third time.)
        choose({ a: [], t: line.t });
        return;
      }
      // Nowhere to go: treat it as ending the conversation rather than
      // doing nothing, so the reader is never stuck on a dead button.
      talk.closed[segment.id] = true;
    } else if (line.f === "end") {
      talk.closed[segment.id] = true;
    }
    render();
  }

  function dialogue(segment) {
    var wrap = element("div", "scriare-dialogue");
    wrap.setAttribute("data-dialogue", segment.id);

    var byId = {};
    for (var i = 0; i < segment.o.length; i++) byId[segment.o[i].i] = segment.o[i];

    for (var t = 0; t < talk.order.length; t++) {
      var spoken = byId[talk.order[t]];
      if (!spoken) continue;
      wrap.appendChild(saidLine(spoken.s, stripTags(spoken.l), true));
      if (spoken.f !== "leave" && spoken.y) wrap.appendChild(saidLine(spoken.ys, spoken.y, false));
    }

    if (!talk.closed[segment.id]) {
      var offered = dialogueOffered(segment);
      if (offered.length > 0) {
        var list = element("div", "scriare-choices");
        for (var j = 0; j < offered.length; j++) {
          var entry = offered[j];
          list.appendChild(
            entry.passes ? dialogueLineButton(entry.line, segment) : lockedButton(entry.line),
          );
        }
        wrap.appendChild(list);
      } else {
        // Nothing left to say closes it, so the page below can come
        // through on the NEXT render rather than never.
        talk.closed[segment.id] = true;
      }
    }
    wrap.setAttribute("data-closed", talk.closed[segment.id] ? "true" : "false");
    return wrap;
  }

  /* The transcript prints what was SAID, which is text, not markup — the
     label carries the writer's formatting for the button and would arrive
     here as tags a reader would see literally. */
  function stripTags(html) {
    var box = document.createElement("div");
    box.innerHTML = html;
    return box.textContent || "";
  }

  function endingCard() {
    var card = element("div", "scriare-ending");
    var label = element("div", "scriare-ending-label");
    label.textContent = "The End";
    var button = element("button", null);
    button.type = "button";
    button.textContent = "\\u21BA Start again";
    button.addEventListener("click", restart);
    card.appendChild(label);
    card.appendChild(button);
    return card;
  }

  function render() {
    reader.innerHTML = "";

    if (pendingSave) reader.appendChild(resumeBar());

    var scene = SCENES[state.scene];
    var page = element("article", "scriare-page scriare-scene");

    if (!scene) {
      var missing = element("p", "scriare-prose");
      missing.textContent = "This story doesn't have a scene to start from yet.";
      page.appendChild(missing);
      reader.appendChild(page);
      updateBar();
      return;
    }

    /* Only when the SCENE changes — not on every render. This used to sit
       unguarded, and since saying a line calls render(), every click wiped
       the conversation it had just added to: the page redrew with an empty
       transcript and the line back on offer. Caught by driving the
       exported file the way a reader drives it, which is the only way that
       bug was ever going to show up. */
    if (talkScene !== scene.id) {
      talk = { said: {}, order: [], closed: {} };
      talkScene = scene.id;
    }

    var title = element("h1", "scriare-scene-title");
    title.textContent = scene.title;
    title.tabIndex = -1;
    page.appendChild(title);

    /* THE PAGE WAITS (v0.66.0). Everything below an open Dialogue is held
       back until the conversation closes. The same rule as Play Mode's,
       written a second time because this file has no React and no shared
       code with it — which is exactly why the negative controls for it
       break THIS file rather than the app. */
    var held = false;
    for (var i = 0; i < scene.seg.length; i++) {
      var segment = scene.seg[i];
      if (segment.k === "p") {
        page.appendChild(prose(segment.h));
      } else if (segment.k === "if") {
        // Conditions that fail render NOTHING — no placeholder, no gap. A
        // greyed-out paragraph would tell the reader something the writer
        // specifically chose not to tell them.
        if (evaluateConditions(segment.c, state.values)) page.appendChild(prose(segment.h));
      } else if (segment.k === "c") {
        var list = choiceList(segment.o);
        if (list) page.appendChild(list);
      } else if (segment.k === "d") {
        page.appendChild(dialogue(segment));
        if (dialogueHolds(segment)) { held = true; break; }
      }
    }

    // An ending is a scene with nothing left to do — which a conversation
    // still in progress is not, whatever is written below it.
    if (!held && !hasAnyChoice(scene)) page.appendChild(endingCard());

    reader.appendChild(page);
    updateBar();
    saveProgress();

    if (!firstRender) {
      window.scrollTo(0, 0);
      // Moving focus to the new scene's title is what makes a keyboard or
      // screen-reader user land at the top of the new scene rather than
      // wherever the button they just pressed used to be.
      title.focus({ preventScroll: true });
    }
    firstRender = false;
  }

  function resumeBar() {
    var bar = element("div", "scriare-resume");
    var text = element("span", null);
    text.textContent = "You were partway through this story.";
    var yes = element("button", "scriare-resume-yes");
    yes.type = "button";
    yes.textContent = "Continue";
    yes.addEventListener("click", function () {
      state.scene = pendingSave.scene;
      state.values = pendingSave.values || freshValues();
      state.trail = pendingSave.trail || [];
      pendingSave = null;
      firstRender = false;
      render();
    });
    var no = element("button", null);
    no.type = "button";
    no.textContent = "Start over";
    no.addEventListener("click", function () {
      pendingSave = null;
      restart();
    });
    bar.appendChild(text);
    bar.appendChild(yes);
    bar.appendChild(no);
    return bar;
  }

  /* ── navigation ─────────────────────────────────────────────────── */

  function choose(choice) {
    state.trail.push({ scene: state.scene, values: JSON.parse(JSON.stringify(state.values)) });
    // Actions run before the jump, in the order the writer reads them —
    // "picking this does X, then goes here" — so the new scene's conditions
    // always see the already-updated values, never a stale frame.
    for (var i = 0; i < choice.a.length; i++) {
      var action = choice.a[i];
      var variable = VARS[action.variableId];
      if (!variable) continue;
      state.values[action.variableId] = applyVariableAction(state.values[action.variableId], variable, action);
    }
    state.scene = choice.t;
    render();
  }

  function back() {
    var previous = state.trail.pop();
    if (!previous) return;
    state.scene = previous.scene;
    state.values = previous.values;
    render();
  }

  function restart() {
    state.scene = STORY.start;
    state.values = freshValues();
    state.trail = [];
    pendingSave = null;
    firstRender = false;
    render();
  }

  function updateBar() {
    var backButton = document.getElementById("scriare-back");
    if (backButton) backButton.disabled = state.trail.length === 0;
  }

  /* ── wiring ─────────────────────────────────────────────────────── */

  document.getElementById("scriare-back").addEventListener("click", back);
  document.getElementById("scriare-restart").addEventListener("click", restart);
  document.getElementById("scriare-ground").addEventListener("click", function () {
    ground = ground === "night" ? "paper" : "night";
    writeStore(GROUND_KEY, ground);
    applyGround();
  });

  applyGround();

  var saved = loadProgress();
  // Offered rather than applied. Dropping a returning reader straight back
  // into scene forty is disorienting if what they actually wanted was to
  // show someone the opening.
  if (saved && (saved.scene !== STORY.start || (saved.trail && saved.trail.length > 0))) {
    pendingSave = saved;
  }

  render();
})();
`;
}
