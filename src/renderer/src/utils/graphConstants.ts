/**
 * Shared sizing used by the graph's node components, the auto-layout
 * algorithm, and the group/scene containment checks — all of them need to
 * agree on how big a scene card is on screen.
 */
export const SCENE_NODE_WIDTH = 180;
export const SCENE_NODE_HEIGHT = 56;

// A group this small could barely hold a single scene card once the title
// bar and a little padding are accounted for. Raised in v0.14.1 from an
// original 200x140, which let a box be dragged down to a size that could
// never usefully group anything; buildStoryFolder's default size
// (types/project.ts) starts well above this on purpose — this is just the
// resize-down limit.
export const FOLDER_MIN_WIDTH = 260;
export const FOLDER_MIN_HEIGHT = 170;

/** How much air a group keeps around whatever it contains when it grows to fit. */
export const FOLDER_PADDING = 26;
