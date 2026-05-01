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
import type { MutableRefObject } from "react";
import type { NoteRow } from "../../ipc/notes";
import { moveNote } from "../../ipc/notes";
import { calcSortOrder, type Sibling } from "../../utils/calcSortOrder";
import { NoteTree } from "./NoteTree";
import { DragOverlay } from "./DragOverlay";
import { useTree } from "@mantine/core";

interface DraggableTreeProps {
  notes: NoteRow[];
  activeNoteId: string | null;
  setActiveNoteId: (id: string | null) => void;
  onNotesChanged: () => void;
  tree: ReturnType<typeof useTree>;
  refreshActiveNoteRef?: MutableRefObject<(() => void) | null>;
  pendingRenameId?: string | null;
  onPendingRenameConsumed?: () => void;
  focusSidebarRef?: MutableRefObject<(() => void) | null>;
  focusEditorRef?: MutableRefObject<(() => void) | null>;
}

export function DraggableTree({
  notes,
  activeNoteId,
  setActiveNoteId,
  onNotesChanged,
  tree,
  refreshActiveNoteRef,
  pendingRenameId,
  onPendingRenameConsumed,
  focusSidebarRef,
  focusEditorRef,
}: DraggableTreeProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);

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

    const { active, over, delta } = event;

    if (!over) {
      return;
    }

    const draggedId = active.id as string;
    const targetId = (over.id as string).replace(/^drop-/, "");

    if (draggedId === targetId) {
      return;
    }

    try {
      const targetNote = notes.find((n) => n.id === targetId);
      if (!targetNote) {
        console.error("Target note not found:", targetId);
        return;
      }

      const draggedNoteObj = notes.find((n) => n.id === draggedId);
      if (
        draggedNoteObj?.is_folder &&
        targetNote.is_folder &&
        isDescendant(targetId, draggedId)
      ) {
        console.warn("Cannot move folder into its own descendant");
        return;
      }

      const targetParentId = targetNote.parent_id;
      const targetSiblings: Sibling[] = notes
        .filter(
          (n) =>
            n.parent_id === targetParentId &&
            n.deleted_at === null &&
            n.id !== draggedId
        )
        .map((n) => ({
          id: n.id,
          sort_order: n.sort_order,
        }))
        .sort((a, b) => a.sort_order - b.sort_order);

      const targetIndex = targetSiblings.findIndex((s) => s.id === targetId);
      if (targetIndex === -1) {
        console.error("Target not found in siblings");
        return;
      }

      let newParentId: string | null = targetParentId;
      let newSortOrder: number;

      if (targetNote.is_folder) {
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

        newSortOrder = calcSortOrder(folderChildSiblings, 0);
      } else {
        // Determine insert before or after based on where the dragged item's
        // translated rect center is relative to the target's vertical midpoint.
        // active.rect.current.translated is dnd-kit's authoritative current position.
        // Fall back to initial + delta when translated is null (e.g. in headless tests).
        const translatedRect = active.rect.current.translated;
        const initialRect = active.rect.current.initial;
        const dragCenterY = translatedRect
          ? translatedRect.top + translatedRect.height / 2
          : initialRect
          ? initialRect.top + delta.y + initialRect.height / 2
          : over.rect.top + over.rect.height / 2;
        const overMidY = over.rect.top + over.rect.height / 2;
        const insertAfter = dragCenterY > overMidY;

        const insertIndex = insertAfter ? targetIndex + 1 : targetIndex;
        newSortOrder = calcSortOrder(targetSiblings, insertIndex);
      }

      await moveNote({
        id: draggedId,
        newParentId,
        newSortOrder,
      });

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
        tree={tree}
        refreshActiveNoteRef={refreshActiveNoteRef}
        pendingRenameId={pendingRenameId}
        onPendingRenameConsumed={onPendingRenameConsumed}
        focusSidebarRef={focusSidebarRef}
        focusEditorRef={focusEditorRef}
      />

      <DragOverlay
        isDragging={isDragging}
        draggedTitle={draggedNote?.title ?? null}
        isDraggingFolder={draggedNote?.is_folder ?? false}
      />
    </DndContext>
  );
}
