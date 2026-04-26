import { Extension } from "@tiptap/react";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";

export const QuoteWrapExtension = Extension.create({
  name: "quoteWrap",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("quoteWrap"),
        props: {
          handleKeyDown(view, event) {
            const wrapChars = ['"', "'", "`"];
            if (!wrapChars.includes(event.key)) return false;

            const { state } = view;
            const { selection } = state;
            if (selection.empty) return false;

            const { from, to } = selection;
            const char = event.key;

            if (char === "`") {
              const codeMarkType = state.schema.marks.code;
              const $fromPos = state.doc.resolve(from);
              const $toPos = state.doc.resolve(to);
              const isMultiLine = !$fromPos.sameParent($toPos);

              // Multi-line selection → code block directly
              if (isMultiLine) {
                const codeBlockType = state.schema.nodes.codeBlock;
                if (codeBlockType) {
                  const selectedText = state.doc.textBetween(from, to, "\n");
                  const nodeStart = $fromPos.before($fromPos.depth);
                  const nodeEnd = $toPos.after($toPos.depth);
                  const codeBlock = selectedText
                    ? codeBlockType.create({}, state.schema.text(selectedText))
                    : codeBlockType.create({});
                  view.dispatch(state.tr.replaceWith(nodeStart, nodeEnd, codeBlock));
                  return true;
                }
              }

              // Stage 2: single-line selection with inline code mark → convert paragraph to code block
              if (codeMarkType && state.doc.rangeHasMark(from, to, codeMarkType)) {
                const codeBlockType = state.schema.nodes.codeBlock;
                if (codeBlockType) {
                  const selectedText = state.doc.textBetween(from, to);
                  const nodeStart = $fromPos.before($fromPos.depth);
                  const nodeEnd = $fromPos.after($fromPos.depth);
                  const codeBlock = selectedText
                    ? codeBlockType.create({}, state.schema.text(selectedText))
                    : codeBlockType.create({});
                  view.dispatch(state.tr.replaceWith(nodeStart, nodeEnd, codeBlock));
                  return true;
                }
              }

              // Stage 1: plain single-line selection → apply inline code mark
              if (codeMarkType) {
                view.dispatch(state.tr.addMark(from, to, codeMarkType.create()));
                return true;
              }
            }

            // " and ' → simple char wrap, keep inner text selected
            const wrapTr = state.tr.insertText(char, to).insertText(char, from);
            const newSel = TextSelection.create(wrapTr.doc, from + 1, to + 1);
            view.dispatch(wrapTr.setSelection(newSel));
            return true;
          },
        },
      }),
    ];
  },
});
