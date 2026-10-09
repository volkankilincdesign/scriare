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
    import("./hooks/useRevealMatch"),
    import("./extensions/RevealFlash"),
    import("./types/speaker"),
    import("./utils/speakerLines"),
    import("./utils/findInStory"),
    import("./utils/replaceInStory"),
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
    import("./export/stylesheetNotes"),
    import("./styles/choiceBoxLayer"),
    import("./narrativeBlocks/registry"),
    import("./help/faq"),
    import("./components/common/surfaces"),
    import("./utils/recentShape"),
    import("../../shared/recentEntries"),
    import("../../shared/fileArgs"),
    import("./state/playGroundStore"),
    import("./state/saveFailedPromptStore"),
    import("./components/layout/EditorGraphSplit"),
    import("./export/script/buildScript"),
    import("../../shared/script/scriptHtml"),
    import("./utils/dialogueBlocks"),
    import("./utils/contentIds"),
    import("./export/sheet/buildSheet"),
    import("../../shared/sheet/model"),
    import("./utils/wireAnchors"),
    import("./utils/wireRouter"),
    import("./utils/autoLayoutGraph"),
    import("./types/languages"),
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
      revealMatch,
      revealFlash,
      speakerTypes,
      speakerLines,
      findInStory,
      replaceInStory,
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
      stylesheetNotes,
      choiceBoxLayer,
      narrativeBlocks,
      faq,
      surfaces,
      recentShape,
      recentEntries,
      fileArgs,
      playGroundStore,
      saveFailedPrompt,
      editorGraphSplit,
      scriptBuilder,
      scriptHtml,
      dialogueBlocks,
      contentIds,
      sheetBuilder,
      sheetModel,
      wireAnchors,
      wireRouter,
      autoLayoutGraph,
      languages,
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
        // v0.77.0 — the id-to-position lookup the reveal is built on, so a
        // spec can ask where a node IS rather than infer it from a scroll
        // offset, which would measure the browser instead of the app.
        __scriareReveal: { ...revealMatch, ...revealFlash },
        __scriareSpeaker: speakerTypes,
        __scriareSpeakerLines: speakerLines,
        __scriareFind: findInStory,
        __scriareReplace: replaceInStory,
        __scriareTextFold: textFold,
        // v0.64.0 — Script Export, so the spec can drive the real builder
        // and the real page renderer rather than a copy of either.
        __scriareBuildScript: scriptBuilder.buildScript,
        __scriareScriptHtml: scriptHtml.buildScriptHtml,
        __scriareDialogue: dialogueBlocks,
        __scriareContentIds: contentIds,
        __scriareSheet: { ...sheetBuilder, ...sheetModel },
        __scriareReuse: reuseBySignature,
        __scriareUIStore: uiStore.useUIStore,
        // v0.86.0 — the save-failed question, so a spec can answer it and so
        // the crash-exposure spec can prove it leaves nothing standing.
        __scriareSaveFailedPrompt: saveFailedPrompt.useSaveFailedPromptStore,
        // v0.88.0 — the opening share, so the ceiling he set can be asked of
        // the function rather than inferred from a screenshot.
        __scriareSplit: editorGraphSplit,
        // v0.43.0 — the layout rules are pure arithmetic, so the specs that
        // cover them build graphs and read the geometry back rather than
        // measuring a picture of one.
        __scriareAutoLayout: { ...autoLayout, ...autoLayoutGraph },
        // v0.73.0 — the anchor model and the router. Both are pure
        // functions over boxes and links, so the specs hand them a story's
        // geometry and read the paths back, rather than measuring a picture
        // of a graph and hoping the pixels mean what they look like.
        __scriareWires: { ...wireAnchors, ...wireRouter },
        // v0.44.0 — the theme list and the store that applies one, so the
        // themes spec can walk every theme rather than trusting a copy of
        // the list kept in the test.
        __scriareThemes: themeStore,
        // v0.48.0 — export. The whole pipeline is pure functions over a
        // project, so the specs build a story, run the real exporter and
        // assert on the page it produced, rather than driving a save
        // dialog a headless run cannot open.
        __scriareExport: { ...buildStory, ...pageTemplate, ...contrastCheck, ...readingThemes },
        __scriareStylesheetNotes: stylesheetNotes,
        __scriareBoxLayer: choiceBoxLayer,
        __scriareBlocks: narrativeBlocks,
        __scriareFaq: faq,
        __scriareSurfaces: surfaces,
        // v0.53.0 — the Welcome screen's cached story shape. Pure functions
        // over a project, so the spec builds a story, runs the real builder
        // and measures the bytes it produced.
        __scriareRecentShape: recentShape,
        // ...and the rules the main process applies to the record it is
        // stored in, so the spec can assert on those without writing to
        // the writer’s own recent-projects.json.
        __scriareRecentEntries: recentEntries,
        // v0.57.0 — which reading ground Play Mode is on. Exposed so the
        // spec can drive the switch from the store as well as from the
        // button, and assert that the two agree.
        __scriarePlayGround: playGroundStore.usePlayGroundStore,
        // v0.61.0 — the rule that reads a command line and finds the story
        // in it, shared with the main process so the spec drives the same
        // one the app runs.
        __scriareFileArgs: fileArgs,
        // v0.88.6 — the languages a story can say it is written in. The
        // spellcheck spec walks all of them and asserts none of them can
        // end up checked against another language's dictionary, so it has
        // to walk the REAL list: a copy of it in the spec would be a copy
        // that stops matching the day somebody adds a twentieth.
        __scriareLanguages: languages,
      });
    },
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
