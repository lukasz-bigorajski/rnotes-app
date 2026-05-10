import { Extension } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import { TextSelection, Selection } from "@tiptap/pm/state";

// ── DOM-based navigation (word / lineboundary) ────────────────────────────────

function moveByGranularity(
  editor: Editor,
  dir: -1 | 1,
  extend: boolean,
  granularity: string,
): boolean {
  const domSel = window.getSelection();
  if (!domSel || typeof (domSel as { modify?: unknown }).modify !== "function") {
    return false;
  }

  (domSel as { modify: (alter: string, direction: string, granularity: string) => void }).modify(
    extend ? "extend" : "move",
    dir < 0 ? "backward" : "forward",
    granularity,
  );

  // Dispatch a PM transaction to make the new position authoritative instead of
  // relying on async domObserver sync, which can snap back at node-view boundaries.
  const { view } = editor;
  const { state, dispatch } = view;
  try {
    const focusNode = domSel.focusNode;
    if (!focusNode) return true;

    const focusPos = view.posAtDOM(focusNode, domSel.focusOffset);
    const anchorPos = extend
      ? view.posAtDOM(domSel.anchorNode!, domSel.anchorOffset)
      : focusPos;

    dispatch(
      state.tr
        .setSelection(TextSelection.create(state.doc, anchorPos, focusPos))
        .scrollIntoView(),
    );
  } catch {
    // posAtDOM failed (cursor at DOM boundary outside PM mapping); reset DOM to
    // match PM state so the next keypress uses a consistent position.
    try {
      const anchor = view.domAtPos(state.selection.anchor);
      const head = view.domAtPos(state.selection.head);
      domSel.setBaseAndExtent(anchor.node, anchor.offset, head.node, head.offset);
    } catch {
      // ignore — best-effort reset
    }
  }

  return true;
}

// ── Pure-PM document-boundary navigation (Cmd+Up / Cmd+Down) ─────────────────
// Using Selection.atStart/atEnd avoids posAtDOM failures at document edges.

function moveToDocumentBoundary(editor: Editor, dir: -1 | 1, extend: boolean): boolean {
  const { state, dispatch } = editor.view;
  const boundary = dir < 0 ? Selection.atStart(state.doc) : Selection.atEnd(state.doc);

  if (extend) {
    dispatch(
      state.tr
        .setSelection(TextSelection.create(state.doc, state.selection.anchor, boundary.from))
        .scrollIntoView(),
    );
  } else {
    dispatch(state.tr.setSelection(boundary).scrollIntoView());
  }

  return true;
}

// ── Page navigation (PageUp / PageDown / fn+Up / fn+Down on macOS) ───────────
// ProseMirror's default: browser scrolls the viewport but leaves the PM cursor
// where it was. Pressing ArrowUp/Down then snaps back to the pre-scroll position
// via scrollIntoView. Fix: explicitly scroll the nearest overflow container and
// move the cursor to the position now visible at that edge of the viewport.

function findScrollContainer(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement;
  while (node) {
    const { overflowY } = window.getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") return node;
    node = node.parentElement;
  }
  return null;
}

function moveByPage(editor: Editor, dir: -1 | 1, extend: boolean): boolean {
  const { view } = editor;
  const container = findScrollContainer(view.dom as HTMLElement);
  if (!container) return false;

  const rect = container.getBoundingClientRect();
  const pageHeight = rect.height;

  // Save cursor's x coordinate before scrolling so we land on the same column.
  const { state, dispatch } = view;
  const selCoords = view.coordsAtPos(state.selection.head);

  container.scrollTop += dir * pageHeight;

  // After scrolling, find the document position at the new viewport edge.
  const edgeY = dir < 0
    ? rect.top + 10        // near top of the visible container
    : rect.bottom - 10;   // near bottom of the visible container

  const hit = view.posAtCoords({ left: selCoords.left, top: edgeY });

  // Fallback to document boundary when posAtCoords returns nothing (sparse docs).
  const targetPos = hit
    ? hit.pos
    : (dir < 0 ? Selection.atStart(state.doc).from : Selection.atEnd(state.doc).from);

  const newSel = extend
    ? TextSelection.create(state.doc, state.selection.anchor, targetPos)
    : TextSelection.create(state.doc, targetPos);

  dispatch(state.tr.setSelection(newSel));
  return true;
}

// ── Extension ─────────────────────────────────────────────────────────────────

export const WordNavigationExtension = Extension.create({
  name: "wordNavigation",

  addKeyboardShortcuts() {
    return {
      // Word navigation (Option/Alt + Arrow)
      "Alt-ArrowLeft": () => moveByGranularity(this.editor, -1, false, "word"),
      "Alt-ArrowRight": () => moveByGranularity(this.editor, 1, false, "word"),
      "Shift-Alt-ArrowLeft": () => moveByGranularity(this.editor, -1, true, "word"),
      "Shift-Alt-ArrowRight": () => moveByGranularity(this.editor, 1, true, "word"),
      // Line-boundary navigation (Shift + Cmd + Left/Right)
      "Shift-Mod-ArrowLeft": () => moveByGranularity(this.editor, -1, true, "lineboundary"),
      "Shift-Mod-ArrowRight": () => moveByGranularity(this.editor, 1, true, "lineboundary"),
      // Document-boundary navigation (Cmd + Up/Down) — pure PM, no DOM posAtDOM
      "Mod-ArrowUp": () => moveToDocumentBoundary(this.editor, -1, false),
      "Mod-ArrowDown": () => moveToDocumentBoundary(this.editor, 1, false),
      "Shift-Mod-ArrowUp": () => moveToDocumentBoundary(this.editor, -1, true),
      "Shift-Mod-ArrowDown": () => moveToDocumentBoundary(this.editor, 1, true),
      // Page navigation (fn+Up / fn+Down on macOS)
      "PageUp": () => moveByPage(this.editor, -1, false),
      "PageDown": () => moveByPage(this.editor, 1, false),
      "Shift-PageUp": () => moveByPage(this.editor, -1, true),
      "Shift-PageDown": () => moveByPage(this.editor, 1, true),
    };
  },
});
