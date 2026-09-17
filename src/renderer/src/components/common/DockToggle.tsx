interface DockToggleProps {
  /** The way the panel folds away — which is the way the chevron points. */
  direction: "left" | "right" | "down" | "up";
  onClick: () => void;
  /** Says what it does; used as both the tooltip and the accessible name. */
  title: string;
}

/**
 * The control that folds a panel away, and the only one (v0.45.0, reported).
 *
 * All three dockable panels — Content, Inspector, Story Graph — had their own
 * version of this: three different glyphs at three different sizes, one of
 * them baked into a header label that was itself the button. They then landed
 * differently again per theme, because one panel's ghost buttons were being
 * caught by an elevation rule meant for selected rows (see
 * `.scriare-row-on` in index.css) and drawn as raised boxes, while the
 * identical control in the next panel stayed flat text. Same job, three
 * appearances, and none of them obviously a button.
 *
 * So it is one component with one look: a real bordered control, the same
 * size everywhere, in every theme — because "is this clickable?" should not
 * be a question a writer has to answer twice in one window.
 *
 * The chevron is drawn rather than typed. A glyph like ◂ is a font's opinion:
 * its weight, size and baseline differ between the faces the app falls back
 * to, which is half of why the three of these never matched.
 */
export function DockToggle({ direction, onClick, title }: DockToggleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="scriare-dock-btn"
    >
      <DockChevron direction={direction} />
    </button>
  );
}

/**
 * The same object, drawn inside a collapsed strip.
 *
 * A collapsed panel is one wide click target — the whole strip, which is how
 * they have always worked — so this cannot be a button: a button inside a
 * button is invalid, and the inner one would swallow the click. It is the
 * same box, so the control a writer clicks to fold a panel away and the one
 * they click to bring it back are recognisably the same control.
 */
export function DockGlyph({ direction }: { direction: DockToggleProps["direction"] }) {
  return (
    <span aria-hidden className="scriare-dock-btn">
      <DockChevron direction={direction} />
    </span>
  );
}

const POINTS: Record<DockToggleProps["direction"], string> = {
  left: "14.5 5 7.5 12 14.5 19",
  right: "9.5 5 16.5 12 9.5 19",
  down: "5 9.5 12 16.5 19 9.5",
  up: "5 14.5 12 7.5 19 14.5",
};

function DockChevron({ direction }: { direction: DockToggleProps["direction"] }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width="11"
      height="11"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points={POINTS[direction]} />
    </svg>
  );
}
