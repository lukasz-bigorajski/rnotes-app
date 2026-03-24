import { useState, useRef } from "react";
import { AppShell } from "@mantine/core";
import { useDisclosure, useHotkeys } from "@mantine/hooks";
import { Sidebar } from "./components/Sidebar";
import { ContentArea } from "./components/ContentArea";
import { TaskOverview } from "./components/TaskOverview";
import { GlobalSearch } from "./components/GlobalSearch";
import { KeyboardShortcutsDialog } from "./components/KeyboardShortcutsDialog";

type ActiveView = "editor" | "tasks";

export default function App() {
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [opened] = useDisclosure(true);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>("editor");
  const sidebarRefreshRef = useRef<(() => void) | null>(null);
  const createNoteRef = useRef<(() => void) | null>(null);
  const createFolderRef = useRef<(() => void) | null>(null);
  const forceSaveRef = useRef<(() => void) | null>(null);
  const [globalSearchOpened, setGlobalSearchOpened] = useState(false);
  const [shortcutsDialogOpened, setShortcutsDialogOpened] = useState(false);

  useHotkeys([
    ["mod+K", () => setGlobalSearchOpened(true)],
    ["ctrl+K", () => setGlobalSearchOpened(true)],
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
      <GlobalSearch
        opened={globalSearchOpened}
        onClose={() => setGlobalSearchOpened(false)}
        onSelectNote={handleGlobalSearchSelect}
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
              activeNoteId={activeNoteId}
              setActiveNoteId={handleSetActiveNoteId}
              refreshRef={sidebarRefreshRef}
              createNoteRef={createNoteRef}
              createFolderRef={createFolderRef}
              onShowTaskOverview={handleShowTaskOverview}
              onOpenGlobalSearch={() => setGlobalSearchOpened(true)}
              onOpenShortcutsDialog={() => setShortcutsDialogOpened(true)}
            />
          </AppShell.Navbar>
        )}

        <AppShell.Main style={{ display: "flex", flexDirection: "column", overflow: "hidden", height: "100dvh" }}>
          {activeView === "tasks" ? (
            <TaskOverview onNavigateToNote={handleNavigateToNote} />
          ) : (
            <ContentArea
              activeNoteId={activeNoteId}
              onNotesChanged={handleNotesChanged}
              forceSaveRef={forceSaveRef}
            />
          )}
        </AppShell.Main>
      </AppShell>
    </>
  );
}
