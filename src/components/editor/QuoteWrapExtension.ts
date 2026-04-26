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

            // Triple backtick → code block:
            // If user types ` and the selection text is already surrounded by ``
            if (char === "`") {
              const selectedText = state.doc.textBetween(from, to);
              if (selectedText.startsWith("``") && selectedText.endsWith("``") && selectedText.length > 4) {
                const innerText = selectedText.slice(2, -2);
                const codeBlockType = state.schema.nodes.codeBlock;
                if (codeBlockType) {
                  const $from = state.doc.resolve(from);
                  const nodeStart = $from.before($from.depth);
                  const nodeEnd = $from.after($from.depth);
                  const codeBlock = innerText
                    ? codeBlockType.create({}, state.schema.text(innerText))
                    : codeBlockType.create({});
                  const replaceTr = state.tr.replaceWith(nodeStart, nodeEnd, codeBlock);
                  view.dispatch(replaceTr);
                  return true;
                }
              }
            }

            // Wrap selection with char on both sides
            const wrapTr = state.tr.insertText(char, to).insertText(char, from);
            const newSelection = TextSelection.create(wrapTr.doc, from + 1, to + 1);
            view.dispatch(wrapTr.setSelection(newSelection));
            return true;
          },
        },
      }),
    ];
  },
});
