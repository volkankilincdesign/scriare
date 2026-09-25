# Tier 4 — getting around without a mouse (v0.50.0)

The v0.48.0 audit's tier 4, taken in full. Every claim was reproduced
against the running app before anything changed, and the numbers below are
what came back.

Taken before the remaining tier-3 performance work on the project's own
standard: the roadmap says UI dead ends are defects rather than gaps, and
"collapse Story, never reopen it" is a dead end.

## What was measured, before

| Claim | Measured |
|---|---|
| Disclosure and entity rows unreachable | `{"tag":"DIV","tabIndex":-1,"role":null}` on the Story header, both category headers and every character row |
| Focus ring invisible | a focused tree row matches `:focus-visible`, `outline-width: 2px`, `outline-color: rgba(0, 0, 0, 0)` |
| Modal has no dialog semantics | no `role="dialog"`, focus stays on the opener, Tab walks the app behind the scrim |
| Inspector shows a stale mention | after renaming Mara → Kestrel: graph `"Ask Kestrel"`, Inspector `"Ask Mara"` |
| Header drift | 33 headers, three type ramps: 12px/wide ×23, 10px/wide ×5, 10px/wider ×5, weight drifting across semibold / medium / unset |

The audit named one stale-mention reader. Measuring it found a second
(`InspectorPanel.tsx:118`, the scene summary) that nothing had reported.

## The focus ring, which was not a one-line fix

`focus:outline-none` compiles to a 2px outline coloured `transparent` at
specificity (0,2,0). The app's global `:focus-visible` ring is (0,1,0).
Both matched on keyboard focus and the invisible one won.

Removing it was not enough, and the test is what said so: a real click then
painted a ring on every row. `:focus-visible` handles this for native
controls, but **Chromium keeps matching it after a pointer click on a
`div[tabindex="0"]`** — and the Content panel's rows must stay divs because
they are drag handles. So the app had been choosing between a ring on every
click and no ring at all.

`utils/focusModality.ts` tracks the modality instead: pointer in use, no
rings; a key that moves focus, rings. Both halves are asserted on what is
PAINTED rather than on whether the pseudo-class matches — asserting the
pseudo-class was asserting Chromium's heuristic, not the app's behaviour.

One thing worth knowing for the future: a synthetic `new MouseEvent(...)`
does NOT reproduce this, because untrusted events make the following focus
score as programmatic. The first version of that check used one and
reported a ring that a real click did not produce, which would have sent
me to fix an app that was behaving correctly.

## The palette walk: 4 surfaces → 13

Export, Project Settings, entity pages, Find results, the context menu,
toasts, the conflict dialog, Play Mode and the Welcome screen had never
been walked by the audit that exists to walk them — which is why the
`--overlay` misuse on the writing surface survived four versions.

Two consequences:

- The theme picker and the export's ground swatches now carry
  `data-content-colour`, the existing mark for "this colour IS the
  content". Painting colours that are not the current palette is precisely
  their job.
- The walk learned that **a palette token at reduced opacity is still that
  token**. Find's highlight is `color-mix(in srgb, var(--accent) 26%,
  transparent)`.

Surfaces are opened the way a writer opens them where that is possible — a
click on the real control — because Project Settings has no store to poke.
It is local state in TopBar, so a store-name-driven list could not have
included it however long it got.

## Findings about the tests

**Convergence rounding.** The walk's first attempt at "this colour without
its transparency" painted it over itself forty times. Every pass quantises
to 8 bits, the error accumulates, and it settled two to four units off per
channel — nine units of distance against a tolerance of eight. It passed on
six themes, whose accent is near-white and sat within tolerance of
`--text`, and failed only on the two whose accent is a distinctive colour.
*A check that agrees with you except where it is actually being tested is
worse than no check.* It now solves the alpha from two composites:
over black `out = c·a`, over white `out = c·a + 255·(1−a)`.

**Testing the utility instead of the caller.** The two Inspector checks
called `extractChoices` / `findChoiceBlockOptions` directly and passed the
resolver themselves — testing that the resolver works, which was never in
doubt, and saying nothing about whether the Inspector passes one. Both
negative controls went uncaught. They read the rendered panel now.

**A drift detector that cannot detect drift.** The section-label check
queried `.scriare-section-label`, so the control that stripped the class
from one header removed it from the sample and the survivors still agreed.
It now measures every uppercase micro-label on screen, class or not.

**Specs share an application.** This one collapses sections, and the
Content Browser remembers which are open in localStorage. Leaving them open
made the next spec — which clicks to open its own — close them instead and
report no cast. The categories default to CLOSED (`new Set([STORY_ROOT])`),
so the restore has to match the default rather than "everything open".

**Two controls removed for passing honestly.** The starting value of the
pointer-modality flag is a sensible default, not a guarantee: any key that
moves focus resets it before focus lands anywhere, so flipping it changes
nothing a test can see. Both comments were reworded to stop claiming more
than the tests show.

## What was deliberately left alone

- Four **inline tags** that sit beside text rather than above a group
  (`mr-1`, `shrink-0`) keep their own size — a different job from a section
  header.
- The **vertical rail labels** on collapsed panels: 10px uppercase rotated
  90° is a legibility question of its own.
- The **canvas group-name input**, which is an input that happens to be
  uppercase.

## Still open from the audit

- **Tier 3**: the Inspector's colour input, ContentBrowser's context object
  and unmemoized `ContentTreeRow`, `ChoiceOptionView` subscribing to the
  whole project.
- **Tier 5**: all of it.

464 tests, 53 negative controls.
