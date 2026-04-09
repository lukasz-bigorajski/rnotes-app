import { useState, useEffect, useRef, useMemo } from "react";
import type { MutableRefObject } from "react";
import { Stack, Text, Group, TextInput, ActionIcon, Menu } from "@mantine/core";
import {
  IconPlus,
  IconFolder,
  IconChecklist,
  IconSearch,
  IconKeyboard,
  IconSettings,
  IconNote,
  IconArchive,
  IconNotes,
} from "@tabler/icons-react";
import { createNote, listNotes } from "../ipc/notes";
import type { NoteRow } from "../ipc/notes";
import { notifyError } from "../utils/notify";
import { DraggableTree } from "./sidebar/DraggableTree";
import { ArchivePanel } from "./sidebar/ArchivePanel";

type SidebarTab = "notes" | "tasks" | "archive";

interface SidebarProps {
  activeNoteId: string | null;
  setActiveNoteId: (id: string | null) => void;
  refreshRef?: MutableRefObject<(() => void) | null>;
  createNoteRef?: MutableRefObject<(() => void) | null>;
  createFolderRef?: MutableRefObject<(() => void) | null>;
  onShowTaskOverview?: () => void;
  onShowNotes?: () => void;
  onOpenGlobalSearch?: () => void;
  onOpenShortcutsDialog?: () => void;
  onShowSettings?: () => void;
}

