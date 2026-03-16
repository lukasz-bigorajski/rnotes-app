import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { TocExtension } from "./TocExtension";
import { EditorToolbar } from "./EditorToolbar";
import { useAutoSave } from "../../hooks/useAutoSave";
import type { JSONContent } from "@tiptap/react";
import { useRef, useEffect, useCallback, useState } from "react";

import classes from "./NoteEditor.module.css";

interface NoteEditorProps {
  content: JSONContent | null;
  noteId?: string | null;
  title?: string;
  onSave?: (params: { id: string; content: string; plainText: string }) => void;
  onTitleChange?: (newTitle: string) => void;
}

export function NoteEditor({
  content,
  noteId,
  title = "Untitled",
  onSave,
  onTitleChange,
}: NoteEditorProps) {
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [localTitle, setLocalTitle] = useState(title);
  const titleSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNewNote = title === "Untitled";

  // Keep localTitle in sync when the note changes (different noteId)
  useEffect(() => {
    setLocalTitle(title);
  }, [title, noteId]);

  // Auto-focus the title and select all when a new "Untitled" note is opened
  useEffect(() => {
    if (isNewNote && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [noteId, isNewNote]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: false,
          HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
        },
      }),
      Placeholder.configure({
        placeholder: "Start writing…",
      }),
      TocExtension,
    ],
    content: content ?? undefined,
    shouldRerenderOnTransaction: true,
  });

  useAutoSave({
    editor,
    noteId: noteId ?? null,
    onSave: onSave ?? (() => {}),
  });

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTitle = e.target.value;
      setLocalTitle(newTitle);

      if (titleSaveTimeout.current) clearTimeout(titleSaveTimeout.current);
      titleSaveTimeout.current = setTimeout(() => {
        onTitleChange?.(newTitle);
      }, 600);
    },
    [onTitleChange],
  );

  const handleTitleBlur = useCallback(() => {
    if (titleSaveTimeout.current) {
      clearTimeout(titleSaveTimeout.current);
      titleSaveTimeout.current = null;
    }
    onTitleChange?.(localTitle);
  }, [localTitle, onTitleChange]);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        editor?.commands.focus();
      }
    },
    [editor],
  );

  if (!editor) return null;

  return (
    <div className={classes.editorWrapper}>
      <EditorToolbar editor={editor} />
      <div className={classes.titleRow}>
        <input
          ref={titleInputRef}
          type="text"
          className={classes.titleInput}
          value={localTitle}
          onChange={handleTitleChange}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
          placeholder="Untitled"
          data-testid="note-title-input"
        />
      </div>
      <EditorContent editor={editor} className={classes.editorContent} />
    </div>
  );
}
