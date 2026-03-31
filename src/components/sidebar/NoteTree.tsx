import { useCallback, useMemo, useState } from "react";
import { Tree, RenderTreeNodePayload, Group } from "@mantine/core";
import { IconFolder, IconFolderOpen, IconNote } from "@tabler/icons-react";
import { useTree } from "@mantine/core";
import { modals } from "@mantine/modals";
import { Text } from "@mantine/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { buildTree } from "../../utils/buildTree";
import type { NoteRow } from "../../ipc/notes";
import type { TreeNodeData } from "@mantine/core";
import { renameNote, deleteNoteTree, createNote } from "../../ipc/notes";
import { notifyError } from "../../utils/notify";
import { InlineRenameInput } from "./InlineRenameInput";
import { TreeNodeMenu } from "./TreeNodeMenu";
import classes from "./NoteTree.module.css";

interface NoteTreeProps {
  notes: NoteRow[];
  activeNoteId: string | null;
  setActiveNoteId: (id: string | null) => void;
  onNotesChanged: () => void;
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
  // Bug fix: extract setNodeRef so dnd-kit can track the draggable's bounding rect
  const {
    attributes: draggableAttributes,
    listeners: draggableListeners,
    setNodeRef: setDraggableRef,
    isDragging,
  } = useDraggable({
    id: nodeId,
    disabled: isRenaming,
  });

  // Setup droppable — use a distinct ID to avoid collision with the draggable
  // (same element, but dnd-kit needs separate IDs so the active draggable
  // isn't detected as its own drop target by pointerWithin)
  const { isOver, setNodeRef: setDroppableRef } = useDroppable({
    id: `drop-${nodeId}`,
    disabled: isRenaming,
  });

  // Merge both refs onto the same DOM element
  const setRef = useCallback(
    (el: HTMLElement | null) => {
      setDraggableRef(el);
      setDroppableRef(el);
    },
    [setDraggableRef, setDroppableRef],
  );

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isFolder) {
      tree.toggleExpanded(node.value);
    } else {
      setActiveNoteId(node.value);
    }
  };

  // When using DragOverlay, do NOT apply the CSS transform to the source element.
  // The overlay follows the cursor; the source element stays in place with reduced opacity.
  const style: React.CSSProperties = isDragging ? { opacity: 0.4 } : {};

  if (isRenaming) {
    const labelStr = typeof node.label === "string" ? node.label : String(node.label);
    return (
      <Group
        gap={6}
        {...elementProps}
        className={[elementProps.className, classes.treeNode].filter(Boolean).join(" ")}
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
    elementProps.className,
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
      ref={setRef}
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

export function NoteTree({
  notes,
  activeNoteId,
  setActiveNoteId,
  onNotesChanged,
}: NoteTreeProps) {
  const tree = useTree({
    multiple: false,
  });

  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
  const [isRenamingLoading, setIsRenamingLoading] = useState(false);

  const treeData = useMemo<TreeNodeData[]>(() => buildTree(notes), [notes]);

  const handleRenameSubmit = useCallback(
    async (id: string, newTitle: string) => {
      setIsRenamingLoading(true);
      try {
        await renameNote({ id, title: newTitle });
        setRenamingNodeId(null);
        onNotesChanged();
      } catch (err) {
        console.error("Failed to rename note:", err);
        notifyError("Rename failed", "Could not rename the note");
      } finally {
        setIsRenamingLoading(false);
      }
    },
    [onNotesChanged],
  );

  const doDelete = useCallback(
    async (id: string) => {
      try {
        await deleteNoteTree(id);
        if (activeNoteId === id) {
          setActiveNoteId(null);
        }
        onNotesChanged();
      } catch (err) {
        console.error("Failed to delete note:", err);
        notifyError("Delete failed", "Could not delete the note");
      }
    },
    [activeNoteId, setActiveNoteId, onNotesChanged],
  );

  const handleDelete = useCallback(
    (id: string) => {
      const noteToDelete = notes.find((n) => n.id === id);
      const noteTitle = noteToDelete?.title ?? "this note";
      const isFolder = noteToDelete?.is_folder ?? false;
      const itemLabel = isFolder ? "folder" : "note";

      modals.openConfirmModal({
        title: `Archive ${itemLabel}`,
        children: (
          <Text size="sm">
            Are you sure you want to archive &ldquo;{noteTitle}&rdquo;? You can restore it from the
            archive later.
          </Text>
        ),
        labels: { confirm: "Archive", cancel: "Cancel" },
        confirmProps: { color: "red", "data-testid": "confirm-archive-btn" },
        onConfirm: () => doDelete(id),
      });
    },
    [notes, doDelete],
  );

  const handleCreateNote = useCallback(
    async (parentId: string, title: string, isFolder: boolean) => {
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
        notifyError("Create failed", "Could not create the note");
      }
    },
    [tree, setActiveNoteId, onNotesChanged],
  );

  // Stabilise the renderNode callback with useCallback so Mantine's Tree does not
  // remount all nodes on every render (which would destroy dnd-kit's internal state
  // mid-drag and break the gesture).
  const stableRenderNode = useCallback(
    (payload: RenderTreeNodePayload) => {
      const { node } = payload;
      return (
        <DraggableTreeNode
          nodeId={node.value}
          payload={payload}
          tree={tree}
          activeNoteId={activeNoteId}
          setActiveNoteId={setActiveNoteId}
          renamingNodeId={renamingNodeId}
          setRenamingNodeId={setRenamingNodeId}
          isRenamingLoading={isRenamingLoading}
          onRenameSubmit={handleRenameSubmit}
          onDelete={handleDelete}
          onCreateNote={handleCreateNote}
        />
      );
    },
    [
      tree,
      activeNoteId,
      setActiveNoteId,
      renamingNodeId,
      isRenamingLoading,
      handleRenameSubmit,
      handleDelete,
      handleCreateNote,
    ],
  );

  return (
    <Tree
      data={treeData}
      tree={tree}
      renderNode={stableRenderNode}
      classNames={classes}
      levelOffset={12}
    />
  );
}
