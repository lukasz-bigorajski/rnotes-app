import type { JSONContent } from "@tiptap/react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

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
function triggerDownload(filename: string, blob: Blob): void {
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
  triggerDownload(filename, new Blob([json], { type: "application/json" }));
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// A4 dimensions in mm
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MARGIN_MM = 15;
const CONTENT_WIDTH_MM = A4_WIDTH_MM - 2 * MARGIN_MM;

/**
 * Export note as a real PDF file using html2canvas + jsPDF.
 * Renders the styled note content to a canvas, then paginates into A4 pages.
 */
export async function exportNoteAsPdf(params: {
  title: string;
  htmlContent: string;
}): Promise<void> {
  const { title, htmlContent } = params;

  // Create an offscreen container with the styled note content
  const container = document.createElement("div");
  container.style.cssText = `
    position: fixed; top: -9999px; left: -9999px;
    width: 680px; background: white; padding: 40px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px; line-height: 1.6; color: #1a1a1a;
  `;
  container.innerHTML = `
    <style>
      #pdf-render * { box-sizing: border-box; }
      #pdf-render h1 { font-size: 22px; font-weight: 700; margin: 16px 0 8px; }
      #pdf-render h2 { font-size: 18px; font-weight: 700; margin: 14px 0 6px; }
      #pdf-render h3 { font-size: 16px; font-weight: 700; margin: 12px 0 6px; }
      #pdf-render h4 { font-size: 15px; font-weight: 600; margin: 12px 0 6px; }
      #pdf-render h5 { font-size: 14px; font-weight: 600; margin: 10px 0 6px; }
      #pdf-render h6 { font-size: 14px; font-weight: 600; color: #555; margin: 10px 0 6px; }
      #pdf-render p { margin: 6px 0; }
      #pdf-render strong { font-weight: 700; }
      #pdf-render em { font-style: italic; }
      #pdf-render s { text-decoration: line-through; }
      #pdf-render code {
        font-family: "Cascadia Code", "Fira Code", "JetBrains Mono", monospace;
        font-size: 12px; background: #f5f5f5; padding: 1px 4px; border-radius: 3px;
      }
      #pdf-render a { color: #0066cc; text-decoration: underline; }
      #pdf-render blockquote {
        margin: 8px 0; padding: 6px 16px; border-left: 4px solid #ccc; color: #555;
      }
      #pdf-render ul, #pdf-render ol { margin: 6px 0 6px 20px; padding-left: 12px; }
      #pdf-render li { margin: 3px 0; }
      #pdf-render ul[data-type="taskList"] { list-style: none; padding-left: 0; }
      #pdf-render ul[data-type="taskList"] > li { display: flex; align-items: flex-start; gap: 6px; }
      #pdf-render pre {
        background: #f5f5f5; color: #1a1a1a;
        font-family: "Cascadia Code", "Fira Code", "JetBrains Mono", monospace;
        font-size: 11px; padding: 12px; border-radius: 4px;
        overflow-x: auto; margin: 8px 0;
      }
      #pdf-render pre code { background: transparent; padding: 0; font-size: inherit; color: inherit; }
      #pdf-render table { border-collapse: collapse; width: 100%; margin: 8px 0; }
      #pdf-render th, #pdf-render td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
      #pdf-render th { background: #f5f5f5; font-weight: 600; }
      #pdf-render img { max-width: 100%; height: auto; display: block; margin: 8px 0; }
    </style>
    <div id="pdf-render">
      <h1 style="font-size:24px;font-weight:700;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #e0e0e0;">${escapeHtml(title)}</h1>
      <div>${htmlContent}</div>
    </div>
  `;
  document.body.appendChild(container);

  try {
    const renderEl = container.querySelector("#pdf-render") as HTMLElement;

    const canvas = await html2canvas(renderEl, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const imgData = canvas.toDataURL("image/png");
    const imgWidthPx = canvas.width;
    const imgHeightPx = canvas.height;

    // Scale image to fit content width, then paginate
    const ratio = CONTENT_WIDTH_MM / imgWidthPx;
    const imgHeightMm = imgHeightPx * ratio;
    const pageContentHeight = A4_HEIGHT_MM - 2 * MARGIN_MM;

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    let yOffset = 0;
    let pageNum = 0;

    while (yOffset < imgHeightMm) {
      if (pageNum > 0) pdf.addPage();

      // Calculate which portion of the source image to draw
      const sliceHeightMm = Math.min(pageContentHeight, imgHeightMm - yOffset);
      const srcY = (yOffset / imgHeightMm) * imgHeightPx;
      const srcH = (sliceHeightMm / imgHeightMm) * imgHeightPx;

      // Create a canvas slice for this page
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = imgWidthPx;
      sliceCanvas.height = Math.ceil(srcH);
      const ctx = sliceCanvas.getContext("2d")!;
      ctx.drawImage(canvas, 0, srcY, imgWidthPx, srcH, 0, 0, imgWidthPx, srcH);

      const sliceData = sliceCanvas.toDataURL("image/png");
      pdf.addImage(sliceData, "PNG", MARGIN_MM, MARGIN_MM, CONTENT_WIDTH_MM, sliceHeightMm);

      yOffset += pageContentHeight;
      pageNum++;
    }

    const pdfBlob = pdf.output("blob");
    triggerDownload(`${safeFilename(title)}.pdf`, pdfBlob);
  } finally {
    document.body.removeChild(container);
  }
}
