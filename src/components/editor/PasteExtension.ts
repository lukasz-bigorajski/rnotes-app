import { Extension } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";

/**
 * Detects if clipboard content contains markdown patterns.
 * Returns true if markdown-like patterns are found.
 */
export function isMarkdownContent(text: string): boolean {
  // Check for common markdown patterns
  const patterns = [
    /^#{1,6}\s/m, // Headings: # ## ### etc
    /\*\*[^\*]+\*\*/, // Bold: **text**
    /\*[^\*]+\*/, // Italic: *text*
    /__[^_]+__/, // Bold: __text__
    /_[^_]+_/, // Italic: _text_
    /^\s*[-*+]\s/m, // Unordered lists: - * +
    /^\s*\d+\.\s/m, // Ordered lists: 1. 2. etc
    /```[\s\S]*?```/, // Code blocks: ```...```
    /`[^`]+`/, // Inline code: `code`
    /\[([^\]]+)\]\(([^)]+)\)/, // Links: [text](url)
    /^>\s/m, // Blockquotes: >
    /\|.*\|.*\|/, // Tables (simple detection)
  ];

  return patterns.some((pattern) => pattern.test(text));
}

interface PasteExtensionOptions {
  onMarkdownDetected?: (text: string) => void;
}

/**
 * Custom paste extension that handles:
 * 1. Cmd+Shift+V for plain text paste
 * 2. Custom context menu for "Paste as plain text"
 * 3. Smart markdown detection on regular paste (Cmd+V)
 */
export const PasteExtension = Extension.create<PasteExtensionOptions>({
  name: "pasteExtension",

  addOptions() {
    return {
      onMarkdownDetected: undefined,
    };
  },

  addKeyboardShortcuts() {
    return {};
  },

  addProseMirrorPlugins() {
    const { onMarkdownDetected } = this.options;

    return [
      new Plugin({
        key: new PluginKey("pasteHandler"),
        props: {
          handlePaste: (_view, event) => {
            const clipboard = event.clipboardData;
            if (!clipboard) return false;

            // Check if we have plain text in the clipboard
            const text = clipboard.getData("text/plain");
            if (!text) return false;

            // Detect if it's markdown
            if (isMarkdownContent(text)) {
              // Prevent default paste handling
              event.preventDefault();

              // Notify that markdown was detected (callback to component)
              // This will trigger the component to parse and insert the markdown
              onMarkdownDetected?.(text);
              return true;
            }

            // Not markdown - let default handling work
            return false;
          },
        },
      }),
    ];
  },
});
