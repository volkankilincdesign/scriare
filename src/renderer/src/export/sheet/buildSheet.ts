import type { JSONContent } from "@tiptap/react";
import type { Project, Scene } from "../../types/project";
import { mentionLabel } from "../../types/entities";
import { isPlayerSpeaker, playerLabel } from "../../types/speaker";
import {
  CHOICE_BLOCK_TYPE,
  CHOICE_OPTION_TYPE,
  DIALOGUE_BLOCK_TYPE,
} from "../../types/nodeTypes";
import { CONDITIONAL_BLOCK_TYPE } from "../../utils/choiceBlockEditing";
import { extractDialogueLines } from "../../utils/dialogueBlocks";
import { actionPhrase, conditionPhrase } from "../../../../shared/script/model";
import { TYPE_LETTER, shortHash, slug } from "../../../../shared/sheet/model";
import type { SheetDocument, SheetRow, SheetRowType } from "../../../../shared/sheet/model";

/**
 * The project, walked once into every string a reader sees (v0.70.0).
 *
 * ORDER IS READING ORDER, and that is the one substantive difference from
 * the script's walk. The script prints in Content-tree order, because a
 * script is a document somebody reads front to back and the writer's own
 * arrangement is the only rule they can see and change. A spreadsheet is
 * not read front to back — it is filtered, sorted and searched — so its
 * order can afford to be the one that makes the ADDRESS useful instead:
 * scene 1 is where a reader begins, and the numbers run outward along the
 * choices in the order a reader meets them.
 *
 * That is why changing the Start Scene renumbers the sheet. It should: the
 * initial passage really is the initial passage, and a Ref that claims
 * otherwise is worse than one that moves.
 *
 * A scene nothing leads to cannot have a place in reading order, so it
 * gets a U block — `U1`, `U2` — after the numbered ones rather than a
 * number that implies somebody gets there. Check Story already reports
 * those scenes; the sheet must not quietly contradict it.
 */

/** Flatten inline content, resolving mentions to the entity's CURRENT name. */
function flatten(
  node: JSONContent,
  resolve: (id: string | null, stored: string) => string,
  mentions: Set<string>,
): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "mention") {
    const name = resolve((node.attrs?.entityId as string) ?? null, (node.attrs?.label as string) ?? "");
    // Column K exists because this is a one-way door: the name is baked
    // into the string a translator works on, so renaming the character
    // later desynchronises exactly these rows. Recording which rows they
    // are turns invisible damage into one filter.
    if (name) mentions.add(name);
    return name;
  }
  // Shift+Enter is a node, not a character. A naive flatten joins the
  // words either side of it into one — "the doorthe hallway" — which is
  // wrong in the cell and wrong in the CSV.
  if (node.type === "hardBreak") return "\n";
  return (node.content ?? []).map((c) => flatten(c, resolve, mentions)).join("");
}

/** Every scene a choice or a dialogue line can lead to, in document order. */
function exitsOf(scene: Scene): string[] {
  const out: string[] = [];
  (function walk(node: JSONContent): void {
    if (node.type === CHOICE_OPTION_TYPE) {
      const target = node.attrs?.targetSceneId as string | null;
      if (target) out.push(target);
      return;
    }
    if (node.type === "dialogueLine") {
      const target = node.attrs?.targetSceneId as string | null;
      if (target && node.attrs?.after === "leave") out.push(target);
      return;
    }
    (node.content ?? []).forEach(walk);
  })(scene.content);
  return out;
}

