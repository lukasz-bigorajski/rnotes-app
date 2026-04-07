import { useRef, useCallback, useEffect } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import classes from "./ImageNodeView.module.css";

const MIN_WIDTH = 50;

type ResizeDirection = "NW" | "NE" | "SW" | "SE" | "N" | "S" | "W" | "E";

interface ResizeState {
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  direction: ResizeDirection;
  aspectRatio: number;
}

/**
 * Custom TipTap NodeView for images with:
 * - Resize handles on corners and edges (hold Shift to ignore aspect ratio lock)
 * - Alignment controls (left / center / right)
 * - ProseMirror draggable support (drag-to-reposition)
 *
 * Dimensions are stored as node attributes so they persist in JSON.
 */
export function ImageNodeView({ node, selected, updateAttributes }: NodeViewProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const resizeStateRef = useRef<ResizeState | null>(null);

  const src = node.attrs.src as string;
  const alt = (node.attrs.alt as string | undefined) ?? "";
  const width = node.attrs.width as number | null | undefined;
  const height = node.attrs.height as number | null | undefined;
  const align = (node.attrs.align as string | undefined) ?? "center";

  // --- Resize logic ---
  const startResize = useCallback(
    (e: React.MouseEvent, direction: ResizeDirection) => {
      e.preventDefault();
      e.stopPropagation();

      const img = imgRef.current;
      if (!img) return;

      const rect = img.getBoundingClientRect();
      const currentWidth = rect.width;
      const currentHeight = rect.height;
      const aspectRatio = currentHeight > 0 ? currentWidth / currentHeight : 1;

      resizeStateRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startWidth: currentWidth,
        startHeight: currentHeight,
        direction,
        aspectRatio,
      };
    },
    [],
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const state = resizeStateRef.current;
      if (!state) return;

      const { startX, startY, startWidth, startHeight, direction, aspectRatio } = state;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      let newWidth = startWidth;
      let newHeight = startHeight;

      // Compute new dimensions based on drag direction
      if (direction.includes("E")) newWidth = startWidth + dx;
      if (direction.includes("W")) newWidth = startWidth - dx;
      if (direction.includes("S")) newHeight = startHeight + dy;
      if (direction.includes("N")) newHeight = startHeight - dy;

      // Maintain aspect ratio unless Shift is held (free resize)
      if (!e.shiftKey) {
        if (direction === "N" || direction === "S") {
          newWidth = newHeight * aspectRatio;
        } else if (direction === "E" || direction === "W") {
          newHeight = newWidth / aspectRatio;
        } else {
          // Corner — use the larger delta to determine scale
          const scaleW = newWidth / startWidth;
          const scaleH = newHeight / startHeight;
          const scale = Math.max(scaleW, scaleH);
          newWidth = startWidth * scale;
          newHeight = startHeight * scale;
        }
      }

      newWidth = Math.max(MIN_WIDTH, Math.round(newWidth));
      newHeight = Math.max(Math.round((MIN_WIDTH / aspectRatio) * 1), Math.round(newHeight));

      // Live preview: update the img element style directly (avoid re-render on every pixel)
      if (imgRef.current) {
        imgRef.current.style.width = `${newWidth}px`;
        imgRef.current.style.height = `${newHeight}px`;
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      const state = resizeStateRef.current;
      if (!state) return;
      resizeStateRef.current = null;

      // Commit final dimensions to TipTap attributes
      if (imgRef.current) {
        const img = imgRef.current;
        const finalWidth = Math.round(parseFloat(img.style.width) || state.startWidth);
        const finalHeight = Math.round(parseFloat(img.style.height) || state.startHeight);
        // Clear inline style — let attr-driven sizing take over
        img.style.width = "";
        img.style.height = "";
        updateAttributes({ width: finalWidth, height: finalHeight });
      }

      e.preventDefault();
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [updateAttributes]);

  // --- Alignment helpers ---
  const setAlign = useCallback(
    (a: string) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      updateAttributes({ align: a });
    },
    [updateAttributes],
  );

  const wrapperClass = [classes.imageWrapper, selected ? classes.selected : ""]
    .filter(Boolean)
    .join(" ");

  return (
    // data-drag-handle makes the whole wrapper draggable via ProseMirror's
    // drag-and-drop mechanism when draggable:true is set on the NodeView.
    <NodeViewWrapper
      as="span"
      className={wrapperClass}
      data-testid="image-node-view"
      data-align={align}
      data-drag-handle
    >
      {/* Alignment toolbar — only visible when selected */}
      <div className={classes.alignToolbar} contentEditable={false}>
        <button
          className={`${classes.alignBtn} ${align === "wrap-left" ? classes.active : ""}`}
          onClick={setAlign("wrap-left")}
          title="Wrap text (left)"
          aria-label="Float image left with text wrap"
          data-testid="image-wrap-left"
        >
          &#x25E7;
        </button>
        <span className={classes.separator} />
        <button
          className={`${classes.alignBtn} ${align === "left" ? classes.active : ""}`}
          onClick={setAlign("left")}
          title="Align left"
          aria-label="Align image left"
          data-testid="image-align-left"
        >
          &#8676;
        </button>
        <button
          className={`${classes.alignBtn} ${align === "center" ? classes.active : ""}`}
          onClick={setAlign("center")}
          title="Align center"
          aria-label="Align image center"
          data-testid="image-align-center"
        >
          &#8596;
        </button>
        <button
          className={`${classes.alignBtn} ${align === "right" ? classes.active : ""}`}
          onClick={setAlign("right")}
          title="Align right"
          aria-label="Align image right"
          data-testid="image-align-right"
        >
          &#8677;
        </button>
        <span className={classes.separator} />
        <button
          className={`${classes.alignBtn} ${align === "wrap-right" ? classes.active : ""}`}
          onClick={setAlign("wrap-right")}
          title="Wrap text (right)"
          aria-label="Float image right with text wrap"
          data-testid="image-wrap-right"
        >
          &#x25E8;
        </button>
      </div>

      {/* The image element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        width={width ?? undefined}
        height={height ?? undefined}
        style={{
          width: width ? `${width}px` : undefined,
          height: height ? `${height}px` : undefined,
        }}
        draggable={false}
        data-testid="image-element"
      />

      {/* Resize handles — visible only when selected */}
      <div
        className={`${classes.handle} ${classes.handleNW}`}
        onMouseDown={(e) => startResize(e, "NW")}
        contentEditable={false}
        data-testid="image-handle-nw"
      />
      <div
        className={`${classes.handle} ${classes.handleNE}`}
        onMouseDown={(e) => startResize(e, "NE")}
        contentEditable={false}
        data-testid="image-handle-ne"
      />
      <div
        className={`${classes.handle} ${classes.handleSW}`}
        onMouseDown={(e) => startResize(e, "SW")}
        contentEditable={false}
        data-testid="image-handle-sw"
      />
      <div
        className={`${classes.handle} ${classes.handleSE}`}
        onMouseDown={(e) => startResize(e, "SE")}
        contentEditable={false}
        data-testid="image-handle-se"
      />
      <div
        className={`${classes.handle} ${classes.handleN}`}
        onMouseDown={(e) => startResize(e, "N")}
        contentEditable={false}
        data-testid="image-handle-n"
      />
      <div
        className={`${classes.handle} ${classes.handleS}`}
        onMouseDown={(e) => startResize(e, "S")}
        contentEditable={false}
        data-testid="image-handle-s"
      />
      <div
        className={`${classes.handle} ${classes.handleW}`}
        onMouseDown={(e) => startResize(e, "W")}
        contentEditable={false}
        data-testid="image-handle-w"
      />
      <div
        className={`${classes.handle} ${classes.handleE}`}
        onMouseDown={(e) => startResize(e, "E")}
        contentEditable={false}
        data-testid="image-handle-e"
      />
    </NodeViewWrapper>
  );
}
