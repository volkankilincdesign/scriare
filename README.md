# Scriare — v0.33.0 — The Toolbar Learns the Language

## What's new (v0.33.0 — The Toolbar Learns the Language)

**Every control in the editor toolbar is now drawn in the app's own icon set, and a Choice group appears when your caret is inside a choice.**

The toolbar was the last place in Scriare still written in plain characters — `B`, `H1`, `•`, `"`, `⟸`, `⌫`, and two anonymous `✕` buttons — while the Content Browser, the graph and the tabs all speak in stroked icons on a 16-unit grid. That mismatch is most of why it read as dull: not under-designed so much as written in a different language from everything around it. Some of those characters were also simply wrong. Arrows are not text alignment. A straight typewriter quote is the one punctuation mark a writing tool should never show.

Nineteen controls, redrawn to the same grid and the same 1.3 stroke as the rest of the app. **Nothing moved and nothing was removed** — the complaint was about how the bar is drawn, not where its controls sit.

Three decisions worth naming:

- **B, I and U stay as letterforms**, but as real specimens: the B is bold, the I is italic, the U is underlined. Drawing those three as pictures would be less legible than the convention every editor already uses.
- **The colour controls now wear their colour.** A letter above a bar filled with the colour currently in effect, so the control answers "what will this apply?" without being opened. That is also what lets the two unlabelled `✕` buttons become proper reset controls, each sitting beside the thing it resets.
- **A Choice group appends when the caret is inside a Choice Block**, holding the two things you want without leaving the sentence: another option, and that choice's properties. It *appends* — nothing already on the bar ever moves sideways because of where your caret happens to be.

Every control now carries a real label, which matters more than it did: when a button was the letter `B` you could read it even with no tooltip. An unlabelled icon tells you nothing.

Seven new tests, on the two things here that aren't a matter of taste: the contextual group appends rather than inserts, and no control ships without a label. Both confirmed to fail on builds that break them. 101 tests.

## v0.32.0 — Choices Are Written, Not Configured

**A choice's text is now real writing, and everything the toolbar does to a sentence it does to a choice.**

Until this version a Choice Block was a single sealed object holding its options as strings in a hidden property. You typed a choice into a field in the Inspector, and what appeared on the page was a preview of that string. That is why the toolbar could never touch it: formatting in a rich text editor applies to *text in the document*, and a choice's label was not text in the document — it was data about the document. No amount of rearranging the interface could have fixed that. The floor had to move.

It has. Each option is now its own node in the scene, and its label is ordinary inline content — the same kind of thing as any other sentence you write. Which means:

- **You type choices where the choices are.** The caret goes into the choice on the page. The Inspector's Display Text field is gone, because there is nothing left for it to do.
- **The toolbar reaches them.** Bold a single word in one choice. Colour another. Change the size of a third. Nothing new was built for this — the toolbar already knew how to style text, and a choice label is finally text.
- **Undo, find and Play Mode treat it as prose**, because it is prose. Formatting written into a choice arrives in Play Mode intact, through the same rendering path as the rest of the scene.

Everything about an option that *isn't* its label — where it leads, what it requires, what it changes, and soon how the box around it looks — stays in the Inspector. That split is the one the whole app draws: styling belongs to text, properties belong to the thing.

**Every project written before this version converts on load**, losing nothing: destinations, conditions, actions and hide-or-lock all move across untouched. Two generations of the old shape are handled, and a project already in the new one passes through unchanged however many times it's opened.

This is groundwork as much as a feature. Per-choice appearance — a different fill on one option, a heavier border on another, set against a project-wide Choice Style — needs labels that can be styled independently, and now they can be.

Fourteen new tests. The migration was confirmed to fail on a build that copies only the label, the reorder on one that drops options it wasn't told about, the last-option removal on one that leaves an empty block behind, and the Play Mode formatting on one that falls back to plain text. 94 tests.

## v0.31.1 — Folded Means Folded

**A folded group no longer swallows scenes dropped in the empty space it used to occupy.**

Folding shrinks a group to a small block on screen, but it keeps its real dimensions so it can spring back to the right size when unfolded. Drop targeting was testing against those real dimensions rather than the block you can see — so a folded chapter went on quietly catching anything dropped anywhere in the large area it no longer appeared to own. You'd drag a scene into what looks like empty canvas, let go, and find it filed into a chapter that isn't visibly there. An invisible target is the worst kind, because nothing on screen explains what just happened.

Hit-testing now uses the rectangle actually being drawn. Dropping **on** the folded block still files the scene into that group — that's a real gesture, and the only one a folded group should answer to. Unfold it and the whole box is a target again.

**Folding a group now hides its sub-groups too.** The same oversight in a different place: a folded chapter left its sub-chapter's box floating over empty canvas with nothing in it, and that box could catch drops as well. Anything inside a folded group is off screen and undroppable, at any depth.

Five new tests, including the exact reported scenario. Both fixes were confirmed to fail on a build that tests the stored rectangle instead of the drawn one. 80 tests.

## v0.31.0 — One Word, Both Ways

Two loose ends from folding Frames into folders, both of which made a single object look like two.

**A group made in the Content Browser now appears on the graph.** It already worked the other way — "+ Group" on the canvas created a group in the tree instantly — but not in reverse, and not even after scenes were filed into it. The tree would say a scene lived in Chapter Two while the canvas showed it loose with no box around it. Not a contradiction, since the graph was simply silent, but it's a softer version of exactly the drift v0.28.0 existed to eliminate.

The rule is **a group is drawn once it holds a scene**, rather than the moment it exists. An empty group can't misrepresent anything — there's no scene whose home is being hidden — and a writer filing things into an empty "Cut scenes" shouldn't have boxes appear on a canvas they never asked to change. The box is drawn around the group's own scenes, which is the only truthful place for it; if they're scattered, it's big, and Auto Layout tidies that.

A box that appears this way isn't written to the project. It follows its scenes until the first time you move or resize it, at which point the group takes ownership of its geometry from exactly where it appeared. So it costs nothing until you touch it, and behaves like any other box the moment you do — dropping a scene inside files it, dragging one clear un-files it, folding works.

**"Folder" is now "Group" everywhere.** They have been one object since v0.28.0, and calling it two things was the last place the old two-hierarchy split was still visible in the UI. The internal `kind: "folder"` stays, along with identifiers like `createFolder` and `ContentFolder` — renaming those would mean migrating every saved project to change a string nobody reads, and a migration that can only break things and never fix one isn't worth running. Wherever the word appears somewhere a person can read it, it says Group.

Four new tests, including the two that matter: the box has to actually bound its own scene, and the auto-draw rule has to be what puts it there. 75 tests.

## v0.30.0 — Conditions

Variables have been able to change since v0.19.0 and nothing has ever been able to read them. Actions could set Trust to 3; no part of the story could ask whether it was. That made the branching model one-way — state could be written and never consulted — and it's the hole this version closes.

**A choice can now require a variable's state.** In the Inspector, next to Actions, each choice gets a list of conditions: pick a variable, a comparator, a value. All of them must hold. There is no AND/OR nesting and no expression field, on purpose — nestable any/all groups turn a writing tool into a query builder, and the overwhelming majority of real branching is a list of things that all have to be true. Each row has a **NOT** toggle for "only if you haven't met her", which covers the inverse without doubling every comparator into an "is not" twin.

A condition is the same shape as an Action — variable, operator, literal — because a condition *is* an action read instead of written. The rows look and behave identically, and nothing about variables had to change to support them.

**You choose what a failed condition looks like, per choice.** *Hide* removes the option entirely, so the player never learns it was there — what most branching fiction wants. *Lock* shows it greyed out with the reason spelled out: "Requires Trust is at least 3". Per choice rather than per project, because a story usually wants both in different places, and a locked door the player can see is a different narrative device from one they can't.

**Conditional Text** (`/conditional`) gates prose rather than a path. A passage that only appears when a condition holds is how a scene reflects what the player has already done without branching into a separate scene for every combination. It's a container, so everything inside is written normally — formatting, lists, even a Choice Block nested inside a gated section. In the editor it's marked with a dashed rule and a small "IF"; in Play Mode it renders with no marking at all, because if the reader can see it the condition passed, and a frame would only be telling them about machinery.

**A live variable readout in Play Mode**, because conditions are the first feature in Scriare whose correct behaviour is *invisible* — a hidden choice is indistinguishable from a choice that was never written, and there is no way to tell whether a gate works without seeing the number it tests. Bottom-right, closed by default, absent entirely from a story with no variables, and read-only: being able to poke values would make playtesting faster and would also mean the thing you tested isn't the thing a player gets.

Two rules are load-bearing and both are tested. **No conditions means always available** — otherwise every choice written before this version would silently vanish. And **a condition whose variable was deleted fails** rather than passing, so a gate whose question can no longer be asked stays shut. Both were confirmed to fail on builds with that logic inverted. 68 tests.

## v0.29.0 — Auto Layout, All the Way Down

**Auto Layout now arranges the inside of every group**, and resizes each one to fit what it holds.

Until now it laid out the top level and stopped: a group was placed as a single unit and whatever was inside kept its exact arrangement, untouched. That rule came from the Frame era and was right then — a frame was a box someone had drawn and filled by hand, so rearranging its contents would have thrown away deliberate work.

Folding frames into folders changed what a group *is*, and with it what "never undo the writer's organizing work" should mean. A group is a chapter now, and the inside of a chapter is precisely what ends up a mess after a run of imprecise drags — which is the exact situation someone reaches for this button to fix. Leaving it alone meant there was no way to tidy the inside of a chapter at all.

So the layout runs innermost-first: each group's contents are arranged, the group resizes around the result, and only then does its parent place it — which is why a nested chapter always lands fully inside the one that owns it rather than being sized against a stale footprint. Choices between scenes in different chapters collapse into one edge between those chapters, exactly as before.

It is a bigger, more destructive action than it used to be. That is the point, and the safety net is that it's a **single undo step** — one Ctrl+Z puts every position and every box size back. The button does the obvious thing; undo is there for when the obvious thing wasn't wanted. Building it any other way would have meant a second "Auto Layout (but really)" control, which is a worse answer to the same question.

Seven new tests, including the nesting case and the one-undo guarantee. The recursion itself was confirmed to fail the interior-layout tests when reduced back to top-level-only. 56 tests total.

## v0.28.0 — One Hierarchy

Scriare used to group scenes twice. Folders organised them in the Content Browser; Frames grouped them on the canvas; neither knew the other existed. A scene could be in the Prologue folder and inside the Ashfall frame at the same time and nothing was wrong — they were answers to different questions. The trouble is that two hierarchies over the same scenes don't stay parallel. Every drag in the graph made the panels disagree a little more, and only the writer knew which answer counted.

**Frames are gone. A folder now owns its box on the graph.** The rectangle you see and the folder in the Content Browser are one object: renaming it on the canvas renames the folder, deleting it there ungroups exactly as deleting the folder does, and dragging a scene into a box genuinely moves it into that folder — the tree reorganises itself as you rearrange the picture. Dropping a scene on open canvas moves it back out to the Story root. There is nothing left that can drift.

**Groups fold.** A chapter collapses to a single block carrying its scene count, and every connection crossing its boundary bundles into one labelled edge — "3 links" rather than three identical curves. Everything inside is hidden, at any depth, and comes back exactly as it was. Fold from the box's own caret, from the folded block, or by double-clicking it.

**Groups nest, which Frames never could.** A sub-chapter inside a chapter is a box inside a box, and the two rules that keep the picture honest are the ones worth knowing: dragging a box carries everything inside it recursively — scenes and sub-boxes alike — and a box dragged clear of its parent really leaves that folder, because where something sits is what decides who owns it. A scene joins the *deepest* box it lands in, so dropping into a sub-chapter joins the sub-chapter, not its parent.

A box resized past its parent's edge **grows the parent** rather than spilling outside it. Clamping the child instead would mean silently refusing a resize the writer clearly asked for, and letting it overflow would mean the picture contradicting the tree — which is the whole thing this version exists to stop. A resize never re-files anything, however the corners land: changing a box's shape isn't a statement about where it should live.

Auto Layout works the same as it did — a group containing scenes is arranged as one unit while everything inside keeps its exact relative arrangement — just driven by folders now instead of frames.

**Old projects convert on open**, with two rules chosen so nothing gets quietly rearranged. A frame becomes a folder carrying its rectangle, and the scenes that were inside it move into that folder — *unless* a scene was already filed in a folder by hand, in which case the folder wins and the frame becomes an empty group. Where the two hierarchies disagreed, the deliberately-built one is the one to trust. An empty frame survives as an empty folder rather than vanishing: it may be a chapter drawn before it was written, and silently deleting a named thing is never the right default. The legacy `frames` array and `scene.frameId` are dropped once converted.

Sixteen new tests cover exactly the ways the two systems used to drift apart, and the two that matter most — a scene drop re-filing in the tree, and a group drag re-filing itself — were confirmed to fail on builds with that logic removed. 50 tests total.

## v0.27.0 — Keys That Work Everywhere

**Ctrl+C, Ctrl+X, Ctrl+V and Delete now work on scenes and folders**, not just on text. Until now the Content Browser was the one part of the app that didn't behave like a file manager — everything had to go through the right-click menu. They follow the same rule Ctrl+Z got in v0.25.0: if focus is in the editor or a text field, the keys belong to that field; anywhere else they're about the project. All four are undoable, and Delete raises the same undo toast the right-click menu does, so no path through the app is quieter or less reversible than another.

**Which selection they act on** is decided the way every desktop app decides it without ever explaining: the panel you touched last owns the keyboard. The Content Browser and the Story Graph both keep their selection visible at the same time, deliberately, so "the visible selection" isn't one thing and something has to arbitrate. Each panel claims the keyboard on pointer-down — the gesture that precedes reaching for a key — and publishes its ids to a small store the shortcut layer reads. The selections themselves stay local to their panels; this is a mirror, not a second source of truth.

**Copying a set of linked scenes gives you the branch, not two loose scenes.** This is the part that would look right and be wrong. Copy two scenes that link to each other, paste, and the copies link to *each other* — while a choice pointing at a scene *outside* the copied set still points where it always did, because copying a scene that leads to Chapter Three should still lead to Chapter Three. Copying a folder brings everything inside it, selected or not. Pasting a root whose name already exists among its new siblings gets a " Copy" suffix; scenes inside a pasted folder keep their titles, since the folder already tells them apart.

Multi-scene **Duplicate** now rewires the same way, for the same reason — it was the one case that had always produced copies feeding back into the originals.

