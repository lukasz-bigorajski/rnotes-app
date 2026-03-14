import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorToolbar } from "./EditorToolbar";
import { useAutoSave } from "../../hooks/useAutoSave";
import type { JSONContent } from "@tiptap/react";

import classes from "./NoteEditor.module.css";

interface NoteEditorProps {
  content: JSONContent | null;
  noteId?: string | null;
  onSave?: (params: { id: string; content: string; plainText: string }) => void;
}

export function NoteEditor({ content, noteId, onSave }: NoteEditorProps) {
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
    ],
    content: content ?? undefined,
    shouldRerenderOnTransaction: true,
  });

  useAutoSave({
    editor,
    noteId: noteId ?? null,
    onSave: onSave ?? (() => {}),
  });

  if (!editor) return null;

  return (
    <div className={classes.editorWrapper}>
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} className={classes.editorContent} />
    </div>
  );
}
