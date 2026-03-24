import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { EditorState } from "@tiptap/pm/state";

export const findReplaceKey = new PluginKey("findReplace");

export interface FindReplaceState {
  query: string;
  matches: { from: number; to: number }[];
  currentIndex: number;
}

function buildDecorations(state: EditorState, pluginState: FindReplaceState): DecorationSet {
  if (!pluginState.query) return DecorationSet.empty;

  const decorations: Decoration[] = [];
  pluginState.matches.forEach(({ from, to }, index) => {
    const isCurrent = index === pluginState.currentIndex;
    decorations.push(
      Decoration.inline(from, to, {
        class: isCurrent ? "find-replace-current" : "find-replace-match",
      }),
    );
  });

  return DecorationSet.create(state.doc, decorations);
}

function findMatches(state: EditorState, query: string): { from: number; to: number }[] {
  if (!query) return [];
  const matches: { from: number; to: number }[] = [];
  const lowerQuery = query.toLowerCase();
  const queryLen = query.length;

  state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text.toLowerCase();
    let index = 0;
    while ((index = text.indexOf(lowerQuery, index)) !== -1) {
      matches.push({ from: pos + index, to: pos + index + queryLen });
      index += queryLen;
    }
  });

  return matches;
}

export function createFindReplacePlugin() {
  return new Plugin<FindReplaceState>({
    key: findReplaceKey,
    state: {
      init(): FindReplaceState {
        return { query: "", matches: [], currentIndex: 0 };
      },
      apply(tr, value, _oldState, newState): FindReplaceState {
        const meta = tr.getMeta(findReplaceKey) as Partial<FindReplaceState> | undefined;
        if (meta !== undefined) {
          const query = meta.query !== undefined ? meta.query : value.query;
          const matches = findMatches(newState, query);
          const currentIndex =
            meta.currentIndex !== undefined
              ? Math.max(0, Math.min(meta.currentIndex, matches.length - 1))
              : matches.length > 0
                ? Math.max(0, Math.min(value.currentIndex, matches.length - 1))
                : 0;
          return { query, matches, currentIndex };
        }
        if (tr.docChanged && value.query) {
          const matches = findMatches(newState, value.query);
          const currentIndex = Math.max(0, Math.min(value.currentIndex, matches.length - 1));
          return { ...value, matches, currentIndex };
        }
        return value;
      },
    },
    props: {
      decorations(state) {
        const pluginState = findReplaceKey.getState(state);
        if (!pluginState) return DecorationSet.empty;
        return buildDecorations(state, pluginState);
      },
    },
  });
}
