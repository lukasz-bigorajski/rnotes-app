import { useState, useRef, useEffect } from "react";
import { AppShell, ActionIcon } from "@mantine/core";
import { useDisclosure, useHotkeys } from "@mantine/hooks";
import { IconLayoutSidebarLeftExpand } from "@tabler/icons-react";
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
import { useUpdater } from "./hooks/useUpdater";

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
  const flushTitleSaveRef = useRef<(() => void) | null>(null);
  const refreshActiveNoteRef = useRef<(() => void) | null>(null);
  const [globalSearchOpened, setGlobalSearchOpened] = useState(false);
  const [globalSearchTitleOnly, setGlobalSearchTitleOnly] = useState(false);
  const [globalFindReplaceOpened, setGlobalFindReplaceOpened] = useState(false);
  const [shortcutsDialogOpened, setShortcutsDialogOpened] = useState(false);
  const [pendingSearchQuery, setPendingSearchQuery] = useState<string | null>(null);
  const focusSidebarRef = useRef<(() => void) | null>(null);
  const focusEditorRef = useRef<(() => void) | null>(null);

  const [sidebarWidth, setSidebarWidth] = useState(
    () => Number(localStorage.getItem("sidebarWidth")) || 260,
  );
  const isResizingRef = useRef(false);
  const sidebarWidthRef = useRef(sidebarWidth);
  const [dragHandleHovered, setDragHandleHovered] = useState(false);

  useUpdater();

  useEffect(() => {
    getAppHealth()
      .then((health) => setAppHealth(health))
      .catch(() => {
        // If we can't get health, assume ok (app loaded normally).
      });
  }, []);

  // Keep ref in sync with state so the mouseup handler can read the latest width.
  useEffect(() => {
    sidebarWidthRef.current = sidebarWidth;
  }, [sidebarWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newWidth = Math.min(480, Math.max(160, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (!isResizingRef.current) return;
      isResizingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      localStorage.setItem("sidebarWidth", String(sidebarWidthRef.current));
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleDragHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const handleRecovered = () => {
    setAppHealth("recovered");
    // Bump key to force sidebar/content to re-fetch notes from the restored DB.
    setRecoveryKey((k) => k + 1);
  };

  useHotkeys(
    [
      ["mod+K", () => { setGlobalSearchTitleOnly(false); setGlobalSearchOpened(true); }],
      ["ctrl+K", () => { setGlobalSearchTitleOnly(false); setGlobalSearchOpened(true); }],
      ["mod+shift+F", () => { setGlobalSearchTitleOnly(false); setGlobalSearchOpened(true); }],
      ["mod+shift+N", () => { setGlobalSearchTitleOnly(true); setGlobalSearchOpened(true); }],
      ["mod+alt+N", () => createFolderRef.current?.()],
      ["mod+shift+R", () => setGlobalFindReplaceOpened(true)],
      ["mod+/", () => setShortcutsDialogOpened(true)],
      ["mod+N", () => createNoteRef.current?.()],
      ["mod+S", () => forceSaveRef.current?.()],
      ["mod+\\", () => setSidebarVisible((v) => !v)],
      ["mod+shift+T", () => handleShowTaskOverview()],
      ["mod+1", () => focusSidebarRef.current?.()],
    ],
    ["INPUT", "TEXTAREA", "SELECT"],
    true,
  );

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
    flushTitleSaveRef.current?.();
    forceSaveRef.current?.();
    setActiveNoteId(null);
    setActiveView("tasks");
  };

  const handleShowNotes = () => {
    setActiveView("editor");
  };

  const handleShowSettings = () => {
    setActiveNoteId(null);
    setActiveView("settings");
  };

  const handleNavigateToNote = (noteId: string) => {
    setActiveNoteId(noteId);
    setActiveView("editor");
  };

  const handleGlobalSearchSelect = (noteId: string, query: string) => {
    setPendingSearchQuery(query || null);
    handleSetActiveNoteId(noteId);
    setGlobalSearchOpened(false);
    setTimeout(() => focusEditorRef.current?.(), 150);
  };

  return (
    <>
      <RecoveryDialog health={appHealth} onRecovered={handleRecovered} />
      <GlobalSearch
        opened={globalSearchOpened}
        onClose={() => setGlobalSearchOpened(false)}
        onSelectNote={handleGlobalSearchSelect}
        titleOnly={globalSearchTitleOnly}
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
          width: { base: sidebarWidth },
          breakpoint: "sm",
          collapsed: { mobile: !opened, desktop: !sidebarVisible || activeView === "tasks" },
        }}
        padding={0}
      >
        {sidebarVisible && activeView !== "tasks" && (
          <AppShell.Navbar p="sm" style={{ position: "relative", overflow: "visible" }}>
            <Sidebar
              key={recoveryKey}
              activeNoteId={activeNoteId}
              setActiveNoteId={handleSetActiveNoteId}
              refreshRef={sidebarRefreshRef}
              createNoteRef={createNoteRef}
              createFolderRef={createFolderRef}
              focusSidebarRef={focusSidebarRef}
              focusEditorRef={focusEditorRef}
              onShowTaskOverview={handleShowTaskOverview}
              onShowNotes={handleShowNotes}
              onOpenGlobalSearch={() => setGlobalSearchOpened(true)}
              onOpenShortcutsDialog={() => setShortcutsDialogOpened(true)}
              onShowSettings={handleShowSettings}
              refreshActiveNoteRef={refreshActiveNoteRef}
              onToggleSidebar={() => setSidebarVisible((v) => !v)}
            />
            <div
              onMouseDown={handleDragHandleMouseDown}
              onMouseEnter={() => setDragHandleHovered(true)}
              onMouseLeave={() => setDragHandleHovered(false)}
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: 5,
                height: "100%",
                cursor: "col-resize",
                background: dragHandleHovered ? "var(--mantine-color-gray-3)" : "transparent",
                transition: "background 0.15s",
                zIndex: 200,
              }}
            />
          </AppShell.Navbar>
        )}

        <AppShell.Main style={{ display: "flex", flexDirection: "column", overflow: "hidden", height: "100dvh", position: "relative" }}>
          {!sidebarVisible && activeView !== "tasks" && (
            <ActionIcon
              variant="subtle"
              size="sm"
              title="Expand sidebar (Cmd+\)"
              aria-label="Expand sidebar"
              onClick={() => setSidebarVisible((v) => !v)}
              style={{ position: "absolute", top: 8, left: 8, zIndex: 100 }}
              data-testid="expand-sidebar-btn"
            >
              <IconLayoutSidebarLeftExpand size={16} />
            </ActionIcon>
          )}
          {activeView === "tasks" ? (
            <TaskOverview
              onNavigateToNote={handleNavigateToNote}
              onBack={handleShowNotes}
              activeNoteId={activeNoteId}
              onNoteContentChanged={(_noteId) => {
                // The editor is not mounted while the Tasks view is active (activeNoteId is null).
                // When the user navigates back to the note it will re-fetch from DB automatically.
                // This callback is a hook for future side-by-side layouts.
              }}
            />
          ) : activeView === "settings" ? (
            <Settings />
          ) : (
            <ContentArea
              activeNoteId={activeNoteId}
              onNotesChanged={handleNotesChanged}
              forceSaveRef={forceSaveRef}
              flushTitleSaveRef={flushTitleSaveRef}
              refreshActiveNoteRef={refreshActiveNoteRef}
              focusEditorRef={focusEditorRef}
              onNavigateToNote={handleNavigateToNote}
              initialFindQuery={pendingSearchQuery}
              onInitialFindQueryConsumed={() => setPendingSearchQuery(null)}
              onOpenGlobalSearch={() => { setGlobalSearchTitleOnly(true); setGlobalSearchOpened(true); }}
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
