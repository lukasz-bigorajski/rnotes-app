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
 * Check if a horizontal row of pixels is "empty" (near-white background).
 * Samples pixels across the row to avoid scanning every single pixel.
 */
function isRowEmpty(imageData: ImageData, y: number, width: number): boolean {
  const stride = imageData.width * 4;
  const step = Math.max(1, Math.floor(width / 80)); // sample ~80 points across
  for (let x = 0; x < width; x += step) {
    const idx = y * stride + x * 4;
    const r = imageData.data[idx];
    const g = imageData.data[idx + 1];
    const b = imageData.data[idx + 2];
    // Treat anything darker than near-white as content
    if (r < 245 || g < 245 || b < 245) return false;
  }
  return true;
}

/**
 * Find natural page break positions by scanning for whitespace rows.
 * Searches upward from the ideal break point (page height) to find a gap
 * between content blocks. Falls back to the ideal break if no gap is found
 * within the search range (25% of page height).
 */
function findPageBreaks(canvas: HTMLCanvasElement, pageHeightPx: number): number[] {
  const ctx = canvas.getContext("2d")!;
  const imgHeight = canvas.height;
  const imgWidth = canvas.width;
  const imageData = ctx.getImageData(0, 0, imgWidth, imgHeight);

  // How far above the ideal break to search for a whitespace gap
  const searchRange = Math.floor(pageHeightPx * 0.25);
  // Require a few consecutive empty rows to count as a real gap
  const minGapRows = 3;

  const breaks: number[] = [0];
  let pos = 0;

  while (pos < imgHeight) {
    const idealBreak = pos + pageHeightPx;
    if (idealBreak >= imgHeight) {
      breaks.push(imgHeight);
      break;
    }

    // Search upward from the ideal break point for a whitespace gap
    let bestBreak = idealBreak;
    for (let y = idealBreak; y > idealBreak - searchRange && y > pos; y--) {
      let gapRows = 0;
      for (let row = y; row >= pos && gapRows < minGapRows; row--) {
        if (isRowEmpty(imageData, row, imgWidth)) {
          gapRows++;
        } else {
          break;
        }
      }
      if (gapRows >= minGapRows) {
        // Break at the top of the gap so whitespace stays at bottom of prev page
        bestBreak = y - gapRows + 1;
        break;
      }
    }

    breaks.push(bestBreak);
    pos = bestBreak;
  }

  return breaks;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

interface PdfLinkInfo {
  href: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PdfHeadingInfo {
  text: string;
  level: number;
  id: string;
  y: number;
}

/**
 * Prepare the offscreen render element for PDF export:
 * - Assign id attributes to headings so TOC links can reference them
 * - Rewrite TOC anchor hrefs from "#" to "#heading-id"
 * Returns link and heading position data for PDF annotation.
 */
function prepareLinksAndHeadings(
  renderEl: HTMLElement,
  canvasScale: number,
): { links: PdfLinkInfo[]; headings: PdfHeadingInfo[] } {
  const renderRect = renderEl.getBoundingClientRect();

  // Assign IDs to all headings in the content
  const headingEls = renderEl.querySelectorAll("h1, h2, h3, h4, h5, h6");
  const headings: PdfHeadingInfo[] = [];
  const headingIdMap = new Map<string, string>(); // text -> id

  headingEls.forEach((el) => {
    const text = el.textContent?.trim() ?? "";
    if (!text) return;
    const id = slugify(text);
    el.id = id;
    headingIdMap.set(text, id);

    const rect = el.getBoundingClientRect();
    headings.push({
      text,
      level: parseInt(el.tagName[1]),
      id,
      y: (rect.top - renderRect.top) * canvasScale,
    });
  });

  // Rewrite TOC links to point to heading IDs
  const tocWrapper = renderEl.querySelector('[data-type="toc"]');
  if (tocWrapper) {
    tocWrapper.querySelectorAll("a").forEach((a) => {
      const linkText = a.textContent?.trim() ?? "";
      const targetId = headingIdMap.get(linkText);
      if (targetId) {
        a.href = `#${targetId}`;
      }
    });
  }

  // Collect all link elements with their positions
  const links: PdfLinkInfo[] = [];
  renderEl.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href") ?? "";
    if (!href) return;
    const rect = a.getBoundingClientRect();
    links.push({
      href,
      x: (rect.left - renderRect.left) * canvasScale,
      y: (rect.top - renderRect.top) * canvasScale,
      width: rect.width * canvasScale,
      height: rect.height * canvasScale,
    });
  });

  return { links, headings };
}

/**
 * Find which page a y-coordinate (in canvas pixels) falls on,
 * and return the page index and y offset within that page.
 */
