import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { Details, DetailsSummary, DetailsContent } from "@tiptap/extension-details";
import Image from "@tiptap/extension-image";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { createLowlight, common } from "lowlight";
import { CodeBlockNodeView } from "./CodeBlockNodeView";
import { TocExtension } from "./TocExtension";
import { EditorToolbar } from "./EditorToolbar";
import { useAutoSave } from "../../hooks/useAutoSave";
import type { JSONContent } from "@tiptap/react";
import { useRef, useEffect, useCallback, useState } from "react";
import { getImageUrl } from "../../ipc/assets";

import classes from "./NoteEditor.module.css";

const lowlight = createLowlight(common);

/**
 * Traverse TipTap JSON and resolve relative asset paths to absolute URLs.
 * Relative paths look like `assets/{note_id}/{filename}`.
 */
async function resolveImageUrls(content: JSONContent): Promise<JSONContent> {
  const RELATIVE_ASSET_RE = /^assets\//;

  async function walk(node: JSONContent): Promise<JSONContent> {
    if (node.type === "image" && node.attrs?.src && RELATIVE_ASSET_RE.test(node.attrs.src as string)) {
      try {
        const url = await getImageUrl(node.attrs.src as string);
        return { ...node, attrs: { ...node.attrs, src: url } };
      } catch {
        // If resolution fails keep the original src; the image just won't load.
        return node;
      }
    }
    if (node.content) {
      const resolved = await Promise.all(node.content.map(walk));
      return { ...node, content: resolved };
    }
    return node;
  }

  return walk(content);
}

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
        codeBlock: false,
        link: {
          openOnClick: false,
          HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
        },
      }),
      CodeBlockLowlight.extend({
        addNodeView() {
          return ReactNodeViewRenderer(CodeBlockNodeView);
        },
      }).configure({
        lowlight,
        defaultLanguage: "plaintext",
      }),
      Details.configure({
        persist: true,
        HTMLAttributes: { class: "details-node" },
      }),
      DetailsSummary,
      DetailsContent,
      Placeholder.configure({
        placeholder: "Start writing…",
      }),
      TocExtension,
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: { style: "max-width: 100%;" },
      }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: content ?? undefined,
    shouldRerenderOnTransaction: true,
  });

  useAutoSave({
    editor,
    noteId: noteId ?? null,
    onSave: onSave ?? (() => {}),
  });

  // When a note is loaded, resolve any relative asset paths to absolute URLs.
  useEffect(() => {
    if (!editor || !content) return;
    let cancelled = false;

    resolveImageUrls(content).then((resolved) => {
      if (!cancelled && editor) {
        editor.commands.setContent(resolved, { emitUpdate: false });
      }
    });

    return () => {
      cancelled = true;
    };
    // Only re-run when the note itself changes, not on every content update.
  }, [noteId]);

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
      <EditorToolbar editor={editor} noteId={noteId} />
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
