import { useState, useRef } from "react";
import { AppShell } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Sidebar } from "./components/Sidebar";
import { ContentArea } from "./components/ContentArea";
import { TaskOverview } from "./components/TaskOverview";

type ActiveView = "editor" | "tasks";

export default function App() {
  const [opened] = useDisclosure(true);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>("editor");
  const sidebarRefreshRef = useRef<(() => void) | null>(null);

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

  return (
    <AppShell
      navbar={{
        width: 280,
        breakpoint: "sm",
        collapsed: { mobile: !opened },
      }}
      padding={0}
    >
      <AppShell.Navbar p="sm">
        <Sidebar
          activeNoteId={activeNoteId}
          setActiveNoteId={handleSetActiveNoteId}
          refreshRef={sidebarRefreshRef}
          onShowTaskOverview={handleShowTaskOverview}
        />
      </AppShell.Navbar>

      <AppShell.Main style={{ display: "flex", flexDirection: "column", overflow: "hidden", height: "100dvh" }}>
        {activeView === "tasks" ? (
          <TaskOverview onNavigateToNote={handleNavigateToNote} />
        ) : (
          <ContentArea activeNoteId={activeNoteId} onNotesChanged={handleNotesChanged} />
        )}
      </AppShell.Main>
    </AppShell>
  );
}
