import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { Details, DetailsSummary, DetailsContent } from "@tiptap/extension-details";
import Image from "@tiptap/extension-image";
import { ImageNodeView } from "./ImageNodeView";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { TaskItemView } from "./TaskItemView";
import { createLowlight, common } from "lowlight";
import { CodeBlockNodeView } from "./CodeBlockNodeView";
import { TocExtension } from "./TocExtension";
import { HeadingShortcutsExtension } from "./HeadingShortcutsExtension";
import { EmojiExtension } from "./EmojiExtension";
import "tippy.js/dist/tippy.css";
import { EditorToolbar } from "./EditorToolbar";
import { FindReplaceBar } from "./FindReplaceBar";
import { TableMenu } from "./TableMenu";
import { createFindReplacePlugin } from "./findReplacePlugin";
import { useAutoSave } from "../../hooks/useAutoSave";
import type { SaveStatus } from "../../hooks/useAutoSave";
import { SaveStatusIndicator } from "./SaveStatusIndicator";
import type { JSONContent } from "@tiptap/react";
import { useRef, useEffect, useCallback, useState } from "react";
import type { MutableRefObject } from "react";
import { getImageUrl } from "../../ipc/assets";
import { Markdown } from "tiptap-markdown";
import { PasteExtension, isMarkdownContent } from "./PasteExtension";
import {
  classifyLink,
  extractNoteId,
  isTrusted,
  trustSite,
  openLink,
} from "../../utils/linkHandler";
import { modals } from "@mantine/modals";
import { Text, Checkbox } from "@mantine/core";

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

const FONT_FAMILY_MAP: Record<string, string> = {
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  monospace: '"Cascadia Code", "Fira Code", "JetBrains Mono", monospace',
  serif: 'Georgia, "Times New Roman", Times, serif',
  "sans-serif": 'Arial, Helvetica, sans-serif',
};

interface NoteEditorProps {
  content: JSONContent | null;
  noteId?: string | null;
  title?: string;
  createdAt?: number;
  updatedAt?: number;
  onSave?: (params: { id: string; content: string; plainText: string }) => Promise<void>;
  onTitleChange?: (newTitle: string) => void;
  forceSaveRef?: MutableRefObject<(() => void) | null>;
  flushTitleSaveRef?: MutableRefObject<(() => void) | null>;
  autoSaveIntervalMs?: number;
  fontSize?: number;
  fontFamily?: string;
  spellCheck?: boolean;
  onNavigateToNote?: (noteId: string) => void;
  initialFindQuery?: string;
  onInitialFindQueryConsumed?: () => void;
}

