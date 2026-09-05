import { useCallback, useEffect, useRef, useState } from "react";
import { SceneEditor } from "../editor/SceneEditor";
import { FlowPanel } from "../graph/FlowPanel";

const MIN_FLOW_HEIGHT = 120;
const MAX_FLOW_HEIGHT = 640;
const DEFAULT_FLOW_HEIGHT = 224;
const STORAGE_KEY = "scriare:flowHeight";

function loadStoredHeight(): number {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? Number(raw) : NaN;
    if (Number.isFinite(parsed)) {
      return Math.min(MAX_FLOW_HEIGHT, Math.max(MIN_FLOW_HEIGHT, parsed));
    }
  } catch {
    // localStorage can be unavailable in rare embedding scenarios — fall
    // back to the default rather than breaking the layout.
  }
  return DEFAULT_FLOW_HEIGHT;
}

interface EditorGraphSplitProps {
  flowCollapsed: boolean;
  onToggleFlow: () => void;
}

/**
 * Lets writers decide how much vertical space the editor vs. the Flow graph
 * gets, by dragging a thin handle between them — Priority 3 of the writing
 * workflow milestone. Purely a layout affordance: it never touches project
 * data, and the ratio is remembered locally (not saved into the project
 * file) so it doesn't clutter what gets synced/shared.
 */
export function EditorGraphSplit({ flowCollapsed, onToggleFlow }: EditorGraphSplitProps) {
  const [flowHeight, setFlowHeight] = useState(loadStoredHeight);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ y: number; height: number } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragStart.current = { y: e.clientY, height: flowHeight };
      setDragging(true);
      e.preventDefault();
    },
    [flowHeight],
  );

  useEffect(() => {
    if (!dragging) return;

    function handleMove(e: PointerEvent): void {
      if (!dragStart.current) return;
      // Dragging down shrinks the graph (dy > 0 -> less height), since the
      // handle sits above the graph panel.
      const dy = e.clientY - dragStart.current.y;
      const next = Math.min(
        MAX_FLOW_HEIGHT,
        Math.max(MIN_FLOW_HEIGHT, dragStart.current.height - dy),
      );
      setFlowHeight(next);
    }

    function handleUp(): void {
      setDragging(false);
      dragStart.current = null;
      setFlowHeight((current) => {
        try {
          window.localStorage.setItem(STORAGE_KEY, String(current));
        } catch {
          // Best-effort persistence only.
        }
        return current;
      });
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [dragging]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-hidden">
        <SceneEditor />
      </div>

      {!flowCollapsed && (
        <div
          onPointerDown={handlePointerDown}
          title="Drag to resize"
          className={`group relative h-1.5 shrink-0 cursor-row-resize bg-zinc-800 ${
            dragging ? "bg-emerald-600" : "hover:bg-emerald-700/60"
          }`}
        >
          <div className="absolute inset-x-0 -top-1.5 -bottom-1.5" />
        </div>
      )}

      <FlowPanel collapsed={flowCollapsed} onToggle={onToggleFlow} height={flowHeight} />
    </div>
  );
}
