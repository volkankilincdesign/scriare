import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { FLOATING_PANEL, MENU_ITEM, MENU_ITEM_SELECTED } from "../common/surfaces";
import type { Editor, Range } from "@tiptap/core";
import { Icon } from "../common/Icon";
import { ENTITY_LABEL } from "../../types/entities";
import type { Entity, EntityKind } from "../../types/entities";

/**
 * One row in the @ menu: either an entity that already exists, or an offer
 * to create one with the name being typed.
 */
export type MentionMenuItem = (
  | { kind: "entity"; entity: Entity; label: string }
  | { kind: "create"; entityKind: EntityKind; label: string }
  // v0.37.0 — "The player", offered only where a speaker can go.
  | { kind: "player"; label: string }
) & {
  /**
   * True when this @ is at the head of an empty line, where choosing a
   * name says who is SPEAKING the line rather than writing the name into
   * it. Decided in the extension (which can see the document) and carried
   * on the item so the menu can say what it's about to do.
   */
  attributing?: boolean;
  /**
   * True when confirming this row will set the line's speaker. Decided in
   * the extension, because it depends on what the row IS: at the head of a
   * line a Character speaks and a Location is still only a mention — a
   * place can be named in a sentence but cannot say one.
   */
  speaks?: boolean;
  /** Set when the writer held Shift: insert a plain mention after all. */
  asMention?: boolean;
};

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

    function selectItem(index: number, asMention = false): void {
      const item = props.items[index];
      if (item) props.command(asMention ? { ...item, asMention: true } : item);
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
          // Shift is the escape hatch out of attribution, for the line
          // that really does begin with a name — "Mara had been waiting."
          selectItem(selectedIndex, event.shiftKey);
          return true;
        }
        return false;
      },
    }));

    if (props.items.length === 0) return null;
    const attributing = props.items.some((item) => item.attributing);

    return (
      <div data-floating-panel className={`w-64 overflow-hidden py-1 ${FLOATING_PANEL}`}>
        {props.items.map((item, index) => {
          const active = index === selectedIndex;
          const kind =
            item.kind === "entity"
              ? item.entity.kind
              : item.kind === "player"
                ? "character"
                : item.entityKind;
          return (
            <button
              key={
                item.kind === "entity"
                  ? item.entity.id
                  : item.kind === "player"
                    ? "player"
                    : `create-${item.entityKind}`
              }
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setSelectedIndex(index)}
              onClick={(e) => selectItem(index, e.shiftKey)}
              // v0.85.0 — the kit's row. This one already had the right
              // selected colour; it is here so that there is one spelling
              // rather than one correct spelling and three others.
              className={`${MENU_ITEM} ${
                active ? `${MENU_ITEM_SELECTED} text-[var(--text)]` : "text-[var(--text-2)]"
              }`}
            >
              <Icon
                // Two kinds, not three: a note can never be mentioned, so
                // one can never appear in this menu (see isMentionable).
                name={kind === "character" ? "character" : "location"}
                className="h-3.5 w-3.5 shrink-0"
              />
              {item.kind === "player" ? (
                <span className="min-w-0 flex-1 truncate">
                  The player{" "}
                  <span className="text-[var(--text-3)]">— no name needed</span>
                </span>
              ) : item.kind === "entity" ? (
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
                  {/* Only at the head of a line, and only on the rows that
                      will do the other thing — so the difference is visible
                      exactly where it exists. */}
                  {item.attributing && !item.speaks && (
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-[var(--text-3)]">
                      mention
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
        {/* Only where it changes what a keystroke does. A hint that is
            always on screen is a hint nobody reads. */}
        {attributing && (
          <div className="mt-1 border-t border-[var(--border-soft)] px-3 pb-0.5 pt-1.5 text-[11px] text-[var(--text-3)]">
            {props.items[selectedIndex]?.speaks ? (
              <>
                Sets who speaks this line ·{" "}
                <span className="text-[var(--text-2)]">Shift</span> to write the name instead
              </>
            ) : (
              // The honest version of "why didn't that set the speaker?",
              // said before it happens rather than after.
              <>A place can be named in a line, not say one — this writes the name</>
            )}
          </div>
        )}
      </div>
    );
  },
);
