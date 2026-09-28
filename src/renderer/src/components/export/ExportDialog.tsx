import { useEffect, useMemo, useState } from "react";
import { Button } from "../common/Button";
import { ScriptPanel } from "./ScriptPanel";
import { SheetPanel } from "./SheetPanel";
import { Modal } from "../common/Modal";
import { useProjectStore } from "../../state/projectStore";
import { useUIStore } from "../../state/uiStore";
import { useToastStore } from "../../state/toastStore";
import { buildExportStory } from "../../export/buildStory";
import { buildExportHtml, suggestedExportName } from "../../export/pageTemplate";
import { checkStoryContrast } from "../../export/contrastCheck";
import type { ContrastFinding } from "../../export/contrastCheck";
import { DEFAULT_GROUND, READING_GROUNDS } from "../../export/readingThemes";

/**
 * Export (v0.48.0).
 *
 * The dialog does three things and deliberately offers no settings.
 *
 * It SAYS WHAT THE READER WILL GET, because the two questions a writer
 * actually has at this moment are "what does it look like" and "does it
 * need the internet", and both have fixed answers now: two reading grounds
 * with the reader switching between them, and no, it is one file that makes
 * no requests at all.
 *
 * It REPORTS WHAT MIGHT NOT READ. The check behind this is in
 * export/contrastCheck.ts and the argument for warning rather than blocking
 * is there in full. The short version: a colour the writer picked is part
 * of the story, an unreadable one can be the point, and a tool that refuses
 * to export a deliberate effect has stopped being a tool.
 *
 * It WRITES THE FILE. Everything else — which ground opens first, whether
 * the reader can switch, what the last screen says — was settled once, for
 * every export, rather than being handed to the writer as five more
 * decisions to make while they are trying to finish something.
 */
