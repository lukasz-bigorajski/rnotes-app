import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import type { createLowlight } from "lowlight";

const autodetectKey = new PluginKey("codeBlockAutodetect");
const MIN_LENGTH = 20;
const DEBOUNCE_MS = 500;

export function createCodeBlockAutodetectPlugin(lowlight: ReturnType<typeof createLowlight>) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return new Plugin({
    key: autodetectKey,
    view() {
      return {
        update(view: EditorView) {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => {
            const { state, dispatch } = view;
            const { doc, schema } = state;
            const tr = state.tr;
            let changed = false;

            doc.descendants((node, pos) => {
              if (node.type !== schema.nodes.codeBlock) return;
              const lang = node.attrs.language as string;
              if (lang && lang !== "plaintext") return;
              const code = node.textContent;
              if (code.length < MIN_LENGTH) return;

              try {
                const result = lowlight.highlightAuto(code);
                const detected = (result.data as Record<string, unknown>)?.language as
                  | string
                  | undefined;
                if (detected && detected !== "plaintext") {
                  tr.setNodeMarkup(pos, undefined, { ...node.attrs, language: detected });
                  changed = true;
                }
              } catch {
                // ignore detection failures
              }
            });

            if (changed) dispatch(tr);
          }, DEBOUNCE_MS);
        },
        destroy() {
          if (timer) clearTimeout(timer);
        },
      };
    },
  });
}
