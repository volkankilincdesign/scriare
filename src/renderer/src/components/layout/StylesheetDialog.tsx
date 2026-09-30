import { useMemo, useState } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { DialogHeader } from "../common/DialogHeader";
import { useProjectStore } from "../../state/projectStore";
import { useUIStore } from "../../state/uiStore";
import {
  STYLE_HOOKS,
  overriddenGroundTokens,
  remoteFetches,
} from "../../export/stylesheetNotes";

interface StylesheetDialogProps {
  onClose: () => void;
}

/**
 * The story's stylesheet (v0.80.0).
 *
 * A PLACE YOU GO, not a field in Settings — the Choice Styles pattern,
 * chosen for the same reason and with the same price: it closes Project
 * Settings on the way open, so it owes a way back (v0.55.0).
 *
 * A DRAFT WITH A SAVE, where most of this app commits immediately. Every
 * other inline editor in Scriare writes as you type because every other
 * one is editing a finished value — a name, a number, a colour. CSS is
 * only valid at the end: `.scriare-choice { backgro` is not a smaller
 * version of the rule, it is a broken one, and applying it on every
 * keystroke would mean the preview flickering through a hundred broken
 * states and a hundred entries on the undo stack. So the writer says when.
 *
 * WHAT IT REFUSES TO DO. It does not format, lint, autocomplete, colour
 * the syntax or check the braces. A code editor is a real dependency and
 * this is a text field for a stylesheet most writers will never open; what
 * it owes them instead is the two things they cannot find out for
 * themselves — which names are real, and what their CSS will cost. Those
 * are the two panels below, and they update as you type.
 */
export function StylesheetDialog({ onClose }: StylesheetDialogProps) {
  const project = useProjectStore((s) => s.project);
  const setStylesheet = useProjectStore((s) => s.setStylesheet);
  const cameFromSettings = useUIStore((s) => s.stylesheetFrom) === "settings";

  const [draft, setDraft] = useState(project?.stylesheet ?? "");
  const [showHooks, setShowHooks] = useState(false);

  const fetches = useMemo(() => remoteFetches(draft), [draft]);
  const overrides = useMemo(() => overriddenGroundTokens(draft), [draft]);

  if (!project) return null;

  const dirty = (draft.trim().length > 0 ? draft : "") !== (project.stylesheet ?? "");

  function handleSave(): void {
    setStylesheet(draft);
    onClose();
  }

  return (
    <Modal onClose={onClose} label="Stylesheet" widthClassName="max-w-2xl">
      <DialogHeader
        title="Stylesheet"
        back={
          cameFromSettings
            ? {
                label: "Project Settings",
                onBack: () => {
                  // A swap, not a stack — see DialogBackLink.
                  useUIStore.getState().closeStylesheet();
                  useUIStore.getState().openSettings();
                },
              }
            : undefined
        }
      >
        Your own CSS for this story. It travels in the file, it is applied in
        Play Mode so you can see it, and it goes out with the exported page.
        Your rules win over the app's — no <code>!important</code> needed.
      </DialogHeader>

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        data-stylesheet-input
        aria-label="Stylesheet"
        placeholder={".scriare-page { background: #101014; }\n.scriare-choice { border-radius: 0; }"}
        // `placeholder:` is not decoration here. Without it the browser's
        // own placeholder colour under `color-scheme: dark` came out close
        // enough to body text that two lines of example CSS read as CSS
        // ALREADY IN THE STORY — while the footer underneath said "Empty
        // — the story ships with no stylesheet". Found by looking at a
        // screenshot of this dialog; every test it has was green, because
        // no test asks what a placeholder looks like. --text-3 is what
        // every other placeholder in the app uses.
        className="h-[46vh] w-full resize-none rounded-md border border-[var(--border)] bg-[var(--bg)] p-3 font-mono text-[12.5px] leading-relaxed text-[var(--text)] outline-none placeholder:text-[var(--text-3)] focus:border-[var(--accent)]"
      />

      {/* WHAT YOU CAN TARGET. Folded away by default: it is reference a
          writer needs twice and then knows, and a list of fourteen
          selectors permanently above the fold would make the surface look
          like documentation rather than a place to write. */}
      <button
        type="button"
        onClick={() => setShowHooks((v) => !v)}
        aria-expanded={showHooks}
        data-stylesheet-hooks-toggle
        className="mt-3 text-xs text-[var(--text-3)] hover:text-[var(--text-2)]"
      >
        {showHooks ? "▾" : "▸"} What you can target ({STYLE_HOOKS.length} names)
      </button>
      {showHooks && (
        <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-[var(--border-soft)] p-2">
          <table className="w-full text-[11.5px]" data-stylesheet-hooks>
            <tbody>
              {STYLE_HOOKS.map((hook) => (
                <tr key={hook.selector}>
                  <td className="py-0.5 pr-3 align-top font-mono text-[var(--text-2)]">
                    {hook.selector}
                  </td>
                  <td className="py-0.5 pr-3 align-top text-[var(--text-3)]">{hook.what}</td>
                  <td className="py-0.5 align-top text-right text-[var(--text-3)]">
                    {/* The honest column. A name that is export-only looks
                        broken in the preview, and a writer who is not told
                        concludes the feature does not work. */}
                    {hook.inPlay ? "" : "export only"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-[var(--text-3)]">
            Choice Styles you have named are rules too, so a choice keeps its style
            unless your CSS says otherwise.
          </p>
        </div>
      )}

      {(fetches.length > 0 || overrides.length > 0) && (
        <div className="mt-3 space-y-2">
          {fetches.length > 0 && (
            <div
              data-stylesheet-fetches
              className="rounded-md border border-[var(--warning)] px-3 py-2 text-[11.5px] text-[var(--text-2)]"
            >
              <b className="font-semibold">
                {fetches.length === 1 ? "One thing here is" : `${fetches.length} things here are`}{" "}
                fetched from the internet.
              </b>{" "}
              An exported story is one file that makes no requests — it works offline
              and nobody learns who read it. These would change that, and Export will
              ask you to confirm before it writes the file.
              <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-[var(--text-3)]">
                {fetches.slice(0, 4).map((one) => (
                  <li key={one} className="truncate">
                    {one}
                  </li>
                ))}
                {fetches.length > 4 && <li>and {fetches.length - 4} more</li>}
              </ul>
            </div>
          )}
          {overrides.length > 0 && (
            <div
              data-stylesheet-overrides
              className="rounded-md border border-[var(--border-soft)] px-3 py-2 text-[11.5px] text-[var(--text-3)]"
            >
              You're redefining {overrides.length === 1 ? "a reading-ground colour" : "reading-ground colours"}{" "}
              (<span className="font-mono">{overrides.slice(0, 4).join(", ")}</span>
              {overrides.length > 4 ? ", …" : ""}). That's a fine thing to do — it just
              means Export's readability check is measuring the old ones, so treat its
              numbers as a guide rather than the page.
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="text-[11px] text-[var(--text-3)]">
          {draft.trim().length === 0
            ? "Empty — the story ships with no stylesheet."
            : `${draft.split("\n").length} lines`}
        </span>
        <div className="flex gap-2">
          <Button intent="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button intent="primary" disabled={!dirty} onClick={handleSave} data-stylesheet-save>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}
