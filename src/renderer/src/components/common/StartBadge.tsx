interface StartBadgeProps {
  /** Compact form for tight spaces (e.g. the graph node) — smaller, still
   * icon + label so it never turns into an unlabeled dot. */
  compact?: boolean;
}

/**
 * The Start Scene indicator — a small labeled pill rather than a rocket icon
 * (Twine's convention), so it reads clearly at a glance in both the Content
 * Browser and the graph without introducing a new iconography language.
 */
export function StartBadge({ compact = false }: StartBadgeProps) {
  return (
    <span
      title="Start Scene — Play Mode begins here"
      className={`inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full bg-[var(--accent-fill-soft)] font-semibold uppercase tracking-wide text-[var(--accent)] ${
        compact ? "px-1 py-0.5 text-[8px]" : "px-1.5 py-0.5 text-[9px]"
      }`}
    >
      <span aria-hidden>▶</span>
      Start
    </span>
  );
}