**Playwright is `playwright-core` now.** The full `playwright` package pulls browser binaries these tests never use: they launch Electron, not Chromium. `playwright-core` is 14MB instead of several hundred, and it was also the fix for `npm test` failing with *Cannot find package 'playwright'* — the dependency was added to `package.json` but never made it into `package-lock.json`, so an install that trusted the lockfile didn't get it. Both are corrected; run `npm install` once.

The suite is 34 cases now. The two new ones that guard real bugs — the link rewiring and the folder-contents copy — were each confirmed to fail on a build with that logic removed. One case drives the actual UI with real clicks and real keystrokes, because everything else drives the stores directly and something has to prove they're wired to each other.

## v0.26.0 — Undo, Out Loud

v0.25.0 made deletes reversible. This version acts on that, and puts a test setup behind both.

**The delete confirmations are gone, replaced by an undo toast.** All five of them — scene, folder, bulk selection, graph Frame, variable. A modal that stops you to prevent a mistake earns its interruption only while the mistake is permanent; since undo shipped, none of these are. So the delete now happens immediately and a quiet bar appears at the bottom of the window — *Deleted "The Ration Tin"  ·  Undo* — for nine seconds. The way out is offered after the fact, where it interrupts nobody, instead of in front of every single delete.

**The toast will not undo the wrong thing.** This is the part that would have made the feature worse than useless if it were left implicit. Delete a scene, drag two nodes in the graph, then click the toast: a naive implementation undoes the drag and leaves the scene deleted. So each toast records the identity of the history step it was raised for, and drops its button the moment that step stops being the one undo would reverse — whether because you did something else, or because you already undid it with Ctrl+Z. It keeps its message, so it never turns into a button that lies about what it does.

The confirm-dialog machinery itself is kept, unused and documented as such. The next thing that needs confirming probably won't be undoable — overwriting a file, discarding unsaved work on quit — and that is exactly what a blocking dialog is for.

**Tests are now a first-class part of the project.** `npm test` builds the app in a test mode and runs every `tests/*.spec.mjs` against the real packaged Electron app: 21 cases across undo and toasts. The test-mode build exposes the app's stores on `window` through a branch that `import.meta.env.DEV` strips from production entirely — verified by grepping the production bundle, so shipping costs nothing and nobody has to hand-edit `main.tsx` to run the suite, which is what made v0.25.0's standalone script easy to forget. Playwright is a devDependency now, so `npm install` before `npm test`.

There is no test framework, deliberately. What these tests need is to launch the real app and assert on its real stores; a framework adds configuration and vocabulary without adding any of that. If the suite outgrows a handful of files, Playwright's own runner is already sitting in the dependency tree.

**Three of the tests were confirmed to fail before being trusted**, on builds broken on purpose: neutering the prose merge made "undo keeps prose written after the undone action" report the old text; disabling the typing window made "typing a name is ONE undo step" undo one letter at a time; and removing the staleness check made "a stale toast does NOT undo the wrong action" undo the unrelated rename. A test that has never been seen to fail proves nothing.

## v0.25.0 — Undo

Until now the app had no undo at all outside a scene's prose. Ctrl+Z inside the editor was Tiptap's, and it worked; everything else — deleting a scene, deleting a folder, a bulk delete from a multi-selection, a move, a rename, an Auto Layout that rearranged the whole graph — was permanent the moment it happened, and autosave committed it to disk about a second and a half later. Confirmation dialogs ask "are you sure"; only undo answers "no, actually".

**Ctrl+Z / Ctrl+Shift+Z now step through project history** (Ctrl+Y also redoes, for the Windows habit), with an undo/redo pair in the top bar that names what it will reverse — "Undo Delete Scene" — so the shortcut is discoverable rather than folklore. Every structural action is covered: create, rename, delete and duplicate for scenes and folders; moves and multi-moves; bulk delete; favourites; scene and frame positions; frame resize; Auto Layout; the Start Scene; and every variable operation.

**It is snapshot-based, and that is cheaper than it sounds.** Every action in the store already builds a new project object out of the old one and never mutates in place, so the previous version stays intact for free and the two versions *share structure* — renaming one scene in a 200-scene project allocates one scene object and one array; the other 199 scenes are the same objects in both. A history step therefore costs roughly the size of that action's diff, not the size of the story. (Deep-cloning would have destroyed exactly that, which is why it isn't done.)

**Undo never rolls back your writing.** This is the part that would have been a data-loss bug if it were left implicit. Restoring a whole-project snapshot would also revert every word typed since — delete a scene, write two paragraphs somewhere else, press Ctrl+Z, lose the paragraphs. So scene content is treated as belonging to the live project rather than to the snapshot: for any scene that exists in both, today's prose wins. A scene that exists only in the snapshot — because the action being undone deleted it — keeps its own text, which by then is the only copy of it anywhere. The result is a clean division of labour between the app's two undo stacks: this one moves structure, Tiptap's moves words, and neither can clobber the other. Ctrl+Z routes between them by focus — in the editor or any text field it is that field's own undo, anywhere else it is the project's.

**One gesture is one step.** Two different things would otherwise have made undo tedious. Dragging a multi-selection in the graph calls the store once per selected scene from a single drop, so five scenes would have cost five presses; those are folded together by the task they arrive in, automatically, without every call site having to remember to open a transaction. And a text field wired to `onChange` fires once per keystroke, so renaming a frame to "Chapter Two" would have undone itself letter by letter; runs of edits to the same thing inside a 700ms window collapse into the step holding the name as it was before typing started.

History holds 50 steps, is wiped when a project is opened or closed, and is inert during Play Mode.

**This ships with the project's first automated test** (`tests/undo.spec.mjs`), deliberately standalone — no runner, no config, nothing added to `package.json`, so `npm install` is unchanged for anyone who never runs it. It drives the real packaged app and covers fourteen cases. The two that guard actual bugs were each confirmed to fail on a deliberately broken build before being trusted: neutering the prose merge made the "keeps prose written after the undone action" case report the old text, and disabling the typing window made "typing a name is ONE undo step" undo one letter at a time.

Confirmation dialogs were left exactly as they are. With undo in place, some of them are arguably redundant now — but that is a separate decision about how much friction a delete should carry, not something to change quietly in the same pass that built the safety net.

## v0.24.0 — A Quieter, Better-Built Monochrome

The palette stays black and white on purpose — colour belongs to content the writer assigns meaning to (choice blocks, errors, states), and chrome that competes with it makes that colour worthless. The brief was that it nonetheless felt dull. It did, and three separate causes were found, two of which turned out to be bugs rather than taste.

**The fonts were never loading.** The app requested Inter, Newsreader and Manrope from Google Fonts at runtime via an `@import`, while its own Content Security Policy was `style-src 'self' 'unsafe-inline'` — which blocks a remote stylesheet outright. The packaged app had been rendering in whatever the operating system happened to supply, in every build, online or off. All three are now bundled as variable fonts and confirmed loading; Inter and Newsreader carry their optical-size axis, so letterforms adapt to the size they're set at instead of one drawing serving both a 10px label and a dialog title. Considerable amount of the "generic" feeling was simply the intended typography never arriving.

**The brand mark was broken.** The same CSP had no `img-src`, so the logo — a `data:` URI SVG — was blocked and rendered as a broken-image icon in the top-left corner of every screen. `img-src` and `font-src` are now declared.

**The greys were mathematically grey.** Every neutral was chroma 0 — pure, computed grey, which reads as absence rather than as a decision. They now carry a trace of warmth (chroma 0.003–0.006 at hue 75): far too little to perceive as a colour, enough that the palette feels mixed rather than generated. The tonal ramp was also rebuilt. It used to step almost evenly (12 → 15 → 19 → 23 → 27), giving every surface identical weight and therefore no hierarchy, and it placed `--border-soft` at 22% against a `--surface-2` of 19% — a three-percent difference, meaning a large share of the app's borders were mathematically present and visually absent. Surfaces now sit closer together and borders further from what they divide, so structure comes from a few deliberate edges and from spacing.

**Emoji are gone from the chrome.** The content categories and tree rows were marked with 👤🌍📝🖼📁📄 — full-colour glyphs drawn by the operating system, so they fought the monochrome palette and rendered in a different illustrative style on every platform. They're replaced by a small set of stroked icons (`components/common/Icon.tsx`) that inherit `currentColor` and follow the theme.

**The minimap was the loudest thing on screen.** It coloured every scene with `--accent`, which in this palette is a near-white fill — so the graph's glance-at-it corner was a set of blown-out white blocks. Now muted, and given the same edge treatment as the Controls widget.

**The light theme's editor was unreadable.** The reading column applied Typography's `prose-invert` unconditionally — correct on dark, exactly inverted on light, where it rendered pale text on a pale page. Prose colours now map to the app's own theme tokens and follow whichever theme is active. Long-form prose also gets its own tone (`--text-reading`), a step below the brightest UI text, because full white over paragraphs of story is harsh to read at length.

**Density.** More air in the Inspector, top bar, toolbar and content rows; softer corners on the choice cards; the Inspector widened to 320px so a collapsed choice's summary fits on one line again. Plus the details that carry perceived quality without any colour: a single consistent keyboard focus ring, styled text selection, tabular figures, and scrollbars that recede into the surface instead of sitting there as bright light-mode artefacts inside a dark application.

Nothing about the drag-reorder logic was touched. The Choices list spacing changed, which is safe by construction — the drag measures its own geometry from the rendered layout rather than assuming any particular gap.

## v0.23.x — 📌 The Choices List Stops Moving While You Drag It

## What's new (v0.23.4 — Fixed: The Whole Drag Built on Measurements Taken Mid-Animation)

Reported as the movement *after* releasing a choice happening behind an expanded one, reproducible by expanding a choice and then dragging a collapsed one from below it to above it. The previous two versions addressed how the drag and the drop are painted; this is the actual defect underneath, and it is bigger than a paint-order problem.

`getBoundingClientRect` reports where an element is being *painted*, which mid-transition is a point part-way through the animation — and a transition back to identity leaves `style.transform` reading empty while the computed transform is still a matrix, so an animation in flight is invisible to every obvious check. The drag takes its one and only measurement at the grab, and never checked for that. Expanding a choice slides everything below it; grab one of those choices before the slide finishes and the measurements describe no real layout at all.

Caught in the act: at the moment of a grab a choice whose true position was 514px reported 397px, while its neighbour reported its full 379px height — putting the two 111px inside each other. The spacing derived from that came out **negative** (−49px), which corrupts every landing position computed from it. So the drag previewed a layout that was never going to happen, and the drop then snapped roughly 190px to the real one, with choices sliding past each other to reach positions they should already have been in. That correction is what the reported "movement happens in the back" actually was.

Fixed by settling any in-flight animation to its end state before measuring — anything mid-slide simply arrives early — so every number the drag runs on is a real layout position rather than an animation frame. This is the same fix, for the same reason, that the reflow animation already applies before *its* measurements (v0.22.3); the grab path never got it.

Verified by reproducing the exact condition: dispatched a grab 40ms into the slide, with the choice's computed transform confirmed as `matrix(1, 0, 0, 1, 0, -317)` immediately beforehand. Measurements now come back `shift: 68` with landing positions `[129, 514]` — correct — where the same scenario previously produced `shift: -49`. Full regression re-run: 12/12 landing combinations correct, drops land exactly where the landing zone showed, and non-dragged choices move 0px at release.

Also in this version: the choice gliding into place after a drop is painted above the rest of the list for the length of that glide, rather than becoming an ordinary row the instant it's released and travelling under whatever it passes.

## What's new (v0.23.3 — Fixed: Choices Sliding Aside Behind the Landing Zone When Dragging Upward)

Reported, and correctly narrowed down to one case: dragging a collapsed choice *upward* past an expanded one, the expanded choice's slide looked like it happened behind something. Dragging the same pair downward looked right.

It did, and the asymmetry was real. Nothing in the list declared its depth, so the placeholder and the choices all painted at the same level, where document order decides the winner. The placeholder keeps the dragged choice's original position for the whole gesture — so dragging up it sits *after* the choice it's passing, and paints on top of it; dragging down it sits *before*, and paints underneath. The same code, opposite appearance, decided entirely by which direction the drag happened to go.

Fixed by stating the depth instead of inheriting it: the choices sit on a layer above the landing placeholder, always. They're solid objects and it's the gap they're moving around, so it belongs underneath them in both directions. Confirmed by capturing mid-slide frames (with the transition temporarily slowed so the crossing is unambiguous) in both directions — they now match.

No change to movement, timing, or the drag logic; this is paint order only.

## What's new (v0.23.2 — The Dragged Choice Now Looks As Lifted As It Is)

Reported: dragging a collapsed choice across an expanded one looked like it was passing *behind* it.

It wasn't — checked first, and the floating choice has always genuinely been in front, clipping whatever it crosses. The problem was that nothing said so. Tailwind's `shadow-lg` is a black shadow, which over a near-black panel is simply invisible, and the floating card's background and border are the same tokens every other choice uses — so at the moment it overlapped something, there was no edge, no shadow, and no tonal difference to separate the two. A card that doesn't read as lifted reads as sliding underneath.

Replaced with three cues, all of which work on both themes: a 1px ring in the brighter border tone (lighter on dark, darker on light, so it separates either way), plus two shadow layers — a tight one for the edge and a wide soft one for the cast — weighted to register against a 12%-lightness ground without blowing out on the light theme. The shadow also follows the card's own 6px corner radius now, instead of boxing a rounded card inside a rectangle.

Checked in all four combinations: collapsed over collapsed, collapsed over expanded, expanded over collapsed, expanded over expanded. Nothing about the movement changed — this is purely what the floating card looks like.

## What's new (v0.23.1 — Fixed: The Jolt at the Moment of Release)

Reported straight after v0.23.0 landed: the drag itself felt right, but letting go produced a jump — the dropped choice and the one it swapped with both visibly re-ran their move instead of simply settling.

