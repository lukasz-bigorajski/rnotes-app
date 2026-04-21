import { Node } from "@tiptap/react";
import type { NodeViewRendererProps } from "@tiptap/react";

export interface TocHeading {
  level: number;
  text: string;
  id: string;
}

export const TocExtension = Node.create({
  name: "tableOfContents",

  group: "block",

  atom: true,

  selectable: true,

  addAttributes() {
    return {
      headings: {
        default: [],
        parseHTML: (element: Element) => {
          const data = element.getAttribute("data-headings");
          try {
            return data ? JSON.parse(data) : [];
          } catch {
            return [];
          }
        },
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-headings": JSON.stringify(attributes.headings),
        }),
      },
      collapsed: {
        default: false,
        parseHTML: (element: Element) => element.getAttribute("data-collapsed") === "true",
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-collapsed": String(attributes.collapsed),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="toc"]' }];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ["div", { "data-type": "toc", ...HTMLAttributes }, 0];
  },

  addNodeView() {
    return ({ node, editor, getPos }: NodeViewRendererProps) => {
      const wrapper = document.createElement("div");
      wrapper.className = "toc-wrapper";
      wrapper.setAttribute("data-type", "toc");
      wrapper.setAttribute("contenteditable", "false");

      const dom = document.createElement("div");
      dom.style.position = "relative";

      const headings: TocHeading[] = node.attrs.headings ?? [];
      let collapsed: boolean = node.attrs.collapsed ?? false;

      const render = () => {
        // Clear previous content (keep delete button appended separately)
        dom.innerHTML = "";

        if (headings.length === 0) {
          dom.textContent = "(No headings)";
        } else {
          const nav = document.createElement("nav");
          nav.setAttribute("aria-label", "Table of contents");

          const titleRow = document.createElement("div");
          titleRow.className = "toc-title-row";

          // Collapse toggle button
          const toggleBtn = document.createElement("button");
          toggleBtn.className = "toc-toggle-btn";
          toggleBtn.setAttribute("aria-label", collapsed ? "Expand table of contents" : "Collapse table of contents");
          toggleBtn.textContent = collapsed ? "▸" : "▾";
          toggleBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const pos = typeof getPos === "function" ? getPos() : undefined;
            if (pos === undefined) return;
            const newCollapsed = !node.attrs.collapsed;
            editor.view.dispatch(
              editor.view.state.tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                collapsed: newCollapsed,
              }),
            );
          });

          const title = document.createElement("div");
          title.className = "toc-title";
          title.textContent = "Table of Contents";

          titleRow.appendChild(toggleBtn);
          titleRow.appendChild(title);
          nav.appendChild(titleRow);

          const ul = document.createElement("ul");
          ul.style.display = collapsed ? "none" : "";
          headings.forEach((h: TocHeading) => {
            const li = document.createElement("li");
            li.style.paddingLeft = `${(h.level - 1) * 16}px`;

            const a = document.createElement("a");
            a.href = "#";
            a.textContent = h.text;
            a.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();
              const editorDom = editor.view.dom as HTMLElement;
              const headingEls = editorDom.querySelectorAll("h1, h2, h3, h4, h5, h6");
              const target = Array.from(headingEls).find(
                (el) => el.textContent?.trim() === h.text,
              );
              target?.scrollIntoView({ behavior: "smooth", block: "start" });
            });

            li.appendChild(a);
            ul.appendChild(li);
          });

          nav.appendChild(ul);
          dom.appendChild(nav);
        }

        // Re-append delete button (always present)
        dom.appendChild(deleteBtn);
      };

      // Add delete button (created once, re-appended each render)
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "toc-delete-btn";
      deleteBtn.innerHTML = "×";
      deleteBtn.title = "Delete Table of Contents";
      deleteBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const pos = typeof getPos === "function" ? getPos() : 0;
        if (pos !== undefined) {
          const nodeSize = node.nodeSize;
          editor.chain().focus().deleteRange({ from: pos, to: pos + nodeSize }).run();
        }
      });

      render();
      wrapper.appendChild(dom);

      return {
        dom: wrapper,
        update(updatedNode) {
          if (updatedNode.type !== node.type) return false;
          // Sync collapsed state from the updated node attrs and re-render
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (node as any).attrs = updatedNode.attrs;
          collapsed = updatedNode.attrs.collapsed ?? false;
          render();
          return true;
        },
      };
    };
  },
});
