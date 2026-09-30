import { useState } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { DialogHeader } from "../common/DialogHeader";
import { useProjectStore } from "../../state/projectStore";
import { useUIStore } from "../../state/uiStore";
import { THEMES, useThemeStore } from "../../state/themeStore";
import { STORY_LANGUAGES } from "../../types/languages";
import { PLAYER_SPEAKER_LABEL } from "../../types/speaker";

interface ProjectSettingsDialogProps {
  onClose: () => void;
}

const FIELD =
  "w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]";

/**
 * The story's own facts (v0.75.0).
 *
 * WHAT IS IN HERE AND WHY: everything this dialog holds is written into the
 * `.scriare` file and travels with it. The title and the language reach the
 * reader on the exported page; the player's name is printed in front of
 * every line they speak; the start scene is where Play Mode begins; the
 * choice styles are what a dangerous choice looks like. A writer opening
 * their story on another machine finds all of it intact.
 *
 * WHAT LEFT: Appearance, which had been here since v0.12.0 and was never a
 * project setting at all — the theme is remembered per machine and never
 * written to the file. It is in Preferences now, reached from the row at
 * the foot of this dialog, which is where a writer will look for it out of
 * habit. See PreferencesDialog for the whole argument.
 *
 * The text fields stay drafts until Save; the start scene always did.
 */
export function ProjectSettingsDialog({ onClose }: ProjectSettingsDialogProps) {
  const project = useProjectStore((s) => s.project);
  const setStartScene = useProjectStore((s) => s.setStartScene);
  const setStoryDetails = useProjectStore((s) => s.setStoryDetails);
  const theme = useThemeStore((s) => s.theme);

  const [draftStart, setDraftStart] = useState(
    project?.startSceneId ?? project?.scenes[0]?.id ?? "",
  );
  const [title, setTitle] = useState(project?.name ?? "");
  const [author, setAuthor] = useState(project?.author ?? "");
  const [language, setLanguage] = useState(project?.language ?? "");
  const [playerName, setPlayerName] = useState(project?.playerName ?? "");

  if (!project) return null;

  // A tag this list does not hold — `en-GB` from a hand-edited file, or one
  // a later version of the list will know — keeps an option of its own,
  // rather than being silently redrawn as "Not set" and then silently
  // dropped the next time the writer presses Save.
  const unlisted =
    project.language && !STORY_LANGUAGES.some((l) => l.tag === project.language)
      ? project.language
      : null;

  const themeLabel = THEMES.find((t) => t.id === theme)?.label ?? "Dark";

  function handleSave(): void {
    if (draftStart) setStartScene(draftStart);
    setStoryDetails({ name: title, author, language, playerName });
    onClose();
  }

  return (
    <Modal onClose={onClose} onEnter={handleSave} widthClassName="max-w-md">
      <DialogHeader title="Project Settings" />

      <label className="scriare-section-label mb-1 block text-[var(--text-3)]" htmlFor="story-title">
        Title
      </label>
      <input
        id="story-title"
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className={`${FIELD} mb-4`}
        data-story-title
      />

      {/* Two short fields on one line: neither earns a row of its own at
          448px, and the pair reads as one fact about the book — who wrote
          it, and in what. */}
      <div className="mb-1 grid grid-cols-2 gap-3">
        <label className="scriare-section-label block text-[var(--text-3)]" htmlFor="story-author">
          Author
        </label>
        <label className="scriare-section-label block text-[var(--text-3)]" htmlFor="story-language">
          Language
        </label>
      </div>
      <div className="mb-1.5 grid grid-cols-2 gap-3">
        <input
          id="story-author"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          className={FIELD}
          data-story-author
        />
        <select
          id="story-language"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className={FIELD}
          data-story-language
        >
          <option value="">Not set</option>
          {unlisted && <option value={unlisted}>{unlisted}</option>}
          {STORY_LANGUAGES.map((l) => (
            <option key={l.tag} value={l.tag}>
              {l.native === l.english ? l.native : `${l.native} (${l.english})`} — {l.tag}
            </option>
          ))}
        </select>
      </div>
      <p className="mb-4 text-xs text-[var(--text-3)]">
        The language the story is written in. The exported page carries it, so a
        screen reader reads Turkish as Turkish. Left unset it carries none,
        which is better than carrying the wrong one.
      </p>

      <label
        className="scriare-section-label mb-1 block text-[var(--text-3)]"
        htmlFor="story-player"
      >
        The player is called
      </label>
      <p className="mb-2 text-xs text-[var(--text-3)]">
        Printed wherever the player speaks. Leave it blank for “{PLAYER_SPEAKER_LABEL}”.
      </p>
      <input
        id="story-player"
        value={playerName}
        onChange={(e) => setPlayerName(e.target.value)}
        placeholder={PLAYER_SPEAKER_LABEL}
        className={`${FIELD} mb-4`}
        data-story-player
      />

      <label className="scriare-section-label mb-1 block text-[var(--text-3)]" htmlFor="story-start">
        Start scene
      </label>
      <p className="mb-2 text-xs text-[var(--text-3)]">
        Play Mode begins here. If none is set, the first Story scene is used.
      </p>
      <select
        id="story-start"
        value={draftStart}
        onChange={(e) => setDraftStart(e.target.value)}
        className={`${FIELD} mb-4`}
      >
        {project.scenes.map((scene) => (
          <option key={scene.id} value={scene.id}>
            {scene.title || "Untitled scene"}
          </option>
        ))}
      </select>

      {/* ── ELSEWHERE (v0.83.0) ──────────────────────────────────────
          His complaint: the three kinds of thing in this dialog read as
          one stack. Underneath it sat a second problem — a DOOR AND A
          FIELD WERE THE SAME SHAPE. "Start scene" and "Stylesheet" were
          both full-width bordered rectangles, but one edits a value here
          and the other closes this dialog and opens another. So the fix
          is not more spacing between identical objects; it is making the
          doors stop pretending to be fields.

          Drawn as rows with the current value on the right and a
          chevron: the shape says you are leaving, so no heading has to.
          It is also SHORTER than the version it replaces, because three
          help sentences become three subtitles and the value moves out of
          the control's own label — "2 styles — manage…" was a button
          whose text changed with the data, which is a label doing a
          value's job.

          THE ONE SENTENCE BORROWED from the option we did not take: what
          is saved in the file and what is not. That distinction was
          buried under Appearance and it is the only thing separating it
          from the two doors above it, so it is said once, plainly, over
          the list. */}
      <div className="mb-5 mt-1 border-t border-[var(--border-soft)] pt-4">
        <div className="scriare-section-label mb-0.5 text-[var(--text-3)]">Elsewhere</div>
        <p className="mb-1 text-xs text-[var(--text-3)]">
          These open in their own place. Appearance is the only one not saved in the story.
        </p>
        <div data-settings-doors>
          <DoorRow
            title="Choice styles"
            sub="How choices look, named once"
            value={`${project.choiceStyles.length} ${
              project.choiceStyles.length === 1 ? "style" : "styles"
            }`}
            data-open-choice-styles
            onClick={() => {
              // Still a swap rather than a stack — the styles manager is a
              // place you go, not a detail of Settings — and still told
              // WHERE IT CAME FROM so it can offer the way back that
              // v0.55.0 added. Only the shape of the control changed.
              onClose();
              useUIStore.getState().openChoiceStyles("settings");
            }}
          />
          <DoorRow
            title="Stylesheet"
            sub="Your own CSS for this story"
            value={
              project.stylesheet
                ? `${project.stylesheet.split("\n").length} lines`
                : "None yet"
            }
            data-open-stylesheet
            onClick={() => {
              onClose();
              useUIStore.getState().openStylesheet("settings");
            }}
          />
          <DoorRow
            title="Appearance"
            sub="How the app looks on this computer"
            value={themeLabel}
            data-open-preferences
            onClick={() => {
              onClose();
              useUIStore.getState().openPreferences("settings");
            }}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button intent="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button intent="primary" onClick={handleSave}>
          Save
        </Button>
      </div>
    </Modal>
  );
}

