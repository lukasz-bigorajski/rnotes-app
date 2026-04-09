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

      if (headings.length === 0) {
        dom.textContent = "(No headings)";
      } else {
        const nav = document.createElement("nav");
        nav.setAttribute("aria-label", "Table of contents");

        const title = document.createElement("div");
        title.className = "toc-title";
        title.textContent = "Table of Contents";
        nav.appendChild(title);

        const ul = document.createElement("ul");
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

      // Add delete button
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
      dom.appendChild(deleteBtn);

      wrapper.appendChild(dom);
      return { dom: wrapper };
    };
  },
});
