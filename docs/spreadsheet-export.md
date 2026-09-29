# The spreadsheet export — settled 28 Sep 2026, built as v0.70.0

One workbook and one CSV, per language, carrying every string a reader
sees. Three audiences, and the design answers to all three: a translator
filling a column, a VO director cutting a session, and somebody wiring the
story into Unreal by hand.

Decided with Volkan in one pass; every choice below has the reason it was
chosen, because the reasons are what make the next decision easy.

## The three identifiers, and why there are three

An id does two jobs that pull in opposite directions. **Identity** — "this
is the same line I sent you last week" — requires it never to change.
**Address** — "scene 15, dialogue line 2" — requires it to change the
moment the story does. One column cannot do both, so there are three.

| column | example | job |
|---|---|---|
| **Key** | `ln-1q` | identity of the string. Opaque, from the file, never edited. |
| **Scene ID** | `s11` | identity of the scene it lives in. Also opaque. |
| **Ref** | `15.D2` | address. Readable, spoken aloud, recomputed on every export. |

The Scene ID is the same argument as the Key, one level up: an engine that
groups rows by scene TITLE decides that renaming "Deniz In The Yard" to
"The Yard" created a new scene full of new lines.

## How a Ref is built

- **Scene numbers come from reachability**, starting at the start scene.
  Scene 1 is where a reader begins; the rest number outward along the
  choices, in the order a reader meets them. Change the start scene and
  the numbering follows, because the initial passage really is the initial
  passage.
- **A scene that cannot be reached gets a U block** — `U1`, `U2` — after
  the numbered ones. Check Story already reports those scenes; the sheet
  must not quietly imply an orphan is part of the flow.
- **Inside a scene, a letter per kind**, each numbered on its own:
  - `15.T4` — **Text**, a paragraph. Not "narration": a paragraph can
    carry a speaker, so the neutral word is the true one.
  - `15.C1` — **Choice**, an option in a Choice Block.
  - `15.D2` — **Dialogue**, a line in a Dialogue. The block is called the
    Dialogue, so the letter says so.
  - `15.D2r` — the **reply** to that line, hung off it. A reply has no
    life of its own; deleting the line takes the reply's ref with it
    rather than leaving a stray number.

  Separate series per kind means adding a choice renumbers only choices,
  not the prose around it — far less churn between two exports.
- **A duplicate keeps the root and takes the next free suffix.** Duplicate
  scene 15 and it is `15.1`; again, `15.2`. The same rule for a copied
  line. One rule everywhere, and the root says where the copy came from.
- **Recomputed on every export, never stored.** Pinning refs would mean
  writing them into the `.scriare` file, and the file keeps opaque ids —
  see below. The Key already does the job pinning would have done.

## What the file format does NOT do

**The app's own ids stay opaque and unchanged.** Internal ids are pointed
at by choices, conditions, the graph and the runtime, so an editable id
means rewriting every reference on every rename: a migration with teeth,
for a gain that lives entirely in a spreadsheet. The readable Ref is
computed at export from position, and nothing in the story file changes.

## The columns

| | column | notes |
|---|---|---|
| A | **Key** | machine id. Also the CSV's RowName for Unreal. |
| B | **Ref** | `15.D2` |
| C | **Where** | `15 · The Big Table · dialogue 2` — the sentence form |
| D | **Scene** | title |
| E | **Scene ID** | machine id |
| F | **Type** | Text / Choice / Dialogue / Reply — the VO filter |
| G | **Speaker** | resolved name, or *You (the player)* |
| H | **Text** | the source string |
| I | **Translation** | ← the translator fills this |
| J | **Notes** | ← and this |
| K | **Mentions** | which entities appear inside the text |
| L | **Shown when** | conditions in words |
| M | **Changes** | actions in words |
| N | **After** | stays / ends / ↪ scene |
| O | **VO file** | `s15_d02_nesrin.wav`, generated |
| P | **Chars** | `=LEN(H2)`, a real formula |
| Q | **Source hash** | short hash of H, for staleness |

Everything locked except **I** and **J**. Header frozen, filters on, the
two editable columns shaded.

## The decisions behind it

- **Every string a reader sees**, not only spoken ones. A sheet without
  prose cannot be used for localisation, and adding prose later renumbers
  rows a translator has already worked in. In The Blue Hour: 121 prose,
  70 choices, 15 dialogue lines, 13 replies.
- **One flat sheet.** Find, sort and filter work across the whole story,
  which is how a translator actually works. Per-scene tabs would make that
  story 32 tabs and a global consistency pass manual.
- **Export now, import designed for but built later.** The import needs
  its own safety story — what happens when a line changed in the app after
  the sheet went out — and that is a feature with a conflict dialog, not a
  column. Same call the app made for save safety.
- **A source hash per row.** One narrow column that makes a stale
  translation detectable instead of silently imported. It costs a column
  now and is impossible to add to sheets already sent out.