export function NoteEditor({
  content,
  noteId,
  title = "Untitled",
  createdAt,
  updatedAt,
  onSave,
  onTitleChange,
  forceSaveRef,
  flushTitleSaveRef,
  autoSaveIntervalMs = 1000,
  fontSize = 16,
  fontFamily = "system",
  spellCheck = true,
  onNavigateToNote,
  initialFindQuery,
  onInitialFindQueryConsumed,
}: NoteEditorProps) {
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [localTitle, setLocalTitle] = useState(title);
  const titleSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNewNote = title === "Untitled";
  const [findBarOpen, setFindBarOpen] = useState(!!initialFindQuery);
  const [activeFindQuery, setActiveFindQuery] = useState<string | undefined>(initialFindQuery);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markdownParserRef = useRef<((text: string) => void) | null>(null);

  const handleStatusChange = useCallback((status: SaveStatus) => {
    setSaveStatus(status);
    if (status === "saved") {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
    }
  }, []);

  // Keep localTitle in sync when the note changes (different noteId)
  useEffect(() => {
    setLocalTitle(title);
  }, [title, noteId]);

  // Notify parent that the initial find query has been consumed so it can be cleared
  useEffect(() => {
    if (initialFindQuery) {
      onInitialFindQueryConsumed?.();
    }
  }, []); // intentionally runs once on mount only

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
          protocols: [{ scheme: "rnotes", optionalSlashes: true }],
        },
      }).extend({
        addProseMirrorPlugins() {
          return [createFindReplacePlugin()];
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
      Image.extend({
        // Add width, height, and align attributes so they persist in JSON
        addAttributes() {
          return {
            ...this.parent?.(),
            width: {
              default: null,
              parseHTML: (el) => {
                const v = el.getAttribute("width");
                return v ? parseInt(v, 10) : null;
              },
              renderHTML: (attrs) => (attrs.width ? { width: String(attrs.width) } : {}),
            },
            height: {
              default: null,
              parseHTML: (el) => {
                const v = el.getAttribute("height");
                return v ? parseInt(v, 10) : null;
              },
              renderHTML: (attrs) => (attrs.height ? { height: String(attrs.height) } : {}),
            },
            align: {
              default: "center",
              parseHTML: (el) => el.getAttribute("data-align") ?? "center",
              renderHTML: (attrs) => ({ "data-align": attrs.align ?? "center" }),
            },
          };
        },
        addNodeView() {
          return ReactNodeViewRenderer(ImageNodeView, { as: "span" });
        },
      }).configure({
        inline: false,
        allowBase64: false,
      }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            dueDate: {
              default: null,
              parseHTML: (element) => element.getAttribute("data-due-date") || null,
              renderHTML: (attributes) => {
                if (!attributes.dueDate) return {};
                return { "data-due-date": attributes.dueDate };
              },
            },
            task_id: {
              default: null,
              // task_id is a backend-only stable identifier; not rendered to HTML
              parseHTML: () => null,
              renderHTML: () => ({}),
            },
          };
        },
        addNodeView() {
          return ReactNodeViewRenderer(TaskItemView);
        },
      }).configure({ nested: true }),
      Markdown.configure({
        transformPastedText: false, // We handle this manually
        transformCopiedText: false,
      }),
      PasteExtension.configure({
        onMarkdownDetected: (text) => {
          markdownParserRef.current?.(text);
        },
      }),
      HeadingShortcutsExtension,
      EmojiExtension,
    ],
    content: content ?? undefined,
    shouldRerenderOnTransaction: true,
  });

  useAutoSave({
    editor,
    noteId: noteId ?? null,
    onSave: onSave ?? (() => Promise.resolve()),
    onStatusChange: handleStatusChange,
    debounceMs: autoSaveIntervalMs,
  });

  // Set up markdown parser callback
  useEffect(() => {
    if (!editor) return;

    markdownParserRef.current = (text: string) => {
      // Parse markdown using tiptap-markdown
      if (editor && isMarkdownContent(text)) {
        // Insert as formatted markdown content using the Markdown extension's parser
        // The Markdown extension provides a parse method to convert markdown to Tiptap JSON
        try {
          editor.commands.insertContent(text, { parseOptions: { preserveWhitespace: true } });
        } catch (err) {
          console.error("Failed to parse markdown:", err);
          // Fallback to plain text insertion
          editor.commands.insertContent({
            type: "text",
            text: text,
          });
        }
      }
    };
  }, [editor]);

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

  // Intercept link clicks in the editor
  const onNavigateToNoteRef = useRef(onNavigateToNote);
  onNavigateToNoteRef.current = onNavigateToNote;

  useEffect(() => {
    const editorEl = editor?.view?.dom;
    if (!editorEl) return;

    const handleLinkClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a[href]");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      e.preventDefault();
      e.stopPropagation();

      const linkType = classifyLink(href);

      if (linkType === "internal-note") {
        const noteId = extractNoteId(href);
        if (noteId) onNavigateToNoteRef.current?.(noteId);
        return;
      }

      if (linkType === "local-file") {
        openLink(href);
        return;
      }

      // External link
      if (isTrusted(href)) {
        openLink(href);
        return;
      }

      let shouldTrust = false;
      modals.openConfirmModal({
        title: "Open external link",
        children: (
          <>
            <Text size="sm">
              You are about to open an external link:
            </Text>
            <Text size="sm" fw={500} mt="xs" style={{ wordBreak: "break-all" }}>
              {href}
            </Text>
            <Checkbox
              mt="md"
              label="Don't ask again for this site"
              onChange={(e) => {
                shouldTrust = e.currentTarget.checked;
              }}
              data-testid="trust-site-checkbox"
            />
          </>
        ),
        labels: { confirm: "Open", cancel: "Cancel" },
        confirmProps: { "data-testid": "confirm-open-link-btn" },
        onConfirm: () => {
          if (shouldTrust) trustSite(href);
          openLink(href);
        },
      });
    };

    editorEl.addEventListener("click", handleLinkClick);
    return () => editorEl.removeEventListener("click", handleLinkClick);
  }, [editor]);

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

  // Register Cmd+F / Ctrl+F to open find bar, Cmd+S to force save,
  // and Cmd+Shift+1-9 for editor structure shortcuts.
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const editorRef = useRef(editor);
  editorRef.current = editor;
  const noteIdRef = useRef(noteId);
  noteIdRef.current = noteId;

  // Expose force-save via ref so App.tsx hotkeys can call it
  useEffect(() => {
    if (!forceSaveRef) return;
    forceSaveRef.current = () => {
      const currentEditor = editorRef.current;
      const currentNoteId = noteIdRef.current;
      if (!currentEditor || !currentNoteId || !onSaveRef.current) return;
      onSaveRef.current({
        id: currentNoteId,
        content: JSON.stringify(currentEditor.getJSON()),
        plainText: currentEditor.getText(),
      });
    };
    return () => {
      if (forceSaveRef) forceSaveRef.current = null;
    };
  }, [forceSaveRef]);

  // Expose flush-title-save via ref so App.tsx can call it before switching views
  const localTitleRef = useRef(localTitle);
  localTitleRef.current = localTitle;
  const onTitleChangeRef = useRef(onTitleChange);
  onTitleChangeRef.current = onTitleChange;

  useEffect(() => {
    if (!flushTitleSaveRef) return;
    flushTitleSaveRef.current = () => {
      if (titleSaveTimeout.current) {
        clearTimeout(titleSaveTimeout.current);
        titleSaveTimeout.current = null;
        onTitleChangeRef.current?.(localTitleRef.current);
      }
    };
    return () => {
      if (flushTitleSaveRef) flushTitleSaveRef.current = null;
    };
  }, [flushTitleSaveRef]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      // Cmd+F — open find bar
      if (e.key === "f" && !e.shiftKey) {
        e.preventDefault();
        setFindBarOpen(true);
        return;
      }

      // Cmd+S — force save (prevent browser save dialog)
      if (e.key === "s" && !e.shiftKey) {
        e.preventDefault();
        const currentEditor = editorRef.current;
        const currentNoteId = noteIdRef.current;
        if (currentEditor && currentNoteId && onSaveRef.current) {
          onSaveRef.current({
            id: currentNoteId,
            content: JSON.stringify(currentEditor.getJSON()),
            plainText: currentEditor.getText(),
          });
        }
        return;
      }

      // Cmd+Shift+V — paste as plain text
      if (e.key === "v" && e.shiftKey) {
        e.preventDefault();
        const currentEditor = editorRef.current;
        if (!currentEditor) return;
        navigator.clipboard
          .readText()
          .then((text: string) => {
            currentEditor.commands.insertContent({
              type: "text",
              text,
            });
          })
          .catch((err: Error) => {
            console.error("Failed to read clipboard:", err);
          });
        return;
      }

      // Cmd+Shift+1..9 — editor structure shortcuts
      if (e.shiftKey) {
        const currentEditor = editorRef.current;
        if (!currentEditor) return;
        switch (e.key) {
          case "!": // Shift+1
            e.preventDefault();
            currentEditor.chain().focus().toggleHeading({ level: 1 }).run();
            break;
          case "@": // Shift+2
            e.preventDefault();
            currentEditor.chain().focus().toggleHeading({ level: 2 }).run();
            break;
          case "#": // Shift+3
            e.preventDefault();
            currentEditor.chain().focus().toggleHeading({ level: 3 }).run();
            break;
          case "$": // Shift+4
            e.preventDefault();
            currentEditor.chain().focus().toggleHeading({ level: 4 }).run();
            break;
          case "%": // Shift+5
            e.preventDefault();
            currentEditor.chain().focus().toggleHeading({ level: 5 }).run();
            break;
          case "^": // Shift+6
            e.preventDefault();
            currentEditor.chain().focus().toggleHeading({ level: 6 }).run();
            break;
          case "&": // Shift+7
            e.preventDefault();
            currentEditor.chain().focus().toggleOrderedList().run();
            break;
          case "*": // Shift+8
            e.preventDefault();
            currentEditor.chain().focus().toggleBulletList().run();
            break;
          case "(": // Shift+9
            e.preventDefault();
            currentEditor.chain().focus().toggleTaskList().run();
            break;
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Set up context menu for "Paste as plain text" option
  useEffect(() => {
    const editorContent = document.querySelector(`.${classes.editorContent}`);
    if (!editorContent) return;

    const handleContextMenu = (event: Event) => {
      const e = event as MouseEvent;
      e.preventDefault();

      // Get clipboard text
      navigator.clipboard
        .readText()
        .then((text: string) => {
          // Create custom context menu
          const menu = document.createElement("div");
          menu.className = "custom-context-menu";
          menu.style.cssText = `
            position: fixed;
            top: ${e.clientY}px;
            left: ${e.clientX}px;
            background: white;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            z-index: 10000;
            min-width: 200px;
            overflow: hidden;
          `;

          // Menu items
          const items = [
            { label: "Cut", action: "cut", enabled: document.queryCommandSupported("cut") },
            {
              label: "Copy",
              action: "copy",
              enabled: document.queryCommandSupported("copy"),
            },
            {
              label: "Paste",
              action: "paste",
              enabled: text.length > 0,
            },
            {
              label: "Paste as plain text",
              action: "pasteAsPlainText",
              enabled: text.length > 0,
            },
          ];

          items.forEach((item) => {
            const button = document.createElement("button");
            button.textContent = item.label;
            button.style.cssText = `
              width: 100%;
              padding: 8px 12px;
              text-align: left;
              background: none;
              border: none;
              cursor: ${item.enabled ? "pointer" : "not-allowed"};
              color: ${item.enabled ? "inherit" : "#ccc"};
              font-size: 14px;
              transition: background-color 0.1s;
            `;

            if (item.enabled) {
              button.onmouseover = () => {
                button.style.backgroundColor = "#f0f0f0";
              };
              button.onmouseout = () => {
                button.style.backgroundColor = "transparent";
              };
              button.onclick = () => {
                if (item.action === "cut") {
                  document.execCommand("cut");
                } else if (item.action === "copy") {
                  document.execCommand("copy");
                } else if (item.action === "paste") {
                  document.execCommand("paste");
                } else if (item.action === "pasteAsPlainText") {
                  const currentEditor = editorRef.current;
                  if (currentEditor) {
                    currentEditor.commands.insertContent({
                      type: "text",
                      text,
                    });
                  }
                }
                menu.remove();
              };
            }

            menu.appendChild(button);
          });

          document.body.appendChild(menu);

          // Close menu on click outside or escape
          const closeMenu = () => {
            menu.remove();
            document.removeEventListener("click", closeMenu);
            document.removeEventListener("keydown", handleEscapeKey);
          };

          const handleEscapeKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
              closeMenu();
            }
          };

          document.addEventListener("click", closeMenu);
          document.addEventListener("keydown", handleEscapeKey);
        })
        .catch((err) => {
          console.error("Failed to read clipboard:", err);
        });
    };

    editorContent.addEventListener("contextmenu", handleContextMenu);
    return () => {
      editorContent.removeEventListener("contextmenu", handleContextMenu);
    };
  }, []);

  if (!editor) return null;

  const resolvedFontFamily = FONT_FAMILY_MAP[fontFamily] ?? FONT_FAMILY_MAP["system"];

  return (
    <div
      className={classes.editorWrapper}
      style={
        {
          "--editor-font-size": `${fontSize}px`,
          "--editor-font-family": resolvedFontFamily,
        } as React.CSSProperties
      }
    >
      <EditorToolbar
        editor={editor}
        noteId={noteId}
        title={localTitle}
        createdAt={createdAt}
        updatedAt={updatedAt}
      />
      {findBarOpen && (
        <FindReplaceBar
          editor={editor}
          onClose={() => {
            setFindBarOpen(false);
            setActiveFindQuery(undefined);
          }}
          initialQuery={activeFindQuery}
        />
      )}
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
        <div className={classes.saveStatusRow}>
          <SaveStatusIndicator
            status={saveStatus}
            onRetry={() => {
              const currentEditor = editorRef.current;
              const currentNoteId = noteIdRef.current;
              if (!currentEditor || !currentNoteId || !onSaveRef.current) return;
              onSaveRef.current({
                id: currentNoteId,
                content: JSON.stringify(currentEditor.getJSON()),
                plainText: currentEditor.getText(),
              });
            }}
          />
        </div>
      </div>
      <EditorContent
        editor={editor}
        className={classes.editorContent}
        spellCheck={spellCheck}
      />
      <TableMenu editor={editor} />
    </div>
  );
}
