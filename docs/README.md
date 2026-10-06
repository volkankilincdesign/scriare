# Design documents

These are the documents for Scriare — the reasoning behind decisions, written as they were made, plus the launch material. They are mirrored from the project workspace so the repository carries its own history.

**The project workspace is the source of truth; this folder is the mirror, refreshed at release time.** If a document here and one in the project disagree, the project is right and this copy is stale. `CHANGELOG.md` and `CASE_STUDY.md` at the repository root are the narrative companion to these, and are not mirrors — they live only in the repository.

As of v0.88.5 this folder is also where the launch material lives. It used to sit loose in `other_materials/`, where the brief drifted three versions out of date without anyone noticing, so it was merged in here.

## Direction

- [roadmap.md](roadmap.md) — where the app stands version by version, the launch list that decides when it ships, what was explored and declined (mobile, cloud), and the standing working preferences.
- [project-brief.md](project-brief.md) — the short public description: what Scriare is, why it exists against node canvases and scripting languages, who it is for, and the honest caveats. Paste this into a new conversation to bring it up to speed.
- [positioning.md](positioning.md) — what Scriare is *instead of*: the argument against Twine, articy:draft, Ink and ChoiceScript, what is deliberately not claimed, and the lines that are true and usable.

## Launch material

- [video-script.md](video-script.md) — the 90-second video: nine beats with what is on screen, the caption, and why the beat exists; the shot list, the cut order if it runs long, and two different 30-second cuts for a feed and for a portfolio page.
- [demo-story-draft.md](demo-story-draft.md) — **superseded.** "The Exact Word", a 13-scene draft written as something to react to. The demo story that exists is The Blue Hour, 32 scenes in five chapters. Kept because it is the record of how the demo story was scoped before it was written.
- [demo-story-scaffold-notes.md](demo-story-scaffold-notes.md) — **superseded.** What was in the empty 13-scene scaffold, which no longer exists. Kept for the same reason.

## Architecture and formats

- [architecture-plan.md](architecture-plan.md) — the long-running engineering record: philosophy, the known pitfalls learned the hard way, the tech stack, every subsystem's architecture, the core data model and the full version history.
- [file-format.md](file-format.md) — why the project file is `.scriare` rather than `.scri`, what the rename touches, and why it had to be settled before the demo story.
- [v0.32.0-choice-schema.md](v0.32.0-choice-schema.md) — turning a Choice Block's labels into real inline ProseMirror content so the toolbar could style them, plus the toolbar icon rework that followed.

## Features

- [dialogue-m2.md](dialogue-m2.md) — the Dialogue block specified: an option that adds a reply to the page instead of turning it, chosen from a board of four live styles so the board would not have to be re-read to build it.
- [export.md](export.md) — why the exported page gets its own two reading grounds instead of the writer's editor theme, what travels and what does not, and the CSS class contract later work depends on.
- [spreadsheet-export.md](spreadsheet-export.md) — one workbook and one CSV per language carrying every string a reader sees, designed to answer to three audiences at once: a translator, a VO director, and somebody wiring the story into an engine by hand.
- [graph-wires-v0.73.0.md](graph-wires-v0.73.0.md) — the reported defect that overlapping edges made the graph unreadable, the first proposal that was rejected for moving the cards, and the routing that replaced it.
- [save-safety.md](save-safety.md) — the truncating write that could destroy a story, the atomic replace that fixed it, and the three further defects found while reviewing the work.
- [demo-story.md](demo-story.md) — the demo story scoped as a vertical slice: the two risks that make a slice read as abandoned, and what defuses each.
- [welcome-v0.53.0.md](welcome-v0.53.0.md) — the first screen rebuilt as one screen in three states: what the cached story shape costs, why the sample is breadth-first, and why nothing on it is dimmed.

## Audits and findings

- [audit-v0.48.md](audit-v0.48.md) — the whole-app audit findings record: six confirmed ways the app could lose a writer's work, ten broken features, and tiers of performance, accessibility and dead-code issues, each reproduced by measurement.
- [audit-v0.48-outcome.md](audit-v0.48-outcome.md) — what v0.49.0 took from that audit, what it deliberately left, and the test debt the round exposed.
- [close-safety-v0.49.1.md](close-safety-v0.49.1.md) — two data-loss bugs found inside the data-loss fixes: a flush that awaited nothing, and a four-second timer racing the question the app asks.
- [accessibility-v0.50.0.md](accessibility-v0.50.0.md) — keyboard reachability, the focus ring that was drawn in transparent, dialog semantics, and widening the palette walk from four surfaces to thirteen.
- [perf-v0.51.0.md](perf-v0.51.0.md) — measuring before optimising: two of the audit's three named hot paths cost nothing, and the real bottleneck was the Story Graph rebuilding every node.
- [auto-layout-measurement.md](auto-layout-measurement.md) — Auto Layout measured on the real 32-scene story before anything was changed, which is how three suspected faults turned out not to reproduce and the real one was found next door.
- [visual-sweep-findings.md](visual-sweep-findings.md) — seven findings from looking at the shipped build with the real story loaded: two bugs, four decisions, and one fact about the demo story. Both bugs were found by looking at a picture while 1108 tests were green.

## Sprint reports

- [sprint-9a-runtime-foundation-report.md](sprint-9a-runtime-foundation-report.md) — Variables and Actions as typed, project-owned state with no expression field anywhere, and the Inspector becoming a discriminated-union switch.
- [sprint-9b-choice-block-inspector-report.md](sprint-9b-choice-block-inspector-report.md) — moving Choice editing into the Inspector as accordions, the editor/store desync bug that fixed, and a dependency-free drag-reorder.
