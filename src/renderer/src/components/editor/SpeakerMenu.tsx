import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Icon } from "../common/Icon";
import { useProjectStore } from "../../state/projectStore";
import { SPEAKER_CLICK_EVENT } from "../../extensions/Speaker";
import type { SpeakerClickDetail } from "../../extensions/Speaker";
import { PLAYER_SPEAKER, canSpeak, playerLabel } from "../../types/speaker";
import type { Speaker } from "../../types/speaker";

interface SpeakerMenuProps {
  editor: Editor | null;
}

/**
 * The menu behind a speaker's name in the editor (v0.37.0).
 *
 * Typing is how a line GETS a speaker; this is how it changes one. Those
 * are different moments: the first happens while writing, at speed, with
 * both hands on the keyboard; the second happens weeks later while
 * re-reading, when the writer has noticed that this line should be
 * Ercüment's, and when the thing they want to click on is the name that is
 * already in front of them.
 *
 * Mounted once beside the editor rather than once per line, and fed by a
 * DOM event the chip decoration dispatches. The chips aren't React — they
 * are ProseMirror widgets, deliberately, so that the names can't be typed
 * into — and a custom event is the honest seam between the two worlds.
 */
export function SpeakerMenu({ editor }: SpeakerMenuProps) {
  const project = useProjectStore((s) => s.project);
  const [open, setOpen] = useState<SpeakerClickDetail | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dom = editor?.view.dom;
    if (!dom) return;
    const onClick = (event: Event) => {
      setOpen((event as CustomEvent<SpeakerClickDetail>).detail);
    };
    dom.addEventListener(SPEAKER_CLICK_EVENT, onClick);
    return () => dom.removeEventListener(SPEAKER_CLICK_EVENT, onClick);
  }, [editor]);

  // Any click outside, and Escape, close it — the same contract every other
  // floating thing in the app keeps.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!panel.current?.contains(event.target as Node)) setOpen(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!open || !editor) return null;

  function choose(speaker: Speaker): void {
    if (!open || !editor) return;
    editor.chain().focus().setSpeakerAt(open.pos, speaker).run();
    setOpen(null);
  }

  // Characters only. A Location can be mentioned in a line; it cannot say
  // one — see canSpeak. Filtering here rather than listing everything and
  // dimming the places keeps the menu about the choice being made.
  const speakers = (project?.entities ?? []).filter(canSpeak);

  return (
    <div
      ref={panel}
      data-speaker-menu
      style={{ position: "fixed", left: open.rect.left, top: open.rect.bottom + 6, zIndex: 1000 }}
      className="max-h-72 w-60 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 shadow-xl"
    >
      <Row
        label="Nobody — narration"
        icon="alignLeft"
        active={false}
        onSelect={() => choose(null)}
        data-speaker-option="none"
      />
      <Row
        label={`${playerLabel(project?.playerName)} — the player`}
        icon="character"
        active={open.speaker === PLAYER_SPEAKER}
        onSelect={() => choose(PLAYER_SPEAKER)}
        data-speaker-option={PLAYER_SPEAKER}
      />
      {speakers.map((entity) => (
        <Row
          key={entity.id}
          label={entity.name || "Unnamed"}
          icon="character"
          active={open.speaker === entity.id}
          onSelect={() => choose(entity.id)}
          data-speaker-option={entity.id}
        />
      ))}
    </div>
  );
}

function Row({
  label,
  icon,
  active,
  onSelect,
  ...rest
}: {
  label: string;
  icon: "character" | "location" | "alignLeft";
  active: boolean;
  onSelect: () => void;
} & Record<string, unknown>) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onSelect}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-[var(--surface-3)] ${
        active ? "text-[var(--accent)]" : "text-[var(--text-2)]"
      }`}
      {...(rest as Record<string, string>)}
    >
      <Icon name={icon} className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {active && <span aria-hidden className="shrink-0 text-xs">✓</span>}
    </button>
  );
}
