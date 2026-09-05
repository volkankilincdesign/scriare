import { useProjectStore } from "../../state/projectStore";
import type { ContentFolder } from "../../types/project";
import { childrenOf, isDescendant } from "../../utils/contentTree";
import { Modal } from "../common/Modal";

interface MoveToDialogProps {
  nodeIds: string[];
  onClose: () => void;
}

// A quick way to move a multi-selection without dragging — lists every
// Story folder (plus the Story root itself) as a destination, filtering out
// anything that would nest a moved folder inside its own descendant.
export function MoveToDialog({ nodeIds, onClose }: MoveToDialogProps) {
  const project = useProjectStore((s) => s.project);
  const moveContentNodes = useProjectStore((s) => s.moveContentNodes);
  if (!project) return null;

  const movingSet = new Set(nodeIds);
  const destinations = project.content.filter(
    (n): n is ContentFolder =>
      n.kind === "folder" &&
      n.category === "story" &&
      !movingSet.has(n.id) &&
      !nodeIds.some((id) => isDescendant(project.content, n.id, id)),
  );

  function depthOf(folder: ContentFolder): number {
    let depth = 0;
    let current: ContentFolder | undefined = folder;
    while (current?.parentId) {
      depth += 1;
      current = project!.content.find((n) => n.id === current!.parentId) as ContentFolder | undefined;
    }
    return depth;
  }

  function moveTo(parentId: string | null): void {
    const destSiblings = childrenOf(project!.content, "story", parentId).filter((n) => !movingSet.has(n.id));
    moveContentNodes(nodeIds, parentId, destSiblings.length);
    onClose();
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="mb-3 text-base font-semibold text-[var(--text)]">
        Move {nodeIds.length} item{nodeIds.length === 1 ? "" : "s"}
      </h2>
      <div className="max-h-64 overflow-y-auto rounded-md border border-[var(--border-soft)]">
        <button
          type="button"
          onClick={() => moveTo(null)}
          className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-sm text-[var(--text)] hover:bg-[var(--surface-2)]"
        >
          📖 Story (root)
        </button>
        {destinations.map((folder) => (
          <button
            key={folder.id}
            type="button"
            onClick={() => moveTo(folder.id)}
            style={{ paddingLeft: 10 + depthOf(folder) * 16 }}
            className="flex w-full items-center gap-1.5 py-1.5 pr-2.5 text-left text-sm text-[var(--text)] hover:bg-[var(--surface-2)]"
          >
            📁 {folder.name}
          </button>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)]"
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
}
