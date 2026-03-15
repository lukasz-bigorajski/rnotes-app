import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useCallback, useMemo, useState } from "react";
import type { NoteRow } from "../../ipc/notes";
import { moveNote } from "../../ipc/notes";
import { calcSortOrder, type Sibling } from "../../utils/calcSortOrder";
import { NoteTree } from "./NoteTree";
import { DragOverlay } from "./DragOverlay";

interface DraggableTreeProps {
  notes: NoteRow[];
  activeNoteId: string | null;
  setActiveNoteId: (id: string | null) => void;
  onNotesChanged: () => void;
}

/**
 * Wrapper component that integrates @dnd-kit drag-and-drop functionality with NoteTree.
 * Handles:
 * - Drag start/end events
 * - Calculating new sort_order using fractional positioning
 * - Calling moveNote IPC to update backend
 * - Circular reference detection (backend validates)
 * - Refreshing notes after drag operations
 */
export function DraggableTree({
  notes,
  activeNoteId,
  setActiveNoteId,
  onNotesChanged,
}: DraggableTreeProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);

  // Sensor config: pointer with small activation distance
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const draggedNote = useMemo(
    () => notes.find((n) => n.id === draggedNoteId),
    [notes, draggedNoteId]
  );

  /** Returns true if `ancestorId` is an ancestor of `nodeId` (circular move check). */
  const isDescendant = useCallback(
    (nodeId: string, ancestorId: string): boolean => {
      const children = notes.filter(
        (n) => n.parent_id === ancestorId && n.deleted_at === null,
      );
      for (const child of children) {
        if (child.id === nodeId) return true;
        if (child.is_folder && isDescendant(nodeId, child.id)) return true;
      }
      return false;
    },
    [notes],
  );

  const handleDragStart = (event: DragStartEvent) => {
    setIsDragging(true);
    setDraggedNoteId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setIsDragging(false);
    setDraggedNoteId(null);

    const { active, over } = event;

    // No valid drop target
    if (!over) {
      return;
    }

    const draggedId = active.id as string;
    const targetId = over.id as string;

    // Dropped onto itself — no-op
    if (draggedId === targetId) {
      return;
    }

    try {
      // Determine new parent and sort order from drop target
      const targetNote = notes.find((n) => n.id === targetId);
      if (!targetNote) {
        console.error("Target note not found:", targetId);
        return;
      }

      // Prevent circular moves: cannot drop a folder into its own descendant
      const draggedNoteObj = notes.find((n) => n.id === draggedId);
      if (
        draggedNoteObj?.is_folder &&
        targetNote.is_folder &&
        isDescendant(targetId, draggedId)
      ) {
        console.warn("Cannot move folder into its own descendant");
        return;
      }

      // Get siblings of the target to calculate sort_order
      const targetParentId = targetNote.parent_id;
      const targetSiblings: Sibling[] = notes
        .filter(
          (n) =>
            n.parent_id === targetParentId &&
            n.deleted_at === null &&
            n.id !== draggedId // Exclude the dragged item itself
        )
        .map((n) => ({
          id: n.id,
          sort_order: n.sort_order,
        }))
        .sort((a, b) => a.sort_order - b.sort_order);

      // Find the index of the target in its siblings
      const targetIndex = targetSiblings.findIndex((s) => s.id === targetId);
      if (targetIndex === -1) {
        console.error("Target not found in siblings");
        return;
      }

      // If dropped on a folder, insert as first child of that folder.
      // Otherwise insert before the target — the CSS border-top on the drop zone
      // visually suggests "insert above/before", so the code matches the visual.
      let newParentId: string | null = targetParentId;
      let newSortOrder: number;

      if (targetNote.is_folder) {
        // Move into the folder as first child
        newParentId = targetNote.id;
        const folderChildSiblings: Sibling[] = notes
          .filter(
            (n) => n.parent_id === targetNote.id && n.deleted_at === null
          )
          .map((n) => ({
            id: n.id,
            sort_order: n.sort_order,
          }))
          .sort((a, b) => a.sort_order - b.sort_order);

        newSortOrder = calcSortOrder(folderChildSiblings, 0); // Insert as first child
      } else {
        // Move to same level, before the target (matches the border-top visual cue)
        newSortOrder = calcSortOrder(targetSiblings, targetIndex);
      }

      // Call backend to move note
      await moveNote({
        id: draggedId,
        newParentId,
        newSortOrder,
      });

      // Refresh notes list
      onNotesChanged();
    } catch (err) {
      console.error("Failed to move note:", err);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <NoteTree
        notes={notes}
        activeNoteId={activeNoteId}
        setActiveNoteId={setActiveNoteId}
        onNotesChanged={onNotesChanged}
        isDragging={isDragging}
        draggedNoteId={draggedNoteId}
      />

      <DragOverlay
        isDragging={isDragging}
        draggedTitle={draggedNote?.title ?? null}
        isDraggingFolder={draggedNote?.is_folder ?? false}
      />
    </DndContext>
  );
}
