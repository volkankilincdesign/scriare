/**
 * Shared sizing used by the graph's node components, the auto-layout
 * algorithm, and the frame/scene containment check — all three need to
 * agree on how big a scene card is on screen.
 */
export const SCENE_NODE_WIDTH = 180;
export const SCENE_NODE_HEIGHT = 56;

// A frame this small could barely hold a single scene card once the title
// bar and a little padding are accounted for — the old 200x140 floor let
// someone resize a frame down to something that could never usefully group
// anything. Raised so the smallest a frame can get still comfortably fits
// at least one SCENE_NODE_WIDTH/HEIGHT card with room around it;
// buildFrame's default size (types/project.ts) starts well above this
// floor on purpose — this is just the resize-down limit.
export const FRAME_MIN_WIDTH = 260;
export const FRAME_MIN_HEIGHT = 170;

interface FrameLike {
  id: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

/**
 * Which frame (if any) a scene positioned at `topLeft` currently overlaps,
 * using the scene card's center point against each frame's rectangle.
 * Shared by the actual drop logic (projectStore's updateScenePosition) and
 * the live drag-hover preview (FlowPanel) so the highlighted frame during a
 * drag always matches the frame the scene will actually join on release —
 * the whole point of a drop preview is that it never lies.
 */
export function findContainingFrame<F extends FrameLike>(
  frames: F[],
  topLeft: { x: number; y: number },
): F | undefined {
  const center = {
    x: topLeft.x + SCENE_NODE_WIDTH / 2,
    y: topLeft.y + SCENE_NODE_HEIGHT / 2,
  };
  return frames.find(
    (frame) =>
      center.x >= frame.position.x &&
      center.x <= frame.position.x + frame.size.width &&
      center.y >= frame.position.y &&
      center.y <= frame.position.y + frame.size.height,
  );
}
