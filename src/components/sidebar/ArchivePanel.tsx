import { useState, useEffect } from "react";
import { Stack, Text, Group, ActionIcon, Tooltip } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconRestore, IconArchive, IconTrash } from "@tabler/icons-react";
import { listNotes, restoreNote, hardDeleteNote } from "../../ipc/notes";
import type { NoteRow } from "../../ipc/notes";

interface ArchivePanelProps {
  onNoteRestored: () => void;
  onNoteDeleted?: () => void;
}

export function ArchivePanel({ onNoteRestored, onNoteDeleted }: ArchivePanelProps) {
  const [archivedNotes, setArchivedNotes] = useState<NoteRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

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

  const handleDeleteForever = (note: NoteRow) => {
    modals.openConfirmModal({
      title: "Delete forever?",
      children: (
        <Text size="sm">
          &ldquo;{note.title}&rdquo; will be permanently deleted and cannot be recovered.
          {note.is_folder ? " All notes inside this folder will also be deleted." : ""}
        </Text>
      ),
      labels: { confirm: "Delete forever", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        setDeleting(note.id);
        try {
          await hardDeleteNote(note.id);
          await loadArchivedNotes();
          onNoteDeleted?.();
        } catch (err) {
          console.error("Failed to permanently delete note:", err);
        } finally {
          setDeleting(null);
        }
      },
    });
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
              backgroundColor: "var(--mantine-color-default-hover)",
              border: "1px solid var(--mantine-color-default-border)",
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
            <Group gap={4} style={{ flexShrink: 0 }}>
              <Tooltip label="Restore" withArrow>
                <ActionIcon
                  size="sm"
                  variant="light"
                  onClick={() => handleRestore(note.id)}
                  loading={restoring === note.id}
                  aria-label="Restore"
                >
                  <IconRestore size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Delete forever" withArrow>
                <ActionIcon
                  size="sm"
                  variant="light"
                  color="red"
                  onClick={() => handleDeleteForever(note)}
                  loading={deleting === note.id}
                  aria-label="Delete forever"
                >
                  <IconTrash size={14} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        ))}
      </Stack>
    </Stack>
  );
}
