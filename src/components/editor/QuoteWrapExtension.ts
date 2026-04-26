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

              // Stage 3: selection already has inline code mark → convert paragraph to code block
              if (codeMarkType && state.doc.rangeHasMark(from, to, codeMarkType)) {
                const codeBlockType = state.schema.nodes.codeBlock;
                if (codeBlockType) {
                  const selectedText = state.doc.textBetween(from, to);
                  const $anchor = state.doc.resolve(from);
                  const nodeStart = $anchor.before($anchor.depth);
                  const nodeEnd = $anchor.after($anchor.depth);
                  const codeBlock = selectedText
                    ? codeBlockType.create({}, state.schema.text(selectedText))
                    : codeBlockType.create({});
                  view.dispatch(state.tr.replaceWith(nodeStart, nodeEnd, codeBlock));
                  return true;
                }
              }

              // Stage 2: selection is surrounded by backtick chars → apply inline code mark
              if (
                codeMarkType &&
                from > 0 &&
                to < state.doc.content.size &&
                state.doc.textBetween(from - 1, from) === "`" &&
                state.doc.textBetween(to, to + 1) === "`"
              ) {
                // Remove the surrounding backtick chars and apply code mark.
                // Delete trailing backtick first (higher index), then leading, to keep positions stable.
                const tr = state.tr
                  .delete(to, to + 1)
                  .delete(from - 1, from)
                  .addMark(from - 1, to - 1, codeMarkType.create());
                const newSel = TextSelection.create(tr.doc, from - 1, to - 1);
                view.dispatch(tr.setSelection(newSel));
                return true;
              }

              // Stage 1: plain selection → wrap with backtick chars, keep inner text selected
              const wrapTr = state.tr.insertText("`", to).insertText("`", from);
              const newSel = TextSelection.create(wrapTr.doc, from + 1, to + 1);
              view.dispatch(wrapTr.setSelection(newSel));
              return true;
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
