import { nanoid } from "nanoid";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useProjectStore } from "../../state/projectStore";
import type { ChoiceOption } from "../../utils/choiceBlocks";

// The React view for a `choiceBlock` node — this IS the "Choice Block" from
// the writer's point of view: one or more options, each with its own text
// and destination, live together inline in the document. Options can be
// added, removed, and reordered without ever leaving the editor.
export function ChoiceBlockView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const project = useProjectStore((s) => s.project);
  const currentSceneId = useProjectStore((s) => s.selectedSceneId);
  const options = (node.attrs.options as ChoiceOption[] | undefined) ?? [];

  const otherScenes = project?.scenes.filter((s) => s.id !== currentSceneId) ?? [];

  function updateOption(index: number, patch: Partial<ChoiceOption>): void {
    updateAttributes({ options: options.map((o, i) => (i === index ? { ...o, ...patch } : o)) });
  }

  function addOption(): void {
    updateAttributes({ options: [...options, { id: nanoid(), text: "", targetSceneId: null }] });
  }

  function removeOption(index: number): void {
    if (options.length <= 1) {
      deleteNode();
      return;
    }
    updateAttributes({ options: options.filter((_, i) => i !== index) });
  }

  function moveOption(index: number, direction: -1 | 1): void {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= options.length) return;
    const next = [...options];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    updateAttributes({ options: next });
  }

  return (
    <NodeViewWrapper
      className={`choice-block my-3 rounded-md border px-3 py-2.5 ${
        selected ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-[var(--overlay)]"
      }`}
      contentEditable={false}
    >
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
        <span>⤷</span>
        <span>Choice</span>
      </div>

      <div className="space-y-1.5">
        {options.map((option, index) => (
          <div key={option.id} className="flex items-center gap-1.5">
            <div className="flex shrink-0 flex-col">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => moveOption(index, -1)}
                title="Move up"
                className="leading-none text-[10px] text-[var(--text-3)] hover:text-[var(--text)] disabled:opacity-25"
              >
                ▲
              </button>
              <button
                type="button"
                disabled={index === options.length - 1}
                onClick={() => moveOption(index, 1)}
                title="Move down"
                className="leading-none text-[10px] text-[var(--text-3)] hover:text-[var(--text)] disabled:opacity-25"
              >
                ▼
              </button>
            </div>
            <input
              value={option.text}
              onChange={(e) => updateOption(index, { text: e.target.value })}
              placeholder="Choice text (e.g. Open the door)"
              className="min-w-0 flex-1 rounded bg-transparent px-1 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-3)]"
            />
            <select
              value={option.targetSceneId ?? ""}
              onChange={(e) => updateOption(index, { targetSceneId: e.target.value || null })}
              className="shrink-0 rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 py-1 text-xs text-[var(--text-2)] outline-none focus:border-[var(--accent)]"
            >
              <option value="">— Not linked —</option>
              {otherScenes.map((scene) => (
                <option key={scene.id} value={scene.id}>
                  → {scene.title || "Untitled scene"}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => removeOption(index)}
              title="Remove this option"
              className="shrink-0 rounded px-1.5 text-xs text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-red-400"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={addOption}
          className="rounded px-1.5 py-0.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-soft-2)]"
        >
          + Add option
        </button>
        <button
          type="button"
          onClick={deleteNode}
          title="Remove this entire Choice Block"
          className="rounded px-1.5 py-0.5 text-xs text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-red-400"
        >
          Remove block
        </button>
      </div>
    </NodeViewWrapper>
  );
}