export function ExportDialog() {
  const open = useUIStore((s) => s.exportOpen);
  const close = useUIStore((s) => s.closeExport);
  const project = useProjectStore((s) => s.project);
  const filePath = useProjectStore((s) => s.filePath);
  const showNotice = useToastStore((s) => s.showNotice);

  /**
   * Which way the story is leaving the app (v0.64.0). Reset with the
   * dialog, for the same reason `done` is: a writer who exported a script
   * last time and opens this looking for the web page should find the
   * dialog as they first met it.
   */
  const [tab, setTab] = useState<"page" | "script" | "sheet">("page");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ filePath: string; bytes: number } | null>(null);

  // This dialog is mounted for the life of the app and hides itself with
  // `return null`, so nothing unmounts it and nothing resets its state.
  // Closing the success screen with Escape or a backdrop click left `done`
  // set, and the next Export opened straight onto the PREVIOUS export's
  // result — with no way back to the form except clicking Done, and one
  // "Open it" click away from opening a stale file while believing it
  // reflected the edits made since (v0.49.0).
  useEffect(() => {
    if (!open) {
      setDone(null);
      setBusy(false);
      setTab("page");
    }
  }, [open]);

  // Built once when the dialog opens, and reused by the export itself —
  // rendering every scene twice, once to check and once to write, would be
  // the slowest thing this feature does and would also let the two disagree.
  const prepared = useMemo(() => {
    if (!open || !project) return null;
    const story = buildExportStory(project);
    return { story, findings: checkStoryContrast(story), html: buildExportHtml(story) };
  }, [open, project]);

  if (!open || !project || !prepared) return null;

  const sceneCount = prepared.story.scenes.length;
  const choiceCount = prepared.story.scenes.reduce(
    (total, scene) =>
      total + scene.seg.reduce((n, seg) => (seg.k === "c" ? n + seg.o.length : n), 0),
    0,
  );

  async function handleExport(): Promise<void> {
    if (!prepared) return;
    setBusy(true);
    try {
      const result = await window.api.exportStory.html(
        suggestedExportName(prepared.story.name),
        prepared.html,
        filePath,
      );
      if (result) setDone(result);
    } catch (error) {
      // Same shape as a failed save: name what went wrong rather than
      // leaving a button that stopped responding.
      const code = (error as { message?: string }).message ?? "";
      showNotice(
        /ENOSPC/.test(code)
          ? "Couldn't export — the disk is full."
          : /EACCES|EPERM/.test(code)
            ? "Couldn't export — that folder is read-only."
            : "Couldn't export the story.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={close} widthClassName="max-w-lg">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-serif-narrative text-base italic text-[var(--text)]">Export Story</h2>
        <span className="text-xs text-[var(--text-3)]">
          {sceneCount} {sceneCount === 1 ? "scene" : "scenes"} · {choiceCount}{" "}
          {choiceCount === 1 ? "choice" : "choices"}
        </span>
      </div>

      {/* One door for "get this story out of the app". A writer looking
          for a script should not have to know it was filed under a
          different menu (v0.64.0). Hidden while a result is showing, so
          the success screen is not competing with a way to leave it.

          Three answers now (v0.70.0): a page to play, a script to read, a
          sheet to work from. The third was deferred by the Script panel
          on purpose — a Word table of nine hundred rows is a worse
          spreadsheet than a spreadsheet — and it lands here rather than in
          a menu of its own for the same reason the second did. */}
      {!done && (
        <div className="mb-4 flex gap-1 border-b border-[var(--border-soft)]">
          {([
            ["page", "Web Page"],
            ["script", "Script"],
            ["sheet", "Spreadsheet"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              data-export-tab={id}
              aria-pressed={tab === id}
              onClick={() => setTab(id)}
              className={`-mb-px border-b-2 px-3 py-1.5 text-sm transition-colors ${
                tab === id
                  ? "border-[var(--accent)] text-[var(--text)]"
                  : "border-transparent text-[var(--text-3)] hover:text-[var(--text-2)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {tab === "script" && !done ? (
        <ScriptPanel onClose={close} />
      ) : tab === "sheet" && !done ? (
        <SheetPanel onClose={close} />
      ) : done ? (
        <Exported
          result={done}
          onClose={() => {
            setDone(null);
            close();
          }}
        />
      ) : (
        <>
          <p className="mb-4 text-sm leading-relaxed text-[var(--text-2)]">
            One web page, playable in any browser, with your formatting, choices, variables
            and conditions intact. It makes no network requests — it works offline, from a
            folder or a USB stick, and nobody learns who read it.
          </p>

          <div className="mb-4 rounded-md border border-[var(--border-soft)] bg-[var(--surface-2-faint)] p-3">
            <div className="scriare-section-label mb-2 text-[var(--text-3)]">
              What the reader gets
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--text-2)]">
              {READING_GROUNDS.map((ground) => (
                <span key={ground.id} className="flex items-center gap-1.5">
                  {/* Paper and Night are fixed reading grounds, not app
                      chrome — they must look the same whatever theme the
                      writer works in, which is the argument in
                      claude/export.md. So their swatches are content. */}
                  <span
                    className="h-3 w-3 rounded-full border border-[var(--border)]"
                    style={{ background: ground.swatch }}
                    data-content-colour
                    aria-hidden
                  />
                  {ground.label}
                  {/* Driven by DEFAULT_GROUND rather than by position in the
                      list, so reordering the grounds or changing the default
                      cannot leave this label pointing at the wrong one. */}
                  {ground.id === DEFAULT_GROUND && (
                    <span className="text-[var(--text-3)]">(opens on this)</span>
                  )}
                </span>
              ))}
              <span className="text-[var(--text-3)]">· Back · Restart · keeps their place</span>
            </div>
          </div>

          <Findings findings={prepared.findings} />

          <div className="mt-5 flex items-center justify-end gap-2">
            <Button intent="ghost" onClick={close}>
              Cancel
            </Button>
            <Button intent="primary" disabled={busy} onClick={() => void handleExport()}>
              {busy ? "Exporting…" : "Export…"}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

/**
 * The warning list.
 *
 * Capped at six rows with a count for the rest, because the failure mode
 * this is guarding against is a writer who set one colour badly and sees
 * two hundred warnings — at which point the list has stopped being
 * information and become an obstacle, and the next thing they learn is to
 * ignore it.
 */
function Findings({ findings }: { findings: ContrastFinding[] }) {
  if (findings.length === 0) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-[var(--border-soft)] px-3 py-2.5 text-xs text-[var(--text-2)]">
        <span className="text-[var(--success)]">✓</span>
        <span>Every colour in the story reads on both grounds.</span>
      </div>
    );
  }

  const shown = findings.slice(0, 6);

  return (
    <div className="rounded-md border border-[var(--border-soft)] px-3 py-2.5">
      <div className="mb-2 flex items-start gap-2 text-xs text-[var(--text-2)]">
        <span className="text-[var(--warning)]">⚠</span>
        <span>
          {findings.length} {findings.length === 1 ? "thing" : "things"} may be hard to read on
          one of the grounds. Colours you set are part of the story, so they're exported
          exactly as you chose them — this is only so you know.
        </span>
      </div>
      <ul className="space-y-1">
        {shown.map((finding, index) => (
          <li
            key={index}
            className="flex items-baseline justify-between gap-3 text-[11px] text-[var(--text-3)]"
          >
            <span className="truncate">
              <span className="text-[var(--text-2)]">{finding.what}</span> — {finding.scene}
            </span>
            <span className="tabular shrink-0">
              {finding.ratio.toFixed(1)}:1 on {finding.ground === "paper" ? "Paper" : "Night"}
            </span>
          </li>
        ))}
      </ul>
      {findings.length > shown.length && (
        <div className="mt-1.5 text-[11px] text-[var(--text-3)]">
          and {findings.length - shown.length} more
        </div>
      )}
    </div>
  );
}

function Exported({
  result,
  onClose,
}: {
  result: { filePath: string; bytes: number };
  onClose: () => void;
}) {
  const name = result.filePath.split(/[\\/]/).pop() ?? result.filePath;
  const kb = Math.max(1, Math.round(result.bytes / 1024));

  return (
    <>
      <p className="mb-1 text-sm text-[var(--text)]">Exported {name}</p>
      <p className="mb-4 break-all text-xs text-[var(--text-3)]">
        {result.filePath} · {kb} KB
      </p>
      <div className="flex items-center justify-end gap-2">
        <Button intent="ghost" onClick={onClose}>
          Done
        </Button>
        <Button
          intent="primary"
          onClick={() => void window.api.exportStory.open(result.filePath)}
        >
          Open it
        </Button>
      </div>
    </>
  );
}
