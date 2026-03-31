import { useEffect, useRef, useCallback } from "react";
import type { Editor } from "@tiptap/react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface AutoSaveParams {
  editor: Editor | null;
  noteId: string | null;
  onSave: (params: { id: string; content: string; plainText: string }) => Promise<void>;
  onStatusChange?: (status: SaveStatus) => void;
  debounceMs?: number;
}

const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1000;

export function useAutoSave({
  editor,
  noteId,
  onSave,
  onStatusChange,
  debounceMs = 1000,
}: AutoSaveParams) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteIdRef = useRef(noteId);
  const onSaveRef = useRef(onSave);
  const editorRef = useRef(editor);
  const onStatusChangeRef = useRef(onStatusChange);

  // Keep refs in sync without triggering effect re-runs
  noteIdRef.current = noteId;
  onSaveRef.current = onSave;
  editorRef.current = editor;
  onStatusChangeRef.current = onStatusChange;

  const setStatus = useCallback((status: SaveStatus) => {
    onStatusChangeRef.current?.(status);
  }, []);

  const attemptSave = useCallback(
    async (id: string, content: string, plainText: string, attempt = 0): Promise<void> => {
      setStatus("saving");
      try {
        await onSaveRef.current({ id, content, plainText });
        setStatus("saved");
      } catch (err) {
        console.error(`Save failed (attempt ${attempt + 1}):`, err);
        if (attempt < MAX_RETRIES - 1) {
          const delay = BACKOFF_BASE_MS * Math.pow(2, attempt);
          retryTimeoutRef.current = setTimeout(() => {
            attemptSave(id, content, plainText, attempt + 1);
          }, delay);
        } else {
          setStatus("error");
        }
      }
    },
    [setStatus],
  );

  const triggerSave = useCallback(() => {
    const currentId = noteIdRef.current;
    if (!currentId || !editorRef.current) return;

    // Cancel any pending retries from a previous failed save
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    const content = JSON.stringify(editorRef.current.getJSON());
    const plainText = editorRef.current.getText();
    attemptSave(currentId, content, plainText, 0);
  }, [attemptSave]);

  useEffect(() => {
    if (!editor || !noteId) return;

    const handler = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      timeoutRef.current = setTimeout(() => {
        triggerSave();
      }, debounceMs);
    };

    editor.on("update", handler);

    return () => {
      editor.off("update", handler);
      // Flush pending save on cleanup (note switch / unmount)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
        triggerSave();
      }
      // Cancel pending retries on cleanup
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [editor, noteId, debounceMs, triggerSave]);
}