export function buildSheet(project: Project, options: { language: string }): SheetDocument {
  const entityById = new Map(project.entities.map((e) => [e.id, e]));
  const variableById = new Map(project.variables.map((v) => [v.id, v]));
  const sceneById = new Map(project.scenes.map((s) => [s.id, s]));

  const resolve = (id: string | null, stored: string): string =>
    mentionLabel(id ? entityById.get(id) : undefined, stored || null);

  const speakerOf = (raw: unknown): string => {
    if (typeof raw !== "string" || !raw) return "";
    if (isPlayerSpeaker(raw)) return playerLabel(project.playerName);
    const entity = entityById.get(raw);
    // Never the raw id. A line attributed to a deleted character is
    // narration, which is what the app shows on screen — a sheet that
    // printed an id would be shipping a bug to a translator.
    return entity?.kind === "character" ? entity.name.trim() : "";
  };

  // Joined with "; " rather than a newline: these land in a narrow column
  // a translator scans rather than reads, and a wrapped cell of three
  // conditions pushes every row on screen twice as tall.
  const conditionWords = (list: unknown): string =>
    (Array.isArray(list) ? list : [])
      .map((c: { variableId: string; comparator: string; value: unknown; negate?: boolean }) =>
        conditionPhrase(
          variableById.get(c.variableId)?.name ?? "(deleted variable)",
          c.comparator,
          c.value,
          c.negate,
        ),
      )
      .join("; ");

  const actionWords = (list: unknown): string =>
    (Array.isArray(list) ? list : [])
      .map((a: { variableId: string; operation: string; value: unknown }) =>
        actionPhrase(
          variableById.get(a.variableId)?.name ?? "(deleted variable)",
          a.operation,
          a.value,
        ),
      )
      .join("; ");

  // ── scene numbering, before any row is built ─────────────────────────
  // A choice in scene 3 prints the address of a scene that may come later,
  // so the numbers have to be settled first.
  const declared = project.startSceneId;
  const startId =
    (declared && sceneById.has(declared) ? declared : project.scenes[0]?.id) ?? null;

  const label = new Map<string, string>();
  const order: Scene[] = [];
  const seen = new Set<string>();

  if (startId && sceneById.has(startId)) {
    // Breadth-first, and the queue is fed in document order, so "the order
    // a reader meets them" is literally the order the choices sit on the
    // page rather than whatever order the scene list happens to be in.
    const queue = [startId];
    seen.add(startId);
    while (queue.length > 0) {
      const current = queue.shift() as string;
      const scene = sceneById.get(current);
      if (!scene) continue;
      label.set(scene.id, String(order.length + 1));
      order.push(scene);
      for (const next of exitsOf(scene)) {
        if (!seen.has(next) && sceneById.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
  }

  let unreachable = 0;
  for (const scene of project.scenes) {
    if (seen.has(scene.id)) continue;
    unreachable += 1;
    label.set(scene.id, `U${unreachable}`);
    order.push(scene);
  }

  // ── the rows ─────────────────────────────────────────────────────────
  const rows: SheetRow[] = [];
  const speakers = new Set<string>();
  let skippedEmpty = 0;
  let prose = 0;
  let choices = 0;
  let dialogue = 0;
  let replies = 0;
  let mentionRows = 0;
  let reasons = 0;
  let variableNames = 0;
  /** Every key already spoken for, so a variable row cannot collide. */
  const taken = new Set<string>();

  for (const scene of order) {
    const n = label.get(scene.id)!;
    const title = scene.title || "Untitled scene";
    const counters = { T: 0, C: 0, D: 0 };

    const push = (
      type: SheetRowType,
      opts: {
        key: string;
        refSuffix: string;
        wherePhrase: string;
        speaker: string;
        text: string;
        mentions: Set<string>;
        shownWhen?: string;
        changes?: string;
        after?: string;
      },
    ): void => {
      const text = opts.text.trim();
      if (!text) {
        skippedEmpty += 1;
        return;
      }
      taken.add(opts.key);
      const named = [...opts.mentions];
      if (named.length) mentionRows += 1;
      if (opts.speaker) speakers.add(opts.speaker);
      const ref = `${n}.${opts.refSuffix}`;
      rows.push({
        key: opts.key,
        ref,
        where: `${n} · ${title} · ${opts.wherePhrase}`,
        scene: title,
        sceneId: scene.id,
        type,
        speaker: opts.speaker,
        text,
        mentions: named.join(", "),
        shownWhen: opts.shownWhen ?? "",
        changes: opts.changes ?? "",
        after: opts.after ?? "",
        // A scene title is not spoken, so it gets no take. Everything else
        // does, including narration — a narrator is a speaking part.
        voFile:
          type === "Scene"
            ? ""
            : `s${slug(n)}_${opts.refSuffix.toLowerCase()}_${slug(opts.speaker || "narration")}.wav`,
        hash: shortHash(text),
      });
    };

    /**
     * A locked option's own sentence (v0.72.0).
     *
     * Only when the option is SHOWN locked: a hidden one tells the reader
     * nothing, so a reason on one is a string nobody reaches. Its key and
     * its ref both hang off the option's, the way a reply's do, so
     * deleting the choice takes the reason with it rather than leaving an
     * orphan a translator has to guess at.
     */
    const pushReason = (
      ownerKey: string,
      ownerRef: string,
      ownerPhrase: string,
      whenUnmet: string | undefined,
      reason: string | undefined,
    ): void => {
      if (whenUnmet !== "lock" || !reason?.trim()) return;
      reasons += 1;
      push("Reason", {
        key: `${ownerKey}-why`,
        refSuffix: `${ownerRef}w`,
        wherePhrase: `${ownerPhrase}, why it is locked`,
        speaker: "",
        text: reason,
        mentions: new Set(),
      });
    };

    // The scene's own title. A reader sees it as an <h1> in the exported
    // page, so it is a string to translate — and it was the first thing
    // found missing when this spec was reviewed against the real export.
    push("Scene", {
      // The scene's stored title key, not its id. The id is opaque and
      // this column is read — see utils/ids.ts. `normalizeProject` fills
      // the key in on open, so the fallback is only for a project the
      // session built in memory.
      key: scene.titleKey || `s_${scene.id}`,
      refSuffix: TYPE_LETTER.Scene,
      wherePhrase: "scene title",
      speaker: "",
      text: title,
      mentions: new Set(),
    });

    /** One paragraph, optionally carrying a gate from the block above it. */
    const paragraph = (node: JSONContent, gate: string): void => {
      const mentions = new Set<string>();
      const text = flatten(node, resolve, mentions);
      if (!text.trim()) {
        skippedEmpty += 1;
        return;
      }
      counters.T += 1;
      prose += 1;
      push("Text", {
        // A paragraph's lineId is its identity, guaranteed unique across
        // the project since v0.69.0. The fallback exists only for a
        // document mounted mid-edit, where the sweep has not run yet.
        key: (node.attrs?.lineId as string) || `${scene.id}:t${counters.T}`,
        refSuffix: `${TYPE_LETTER.Text}${counters.T}`,
        wherePhrase: `paragraph ${counters.T}`,
        speaker: speakerOf(node.attrs?.speaker),
        text,
        mentions,
        shownWhen: gate,
      });
    };

    for (const node of scene.content.content ?? []) {
      if (node.type === CHOICE_BLOCK_TYPE) {
        for (const option of node.content ?? []) {
          if (option.type !== CHOICE_OPTION_TYPE) continue;
          const mentions = new Set<string>();
          const text = flatten(option, resolve, mentions);
          if (!text.trim()) {
            skippedEmpty += 1;
            continue;
          }
          counters.C += 1;
          choices += 1;
          const optionKey = (option.attrs?.optionId as string) || `${scene.id}:c${counters.C}`;
          push("Choice", {
            key: optionKey,
            refSuffix: `${TYPE_LETTER.Choice}${counters.C}`,
            wherePhrase: `choice ${counters.C}`,
            speaker: speakerOf(option.attrs?.speaker),
            text,
            mentions,
            shownWhen: conditionWords(option.attrs?.conditions),
            changes: actionWords(option.attrs?.actions),
          });
          pushReason(
            optionKey,
            `${TYPE_LETTER.Choice}${counters.C}`,
            `choice ${counters.C}`,
            option.attrs?.whenUnmet as string,
            option.attrs?.lockReason as string,
          );
        }
      } else if (node.type === DIALOGUE_BLOCK_TYPE) {
        for (const line of extractDialogueLines(node, resolve)) {
          counters.D += 1;
          const index = counters.D;
          const target = line.targetSceneId ? sceneById.get(line.targetSceneId) : undefined;
          const after =
            line.after === "leave"
              ? target
                ? `↪ ${label.get(target.id) ?? "?"} ${target.title || "Untitled scene"}`
                : "↪ nowhere yet"
              : line.after === "end"
                ? "ends"
                : "stays";

          // The line's own text is flattened by extractDialogueLines, which
          // resolves mentions but cannot report them, so the names are read
          // back off the node the line kept.
          const lineMentions = new Set<string>();
          if (line.node) flatten(line.node, resolve, lineMentions);

          dialogue += 1;
          push("Dialogue", {
            key: line.id,
            refSuffix: `${TYPE_LETTER.Dialogue}${index}`,
            wherePhrase: `dialogue ${index}`,
            speaker: speakerOf(line.speaker),
            text: line.text,
            mentions: lineMentions,
            shownWhen: conditionWords(line.conditions),
            changes: actionWords(line.actions),
            after,
          });

          // The reply hangs off the line and has no life of its own: its
          // ref is the line's with an `r`, so deleting the line takes the
          // reply's address with it rather than leaving a stray number.
          // Its key follows the same rule — the line's key with `-r` —
          // rather than being named from the reply's own words, because a
          // reply that is not attached to its line is not anything.
          if (line.reply.trim()) replies += 1;
          push("Reply", {
            key: `${line.id}-r`,
            refSuffix: `${TYPE_LETTER.Reply}${index}r`,
            wherePhrase: `dialogue ${index}, reply`,
            speaker: speakerOf(line.replySpeaker),
            text: line.reply,
            mentions: new Set(),
          });
          pushReason(
            line.id,
            `${TYPE_LETTER.Dialogue}${index}`,
            `dialogue ${index}`,
            line.whenUnmet,
            line.lockReason,
          );
        }
      } else if (node.type === CONDITIONAL_BLOCK_TYPE) {
        // The condition lives on the BLOCK. Carried down to every
        // paragraph inside it, because otherwise gated prose arrives in the
        // sheet looking like ordinary prose with an empty *Shown when* —
        // blank in the one place a translator most needs the context.
        const gate = conditionWords(node.attrs?.conditions);
        for (const child of node.content ?? []) {
          if (child.type === "paragraph") paragraph(child, gate);
        }
      } else if (node.type === "paragraph") {
        paragraph(node, "");
      }
    }
  }

  /**
   * The variables a reader can end up reading (v0.72.0).
   *
   * At the END, in a V block of their own, because they belong to no
   * scene — the same reasoning that puts an unreachable scene after the
   * numbered ones rather than inventing a place for it in reading order.
   *
   * Only the ones with a display name. A variable without one has nothing
   * a reader sees — the locked line falls back to its internal name, which
   * is a bug Check Story reports rather than a string to translate — and
   * putting `knows_roster` in front of a translator would be asking them
   * to localise an identifier.
   *
   * THE KEY IS THE DISPLAY NAME, which means changing the display name
   * changes the key. That is right here and wrong everywhere else in this
   * file: for a line, the words are what the line SAYS and the key is who
   * it IS; for a variable's display name, the words ARE the whole thing.
   * Rename it and you have not moved a string, you have written a new one.
   */
  const named = project.variables.filter((v) => v.displayName?.trim());
  named.forEach((variable, index) => {
    const label = variable.displayName?.trim() || variable.name || "untitled";
    variableNames += 1;
    const slugged = `v_${slug(label)}`;
    rows.push({
      key: taken.has(slugged) ? `${slugged}-${index + 1}` : slugged,
      ref: `V${index + 1}`,
      where: `Variables · ${variable.name || "untitled"}`,
      scene: "",
      sceneId: "",
      type: "Variable",
      speaker: "",
      text: label,
      mentions: "",
      shownWhen: "",
      changes: "",
      after: "",
      voFile: "",
      hash: shortHash(label),
    });
    taken.add(slugged);
  });

  return {
    title: project.name || "Untitled Story",
    language: options.language.trim(),
    generatedAt: new Date().toISOString(),
    schemaVersion: 1,
    // Over the keys AND the text, in order: a fingerprint that moved
    // because a line was reworded is exactly as interesting as one that
    // moved because a line was added.
    fingerprint: shortHash(rows.map((r) => `${r.key}\u0000${r.text}`).join("\u0001")),
    rows,
    skippedEmpty,
    stats: {
      scenes: order.length,
      unreachableScenes: unreachable,
      prose,
      choices,
      dialogue,
      replies,
      speakers: speakers.size,
      mentions: mentionRows,
      reasons,
      variableNames,
    },
  };
}
