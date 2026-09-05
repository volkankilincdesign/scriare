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
        selected ? "border-emerald-600 bg-emerald-950/20" : "border-zinc-700 bg-zinc-950/60"
      }`}
      contentEditable={false}
    >
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-500">
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
                className="leading-none text-[10px] text-zinc-500 hover:text-zinc-200 disabled:opacity-25"
              >
                ▲
              </button>
              <button
                type="button"
                disabled={index === options.length - 1}
                onClick={() => moveOption(index, 1)}
                title="Move down"
                className="leading-none text-[10px] text-zinc-500 hover:text-zinc-200 disabled:opacity-25"
              >
                ▼
              </button>
            </div>
            <input
              value={option.text}
              onChange={(e) => updateOption(index, { text: e.target.value })}
              placeholder="Choice text (e.g. Open the door)"
              className="min-w-0 flex-1 rounded bg-transparent px-1 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
            />
            <select
              value={option.targetSceneId ?? ""}
              onChange={(e) => updateOption(index, { targetSceneId: e.target.value || null })}
              className="shrink-0 rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-xs text-zinc-300 outline-none focus:border-emerald-600"
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
              className="shrink-0 rounded px-1.5 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
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
          className="rounded px-1.5 py-0.5 text-xs font-medium text-emerald-500 hover:bg-emerald-950/40"
        >
          + Add option
        </button>
        <button
          type="button"
          onClick={deleteNode}
          title="Remove this entire Choice Block"
          className="rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
        >
          Remove block
        </button>
      </div>
    </NodeViewWrapper>
  );
}
