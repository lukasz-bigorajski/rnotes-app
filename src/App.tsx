import { useState, useRef } from "react";
import { AppShell } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Sidebar } from "./components/Sidebar";
import { ContentArea } from "./components/ContentArea";

export default function App() {
  const [opened] = useDisclosure(true);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const sidebarRefreshRef = useRef<(() => void) | null>(null);

  const handleNotesChanged = () => {
    sidebarRefreshRef.current?.();
  };

  return (
    <AppShell
      navbar={{
        width: 280,
        breakpoint: "sm",
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Navbar p="sm">
        <Sidebar
          activeNoteId={activeNoteId}
          setActiveNoteId={setActiveNoteId}
          refreshRef={sidebarRefreshRef}
        />
      </AppShell.Navbar>

      <AppShell.Main>
        <ContentArea activeNoteId={activeNoteId} onNotesChanged={handleNotesChanged} />
      </AppShell.Main>
    </AppShell>
  );
}
