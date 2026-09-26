import { GROUND_TOKENS } from "../export/readingThemes";

/**
 * The reading grounds, scoped to Play Mode (v0.57.0).
 *
 * GENERATED FROM THE EXPORT'S OWN TABLE, not copied from it. Every colour
 * below is `GROUND_TOKENS` — the same literal the exported page's
 * stylesheet is built from — so Play and the export cannot drift into two
 * slightly different Nights. That was the whole risk of this change: two
 * implementations of one look is the pair that always drifts, and the only
 * defence is that there is one table and both read it.
 *
 * WHY A `<style>` RATHER THAN A CSS FILE. The grounds live in TypeScript
 * because the contrast check and the export template both need them as
 * data, and styles/themes.css cannot import a module. Rendering the block
 * from the same constant is what keeps one source of truth; hand-copying
 * the forty-odd values into index.css would be the drift, written down.
 *
 * THE WHOLE PLAY SURFACE IS ON THE GROUND, including its bar, because that
 * is what the exported page does — the reader's bar sits on `--bg` and
 * `--border-soft` like everything else. The Variable Readout is the one
 * thing in here a reader never sees, and it follows the ground too: a HUD
 * still painted in the editor's theme, floating over a Night page, reads
 * as a bug rather than as an instrument.
 */

/**
 * The five tokens Play Mode uses that a reading ground does not define.
 *
 * A ground is nine decisions about reading a page; it has no opinion about
 * a raised panel or a hover state because an exported page has neither.
 * Play Mode does — the Variable Readout is a floating panel and the
 * Restart button has a hover — so those five are DERIVED from the ground
 * rather than left to fall through to the writer's theme, which is the
 * exact leak this version exists to close.
 *
 * `--accent-text-on: var(--page)` is not a guess: it is what the exported
 * page already paints on an accent fill (see pageStyles' `.scriare-choice`
 * rules), and it is right in both directions — Night's accent is light and
 * its page is dark, Paper's are the other way round.
 */
const BRIDGE_TOKENS = `
    --surface:               var(--surface-2);
    --surface-translucent:   var(--surface-2-translucent);
    --shadow-raised:         var(--sheet-shadow);
    --accent-text-on:        var(--page);
    /* Hover moves the accent TOWARDS the text rather than away from it, so
       whatever sits on the fill keeps its contrast instead of losing it at
       the moment of being pressed. */
    --accent-hover:          color-mix(in oklab, var(--accent) 85%, var(--text));
`;

export const PLAY_GROUND_CSS = `
[data-play-root][data-ground="night"] {
  color-scheme: dark;
${GROUND_TOKENS.night}
}
[data-play-root][data-ground="paper"] {
  color-scheme: light;
${GROUND_TOKENS.paper}
}
[data-play-root] {
${BRIDGE_TOKENS}
  /* The inherited text colour, and not a token — found by the themes
     walk, which now audits this surface against the ground (v0.57.0).
     Redefining --text on this element does not change the colour that
     body already resolved from it, so every container inside Play was
     still inheriting the WRITER'S ink: five elements per theme, including
     the ending card. Nothing visible was painted in it today, because
     each piece of text happens to set its own colour — which is exactly
     the kind of luck that stops holding the next time someone adds a
     line. */
  color: var(--text);
}
/* Tiptap's Highlight mark renders in the browser's own yellow unless
   something says otherwise. The export says otherwise, in pageStyles'
   .scriare-prose mark rule; until now Play did not, so a highlighted line
   was the one piece of a story that looked different in the rehearsal and
   in the finished file. */
[data-play-root] mark {
  background: var(--highlight);
  color: var(--text);
  padding: 0 .12em;
  border-radius: 2px;
}
`;
