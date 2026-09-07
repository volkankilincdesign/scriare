import { useEffect, useRef } from "react";

export interface ContentMenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
}

interface ContentContextMenuProps {
  x: number;
  y: number;
  items: ContentMenuItem[];
  onClose: () => void;
}

// A small, generic right-click menu — the caller decides which actions are
// relevant (a folder gets different items than a scene), this component
// just positions and renders whatever list it's given.
export function ContentContextMenu({ x, y, items, onClose }: ContentContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(e: PointerEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  if (items.length === 0) return null;

  return (
    <div
      ref={ref}
      style={{ top: y, left: x }}
      className="fixed z-50 min-w-[160px] rounded-md border border-[var(--border)] bg-[var(--bg)] py-1 shadow-xl"
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={() => {
            item.onSelect();
            onClose();
          }}
          // Sprint 8C visual-consistency fix (v0.18.0): matches the same
          // hardcoded-red-to-`--danger` fix applied to ChoiceBlockView's two
          // destructive buttons — a right-click menu's "Delete" item is the
          // same kind of destructive affordance ConfirmDialogHost/FrameNode
          // already read the theme token for.
          className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--surface-2)] ${
            item.danger ? "text-[var(--danger)]" : "text-[var(--text)]"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
