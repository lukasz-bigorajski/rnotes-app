import { Extension } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export const HeadingShortcutsExtension = Extension.create({
  name: "headingShortcuts",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("headingShortcuts"),
        props: {
          handleDOMEvents: {
            // Use beforeinput event to catch text before it's processed
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            beforeinput: (view, event: any) => {
              if (event.inputType !== "insertText" || event.data === null) {
                return false;
              }

              const { state } = view;
              const $pos = state.doc.resolve(state.selection.from);

              // Only process if we're in a paragraph
              if ($pos.parent.type.name !== "paragraph") {
                return false;
              }

              // Get the full text of the paragraph after this character will be inserted
              const textInPara = $pos.parent.textContent + event.data;

              // Check if text ends with ..hN pattern (N = 1-6)
              const match = textInPara.match(/^(.*)\.\.h([1-6])$/);
              if (!match) {
                return false;
              }

              // Prevent default input
              event.preventDefault();

              const [, contentText, levelStr] = match;
              const level = parseInt(levelStr, 10);

              // Find the paragraph node position
              let paraPos = 0;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              state.doc.nodesBetween(0, state.selection.from + 1, (node: any, pos: number) => {
                if (node.type.name === "paragraph") {
                  paraPos = pos;
                }
              });

              const para = state.doc.nodeAt(paraPos);
              if (!para) return true;

              // Create heading with the content text (without the trigger)
              const headingContent = contentText ? [state.schema.text(contentText)] : [];
              const heading = state.schema.nodes.heading.create({ level }, headingContent);

              // Replace paragraph with heading
              const tr = state.tr.replaceWith(paraPos, paraPos + para.nodeSize, heading);
              view.dispatch(tr);

              return true;
            },
          },
        },
      }),
    ];
  },
});
