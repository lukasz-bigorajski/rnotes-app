import { ActionIcon, Menu, Divider } from "@mantine/core";
import {
  IconRowInsertTop,
  IconRowInsertBottom,
  IconColumnInsertLeft,
  IconColumnInsertRight,
  IconRowRemove,
  IconColumnRemove,
  IconTable,
  IconTableOff,
  IconTablePlus,
  IconArrowMerge,
  IconArrowsSplit,
} from "@tabler/icons-react";
import type { Editor } from "@tiptap/react";
import { useEffect, useState, useCallback } from "react";
import classes from "./TableMenu.module.css";

interface TableMenuProps {
  editor: Editor;
}

export function TableMenu({ editor }: TableMenuProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    if (!editor.isActive("table")) {
      setVisible(false);
      return;
    }

    const { view } = editor;
    const { from } = view.state.selection;
    const domAtPos = view.domAtPos(from);
    const node =
      domAtPos.node instanceof HTMLElement
        ? domAtPos.node
        : domAtPos.node.parentElement;
    const tableEl = node?.closest("table");

    if (!tableEl) {
      setVisible(false);
      return;
    }

    const tableRect = tableEl.getBoundingClientRect();

    setPosition({
      top: tableRect.top - 4,
      left: tableRect.right + 4,
    });
    setVisible(true);
  }, [editor]);

  useEffect(() => {
    editor.on("selectionUpdate", updatePosition);
    return () => {
      editor.off("selectionUpdate", updatePosition);
    };
  }, [editor, updatePosition]);

  if (!visible) return null;

  return (
    <div
      className={classes.tableMenuContainer}
      style={{ top: position.top, left: position.left }}
    >
      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          <ActionIcon
            variant="filled"
            size="sm"
            title="Table Options"
            className={classes.tableMenuButton}
          >
            <IconTable size={16} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>Rows</Menu.Label>
          <Menu.Item
            leftSection={<IconRowInsertTop size={14} />}
            disabled={!editor.can().addRowBefore()}
            onClick={() => editor.chain().focus().addRowBefore().run()}
            data-testid="table-menu-add-row-before"
          >
            Add Row Above
          </Menu.Item>
          <Menu.Item
            leftSection={<IconRowInsertBottom size={14} />}
            disabled={!editor.can().addRowAfter()}
            onClick={() => editor.chain().focus().addRowAfter().run()}
            data-testid="table-menu-add-row-after"
          >
            Add Row Below
          </Menu.Item>
          <Menu.Item
            leftSection={<IconRowRemove size={14} />}
            disabled={!editor.can().deleteRow()}
            onClick={() => editor.chain().focus().deleteRow().run()}
            data-testid="table-menu-delete-row"
          >
            Delete Row
          </Menu.Item>

          <Divider />

          <Menu.Label>Columns</Menu.Label>
          <Menu.Item
            leftSection={<IconColumnInsertLeft size={14} />}
            disabled={!editor.can().addColumnBefore()}
            onClick={() => editor.chain().focus().addColumnBefore().run()}
            data-testid="table-menu-add-column-before"
          >
            Add Column Left
          </Menu.Item>
          <Menu.Item
            leftSection={<IconColumnInsertRight size={14} />}
            disabled={!editor.can().addColumnAfter()}
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            data-testid="table-menu-add-column-after"
          >
            Add Column Right
          </Menu.Item>
          <Menu.Item
            leftSection={<IconColumnRemove size={14} />}
            disabled={!editor.can().deleteColumn()}
            onClick={() => editor.chain().focus().deleteColumn().run()}
            data-testid="table-menu-delete-column"
          >
            Delete Column
          </Menu.Item>

          <Divider />

          <Menu.Label>Cells</Menu.Label>
          <Menu.Item
            leftSection={<IconArrowMerge size={14} />}
            disabled={!editor.can().mergeCells()}
            onClick={() => editor.chain().focus().mergeCells().run()}
            data-testid="table-menu-merge-cells"
          >
            Merge Cells
          </Menu.Item>
          <Menu.Item
            leftSection={<IconArrowsSplit size={14} />}
            disabled={!editor.can().splitCell()}
            onClick={() => editor.chain().focus().splitCell().run()}
            data-testid="table-menu-split-cell"
          >
            Split Cell
          </Menu.Item>

          <Divider />

          <Menu.Label>Table</Menu.Label>
          <Menu.Item
            leftSection={<IconTablePlus size={14} />}
            disabled={!editor.can().toggleHeaderRow()}
            onClick={() => editor.chain().focus().toggleHeaderRow().run()}
            data-testid="table-menu-toggle-header-row"
          >
            Toggle Header Row
          </Menu.Item>
          <Menu.Item
            leftSection={<IconTablePlus size={14} />}
            disabled={!editor.can().toggleHeaderColumn()}
            onClick={() => editor.chain().focus().toggleHeaderColumn().run()}
            data-testid="table-menu-toggle-header-column"
          >
            Toggle Header Column
          </Menu.Item>
          <Menu.Item
            leftSection={<IconTableOff size={14} />}
            disabled={!editor.can().deleteTable()}
            onClick={() => editor.chain().focus().deleteTable().run()}
            data-testid="table-menu-delete-table"
            color="red"
          >
            Delete Table
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </div>
  );
}
