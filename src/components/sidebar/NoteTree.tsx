import { useMemo, useState } from "react";
import { Tree, RenderTreeNodePayload, Group } from "@mantine/core";
import { IconFolder, IconFolderOpen, IconNote } from "@tabler/icons-react";
import { useTree } from "@mantine/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { buildTree } from "../../utils/buildTree";
import type { NoteRow } from "../../ipc/notes";
import type { TreeNodeData } from "@mantine/core";
import { renameNote, deleteNoteTree, createNote } from "../../ipc/notes";
import { InlineRenameInput } from "./InlineRenameInput";
import { TreeNodeMenu } from "./TreeNodeMenu";
import classes from "./NoteTree.module.css";

interface NoteTreeProps {
  notes: NoteRow[];
  activeNoteId: string | null;
  setActiveNoteId: (id: string | null) => void;
  onNotesChanged: () => void;
  isDragging?: boolean;
  draggedNoteId?: string | null;
}

/**
 * Draggable tree node with drop zone support.
 * Handles drag/drop integration via @dnd-kit hooks.
 */
function DraggableTreeNode({
  nodeId,
  payload,
  tree,
  activeNoteId,
  setActiveNoteId,
  renamingNodeId,
  setRenamingNodeId,
  isRenamingLoading,
  onRenameSubmit,
  onDelete,
  onCreateNote,
  draggedNoteId,
}: {
  nodeId: string;
  payload: RenderTreeNodePayload;
  tree: ReturnType<typeof useTree>;
  activeNoteId: string | null;
  setActiveNoteId: (id: string | null) => void;
  renamingNodeId: string | null;
  setRenamingNodeId: (id: string | null) => void;
  isRenamingLoading: boolean;
  onRenameSubmit: (id: string, newTitle: string) => void;
  onDelete: (id: string) => void;
  onCreateNote: (parentId: string, title: string, isFolder: boolean) => void;
  draggedNoteId?: string | null;
}) {
  const { node, expanded, elementProps } = payload;
  const isFolder = (node.nodeProps as { isFolder: boolean }).isFolder;
  const isActive = node.value === activeNoteId;
  const isRenaming = renamingNodeId === node.value;
  const isDraggedNode = draggedNoteId === nodeId;

  // Setup draggable
  const {
    attributes: draggableAttributes,
    listeners: draggableListeners,
    transform,
  } = useDraggable({
    id: nodeId,
  });

  // Setup droppable (only for folders to allow drop)
  const {
    isOver,
    setNodeRef: setDroppableRef,
  } = useDroppable({
    id: nodeId,
    disabled: !isFolder,
  });

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isFolder) {
      tree.toggleExpanded(node.value);
    } else {
      setActiveNoteId(node.value);
    }
  };

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        opacity: isDraggedNode ? 0.5 : 1,
      }
    : {};

  if (isRenaming) {
    const labelStr = typeof node.label === "string" ? node.label : String(node.label);
    return (
      <Group
        gap={6}
        {...elementProps}
        className={classes.treeNode}
        onClick={(e) => e.stopPropagation()}
        style={style}
      >
        {isFolder ? (
          <IconFolder size={16} className={classes.folderIcon} />
        ) : (
          <IconNote size={16} className={classes.noteIcon} />
        )}
        <InlineRenameInput
          initialValue={labelStr}
          onCommit={(newTitle) => onRenameSubmit(node.value, newTitle)}
          onCancel={() => setRenamingNodeId(null)}
          isLoading={isRenamingLoading}
        />
      </Group>
    );
  }

  const nodeRef = isFolder ? setDroppableRef : undefined;
  const className = `${classes.treeNode} ${isActive ? classes.selected : ""} ${
    isDraggedNode ? classes.dragging : ""
  } ${isOver ? classes.dropZoneActive : ""}`;

  return (
    <Group
      ref={nodeRef}
      gap={6}
      {...elementProps}
      {...draggableAttributes}
      {...draggableListeners}
      onClick={handleClick}
      className={className}
      data-selected={isActive}
      style={style}
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
      <TreeNodeMenu
        nodeId={node.value}
        isFolder={isFolder}
        onRename={() => setRenamingNodeId(node.value)}
        onDelete={onDelete}
        onCreateNote={onCreateNote}
      />
    </Group>
  );
}

/**
 * Custom TreeNode renderer that displays folders with expand/collapse icons
 * and notes with note icons. Clicking a note selects it, clicking a folder
 * expands/collapses it. Right-click shows context menu for rename/delete/create.
 */
function renderNode(
  payload: RenderTreeNodePayload,
  tree: ReturnType<typeof useTree>,
  activeNoteId: string | null,
  setActiveNoteId: (id: string | null) => void,
  renamingNodeId: string | null,
  setRenamingNodeId: (id: string | null) => void,
  isRenamingLoading: boolean,
  onRenameSubmit: (id: string, newTitle: string) => void,
  onDelete: (id: string) => void,
  onCreateNote: (parentId: string, title: string, isFolder: boolean) => void,
  _isDragging?: boolean,
  draggedNoteId?: string | null
) {
  const { node } = payload;
  const nodeId = node.value;

  return (
    <DraggableTreeNode
      nodeId={nodeId}
      payload={payload}
      tree={tree}
      activeNoteId={activeNoteId}
      setActiveNoteId={setActiveNoteId}
      renamingNodeId={renamingNodeId}
      setRenamingNodeId={setRenamingNodeId}
      isRenamingLoading={isRenamingLoading}
      onRenameSubmit={onRenameSubmit}
      onDelete={onDelete}
      onCreateNote={onCreateNote}
      draggedNoteId={draggedNoteId}
    />
  );
}

export function NoteTree({
  notes,
  activeNoteId,
  setActiveNoteId,
  onNotesChanged,
  isDragging: _isDragging,
  draggedNoteId,
}: NoteTreeProps) {
  const tree = useTree({
    multiple: false,
  });

  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
  const [isRenamingLoading, setIsRenamingLoading] = useState(false);

  const treeData = useMemo<TreeNodeData[]>(() => buildTree(notes), [notes]);

  const handleRenameSubmit = async (id: string, newTitle: string) => {
    setIsRenamingLoading(true);
    try {
      await renameNote({ id, title: newTitle });
      setRenamingNodeId(null);
      onNotesChanged();
    } catch (err) {
      console.error("Failed to rename note:", err);
    } finally {
      setIsRenamingLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const note = notes.find((n) => n.id === id);
      if (note?.is_folder) {
        // Delete entire tree for folders
        await deleteNoteTree(id);
      } else {
        // Delete single note
        await deleteNoteTree(id);
      }
      if (activeNoteId === id) {
        setActiveNoteId(null);
      }
      onNotesChanged();
    } catch (err) {
      console.error("Failed to delete note:", err);
    }
  };

  const handleCreateNote = async (
    parentId: string,
    title: string,
    isFolder: boolean
  ) => {
    try {
      await createNote({
        parentId,
        title,
        isFolder,
      });
      onNotesChanged();
    } catch (err) {
      console.error("Failed to create note:", err);
    }
  };

  return (
    <Tree
      data={treeData}
      tree={tree}
      renderNode={(payload) =>
        renderNode(
          payload,
          tree,
          activeNoteId,
          setActiveNoteId,
          renamingNodeId,
          setRenamingNodeId,
          isRenamingLoading,
          handleRenameSubmit,
          handleDelete,
          handleCreateNote,
          _isDragging,
          draggedNoteId
        )
      }
      classNames={classes}
    />
  );
}
