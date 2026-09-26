import { useProjectStore } from "../../state/projectStore";
import type { ContentFolder } from "../../types/project";
import { childrenOf, isDescendant } from "../../utils/contentTree";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { DialogHeader } from "../common/DialogHeader";
import { Icon } from "../common/Icon";

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
      {/* The move happens the moment a destination is clicked, with no
          confirm step. That looks like a gap and is the app's own rule —
          the action happens and the way out is Ctrl+Z; toastStore's header
          argues the case at length. Checked in v0.56.0 and left alone. */}
      <DialogHeader title={`Move ${nodeIds.length} item${nodeIds.length === 1 ? "" : "s"}`}>
        Click where they should go.
      </DialogHeader>
      <div className="max-h-64 overflow-y-auto rounded-md border border-[var(--border-soft)]">
        <button
          type="button"
          onClick={() => moveTo(null)}
          className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-sm text-[var(--text)] hover:bg-[var(--surface-2)]"
        >
          <Icon name="story" className="mr-1.5 inline-block h-3.5 w-3.5 align-[-2px]" />Story (root)
        </button>
        {destinations.map((folder) => (
          <button
            key={folder.id}
            type="button"
            onClick={() => moveTo(folder.id)}
            style={{ paddingLeft: 10 + depthOf(folder) * 16 }}
            className="flex w-full items-center gap-1.5 py-1.5 pr-2.5 text-left text-sm text-[var(--text)] hover:bg-[var(--surface-2)]"
          >
            <Icon name="folder" className="mr-1.5 inline-block h-3.5 w-3.5 align-[-2px]" />{folder.name}
          </button>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <Button intent="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