- **Mentions are baked, and column K lists them.** A mention resolves to
  an entity's current name; flattened into a translation it freezes that
  name, so renaming the character desynchronises those rows. His call:
  keep the text natural and make the damage findable in one filter rather
  than invisible. Measured: 9 mentions in 9 rows of 219, and zero inline
  formatting marks in the whole story — so this is small and contained
  today. **A later Check Story rule could report it** ("a translated line
  mentions a character who has since been renamed"), which would turn
  findable into reported. Not built.
- **One file per language.** Two translators can work at once without
  merging workbooks, and it is how localisation and VO vendors take work.
  The file name carries the story and the language; refs stay short.
- **An xlsx and a CSV we write ourselves.** Unreal's DataTable imports CSV
  or JSON, not xlsx — and "Save As CSV" from Excel on a Turkish Windows
  gives semicolons and CP1254, which mangles both the delimiters and the
  İ/ı/ş. Ours is comma-delimited, quoted, UTF-8, with newlines escaped as
  `\n`. The Key is the RowName: RowName is what the engine's lookups
  compile against, so it must not renumber when a scene moves.

## What the app gains

The Ref has to be visible in Scriare or it is useless: a translator's
question about `15.D2` must be answerable without counting rows. The scene
shows its number; a Dialogue line shows its full ref in the Inspector.


## Built — what changed between the spec and the file (v0.70.0)

The design above shipped as written. Four things the build settled that the
spec left open, and one it turned out could not be done honestly:

- **The Ref needs no duplicate suffix.** The spec's rule — "duplicate scene
  15 and it is `15.1`" — was written before numbering came from
  reachability. Under a breadth-first walk every scene gets its own number
  and every ref is unique without a suffix, and there is no honest way to
  tell a duplicate from an original anyway: the file format stores no
  provenance, so "is this a copy of scene 15" would be a guess off a title
  ending in "Copy". Dropped rather than faked.
- **Both files are written from one save dialog.** The dialog asks where
  the workbook goes and the CSV takes the same name beside it. They are
  built from one model in one call, which is the only way to guarantee the
  pair cannot disagree — and the panel says so before the export rather
  than leaving the second file to be discovered in a folder afterwards.
- **The target language is one optional field.** It is the only thing the
  app genuinely cannot know, and it only exists because the answer is one
  file per language. Blank is allowed and the file is then just
  `<Story> — Lines.xlsx`.
- **Exports are byte-identical.** Every zip entry carries a fixed date and
  no implicit folder entries, so exporting the same story twice produces
  the same file and a writer can tell a stale sheet by comparing it.
- **Speaker resolution never prints an id.** A line attributed to a deleted
  character comes out as narration, which is what the app already shows on
  screen. A sheet that printed an internal id would be shipping a bug to a
  translator.

### Measured on the real story

The Blue Hour, with conversations: **252 rows** — 32 scene titles, 122
paragraphs, 70 choices, 15 dialogue lines, 13 replies, 7 speaking parts, 9
rows naming a character or place, 2 empty strings skipped and counted. 40 KB
of workbook, no unreachable scenes.

### Fifteen negative controls

Three started out not catching their sabotage, and each was a finding about
the test. Removing the XML escaping left the suite green because the
fixture contained no ampersand. Replacing the fixed zip timestamp with
`new Date()` left it green because two exports a second apart match byte
for byte regardless — a zip stores DOS time at two-second resolution — so
the assertion moved to the entry dates, where the guarantee actually lives.
And the dialog height fix pinned Playwright's viewport, which silently
disabled a window resize two specs later.

## The id audit — run, and what it found (v0.69.0)

The schema assumes column A is trustworthy. That is a claim about the app
rather than about the exporter, so it was measured before a line of the
exporter was written. **It was false in three ways, and the fix shipped as
v0.69.0 — no column changed.**

What held: ids exist on all three row-bearing kinds; a split at the END of
a paragraph issued a fresh one; undo restored the original; reordering
dialogue lines left them alone; save-and-reopen preserved them; and a
pre-v0.66 file was stamped on open.

What did not:

1. **Pressing Enter in the middle of a sentence gave both halves the same
   id.** Measured with a real keypress: two paragraphs, one id. Tiptap only
   consults `keepOnSplit` when the caret is at the end of the block, so the
   common case looked correct and the ordinary one was not.
2. **Nothing could see a duplicate.** Every piece of id bookkeeping only
   ever filled in a MISSING id, so once a repeat existed it was written to
   the file and survived every reopen.
3. **Copy-and-paste cloned all five id-bearing kinds**, each of which
   round-trips through a `data-*` attribute; and **duplicating a scene**
   reissued the choices while leaving the prose and the Dialogue carrying
   the original scene's ids.

Not one of these showed up in a test story, because the test stories were
generated rather than typed. Both real copies of The Blue Hour were clean —
122 paragraphs, 15 dialogue lines, 70 options, no repeats — because nobody
had written in them.

### What the fix means for this spec

**Nothing in the seventeen columns changes.** The worry recorded here was
that a non-unique id would force a scene prefix onto the Key; instead the
id itself was made unique, which is the same guarantee one level lower and
costs the sheet nothing. Column A stays the bare machine id and stays a
valid CSV RowName.

Three rules now hold, and the exporter may rely on them:

- **A split leaves the id on the half that starts the sentence.** Document
  order decides, so an existing translation stays attached to the opening
  clause rather than being orphaned by an ordinary edit.
- **A pasted line is a new line.** Ids are cleared at the paste boundary.
  The cost, accepted deliberately: cutting a line and pasting it elsewhere
  reissues its id, because ProseMirror cannot tell a move from a copy. A
  duplicate id is fatal; a moved line costs a translation memory one fuzzy
  match on its own text.
- **A duplicated scene is entirely new.** Every id in the copy is reissued,
  prose and Dialogue included, so two scenes can never claim one row.

One structural point worth keeping in mind for anything built on top of
this: the live sweep only sees the **mounted document**. It makes a scene
internally consistent and says nothing about the project. Project-wide
uniqueness rests on the paste strip and the scene-copy reissue, not on the
sweep — which is exactly what the negative control found by breaking the
strip and watching the suite stay green.

## Gaps found reviewing this spec, and what was done about them

Nine, each checked in the source rather than assumed. Four mattered.

- **Scene titles are reader-facing.** The exported page prints each one as
  an `<h1 class="scriare-scene-title">`, so a reader sees "The Big Table"
  and a translator never got the chance. **They are rows now**, one per
  scene, `15.S` — the only ref without a number after the letter, because
  a scene has exactly one title.
- **Gated prose lost its condition.** 16 paragraphs in The Blue Hour sit
  inside Conditional Text blocks, and in the first example sheet they read
  as ordinary prose with an empty *Shown when* — blank in the one place
  context matters most. The condition lives on the block, so **the walker
  carries it down** to every paragraph inside it.
- **`hardBreak`.** Shift+Enter is a node, and a naive flatten joins the
  words either side of it. It becomes a real newline in the cell and `\n`
  in the CSV.
- **Variable names leak to the reader.** A locked choice printed
  `"Requires " + the condition phrase`, so a player saw **"Requires resolve
  is at least 3"** — an internal identifier, in English, in the story.
  **CLOSED in v0.72.0**, and it took more than the display name the note
  predicted: the VALUE is dropped too (a threshold is the machine, not the
  story, and no boolean can be phrased with its value at all), negatives
  are detected so that dropping the comparator cannot state the opposite,
  and a choice can carry its own sentence which replaces ours outright.
  Check Story reports any variable a reader can see that nobody has named.
  The sheet grew the predicted `Variable` row type and a `Reason` row
  beside it, with **no new columns** — see below.

**The exported page's own chrome stays out** — "The End", "Continue",
"Start over", the ground names, the word "Requires" itself. His call, and
the reason is the right one: this file is the story, for a translator or
for someone importing it into an engine. The app's own words are a
different job, for the version that teaches the page to read a string
table.

Four smaller ones, settled without discussion: the **CSV carries a lean
fixed subset** (Key, Ref, Type, Speaker, Text, Translation) because a
DataTable wants a fixed struct, while the xlsx keeps all seventeen
columns; **Read me carries a schema version and a fingerprint of the
story**, so a future importer can refuse a sheet that belongs somewhere
else; **empty strings are skipped** and counted in Read me, so the
omission is visible; and **entity pages and notes are excluded** — they
are the writer's working material, not the reader's, and they would
roughly double the sheet.

## The two row types added in v0.72.0

Both are strings a reader meets that are not part of a scene's prose, which
made "every string a reader sees" not quite true until they existed.

- **`Variable`** — a variable's reader-facing name, one row each, in a V
  block after the scenes because they belong to no scene. The same argument
  that puts an unreachable scene after the numbered ones rather than
  inventing a place for it in reading order. Ref `V1`, key `v_courage`.
  **Only variables that have a display name.** One without has nothing a
  reader sees, and putting `hikmet_offer` in front of a translator would be
  asking them to localise an identifier.
  Its key is its display name, which means renaming the display name
  changes the key — right here and wrong everywhere else in this file. For
  a line, the words are what it SAYS and the key is who it IS; for a
  variable's display name the words ARE the whole thing, so renaming it is
  not moving a string, it is writing a new one.
- **`Reason`** — a locked option's own sentence. Ref `15.C2w`, key the
  option's key plus `-why`, so it hangs off its option exactly as a reply
  hangs off its line and deleting the choice takes it with it. Only when
  the option is SHOWN locked: a hidden one tells the reader nothing, so a
  reason on one is a string nobody can reach.

## Not in scope

Import. The exported page's own UI strings — with one fewer of them than
there was: "Requires" is now built at export time rather than hard-coded in
the page's runtime, because a writer's own sentence must not arrive with an
English word in front of it. Inline formatting as markup. Variables
interpolated into text (the app has none yet; if it gains them, the sheet
must preserve them verbatim). A named player — the printed name is
hard-coded "You", which is on the standing list and is a project setting
when it lands.
