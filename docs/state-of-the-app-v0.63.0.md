# Scriare — state of the app at v0.63.0

Written 27 Sep 2026, against the source rather than against the roadmap's
memory. Everything below was checked in the code; where something is
measured rather than read, it says so.

**657 tests, 148 negative controls, all caught. Windows only.**

---

## 1. What is shipped and solid

These have specs, negative controls, and no known defect underneath them.

- **Writing surface** — Tiptap/ProseMirror. Bold/italic/underline, colour,
  highlight, alignment, font family, blockquote, divider, callout,
  conditional text, the `/` slash menu (5 blocks), `@` mentions.
- **Choice Blocks** — options as real text in the document, per-option
  destination, speaker, appearance, conditions, actions, `whenUnmet`.
- **Story Graph** — React Flow, chapter boxes, 18px grid, Auto Layout
  ranked by story depth, edge labels, minimap, fold/unfold.
- **Entities** — Characters and Locations as one object with two kinds,
  pages, aliases, backlinks, rename reaching every scene. Notes since
  v0.60.0.
- **Variables** — Variable Manager, conditions and actions on options and
  on Conditional Text.
- **Check Story** — reachability, dangling and broken links, gates on
  deleted variables, endings, route lengths, word count.
- **Find** — folded search across scenes and entity pages, with snippets
  that highlight what the writer typed.
- **Play Mode** — in-app playthrough on the two reading grounds (v0.57.0).
- **Export** — one self-contained HTML file, no network requests,
  responsive, documented class contract, two reading grounds.
- **Save safety** — atomic writes, file stamps, conflict detection and
  dialog, close guard with heartbeat, backups.
- **Themes** — eight, all clearing 4.5:1; the picker is in Project
  Settings.
- **Colour-on-grounds** — a contrast reading at pick time against both
  reading grounds (v0.58.x).
- **Boot** — the app decides what to draw before drawing it (v0.62.0).
- **Installer** — NSIS per-user assisted plus a portable `.exe`,
  `.scriare` registered and answered, badge sidebar (v0.63.0).
- **Version in the app** — beside the wordmark, copies a report line
  (v0.63.0).

---

## 2. Language support — three different things wearing one name

This is the item most likely to be misjudged, so it is broken out.

### a. Turkish *text handling* — already done, and unusually well

`utils/textFold.ts` decomposes, strips combining marks, folds dotless ı
onto dotted i, then lowercases with the invariant locale. So `ist` finds
İstanbul and `aydin` finds Aydın. Every place that asks "is this the same
text" goes through it: Find, the `@` menu, the Content Browser, entity
aliases. One implementation, no drift. Nothing to do here.

**And it is the thing Twine does not do — MEASURED, 27 Sep.** Twine's web
app was opened on his machine, auto-detected Turkish from the system and
loaded with a fully Turkish interface. A story was created with the
passage text `İstanbul'da yagmur vardi. Aydın geldi.` and searched with
Find & Replace, Match Case **off** (confirmed `aria-checked="false"`),
RegEx off. The "Replace in All Passages" button enables only on a match,
which is the signal read:

| query | Twine finds it? |
|---|---|
| `yagmur` | yes — the positive control, so the mechanism works |
| `İst` | yes (exact, dotted capital) |
| `ist` | **no** — and `İstanbul` is right there |
| `IST` | **no** |
| `aydın` | yes (exact, dotless) |
| `aydin` | **no** |

This is the ordinary JavaScript failure: `"İstanbul".toLowerCase()`
yields `i` plus a combining dot, so `ist` cannot match it, and
`"Aydın".toLowerCase()` keeps the dotless ı, so `aydin` cannot either.
The test story was deleted afterwards.

**So Twine translates its menus into Turkish and then cannot find a
Turkish word.** That is the localisation layer nobody does, and Scriare
already does it. Worth reproducing on the Twine DESKTOP app before it
goes in a video — same codebase, so it should behave identically, but a
claim in a case study should be one he has seen himself.

### b. The spell-checker — MEASURED, and currently wrong for Turkish

Measured by launching the real app and asking Chromium:

```
enabled: true
current dictionary: ["en-US"]
available languages: 56  (Turkish "tr" is among them)
```

So spell-check is **on**, the dictionary is **English only**, Turkish
**is available and unused**, and there is no UI to change it — no
context menu either, so a writer cannot see suggestions or add a word.

**A writer working in Turkish today sees every word underlined red and
has no way to stop it.** For an app whose whole surface is prose, this is
the single most concrete "language support" gap there is, and it is
small: `session.setSpellCheckerLanguages([...])`, a setting to choose it,
and a right-click menu for suggestions. *~1 session.*

### c. The app's own interface — English only, and not cheap to change

No i18n library, no string table; every label is a literal inside a
`.tsx` file across ~40 components. Translating the UI means an extraction
pass first and then a permanent tax on every string written afterwards.
*2–3 sessions minimum, plus ongoing cost.*

**Settled 27 Sep, his call: (c) is off the table for now.** Do (b) and
(d); do not translate the interface.

