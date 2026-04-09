import { useState, useRef, useEffect } from "react";
import { AppShell } from "@mantine/core";
import { useDisclosure, useHotkeys } from "@mantine/hooks";
import { Sidebar } from "./components/Sidebar";
import { ContentArea } from "./components/ContentArea";
import { TaskOverview } from "./components/TaskOverview";
import { Settings } from "./components/Settings";
import { GlobalSearch } from "./components/GlobalSearch";
import { GlobalFindReplace } from "./components/GlobalFindReplace";
import { KeyboardShortcutsDialog } from "./components/KeyboardShortcutsDialog";
import { RecoveryDialog } from "./components/RecoveryDialog";
import { UserConfigProvider } from "./context/UserConfigContext";
import { type AppHealth, getAppHealth } from "./ipc/backup";

type ActiveView = "editor" | "tasks" | "settings";

function AppInner() {
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [opened] = useDisclosure(true);
  const [appHealth, setAppHealth] = useState<AppHealth>("ok");
  const [recoveryKey, setRecoveryKey] = useState(0);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>("editor");
  const sidebarRefreshRef = useRef<(() => void) | null>(null);
  const createNoteRef = useRef<(() => void) | null>(null);
  const createFolderRef = useRef<(() => void) | null>(null);
  const forceSaveRef = useRef<(() => void) | null>(null);
  const [globalSearchOpened, setGlobalSearchOpened] = useState(false);
  const [globalFindReplaceOpened, setGlobalFindReplaceOpened] = useState(false);
  const [shortcutsDialogOpened, setShortcutsDialogOpened] = useState(false);

  useEffect(() => {
    getAppHealth()
      .then((health) => setAppHealth(health))
      .catch(() => {
        // If we can't get health, assume ok (app loaded normally).
      });
  }, []);

  const handleRecovered = () => {
    setAppHealth("recovered");
    // Bump key to force sidebar/content to re-fetch notes from the restored DB.
    setRecoveryKey((k) => k + 1);
  };

  useHotkeys([
    ["mod+K", () => setGlobalSearchOpened(true)],
    ["ctrl+K", () => setGlobalSearchOpened(true)],
    ["mod+shift+F", () => setGlobalSearchOpened(true)],
    ["mod+shift+R", () => setGlobalFindReplaceOpened(true)],
    ["mod+/", () => setShortcutsDialogOpened(true)],
    ["mod+N", () => createNoteRef.current?.()],
    ["mod+shift+N", () => createFolderRef.current?.()],
    ["mod+S", () => forceSaveRef.current?.()],
    ["mod+\\", () => setSidebarVisible((v) => !v)],
    ["mod+shift+T", () => handleShowTaskOverview()],
  ]);

  const handleNotesChanged = () => {
    sidebarRefreshRef.current?.();
  };

  const handleSetActiveNoteId = (id: string | null) => {
    setActiveNoteId(id);
    if (id !== null) {
      setActiveView("editor");
    }
  };

  const handleShowTaskOverview = () => {
    setActiveNoteId(null);
    setActiveView("tasks");
  };

  const handleShowSettings = () => {
    setActiveNoteId(null);
    setActiveView("settings");
  };

  const handleNavigateToNote = (noteId: string) => {
    setActiveNoteId(noteId);
    setActiveView("editor");
  };

  const handleGlobalSearchSelect = (noteId: string) => {
    handleSetActiveNoteId(noteId);
    setGlobalSearchOpened(false);
  };

  return (
    <>
      <RecoveryDialog health={appHealth} onRecovered={handleRecovered} />
      <GlobalSearch
        opened={globalSearchOpened}
        onClose={() => setGlobalSearchOpened(false)}
        onSelectNote={handleGlobalSearchSelect}
      />
      <GlobalFindReplace
        opened={globalFindReplaceOpened}
        onClose={() => setGlobalFindReplaceOpened(false)}
      />
      <KeyboardShortcutsDialog
        opened={shortcutsDialogOpened}
        onClose={() => setShortcutsDialogOpened(false)}
      />
      <AppShell
        navbar={{
          width: 280,
          breakpoint: "sm",
          collapsed: { mobile: !opened, desktop: !sidebarVisible },
        }}
        padding={0}
      >
        {sidebarVisible && (
          <AppShell.Navbar p="sm">
            <Sidebar
              key={recoveryKey}
              activeNoteId={activeNoteId}
              setActiveNoteId={handleSetActiveNoteId}
              refreshRef={sidebarRefreshRef}
              createNoteRef={createNoteRef}
              createFolderRef={createFolderRef}
              onShowTaskOverview={handleShowTaskOverview}
              onOpenGlobalSearch={() => setGlobalSearchOpened(true)}
              onOpenShortcutsDialog={() => setShortcutsDialogOpened(true)}
              onShowSettings={handleShowSettings}
            />
          </AppShell.Navbar>
        )}

        <AppShell.Main style={{ display: "flex", flexDirection: "column", overflow: "hidden", height: "100dvh" }}>
          {activeView === "tasks" ? (
            <TaskOverview onNavigateToNote={handleNavigateToNote} />
          ) : activeView === "settings" ? (
            <Settings />
          ) : (
            <ContentArea
              activeNoteId={activeNoteId}
              onNotesChanged={handleNotesChanged}
              forceSaveRef={forceSaveRef}
              onNavigateToNote={handleNavigateToNote}
            />
          )}
        </AppShell.Main>
      </AppShell>
    </>
  );
}

export default function App() {
  return (
    <UserConfigProvider>
      <AppInner />
    </UserConfigProvider>
  );
}
