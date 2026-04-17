import { useState, useEffect, useCallback, useRef } from "react";
import { getNote, updateNote } from "../ipc/notes";
import { notifyError } from "../utils/notify";
import type { Note } from "../ipc/notes";

export function useActiveNote(activeNoteId: string | null) {
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(false);
  const noteRef = useRef<Note | null>(null);

  useEffect(() => {
    if (!activeNoteId) {
      setNote(null);
      noteRef.current = null;
      return;
    }

    setLoading(true);
    getNote(activeNoteId)
      .then((loaded) => {
        setNote(loaded);
        noteRef.current = loaded;
      })
      .catch((err) => {
        console.error("Failed to load note:", err);
        notifyError("Load error", "Could not load this note");
        setNote(null);
        noteRef.current = null;
      })
      .finally(() => setLoading(false));
  }, [activeNoteId]);

  const saveNote = useCallback(
    async (params: { id: string; content: string; plainText: string }): Promise<void> => {
      const current = noteRef.current;
      if (!current) return;

      await updateNote({
        id: params.id,
        title: current.title,
        content: params.content,
        plainText: params.plainText,
      });
    },
    [],
  );

  const updateTitle = useCallback((newTitle: string) => {
    setNote((prev) => (prev ? { ...prev, title: newTitle } : prev));
    if (noteRef.current) noteRef.current = { ...noteRef.current, title: newTitle };
  }, []);

  const refreshNote = useCallback(() => {
    if (!activeNoteId) return;
    getNote(activeNoteId)
      .then((loaded) => {
        setNote(loaded);
        noteRef.current = loaded;
      })
      .catch(console.error);
  }, [activeNoteId]);

  return { note, loading, saveNote, updateTitle, refreshNote };
}
