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
    import("./types/choiceStyles"),
    import("./types/entities"),
    import("./utils/mentions"),
    import("./utils/storyCheck"),
    import("./types/speaker"),
    import("./utils/speakerLines"),
    import("./utils/findInStory"),
    import("./utils/textFold"),
    import("./utils/reuseBySignature"),
    import("./state/uiStore"),
    import("./utils/graphConstants"),
    import("./utils/autoLayout"),
    import("./state/themeStore"),
    import("./export/buildStory"),
    import("./export/pageTemplate"),
    import("./export/contrastCheck"),
    import("./export/readingThemes"),
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
      choiceStyles,
      entities,
      mentions,
      storyCheck,
      speakerTypes,
      speakerLines,
      findInStory,
      textFold,
      reuseBySignature,
      uiStore,
      graphConstants,
      autoLayout,
      themeStore,
      buildStory,
      pageTemplate,
      contrastCheck,
      readingThemes,
    ]) => {
      Object.assign(window, {
        __scriareProjectStore: projectStore.useProjectStore,
        __scriareToastStore: toastStore.useToastStore,
        __scriareSelectionStore: selectionStore.useSelectionStore,
        __scriareClipboardUtils: clipboardUtils,
        __scriareGroupUtils: groupUtils,
        __scriareGraphConstants: graphConstants,
        __scriareProjectTypes: projectTypes,
        __scriareVariables: variables,
        // The live editor and the Choice Block helpers that act on it. A
        // schema is only real through ProseMirror, so the v0.32.0 tests
        // drive actual transactions rather than reasoning about JSON.
        __scriareEditorStore: editorStore.useEditorRefStore,
        __scriareChoiceUtils: choiceUtils,
        __scriareChoiceEditing: choiceEditing,
        __scriareInspectorStore: inspectorStore.useInspectorStore,
        __scriareChoiceStyles: choiceStyles,
        __scriareEntities: entities,
        __scriareMentions: mentions,
        __scriareStoryCheck: storyCheck,
        __scriareSpeaker: speakerTypes,
        __scriareSpeakerLines: speakerLines,
        __scriareFind: findInStory,
        __scriareTextFold: textFold,
        __scriareReuse: reuseBySignature,
        __scriareUIStore: uiStore.useUIStore,
        // v0.43.0 — the layout rules are pure arithmetic, so the specs that
        // cover them build graphs and read the geometry back rather than
        // measuring a picture of one.
        __scriareAutoLayout: autoLayout,
        // v0.44.0 — the theme list and the store that applies one, so the
        // themes spec can walk every theme rather than trusting a copy of
        // the list kept in the test.
        __scriareThemes: themeStore,
        // v0.48.0 — export. The whole pipeline is pure functions over a
        // project, so the specs build a story, run the real exporter and
        // assert on the page it produced, rather than driving a save
        // dialog a headless run cannot open.
        __scriareExport: { ...buildStory, ...pageTemplate, ...contrastCheck, ...readingThemes },
      });
    },
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
