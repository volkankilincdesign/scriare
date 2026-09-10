# Scriare — v0.20.3 — Bold/Code No Longer Hide Text Color

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
