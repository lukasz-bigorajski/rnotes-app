import { useState } from "react";
import { Stack, Text, Button, Group } from "@mantine/core";
import { IconPlus, IconFolder } from "@tabler/icons-react";
import { createNote, listNotes } from "../ipc/notes";
import type { NoteRow } from "../ipc/notes";
import { useEffect } from "react";
import { NoteTree } from "./sidebar/NoteTree";

interface SidebarProps {
  activeNoteId: string | null;
  setActiveNoteId: (id: string | null) => void;
}

export function Sidebar({ activeNoteId, setActiveNoteId }: SidebarProps) {
  const [notes, setNotes] = useState<NoteRow[]>([]);

  const loadNotes = () => {
    listNotes().then(setNotes).catch(console.error);
  };

  useEffect(() => {
    loadNotes();
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

  // Filter out deleted notes for tree display
  const visibleNotes = notes.filter((n) => !n.deleted_at);

  return (
    <Stack gap="sm" h="100%">
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
        <NoteTree
          notes={visibleNotes}
          activeNoteId={activeNoteId}
          setActiveNoteId={setActiveNoteId}
          onNotesChanged={loadNotes}
        />
      )}
    </Stack>
  );
}
