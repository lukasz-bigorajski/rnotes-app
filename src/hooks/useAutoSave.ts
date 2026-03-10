import { useEffect, useRef } from "react";
import type { Editor } from "@tiptap/react";

interface AutoSaveParams {
  editor: Editor | null;
  noteId: string | null;
  onSave: (params: { id: string; content: string; plainText: string }) => void;
  debounceMs?: number;
}

export function useAutoSave({ editor, noteId, onSave, debounceMs = 1000 }: AutoSaveParams) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteIdRef = useRef(noteId);
  const onSaveRef = useRef(onSave);
  const editorRef = useRef(editor);

  // Keep refs in sync without triggering effect re-runs
  noteIdRef.current = noteId;
  onSaveRef.current = onSave;
  editorRef.current = editor;

  useEffect(() => {
    if (!editor || !noteId) return;

    const handler = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      timeoutRef.current = setTimeout(() => {
        const currentId = noteIdRef.current;
        if (!currentId || !editorRef.current) return;

        onSaveRef.current({
          id: currentId,
          content: JSON.stringify(editorRef.current.getJSON()),
          plainText: editorRef.current.getText(),
        });
      }, debounceMs);
    };

    editor.on("update", handler);

    return () => {
      editor.off("update", handler);
      // Flush pending save on cleanup (note switch / unmount)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
        const currentId = noteIdRef.current;
        if (currentId && editorRef.current) {
          onSaveRef.current({
            id: currentId,
            content: JSON.stringify(editorRef.current.getJSON()),
            plainText: editorRef.current.getText(),
          });
        }
      }
    };
  }, [editor, noteId, debounceMs]);
}
