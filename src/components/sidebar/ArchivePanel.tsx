import { useState, useEffect } from "react";
import { Stack, Text, Group, Button } from "@mantine/core";
import { IconRestore, IconArchive } from "@tabler/icons-react";
import { listNotes, restoreNote } from "../../ipc/notes";
import type { NoteRow } from "../../ipc/notes";

interface ArchivePanelProps {
  onNoteRestored: () => void;
}

export function ArchivePanel({ onNoteRestored }: ArchivePanelProps) {
  const [archivedNotes, setArchivedNotes] = useState<NoteRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);

  const loadArchivedNotes = async () => {
    setIsLoading(true);
    try {
      const allNotes = await listNotes(true);
      const deleted = allNotes.filter((n) => n.deleted_at !== null);
      setArchivedNotes(deleted);
    } catch (err) {
      console.error("Failed to load archived notes:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadArchivedNotes();
  }, []);

  const handleRestore = async (noteId: string) => {
    setRestoring(noteId);
    try {
      await restoreNote(noteId);
      await loadArchivedNotes();
      onNoteRestored();
    } catch (err) {
      console.error("Failed to restore note:", err);
    } finally {
      setRestoring(null);
    }
  };

  const formatDeletedTime = (deletedAtMs: number): string => {
    const now = Date.now();
    const diffMs = now - deletedAtMs;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return `Deleted ${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
      }
      return `Deleted ${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
    }

    if (diffDays === 1) {
      return "Deleted yesterday";
    }

    return `Deleted ${diffDays} days ago`;
  };

  if (isLoading) {
    return (
      <Stack gap="sm" h="100%">
        <Text c="dimmed">Loading archive...</Text>
      </Stack>
    );
  }

  if (archivedNotes.length === 0) {
    return (
      <Stack gap="sm" h="100%" align="center" justify="center">
        <IconArchive size={48} opacity={0.5} />
        <Stack gap={2} align="center">
          <Text fw={500}>No archived notes</Text>
          <Text size="sm" c="dimmed">
            Deleted notes will appear here
          </Text>
        </Stack>
      </Stack>
    );
  }

  return (
    <Stack gap="xs" h="100%">
      <Text fw={500} size="sm" c="dimmed">
        {archivedNotes.length} archived {archivedNotes.length === 1 ? "note" : "notes"}
      </Text>
      <Stack gap="xs" style={{ overflow: "auto", flex: 1 }}>
        {archivedNotes.map((note) => (
          <Group
            key={note.id}
            justify="space-between"
            p="xs"
            style={{
              borderRadius: "var(--mantine-radius-sm)",
              backgroundColor: "var(--mantine-color-gray-1)",
              border: "1px solid var(--mantine-color-gray-2)",
            }}
          >
            <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
              <Text size="sm" fw={500} truncate>
                {note.title}
              </Text>
              <Text size="xs" c="dimmed">
                {note.deleted_at && formatDeletedTime(note.deleted_at)}
              </Text>
            </Stack>
            <Button
              size="compact-xs"
              variant="light"
              leftSection={<IconRestore size={12} />}
              onClick={() => handleRestore(note.id)}
              loading={restoring === note.id}
            >
              Restore
            </Button>
          </Group>
        ))}
      </Stack>
    </Stack>
  );
}
