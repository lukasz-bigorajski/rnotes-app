import { DragOverlay as DndDragOverlay } from "@dnd-kit/core";
import { Group } from "@mantine/core";
import { IconFolder, IconNote } from "@tabler/icons-react";
import classes from "./NoteTree.module.css";

interface DragOverlayProps {
  isDragging: boolean;
  draggedTitle: string | null;
  isDraggingFolder: boolean;
}

/**
 * Visual feedback overlay showing what is being dragged.
 * DndDragOverlay must always be mounted so dnd-kit knows to suppress
 * the default transform on the source element. Only the children are conditional.
 */
export function DragOverlay({
  isDragging,
  draggedTitle,
  isDraggingFolder,
}: DragOverlayProps) {
  return (
    <DndDragOverlay>
      {isDragging && draggedTitle ? (
        <Group gap={6} className={classes.dragOverlay}>
          {isDraggingFolder ? (
            <IconFolder size={16} className={classes.folderIcon} />
          ) : (
            <IconNote size={16} className={classes.noteIcon} />
          )}
          <span className={classes.label}>{draggedTitle}</span>
        </Group>
      ) : null}
    </DndDragOverlay>
  );
}
