import React from "react";
import ReactDOM from "react-dom/client";

// Bundled variable fonts, imported before the app's own styles so the
// @font-face rules exist by the time anything is painted. These replace a
// runtime @import from Google Fonts, which meant the app silently rendered
// in fallback system fonts whenever it was offline. Inter and Newsreader
// load with their optical-size axis ("opsz"), so letterforms adapt to the
// size they're set at rather than one drawing being stretched to serve
// both a 10px label and a dialog title.
import "@fontsource-variable/inter/opsz.css";
import "@fontsource-variable/inter/opsz-italic.css";
import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource-variable/newsreader/opsz-italic.css";
import "@fontsource-variable/manrope";

import App from "./App";
import "./styles/index.css";

// Dev-only test hook. `import.meta.env.DEV` is replaced with a literal at
// build time and the whole branch is dropped from a production bundle, so
// this costs the shipped app nothing — but it means tests/*.spec.mjs can
// drive the real stores without anyone hand-editing this file first, which
// is what made the standalone script in v0.25.0 easy to forget to run.
if (import.meta.env.DEV || import.meta.env.MODE === "test") {
  void Promise.all([
    import("./state/projectStore"),
    import("./state/toastStore"),
    import("./state/selectionStore"),
    import("./utils/contentClipboard"),
    import("./utils/graphGroups"),
    import("./types/project"),
    import("./types/variables"),
    import("./state/editorStore"),
    import("./utils/choiceBlocks"),
    import("./utils/choiceBlockEditing"),
    import("./state/inspectorStore"),
  ]).then(
    ([
      projectStore,
      toastStore,
      selectionStore,
      clipboardUtils,
      groupUtils,
      projectTypes,
      variables,
      editorStore,
      choiceUtils,
      choiceEditing,
      inspectorStore,
    ]) => {
      Object.assign(window, {
        __scriareProjectStore: projectStore.useProjectStore,
        __scriareToastStore: toastStore.useToastStore,
        __scriareSelectionStore: selectionStore.useSelectionStore,
        __scriareClipboardUtils: clipboardUtils,
        __scriareGroupUtils: groupUtils,
        __scriareProjectTypes: projectTypes,
        __scriareVariables: variables,
        // The live editor and the Choice Block helpers that act on it. A
        // schema is only real through ProseMirror, so the v0.32.0 tests
        // drive actual transactions rather than reasoning about JSON.
        __scriareEditorStore: editorStore.useEditorRefStore,
        __scriareChoiceUtils: choiceUtils,
        __scriareChoiceEditing: choiceEditing,
        __scriareInspectorStore: inspectorStore.useInspectorStore,
      });
    },
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
