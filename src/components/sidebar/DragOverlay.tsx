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
 * Displayed near the cursor during drag operations.
 */
export function DragOverlay({
  isDragging,
  draggedTitle,
  isDraggingFolder,
}: DragOverlayProps) {
  if (!isDragging || !draggedTitle) {
    return null;
  }

  return (
    <DndDragOverlay>
      <Group gap={6} className={classes.dragOverlay}>
        {isDraggingFolder ? (
          <IconFolder size={16} className={classes.folderIcon} />
        ) : (
          <IconNote size={16} className={classes.noteIcon} />
        )}
        <span className={classes.label}>{draggedTitle}</span>
      </Group>
    </DndDragOverlay>
  );
}
