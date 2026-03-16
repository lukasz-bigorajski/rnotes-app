import { ActionIcon, Group, Popover, TextInput } from "@mantine/core";
import {
  IconBold,
  IconItalic,
  IconStrikethrough,
  IconH1,
  IconH2,
  IconH3,
  IconList,
  IconListNumbers,
  IconLink,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconBlockquote,
  IconCode,
  IconCodeDots,
} from "@tabler/icons-react";
import type { Editor } from "@tiptap/react";
import { useState } from "react";
import classes from "./EditorToolbar.module.css";

interface EditorToolbarProps {
  editor: Editor;
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const [linkUrl, setLinkUrl] = useState("");
  const [linkOpened, setLinkOpened] = useState(false);

  const setLink = () => {
    if (linkUrl) {
      editor.chain().focus().setLink({ href: linkUrl }).run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
    setLinkOpened(false);
    setLinkUrl("");
  };

  const openLinkPopover = () => {
    const existing = editor.getAttributes("link").href as string | undefined;
    setLinkUrl(existing ?? "");
    setLinkOpened(true);
  };

  return (
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
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        title="Code Block"
      >
        <IconCodeDots size={16} />
      </ActionIcon>

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
            }}
            size="xs"
            style={{ width: 250 }}
          />
        </Popover.Dropdown>
      </Popover>

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
    </Group>
  );
}