Cause: the effect that animates the list after a real reflow stands down for the duration of a drag (v0.23.0's whole point is that a drag no longer causes one), which left its "where everything was last time" baseline frozen at the pre-drag layout. At the drop it woke up, compared the committed order against that stale baseline, and dutifully animated every choice from where it sat *before the drag* to its new home — replaying a movement the drag had already completed on screen.

Fixed by recording where the choices actually are at the moment of release — displaced by the drag's transforms, which is already the committed layout — as that baseline. The two layouts then agree and there is nothing left to animate.

Measured, since this is too fast to judge by eye: sampling every choice's position every ~16ms through the drop, the non-dragged choices now move **0px** — in a four-choice list, dragging past a tall expanded choice, and dragging up or down alike. Before the fix the same measurement showed a neighbour travelling a full row height (68px) away from its resting place and back. The only motion left at release is the dropped choice's own 4–35px glide from wherever the pointer let go to its slot, which is the intended catch-up rather than a jump.

## 📌 v0.23.x is the pinned reference point

Confirmed good by Volkan on first use, after the long run of drag-reorder attempts recorded below. This supersedes the earlier v0.22.6 pin. `git tag v0.23.0` marks the commit it was confirmed on and `v0.23.1` the release-jolt fix on top; if future work regresses the Choices drag, this is the point to compare against or return to.

The settle animation (180ms) and the dead band (6px) are the only tuning values left in the interaction, both confirmed at these defaults rather than guessed — they're one-line changes at the top of the drag effect and the pointer effect in `InspectorPanel.tsx` if they ever want revisiting.

## What's new (v0.23.0 — Drag Reordering Rebuilt on a Layout That Doesn't Move)

Every fix from v0.22.6 through v0.22.12 tuned *when* a swap should fire — top-edge crossing, near-edge crossing, near-edge plus a percentage, cursor-based instead of card-based, each with its own constants and a commit delay on top. Each one fixed a real, measurable bug, and the feel still wasn't right. This version stops tuning the threshold and changes the thing underneath all of them.

**The problem was that the list physically reordered while you were dragging it.** Every previous version moved the choices into their new flow positions mid-gesture. That means the geometry the reorder decision *reads* was being changed by the decision itself: measure a neighbour to decide whether to swap past it, swap, and now that neighbour is somewhere else — which changes the answer to the question that just triggered it. That feedback loop is where the flickering came from, why thresholds seemed to move while you were reaching for them, and why smooth motion had to be switched off (an animating choice is a choice whose measured position is a moving target, so correct reordering and smooth motion were mutually exclusive). Every smoothing mechanism added since — rest-rect snapshots, the 120ms commit delay, disabling animation during a drag — existed to paper over instability that shouldn't have been there.

**Now the list's layout is frozen for the whole gesture.** The choices keep their positions; they're moved only by CSS transforms computed from a single measurement taken at the instant of the grab. Nothing reflows, so nothing the logic reads can move underneath it — the feedback loop isn't fixed, it's structurally impossible. Verified directly: the Choices list's height stays identical from grab to drop, where before it changed on every swap.

**Because layout can't move, the swap threshold could be replaced with something that needs no threshold at all.** Instead of asking "have I travelled far enough past this neighbour yet?" — a question with no good fixed answer for a list whose rows range from one line to a fully expanded form — it now asks "which landing position is nearest to where this choice is actually floating right now?" There is no constant to guess: it adapts itself to any mix of collapsed and expanded choices, and by construction keeps the landing zone as close to your pointer as the list's real geometry allows. Measured: the landing zone sits a median of 27px from the pointer. It also means the earlier fixes' central tradeoff disappears — a rule that fires *early* necessarily throws the landing zone far from your pointer, because with a tall neighbour the two candidate landing positions are hundreds of pixels apart. That is very likely what still felt wrong after v0.22.12.

**The motion is smooth again**, for the first time since v0.22.11 disabled it — choices glide into place rather than snapping, and the 120ms "are you sure" delay is gone, so it responds immediately instead of pausing and then jolting.

**Two guessed constants are gone entirely.** The 28px bottom "clearance" is replaced by clamping to the real range of landing positions — which, because reordering can't change how tall the list is, works out to exactly "stays within the Choices section" with nothing invented. The 20% padding and the commit delay are gone with the threshold rule they belonged to. The one tuning value left is a 6px dead band, which isn't a threshold — it just stops the zone twitching when the pointer sits exactly between two slots.

**Also fixed: scrolling the panel mid-drag.** Freezing the geometry introduced a new way to be wrong — if the panel scrolls, frozen viewport coordinates describe where the choices *were*. The scroll is now subtracted back out. Verified: after scrolling 200px mid-drag the landing zone stays 9px from the pointer, where uncompensated it would have been ~200px off.

Verified with Playwright against the packaged app: every landing position reachable in all 12 tested configurations (collapsed lists, lists with an expanded sibling, and dragging the expanded choice itself); zero mismatches across 15 drops between *where the landing zone said it would go* and *where it actually went*, including with expanded rows; no overlapping cards and no oscillation under deliberately erratic reversals; the list's height provably constant throughout a drag.

Known gap, unchanged from before: there is no auto-scroll when dragging toward the edge of a long list, so a choice can only be dragged to a slot that is currently on screen.

## What's new (v0.22.12 — Fixed: Downward-Drag Overshoot; Added a Visible Landing Zone & Commit Delay)

A direct follow-up to v0.22.11's fix, from testing it against a real 4-choice list: reachability was still broken for one specific case — dragging to the second slot specifically failed, while first, third, and last all worked. Tested every (start choice, target slot) combination in a 4-choice list to pin it down exactly: every *downward* drag aimed at a middle slot landed one slot too far — `A → slot 1` produced `B,C,A,D` instead of `B,A,C,D`, and so on, but only downward, and only when the target wasn't the last slot.

Root cause: v0.22.11's swap rule compared the dragged choice's own top/bottom edge against a sibling's near edge. The drag handle sits near the TOP of a choice, so the cursor is always close to the dragged card's top — but downward comparisons used the card's BOTTOM edge, which trails behind the cursor by almost the card's entire height (worse for a tall expanded card, where that's 350+ pixels). Aim the cursor right at a target's visual position and the card's real bottom edge has already sailed past it into the next slot, every time.

Fixed by comparing the CURSOR position itself against each sibling's edge, not the dragged card's own edge — the cursor has no grab-point-dependent offset, so it's exactly where the person is pointing regardless of where on the card they grabbed it or how tall it is. Verified against all 12 reachable (start, target) pairs in a 4-choice list: zero mismatches.

Two more changes from direct design discussion about how this should feel, not from a bug report:

**A visible landing zone.** The dragged choice's slot in the list — previously an invisible spacer that only held space so siblings didn't jump — is now a dashed outline sized to the dragged choice's own height, showing exactly where it'll land if released. Siblings still physically slide into their real position around it (nothing about the "see the actual final layout as you drag" feedback changed) — the zone just makes the target explicit instead of implicit, closer to how Notion/Figma-style insertion indicators read, adapted for choices whose heights can vary a lot (a line can't communicate "this opens up a 400px gap" the way a properly-sized zone can).

**Percentage-based padding, not a bare edge touch.** The near-edge rule alone (swap the instant the cursor touches a sibling) read as too sharp/hair-trigger for short collapsed choices. The fix isn't a fixed pixel buffer (the same "guessed constant" problem as the original EDGE_CLEARANCE) — it's a percentage of the target sibling's OWN height (20%), so the cursor has to move solidly past the boundary before it commits, scaled automatically to whatever that sibling's actual size is.

**A flat, time-based commit delay.** A swap target has to be the cursor's target for ~120ms before it actually applies — deliberately a flat delay, not scaled to the sibling's size, so crossing a tall expanded choice doesn't ask for more patience than crossing a short one, just the same brief pause every time. Releasing before that delay elapses discards the pending swap rather than rushing it through.

Verified: all 12 pairwise start/target combinations in a 4-choice list land correctly (previously the second-slot case failed on every downward attempt); the original tall-sibling dead-zone scenario now swaps at roughly the 20%-padding distance (~100px for a ~380px sibling, versus the original bug's ~390px and the intermediate fix's near-instant ~0-9px); jitter/erratic-speed stress produced zero overlaps and zero console errors; a tall, expanded dragged choice still reaches the last slot cleanly.

## What's new (v0.22.11 — Fixed: Reorder Dead Zones & the Real "Collapse" Cause)

This is the fix for the bug v0.22.7 through v0.22.10 went looking for and never found — root-caused and verified this time, not guessed at. Starting point: dragging a choice past a sibling with its accordion open needed to travel almost that sibling's *entire height* before anything happened. Measured directly — dragging a collapsed choice up past one ~380px-tall expanded sibling took roughly 390px of cursor travel to register a single swap. That's because the old reorder rule swapped once the dragged choice's own top edge passed a sibling's top edge — and a sibling's top edge sits at the *far* end of it from a dragged choice approaching from below, so passing that edge meant passing the whole card first. That's the literal shape of "too much space to drag through."

Fixed by comparing against the *near* edge instead: a sibling that started above the dragged choice swaps once the dragged choice's top clears that sibling's *bottom*; a sibling that started below swaps once the dragged choice's bottom clears that sibling's *top*. Both reference the sibling's own measured rect — nothing here is a guessed pixel constant, and nothing depends on the dragged choice's own height beyond what's captured once at grab, so the trigger point is "as soon as you've visibly reached it," whether the sibling is a one-line collapsed row or fully expanded with Actions open.

The first version of this fix re-measured each sibling's position live, on every pointer move — and it oscillated wildly the instant a swap put the dragged choice ahead of a tall sibling: that sibling's own on-screen position immediately shifts as a *result* of the reorder (it now renders one slot further down), which flips the very comparison that had just triggered it, swapping straight back, then forward again on the next pointer move, forever. That is almost certainly the actual mechanism behind the "choices rapidly snap together" bug reported across v0.22.6 through v0.22.10 — a live feedback loop between the reorder decision and the layout it was reading, worst (most visible) whenever a tall expanded choice was involved, which matches every report so far. The fix: every sibling's rect is captured once, the instant a drag starts, and never re-measured while that drag is in progress — since no other choice ever changes position relative to any other choice during a drag (only the dragged one moves through them), that snapshot stays valid and stable for the whole gesture. Siblings also stop getting an animated glide into their new slot while a drag is actively happening (they still get one for expand/collapse and the post-drop settle) — that glide was the other half of the same problem, since a still-transitioning sibling's rect is a moving target for exactly as long as the animation runs.

Verified directly: the same ~390px dead-zone scenario now swaps in single-digit pixels; dragging a short choice down through four siblings (one ~380px expanded) to the last slot and back, at both smooth and deliberately erratic/jittery cursor speeds, produced zero overlapping cards and zero order oscillation across the whole range; dragging a *tall, expanded* choice itself down through collapsed siblings to the last slot reached it cleanly, same result; every transform reset cleanly to none after drop, with no stuck offsets. None of v0.22.7 through v0.22.10 are reintroduced by this — this is new, isolated work built on the v0.22.6 baseline and re-verified from scratch, kept below for the record.

## 📌 Version history note

v0.22.6 was pinned here for a while as the project's known-good reference point, after a run of unsuccessful fix attempts (v0.22.7–v0.22.10, kept below for the record). **v0.23.0 at the top of this file now holds that pin.** Git history still starts from the v0.22.6 baseline commit (`git tag v0.22.6-baseline`) and every version since is its own commit on top, so "go back to version X" stays a real, mechanical `git checkout`/`git revert`.

v0.22.7 through v0.22.10 (which added on-content-aware drag bounds, gap-based spacing, and a couple of unsuccessful attempts at a "choices collapse together" bug that was never actually reproduced or root-caused at the time) are NOT included in this version — see the record kept below, each marked unsuccessful. v0.22.11 above independently arrives at a real fix for what those were chasing.

~~## What's new (v0.22.10 — Removed the Drop Catch-Up Animation) — UNSUCCESSFUL, NOT INCLUDED~~

~~v0.22.9's scroll-anchoring theory was wrong — called out directly, since it was reported back confidently and turned out not to be the cause. That scrollbar was the Rich Text editor's, not the Choices panel's, and the reported "choice collapses onto the previous one" behavior was still there afterward.~~

~~Went back and re-tested exhaustively: dragging to the last slot and holding-with-a-slight-move, both with many small real-timing-like pointer steps (not the coarser synthetic jumps used earlier) rather than a handful of large ones, repeated rapid drags back to back, choices with very different content lengths so row heights aren't uniform, and checking not just visual positions but the underlying choice data itself for duplicate or missing ids. Every one of those came back completely clean — no overlap, no duplicate or dropped choices, correct final order every time. I could not reproduce the reported behavior in this environment despite deliberately trying to provoke it.~~

~~Given that, rather than keep guessing, I removed the piece of this system most likely to be the actual cause even without a confirmed reproduction: the "catch-up" animation added this session that plays when a choice is dropped, sliding it from wherever the cursor released it to its real resting slot.~~ **Reported as still broken after this version shipped — the theory was wrong.**

~~## What's new (v0.22.9 — Fixed: Choices Silently Sliding During Drag (Scroll Anchoring)) — UNSUCCESSFUL, NOT INCLUDED~~

~~Reported: dragging a choice to become the last one made it collapse onto the choice above, the two sticking together as if there were one fewer choice; holding the last choice and moving it slightly upward did the same. Found the Inspector panel's own `scrollTop` walking from 100 down to 0 entirely on its own during a drag, with zero scroll input — attributed to the browser's built-in "scroll anchoring" heuristic, and fixed with `overflow-anchor: none`.~~ **Reported as still broken after this shipped, and the underlying premise was wrong — the scrollbar in the report screenshots belonged to the Rich Text editor, not the Choices panel.**

~~## What's new (v0.22.8 — Choice Spacing Made Structural) — UNSUCCESSFUL, NOT INCLUDED~~

~~Reported: choice cards rendered stacked with no gap between them. Replaced the `space-y-1.5` margin-based spacing with flex `gap` on both the Choices list and its wrapper, closing off the exact class of bug that caused v0.22.5's 12px overlay margin issue.~~ **A real structural improvement in isolation, but did not address the actual reported symptom — not included in the pinned baseline.**

~~## What's new (v0.22.7 — Content-Aware Drag Bounds) — UNSUCCESSFUL, NOT INCLUDED~~

~~Replaced v0.22.6's fixed 28px clearance with a clamp derived from the real, live top edges of sibling choices, so the drag bound scales with actual content instead of any guessed constant.~~ **Fixed a real, confirmed issue (the fixed clearance looking disconnected for tall expanded choices) but not the collapsing/overlap issue reported afterward — not included in the pinned baseline.**

## What's new (v0.22.6 — Fixed: Last Slot Unreachable When Dragging) — 📌 baseline commit

v0.22.5's bounds clamp had an overcorrection: it reserved the full height of the dragged choice when computing how far down it could go, so the choice's rendered bottom edge could never pass the Choices section's bottom edge. That sounds right, but reorder is decided purely by the dragged choice's TOP edge passing a sibling's top edge — and reserving the dragged card's own full height put that top-edge threshold at or above every sibling's own top the moment the dragged card was at least as tall as them, which is true for almost any list. In effect, no choice could ever be dragged into the last slot.

Fixed by using a small fixed clearance (28px — enough of the card has to stay inside the section to still read as "bounded," not the whole thing) instead of the dragged card's full height when computing the bottom clamp. The drag is still visibly contained to the Choices list — it can't run off into the toolbar or off the bottom of the window — but every slot, including last, is reachable regardless of how tall the dragged (possibly expanded) card is.

## What's new (v0.22.5 — Smooth Drop & Bounded Drag)

Two more refinements to the Choices Inspector's drag-to-reorder, both from direct feedback on how it felt in use:

**The dragged choice no longer freezes for almost a second after you let go.** Releasing the pointer used to leave the choice stuck exactly where it was dropped for a noticeable beat before it snapped into its real resting slot. The cause was a React anti-pattern in the drop handler: the code that commits the final order and applies it to the document (`applyChoiceBlockOptions`, which synchronously triggers a store update) was running *inside* a `setState` functional updater — a side effect with further state-mutating consequences firing during React's render phase, which could desync that commit from the rest of the update. Fixed by mirroring the live drag order and position in plain refs (updated synchronously wherever the corresponding state setter is called) and reading those refs at drop time instead of reaching for a stale value through a functional updater. On top of that, the drop itself now gets its own catch-up animation: the choice's last on-screen position (from the floating overlay, not a rough guess based on its old flow slot) is recorded at release, and a dedicated effect slides it smoothly from there to its true resting position the moment the real element remounts — instead of teleporting. Verified with a Playwright test sampling the dropped choice's position every ~20ms after release: it now settles within ~140ms with no mid-flight stall, well clear of the "almost a second" freeze reported.

**Dragging is now clamped to the Choices section itself.** A dragged choice could previously follow the cursor indefinitely — up into the toolbar, down off the bottom of the window. It's now bounded to the Choices list's own box: the container's live position is measured on every pointer move and the drag position is clamped between its top and (bottom minus the dragged choice's own height), so the choice can never float above the first slot or below the last one. Chasing down the last few pixels of this turned up an unrelated, genuinely interesting bug: the floating dragged choice sits as the second child of a `space-y-3`-spaced wrapper, so Tailwind's spacing utility (which adds `margin-top` to every non-first child) was quietly handing it a 12px top margin. That's invisible for an element in normal flow, but for a `position: fixed` element, the CSS `top` offset positions the *margin* edge, not the visible border edge — so the drag was consistently landing 12px lower than intended, which showed up as the clamp letting the choice overshoot the container's bottom edge by exactly 12px. Fixed by zeroing that margin explicitly on the overlay. Verified with a Playwright test dragging to clientY values far above and far below the panel and measuring the overlay's rect against the live container's rect — both edges now clamp to the pixel.

## What's new (v0.22.4 — Top-Edge Drag Reordering)

Reordering choices by drag now swaps based on the dragged choice's own TOP edge passing a sibling's top edge, instead of comparing the dragged choice's CENTER against each sibling's center. The old center-based rule made the swap threshold depend on the dragged choice's own height — dragging a tall, expanded choice (Display Text, Destination, Actions all open) past short, collapsed ones put that threshold somewhere very different than dragging a collapsed choice would, which read as the reorder "recalculating" a different trigger point mid-drag depending on what happened to be expanded. Top-edge comparison only depends on where the drag has actually reached, so it feels identical regardless of what's expanded or collapsed — the new slot is simply however many choices' top edges currently sit above wherever you've dragged to.

Verified directly against the app's own reorder decision (not just the visible end result): dragging an expanded choice past a collapsed sibling now swaps within a few pixels of crossing that sibling's top edge, not somewhere near its center — confirmed with both an expanded/tall dragged item and the plain collapsed-choices case.

## What's new (v0.22.3 — Fixed: Stuck Gaps Between Choices When Switching Fast)

Found the actual bug behind "switching choices too fast bugs the panel": v0.22.2's hardening pass fixed several real edge cases but missed the one actually causing the big blank gaps between choice rows shown in the report. Root cause: the sibling-animation code (FLIP — "slide the other choices smoothly into place when the list reflows") measures each choice's position with `getBoundingClientRect()`, but that reports an element's current *visual* position — including any CSS transform still mid-transition — not its true position in the layout. Toggling several choices open and closed quickly fires that measurement again well within the previous change's 150ms animation, so it was reading an in-between, still-animating position instead of the real one. That wrong number then got saved as the *next* comparison's baseline, so the error didn't stay a one-frame glitch — it fed forward and compounded with every further change, capable of driving a choice's position hundreds of pixels off from where it should be, which is exactly the empty space seen sitting between otherwise-normal, unrelated choices.

Fixed by always snapping every choice's transform back to identity *before* measuring anything, on every pass — synchronously, before the browser paints, so there's no visible flash; a choice mid-animation just stops exactly where it visually was, and the next measurement reads its real, current position instead of a contaminated one. Verified by reproducing the bug directly: rapid toggling with zero settle time between clicks against the pre-fix code reliably opened a 200+px gap between rows; the same test against the fix stays at the normal ~6px row spacing throughout, including immediately after the rapid interaction.

A polish pass on top of Sprint 9C's Choices Inspector, aimed squarely at "it's very easy to bug the panel if you switch choices too fast" — rapid clicking between different Choice Blocks, rapid expand/collapse of different choices in the same block, and a drag reorder that doesn't end cleanly. None of these are meant to be reachable in normal use, but the drag/animation bookkeeping was trusting a "clean pointerup, one thing changing at a time" world that fast, out-of-order interaction doesn't actually guarantee — so it's hardened to self-correct instead of getting stuck:

- The FLIP animation that slides sibling choices into place after a reorder only refreshed its "where things were" snapshot when the list itself reordered — expanding or collapsing a choice (which reflows everything below it) never touched it. Toggle several choices open and closed quickly, then trigger a reorder, and the sibling animation was comparing against a long-stale layout — capable of producing a big, wrong "catch-up" slide. The snapshot now also refreshes on every expand/collapse, which as a side effect means choices sliding out of the way of an expanding neighbor now animate smoothly too, instead of just snapping.
- That same animation could schedule two competing "reset the transform" callbacks on the same choice if a second layout change landed before the first one's callback had fired — now any pending one is cancelled before a new one is scheduled, per choice.
- A drag reorder only ever cleaned itself up on a clean `pointerup`. Anything else ending it — losing pointer capture (`pointercancel`), or the window losing focus mid-drag (alt-tab, a native dialog) — left the drag state stuck: the floating dragged choice frozen in place, unable to finish. All three now go through the same cleanup path, and whatever's currently in progress still commits rather than being silently discarded.
- If a dragged choice ever stopped existing in its block's current option list (self-healing safety net, not expected to fire in normal use), the drag now resets itself immediately instead of leaving an orphaned floating accordion with nothing under it.
- Starting a new drag while a previous one is somehow still active is now a no-op rather than stacking a second drag on top of a half-cleaned-up one.

Verified with a Playwright stress test simulating rapid block-switching, rapid expand/collapse cycling with no settle time between clicks, and a drag interrupted mid-gesture by a window blur — checked for orphaned floating overlays, stuck oversized spacers, and console errors after each.

## What's new (v0.22.1 — Choice Block Inspector UX Refinement, Sprint 9C)

Sprint 9B's Choice Block Inspector refactor was working as designed — this sprint is a pure refinement pass on top of it: evaluate → preserve → polish, no redesign.

**Smooth drag reordering.** Dragging a choice in the Inspector could snap or jump instead of tracking the cursor, especially once it crossed a neighbor and the list live-reordered mid-drag. The cause: the dragged accordion was rendered inline in the reordering list, so as its index shifted its DOM flow position moved to the new slot — and the drag's `translateY` offset (a delta computed once at grab) then got added on top of that new, different base position, producing a visible snap. Fixed by lifting the dragged accordion out of document flow entirely: its original slot becomes an invisible height-preserving spacer, and the accordion itself renders as a `position: fixed` overlay whose position is computed directly from the cursor every `pointermove` (`clientY` minus the offset captured at grab), with nothing else's position ever entering the calculation. It now has nothing to jump relative to, and no longer needs to know where its landing slot currently is. Everything else about the drag — live reordering as you cross a neighbor's midpoint, the FLIP animation for siblings sliding into place — is unchanged.

**Create Scenes and Variables without leaving the Inspector.** A Choice's Destination dropdown and an Action's Variable dropdown each gained a "+ Create..." option, so a writer configuring a choice no longer has to stop, open the Content Browser or Variable Manager, create the thing, and find their way back. Picking "+ Create New Scene" creates a Story scene immediately and auto-selects it as that choice's destination — via a new store action, `createUnlinkedScene`, deliberately separate from the Content Browser's `createScene` because it must NOT navigate the writer away from the scene they're currently editing (the existing `createScene` still does, by design, for its own "+ Scene" button). Picking "+ Create Variable" opens a small inline form right there in the Action row — Name and Type, per the brief's own mockup — and on Create wires the new variable straight into that action, via a new `createVariable(name, type)` store action that mirrors the Variable Manager's `addVariable` but returns the finished variable's id synchronously instead of starting blank. Neither addition touches or replaces the Variable Manager or the Content Browser's own scene creation — both remain exactly as they were, for anyone who prefers those flows.

**Choice creation restored to the Rich Text editor.** Sprint 9B's block preview had no way to add a choice — only the Inspector could. The Choice Block's editor preview now has its own "+ Add Choice" button alongside "Remove block," and it goes through the exact same `applyChoiceBlockOptions` transaction path the Inspector's "+ Add Choice" already used, so both surfaces create identical Choice objects (`{id, text: "", targetSceneId: null, actions: []}`) and stay synchronized automatically — an addition from either one shows up in the other without any extra wiring, since both are just two views onto the same underlying document.

## What's new (v0.22.0 — Choice Block Inspector Refactor, Sprint 9B)

Editing a Choice Block's behavior now happens entirely in the Inspector — the editor stays a writing surface. Clicking anywhere inside a Choice Block selects the whole block as one object (not a single choice line the way it briefly worked in v0.21.0); the block itself now renders as a compact, read-only preview in the document — numbered choice lines and their destinations, at a glance — while the Inspector's new **Choices** section shows every option in that block as its own collapsible accordion. Any number of choices can be expanded at once, independently, so switching from editing option 2 to option 3 no longer means clicking back into the editor first. A collapsed accordion still shows what it's configured to do — its destination, its condition count, its action count — so a writer can scan a whole block's shape without opening every row. Choices can be added, removed, and reordered directly from the Inspector; reordering is a direct drag — the accordion you're holding follows the pointer in real time and the list reorders live as you cross a neighbor, with no browser drag-ghost and no separate placeholder, matching the same "the thing you're moving is the thing that moves" feel as dragging a scene on the Story Graph.

Underneath, every Choice edit — from the editor's own block preview or from the Inspector — now goes through one path: a real ProseMirror transaction dispatched on the live editor instance, via a small new `editorStore` that lets the Inspector (a sibling panel) reach the mounted Tiptap document. This replaces v0.21.0's `updateChoiceOption`, which wrote straight to the saved project without the live editor ever seeing the change — harmless for the occasional Sprint 9A edit, but the exact wrong shape for a workflow that now expects the Inspector to be the primary place Choice content gets edited: a stray keystroke in the editor afterward would have silently reverted whatever the Inspector had just changed. Routing every edit through one real transaction means the mounted document and the saved project can never drift apart, regardless of which surface made the change.

Nothing about Conditions changed this sprint — each accordion still shows a "coming in a future sprint" placeholder, and every collapsed accordion honestly reports 0 conditions, since the data model for them doesn't exist yet.

## What's new (v0.21.0 — Runtime Foundation & Variables, Sprint 9A)

Scriare starts becoming an interactive narrative engine, not just a writing tool. This sprint's goal wasn't "add variables" — it was to lay down the runtime architecture that Conditions, Characters, Locations, Inventory, Relationships and Quests will all build on later, without redesigning the editor, introducing scripting, or asking a writer to type any syntax anywhere. Everything below stays visual: every field is a name box, a type dropdown, a number/toggle/text input, or a dropdown of fixed operations — never a place to type an expression.

**Variables** are the first runtime entity. A Variable has a Name, a Type (Number, Boolean, or String today — the type system is a discriminated union designed so a future type is one new case, not a rewrite), a Default Value, and an optional Description. They belong to the project as a whole, not to any one scene, and are managed from a new **Variable Manager** (a "Variables" button next to Project Settings in the top bar) — add, rename, retype, redefault, describe, and delete, all committing immediately like the rest of Scriare's inline editing.

**The Scene Details panel is now the Inspector.** This is more than a rename: the Inspector is designed as Scriare's central, adaptive property editor — what it shows depends on what's selected. Selecting a scene still shows the familiar Start Scene toggle and Outgoing Choices list; selecting a Choice Block's option (click into its text or destination dropdown) now shows that option's own Choice Properties instead: its Destination, a Conditions placeholder (arriving in Sprint 9B), and its **Actions** — the visual equivalent of "picking this choice does something to a variable." An Action reads exactly like the sprint's own mockup: a Variable dropdown, an Operation dropdown scoped to that variable's type (Number gets Set/+ Add/− Subtract, Boolean gets Set/Toggle, String gets Set), and a Value field matching the variable's type. A future Character or Location selection will show its own Properties view the same way, without the Inspector's architecture changing again.

Picking an option with Actions attached during Play Mode runs them — in order, before the jump to the destination scene — against a live, per-playthrough snapshot of variable values seeded from each Variable's Default Value. That snapshot resets every time Play restarts and never touches the saved project or triggers autosave, the same "Play Mode is a read-only pass over your story" guarantee that's applied since Play Mode shipped.

Deleting a Variable does not walk every scene rewriting Choice Actions that reference it — the same "no cascading delete" precedent scenes and their dangling links already follow. An orphaned Action is simply skipped at runtime rather than the app trying to keep every reference perfectly in sync, which would mean rewriting potentially every scene's content on every delete in a large project.

## What's new (v0.20.3 — Bold/Code No Longer Hide Text Color)

Making already-colored text bold visually wiped its custom color — even though nothing was actually wrong with the document. Tailwind Typography's compiled styles set color directly on the `<strong>` element itself: `.prose strong { color: var(--tw-prose-bold) }` (and the same thing for inline `` `code` ``: `.prose code { color: var(--tw-prose-code) }`). Tiptap renders a colored, bolded run as `<span style="color:red"><strong>text</strong></span>` — the color mark wraps the outside, bold sits inside — so normally `<strong>` would just inherit red from its ancestor span. But CSS never lets an inherited value compete with a rule that targets the element directly, no matter how low that rule's specificity is, so Typography's fixed bold color always won over the actual custom color, regardless of what shade was picked. This is the same category of bug v0.20.0 already fixed for list markers (Typography hardcoding a color via CSS custom properties) — just showing up on `<strong>`/`<code>` instead of `::marker`. Fixed the same way: `.prose.ProseMirror strong, .prose.ProseMirror code { color: inherit; }` in `styles/index.css`, matched against Typography's own selector shape so it reliably wins on specificity. Bold/code now just pick up whatever color context they're actually nested in — the custom color when one's set, the normal paragraph text color otherwise — instead of being pinned to a fixed theme color. Nothing about italic or underline needed the same fix; Typography doesn't hardcode a color for either.

## What's new (v0.20.2 — Text-Color Reset Inside Lists)

The text-colour "✕" was still resetting font family and size back to "Default" specifically when the selected text was inside a bullet or numbered list — v0.20.1 fixed the general case (a toolbar click stealing the editor's selection) but this was a second, unrelated bug underneath it. `unsetColor()`, `unsetFontFamily()`, and `unsetFontSize()` (from `@tiptap/extension-color`, `-font-family`, and this app's own `FontSize.ts`) all end their command chain the same way: `.setMark('textStyle', {...: null}).removeEmptyTextStyle()`. That second step, from `@tiptap/extension-text-style`, has a real bug — it walks every node touched by the selection and checks "does this still have a non-empty textStyle mark?", but its only guard against false positives is skipping `paragraph`-type nodes. A `listItem` or `bulletList`/`orderedList` wrapper isn't a paragraph, and block nodes never carry marks of their own regardless of what's typed inside them — so that check reads "no" for them too, and the function strips the *entire* `textStyle` mark (color, font family, and font size together) across that wrapper's whole range, overwriting whatever the correctly-scoped per-text-node check would have decided. Outside a list there's no such wrapper between the paragraph and its text, so the bug never had anything to fire on — which is why plain text was never affected. Fixed with a small custom command (`extensions/TextStyleCleanup.ts`) that does the same "drop the mark once every attribute on it is empty" cleanup but only ever inspects actual text nodes, never a container a selection happens to pass through; the toolbar's colour reset and the font family/size dropdowns' "Default" option all use it now instead of the built-in `unset*()` commands.

## What's new (v0.20.1 — Toolbar Selection-Loss Fix)

Clicking the text-colour toolbar's "✕" reset button appeared to also reset font family and font size back to "Default" — but the colour command itself was never the problem, and nothing was actually being un-set. Every toolbar button runs `editor.chain().focus()....run()`, and a plain click on a `<button>` first fires a `mousedown`, whose browser default moves DOM focus onto that button — which, since the button sits outside the rich text editor's own editable area, also clears the editor's live text selection. Tiptap's `.focus()` then re-focuses the editor on the next animation frame; by then the browser has no selection left to restore, so it drops a fresh collapsed cursor somewhere and the editor's own selection silently collapses to match. The colour reset itself had already applied correctly to the originally-selected text before any of that happened — but every toolbar control that reads current formatting off "whatever's selected right now" (the font family and size dropdowns included) then re-rendered against that wrong, collapsed cursor position instead, which is what showed up as "Default Default." Every toolbar button now blocks the mousedown that starts this chain, so clicking any of them — the colour reset included — never disturbs the editor's selection in the first place.

## What's new (v0.20.0 — Styled List Markers)

Bullet points and numbers in the rich text editor now pick up the same text colour, font family, and font size applied to a list item's own text — previously every marker rendered in a single fixed colour and the body font/size no matter what styling was applied to the item, which read as those toolbar options silently not working on lists. A marker now reflects whatever's applied to the *first* run of text in that item (nested sub-lists reflect their own first run, not their parent's). Left deliberately unchanged, per the request: bold, italic, and underline never apply to markers, matching how they already didn't. Also left out, because it isn't achievable in standard CSS: highlight/background colour on a marker — `::marker` doesn't accept `background-color` at all, in any browser, so there's no rule that makes one render there; and heading styles don't carry over, since a list item's content model doesn't currently allow a heading to be its own first block (a bigger schema change than this pass made). Text alignment already applies to a list item's own text; the marker itself staying anchored at the item's left edge regardless of alignment is standard list behaviour (Word and Google Docs both work the same way), not something this pass changed. This only affects the live editor for now — Play Mode's static render doesn't yet mirror it, since decorations are an editor-only mechanism; happy to extend it there if that's wanted too.

## What's new (v0.19.2 — Reset Text Color & Highlight)

Both colour pickers in the editor toolbar could only be pushed toward a colour, never back to "none" without clearing every other bit of formatting via Clear Formatting. A small "✕" button now sits next to each swatch: next to text colour it calls `unsetColor()` (back to the theme's default text colour), and next to highlight it calls `unsetHighlight()` (removes the highlight entirely, since a highlight has no "default" — only present or absent). Same pattern this toolbar already uses for font family/size, where an empty "Default" option unsets rather than sets a value.

## What's new (v0.19.1 — Color Picker Drag Performance Fix)

Dragging inside the rich text editor's text-colour or highlight-colour picker was laggy. A native `<input type="color">` fires its change event on every pixel of movement while you drag the picker's gradient — dozens of times a second — and each one was running straight into a full editor transaction: serializing the whole scene document, committing a brand-new project object to the store, and (via the Story Graph's project-keyed memo) re-walking every scene's document for its choice count and edges. That's the same class of per-event cost the Story Graph's own drag-performance fix (v0.10.3) exists to guard against, just newly surfaced in the toolbar's colour pickers instead of the graph. Fixed by coalescing same-frame colour changes into one `requestAnimationFrame`-scheduled update — dragging still feels live, but the editor is only updated once per frame no matter how many events the picker fires in it.

## What's new (v0.19.0 — Existing Features Evaluation & Final Polish, Sprint 8D)

Sprint 8D closes out the Sprint 8 arc (8A: interaction model, 8B: Story Graph feel, 8C: desktop identity/workspace) by evaluating every existing feature in the app — not just the graph or the shell — against production-quality bar, and polishing only what genuinely fell short. No new functionality; every existing workflow behaves exactly as before.

**The New Project dialog now matches every other dialog in the app.** It was the one dialog in Scriare not built on the shared `<Modal>` shell — its backdrop was a hardcoded dark overlay instead of the theme's `--overlay` token (no blur, and not click-outside-to-dismiss), and it only closed on Escape because the text input happened to still have focus, unlike the window-level Escape handling every other dialog (Project Settings, Move-to, the confirm dialog) already has. Since this is the very first dialog a new user ever sees, the inconsistency was more noticeable than most. Rebuilt on `Modal`, same as the rest.

Fifteen other systems — the rich text editor and its toolbar, Choice Blocks, the Content Browser (including its context menu, drag & drop, and folder/scene management), the Story Graph, Scene Details, Project Settings, Play Mode, the confirm dialog, the slash-command popup, keyboard shortcuts, and the Start Scene workflow's four entry points — were each evaluated against the same bar and found already consistent and production-ready; nothing there was changed. See the delivery notes for the full per-system breakdown, the technical debt intentionally left for a future sprint, and recommendations for what Sprint 9 could tackle next.

## What's new (v0.18.0 — Desktop Identity & Workspace Polish, Sprint 8C)

Sprint 8C evaluated Scriare as a complete desktop product — not the editor, graph, or runtime, all of which Sprints 8A/8B already covered — with the goal of the app never reading as "Electron" to whoever's running it. No new editor/graph/runtime functionality.

**The app no longer shows Electron's own default branding anywhere.** Electron builds a default native menu when you don't supply your own — on macOS that menu's first entry literally reads "Electron", and its Help submenu links out to Electron's own website, docs, and Discord, regardless of platform. Both are gone: macOS now gets a minimal three-item menu (App/Edit/Window, using Scriare's own name and just enough to keep Cmd+C/V/Quit/minimize working), and Windows/Linux — where the menu bar is already auto-hidden but Alt still revealed it — no longer has an application menu at all. `app.setName("Scriare")` is now called explicitly (package.json's lowercase "scriare" was otherwise what every native surface read), the macOS About panel now shows Scriare's real name/version/copyright instead of Electron's defaults, and the window's background-flash colour (shown for an instant before the page paints) was updated to match the current Dark theme — it had been left over from the very first theme system (Crimson Noir, replaced back in v0.12.0) and no longer matched.

**Two leftover hardcoded destructive-hover colours were brought in line with the rest of the app.** A Choice Block's two "remove" buttons and the Content Browser's right-click "Delete" item were still using a hardcoded red instead of the `--danger` theme token every other destructive affordance (FrameNode's delete button, the confirm-delete dialog) already reads — missed during the v0.12.0/v0.14.0 passes that fixed the others.

**The Story Graph panel's visible label now reads "Story Graph"** instead of "Flow" — a leftover from before the app had real product-facing panel names, inconsistent with "Content" and "Scene Details" sitting right next to it.

A full pass over spacing/padding/corner-radius/shadow conventions across every panel, dialog, and button, a review of panel resize/collapse/focus behavior, and a simulated end-to-end writing workflow (open → browse → write → link a choice → navigate the graph → return to the editor → play → save) turned up nothing else that needed changing — see the delivery notes for the full evaluation report, including what's deliberately left to actual app packaging (a real installer, a renamed executable, custom file/taskbar icons) rather than attempted here.

## What's new (v0.17.0 — Story Graph Interaction Feel, Sprint 8B)

Sprint 8B was an evaluation-and-polish pass over the Story Graph's interaction *feel* — no new graph capability, per the sprint's own "the graph should not feel different, just more refined" brief. Most existing interactions (drag responsiveness, hover states, selection, zoom/pan, edge rendering, auto-scroll while dragging near the viewport edge) were already solid and are untouched. What was actually polished:

**A dragged scene's "lift" now eases in instead of snapping.** The scale-up and selection ring/border on a scene card only ever transitioned colour before — the pop to 1.05x on drag-start (and back down on drop) happened instantly. Now it eases over the same 150ms the rest of the graph's settle motion already uses.

**The canvas now shows a crosshair over empty space instead of a pointer/hand cursor.** Since left-drag box-selects and right-drag pans, a "clickable hand" cursor sitting over empty canvas at all times was misleading — nothing there is actually clickable. A crosshair reads as "drag from here to select," distinct from the `grab` cursor a node itself shows.

**Frame resize handles now respond to hover**, matching every other interactive surface in the graph (a subtle scale-up, not a redesign).

**Edge highlighting now reacts to graph selection, not just the scene open in the editor.** Ctrl+click or box-selecting a scene already gave it its own ring highlight, but its edges stayed dim unless it was also open in the Scene Editor — inconsistent with how selection feedback works everywhere else in the graph. Now an edge lights up the moment either scene it connects touches the current graph selection.

**The two camera-fit animations (opening the graph, and Auto Layout's post-layout re-frame) now share one duration** instead of two slightly different ones that had drifted apart.

**A stale tooltip was fixed**: "Auto Layout" still described its pre-v0.16.0 behavior ("scenes that aren't in a frame") even though Frames have participated in Auto Layout since that release.

Auto-scroll while dragging a node near the viewport edge was evaluated and found to already work (it's a React Flow default this app never disabled) — now declared explicitly in code so a future library upgrade can't silently change it.

## What's new (v0.16.0 — Frames in Auto Layout)

Auto Layout used to completely ignore any Frame that had scenes grouped into it — the Frame just sat wherever it was while everything else rearranged around it, even if a scene inside it connected to scenes outside it. Frames now participate in Auto Layout as their own node: sized to the Frame's own footprint, connected to whatever it links to via its contained scenes' choices. Everything you've manually arranged *inside* a Frame (which scene sits where, relative to the others) is preserved exactly — only the Frame's overall position moves, carrying its scenes along with it. A Frame with no scenes in it still isn't touched, same as before.

## What's new (v0.15.1 — Story Graph Interaction Fixes)

Three bugs reported right after v0.15.0's nav/resize/selection sprint, all fixed:

**Multi-selected nodes now actually move together.** Selecting several scenes (via Ctrl+click or a box-select) and dragging one used to only move that one node — the rest of the selection stayed put even though it was correctly highlighted. React Flow reports every node in a group drag through a separate argument these handlers weren't reading yet; now every dragged node in the group gets its own live offset, so the whole selection moves as one.

**The blue selection-bounding-box is gone.** After a multi-selection, React Flow was drawing a translucent rectangle around the whole group in addition to each node's own selection highlight (ring/accent border). Since individual node highlighting already shows what's selected, the group box's fill/border are now hidden — the box-select marquee you draw *while* dragging is untouched.

**Frame resizing from a top or left handle now feels as smooth as the others.** Resizing from the bottom-right always felt right, but the top-left, top-right, and bottom-left handles had a subtle lag — the edge under the cursor seemed to lag behind while the opposite edge overshot to compensate. That was a CSS settle-transition (meant for smoothing programmatic moves like Auto Layout) firing during a live resize, easing the frame's position while its size updated instantly. Resizing now skips that transition, matching the mouse exactly on every handle.

Scriare just got a full visual reset: a new black/white/gray theme system
(Dark and Light, switchable in Project Settings) replaces the previous four
colourful palettes, and the app's own UI now defaults to Inter instead of
Manrope. The rich text editor and Play Mode's own typography were
deliberately left untouched — this redesign only changes the app's chrome,
not how your writing looks or reads.

## What's new (v0.15.0 — Story Graph Interaction Polish)

This sprint didn't add any new Story Graph features — it went through the
existing navigation, selection, and resize interactions end to end and
brought them up to the standard of a professional creative desktop app.

**Navigation now matches other node-based creative tools (Unreal's
Blueprint editor, Blender, etc.):** right mouse button pans the canvas, left
mouse button is reserved entirely for selecting things — click a node to
select it, Ctrl (Cmd on macOS) + click to add or remove a node from the
selection, and dragging on empty canvas now draws a selection rectangle
instead of panning. Previously, left-drag panned the canvas and there was no
way to box-select or build up a multi-selection at all.

**Frame resizing is now genuinely live.** Dragging a Frame's resize handle
used to only show the final size after letting go of the mouse — the frame
would visually fight itself mid-drag because the in-progress size wasn't
being fed back into what the graph was rendering. It now tracks the cursor
continuously and settles exactly where you release it, no delay.

**Clicking a scene no longer immediately swaps out what's open in the Scene
Editor.** A single click now only selects the scene in the graph — useful
for glancing at it, multi-selecting it, or picking it up to drag, without
losing your place in whatever you were writing. Double-click a scene to open
or focus it in the Scene Editor, same as before.

**Selection itself is now solid everywhere it wasn't.** The Frame-selection
bug fixed in v0.14.2 turned out to be one instance of a more general gap:
neither scenes nor multi-selected nodes could actually hold onto a
"selected" state either, for the same underlying reason. That's now fixed
across the board — a scene picked up by Ctrl+click or a selection rectangle
shows its own selection ring, distinct from the stronger border a scene gets
when it's actually open in the editor, and Escape / clicking empty canvas
reliably clears selection again.

Reviewed and confirmed already working well, left unchanged: drag
responsiveness and the "lift" effect while dragging, edge routing, hover
states, the Frame drop-target highlight while dragging a scene over it,
per-node cursor states (grab/grabbing), auto-scrolling near the canvas edge
while dragging, Frame resize's minimum-size floor, and general zoom
behaviour. The native Electron menu bar (File/Edit/View/Window/Help) is
already set to auto-hide on Windows/Linux; folding it into Scriare's own
toolbar everywhere (including macOS, which always shows a system menu bar)
is a bigger, separate change and was intentionally left for a later sprint.

## What's new (v0.14.2 — Frame Selection Fix)

v0.14.1's Frame sizing fix didn't fully land: reported back that Frames
still couldn't be resized at all — no handles ever appeared, no matter what
was tried, only a hover border. Found a real bug underneath it, not a sizing
problem this time.

A Frame's resize handles are only supposed to show once it's selected (same
idea as Scene's accent border) — but a Frame never actually *stayed*
selected. Clicking one did register the click, but the graph library's own
internal "this node is selected" flag gets silently overwritten back to
`false` on the very next redraw of the graph, because nothing in the app was
telling that redraw to keep it — a redraw happens constantly (this graph
recomputes on every drag frame, every panel resize, etc.), so in practice a
Frame was deselected within a fraction of a second of being clicked, well
before anyone could reach for a resize handle. Scenes never showed this
problem because a scene's "selected" look was never wired through that
library flag in the first place — it's tracked as the app's own explicit
state.

Fixed by giving Frame selection the same kind of explicit, app-tracked state
scene selection already had: clicking a Frame (or starting to drag one) now
sets it as the selected Frame in a way that survives every redraw, and
clicking empty canvas clears it. Resize handles, and the selected-frame
accent border added in v0.14.0, now both show up and stay up exactly when
expected. The resize mechanism itself (`NodeResizer`) was never broken —
once selection reliably works, resizing has worked correctly the whole time.

**Frames were too small to actually use for grouping.** A new Frame
started at 360×260 — barely enough for one or two scene cards — and could
be resized down to 200×140, small enough to fit essentially nothing. Frames
were already resizable (select one, drag its handles), but the sizes
involved made that hard to discover and not very useful once found. Fixed:
a new Frame now starts at 480×320, roomy enough for a small cluster of
scenes right away, and the resize floor is raised to 260×170 so a frame can
never be shrunk down to uselessness.

**Choice lines connecting scenes inside a frame could render as a tangled
loop.** Investigated a report of exactly this (screenshot showed a choice
edge looping back on itself near a frame's corner). Root cause: each scene
has one fixed connection point on its right edge (where choice lines leave)
and one on its left (where they arrive), tuned for Auto Layout's normal
left-to-right arrangement. Auto Layout always places a target to the
right of its source, so those fixed points never caused trouble there. But
a scene dragged freely into a frame very often ends up *behind* or *below*
the scene it connects to instead of neatly to its right — and the previous
edge style (`smoothstep`) can only route in straight axis-aligned segments,
so a "backward" connection like that forced it into a hard right-angle
loop: step out, double back, step back in. Switched connecting lines to a
bezier curve, which bows smoothly toward its target from any relative
direction instead of needing to stay axis-aligned — a backward or stacked
connection now reads as a normal curved line, not a routing glitch. Auto
Layout's ordinary forward connections look effectively unchanged.

## What's new (v0.14.0 — Graph Interaction Evaluation & Polish)

The Story Graph was feature-complete going into this sprint, so this was an
evaluation-and-polish pass, not a new-features sprint: every interaction
category below was inspected against what already existed, and only the
categories that felt incomplete or inconsistent got changed.

**Node dragging, drag responsiveness, drop predictability, zoom, and pan —
already production-ready, untouched.** Scene and frame dragging both track
the cursor 1:1 every pointer-move (the fix from Sprint 8A's original pass,
v0.10.2–v0.10.6), Frame-drop detection is a predictable center-point test,
and zoom/pan use React Flow's own well-tested defaults. Nothing here needed
changing, so nothing was changed.

**Lift state — frames now get the same "picked up" treatment scenes
already had.** A dragged scene has always lifted with an accent border and
a soft shadow; a dragged frame only got a generic drop-shadow, which read
as an unfinished version of the same idea. Frames now also pick up an
accent border and fill while dragging — deliberately without the scene's
`scale(1.05)`, since a frame's scenes are independent nodes, not real DOM
children, so scaling the frame box alone would visually disagree with
where its scenes actually sit.

**Selection feedback — a selected frame is now visible, not just its
resize handles.** A selected scene has always shown a full accent border;
a selected frame previously showed only its (small, easy-to-miss) resize
handles, with the frame box itself looking identical to an unselected one.
Selected frames now get the same accent border scenes do.

**Hover feedback — frames now hover like scenes do.** Scene cards have
always brightened slightly on hover; frames had no hover feedback at all.
Frames now match.

**Edge behaviour — edges connected to the selected scene are now
highlighted.** Every edge used to render identically regardless of any
interaction, unlike a professional graph tool where selecting a node shows
what it connects to. Edges touching the selected scene now render bolder
and in the accent colour; this only re-styles the existing edges (a cheap
pass, not a re-walk of every scene's document) and doesn't add clickability
or a new interaction model — edges stay non-interactive, per the graph's
existing non-destructive design.

**Cursor feedback — fixed a real inconsistency.** The Frame node's title
input and delete button were inheriting the frame's "grab" cursor from
their parent, so hovering them showed a hand instead of a text-caret or
pointer — misleading, since those two elements don't drag the frame.
Fixed with explicit cursor styles on each. The delete button's hover color
was also still a hardcoded red left over from before the Minimal redesign;
it now reads `--danger`, like every other destructive action in the app.

Verified with `tsc --noEmit`, a production build, and a bundle grep
confirming the new classes and edge-highlight logic are present.

## What's new (v0.13.0 — Real Logo)

- **The typographic "S" is replaced by the actual Scriare logo**, from the
  finished mark supplied in `other_materials/logos`. It appears on the
  Welcome screen and in the TopBar's top-left corner, and now swaps between
  the Primary Dark and Primary Light variants to match the active app
  theme — Primary Dark on the Dark theme, Primary Light on the Light theme
  — instead of always being the same single-colour accent glyph.
- **The app's OS-facing icon (window/taskbar icon) now uses the Icon Dark
  mark** — a solid dark circular badge — rendered to a 1024×1024 PNG and
  used for both `build/icon.png` and `resources/icon.png`. This is a
  single fixed icon, not theme-dependent, matching how OS taskbars work.
- The old custom blackletter font-face and its `.font-blackletter-mark`
  utility class were removed — they're no longer used now that the mark is
  a real logo image, not a typographic glyph.
- Verified with `tsc --noEmit` and a production build.

## What's new (v0.12.1)

- **Light mode is no longer pure white.** Its background and surface tiers
  were shifted a uniform notch toward gray (background `oklch(95% 0 0)` /
  `#eeeeee`, previously `oklch(99% 0 0)` / `#fdfdfd`-ish near-white) while
  keeping every existing contrast step between background, surface, and
  border tiers exactly as it was — nothing about the hierarchy changed,
  just how far from white it starts. Dark mode is untouched.

## What's new (v0.12.0 — Minimal)

- **New theme system: Dark and Light, both strictly black/white/gray.** The
  previous four colourful themes (Crimson Noir, Indigo Dusk, Emerald Slate,
  Ivory Gold) are gone, replaced by two true-neutral themes with no colour
  tint at all. Dark is the default on first launch; your choice is switched
  and remembered exactly like before, from the same Appearance section in
  Project Settings (⚙).
- **Colour is now reserved for meaning, not decoration.** Destructive
  confirmations (deleting a scene, a folder, a frame) use a dedicated red;
  a green is defined and ready for a future "Apply"-style action (nothing
  in the app is quite that shape yet). Everything else — buttons, badges,
  selection highlights, the graph's MiniMap — is part of the same
  black/white/gray palette as the rest of the UI.
- **The app's UI now defaults to Inter**, replacing Manrope for body text,
  labels, and buttons throughout the app's chrome. IBM Plex Mono is also
  now available for technical/structured UI (e.g. a future Variables
  feature) — not used anywhere yet, but ready.
- **The rich text editor and Play Mode were not touched.** Both still
  render your story's text in Manrope, exactly as before this redesign —
  only the surrounding app chrome (toolbars, panels, dialogs, buttons)
  picked up the new font and colours.
- Verified with `tsc --noEmit`, a production build, and confirming the new
  theme/font values are present in the built CSS.

## What's new (v0.11.2 — Dockable Panels Polish)

- **Content's and Scene Details' collapsed-strip labels now use the same
  font weight and letter case.** Both now render bold and in small caps
  (uppercase, tracking-wide) — matching the Story Graph's collapsed label and
  the app's other section headers — instead of plain, unstyled text.

## What's new (v0.11.1 — Dockable Panels Polish)

- **The Story Graph's collapsed bar is now clickable anywhere, not just on
  the word "Flow."** Content and Scene Details already worked this way —
  their whole collapsed strip is one big click target — but the Story Graph's
  collapsed bar only expanded if you clicked precisely on its label. Fixed by
  making the entire collapsed bar one button, matching the sidebars.
- **All three collapse icons are now the same shape (a solid triangle) and
  point consistently** — instead of a mix of angle brackets (⟨ ⟩) on the
  sidebars and sideways/vertical triangles on the Story Graph.
- **The Scene Details toggle moved to sit right next to the page**, on the
  left edge of its header, instead of the far-right edge of the window. The
  Content panel's toggle already sat next to the page (the right edge of its
  own header, bordering the editor) and is unchanged in position — only its
  icon shape changed to match.
- Verified with `tsc --noEmit`, a production build, and confirming the
  updated "Expand Flow" / "Expand Scene Details" / "Expand Content" labels
  are present in the built bundle.

## What's new (v0.11.0 — Dockable Panels)

- **The Content panel (left sidebar) is now collapsible.** Click the new ⟨
  button next to its header to dock it away to a thin strip; click the strip
  (labeled "Content") to bring it back. This mirrors how Scene Details
  (right sidebar) already worked.
- **All three panels — Content, Scene Details, and the Story Graph — can now
  be collapsed independently**, so a writer who wants a clean, distraction-
  free page can dock away everything but the editor itself, or keep whichever
  panels they're actively using.
- **Your layout is remembered.** Which panels are collapsed is saved locally
  (not written into the project file — a display preference, like the
  editor/graph split height already was) and restored the next time you open
  Scriare, so you don't have to redock everything on every launch.
- Verified with `tsc --noEmit`, a production build, and confirming both the
  new storage key and the Content panel's collapsed-state label are present
  in the built bundle.

## What's new (v0.10.6 — MiniMap Refresh Fix, Part 2)

- **The MiniMap fix in v0.10.5 didn't actually work — now it does.** That
  release added a state counter (`forceMeasuredRerender`) bumped whenever a
  node's real measured size became known, intending to make `FlowPanel`'s
  `nodes` memo pick it up right away. But the counter was never added to that
  `useMemo`'s own dependency array — bumping it forced a re-render, but
  `useMemo` only recomputes when something in *its own* dependency list
  changes, so it kept returning the same stale, memoized array regardless.
  The MiniMap (which colours/sizes nodes from that array) stayed blank until
  an unrelated drag happened to change `frameDrag`/`sceneDrag`, which *are*
  in the list. This also explains why collapsing and reopening the Flow panel
  reset an already-correct MiniMap: collapsing unmounts `<ReactFlow>`
  entirely, so on reopening, measurement starts over from scratch — and the
  same missing-dependency bug meant that fresh measurement, again, never
  reached the array. Fixed by renaming the counter to `measuredVersion` and
  actually listing it in the `nodes` memo's dependency array, so a change to
  it now does what it was always meant to: force a recompute that picks up
  the freshly cached measured sizes.
- Verified with `tsc --noEmit`, a production build, and confirming
  `measuredVersion` is present in the built bundle's memo dependency array.

## What's new (v0.10.5 — MiniMap Refresh Fix)

- **The MiniMap now shows every node's colour immediately, without needing to
  drag a node first.** v0.10.4 started caching each node's real measured size
  (`measuredSizeRef`, a plain ref) so it survives being rebuilt as a fresh
  object every drag frame — but writing into a ref doesn't itself trigger a
  re-render. So on a freshly opened graph, a node's real size only became
  known to `FlowPanel`'s `nodes` memo the *next* time something else forced
  that memo to recompute (any drag) — until then, the MiniMap (which reads a
  node's box/colour straight from the objects in `nodes`, unlike the main
  canvas, which measures independently via its own `ResizeObserver`) kept
  drawing every node as an unmeasured, colourless 0×0 box. Fixed by tracking
  when a node's measured size actually changes and bumping a small piece of
  state at that moment, which is enough to make `nodes` recompute right away
  — so the MiniMap is correct from the moment the graph opens.
- Verified with `tsc --noEmit`, a production build, and confirming the new
  `forceMeasuredRerender` trigger is present in the built bundle.

## What's new (v0.10.4 — Drag Freeze Fix)

- **Dragging no longer randomly freezes mid-gesture.** This app never wires
  up React Flow's `onNodesChange`, and every node object handed to
  `<ReactFlow nodes={...}>` is a fresh object literal on every drag-frame
  recompute (needed for live cursor-tracking, see v0.10.2/v0.10.3 below).
  React Flow's internal reconciliation (`adoptUserNodes`) only carries a
  node's already-measured `measured: {width, height}` forward when the
  incoming node is *reference-identical* to the one it already has
  internally — any other object, which every one of our nodes is on every
  pointer-move, made it reset that node's `measured` size to
  `{width: undefined, height: undefined}`. That silently marked the node as
  "not initialized" (React Flow's own `error015` warning, confirmed firing
  hundreds of times per drag via the console), hid it, and re-triggered its
  `ResizeObserver` observe/unobserve cycle — a race that could lose outright
  under load, freezing the node until the project was reopened. Fixed by
  caching each node's real measured size (from React Flow's own `dimensions`
  change events, now wired up via `onNodesChange`) and feeding it back into
  every node object the `nodes` memo builds, so the size survives being
  rebuilt as a new object every drag frame.
- Investigated as a pure debugging pass first, per spec: analyzed every
  candidate cause (pointer capture loss, event-listener recreation, ref
  instability, zoom/pan interference, and the eventual root cause), added
  temporary console/DOM-poll instrumentation to gather live evidence, and
  only implemented this fix once the user's own console log confirmed the
  `error015`/`measured`-reset theory. The temporary instrumentation has been
  removed now that its job is done.
- Verified with `tsc --noEmit`, a production build, and confirming both the
  debug instrumentation is gone and the `measured`/`dimensions` fix is
  present in the built bundle.

## What's new (v0.10.3 — Drag Performance Fix)

- **Dragging a scene no longer stalls the graph.** Making scene dragging
  track the cursor (v0.10.2) meant `FlowPanel`'s node/edge computation now
  re-ran on every pointer-move — and that computation was calling
  `extractChoices()` (a full walk of every scene's Tiptap document, for
  *every* scene, not just the one being dragged) to build both the choice
  count shown on each card and the graph's edges. At mouse-move frequency,
  on any project with a non-trivial number of scenes, that was enough
  synchronous work per frame to stall the renderer's main thread hard
  enough that Chromium stopped painting the canvas — recoverable only by
  reopening the project. Fixed by splitting that computation in two: choice
  counts and edges are now memoized on the project's actual content alone
  (so they only recompute when a scene is actually edited), while the
  per-frame position update during a drag is now pure arithmetic — no
  document parsing at all. This was a latent cost of frame dragging too
  (it always recomputed edges every frame), just never big enough to
  notice until scene dragging started doing the same per-frame recompute.
- Verified with `tsc --noEmit`, a production build, and confirming the new
  memo split (`choiceCountByScene`) is present in the built bundle.

## What's new (v0.10.2 — Drag Fix, Part 2)

- **Scene dragging actually follows the cursor now.** v0.10.1 removed the
  broken React-state highlight, but that also removed the *only* thing that
  was forcing a re-render during a scene drag — this app never wires up
  React Flow's `onNodesChange`, so nothing tells it to repaint a node's
  position while a pointer moves; a node's `internals.positionAbsolute` is
  set once at drag-start and never touched again until drop. Frame dragging
  never had this problem because `handleNodeDrag` already updates a live
  `frameDrag` offset on every pointer-move, unconditionally, which forces
  FlowPanel to recompute the `nodes` array with the frame's *current* cursor
  position on every frame. Scene dragging never had an equivalent — fixed by
  adding the same live `sceneDrag` offset, updated the same unconditional
  way, so a dragged scene's fed-in position always equals where the cursor
  already put it (nothing for React Flow to reset).
- The Frame drop-target highlight stays exactly as it was in v0.10.1 (a
  plain DOM class, no React state) — that part was correct, it just wasn't
  the piece that made the node move.

## What's new (v0.10.1 — Drag Fix)

- **Scene dragging works again.** v0.10.0's Frame drop-target highlight was
  implemented by flowing an `isDropTarget`/`isDragging` flag through React
  Flow's `nodes` array — but React Flow only keeps tracking a node's live
  drag position when the node object it receives is reference-identical to
  the one it already has internally; any other object (which is what our
  highlight update produced on every frame-boundary crossing) makes it
  reset that node's position from the (stale, not-yet-committed) value we
  passed in, snapping the dragged card back to its start position. Fixed by
  moving both the drag-lift look and the Frame drop-target highlight to
  plain CSS classes toggled directly on the DOM, so a scene drag never
  touches the `nodes` array until it's actually released — restoring the
  exact reactivity scene dragging had before v0.10.0.
- Verified with `tsc --noEmit`, a production build, and confirming the new
  CSS hooks (`scriare-scene-card`, `scriare-frame-box`, `scriare-drop-target`)
  are present in the built bundle.

## What's new (v0.10.0 — Graph Interaction Polish)

- **Drop preview while dragging a scene.** The scene card being dragged
  lifts (scale, accent border, drop shadow) so it reads as "this is what's
  moving, not settled yet." If it's hovering inside a Frame's bounds, that
  Frame highlights (accent border + soft tint) using the exact same
  containment check `projectStore` uses to decide the real drop — so the
  frame that's glowing is always the frame the scene will actually join on
  release, never a guess.
- **Frame drags** get the same "currently moving" lift via a shared
  React Flow CSS rule, instead of custom code per node type.
- **Selection and hover feel more alive**: scene cards now get a visible
  background tint on hover (previously only the border changed), and every
  state change (hover, select, drag) eases in over 150ms instead of
  snapping — subtle, not showy.
- **Edges no longer pop.** Edge paths still track their nodes' positions
  instantly (correctness — a lagging edge reads as broken), but an edge's
  own stroke/width/opacity changes now transition smoothly.
- **Auto Layout and frame-drag settling now ease into place** (150ms)
  instead of jumping, while a live drag still tracks the cursor with zero
  added latency — the CSS transition is scoped to only apply when a node
  isn't the one currently being dragged.
- **Fewer accidental micro-drags.** A 2px movement threshold means a plain
  click on a scene no longer risks registering as a tiny, unintended
  position change.
- **Initial "fit view" now animates** (300ms) instead of snapping the
  camera into place when a project's graph first opens.
- **Performance**: the new hover-highlight state only triggers a re-render
  when a drag actually crosses into or out of a Frame's bounds — not on
  every mouse-move tick — so this stays cheap on large graphs. Verified
  with `tsc --noEmit` and a production build.

## What's new (v0.9.1 — Brand Mark)

- **The Top Bar and Welcome screen logo is now rendered text, not an
  image.** The project owner supplied a blackletter font pack
  (`other_materials/fonts/blackletter_ds/`, two cuts — a filled ExtraBold
  and a decorative Shadow/outline variant); the filled one
  (`BLACEB__.TTF`, renamed `scriare-blackletter.ttf`) is embedded via
  `@font-face` in `themes.css` and used to render a single capital "S" as
  the brand mark, coloured with `var(--accent)`.
- **The mark now re-themes live**, exactly like the rest of the app —
  switch palettes in Project Settings and the "S" shifts colour along with
  everything else, instead of staying frozen as a static white-on-black
  image. Verified by rendering the glyph against two different `--accent`
  values and confirming both render correctly.
- The original PNG (`assets/logo-mark.png`) is no longer imported in
  `TopBar.tsx`/`WelcomeScreen.tsx` — it's kept only as the source for
  `build/icon.png`/`resources/icon.png` (the Electron window icon), which
  has to be a bitmap regardless of the in-app theme.

## What's new (v0.9.0 — Premium Redesign)

- **New colour-theme system.** Four palettes, each a small set of CSS
  custom properties in `src/renderer/src/styles/themes.css`:
  - **Crimson Noir** (default) — cool near-black neutrals with a red accent.
  - **Indigo Dusk** — cool blue-violet accent.
  - **Emerald Slate** — muted forest-green accent.
  - **Ivory Gold** — a light, warm palette (the one theme that flips to a
    light background).
  All four are built from [oklch](https://oklch.com) colours so lightness
  and contrast stay consistent across hues. Switch between them any time
  in Project Settings → Appearance; the choice is saved to
  `localStorage` (`scriare.theme`) and applied instantly via a
  `data-theme` attribute on `<html>`, no reload needed.
- **Every hardcoded Tailwind colour (`zinc-*`, `emerald-*`) was replaced**
  with a CSS-variable-backed class (e.g. `bg-[var(--surface)]`,
  `text-[var(--accent)]`) across all 23 components that had them — Content
  Browser, editor toolbar, Story Graph, dialogs, Play Mode, the welcome
  screen, everywhere. Nothing was restyled by hand per-theme; changing a
  theme's variables in `themes.css` re-themes the entire app.
- **New app logo** (`src/renderer/src/assets/logo-mark.png`, supplied by
  the project owner): now shown top-left in the Top Bar and on the Welcome
  screen, and set as the Electron window icon (`build/icon.png`,
  `resources/icon.png` — ready for `electron-builder` packaging later;
  a `.ico`/`.icns` conversion will be needed when packaging is set up,
  since Windows/macOS installers don't accept a bare `.png`).
- **New font pairing**: Newsreader (a serif, for the "Scriare" wordmark and
  other narrative-facing titles) paired with Manrope (sans, for UI chrome),
  loaded via Google Fonts `@import` in `themes.css`.
- **Project Settings gained an Appearance section**: a 2×2 grid of theme
  swatches (each swatch reads its *own* theme's live CSS variables, so it
  can never drift out of sync with `themes.css`); clicking one applies
  instantly. The existing Start Scene field is unchanged, just visually
  restyled and now sitting in a slightly wider dialog.
- **Story Graph (`FlowPanel.tsx`)**: edges, the dot-grid background, the
  minimap, and the zoom controls now read the active theme's CSS variables
  instead of hardcoded hex, so the graph re-themes along with everything
  else. The Left/Right edge-handle fix from earlier work (so Auto Layout's
  left-to-right edges run straight rather than looping) was untouched.
- Two small consistency fixes made while reskinning, both cosmetic: the
  Play/Save/Confirm buttons' hover states no longer resolve to the exact
  same colour as their resting state (a latent bug — hover and rest both
  used to be `emerald-600`), and button text now uses a
  theme-aware `--accent-text-on` instead of a hardcoded white, so text
  stays legible against light accents (relevant on Ivory Gold).

## What's new (v0.8.3 — Drag & Drop Fix)

- **Fixed: dragging items in the Content Browser did nothing.** The
  folder-expand arrow and the scene/folder name label were native
  `<button>` elements that called `preventDefault()` on `mousedown` (added
  in v0.6.1 to stop a stray focus/selection highlight on Shift+Click).
  Calling `preventDefault()` on `mousedown` — especially on a `<button>`
  nested inside a `draggable` row — stops Chromium from ever recognizing
  the drag gesture, so the row's own `onDragStart` never fired. Clicking,
  Ctrl-clicking, and Shift-clicking still worked because those don't depend
  on native `dragstart`, which is exactly why only dragging looked broken.
  Fixed by making those two row elements plain `<div role="button">`s
  instead of `<button>`s and dropping the `mousedown` handler entirely —
  the existing `select-none` (text selection) and `focus:outline-none`
  (focus ring) CSS already suppress the highlight v0.6.1 was fixing,
  without touching `mousedown`.
- Folder drag & drop, scene drag & drop, nested folders, and everything
  else audited in v0.8.2 continues to work exactly as before — this is a
  single, isolated fix.

## What's new (v0.8.2 — Regression Audit)

A line-by-line audit of every file touched in v0.8.0/v0.8.1, plus the
supporting Content Browser/graph code, against all of: folder drag & drop,
scene drag & drop, nested folders, multi-selection, Ctrl-selection,
Shift-selection, favorites, search, folder deletion behavior, custom
modals, and graph synchronization. No functional regressions were found —
every change from those two sprints was purely additive (new fields, a new
dialog, a new context menu item, a new checkbox) and none of it touched the
existing logic paths. Two stale code comments left over from the
`PlayView` → `runtime/PlayRuntime` rename (in `narrativeBlocks/types.ts`
and `utils/readingColumn.ts`) were corrected — documentation only, no
behavior change. See "Regression audit findings" further down for the full
list of what was checked.

## What's new (v0.8.1 — Start Scene Management)

- **Set the Start Scene from the Content Browser.** Right-click any Story
  scene and choose **Set as Start Scene** — no need to open Project Settings
  for a quick change.
- **Toggle it from the Inspector.** Selecting a scene now shows a "This is
  the Start Scene" checkbox in Scene Details — check it to make that scene
  the start, uncheck it to clear it (Play Mode then falls back to the first
  Story scene, same as an unset project).
- **Always exactly one Start Scene.** All three places to set it — Project
  Settings, the Content Browser, and the Inspector — read and write the
  same underlying value, so choosing a new Start Scene from any of them
  instantly un-marks whichever scene was the Start Scene before, everywhere
  it's shown (the ▶ Start badge in the Content Browser and the graph).

## What's new (v0.8.0 — Runtime Polish)

- **Start Scene.** Project Settings (the new ⚙ button in the top bar) lets
  you pick which scene Play Mode begins from. If none is set, the first
  Story scene is used, same as before. The Start Scene is marked with a
  small "▶ Start" badge — in the Content Browser and on its node in the
  Flow graph — instead of Twine's rocket icon, to match Scriare's own
  visual language.
- **A proper ending screen.** Reaching a scene with no outgoing choices now
  shows a minimal, centered "The End" card with **Restart Story** and a new
  **Return to Editor** button, instead of just a heading and one button.
- **Escape exits Play**, in addition to the existing Exit Play button —
  both return you to exactly where you left off: same scene selected, same
  editor scroll position, same graph pan/zoom, all untouched because the
  editor is never unmounted while playing.
- **A simple scene fade** on every transition — comfortable, immediate, and
  nothing more elaborate than that on purpose.
- **The runtime is now its own layer**, under `src/renderer/src/runtime/`,
  separate from the editor's UI components. A small registry
  (`runtime/registry.ts`) maps each narrative block's node type to its own
  playback renderer — Choice is the only one registered today, but a future
  block (Variables, Conditions, Images, Dialogue, embedded widgets, ...)
  only needs one more registry entry, not changes to the player itself.
- Play Mode's actual rendering (headings, rich text formatting, colors,
  highlights, alignment, Choice/Divider/Quote/Callout blocks, all in exact
  document order) is unchanged from v0.7.0 — that fidelity already held.

## What's new (v0.7.0 — Narrative Blocks)

Scriare evolved from a rich text editor with branching metadata into a
writing-first narrative editor. Nothing about the editor became a card
system or a Notion-style block editor: paragraphs are still paragraphs,
and you can keep typing straight through a Choice Block, a Callout, a
Quote, or a Divider exactly like you'd type past an image in Word.

- **Choice Blocks now hold multiple options.** A single Choice Block can
  have one or more options, each with its own text and destination scene —
  add an option, remove one, or reorder them with the ▲/▼ arrows, all
  inside the same block. Choices are still purely something you write, not
  editor metadata.
- **Slash commands.** Type `/` anywhere in the document to open a small
  command menu: `/choice`, `/divider`, `/quote`, `/callout`. Pick one with
  the arrow keys + Enter, or click it — it replaces the `/query` text with
  the block. The toolbar's "+ Choice" and "Quote"/"Divider" buttons still
  work exactly as before; the slash menu is just a second way to reach the
  same commands.
- **Callout**, a new block for a highlighted note or aside — insert it with
  `/callout`, type normally inside it (it holds ordinary paragraphs), and
  it looks the same whether you're writing it or playing it back.
- **Play Mode renders every block in the exact order it was written.**
  Paragraph, Choice Block, paragraph, divider, paragraph — plays back in
  that order, with each Choice Block's buttons appearing right where the
  choice was written, not collected at the bottom of the scene like before.
- Built as an extensible system on purpose: a `NARRATIVE_BLOCKS` registry
  is the one place a new block (future: Variables, Images, Dialogue, ...)
  plugs into the slash menu, so adding one later won't mean redesigning
  the editor.
- Existing projects open unaffected — old-format Choice Blocks (from any
  earlier version) are upgraded to the new multi-option shape automatically
  the first time they're opened.

## Fixes (v0.6.2)

- **Play Mode now reads at the same width as the editor.** Both now share
  one definition of the reading column (`utils/readingColumn.ts`) instead
  of each keeping their own copy — so the text width, the wrap points, and
  the typography (font, size, line height, spacing) are guaranteed to
  match, and Play Mode centers a comfortable, Twine/Notion/Medium-style
  column instead of stretching text across the whole window. Long
  unbroken words now also wrap inside the column instead of overflowing
  it. Play Mode's layout, navigation, and choices are unchanged — this was
  purely a rendering-consistency fix.

## Fixes (v0.6.1)

- **Shift+Click no longer leaves a stray highlight.** Range-selecting in
  the Content Browser was triggering the browser's own text-selection/focus
  outline on the clicked row. Rows now suppress both, so Shift+Click only
  does the selection you asked for.
- **Auto Layout now routes edges cleanly.** Scene boxes only had
  top/bottom connection points, but Auto Layout arranges scenes
  left-to-right — so choice arrows had to loop out the bottom and back in
  the top of the next box, bending and crossing awkwardly. Connection
  points are now on the left/right sides, matching the flow direction, so
  arrows travel straight and don't cross each other after Auto Layout.

## What's new (v0.6.0)

- **Custom confirmation dialogs.** Every "are you sure?" (deleting a
  scene, deleting a folder, bulk deletes) now shows Scriare's own dark,
  rounded, blurred-backdrop modal instead of a native OS popup — with
  Enter to confirm and Escape to cancel.
- **Multi-selection.** Click a Story item to select just it, **Ctrl/Cmd
  + Click** to add or remove one from the selection, **Shift + Click** to
  select the visible range between two items. Selected rows get a clear
  highlight distinct from the "currently open scene" highlight.
- **Multi-item drag & drop.** Drag any item that's part of a selection of
  more than one, and the whole selection moves together — into another
  folder, back to the Story root, or reordered as siblings.
- **Multi-item context menu actions.** Right-click within a multi-selection
  for bulk **Move… **(via a new destination picker), **Duplicate**,
  **Favorite/Unfavorite**, and **Delete** — all confirmed through the new
  in-app dialog when destructive.
- Existing single-item behavior is unchanged: deleting a folder still
  ungroups its contents up one level with a confirmation, deleting a scene
  still asks for confirmation, and nothing about the Content Browser's
  layout was redesigned.

## What's new (v0.5.0 — Content Browser)

- **Hierarchical Story tree.** Create Folders and Scenes, nest folders
  inside folders, and drag items between them. Right-click anywhere for a
  context menu with only the actions that make sense for what you clicked
  (a folder gets New Scene/New Folder/Rename/Delete; a scene gets
  Rename/Duplicate Scene/Favorite/Delete).
- **Drag & Drop reordering**, Unreal/Unity/VS-Code-Explorer style: drop
  near the top or bottom edge of an item to reorder as a sibling, or drop
  in the middle of a folder to move something inside it.
- **Favorites.** Star any scene from its context menu — favorites show in
  their own section at the top of the browser. A favorite is a reference
  only: it can never move or duplicate the scene, and clicking it just
  opens and focuses the original.
- **Search** instantly filters Story folders and scenes by name.
- **Four more roots** — 👤 Characters, 🌍 Locations, 📝 Notes, 🖼 Assets —
  exist as expandable placeholders ("Coming soon") for future milestones.
  Nothing about them is implemented yet; they're there so the browser
  already has room to grow into them.
- Deleting a folder never deletes what's inside it — its contents move up
  one level, the same non-destructive rule the Flow graph's Frames already
  follow.
- If Story has no scenes yet, you'll see "No story yet." with Create Scene
  / Create Folder buttons instead of an empty tree.

Nothing about the editor, the toolbar, the Story Graph, or Play Mode
changed in either milestone.

### How it's built (for future content types)

The browser doesn't know anything Story-specific under the hood. Every
item in it is a generic `ContentNode` — either a `folder` (pure
organization) or a `leaf` (a reference to a real entity elsewhere, keyed
by `refType`; today only `"scene"` exists). Adding Characters later means
adding a `refType: "character"` and an editor for it — not touching this
tree, its drag-and-drop, its search, or its Favorites system, all of which
are already generic. Favorites work the same way: a favorite is just
`{ refType, refId }`, so any future content type can be favorited without
changing how favoriting works.

## How to run it

You need [Node.js](https://nodejs.org) installed (LTS version).

```bash
npm install
npm run dev
```

## Trying the UX polish out (from v0.6.0)

1. Click one scene, then **Ctrl/Cmd + Click** another — both highlight.
   **Shift + Click** a third to select everything in between.
2. Drag any of the selected scenes into a folder — all of them move
   together.
3. Right-click within the selection and try **Move…**, **Duplicate**,
   **Favorite**, and **Delete** — Delete shows the new in-app confirmation
   dialog (Enter/Escape both work).
4. Delete a single scene or folder the old way — you'll see the same
   custom dialog instead of a Windows/OS popup.

## Trying the Content Browser out

1. Right-click empty space under **📖 Story** (or use the **+ Scene** /
   **+ Folder** buttons in the header) to create a folder.
2. Drag a scene into it — notice it becomes nested. Drag it back out to
   the Story root by dropping it on the "📖 Story" row itself.
3. Right-click a scene and choose **Favorite** — it appears in the
   **Favorites** section at the top. Click it there to jump straight to
   it.
4. Right-click a scene and choose **Duplicate Scene** — the copy keeps the
   same choices and destinations as the original, with fresh ids so
   nothing is shared between them.
5. Type in the search box — the tree is replaced by a flat list of
   matching folders/scenes; click one to jump to it (it also gets
   revealed and expanded back in the tree).
6. Expand **👤 Characters** or any of the other placeholder roots to see
   "Coming soon" — they're not functional yet, on purpose.

## Trying Start Scene Management out (from v0.8.1)

1. Right-click any scene in the Content Browser and choose **Set as Start
   Scene** — its "▶ Start" badge appears immediately, and disappears from
   wherever it was before.
2. Select a different scene and check **This is the Start Scene** in Scene
   Details (the Inspector) — same effect, from a different place.
3. Uncheck it — Play Mode now falls back to the first Story scene again.
4. Open **⚙ Project Settings** and confirm its dropdown always matches
   whichever scene you last set from either of the above.

## Trying Runtime Polish out (from v0.8.0)

1. Open **⚙ Project Settings** in the top bar, pick a different Start
   Scene, and save — notice its "▶ Start" badge move to that scene in both
   the Content Browser and the Flow graph.
2. Press **▶ Play** — it now begins from that scene, with a brief fade in.
3. Play through to a scene with no outgoing choices and confirm the new
   ending card: **Restart Story** and **Return to Editor**.
4. Press **Esc** at any point while playing — you're back in the editor
   instantly, on the same scene, same scroll position, same graph view.

## Trying Narrative Blocks out (from v0.7.0)

1. In a scene, type `/` on its own line — a small menu appears with
   Choice, Divider, Quote, and Callout. Try `/callout` and type inside it.
2. Click **+ Choice** in the toolbar (or type `/choice`) to insert a Choice
   Block, then click **+ Add option** to give it a second path — each
   option gets its own text and destination scene, and the ▲/▼ arrows
   reorder them.
3. Write a scene with a paragraph, then a Choice Block, then another
   paragraph — press **▶ Play** and confirm it plays back in that exact
   order, with the choice's buttons appearing between the two paragraphs.

## Trying the writing workflow out (from v0.4.0)

1. Try the toolbar's underline, color, highlight, alignment, font
   size/family, clear formatting, and horizontal divider controls.
3. Drag the thin bar between the editor and the Flow panel to resize them.

## Trying Play Mode out (from v0.3.0)

1. Write a few scenes with Choice Blocks linking them, and make sure at
   least one has none, so you can see the "The End" screen.
2. Click **▶ Play** in the top bar, click through your choices, then
   **■ Exit Play** to return exactly where you left off.

## Other commands

- `npm run build` — compiles a production version into `out/`.
- `npm run preview` — runs that built production version.
- `npx tsc --noEmit -p tsconfig.node.json` / `tsconfig.web.json` — type-check
  without touching any files. **Do not run `tsc -b`** on this project — its
  build mode writes compiled `.js`/`.jsx`/`.d.ts` files directly next to the
  TypeScript source, which can silently shadow your real source files.

## Regression audit findings (v0.8.2)

Checked against the Content Browser and graph as they worked before the
Runtime Polish / Start Scene sprints — every item below was traced through
its actual code path and confirmed still wired correctly:

- **Folder & scene drag & drop** (`ContentBrowser.tsx`'s
  `handleDragStartNode`/`handleDragOverNode`/`handleDropNode` and
  `projectStore.moveContentNodes`) — the reducer logic itself was (and still
  is) unchanged and correct. **Correction:** this audit only traced the
  logic, not an actual drag in a running browser, and missed that dragging
  didn't actually work at all — a pre-existing bug from v0.6.1, unrelated
  to the Runtime Polish/Start Scene sprints, fixed in v0.8.3. See that
  version's "What's new" above.
- **Nested folders** (`utils/contentTree.ts`'s `childrenOf`) — untouched by
  either sprint; recursive rendering in `ContentTreeRow.tsx` still nests
  correctly to any depth.
- **Multi-selection, Ctrl-selection, Shift-selection**
  (`handleItemClick`/`selectedIds`/`selectionAnchor` in `ContentBrowser.tsx`,
  `flattenVisible` in `contentTree.ts`) — unchanged; the new "Set as Start
  Scene" item only appears in the single-scene context menu branch, the
  bulk-selection branch (Move/Duplicate/Favorite/Delete) is untouched.
- **Favorites** (`toggleFavorite`/`setFavorites` in `projectStore.ts`) —
  unchanged.
- **Search** (`searchResults` filtering in `ContentBrowser.tsx`) —
  unchanged.
- **Folder deletion behavior** (`deleteFolder`/`deleteContentNodes` in
  `projectStore.ts`) — unchanged; folders still ungroup rather than destroy
  their contents, including through nested/bulk deletes.
- **Custom modals** (`Modal.tsx`, `ConfirmDialogHost.tsx`,
  `ContentContextMenu.tsx`, `MoveToDialog.tsx`) — unchanged; the new
  `ProjectSettingsDialog.tsx` is a separate self-contained dialog built on
  the same shared `Modal` shell, it doesn't alter any existing dialog.
- **Graph synchronization** (`FlowPanel.tsx`, `SceneNode.tsx`) — node
  positions, edges, selection highlighting, and Auto Layout are unchanged;
  the graph node's new "▶ Start" badge is an additive `isStart` field
  alongside the existing `label`/`choiceCount`/`isActive` data.

No functional regressions were found. Two stale comments left over from
the `PlayView` → `runtime/PlayRuntime` rename were corrected for accuracy
(`narrativeBlocks/types.ts`, `utils/readingColumn.ts`) — comments only, no
behavior change. Verified with a clean `tsc --noEmit` on both configs, a
clean production build, and a bundle grep confirming every feature's
marker strings are present in the shipped code.

## Where things are

- `src/renderer/src/runtime/` — the Play runtime, kept separate from the
  editor's UI components on purpose. `PlayRuntime.tsx` is the player itself
  (consumes the document model via Tiptap's `generateHTML()`, never imports
  `SceneEditor`/`EditorToolbar`/`ChoiceBlockView`); `registry.ts` maps a
  narrative block's node type to its own playback renderer (`RUNTIME_BLOCKS`
  — the extension point for future blocks); `documentSegments.ts` splits a
  scene's content into ordered prose/block segments using that registry;
  `blocks/choiceRuntimeBlock.tsx` is Choice's own renderer, registered
  rather than hardcoded into the player.
- `src/renderer/src/components/layout/ProjectSettingsDialog.tsx` — the
  Start Scene picker, opened from the top bar's ⚙ button.
  `projectStore.setStartScene(sceneId | null)` is the single action behind
  it, the Content Browser's "Set as Start Scene" context menu item, and the
  Inspector's "This is the Start Scene" checkbox (v0.8.1) — all three read
  and write `project.startSceneId` directly, so they can never disagree.
- `src/renderer/src/components/common/StartBadge.tsx` — the "▶ Start"
  indicator shared by the Content Browser row and the graph's SceneNode.
- `src/renderer/src/types/project.ts` — `ContentCategory`, `ContentFolder`,
  `ContentLeaf`, `ContentNode`, `Favorite` types; `Project.content` (a flat
  list with `parentId`/`order`, same pattern as graph Frames) and
  `Project.favorites`. `normalizeProject()` now also synthesizes Story-root
  leaves for any scene from an older project file that predates the
  Content Browser.
- `src/renderer/src/utils/contentTree.ts` — generic tree helpers:
  `childrenOf()`, `nextOrder()`, `isDescendant()` (cycle prevention while
  dragging a folder), `ancestorsOf()`, `computeDropPosition()`.
- `src/renderer/src/state/projectStore.ts` — added `createFolder`,
  `renameFolder`, `deleteFolder`, `moveContentNode`, `duplicateScene`, and
  `toggleFavorite`. `createScene` now takes an optional parent folder id.
  `deleteScene` also removes the scene's content leaf and any favorite
  referencing it.
- `src/renderer/src/components/layout/ContentBrowser.tsx` — the whole
  browser: header, search, Favorites section, the Story tree (or its
  empty state), and the four placeholder category roots.
- `src/renderer/src/components/layout/ContentTreeRow.tsx` — the recursive
  row renderer (folder or scene), handling expand/collapse, inline
  rename, drag & drop, and the context-menu trigger.
- `src/renderer/src/components/layout/ContentContextMenu.tsx` — a small
  generic right-click menu; the caller supplies whatever actions are
  relevant.
- `src/renderer/src/components/layout/contentBrowserContext.ts` — a React
  context carrying the browser's shared state/callbacks down to each
  recursive row, instead of prop-drilling through every nesting level.