function findPageForY(
  yPx: number,
  breakPoints: number[],
): { pageIndex: number; offsetInPagePx: number } {
  for (let i = 0; i < breakPoints.length - 1; i++) {
    if (yPx < breakPoints[i + 1]) {
      return { pageIndex: i, offsetInPagePx: yPx - breakPoints[i] };
    }
  }
  return { pageIndex: breakPoints.length - 2, offsetInPagePx: 0 };
}

/**
 * Add clickable link annotations and a bookmark outline to the PDF.
 */
function addPdfAnnotations(
  pdf: jsPDF,
  links: PdfLinkInfo[],
  headings: PdfHeadingInfo[],
  breakPoints: number[],
  ratio: number,
): void {
  // Build a map of heading id -> page position for internal links
  const headingPositions = new Map<string, { pageIndex: number; yMm: number }>();
  for (const h of headings) {
    const { pageIndex, offsetInPagePx } = findPageForY(h.y, breakPoints);
    headingPositions.set(h.id, { pageIndex, yMm: MARGIN_MM + offsetInPagePx * ratio });
  }

  // Add link annotations
  for (const link of links) {
    const { pageIndex, offsetInPagePx } = findPageForY(link.y, breakPoints);
    const xMm = MARGIN_MM + link.x * ratio;
    const yMm = MARGIN_MM + offsetInPagePx * ratio;
    const wMm = link.width * ratio;
    const hMm = link.height * ratio;

    pdf.setPage(pageIndex + 1);

    if (link.href.startsWith("#")) {
      // Internal link (TOC -> heading)
      const targetId = link.href.slice(1);
      const target = headingPositions.get(targetId);
      if (target) {
        pdf.link(xMm, yMm, wMm, hMm, {
          pageNumber: target.pageIndex + 1,
          // Not all PDF viewers support top offset, but we include it
        });
      }
    } else if (link.href.startsWith("http://") || link.href.startsWith("https://")) {
      // External link
      pdf.link(xMm, yMm, wMm, hMm, { url: link.href });
    }
  }

  // Add PDF outline (bookmarks sidebar) for headings
  // Skip the title heading (first h1 added by the export itself)
  const contentHeadings = headings.filter(
    (_, i) => i > 0 || headings[0]?.level !== 1 || headings.length === 1,
  );
  if (contentHeadings.length > 0) {
    if (typeof pdf.outline?.add === "function") {
      for (const h of contentHeadings) {
        const pos = headingPositions.get(h.id);
        if (!pos) continue;
        pdf.outline.add(null, h.text, { pageNumber: pos.pageIndex + 1 });
      }
    }
  }
}

/**
 * Export note as a real PDF file using html2canvas + jsPDF.
 * Renders the styled note content to a canvas, then paginates into A4 pages.
 * Preserves clickable links (TOC internal links + external URLs) and adds
 * a PDF bookmark outline for headings.
 */
export async function exportNoteAsPdf(params: {
  title: string;
  htmlContent: string;
}): Promise<void> {
  const { title, htmlContent } = params;
  const canvasScale = 2;

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

    // Collect link/heading positions before rendering to canvas
    // (getBoundingClientRect only works while the element is in the DOM)
    const { links, headings } = prepareLinksAndHeadings(renderEl, canvasScale);

    const canvas = await html2canvas(renderEl, {
      scale: canvasScale,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const imgWidthPx = canvas.width;

    // Scale image to fit content width, then paginate
    const ratio = CONTENT_WIDTH_MM / imgWidthPx;
    const pageContentHeightPx = Math.floor((A4_HEIGHT_MM - 2 * MARGIN_MM) / ratio);

    // Find page break points that avoid cutting through content.
    const breakPoints = findPageBreaks(canvas, pageContentHeightPx);

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    for (let i = 0; i < breakPoints.length - 1; i++) {
      if (i > 0) pdf.addPage();

      const srcY = breakPoints[i];
      const srcH = breakPoints[i + 1] - srcY;
      const sliceHeightMm = srcH * ratio;

      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = imgWidthPx;
      sliceCanvas.height = srcH;
      const ctx = sliceCanvas.getContext("2d")!;
      ctx.drawImage(canvas, 0, srcY, imgWidthPx, srcH, 0, 0, imgWidthPx, srcH);

      const sliceData = sliceCanvas.toDataURL("image/png");
      pdf.addImage(sliceData, "PNG", MARGIN_MM, MARGIN_MM, CONTENT_WIDTH_MM, sliceHeightMm);
    }

    // Add clickable links and bookmarks on top of the rendered pages
    addPdfAnnotations(pdf, links, headings, breakPoints, ratio);

    const pdfBlob = pdf.output("blob");
    triggerDownload(`${safeFilename(title)}.pdf`, pdfBlob);
  } finally {
    document.body.removeChild(container);
  }
}
