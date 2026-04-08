import { ActionIcon, Group, Menu, Popover, Portal, Text, TextInput } from "@mantine/core";
import { TextSelection } from "@tiptap/pm/state";
import {
  IconBold,
  IconItalic,
  IconStrikethrough,
  IconH1,
  IconH2,
  IconH3,
  IconList,
  IconListNumbers,
  IconListCheck,
  IconLink,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconBlockquote,
  IconCode,
  IconCodeDots,
  IconListDetails,
  IconChevronDown,
  IconPhoto,
  IconTable,
  IconDownload,
} from "@tabler/icons-react";
import type { Editor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/react";
import { useState, useRef, useEffect, useCallback } from "react";
import classes from "./EditorToolbar.module.css";
import type { TocHeading } from "./TocExtension";
import { saveImage, getImageUrl } from "../../ipc/assets";
import { exportNoteAsJson, exportNoteAsPdf } from "../../utils/exportNote";

interface EditorToolbarProps {
  editor: Editor;
  noteId?: string | null;
  title?: string;
  createdAt?: number;
  updatedAt?: number;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function extractHeadings(doc: JSONContent): TocHeading[] {
  const headings: TocHeading[] = [];

  function traverse(node: JSONContent) {
    if (node.type === "heading" && node.attrs) {
      const level = node.attrs.level as number;
      const text = (node.content ?? [])
        .filter((c) => c.type === "text")
        .map((c) => c.text ?? "")
        .join("");
      if (text.trim()) {
        headings.push({ level, text, id: slugify(text) });
      }
    }
    if (node.content) {
      node.content.forEach(traverse);
    }
  }

  traverse(doc);
  return headings;
}

export function EditorToolbar({ editor, noteId, title = "Untitled", createdAt, updatedAt }: EditorToolbarProps) {
  const [linkUrl, setLinkUrl] = useState("");
  const [linkOpened, setLinkOpened] = useState(false);
  const [floatingLink, setFloatingLink] = useState(false);
  const [floatingPos, setFloatingPos] = useState({ x: 0, y: 0 });
  const floatingInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the floating link input when it opens
  useEffect(() => {
    if (floatingLink && floatingInputRef.current) {
      floatingInputRef.current.focus();
    }
  }, [floatingLink]);

  const setLink = () => {
    if (linkUrl) {
      editor.chain().focus().setLink({ href: linkUrl }).run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
    setLinkOpened(false);
    setLinkUrl("");
  };

  const setFloatingLinkAction = () => {
    if (linkUrl) {
      editor
        .chain()
        .focus()
        .insertContent({ type: "text", text: linkUrl, marks: [{ type: "link", attrs: { href: linkUrl } }] })
        .run();
    }
    setFloatingLink(false);
    setLinkUrl("");
  };

  const openLinkPopover = () => {
    const existing = editor.getAttributes("link").href as string | undefined;
    const { from, to, empty } = editor.state.selection;

    let url = existing ?? "";
    if (!url && !empty) {
      // If selected text looks like a URL, pre-fill with it
      const selectedText = editor.state.doc.textBetween(from, to);
      if (/^https?:\/\//.test(selectedText) || /^[\w-]+\.[\w-]+(\/|$)/.test(selectedText)) {
        url = selectedText;
      }
    }
    setLinkUrl(url);

    const selectionEmpty = empty;

    if (!selectionEmpty) {
      // Text is selected — use toolbar-anchored popover
      setLinkOpened(true);
    } else {
      // No selection — show floating dialog near cursor
      const coords = editor.view.coordsAtPos(from);
      setFloatingPos({ x: coords.left, y: coords.bottom + 4 });
      setFloatingLink(true);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const insertImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !noteId) {
        // Reset so the same file can be selected again later.
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      try {
        const buffer = await file.arrayBuffer();
        const data = new Uint8Array(buffer);
        const assetPath = await saveImage({ noteId, filename: file.name, data });
        const imageUrl = await getImageUrl(assetPath);
        editor.chain().focus().setImage({ src: imageUrl, alt: file.name }).run();
      } catch (err) {
        console.error("Failed to insert image:", err);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [editor, noteId],
  );

  const handleExportJson = useCallback(() => {
    if (!noteId) return;
    exportNoteAsJson({
      noteId,
      title,
      content: editor.getJSON(),
      createdAt: createdAt ?? Date.now(),
      updatedAt: updatedAt ?? Date.now(),
    });
  }, [editor, noteId, title, createdAt, updatedAt]);

  const handleExportPdf = useCallback(async () => {
    try {
      // Get HTML from the editor's rendered DOM instead of editor.getHTML()
      // which throws "Content hole not allowed in a leaf node spec" due to
      // the custom Image NodeView conflicting with ProseMirror's serializer.
      const clone = editor.view.dom.cloneNode(true) as HTMLElement;
      // Remove interactive NodeView elements (resize handles, alignment toolbar)
      clone.querySelectorAll("[class*='handle'], [class*='alignToolbar'], [class*='alignBtn']").forEach((el) => el.remove());
      // Remove contenteditable attributes
      clone.removeAttribute("contenteditable");
      clone.querySelectorAll("[contenteditable]").forEach((el) => el.removeAttribute("contenteditable"));
      await exportNoteAsPdf({ title, htmlContent: clone.innerHTML });
    } catch (err) {
      console.error("PDF export failed:", err);
    }
  }, [editor, title]);

  const generateToc = () => {
    const doc = editor.getJSON();
    const headings = extractHeadings(doc);

    if (headings.length === 0) {
      alert("No headings found in this note. Add some headings (H1, H2, H3) first.");
      return;
    }

    const tocNode = { type: "tableOfContents", attrs: { headings } };
    const firstNode = doc.content?.[0];

    if (firstNode?.type === "tableOfContents") {
      // Replace existing ToC at position 0
      editor
        .chain()
        .focus()
        .command(({ tr, state }) => {
          const node = state.schema.nodes.tableOfContents.create({ headings });
          tr.replaceWith(0, state.doc.firstChild!.nodeSize, node);
          return true;
        })
        .run();
    } else {
      // Insert new ToC at position 0
      editor.chain().focus().insertContentAt(0, tocNode).run();
    }
  };

  return (
    <>
      <Group gap={4} className={classes.toolbar}>
        <ActionIcon
          variant={editor.isActive("bold") ? "filled" : "subtle"}
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <IconBold size={16} />
        </ActionIcon>

        <ActionIcon
          variant={editor.isActive("italic") ? "filled" : "subtle"}
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <IconItalic size={16} />
        </ActionIcon>

        <ActionIcon
          variant={editor.isActive("strike") ? "filled" : "subtle"}
          size="sm"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough"
        >
          <IconStrikethrough size={16} />
        </ActionIcon>

        <ActionIcon
          variant={editor.isActive("code") ? "filled" : "subtle"}
          size="sm"
          onClick={() => editor.chain().focus().toggleCode().run()}
          title="Code"
        >
          <IconCode size={16} />
        </ActionIcon>

        <div className={classes.separator} />

        <ActionIcon
          variant={editor.isActive("heading", { level: 1 }) ? "filled" : "subtle"}
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          title="Heading 1"
        >
          <IconH1 size={16} />
        </ActionIcon>

        <ActionIcon
          variant={editor.isActive("heading", { level: 2 }) ? "filled" : "subtle"}
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Heading 2"
        >
          <IconH2 size={16} />
        </ActionIcon>

        <ActionIcon
          variant={editor.isActive("heading", { level: 3 }) ? "filled" : "subtle"}
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Heading 3"
        >
          <IconH3 size={16} />
        </ActionIcon>

        <div className={classes.separator} />

        <ActionIcon
          variant={editor.isActive("bulletList") ? "filled" : "subtle"}
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet List"
        >
          <IconList size={16} />
        </ActionIcon>

        <ActionIcon
          variant={editor.isActive("orderedList") ? "filled" : "subtle"}
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Ordered List"
        >
          <IconListNumbers size={16} />
        </ActionIcon>

        <ActionIcon
          variant={editor.isActive("taskList") ? "filled" : "subtle"}
          size="sm"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          title="Task List"
          data-testid="task-list-button"
        >
          <IconListCheck size={16} />
        </ActionIcon>

        <ActionIcon
          variant={editor.isActive("blockquote") ? "filled" : "subtle"}
          size="sm"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Blockquote"
        >
          <IconBlockquote size={16} />
        </ActionIcon>

        <ActionIcon
          variant={editor.isActive("codeBlock") ? "filled" : "subtle"}
          size="sm"
          onClick={() => {
            const { from, to, empty } = editor.state.selection;
            if (!empty) {
              // Check if selection spans multiple blocks
              let blockCount = 0;
              editor.state.doc.nodesBetween(from, to, (node) => {
                if (node.isBlock) blockCount++;
              });
              if (blockCount > 1) {
                // Collect text across blocks, join with newlines, insert single code block
                const selectedText = editor.state.doc.textBetween(from, to, "\n");
                editor
                  .chain()
                  .focus()
                  .command(({ tr, state }) => {
                    const codeBlock = state.schema.nodes.codeBlock.create(
                      null,
                      state.schema.text(selectedText),
                    );
                    tr.replaceWith(from, to, codeBlock);
                    // If the code block landed at the end of the document there is no
                    // paragraph to move into — insert one so the cursor has somewhere to go.
                    const afterPos = from + codeBlock.nodeSize;
                    if (afterPos >= tr.doc.content.size) {
                      tr.insert(afterPos, state.schema.nodes.paragraph.create());
                    }
                    // Place cursor inside the code block
                    tr.setSelection(TextSelection.create(tr.doc, from + 1));
                    return true;
                  })
                  .run();
                return;
              }
            }
            const wasCodeBlock = editor.isActive("codeBlock");
            editor.chain().focus().toggleCodeBlock().run();
            // After creating a code block, ensure cursor is focused inside it.
            // The React NodeView can steal focus during mount, so re-focus.
            if (!wasCodeBlock) {
              requestAnimationFrame(() => {
                editor.commands.focus();
              });
            }
          }}
          title="Code Block"
        >
          <IconCodeDots size={16} />
        </ActionIcon>

        <ActionIcon
          variant={editor.isActive("details") ? "filled" : "subtle"}
          size="sm"
          onClick={() => editor.chain().focus().setDetails().run()}
          title="Collapsible Section"
        >
          <IconChevronDown size={16} />
        </ActionIcon>

        <div className={classes.separator} />

        <Menu position="bottom-start" withinPortal>
          <Menu.Target>
            <ActionIcon
              variant={editor.isActive("table") ? "filled" : "subtle"}
              size="sm"
              title="Table"
              data-testid="table-menu-button"
            >
              <IconTable size={16} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
              data-testid="insert-table-item"
            >
              Insert Table
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item
              disabled={!editor.can().addRowBefore()}
              onClick={() => editor.chain().focus().addRowBefore().run()}
              data-testid="add-row-before-item"
            >
              Add Row Before
            </Menu.Item>
            <Menu.Item
              disabled={!editor.can().addRowAfter()}
              onClick={() => editor.chain().focus().addRowAfter().run()}
              data-testid="add-row-after-item"
            >
              Add Row After
            </Menu.Item>
            <Menu.Item
              disabled={!editor.can().deleteRow()}
              onClick={() => editor.chain().focus().deleteRow().run()}
              data-testid="delete-row-item"
            >
              Delete Row
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item
              disabled={!editor.can().addColumnBefore()}
              onClick={() => editor.chain().focus().addColumnBefore().run()}
              data-testid="add-column-before-item"
            >
              Add Column Before
            </Menu.Item>
            <Menu.Item
              disabled={!editor.can().addColumnAfter()}
              onClick={() => editor.chain().focus().addColumnAfter().run()}
              data-testid="add-column-after-item"
            >
              Add Column After
            </Menu.Item>
            <Menu.Item
              disabled={!editor.can().deleteColumn()}
              onClick={() => editor.chain().focus().deleteColumn().run()}
              data-testid="delete-column-item"
            >
              Delete Column
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item
              disabled={!editor.can().deleteTable()}
              onClick={() => editor.chain().focus().deleteTable().run()}
              data-testid="delete-table-item"
            >
              <Text c="red" size="sm" component="span">
                Delete Table
              </Text>
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>

        <div className={classes.separator} />

        <Popover opened={linkOpened} onChange={setLinkOpened} position="bottom" withArrow>
          <Popover.Target>
            <ActionIcon
              variant={editor.isActive("link") ? "filled" : "subtle"}
              size="sm"
              onClick={openLinkPopover}
              title="Link"
            >
              <IconLink size={16} />
            </ActionIcon>
          </Popover.Target>
          <Popover.Dropdown>
            <TextInput
              placeholder="https://example.com"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setLink();
                if (e.key === "Escape") {
                  setLinkOpened(false);
                  setLinkUrl("");
                }
              }}
              autoFocus
              size="xs"
              style={{ width: 250 }}
            />
          </Popover.Dropdown>
        </Popover>

        <div className={classes.separator} />

        <ActionIcon
          variant="subtle"
          size="sm"
          onClick={generateToc}
          title="Generate Table of Contents"
        >
          <IconListDetails size={16} />
        </ActionIcon>

        <ActionIcon
          variant="subtle"
          size="sm"
          onClick={insertImage}
          disabled={!noteId}
          title="Insert Image"
          data-testid="insert-image-button"
        >
          <IconPhoto size={16} />
        </ActionIcon>

        <div className={classes.separator} />

        <ActionIcon
          variant="subtle"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo"
        >
          <IconArrowBackUp size={16} />
        </ActionIcon>

        <ActionIcon
          variant="subtle"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo"
        >
          <IconArrowForwardUp size={16} />
        </ActionIcon>

        <div className={classes.separator} />

        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon
              variant="subtle"
              size="sm"
              title="Export"
              data-testid="export-menu-button"
              disabled={!noteId}
            >
              <IconDownload size={16} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={handleExportJson} data-testid="export-json-item">
              Export as JSON
            </Menu.Item>
            <Menu.Item onClick={handleExportPdf} data-testid="export-pdf-item">
              Export as PDF
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      {floatingLink && (
        <Portal>
          <div
            className={classes.floatingLinkDialog}
            style={{ left: floatingPos.x, top: floatingPos.y }}
            data-testid="floating-link-dialog"
          >
            <TextInput
              ref={floatingInputRef}
              placeholder="https://example.com"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setFloatingLinkAction();
                if (e.key === "Escape") {
                  setFloatingLink(false);
                  setLinkUrl("");
                }
              }}
              size="xs"
              style={{ width: 250 }}
            />
          </div>
        </Portal>
      )}

      {/* Hidden file input for image selection */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
        style={{ display: "none" }}
        onChange={handleFileChange}
        data-testid="image-file-input"
      />
    </>
  );
}