export function Sidebar({
  activeNoteId,
  setActiveNoteId,
  refreshRef,
  createNoteRef,
  createFolderRef,
  onShowTaskOverview,
  onShowNotes,
  onOpenGlobalSearch,
  onOpenShortcutsDialog,
  onShowSettings,
}: SidebarProps) {
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [activeTab, setActiveTab] = useState<SidebarTab>("notes");
  const [archivedCount, setArchivedCount] = useState(0);

  const loadNotes = () => {
    listNotes().then(setNotes).catch(console.error);
  };

  const loadArchivedCount = async () => {
    try {
      const allNotes = await listNotes(true);
      const deleted = allNotes.filter((n) => n.deleted_at !== null);
      setArchivedCount(deleted.length);
    } catch (err) {
      console.error("Failed to load archived count:", err);
    }
  };

  // Expose loadNotes via refreshRef so parent can trigger sidebar refresh
  const loadNotesRef = useRef(loadNotes);
  loadNotesRef.current = loadNotes;

  useEffect(() => {
    if (refreshRef) {
      refreshRef.current = () => loadNotesRef.current();
    }
  }, [refreshRef]);

  useEffect(() => {
    loadNotes();
    loadArchivedCount();
  }, []);

  const handleCreateNote = async () => {
    try {
      const note = await createNote({ title: "Untitled", isFolder: false });
      loadNotes();
      setActiveNoteId(note.id);
    } catch (err) {
      console.error("Failed to create note:", err);
      notifyError("Create failed", "Could not create the note");
    }
  };

  const handleCreateFolder = async () => {
    try {
      await createNote({ title: "Untitled Folder", isFolder: true });
      loadNotes();
    } catch (err) {
      console.error("Failed to create folder:", err);
      notifyError("Create failed", "Could not create the folder");
    }
  };

  // Expose create handlers via refs so hotkeys in App.tsx can call them
  const handleCreateNoteRef = useRef(handleCreateNote);
  handleCreateNoteRef.current = handleCreateNote;

  const handleCreateFolderRef = useRef(handleCreateFolder);
  handleCreateFolderRef.current = handleCreateFolder;

  useEffect(() => {
    if (createNoteRef) {
      createNoteRef.current = () => handleCreateNoteRef.current();
    }
  }, [createNoteRef]);

  useEffect(() => {
    if (createFolderRef) {
      createFolderRef.current = () => handleCreateFolderRef.current();
    }
  }, [createFolderRef]);

  const handleNoteRestored = () => {
    loadNotes();
    loadArchivedCount();
    setActiveTab("notes");
  };

  const handleTabChange = (tab: SidebarTab) => {
    setActiveTab(tab);
    if (tab === "tasks") {
      onShowTaskOverview?.();
    } else if (tab === "notes") {
      onShowNotes?.();
    }
  };

  // Filter out deleted notes for tree display.
  const visibleNotes = useMemo(() => notes.filter((n) => !n.deleted_at), [notes]);

  return (
    <Stack gap="sm" h="100%" justify="space-between">
      <Stack gap="sm" style={{ flex: 1, overflow: "auto" }}>
        {activeTab === "notes" && (
          <>
            <Group gap="xs">
              <TextInput
                placeholder="Search notes..."
                leftSection={<IconSearch size={14} />}
                size="xs"
                style={{ flex: 1, cursor: "pointer" }}
                readOnly
                onClick={onOpenGlobalSearch}
                onFocus={(e) => {
                  e.target.blur();
                  onOpenGlobalSearch?.();
                }}
                data-testid="open-global-search-btn"
              />
              <Menu position="bottom-end" withinPortal>
                <Menu.Target>
                  <ActionIcon
                    variant="default"
                    size="input-xs"
                    aria-label="Create new"
                    data-testid="create-new-btn"
                  >
                    <IconPlus size={16} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item
                    leftSection={<IconNote size={14} />}
                    onClick={handleCreateNote}
                    data-testid="create-note-btn"
                  >
                    New Note
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<IconFolder size={14} />}
                    onClick={handleCreateFolder}
                    data-testid="create-folder-btn"
                  >
                    New Folder
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>

            {visibleNotes.length === 0 ? (
              <Text c="dimmed" ta="center" mt="xl">
                No notes yet. Create one to get started.
              </Text>
            ) : (
              <DraggableTree
                notes={visibleNotes}
                activeNoteId={activeNoteId}
                setActiveNoteId={setActiveNoteId}
                onNotesChanged={() => {
                  loadNotes();
                  loadArchivedCount();
                }}
              />
            )}
          </>
        )}

        {activeTab === "archive" && (
          <ArchivePanel onNoteRestored={handleNoteRestored} />
        )}
      </Stack>

      <Stack gap={4}>
        <Group justify="center" gap="xs">
          <ActionIcon
            variant={activeTab === "notes" ? "light" : "subtle"}
            size="lg"
            title="Notes"
            aria-label="Notes"
            onClick={() => handleTabChange("notes")}
          >
            <IconNotes size={18} />
          </ActionIcon>
          <ActionIcon
            variant={activeTab === "tasks" ? "light" : "subtle"}
            size="lg"
            title="Tasks"
            aria-label="Task Overview"
            onClick={() => handleTabChange("tasks")}
            data-testid="task-overview-btn"
          >
            <IconChecklist size={18} />
          </ActionIcon>
          <ActionIcon
            variant={activeTab === "archive" ? "light" : "subtle"}
            size="lg"
            title={`Archive${archivedCount > 0 ? ` (${archivedCount})` : ""}`}
            aria-label="Archive"
            onClick={() => handleTabChange("archive")}
            style={{ position: "relative" }}
          >
            <IconArchive size={18} />
            {archivedCount > 0 && (
              <Text
                size="8px"
                fw={700}
                c="blue"
                style={{ position: "absolute", top: 2, right: 2 }}
              >
                {archivedCount}
              </Text>
            )}
          </ActionIcon>
          <div style={{ flex: 1 }} />
          {onOpenShortcutsDialog && (
            <ActionIcon
              variant="subtle"
              size="sm"
              title="Keyboard shortcuts (Cmd+/)"
              aria-label="Open keyboard shortcuts"
              onClick={onOpenShortcutsDialog}
              data-testid="open-shortcuts-btn"
            >
              <IconKeyboard size={16} />
            </ActionIcon>
          )}
          {onShowSettings && (
            <ActionIcon
              variant="subtle"
              size="sm"
              title="Settings"
              aria-label="Open settings"
              onClick={onShowSettings}
              data-testid="open-settings-btn"
            >
              <IconSettings size={16} />
            </ActionIcon>
          )}
        </Group>
      </Stack>
    </Stack>
  );
}
