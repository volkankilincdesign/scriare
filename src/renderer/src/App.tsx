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

// Dockable-panel state (Content, Scene Details, and the Flow graph) is a
// personal layout preference, not story data — same reasoning as the
// editor/graph split height and the Content tree's expand/collapse state,
// which already live in localStorage. Persisting it here means a writer who
// collapses everything to go distraction-free stays in that layout the next
// time they open the project, instead of it resetting on every launch.
const PANEL_STORAGE_KEY = "scriare:panelCollapsed";

interface PanelCollapseState {
  content: boolean;
  inspector: boolean;
  flow: boolean;
}

const DEFAULT_PANEL_STATE: PanelCollapseState = {
  content: false,
  inspector: false,
  flow: false,
};

function loadPanelState(): PanelCollapseState {
  try {
    const raw = window.localStorage.getItem(PANEL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        content: Boolean(parsed.content),
        inspector: Boolean(parsed.inspector),
        flow: Boolean(parsed.flow),
      };
    }
  } catch {
    // localStorage can be unavailable in rare embedding scenarios — fall
    // back to the default (everything docked/expanded) rather than
    // breaking the layout.
  }
  return DEFAULT_PANEL_STATE;
}

function savePanelState(state: PanelCollapseState): void {
  try {
    window.localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Best-effort persistence only.
  }
}

export default function App() {
  const project = useProjectStore((s) => s.project);
  const isPlaying = useProjectStore((s) => s.isPlaying);
  const [panels, setPanels] = useState<PanelCollapseState>(loadPanelState);

  function togglePanel(key: keyof PanelCollapseState): void {
    setPanels((current) => {
      const next = { ...current, [key]: !current[key] };
      savePanelState(next);
      return next;
    });
  }

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
    <div className="flex h-screen w-screen flex-col bg-[var(--bg)] text-[var(--text)]">
      <ConfirmDialogHost />
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        {!isPlaying && (
          <ContentBrowser
            collapsed={panels.content}
            onToggle={() => togglePanel("content")}
          />
        )}

        {/* The editor + graph column stays mounted even in Play Mode (just
            hidden via CSS) so the Tiptap instance, undo history, and scroll
            position survive untouched — Exit Play returns to exactly where
            writing was left off, with no data loss. */}
        <div className="relative flex flex-1 flex-col overflow-hidden">
          <div className={isPlaying ? "hidden" : "flex flex-1 flex-col overflow-hidden"}>
            <EditorGraphSplit
              flowCollapsed={panels.flow}
              onToggleFlow={() => togglePanel("flow")}
            />
          </div>

          {isPlaying && <PlayRuntime />}
        </div>

        {!isPlaying && (
          <InspectorPanel
            collapsed={panels.inspector}
            onToggle={() => togglePanel("inspector")}
          />
        )}
      </div>
    </div>
  );
}
