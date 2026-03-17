import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";

const LANGUAGES = [
  { value: "plaintext", label: "Plain Text" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "rust", label: "Rust" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "json", label: "JSON" },
  { value: "sql", label: "SQL" },
  { value: "bash", label: "Bash" },
  { value: "go", label: "Go" },
  { value: "java", label: "Java" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "markdown", label: "Markdown" },
];

export function CodeBlockNodeView({ node, updateAttributes, extension }: NodeViewProps) {
  const language = (node.attrs.language as string) || extension.options.defaultLanguage || "plaintext";

  return (
    <NodeViewWrapper as="pre" className="code-block-wrapper">
      <select
        className="code-block-language-select"
        contentEditable={false}
        value={language}
        onChange={(e) => updateAttributes({ language: e.target.value })}
        data-testid="code-block-language-select"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.value} value={lang.value}>
            {lang.label}
          </option>
        ))}
      </select>
      <NodeViewContent<"code"> as="code" />
    </NodeViewWrapper>
  );
}
