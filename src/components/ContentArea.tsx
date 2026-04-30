import { useMemo, useCallback, useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import { Center, Loader, Stack, Text } from "@mantine/core";
import { IconNotes } from "@tabler/icons-react";
import { NoteEditor } from "./editor/NoteEditor";
import { useActiveNote } from "../hooks/useActiveNote";
import { renameNote } from "../ipc/notes";
import { useUserConfig } from "../context/UserConfigContext";
import { notifyError } from "../utils/notify";
import type { JSONContent } from "@tiptap/react";

interface ContentAreaProps {
  activeNoteId: string | null;
  onNotesChanged?: () => void;
  forceSaveRef?: MutableRefObject<(() => void) | null>;
  flushTitleSaveRef?: MutableRefObject<(() => void) | null>;
  refreshActiveNoteRef?: MutableRefObject<(() => void) | null>;
  focusEditorRef?: MutableRefObject<(() => void) | null>;
  onNavigateToNote?: (noteId: string) => void;
  initialFindQuery?: string | null;
  onInitialFindQueryConsumed?: () => void;
  onOpenGlobalSearch?: () => void;
}

export function ContentArea({
  activeNoteId,
  onNotesChanged,
  forceSaveRef,
  flushTitleSaveRef,
  refreshActiveNoteRef,
  focusEditorRef,
  onNavigateToNote,
  initialFindQuery,
  onInitialFindQueryConsumed,
  onOpenGlobalSearch,
}: ContentAreaProps) {
  const { note, loading, saveNote, updateTitle, refreshNote } = useActiveNote(activeNoteId);

  // Capture initialFindQuery in a ref so it survives the loading→loaded transition.
  // NoteEditor unmounts during loading (ContentArea shows a Loader), so we must
  // preserve the query until loading completes and NoteEditor actually mounts.
  const capturedFindQueryRef = useRef<string | undefined>(undefined);
  // When a new initialFindQuery arrives (from global search), capture it immediately.
  if (initialFindQuery) {
    capturedFindQueryRef.current = initialFindQuery;
  }

  useEffect(() => {
    if (refreshActiveNoteRef) refreshActiveNoteRef.current = refreshNote;
    return () => {
      if (refreshActiveNoteRef) refreshActiveNoteRef.current = null;
    };
  }, [refreshActiveNoteRef, refreshNote]);
  const { config } = useUserConfig();

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
        updateTitle(newTitle);
        onNotesChanged?.();
      } catch (err) {
        console.error("Failed to rename note:", err);
        notifyError("Rename failed", "Could not rename the note");
      }
    },
    [activeNoteId, onNotesChanged, updateTitle],
  );

  if (!activeNoteId) {
    return (
      <Center style={{ flex: 1 }}>
        <Stack align="center" gap="sm">
          <IconNotes size={48} stroke={1.5} color="var(--mantine-color-dimmed)" />
          <Text c="dimmed" size="lg">
            Select a note or create a new one
          </Text>
        </Stack>
      </Center>
    );
  }

  if (loading || !note) {
    return (
      <Center style={{ flex: 1 }}>
        <Loader size="sm" />
      </Center>
    );
  }

  // Take the captured query and clear the ref so it's only used once.
  // This runs only when NoteEditor actually renders (loading is false).
  const findQueryForEditor = capturedFindQueryRef.current;
  capturedFindQueryRef.current = undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <NoteEditor
        key={activeNoteId}
        content={parsedContent}
        noteId={activeNoteId}
        title={note?.title ?? "Untitled"}
        createdAt={note?.created_at}
        updatedAt={note?.updated_at}
        onSave={saveNote}
        onTitleChange={handleTitleChange}
        forceSaveRef={forceSaveRef}
        flushTitleSaveRef={flushTitleSaveRef}
        focusEditorRef={focusEditorRef}
        autoSaveIntervalMs={config.auto_save_interval_ms}
        fontSize={config.font_size}
        fontFamily={config.font_family}
        spellCheck={config.spell_check}
        onNavigateToNote={onNavigateToNote}
        initialFindQuery={findQueryForEditor}
        onInitialFindQueryConsumed={onInitialFindQueryConsumed}
        onOpenGlobalSearch={onOpenGlobalSearch}
      />
    </div>
  );
}
