import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useState } from "react";
import { IconCopy, IconCheck } from "@tabler/icons-react";

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
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = node.textContent;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch((err) => {
      console.error("Failed to copy code:", err);
    });
  };

  return (
    <NodeViewWrapper as="pre" className="code-block-wrapper">
      <button
        className="code-block-copy-btn"
        contentEditable={false}
        onClick={handleCopy}
        title={copied ? "Copied!" : "Copy code"}
        aria-label={copied ? "Copied!" : "Copy code"}
        data-testid="code-block-copy-btn"
      >
        {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
      </button>
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
