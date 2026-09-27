import { useEffect, useState } from "react";
import { useToastStore } from "../../state/toastStore";

/**
 * Which build this is (v0.63.0).
 *
 * On Windows the answer lived in three places a writer never looks — the
 * setup wizard, Apps & features, and package.json — and in none they do.
 * That costs nothing right up until somebody says "the graph jumps when I
 * drag a node", and the only useful reply is "which version?", and neither
 * of you can find out.
 *
 * So it sits beside the wordmark, at the size of a footnote, on the one
 * screen every session starts on. NOT in the status bar: that bar carries
 * the three things a writer glances down for while writing (v0.41.0), and
 * a build number is not one of them — it is something you go and look up
 * once, on purpose.
 *
 * CLICKING IT COPIES more than it shows. The number alone is what a writer
 * can read; a report is more useful with the platform and the Chromium
 * underneath it, and nobody is going to type those out. So the visible tag
 * is short and the clipboard gets the whole line, composed in the main
 * process where those versions actually live.
 */
export function VersionTag({ className = "" }: { className?: string }) {
  const [version, setVersion] = useState<string | null>(null);
  const showNotice = useToastStore((s) => s.showNotice);

  useEffect(() => {
    let cancelled = false;
    void window.api.app
      .version()
      .then((v) => {
        if (!cancelled) setVersion(v);
      })
      .catch(() => {
        // Nothing to say. A version that cannot be read is a tag that is
        // not drawn — an error message where a build number should be
        // would be louder than the thing it is reporting.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Rendered only once the answer is in, so the header never reflows from
  // a placeholder to a number in front of the writer.
  if (!version) return null;

  async function copy(): Promise<void> {
    try {
      await window.api.app.copyVersion();
      showNotice("Version details copied — paste them into a bug report.");
    } catch {
      showNotice("Couldn't reach the clipboard.");
    }
  }

  return (
    <button
      type="button"
      data-version-tag={version}
      onClick={() => void copy()}
      title="Click to copy the version, platform and engine — for a bug report"
      className={`scriare-status-btn rounded-[4px] px-1.5 py-0.5 text-[11px] tabular-nums text-[var(--text-3)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-2)] ${className}`}
    >
      {version}
    </button>
  );
}
