import { useState } from "react";
import { Stack, Text, Button, Group, NavLink } from "@mantine/core";
import { IconPlus, IconFolder, IconNote } from "@tabler/icons-react";
import { createNote, listNotes } from "../ipc/notes";
import type { NoteRow } from "../ipc/notes";
import { useEffect } from "react";

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

  const noteList = notes.filter((n) => !n.is_folder && !n.deleted_at);

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
          <Button variant="subtle" size="compact-sm" leftSection={<IconFolder size={14} />}>
            Folder
          </Button>
        </Group>
      </Group>

      {noteList.length === 0 ? (
        <Text c="dimmed" ta="center" mt="xl">
          No notes yet. Create one to get started.
        </Text>
      ) : (
        <Stack gap={2}>
          {noteList.map((note) => (
            <NavLink
              key={note.id}
              label={note.title}
              leftSection={<IconNote size={16} />}
              active={note.id === activeNoteId}
              onClick={() => setActiveNoteId(note.id)}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
