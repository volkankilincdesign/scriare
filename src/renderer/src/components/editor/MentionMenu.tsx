import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import type { Editor, Range } from "@tiptap/core";
import { Icon } from "../common/Icon";
import { ENTITY_LABEL } from "../../types/entities";
import type { Entity, EntityKind } from "../../types/entities";

/**
 * One row in the @ menu: either an entity that already exists, or an offer
 * to create one with the name being typed.
 */
export type MentionMenuItem =
  | { kind: "entity"; entity: Entity; label: string }
  | { kind: "create"; entityKind: EntityKind; label: string };

export interface MentionMenuProps {
  items: MentionMenuItem[];
  command: (item: MentionMenuItem) => void;
  editor: Editor;
  range: Range;
}

export interface MentionMenuHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

/**
 * The floating @ menu. Built on the same Suggestion plumbing as the "/"
 * block menu — same keyboard contract, same look — so the two read as one
 * feature of the editor rather than two.
 *
 * The create rows matter as much as the matches. A writer who has just
 * invented a character mid-sentence should not have to stop, go to the
 * Content Browser, make a page, name it, and come back to find out where
 * they were.
 */
export const MentionMenu = forwardRef<MentionMenuHandle, MentionMenuProps>(
  function MentionMenu(props, ref) {
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
        if (event.key === "Enter" || event.key === "Tab") {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    if (props.items.length === 0) return null;

    return (
      <div className="w-64 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 shadow-xl">
        {props.items.map((item, index) => {
          const active = index === selectedIndex;
          const kind = item.kind === "entity" ? item.entity.kind : item.entityKind;
          return (
            <button
              key={item.kind === "entity" ? item.entity.id : `create-${item.entityKind}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setSelectedIndex(index)}
              onClick={() => selectItem(index)}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
                active ? "bg-[var(--surface-3)] text-[var(--text)]" : "text-[var(--text-2)]"
              }`}
            >
              <Icon
                name={kind === "character" ? "character" : "location"}
                className="h-3.5 w-3.5 shrink-0"
              />
              {item.kind === "entity" ? (
                <>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {/* Only shown when the writer reached this entity by one
                      of its other names, so the menu answers "which Mara
                      is this?" without being noisy about it. */}
                  {item.label !== item.entity.name && (
                    <span className="shrink-0 text-xs text-[var(--text-3)]">
                      {item.entity.name}
                    </span>
                  )}
                </>
              ) : (
                <span className="min-w-0 flex-1 truncate">
                  Create {ENTITY_LABEL[item.entityKind].toLowerCase()}{" "}
                  <span className="text-[var(--accent)]">{item.label}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  },
);
