/**
 * Calculates fractional sort_order for inserting an item at a specific position
 * among its siblings using the midpoint strategy (no renumbering ever needed).
 *
 * @param siblings - Array of {id, sort_order} for all items in the target parent
 * @param targetIndex - Index where the item should be inserted (0-based)
 * @returns New sort_order value
 *
 * Logic:
 * - targetIndex=0 → return first.sort_order / 2
 * - targetIndex>=length → return last.sort_order + 1
 * - else → return (siblings[targetIndex-1].sort_order + siblings[targetIndex].sort_order) / 2
 */
export interface Sibling {
  id: string;
  sort_order: number;
}

export function calcSortOrder(siblings: Sibling[], targetIndex: number): number {
  // Target index is 0 → insert before everything
  if (targetIndex === 0) {
    if (siblings.length === 0) {
      return 1.0;
    }
    // Insert before the first item at half its sort_order
    return siblings[0].sort_order / 2;
  }

  // Target index >= length → append after everything
  if (targetIndex >= siblings.length) {
    if (siblings.length === 0) {
      return 1.0;
    }
    return siblings[siblings.length - 1].sort_order + 1;
  }

  // Insert between targetIndex-1 and targetIndex
  const prev = siblings[targetIndex - 1].sort_order;
  const next = siblings[targetIndex].sort_order;
  return (prev + next) / 2;
}
