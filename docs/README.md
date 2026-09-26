# Design documents

These are the design documents for Scriare — the reasoning behind decisions, written as they were made. They are mirrored from the project workspace so the repository carries its own history.

## Direction

- [roadmap.md](roadmap.md) — where the app stands version by version, the launch list that decides when it ships, what was explored and declined (mobile, cloud), and the standing working preferences.
- [project-brief.md](project-brief.md) — the short public description: what Scriare is, why it exists against node canvases and scripting languages, who it is for, and the honest caveats.

## Architecture and formats

- [architecture-plan.md](architecture-plan.md) — the long-running engineering record: philosophy, the known pitfalls learned the hard way, the tech stack, every subsystem's architecture, the core data model and the full version history.
- [file-format.md](file-format.md) — why the project file is `.scriare` rather than `.scri`, what the rename touches, and why it had to be settled before the demo story.
- [v0.32.0-choice-schema.md](v0.32.0-choice-schema.md) — turning a Choice Block's labels into real inline ProseMirror content so the toolbar could style them, plus the toolbar icon rework that followed.

## Features

- [export.md](export.md) — why the exported page gets its own two reading grounds instead of the writer's editor theme, what travels and what does not, and the CSS class contract later work depends on.
- [save-safety.md](save-safety.md) — the truncating write that could destroy a story, the atomic replace that fixed it, and the three further defects found while reviewing the work.
- [demo-story.md](demo-story.md) — the demo story scoped as a vertical slice: the two risks that make a slice read as abandoned, and what defuses each.
- [welcome-v0.53.0.md](welcome-v0.53.0.md) — the first screen rebuilt as one screen in three states: what the cached story shape costs, why the sample is breadth-first, and why nothing on it is dimmed.

## Audits and findings

- [audit-v0.48.md](audit-v0.48.md) — the whole-app audit findings record: six confirmed ways the app could lose a writer's work, ten broken features, and tiers of performance, accessibility and dead-code issues, each reproduced by measurement.
- [audit-v0.48-outcome.md](audit-v0.48-outcome.md) — what v0.49.0 took from that audit, what it deliberately left, and the test debt the round exposed.
- [close-safety-v0.49.1.md](close-safety-v0.49.1.md) — two data-loss bugs found inside the data-loss fixes: a flush that awaited nothing, and a four-second timer racing the question the app asks.
- [accessibility-v0.50.0.md](accessibility-v0.50.0.md) — keyboard reachability, the focus ring that was drawn in transparent, dialog semantics, and widening the palette walk from four surfaces to thirteen.
- [perf-v0.51.0.md](perf-v0.51.0.md) — measuring before optimising: two of the audit's three named hot paths cost nothing, and the real bottleneck was the Story Graph rebuilding every node.

## Sprint reports

- [sprint-9a-runtime-foundation-report.md](sprint-9a-runtime-foundation-report.md) — Variables and Actions as typed, project-owned state with no expression field anywhere, and the Inspector becoming a discriminated-union switch.
- [sprint-9b-choice-block-inspector-report.md](sprint-9b-choice-block-inspector-report.md) — moving Choice editing into the Inspector as accordions, the editor/store desync bug that fixed, and a dependency-free drag-reorder.

`CHANGELOG.md` and `CASE_STUDY.md` at the repository root are the narrative companion to these.
