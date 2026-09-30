import { useMemo, useState } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { DialogHeader } from "../common/DialogHeader";
import { STORY_BLOCKS } from "../../narrativeBlocks/registry";
import { FAQ } from "../../help/faq";
import type { FaqEntry } from "../../help/faq";

interface HelpDialogProps {
  onClose: () => void;
}

/**
 * How Scriare works (v0.81.0) — the app's answer to first-run teaching.
 *
 * IT IS A PLACE, NOT AN EVENT. Nothing fires this on first launch and
 * nothing dismisses it forever. A tour is useful exactly once and then is
 * in the way; this is findable in week three, when a writer finally wonders
 * what the third button was for. That is also why it is reached from two
 * doors rather than one — the Welcome screen, where a newcomer starts, and
 * a ? beside the three block buttons, which is where the question is
 * actually asked and where the Welcome screen can no longer be seen.
 *
 * THE THREE BLOCKS COME FIRST, AND THEY ARE THE WHOLE POINT. Scriare is
 * not hard to operate; it is unfamiliar. A writer arriving from Twine has
 * a prior for the Choice and none at all for the other two, so the top of
 * this panel is three pictures and three sentences, and the questions are
 * underneath for whoever still has one.
 *
 * NOTHING HERE IS TYPED TWICE. The blocks' sentences come from the
 * narrative-blocks registry — the same strings the toolbar tooltips, the
 * slash menu and the blocks' own headers use — so a panel explaining a
 * block differently from the block itself is not a mistake this can make.
 */
export function HelpDialog({ onClose }: HelpDialogProps) {
  const [tab, setTab] = useState<"blocks" | "questions">("blocks");

  // Grouped in the order the entries declare, rather than alphabetically
  // or by a separate list of group names: the order a writer needs these
  // in is the order the work happens in, and it is already the order the
  // file is written in.
  const groups = useMemo(() => {
    const out: { name: FaqEntry["group"]; items: FaqEntry[] }[] = [];
    for (const entry of FAQ) {
      const existing = out.find((g) => g.name === entry.group);
      if (existing) existing.items.push(entry);
      else out.push({ name: entry.group, items: [entry] });
    }
    return out;
  }, []);

  return (
    <Modal onClose={onClose} label="How Scriare works" widthClassName="max-w-2xl">
      <DialogHeader title="How Scriare works">
        Three kinds of block make a story branch. Everything else is writing.
      </DialogHeader>

      <div className="mb-4 flex gap-1 border-b border-[var(--border-soft)]">
        {(
          [
            ["blocks", "The three blocks"],
            ["questions", "Questions"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            data-help-tab={id}
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

      <div className="max-h-[58vh] overflow-y-auto pr-1">
        {tab === "blocks" ? (
          <div className="space-y-3" data-help-blocks>
            {STORY_BLOCKS.map((block) => (
              <div
                key={block.id}
                data-help-block={block.id}
                className="rounded-md border border-[var(--border-soft)] p-3"
              >
                {/* A MINIATURE OF THE REAL HEADER, not a screenshot. It is
                    built from the same glyph and the same tagline the block
                    wears in the scene, so what a writer reads here is
                    literally what they will see there — and a screenshot
                    would be wrong the first time anything moved. */}
                <div className="scriare-section-label mb-1.5 flex select-none items-center gap-1.5 text-[var(--accent)]">
                  <span aria-hidden>{block.icon}</span>
                  <span>{block.title}</span>
                  <span className="font-normal normal-case text-[var(--text-3)]">
                    — {block.tagline}
                  </span>
                </div>
                <p className="text-[13px] leading-relaxed text-[var(--text-2)]">{block.teaches}</p>
              </div>
            ))}
            <p className="pt-1 text-xs leading-relaxed text-[var(--text-3)]">
              All three are in the toolbar, and all three are on the “/” menu while
              you write. A block you have made says the same sentence in its own
              header, so you never have to come back here to remember which is
              which.
            </p>
          </div>
        ) : (
          <div className="space-y-5" data-help-questions>
            {groups.map((group) => (
              <div key={group.name}>
                <div className="scriare-section-label mb-2 text-[var(--text-3)]">{group.name}</div>
                <div className="space-y-3">
                  {group.items.map((entry) => (
                    <div key={entry.q}>
                      <div className="text-[13px] font-semibold text-[var(--text)]">{entry.q}</div>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--text-2)]">
                        {entry.a}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <Button intent="primary" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}
