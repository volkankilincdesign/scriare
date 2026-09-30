import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import type { Editor, Range } from "@tiptap/core";
import type { NarrativeBlockDefinition } from "../../narrativeBlocks/types";

export interface SlashCommandMenuProps {
  items: NarrativeBlockDefinition[];
  command: (item: NarrativeBlockDefinition) => void;
  editor: Editor;
  range: Range;
}

export interface SlashCommandMenuHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

// The floating "/" menu itself. Tiptap's Suggestion utility renders this via
// ReactRenderer and forwards keydown events to it (arrow keys / Enter) via
// the imperative handle below — the menu never reads the keyboard directly.
export const SlashCommandMenu = forwardRef<SlashCommandMenuHandle, SlashCommandMenuProps>(
  function SlashCommandMenu(props, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
      setSelectedIndex(0);
    }, [props.items]);

    function selectItem(index: number): void {
      const item = props.items[index];
      if (item) props.command(item);
    }

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (props.items.length === 0) return false;
        if (event.key === "ArrowUp") {
          setSelectedIndex((i) => (i + props.items.length - 1) % props.items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((i) => (i + 1) % props.items.length);
          return true;
        }
        if (event.key === "Enter") {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    if (props.items.length === 0) {
      return (
        <div className="w-64 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text-3)] shadow-xl">
          No matching blocks
        </div>
      );
    }

    return (
      <div
        data-slash-menu
        className="w-64 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg)] py-1 shadow-xl"
      >
        {props.items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            data-slash-item={item.id}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => selectItem(index)}
            className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left ${
              index === selectedIndex ? "bg-[var(--surface-2)]" : ""
            }`}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text-2)]">
              {item.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span data-slash-title className="block truncate text-sm text-[var(--text)]">
                {item.title}
              </span>
              <span className="block truncate text-xs text-[var(--text-3)]">{item.description}</span>
            </span>
          </button>
        ))}
      </div>
    );
  },
);
