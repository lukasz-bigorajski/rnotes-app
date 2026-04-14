import { Menu, ActionIcon } from "@mantine/core";
import {
  IconCopy,
  IconDots,
  IconFileText,
  IconFolderPlus,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";

interface TreeNodeMenuProps {
  nodeId: string;
  isFolder: boolean;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
  onCreateNote: (parentId: string, title: string, isFolder: boolean) => void;
  onCopy: (id: string) => void;
}

export function TreeNodeMenu({
  nodeId,
  isFolder,
  onRename,
  onDelete,
  onCreateNote,
  onCopy,
}: TreeNodeMenuProps) {
  return (
    <Menu position="bottom-start" shadow="md">
      <Menu.Target>
        <ActionIcon variant="subtle" size="xs" onClick={(e) => e.stopPropagation()}>
          <IconDots size={14} />
        </ActionIcon>
      </Menu.Target>

      <Menu.Dropdown>
        {isFolder && (
          <>
            <Menu.Item
              leftSection={<IconFileText size={14} />}
              onClick={() => onCreateNote(nodeId, "Untitled", false)}
            >
              New Note
            </Menu.Item>
            <Menu.Item
              leftSection={<IconFolderPlus size={14} />}
              onClick={() => onCreateNote(nodeId, "Untitled Folder", true)}
            >
              New Folder
            </Menu.Item>
            <Menu.Divider />
          </>
        )}
        <Menu.Item
          leftSection={<IconPencil size={14} />}
          onClick={() => onRename(nodeId)}
        >
          Rename
        </Menu.Item>
        {!isFolder && (
          <Menu.Item
            leftSection={<IconCopy size={14} />}
            onClick={() => onCopy(nodeId)}
          >
            Duplicate
          </Menu.Item>
        )}
        <Menu.Item
          color="red"
          leftSection={<IconTrash size={14} />}
          onClick={() => onDelete(nodeId)}
        >
          Delete
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
