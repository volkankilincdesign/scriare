/**
 * The questions a newcomer actually has (v0.81.0).
 *
 * WHY A FAQ AND NOT A TOUR. A tour teaches procedure to somebody who does
 * not yet know why, and it is the shape most people dismiss unread — the
 * two tools in this genre that have solved onboarding at all did not build
 * one. Arcweave opens a new account onto a built-in example project and
 * sends everything else to docs and YouTube; Twine ships one line of text
 * inside the default passage. Both teach at the point of use and let an
 * example carry the rest, which is the shape this app now follows: the
 * blocks explain themselves where they are met, and this answers the rest
 * in a place that can still be found in week three. A tour is useful
 * exactly once and then is in the way.
 *
 * EVERY ANSWER HERE IS ABOUT WHAT THE APP DOES, not what it will do. An
 * FAQ that describes a plan is a promise nobody agreed to, and the first
 * one a writer catches being wrong is the last one they read.
 *
 * WHAT IT DOES NOT COVER, on purpose: anything the surface itself already
 * says. "How do I add another choice" has a button that says + Add Choice.
 * A question whose answer is visible on screen teaches a writer that this
 * list is where obvious things live, and then they stop opening it.
 */

export interface FaqEntry {
  /** The question, in the words a writer would use — not the app's nouns. */
  q: string;
  /**
   * The answer, in two or three sentences. Where it names a place in the
   * app, it names it exactly as the app labels it, so the sentence can be
   * followed rather than interpreted.
   */
  a: string;
  /** Groups the list. Order here is the order the panel draws. */
  group: "Writing" | "Making it branch" | "Checking it" | "Getting it out";
}

export const FAQ: FaqEntry[] = [
  {
    group: "Writing",
    q: "Where is my story saved?",
    a: "In one .scriare file, wherever you put it. It saves as you work — the top bar says “All changes saved” or “Unsaved changes”, and Ctrl+S forces one. There is no account and nothing is uploaded anywhere; if you close the app with unsaved work it asks first.",
  },
  {
    group: "Writing",
    q: "What is the difference between a Choice and a Dialogue?",
    a: "A Choice turns the page: the reader picks an option and the story moves to another scene. A Dialogue stays put: the reader picks what to say, the answer appears underneath, and the scene carries on once the conversation ends. Use a Dialogue when someone is talking and the story has not moved yet.",
  },
  {
    group: "Writing",
    q: "What does typing @ do?",
    a: "At the start of a line it attributes that line to a character — the speaker's name is printed in front of it when the story is read. Anywhere else it inserts a mention, which stores the character rather than their name, so renaming them later updates every scene at once.",
  },
  {
    group: "Writing",
    q: "Do I have to make a character before I can mention them?",
    a: "No. Type @ and the name, and create them from the menu that appears. Characters and locations are the same kind of thing with a switch: only a character can speak.",
  },
  {
    group: "Making it branch",
    q: "How do I connect two scenes?",
    a: "You do not draw the line. A choice points at a scene — pick the destination in the Inspector on the right — and the Story Graph draws the arrow for you. A choice with nowhere to go is reported by Check Story rather than silently doing nothing.",
  },
  {
    group: "Making it branch",
    q: "How do I make something happen only once, or only after something else?",
    a: "With a variable. Make one in the Variable Manager, have a choice change it under Actions, and then gate whatever should react to it under Conditions — on another choice, a Dialogue line, or a Conditional block. A gated choice can either vanish or show as locked with a reason, which is a decision you make per choice.",
  },
  {
    group: "Making it branch",
    q: "What is a Conditional for, if choices already have conditions?",
    a: "A Conditional holds writing rather than options. It is how one scene reads differently depending on what has already happened — a paragraph that only appears if the reader has been here before — without splitting the scene in two.",
  },
  {
    group: "Checking it",
    q: "How do I try it?",
    a: "Play, in the top bar. It runs the story exactly as a reader would meet it, on the same two reading grounds the exported page uses, and Esc gets you out from anywhere — including a scene whose every choice is currently locked.",
  },
  {
    group: "Checking it",
    q: "How do I find a scene I can no longer see?",
    a: "Check Story lists everything unreachable from your start scene, along with dead links, gates on variables that no longer exist, and how long the routes through your story are. Clicking a result opens the exact place it is talking about.",
  },
  {
    group: "Checking it",
    q: "Can I search the whole story at once?",
    a: "Ctrl+F searches every scene and every character page, not just the one you are looking at, and it folds Turkish properly — ist finds İstanbul. Replace shows you every hit before it changes anything, and the whole thing is one undo step.",
  },
  {
    group: "Getting it out",
    q: "How do I give someone my story to read?",
    a: "Export → Web Page writes one HTML file. It makes no network requests at all, so it works offline, from a folder or a USB stick, and nobody learns who read it. Your formatting, choices, variables and conditions all arrive intact.",
  },
  {
    group: "Getting it out",
    q: "Can I change how the exported page looks?",
    a: "Yes — Project Settings → Stylesheet takes your own CSS. It applies in Play Mode too so you can see what you are doing, and your rules win over the app's without needing !important. The names you can target are listed inside the editor.",
  },
  {
    group: "Getting it out",
    q: "Can I get my story out as something other than a web page?",
    a: "A script, as a PDF or a Word file, in two layouts — one to hand a reader, one to hand a studio. And a spreadsheet of every string a reader sees, one row each, in reading order, with a CSV alongside it for engine import. The .scriare file itself is plain JSON with a documented shape.",
  },
  {
    group: "Getting it out",
    q: "Can I bring a story in from Twine?",
    a: "Not yet, and there is an honest reason it is not first in the queue: an importer is lossy in both directions and needs a document about what does not survive. If you have a Twine story, rewriting it here is currently the better path — which is how the example story got made.",
  },
];
