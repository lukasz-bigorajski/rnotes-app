import { useMemo } from "react";
import { Tree, RenderTreeNodePayload, Group } from "@mantine/core";
import { IconFolder, IconFolderOpen, IconNote } from "@tabler/icons-react";
import { useTree } from "@mantine/core";
import { buildTree } from "../../utils/buildTree";
import type { NoteRow } from "../../ipc/notes";
import type { TreeNodeData } from "@mantine/core";
import classes from "./NoteTree.module.css";

interface NoteTreeProps {
  notes: NoteRow[];
  activeNoteId: string | null;
  setActiveNoteId: (id: string | null) => void;
}

/**
 * Custom TreeNode renderer that displays folders with expand/collapse icons
 * and notes with note icons. Clicking a note selects it, clicking a folder
 * expands/collapses it.
 */
function renderNode(
  payload: RenderTreeNodePayload,
  tree: ReturnType<typeof useTree>,
  activeNoteId: string | null,
  setActiveNoteId: (id: string | null) => void
) {
  const { node, expanded, elementProps } = payload;
  const isFolder = (node.nodeProps as { isFolder: boolean }).isFolder;
  const isActive = node.value === activeNoteId;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isFolder) {
      // Toggle expand state for folders
      tree.toggleExpanded(node.value);
    } else {
      // Select note for non-folders
      setActiveNoteId(node.value);
    }
  };

  return (
    <Group
      gap={6}
      {...elementProps}
      onClick={handleClick}
      className={`${classes.treeNode} ${isActive ? classes.selected : ""}`}
      data-selected={isActive}
    >
      {isFolder ? (
        expanded ? (
          <IconFolderOpen size={16} className={classes.folderIcon} />
        ) : (
          <IconFolder size={16} className={classes.folderIcon} />
        )
      ) : (
        <IconNote size={16} className={classes.noteIcon} />
      )}
      <span className={classes.label}>{node.label}</span>
    </Group>
  );
}

export function NoteTree({
  notes,
  activeNoteId,
  setActiveNoteId,
}: NoteTreeProps) {
  const tree = useTree({
    multiple: false,
  });

  const treeData = useMemo<TreeNodeData[]>(() => buildTree(notes), [notes]);

  return (
    <Tree
      data={treeData}
      tree={tree}
      renderNode={(payload) =>
        renderNode(payload, tree, activeNoteId, setActiveNoteId)
      }
      classNames={classes}
    />
  );
}
