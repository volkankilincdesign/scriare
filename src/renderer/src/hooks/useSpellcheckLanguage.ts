import { useEffect } from "react";
import { useProjectStore } from "../state/projectStore";

/**
 * THE SPELLCHECKER FOLLOWS THE STORY (v0.89.0).
 *
 * One subscription rather than a call at each place a language could
 * change. The places are: opening a story, closing one, creating one,
 * editing the field in Project Settings, and undoing that edit — and a
 * list like that is a list of call sites somebody will forget to add the
 * sixth entry to. The language is a value in the store; watching the
 * value covers all of them and cannot fall out of step with a new one.
 *
 * NO STORY MEANS NO LANGUAGE, which means the spellchecker is turned off
 * rather than left pointing at whatever the last story used. That is why
 * `null` is passed through rather than skipped: the Welcome screen has a
 * text input on it, and a wrong dictionary in a small place is exactly how
 * this bug went unnoticed for twenty-four versions.
 *
 * Nothing is awaited and nothing is shown if it fails. A spellchecker is
 * an assistance; a writer who cannot have one should find that out by not
 * seeing red lines, not by being told about it in a toast.
 */
export function useSpellcheckLanguage(): void {
  const language = useProjectStore((s) => s.project?.language ?? null);

  useEffect(() => {
    const spellcheck = window.api?.spellcheck;
    if (!spellcheck) return;
    void spellcheck.setLanguage(language);
  }, [language]);
}
