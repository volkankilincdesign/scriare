/**
 * The app's icon set (v0.24.0).
 *
 * These replace the emoji that previously marked content categories and
 * tree rows. Emoji are the wrong material for this interface for two
 * reasons: they arrive in full colour, which fights a deliberately
 * monochrome chrome and competes with the colour the writer assigns to
 * their own content; and they're drawn by the operating system, so the
 * same row renders in a different illustrative style on Windows, macOS
 * and Linux — the one part of the UI whose look the app doesn't control.
 *
 * Every icon here is a single stroked path on a 16-unit grid, inheriting
 * `currentColor` and sized by the caller, so they take the text colour of
 * whatever row they sit in and shift with the theme for free.
 */
interface IconProps {
  name: IconName;
  className?: string;
}

export type IconName =
  | "story"
  | "character"
  | "location"
  | "note"
  | "asset"
  | "folder"
  | "scene";

const PATHS: Record<IconName, JSX.Element> = {
  // An open book — the Story root.
  story: (
    <>
      <path d="M8 4.2c-1.3-.9-2.9-1.3-4.5-1.2a.6.6 0 0 0-.5.6v7.6c0 .35.3.62.65.6 1.5-.1 3 .3 4.35 1.2" />
      <path d="M8 4.2c1.3-.9 2.9-1.3 4.5-1.2a.6.6 0 0 1 .5.6v7.6a.6.6 0 0 1-.65.6c-1.5-.1-3 .3-4.35 1.2" />
      <path d="M8 4.2V13" />
    </>
  ),
  // A head and shoulders.
  character: (
    <>
      <circle cx="8" cy="6" r="2.6" />
      <path d="M3.4 13.2a4.9 4.9 0 0 1 9.2 0" />
    </>
  ),
  // A map pin.
  location: (
    <>
      <path d="M8 2.8c2.2 0 4 1.75 4 3.9 0 2.85-4 6.5-4 6.5s-4-3.65-4-6.5c0-2.15 1.8-3.9 4-3.9Z" />
      <circle cx="8" cy="6.6" r="1.4" />
    </>
  ),
  // A page with ruled lines.
  note: (
    <>
      <path d="M4 2.9h5.2L12 5.7v7.4H4Z" />
      <path d="M9.1 2.9v2.9H12" />
      <path d="M6 9h4M6 11h2.6" />
    </>
  ),
  // Image frame with a horizon.
  asset: (
    <>
      <rect x="3" y="3.6" width="10" height="8.8" rx="1.3" />
      <path d="M3.4 10.4 6 8.2l2.2 1.9 2-1.7 2.4 2" />
      <circle cx="6.2" cy="6.3" r=".9" />
    </>
  ),
  folder: <path d="M2.9 12.4V4.5c0-.35.28-.63.63-.63h2.3l1.4 1.5h4.25c.35 0 .62.28.62.63v6.4c0 .35-.27.63-.62.63H3.53a.63.63 0 0 1-.63-.63Z" />,
  // A document, deliberately plainer than the Notes icon so a scene row
  // and a notes category never read as the same thing.
  scene: (
    <>
      <path d="M4.2 2.9h4.9L11.8 5.6v7.5H4.2Z" />
      <path d="M9 2.9v2.8h2.8" />
    </>
  ),
};

export function Icon({ name, className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}
