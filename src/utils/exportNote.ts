import type { JSONContent } from "@tiptap/react";

const EXPORT_FORMAT_VERSION = "1";

/**
 * Sanitize a string to be safe as a filename (no path separators, trim whitespace).
 */
function safeFilename(title: string): string {
  return title
    .trim()
    .replace(/[/\\:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 100);
}

/**
 * Trigger a browser file download.
 */
function triggerDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface ExportNoteParams {
  noteId: string;
  title: string;
  content: JSONContent;
  createdAt: number;
  updatedAt: number;
}

/**
 * Export note as JSON file.
 */
export function exportNoteAsJson(params: ExportNoteParams): void {
  const { title, content, createdAt, updatedAt, noteId } = params;

  const exportData = {
    version: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    note: {
      id: noteId,
      title,
      content,
      createdAt: new Date(createdAt).toISOString(),
      updatedAt: new Date(updatedAt).toISOString(),
    },
  };

  const json = JSON.stringify(exportData, null, 2);
  const filename = `${safeFilename(title)}.json`;
  triggerDownload(filename, json, "application/json");
}

/**
 * Build a self-contained HTML string suitable for PDF printing.
 * Uses CSS print media to produce a clean rendered output.
 */
function buildPrintHtml(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    /* ---- Reset & base ---- */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14pt;
      line-height: 1.6;
      color: #1a1a1a;
      background: #fff;
      padding: 30mm 25mm;
      max-width: 210mm;
      margin: 0 auto;
    }

    h1.note-title {
      font-size: 24pt;
      font-weight: 700;
      margin-bottom: 6mm;
      padding-bottom: 3mm;
      border-bottom: 2px solid #e0e0e0;
    }

    .note-content { margin-top: 4mm; }

    /* ---- Headings ---- */
    h1 { font-size: 20pt; font-weight: 700; margin: 6mm 0 3mm; }
    h2 { font-size: 16pt; font-weight: 700; margin: 5mm 0 2mm; }
    h3 { font-size: 14pt; font-weight: 700; margin: 4mm 0 2mm; }
    h4 { font-size: 13pt; font-weight: 600; margin: 4mm 0 2mm; }
    h5 { font-size: 12pt; font-weight: 600; margin: 3mm 0 2mm; }
    h6 { font-size: 12pt; font-weight: 600; color: #555; margin: 3mm 0 2mm; }

    /* ---- Paragraphs & inline ---- */
    p { margin: 2mm 0; }
    strong { font-weight: 700; }
    em { font-style: italic; }
    s { text-decoration: line-through; }
    code {
      font-family: "Cascadia Code", "Fira Code", "JetBrains Mono", monospace;
      font-size: 11pt;
      background: #f5f5f5;
      padding: 1px 4px;
      border-radius: 3px;
    }
    a { color: #0066cc; text-decoration: underline; }

    /* ---- Blockquote ---- */
    blockquote {
      margin: 3mm 0;
      padding: 2mm 5mm;
      border-left: 4px solid #ccc;
      color: #555;
    }

    /* ---- Lists ---- */
    ul, ol { margin: 2mm 0 2mm 6mm; padding-left: 4mm; }
    li { margin: 1mm 0; }

    /* ---- Task list ---- */
    ul[data-type="taskList"] { list-style: none; padding-left: 0; }
    ul[data-type="taskList"] > li { display: flex; align-items: flex-start; gap: 2mm; }
    ul[data-type="taskList"] > li > label { flex-shrink: 0; margin-top: 1mm; }
    ul[data-type="taskList"] > li > div { flex: 1; }

    /* ---- Code block ---- */
    pre {
      background: #1e1e1e;
      color: #d4d4d4;
      font-family: "Cascadia Code", "Fira Code", "JetBrains Mono", monospace;
      font-size: 10pt;
      padding: 4mm;
      border-radius: 4px;
      overflow-x: auto;
      margin: 3mm 0;
      page-break-inside: avoid;
    }
    pre code { background: transparent; padding: 0; font-size: inherit; color: inherit; }

    /* ---- Table ---- */
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 3mm 0;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #ccc;
      padding: 2mm 3mm;
      text-align: left;
    }
    th { background: #f5f5f5; font-weight: 600; }

    /* ---- Images ---- */
    img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 3mm 0;
    }

    /* ---- Details/collapsible ---- */
    details { margin: 2mm 0; }
    summary { cursor: default; font-weight: 600; }

    /* ---- Print ---- */
    @page {
      margin: 15mm 20mm;
      size: A4;
    }
    @media print {
      body { padding: 0; }
      a { color: inherit; }
    }
  </style>
</head>
<body>
  <h1 class="note-title">${escapeHtml(title)}</h1>
  <div class="note-content">
    ${bodyHtml}
  </div>
  <script>
    window.onload = function() {
      window.print();
      window.onafterprint = function() { window.close(); };
    };
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Export note as PDF by opening a styled print window.
 * The browser's print dialog allows saving as PDF.
 */
export function exportNoteAsPdf(params: { title: string; htmlContent: string }): void {
  const { title, htmlContent } = params;
  const printHtml = buildPrintHtml(title, htmlContent);

  const printWindow = window.open("", "_blank", "width=900,height=700,noopener=yes");
  if (!printWindow) {
    // Popup blocked — fallback: write to iframe and print from it
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0;";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(printHtml);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }, 500);
    }
    return;
  }

  printWindow.document.write(printHtml);
  printWindow.document.close();
}
