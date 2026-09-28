import { useId } from "react";

/**
 * The Scriare mark (v0.68.0).
 *
 * DRAWN, NOT LOADED. It was two baked SVG files chosen by the theme's
 * ground — black artwork on light themes, white on dark — which meant the
 * one coloured thing in the top bar was the one thing that ignored the
 * theme, and a ninth theme would have needed a ninth decision. The disc
 * takes `currentColor` now, so it is coloured the way every other coloured
 * thing in the app is: by CSS, from a token.
 *
 * THE LETTERFORM IS A HOLE, not a shape in a second colour. Cut with a
 * mask, so whatever is behind the mark shows through it — the top bar's
 * surface, the Welcome screen's page, a future header with an image in it.
 * Painting the letter in a colour would be a guess about what is behind,
 * and it would be wrong on exactly the surfaces that are not the one it
 * was guessed for.
 *
 * THE VIEWBOX IS PADDED BY 6%, which is the fix for "the top and bottom
 * look cut off". The artwork inscribes its circle exactly in a 900×900
 * box, so the disc is tangent to the edge of its own element; at 24px the
 * top row of that circle is a flat run about 6px wide pressed against the
 * boundary, and a tangent reads as a cut. With air around it the same row
 * reads as curvature.
 *
 * The OS-facing icon (taskbar, window, installer) is still a fixed asset —
 * see build/icon.png. It has no theme to follow.
 */

/** The blackletter S, straight from other_materials/logos. */
const LETTER =
  "M621,621.59c-53.2,4.41-89.8,9.4-109.8,15-35.2,10-66.81,28.6-94.8,55.8-11.61-26-35.01-39-70.2-39-14.4,0-26.2,3.4-35.4,10.2-10.41,7.6-15.6,18.21-15.6,31.8,0,12.8,5.9,22.2,17.7,28.2,11.79,6,17.7,9.8,17.7,11.4,0,2-1.8,3-5.4,3-15.21,0-28-7.2-38.4-21.6-9.6-13.2-14.4-27.6-14.4-43.2,0-29.19,9.99-51.8,30-67.8,8.4-6.8,27.2-16.59,56.4-29.4,21.6-9.6,33.2-20.79,34.8-33.6,2,22.41,13.5,42.21,34.5,59.4,21,17.2,42.9,26.2,65.7,27v-146.4c0-21.2-15.81-31.8-47.4-31.8-23.61,0-48,6.4-73.2,19.2-27.6,14.01-43.6,32.01-48,54v-170.4c0-23.6-2.8-40.8-8.4-51.6-8.01-14.79-22.8-21.99-44.4-21.6v-12.6h60c32.79,0,57.39-3.39,73.8-10.2,8-3.2,21.2-11.4,39.6-24.6,15.99-11.6,32.19-19.59,48.6-24,6-1.59,11.19-2.4,15.6-2.4,7.59,0,14.79,4.8,21.6,14.4,8.79,12.81,17.4,22.2,25.8,28.2,14.79,10.8,36,17.01,63.6,18.6v12.6c-26.4,1.6-49,10.5-67.8,26.7-18.81,16.2-30.81,37.3-36,63.3-12-66-45.4-99.6-100.2-100.8v127.8c0,23.61,13.59,35.4,40.8,35.4,20,0,42.99-6.2,69-18.6,27.99-13.2,46.2-27.8,54.6-43.8v160.2c0,21.21,1.8,37.6,5.4,49.2,5.6,18,17,27.81,34.2,29.4v12.6ZM460.8,421.79c-2.4-.39-6.81-1.4-13.2-3v-132c4.4,2.8,8.79,5.01,13.2,6.6v128.4ZM460.8,607.19c-4.41-2-8.2-4.4-11.4-7.2l-1.8-.6v-136.2h7.2c.39,0,1.4.21,3,.6h3v143.4Z";

interface BrandMarkProps {
  className?: string;
}

export function BrandMark({ className }: BrandMarkProps) {
  // One document can hold two of these — the Welcome screen's and the top
  // bar's — and two masks with the same id is one mask.
  const maskId = `brand-cut-${useId()}`;
  return (
    <svg
      viewBox="-28 -28 956 956"
      className={className}
      role="img"
      aria-hidden
      data-brand-mark
    >
      <mask id={maskId} maskUnits="userSpaceOnUse" x="-28" y="-28" width="956" height="956">
        <circle cx="450" cy="450" r="450" fill="#fff" />
        <path d={LETTER} fill="#000" />
      </mask>
      <rect
        x="-28"
        y="-28"
        width="956"
        height="956"
        fill="currentColor"
        mask={`url(#${maskId})`}
      />
    </svg>
  );
}