Twine's translations are community pull requests against
`public/locales/*.json` (i18next) — a crowd a solo project does not
have, and its first Turkish screen already carries a typo (*"bilmeniz
gerekn"*). Chasing a translation count is a race that cannot be won and
rots on every new string.

The defensible position is the opposite one, and the measurement above
is the evidence for it: **every tool localises its interface; almost none
localise the writer's own text.** Scriare already folds Turkish
correctly; finishing the dictionary and the exported `lang` makes that a
complete claim for ~1.5 sessions rather than a permanent tax.

**A note on how to say it publicly.** "Twine is broken" is both unkind
and bad positioning — it is a free tool by a respected person and the
games community is small. The generous framing is truer anyway and
reads better in a case study: menus are the easy half of localisation,
and the half that matters while writing is the one everybody skips.

### d. The exported page has no `lang` attribute

Deliberate, and documented in `export/pageTemplate.ts`: `lang="en"` would
be wrong for a story written in anything else, and a wrong one is worse
than none. The fix is a project setting plus one line. Affects screen
readers, hyphenation and browser translation prompts. *~0.5 session,*
and it should ride along with (b) since both are "what language is this
story in".

---

## 3. Named, drawn, not built

### I2 — grouped choice editor

The v0.59.0 grouping landed on the **scene** panel only. The choice
accordion is still a flat stack — Display Text, Speaker, Appearance,
Destination, Conditions, Actions — about 580 lines inside a 2,082-line
Inspector, which the roadmap already flags as the largest surface in the
app that has never had a UI pass. *~1 session for the grouping.*

**This should come before the Dialogue**, or the Dialogue's inspector
gets built twice.

### The Dialogue — in-place choice options

Nothing exists. The word appears once in the codebase, in a comment
listing blocks that might exist one day. But the roadmap's estimate holds
up: `ConditionalBlock` is real and registered in the runtime, and an
option already carries `actions`, `conditions` and `whenUnmet` — so the
shape is already hand-buildable at the cost of one invented variable per
line. The work is removing the bookkeeping, not building an engine. The
two non-code decisions are settled on G6 (one badge on the graph node; an
option is an edge only if it leaves). *2–3 sessions, after I2.*

### Custom CSS on export

Nothing exists. The groundwork does: the exported page ships tokens
rather than baked colours precisely so one override recolours everything,
and the class contract is written down. The three commitments from G2
still stand — the class names become a published contract, the contrast
check has to start sampling the finished file instead of the tokens, and
the resolution order (ground → Choice Style → writer's CSS, which wins)
has to be stated rather than discovered. *~2 sessions.*

### Script export

Nothing exists — no PDF or DOCX path at all. *~0.5 session,* and for a
narrative-design portfolio it is the artifact studios actually ask to
see.

### Twine / Ink import and export

Nothing exists. *1–2 sessions each,* lossy in both directions, which
means the real work is documenting what does not survive the trip.

---

## 4. Gaps found in this audit that are not on any list

- **No images in scenes.** There is no Tiptap image extension in the
  dependencies. Twine and Arcweave both do this, and Arcweave's whole
  pitch is visual. Worth a decision rather than a silence.
- **The player is hard-coded "You"** (`PLAYER_SPEAKER_LABEL` in
  `types/speaker.ts`). A story with a named protagonist cannot print
  their name. Already on the post-launch list; noting it here because it
  is visible in the first minute of any playthrough.
- **Project Settings holds three things** — theme, start scene, choice
  styles. No story title, author, language, or player name. Every item
  above that needs a setting needs this dialog opened up first, which
  makes it a natural place to do several at once.
- **Find has no Replace.** Needs its own undo story and a preview.
- **Check Story does not check speakers.** A line attributed to a deleted
  character silently becomes narration.

---

## 5. Decided against, on purpose

Recorded so they are not rediscovered as gaps.

- **Translating the interface** — 27 Sep, his call. Twine's locales are
  community pull requests; a solo project cannot win a translation count
  and pays for it on every string afterwards. The position instead is the
  writer's-text layer, which Twine measurably does not have.
- **macOS build** — 27 Sep. Unsigned means "Scriare is damaged" on
  Apple Silicon, and Sequoia removed the Control-click bypass; signing is
  $99/year. The Mac answer is a playable exported story on the portfolio
  site, not a Mac build.
- **Merging themes and reading grounds** — a theme is the writer's room,
  a ground is the reader's page. Merging would make a colour survive
  eight grounds instead of two.
- **Mobile and cloud** — explored and mostly declined.
- **Crash-recovery journal** — the atomic write covers the cases that
  matter.

---

## 6. What actually blocks the launch

His three non-negotiables: the demo story, the video, the written case
study.

| Item | State |
|---|---|
| Export | done (v0.48.0) |
| Installer | done (v0.61.0–v0.63.0), confirmed on his machine |
| **Demo story** | **draft exists, not finished — blocks the other two** |
| **Video** | script and shot list written, needs the story to film |
| **Case study** | mostly written in the changelog; needs his screenshots |

**Nothing in sections 2, 3 or 4 blocks the launch.** All of it is elective
and all of it is post-launch by the roadmap's own rule.

The one exception worth arguing about: **if the demo story is written in
Turkish, the spell-checker (2b) stops being elective** — he would write
the whole thing under a red underline, and the exported page would carry
the wrong language for its readers.

---

## 7. Suggested order

1. **Demo story.** Unblocks the video and the case-study screenshots.
   (If it is Turkish, do 2b+2d first — one session — so he is not
   writing under a red underline.)
2. Video, case study, launch.
3. Then, post-launch, in this order: **I2** (1) → **the Dialogue** (2–3)
   → **script export** (0.5) → **Custom CSS** (2).

Script export is out of order by size on purpose: half a session, and it
produces the thing studios ask for.
