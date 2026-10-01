import { useEffect, useRef } from "react";
import { FLOATING_PANEL, MENU_ITEM } from "../common/surfaces";

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
      data-floating-panel
      className={`fixed z-50 min-w-[160px] py-1 ${FLOATING_PANEL}`}
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
          // v0.85.0 — the kit's row. This one's hover was already right;
          // what it did not have was the flex shape, so a menu item here
          // could never carry an icon the way its three siblings do.
          className={`${MENU_ITEM} ${
            item.danger ? "text-[var(--danger)]" : "text-[var(--text)]"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
