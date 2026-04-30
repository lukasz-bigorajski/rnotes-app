import { Extension } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import tippy from "tippy.js";
import type { Instance as TippyInstance } from "tippy.js";
import { searchEmojis } from "./emojiData";
import type { EmojiEntry } from "./emojiData";
import { EmojiList } from "./EmojiList";
import type { EmojiListHandle } from "./EmojiList";

export const EmojiExtension = Extension.create({
  name: "emoji",

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: ":",
        allowSpaces: false,
        startOfLine: false,
        // Require at least 1 character after : before showing suggestions
        allowedPrefixes: null,

        allow({ editor }: { editor: { isActive: (name: string) => boolean } }) {
          // Do not trigger emoji picker when the cursor is inside a link mark
          return !editor.isActive("link");
        },

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        command({ editor, range, props }: { editor: any; range: any; props: EmojiEntry }) {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent(props.emoji)
            .run();
        },

        items({ query }: { query: string }) {
          return searchEmojis(query);
        },

        render() {
          let renderer: ReactRenderer<EmojiListHandle>;
          let popup: TippyInstance[];

          return {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onStart(props: any) {
              renderer = new ReactRenderer(EmojiList, {
                props,
                editor: props.editor,
              });

              if (!props.clientRect) return;

              popup = tippy("body", {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: renderer.element,
                showOnCreate: true,
                interactive: true,
                trigger: "manual",
                placement: "bottom-start",
              });
            },

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onUpdate(props: any) {
              renderer.updateProps(props);

              if (!props.clientRect) return;

              popup[0].setProps({
                getReferenceClientRect: props.clientRect,
              });
            },

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onKeyDown(props: any) {
              if (props.event.key === "Escape") {
                popup[0].hide();
                return true;
              }
              return renderer.ref?.onKeyDown(props.event) ?? false;
            },

            onExit() {
              popup[0].destroy();
              renderer.destroy();
            },
          };
        },
      }),
    ];
  },
});
