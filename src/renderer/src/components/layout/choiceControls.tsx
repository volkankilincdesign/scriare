import { useProjectStore } from "../../state/projectStore";
import { useUIStore } from "../../state/uiStore";
import { PLAYER_SPEAKER, canSpeak, playerLabel } from "../../types/speaker";
import type { Entity } from "../../types/entities";
import {
  DEFAULT_CHOICE_STYLE_ID,
  choiceBoxCss,
  hasOverrides,
  resolveChoiceBox,
} from "../../types/choiceStyles";
import type { ChoiceBox, ChoiceStyleRef } from "../../types/choiceStyles";
import { BoxControls } from "../choices/ChoiceStylesDialog";

/**
 * The two controls a Choice and a Dialogue line share (v0.67.2).
 *
 * Both were written for the choice panel and both were then rewritten, by
 * hand and slightly differently, inside the Dialogue's. That is how two
 * panels that are meant to be the same component drift: not in one big
 * decision but in a select element copied with a different class string.
 * They live here now and both panels import them, so there is one of each.
 *
 * Neither takes a choice or a line — only the value it edits — because
 * neither ever needed to know.
 */

/** The "+ Create New Scene" option's value, in both panels' destination
 *  selects. A sentinel rather than an empty id, so an unlinked choice and
 *  a request to make a scene can never be the same value. */
export const CREATE_SCENE_VALUE = "__create_scene__";

const EMPTY_ENTITIES: Entity[] = [];

export function SpeakerSelect({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (speaker: string | null) => void;
}) {
  const entities = useProjectStore((s) => s.project?.entities ?? EMPTY_ENTITIES);
  const playerName = useProjectStore((s) => playerLabel(s.project?.playerName));
  return (
    <div>
      <select
        data-choice-speaker
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
      >
        <option value="">— Nobody —</option>
        <option value={PLAYER_SPEAKER}>{playerName} (the player)</option>
        {/* Characters only — a Location can be named in a choice but can't
            speak one. See canSpeak in types/speaker.ts. */}
        {entities.filter(canSpeak).map((entity) => (
          <option key={entity.id} value={entity.id}>
            {entity.name || "Unnamed"}
          </option>
        ))}
      </select>
    </div>
  );
}

export function AppearanceControl({
  id,
  value,
  onChange,
  preview,
  subject,
}: {
  /** Only for the test hook below — nothing here depends on what it is. */
  id: string;
  value: ChoiceStyleRef | null;
  onChange: (style: ChoiceStyleRef | null) => void;
  /** The words to draw inside the swatch: the option's or the line's. */
  preview: string;
  /** "choice" or "line", for the one sentence that names what is styled. */
  subject: "choice" | "line";
}) {
  const styles = useProjectStore((s) => s.project?.choiceStyles) ?? [];
  const openChoiceStyles = useUIStore((s) => s.openChoiceStyles);
  const ref = value ?? null;
  const styleId = ref?.styleId ?? DEFAULT_CHOICE_STYLE_ID;
  const overridden = hasOverrides(ref);
  const resolved = resolveChoiceBox(styles, ref);

  function setStyle(nextId: string): void {
    onChange(
      nextId === DEFAULT_CHOICE_STYLE_ID && !overridden
        ? null // back to "inherit", not "explicitly the default"
        : { ...ref, styleId: nextId },
    );
  }

  function setOverride(patch: Partial<ChoiceBox>): void {
    onChange({ ...ref, overrides: { ...(ref?.overrides ?? {}), ...patch } });
  }

  function clearOverrides(): void {
    const styleId = ref?.styleId ?? null;
    onChange(styleId ? { styleId } : null);
  }

  return (
    <div data-appearance-for={id}>
      <div className="flex items-center gap-1.5">
        <select
          value={styleId}
          onChange={(e) => setStyle(e.target.value)}
          className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
        >
          {styles.map((style) => (
            <option key={style.id} value={style.id}>
              {style.name || "Untitled style"}
            </option>
          ))}
        </select>
        <button
          type="button"
          // No origin: this route came from the Inspector, not from
          // Settings, so the dialog must not offer a way "back" to a
          // Settings dialog the writer was never in (v0.55.0).
          onClick={() => openChoiceStyles()}
          title="Edit the project's Choice Styles"
          className="shrink-0 rounded px-1.5 py-1 text-xs text-[var(--accent)] hover:bg-[var(--accent-soft-2)]"
        >
          Edit…
        </button>
      </div>

      {/* What this choice will actually look like, resolved — including any
          override. Small, but it's the only place the two levels are
          visible as one answer. */}
      <div
        style={choiceBoxCss(resolved)}
        className="mt-2 px-2.5 py-1.5 text-xs text-[var(--text-2)]"
      >
        {preview}
      </div>

      <details className="mt-2 [&[open]>summary]:mb-2">
        <summary className="cursor-pointer select-none text-[11px] text-[var(--text-3)] hover:text-[var(--text-2)]">
          {overridden ? `Custom for this ${subject}` : "Customise just this one"}
        </summary>
        <BoxControls box={resolved} onChange={setOverride} subject={subject} />
        {overridden && (
          <button
            type="button"
            onClick={clearOverrides}
            className="mt-2 rounded px-1.5 py-0.5 text-[11px] font-medium text-[var(--accent)] hover:bg-[var(--accent-soft-2)]"
          >
            Back to the style
          </button>
        )}
      </details>
    </div>
  );
}
