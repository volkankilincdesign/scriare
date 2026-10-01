import { useSaveFailedPromptStore } from "../../state/saveFailedPromptStore";
import { SaveFailedDialog } from "./SaveFailedDialog";

/**
 * Mounts the save-failed question while one is pending (v0.86.0). Same shape
 * as ConfirmDialogHost: the store holds the resolver, this draws whatever is
 * waiting, and the dialog itself knows nothing about who asked.
 */
export function SaveFailedPromptHost() {
  const resolver = useSaveFailedPromptStore((s) => s.resolver);
  const resolve = useSaveFailedPromptStore((s) => s.resolve);
  if (!resolver) return null;
  return <SaveFailedDialog onResolve={resolve} />;
}
