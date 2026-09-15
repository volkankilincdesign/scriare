import { createContext, useContext } from "react";
import type { DragEvent, MouseEvent } from "react";
import type { ContentNode, Scene } from "../../types/project";

export type DropPosition = "before" | "after" | "inside";

export interface DropTarget {
  id: string;
  position: DropPosition;
}

export interface ContentBrowserContextValue {
  nodes: ContentNode[];
  scenesById: Map<string, Scene>;
  selectedSceneId: string | null;
  startSceneId: string | null;
  favoriteSceneIds: Set<string>;

  expanded: Set<string>;
  toggleExpand: (id: string) => void;

  /** Multi-selection within the Content Browser — separate from `selectedSceneId`
   * (the one scene open in the editor). Desktop-standard: plain click replaces
   * the selection, Ctrl/Cmd+click toggles a node in/out, Shift+click selects
   * the visible range between the anchor and the clicked node. */
  selectedIds: Set<string>;
  onItemClick: (e: MouseEvent, node: ContentNode) => void;
  /**
   * Empties the tree's selection. Clicking a Character or Location has to
   * do this: the panel holds one selection, and leaving a scene highlighted
   * while a character row is the one lit up means two things look selected
   * and F2 has to guess which one you meant.
   */
  clearSelection: () => void;

  renamingId: string | null;
  renameDraft: string;
  startRename: (id: string, currentName: string) => void;
  changeRenameDraft: (value: string) => void;
  commitRename: () => void;
  cancelRename: () => void;

  openContextMenu: (e: MouseEvent, node: ContentNode | null) => void;

  draggingIds: Set<string>;
  dropTarget: DropTarget | null;
  onDragStartNode: (e: DragEvent, id: string) => void;
  onDragOverNode: (e: DragEvent, node: ContentNode) => void;
  onDropNode: (e: DragEvent, node: ContentNode) => void;
  onDragEnd: () => void;
}

export const ContentBrowserContext = createContext<ContentBrowserContextValue | null>(null);

export function useContentBrowser(): ContentBrowserContextValue {
  const ctx = useContext(ContentBrowserContext);
  if (!ctx) throw new Error("useContentBrowser must be used within a ContentBrowserContext.Provider");
  return ctx;
}
