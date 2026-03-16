import { useMemo, useCallback } from "react";
import { Center, Loader, Stack, Text } from "@mantine/core";
import { IconNotes } from "@tabler/icons-react";
import { NoteEditor } from "./editor/NoteEditor";
import { useActiveNote } from "../hooks/useActiveNote";
import { renameNote } from "../ipc/notes";
import type { JSONContent } from "@tiptap/react";

interface ContentAreaProps {
  activeNoteId: string | null;
  onNotesChanged?: () => void;
}

export function ContentArea({ activeNoteId, onNotesChanged }: ContentAreaProps) {
  const { note, loading, saveNote } = useActiveNote(activeNoteId);

  const parsedContent = useMemo<JSONContent | null>(() => {
    if (!note?.content) return null;
    try {
      const parsed = JSON.parse(note.content) as JSONContent;
      // "{}" or objects without a type are not valid TipTap JSON
      if (!parsed.type) return null;
      return parsed;
    } catch {
      return null;
    }
  }, [note?.content]);

  const handleTitleChange = useCallback(
    async (newTitle: string) => {
      if (!activeNoteId) return;
      try {
        await renameNote({ id: activeNoteId, title: newTitle });
        onNotesChanged?.();
      } catch (err) {
        console.error("Failed to rename note:", err);
      }
    },
    [activeNoteId, onNotesChanged],
  );

  if (!activeNoteId) {
    return (
      <Center h="100%">
        <Stack align="center" gap="sm">
          <IconNotes size={48} stroke={1.5} color="var(--mantine-color-dimmed)" />
          <Text c="dimmed" size="lg">
            Select a note or create a new one
          </Text>
        </Stack>
      </Center>
    );
  }

  if (loading) {
    return (
      <Center h="100%">
        <Loader size="sm" />
      </Center>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <NoteEditor
        key={activeNoteId}
        content={parsedContent}
        noteId={activeNoteId}
        title={note?.title ?? "Untitled"}
        onSave={saveNote}
        onTitleChange={handleTitleChange}
      />
    </div>
  );
}
