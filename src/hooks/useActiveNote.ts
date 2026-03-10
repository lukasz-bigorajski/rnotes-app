import { useState, useEffect, useCallback, useRef } from "react";
import { getNote, updateNote } from "../ipc/notes";
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
        setNote(null);
        noteRef.current = null;
      })
      .finally(() => setLoading(false));
  }, [activeNoteId]);

  const saveNote = useCallback(
    async (params: { id: string; content: string; plainText: string }) => {
      const current = noteRef.current;
      if (!current) return;

      try {
        await updateNote({
          id: params.id,
          title: current.title,
          content: params.content,
          plainText: params.plainText,
        });
      } catch (err) {
        console.error("Failed to save note:", err);
      }
    },
    [],
  );

  return { note, loading, saveNote };
}
