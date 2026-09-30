import { useEffect } from "react";
import { Button } from "./Button";
import { readColorOnGrounds } from "../../export/contrastCheck";
import { GROUND_PAGE_HEX, GROUND_TEXT_HEX } from "../../export/readingThemes";
import type { ColorSubject, GroundReading } from "../../export/contrastCheck";
import type { ReadingGround } from "../../export/readingThemes";

/**
 * How a colour reads on the two grounds (v0.58.0).
 *
 * THE PROBLEM, MEASURED. A colour is chosen while looking at one page —
 * whichever of the eight themes the writer works in — and lands on one of
 * two, chosen by the reader. `#7a1f1f`, a dark red picked on a light
 * theme, is 9.54:1 on Paper and 1.82:1 on Night; `#bcd6f0`, a pale blue
 * picked in Dark, is exactly the other way round. And the set of colours
 * that clear 4.5:1 on BOTH grounds is EMPTY — the best any single literal
 * colour can manage is about 4.16:1, just under the line. So this panel
 * cannot promise a safe colour, and does not pretend to. What it does is
 * turn a surprise at export time into a decision at pick time, which is
 * the only moment changing your mind is free.
 *
 * WHY IT SITS BESIDE THE NATIVE PICKER RATHER THAN REPLACING IT. Drawn
 * three ways first (H2/H3/H6 on the design canvas). Owning the colour
 * dialog would have bought a swatch list and cost the eyedropper, the OS
 * palette and every colour the writer has used in every other app that
 * week. The chosen shape keeps `<input type="color">` exactly as it is —
 * first press still opens Windows' own dialog, no extra click — and puts
 * the reading underneath it. That input fires on every pixel of a drag
 * and the toolbar has thrown those events into a one-per-frame throttle
 * since v0.33.0, so the readings follow the drag for free.
 *
 * It stays after the dialog closes, because it cannot depend on being
 * seen during the drag: Windows places that dialog where it likes and may
 * sit over the toolbar. Live is the better case; after is the guaranteed
 * one.
 *
 * THE NUMBERS COME FROM THE EXPORT'S OWN FUNCTION. `readColorOnGrounds`
 * lives in export/contrastCheck.ts beside `checkStoryContrast` and shares
 * its parsing, compositing and threshold, so the number here and the
 * number in the export warning cannot disagree.
 */
