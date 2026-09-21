import type { ExportStory } from "./buildStory";
import { pageStyles } from "./pageStyles";
import { pageRuntime } from "./pageRuntime";

/**
 * Assembling the one file an export produces (v0.48.0).
 *
 * ONE FILE, NO REQUESTS. Everything — the stylesheet, the story, the
 * script — is inlined. A reader can open it from a download, from a USB
 * stick, from a folder with the wi-fi off, and it behaves identically; and
 * no third party learns that anyone read it. That is worth more for a
 * portfolio piece than a webfont, which is the only thing the rule actually
 * costs (see pageStyles.ts).
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The story, as a literal inside a `<script>`.
 *
 * `JSON.stringify` alone is not enough here and the reason is specific: the
 * HTML parser looks for `</script` in the raw text of a script element
 * before any JavaScript is parsed, so a story containing that sequence —
 * in a scene's prose, in a choice label, in a character's name — would end
 * the script early and spill the rest of the project onto the page as
 * text. Escaping `<` as `\\u003c` makes that impossible while producing an
 * identical string at runtime. `\\u2028`/`\\u2029` are the other pair: legal
 * in JSON, line terminators in JavaScript, and a syntax error when they
 * land inside a string literal.
 */
function embedJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function buildExportHtml(story: ExportStory): string {
  const title = escapeHtml(story.name || "Untitled story");

  // No `lang` attribute. The obvious thing to write is `lang="en"`, and it
  // would be wrong for a story written in any other language — a wrong
  // `lang` is worse than none, because a screen reader will pronounce the
  // whole story with it. Scriare has nowhere for a writer to say what
  // language they are writing in yet; when it does, this is where it goes.
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="generator" content="Scriare">
<title>${title}</title>
<style>${pageStyles()}</style>
</head>
<body>
<header class="scriare-bar">
  <span class="scriare-story-name">${title}</span>
  <nav>
    <button type="button" id="scriare-back" disabled>&#8592; Back</button>
    <button type="button" id="scriare-restart">&#8634; Restart</button>
    <button type="button" id="scriare-ground">Paper</button>
  </nav>
</header>
<main class="scriare-reader" id="scriare-reader"></main>
<script>
var STORY = ${embedJson(story)};
${pageRuntime()}
</script>
</body>
</html>
`;
}

/** A filename the writer will recognise, derived from the story's name.
 *  Only characters a filesystem actually refuses are replaced — a story
 *  called "What the Glass Kept" should export as that, not as a slug. */
export function suggestedExportName(storyName: string): string {
  const cleaned = (storyName || "Untitled story")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return `${cleaned || "Untitled story"}.html`;
}
