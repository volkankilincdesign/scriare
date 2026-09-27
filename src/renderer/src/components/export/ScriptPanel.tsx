import { useMemo, useState } from "react";
import { Button } from "../common/Button";
import { useProjectStore } from "../../state/projectStore";
import { useToastStore } from "../../state/toastStore";
import { buildScript } from "../../export/script/buildScript";
import { buildScriptHtml } from "../../../../shared/script/scriptHtml";
import { suggestedScriptName } from "../../../../shared/script/model";
import type { ScriptFormat, ScriptLayout } from "../../../../shared/script/model";

/**
 * The story as something you can print (v0.64.0).
 *
 * Two layouts and two formats, which is deliberately FOUR buttons' worth
 * of choice and not more. The third layout drawn on board K — a dialogue
 * table, one row per line — was cut here on purpose: it is what
 * localisation and VO actually want, and a Word table of nine hundred
 * rows is a worse spreadsheet than a spreadsheet. It comes back as a real
 * spreadsheet export, which is a different feature with a different file
 * type.
 *
 * WHY THIS LIVES BESIDE THE WEB EXPORT rather than in a menu of its own:
 * "get this story out of the app" is one intention with three answers
 * (a page to play, a script to read, a script to work from), and a writer
 * looking for the third should not have to know it was filed somewhere
 * else.
 */

interface Result {
  filePath: string;
  bytes: number;
}

const LAYOUTS: { id: ScriptLayout; label: string; blurb: string }[] = [
  {
    id: "screenplay",
    label: "Screenplay",
    blurb: "Slug lines, centred cues, indented dialogue. The one to hand a reader.",
  },
  {
    id: "production",
    label: "Production script",
    blurb: "Every line numbered, speakers in a column. The one to hand a studio.",
  },
];

const FORMATS: { id: ScriptFormat; label: string; blurb: string }[] = [
  { id: "pdf", label: "PDF", blurb: "Opens anywhere, looks the same everywhere." },
  { id: "docx", label: "Word (.docx)", blurb: "Editable, for notes and rewrites." },
];

export function ScriptPanel({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project);
  const filePath = useProjectStore((s) => s.filePath);
  const showNotice = useToastStore((s) => s.showNotice);

  const [layout, setLayout] = useState<ScriptLayout>("screenplay");
  const [format, setFormat] = useState<ScriptFormat>("pdf");
  const [showConditions, setShowConditions] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Result | null>(null);

  /**
   * Built on every change of the three controls, which is cheap — the walk
   * is over the project's own documents, not the rendered page — and means
   * the counts under the buttons are the counts of the thing that will
   * actually be written rather than an estimate of it.
   */
  const model = useMemo(
    () => (project ? buildScript(project, { layout, showConditions }) : null),
    [project, layout, showConditions],
  );

  if (!project || !model) return null;

  async function handleExport(): Promise<void> {
    if (!model) return;
    setBusy(true);
    try {
      const result = await window.api.script.save({
        format,
        model,
        // Only the PDF needs the typeset page; the DOCX is built from the
        // model in the main process. It is sent either way rather than
        // conditionally, so the two paths cannot diverge over what was
        // sent — the cost is a few hundred kilobytes over IPC, once.
        html: buildScriptHtml(model),
        suggestedName: suggestedScriptName(model.title, layout),
        nearPath: filePath,
      });
      if (result) setDone(result);
    } catch (error) {
      showNotice(
        `The script couldn't be written — ${error instanceof Error ? error.message : "unknown error"}`,
      );
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div>
        <p className="mb-1 text-sm text-[var(--text)]">Script written.</p>
        <p className="mb-4 break-all text-xs text-[var(--text-3)]">{done.filePath}</p>
        <div className="flex items-center justify-end gap-2">
          <Button intent="ghost" onClick={() => void window.api.script.open(done.filePath)}>
            Open it
          </Button>
          <Button
            intent="primary"
            onClick={() => {
              setDone(null);
              onClose();
            }}
          >
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <p className="mb-4 text-sm leading-relaxed text-[var(--text-2)]">
        Your story on paper, in the order your Content panel holds it — chapters first, each
        starting a fresh page. Scenes short enough to fit are never split across one.
      </p>

      <Choice
        label="Layout"
        options={LAYOUTS}
        value={layout}
        onChange={(id) => setLayout(id as ScriptLayout)}
      />
      <Choice
        label="Format"
        options={FORMATS}
        value={format}
        onChange={(id) => setFormat(id as ScriptFormat)}
      />

      <label className="mb-4 flex items-start gap-2 text-sm text-[var(--text-2)]">
        <input
          type="checkbox"
          checked={showConditions}
          onChange={(e) => setShowConditions(e.target.checked)}
          className="mt-0.5 h-3.5 w-3.5 accent-[var(--accent)]"
        />
        <span>
          Include conditions and variable changes
          <span className="mt-0.5 block text-xs text-[var(--text-3)]">
            Off gives a clean reading script. Choices a player never sees are printed either
            way — a line left out of a script is a line nobody records.
          </span>
        </span>
      </label>

      <div className="mb-1 rounded-md border border-[var(--border-soft)] bg-[var(--surface-2-faint)] p-3">
        <div className="scriare-section-label mb-2 text-[var(--text-3)]">What gets written</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-[var(--text-2)]">
          <span>{model.stats.scenes} scenes</span>
          <span>{model.stats.lines} lines</span>
          <span>{model.stats.choices} choices</span>
          <span>{model.stats.endings} endings</span>
          <span>{model.cast.length} speaking parts</span>
          <span>
            {model.chapters.length} {model.chapters.length === 1 ? "chapter" : "chapters"}
          </span>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button intent="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button intent="primary" disabled={busy} onClick={() => void handleExport()}>
          {busy ? "Writing…" : "Export Script…"}
        </Button>
      </div>
    </>
  );
}

/** One row of mutually exclusive cards. Used for both pickers so the two
 *  decisions look like the same kind of decision. */
function Choice({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; label: string; blurb: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="mb-4">
      <div className="scriare-section-label mb-2 text-[var(--text-3)]">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const active = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              data-script-option={option.id}
              aria-pressed={active}
              onClick={() => onChange(option.id)}
              className={`rounded-md border px-3 py-2.5 text-left transition-colors ${
                active
                  ? "border-[var(--accent)] bg-[var(--accent-soft-2)]"
                  : "border-[var(--border-soft)] hover:border-[var(--border)] hover:bg-[var(--surface-2-faint)]"
              }`}
            >
              <span className="block text-sm text-[var(--text)]">{option.label}</span>
              <span className="mt-0.5 block text-xs leading-snug text-[var(--text-3)]">
                {option.blurb}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
