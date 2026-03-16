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
    return ({ node, editor }: NodeViewRendererProps) => {
      const dom = document.createElement("div");
      dom.setAttribute("data-type", "toc");
      dom.setAttribute("contenteditable", "false");

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

      return { dom };
    };
  },
});
