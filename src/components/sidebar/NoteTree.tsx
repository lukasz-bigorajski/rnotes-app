import { useMemo, useState } from "react";
import { Tree, RenderTreeNodePayload, Group } from "@mantine/core";
import { IconFolder, IconFolderOpen, IconNote } from "@tabler/icons-react";
import { useTree } from "@mantine/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
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
}) {
  const { node, expanded, hasChildren, elementProps } = payload;
  const isFolder = (node.nodeProps as { isFolder: boolean }).isFolder;
  const isActive = node.value === activeNoteId;
  const isRenaming = renamingNodeId === node.value;
  const showChildIndicator = isFolder && !expanded && hasChildren;

  // Setup draggable — disable when renaming
  const {
    attributes: draggableAttributes,
    listeners: draggableListeners,
    isDragging,
  } = useDraggable({
    id: nodeId,
    disabled: isRenaming,
  });

  // Setup droppable for all nodes (folders accept drops inside, notes allow reordering)
  const { isOver, setNodeRef: setDroppableRef } = useDroppable({
    id: nodeId,
    disabled: isRenaming,
  });

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isFolder) {
      tree.toggleExpanded(node.value);
    } else {
      setActiveNoteId(node.value);
    }
  };

  // When using DragOverlay, do NOT apply the CSS transform to the source element.
  // The overlay follows the cursor; the source element should stay in place and just
  // become semi-transparent to indicate "this item is being moved".
  const style: React.CSSProperties = isDragging ? { opacity: 0.4 } : {};

  if (isRenaming) {
    const labelStr = typeof node.label === "string" ? node.label : String(node.label);
    return (
      <Group
        gap={6}
        {...elementProps}
        className={classes.treeNode}
        onClick={(e) => e.stopPropagation()}
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

  const className = [
    classes.treeNode,
    isActive ? classes.selected : "",
    isDragging ? classes.dragging : "",
    isOver && !isDragging ? classes.dropZoneActive : "",
    isOver && isFolder && !isDragging ? classes.dropZoneFolder : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Group
      ref={setDroppableRef}
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
      {showChildIndicator && <span className={classes.childIndicator} aria-label="has children" />}
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
  onCreateNote: (parentId: string, title: string, isFolder: boolean) => void
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
    />
  );
}

export function NoteTree({
  notes,
  activeNoteId,
  setActiveNoteId,
  onNotesChanged,
  isDragging: _isDragging,
  draggedNoteId: _draggedNoteId,
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
      const note = await createNote({
        parentId,
        title,
        isFolder,
      });
      tree.expand(parentId);
      if (!isFolder) {
        setActiveNoteId(note.id);
      }
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
          handleCreateNote
        )
      }
      classNames={classes}
    />
  );
}
