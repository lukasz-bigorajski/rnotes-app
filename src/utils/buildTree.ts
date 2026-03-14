import type { NoteRow } from "../ipc/notes";
import type { TreeNodeData } from "@mantine/core";

/**
 * Builds a hierarchical tree structure from a flat array of notes.
 *
 * - Groups notes by parent_id
 * - Sorts children by sort_order
 * - Folders sort before notes within the same parent (convention)
 * - Handles orphaned notes gracefully (if a parent was deleted, treat as root)
 * - Each TreeNodeData.value = note id, label = note title
 * - Attaches nodeProps with { isFolder: boolean } for custom rendering
 */
export function buildTree(notes: NoteRow[]): TreeNodeData[] {
  const noteMap = new Map<string, NoteRow>();
  const orphans: NoteRow[] = [];

  // Build a map of notes by ID for quick lookup
  notes.forEach((note) => {
    noteMap.set(note.id, note);
  });

  // Identify orphaned notes (parent_id references a note that doesn't exist)
  notes.forEach((note) => {
    if (note.parent_id && !noteMap.has(note.parent_id)) {
      orphans.push(note);
    }
  });

  // Build the tree recursively
  const rootNodes = notes.filter((note) => !note.parent_id);
  const addOrphansAsRoot = orphans.filter((orphan) => !orphan.parent_id);
  const allRoots = [...rootNodes, ...addOrphansAsRoot];

  return buildTreeNode(allRoots, noteMap);
}

/**
 * Recursively builds TreeNodeData for a set of parent notes.
 */
function buildTreeNode(
  parentNotes: NoteRow[],
  noteMap: Map<string, NoteRow>
): TreeNodeData[] {
  // Sort: folders first, then by sort_order
  const sorted = [...parentNotes].sort((a, b) => {
    if (a.is_folder !== b.is_folder) {
      return a.is_folder ? -1 : 1;
    }
    return a.sort_order - b.sort_order;
  });

  return sorted.map((note) => {
    // Find children of this note
    const children = Array.from(noteMap.values()).filter(
      (n) => n.parent_id === note.id
    );

    const treeNode: TreeNodeData = {
      value: note.id,
      label: note.title || "Untitled",
      nodeProps: {
        isFolder: note.is_folder,
      },
    };

    // Only add children if this is a folder or if it has children
    if (children.length > 0) {
      treeNode.children = buildTreeNode(children, noteMap);
    }

    return treeNode;
  });
}
