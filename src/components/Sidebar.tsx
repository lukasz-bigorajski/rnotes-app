import { useState } from "react";
import { Stack, Text, Button, Group } from "@mantine/core";
import { IconPlus, IconFolder } from "@tabler/icons-react";
import { createNote, listNotes } from "../ipc/notes";
import type { NoteRow } from "../ipc/notes";
import { useEffect } from "react";
import { DraggableTree } from "./sidebar/DraggableTree";
import { ArchivePanel } from "./sidebar/ArchivePanel";
import { ArchiveToggle } from "./sidebar/ArchiveToggle";

interface SidebarProps {
  activeNoteId: string | null;
  setActiveNoteId: (id: string | null) => void;
}

export function Sidebar({ activeNoteId, setActiveNoteId }: SidebarProps) {
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
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
    }
  };

  const handleCreateFolder = async () => {
    try {
      await createNote({ title: "Untitled Folder", isFolder: true });
      loadNotes();
    } catch (err) {
      console.error("Failed to create folder:", err);
    }
  };

  const handleNoteRestored = () => {
    loadNotes();
    loadArchivedCount();
    setIsArchiveOpen(false);
  };

  // Filter out deleted notes for tree display
  const visibleNotes = notes.filter((n) => !n.deleted_at);

  return (
    <Stack gap="sm" h="100%" justify="space-between">
      <Stack gap="sm" style={{ flex: 1, overflow: "auto" }}>
        {!isArchiveOpen && (
          <>
            <Group justify="space-between">
              <Text fw={700} size="lg">
                Notes
              </Text>
              <Group gap="xs">
                <Button
                  variant="subtle"
                  size="compact-sm"
                  leftSection={<IconPlus size={14} />}
                  onClick={handleCreateNote}
                >
                  Note
                </Button>
                <Button
                  variant="subtle"
                  size="compact-sm"
                  leftSection={<IconFolder size={14} />}
                  onClick={handleCreateFolder}
                >
                  Folder
                </Button>
              </Group>
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

        {isArchiveOpen && (
          <ArchivePanel onNoteRestored={handleNoteRestored} />
        )}
      </Stack>

      <ArchiveToggle
        isArchiveOpen={isArchiveOpen}
        setIsArchiveOpen={setIsArchiveOpen}
        archivedCount={archivedCount}
      />
    </Stack>
  );
}
