import { Extension } from "@tiptap/react";

export const LineOperationsExtension = Extension.create({
  name: "lineOperations",

  addKeyboardShortcuts() {
    return {
      "Mod-d": () => {
        const { state, dispatch } = this.editor.view;
        const { selection, tr } = state;
        const { $from } = selection;
        const node = $from.node($from.depth);
        const nodeEnd = $from.after($from.depth);
        const copy = node.copy(node.content);
        dispatch(tr.insert(nodeEnd, copy));
        return true;
      },
      "Mod-y": () => {
        const { state, dispatch } = this.editor.view;
        const { selection, tr } = state;
        const { $from } = selection;
        const nodeStart = $from.before($from.depth);
        const nodeEnd = $from.after($from.depth);
        // Don't delete if it's the only block
        if (nodeStart === 0 && nodeEnd === state.doc.nodeSize - 2) return false;
        dispatch(tr.delete(nodeStart, nodeEnd));
        return true;
      },
    };
  },
});
