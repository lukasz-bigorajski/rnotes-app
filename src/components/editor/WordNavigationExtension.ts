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
    };
  },
});
