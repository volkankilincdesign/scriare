import { ipcMain, session } from "electron";
import { resolveSpellcheckLanguage, type SpellcheckChoice } from "../spellcheck";

/**
 * The session's spellchecker, pointed at the open story's language
 * (v0.88.6). The decision itself is in `../spellcheck.ts` and is pure;
 * this is the part that touches Electron.
 */

/** What the last call settled on, so the renderer and the suite can ask. */
let lastApplied: (SpellcheckChoice & { available: number }) | null = null;

/**
 * THE DEFAULT IS OFF, and it is off from the moment the app starts.
 *
 * Until a story is open there is nothing to take a language from, and the
 * only other source is the OS locale — which is exactly the source that
 * produced the bug. A Welcome screen has little editable text in it, but
 * "little" is not "none" (the project-name field is a text input), and a
 * default that is wrong in a small place is still wrong.
 */
export function disableSpellcheckUntilAStoryIsOpen(): void {
  apply(null);
}

function apply(tag: string | null): SpellcheckChoice & { available: number } {
  const ses = session.defaultSession;

  // macOS uses the OS spellchecker and these calls are either no-ops or
  // throw depending on the Electron version. Scriare ships Windows builds;
  // this is the two lines that keep a future macOS build from crashing on
  // startup rather than silently doing the right thing.
  if (process.platform === "darwin") {
    const choice: SpellcheckChoice = { languages: [], reason: "none" };
    lastApplied = { ...choice, available: 0 };
    return lastApplied;
  }

  let available: readonly string[] = [];
  try {
    available = ses.availableSpellCheckerLanguages ?? [];
  } catch {
    // Reported as unavailable rather than guessed at: an empty list makes
    // every tag "unsupported", which turns the spellchecker off. That is
    // the safe direction — the failure this version exists to fix was a
    // spellchecker running with the wrong dictionary, not one not running.
    available = [];
  }

  const choice = resolveSpellcheckLanguage(tag, available);

  try {
    if (choice.languages.length) {
      ses.setSpellCheckerLanguages(choice.languages);
      ses.setSpellCheckerEnabled(true);
    } else {
      ses.setSpellCheckerEnabled(false);
    }
  } catch {
    // An unsupported code reaching setSpellCheckerLanguages throws. Fall
    // back to off rather than leaving whatever was configured before — the
    // previous value is the one that was wrong.
    try {
      ses.setSpellCheckerEnabled(false);
    } catch {
      /* nothing further to try */
    }
    lastApplied = { languages: [], reason: "unsupported", available: available.length };
    return lastApplied;
  }

  lastApplied = { ...choice, available: available.length };
  return lastApplied;
}

export function registerSpellcheckHandlers(): void {
  /**
   * Called by the renderer whenever the open story's language changes,
   * which includes opening one, closing one, and editing the field in
   * Project Settings — see renderer/src/hooks/useSpellcheckLanguage.ts.
   *
   * Returns what it settled on, rather than void. The suite cannot see a
   * red squiggle, and `getSpellCheckerLanguages` reports what was ASKED
   * for; the honest thing to assert on is the decision this made and why.
   */
  ipcMain.handle("spellcheck:setLanguage", (_event, tag: unknown) =>
    apply(typeof tag === "string" ? tag : null),
  );

  /** What is in force now, without changing it. */
  ipcMain.handle("spellcheck:state", () => lastApplied);
}
