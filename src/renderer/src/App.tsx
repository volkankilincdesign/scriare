import { useState } from "react";
import { TopBar } from "./components/layout/TopBar";
import { ContentBrowser } from "./components/layout/ContentBrowser";
import { InspectorPanel } from "./components/layout/InspectorPanel";
import { EditorGraphSplit } from "./components/layout/EditorGraphSplit";
import { WelcomeScreen } from "./components/welcome/WelcomeScreen";
import { PlayRuntime } from "./runtime/PlayRuntime";
import { ConfirmDialogHost } from "./components/common/ConfirmDialogHost";
import { useProjectStore } from "./state/projectStore";
import { useKeyboardSave } from "./hooks/useKeyboardSave";

export default function App() {
  const project = useProjectStore((s) => s.project);
  const isPlaying = useProjectStore((s) => s.isPlaying);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [flowCollapsed, setFlowCollapsed] = useState(false);

  useKeyboardSave();

  if (!project) {
    return (
      <>
        <WelcomeScreen />
        <ConfirmDialogHost />
      </>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-zinc-900 text-zinc-200">
      <ConfirmDialogHost />
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        {!isPlaying && <ContentBrowser />}

        {/* The editor + graph column stays mounted even in Play Mode (just
            hidden via CSS) so the Tiptap instance, undo history, and scroll
            position survive untouched — Exit Play returns to exactly where
            writing was left off, with no data loss. */}
        <div className="relative flex flex-1 flex-col overflow-hidden">
          <div className={isPlaying ? "hidden" : "flex flex-1 flex-col overflow-hidden"}>
            <EditorGraphSplit
              flowCollapsed={flowCollapsed}
              onToggleFlow={() => setFlowCollapsed((v) => !v)}
            />
          </div>

          {isPlaying && <PlayRuntime />}
        </div>

        {!isPlaying && (
          <InspectorPanel
            collapsed={inspectorCollapsed}
            onToggle={() => setInspectorCollapsed((v) => !v)}
          />
        )}
      </div>
    </div>
  );
}