export function ColorOnGrounds({
  subject,
  onDismiss,
  className = "",
}: {
  subject: ColorSubject;
  /** Omitted where the panel belongs to a control that is already open. */
  onDismiss?: () => void;
  className?: string;
}) {
  const readings = readColorOnGrounds(subject);

  // Escape closes it, the way Escape closes everything else the app puts on
  // top of something. Registered here rather than in each caller so a new
  // caller cannot forget it.
  useEffect(() => {
    if (!onDismiss) return;
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") onDismiss?.();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onDismiss]);

  return (
    <div
      data-color-on-grounds
      // The app's own floating-panel spelling, the one the Variable Readout
      // uses in Play: a translucent surface over a blur, on the raised
      // shadow. Nothing new is invented here (v0.56.0's rule).
      className={`w-[320px] rounded-lg border border-[var(--border)] bg-[var(--surface-translucent)] p-2.5 shadow-[shadow:var(--shadow-raised)] backdrop-blur ${className}`}
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="scriare-section-label text-[var(--text-3)]">How it reads</span>
        {onDismiss && (
          <Button intent="ghost" size="sm" onClick={onDismiss}>
            Dismiss
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        {readings.map((reading) => (
          <GroundPreview key={reading.ground} reading={reading} subject={subject} />
        ))}
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-2)]">
        {sentenceFor(readings, subject)}
      </p>
    </div>
  );
}

/**
 * One ground, drawn in its own colours.
 *
 * `data-content-colour` is the existing mark for "this colour IS the
 * content" (v0.46.0) — the same one the toolbar's swatch carries. It has
 * to be here: Night must look like Night in all eight themes, so these are
 * literal values from the export's own table, and the palette audit in
 * themes.spec.mjs would otherwise report every one of them as a stray.
 */
function GroundPreview({ reading, subject }: { reading: GroundReading; subject: ColorSubject }) {
  const page = GROUND_PAGE_HEX[reading.ground as ReadingGround];
  const ink = GROUND_TEXT_HEX[reading.ground as ReadingGround];
  const failed = reading.ratio !== null && !reading.passes;

  return (
    <div className="min-w-0 flex-1">
      <div
        data-content-colour
        data-ground-preview={reading.ground}
        className="rounded-md border border-[var(--border-soft)] p-2"
        style={{ background: page }}
      >
        <Specimen subject={subject} ink={ink} />
      </div>
      <div className="mt-1 flex items-baseline gap-1.5 text-[10px]">
        <span className="text-[var(--text-2)]">{reading.label}</span>
        <span className={failed ? "font-semibold text-[var(--warning)]" : "text-[var(--text-3)]"}>
          {reading.ratio === null ? "follows it" : `${reading.ratio.toFixed(1)}:1`}
        </span>
        {/* The mark is on the failing side only. A tick beside the good one
            would double the ink for no new fact, and the app's rule is that
            colour belongs to what carries meaning. */}
        {failed && <span className="text-[var(--warning)]">⚠</span>}
      </div>
    </div>
  );
}

/** The colour doing the job it will actually do, in miniature. */
function Specimen({ subject, ink }: { subject: ColorSubject; ink: string }) {
  if (subject.kind === "box") {
    return (
      <span
        className="block truncate rounded-[4px] border px-1.5 py-1 text-[10px]"
        style={{
          // A fill that still follows the ground has no literal value to
          // paint, so the specimen shows what the reader would actually
          // get: the ground's own quiet surface.
          background: subject.fill ?? "transparent",
          // A hairline rather than the writer's own border colour. What
          // the panel measures is the FILL — the thing a label is read
          // against, and the thing checkStoryContrast measures — so an
          // edge drawn at full ink would be the loudest thing in a
          // specimen that is not about it. 35% of the ground's own ink
          // says "this is a box" and then gets out of the way.
          borderColor: `${ink}59`,
          color: ink,
        }}
      >
        Take the lantern
      </span>
    );
  }

  const wash = subject.kind === "wash";
  return (
    <span
      className="block font-reading text-[10.5px] leading-snug"
      style={{ color: wash ? ink : subject.color }}
    >
      He counted it{" "}
      <span style={wash ? { background: subject.color, color: ink } : undefined}>
        a second time
      </span>
      .
    </span>
  );
}

/**
 * What the panel says in words.
 *
 * A number is a fact and a sentence is the meaning of it, and the writer
 * needs the meaning first: "1.8:1" says nothing to a narrative designer,
 * "nearly invisible on Night" says everything. The wording is graded
 * rather than binary because 4.4:1 and 1.1:1 are not the same news.
 */
export function sentenceFor(readings: GroundReading[], subject: ColorSubject): string {
  if (subject.kind === "box" && readings.every((r) => r.ratio === null)) {
    return "This style follows the reading ground — one colour on Night, another on Paper. Picking a colour fixes it to that one on both.";
  }

  const failing = readings.filter((r) => r.ratio !== null && !r.passes);
  if (failing.length === 0) return "Reads on both grounds.";
  if (failing.length === readings.length) {
    return `Hard to read on either ground — ${failing.map((r) => r.label).join(" and ")}. Your reader chooses.`;
  }

  const [worst] = failing;
  return `${howBad(worst.ratio ?? 0)} on ${worst.label}. Your reader chooses the ground.`;
}

function howBad(ratio: number): string {
  if (ratio < 1.5) return "Gone";
  if (ratio < 3) return "Nearly invisible";
  return "Hard to read";
}