/**
 * One door out of Settings (v0.83.0).
 *
 * LOCAL, AND IT SHOULD STAY LOCAL UNTIL A SECOND SURFACE WANTS IT. The
 * kit's own history is the argument: `Button` was extracted because the
 * primary action already existed in nine spellings across the app, and
 * v0.82.0's floating panel because four menus already disagreed. This
 * shape exists in one dialog, three times. A component in `common/` that
 * one file uses is a decision made in advance of the question — the same
 * note `Button` leaves about the `lg` size it does not have.
 *
 * `value` is on the RIGHT and is the live one. It used to live inside the
 * button's own label ("2 styles — manage…"), which made a label do a
 * value's job and meant the control's text changed length with the data.
 */
function DoorRow({
  title,
  sub,
  value,
  onClick,
  ...rest
}: {
  title: string;
  sub: string;
  value: string;
  onClick: () => void;
} & Record<string, unknown>) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-settings-door
      className="flex w-full items-center gap-3 border-b border-[var(--border-soft)] px-0.5 py-2.5 text-left last:border-b-0 hover:bg-[var(--surface-2-faint)]"
      {...rest}
    >
      <span className="min-w-0 flex-1">
        <span data-door-title className="block truncate text-sm text-[var(--text)]">
          {title}
        </span>
        <span className="block truncate text-[11.5px] text-[var(--text-3)]">{sub}</span>
      </span>
      <span data-door-value className="shrink-0 text-xs text-[var(--text-3)]">
        {value}
      </span>
      <span aria-hidden className="shrink-0 text-[var(--text-3)]">
        ›
      </span>
    </button>
  );
}
