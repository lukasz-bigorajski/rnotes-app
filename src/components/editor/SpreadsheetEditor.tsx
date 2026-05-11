import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { MutableRefObject } from "react";
import { ReactGrid, Column, Row, CellChange, TextCell } from "@silevis/reactgrid";
import { Group, TextInput, Text } from "@mantine/core";
import "@silevis/reactgrid/styles.css";
import "./SpreadsheetEditor.module.css";
import type { SpreadsheetContent } from "../../ipc/notes";
import { evaluateAll } from "../../lib/formulaEvaluator";
import { renameNote } from "../../ipc/notes";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface SpreadsheetEditorProps {
  noteId: string;
  title: string;
  content: SpreadsheetContent | null;
  onSave: (params: { id: string; content: string; plainText: string }) => Promise<void>;
  onTitleChange?: (title: string) => void;
  forceSaveRef?: MutableRefObject<(() => void) | null>;
}

const DEFAULT_ROWS = 20;
const DEFAULT_COLS = 10;
const DEBOUNCE_MS = 1000;
const MAX_RETRIES = 3;

function colIndexToLetter(i: number): string {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function SpreadsheetEditor({
  noteId,
  title,
  content,
  onSave,
  onTitleChange,
  forceSaveRef,
}: SpreadsheetEditorProps) {
  const numRows = content?.rows ?? DEFAULT_ROWS;
  const numCols = content?.cols ?? DEFAULT_COLS;

  const [cells, setCells] = useState<Record<string, string>>(content?.cells ?? {});
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [localTitle, setLocalTitle] = useState(title);
  const [extraRows, setExtraRows] = useState(0);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const cellsRef = useRef(cells);
  const noteIdRef = useRef(noteId);
  const onSaveRef = useRef(onSave);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  cellsRef.current = cells;
  noteIdRef.current = noteId;
  onSaveRef.current = onSave;

  const computed = useMemo(() => evaluateAll(cells, numRows, numCols), [cells, numRows, numCols]);

  const attemptSave = useCallback(
    async (id: string, snapshot: Record<string, string>, attempt = 0): Promise<void> => {
      setSaveStatus("saving");
      const spreadContent: SpreadsheetContent = {
        rows: numRows,
        cols: numCols,
        cells: snapshot,
        pivots: content?.pivots ?? [],
        macros: content?.macros ?? [],
      };
      const contentJson = JSON.stringify(spreadContent);
      const plainText = Object.values(snapshot).join(" ");
      try {
        await onSaveRef.current({ id, content: contentJson, plainText });
        setSaveStatus("saved");
      } catch (err) {
        console.error(`Spreadsheet save failed (attempt ${attempt + 1}):`, err);
        if (attempt < MAX_RETRIES - 1) {
          const delay = DEBOUNCE_MS * Math.pow(2, attempt);
          retryTimeoutRef.current = setTimeout(() => {
            attemptSave(id, snapshot, attempt + 1);
          }, delay);
        } else {
          setSaveStatus("error");
        }
      }
    },
    [numRows, numCols, content?.pivots, content?.macros],
  );

  const triggerSave = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    attemptSave(noteIdRef.current, { ...cellsRef.current });
  }, [attemptSave]);

  // Debounced save on cells change
  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(triggerSave, DEBOUNCE_MS);
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [cells]); // intentional: only re-trigger on cell data change, not on triggerSave identity

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
        triggerSave();
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [triggerSave]);

  // forceSaveRef
  useEffect(() => {
    if (!forceSaveRef) return;
    forceSaveRef.current = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      triggerSave();
    };
    return () => {
      if (forceSaveRef) forceSaveRef.current = null;
    };
  }, [forceSaveRef, triggerSave]);

  const handleCellsChanged = useCallback((changes: CellChange<TextCell>[]) => {
    setCells((prev) => {
      const next = { ...prev };
      for (const change of changes) {
        const row = Number(change.rowId);
        const col = Number(change.columnId);
        const key = `${row}:${col}`;
        const newVal = change.newCell.text ?? "";
        if (newVal === "") {
          delete next[key];
        } else {
          next[key] = newVal;
        }
      }
      return next;
    });
  }, []);

  // Dynamically add non-editable filler rows to fill the visible scroll container height.
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const ROW_HEIGHT = 25;
    const HEADER_HEIGHT = 25;
    const PADDING = 16;
    const update = () => {
      const fitting = Math.ceil((el.clientHeight - HEADER_HEIGHT - PADDING) / ROW_HEIGHT);
      setExtraRows(Math.max(0, fitting - numRows + 2));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [numRows]);

  const displayRows = numRows + extraRows;

  const columns: Column[] = useMemo(() => {
    const cols: Column[] = [{ columnId: "header", width: 40 }];
    for (let c = 0; c < numCols; c++) {
      cols.push({ columnId: String(c), width: 120 });
    }
    return cols;
  }, [numCols]);

  const rows: Row<TextCell>[] = useMemo(() => {
    // Header row
    const headerRow: Row<TextCell> = {
      rowId: "header",
      height: 25,
      cells: [
        { type: "text", text: "", nonEditable: true },
        ...Array.from({ length: numCols }, (_, c) => ({
          type: "text" as const,
          text: colIndexToLetter(c),
          nonEditable: true,
        })),
      ],
    };

    const dataRows: Row<TextCell>[] = Array.from({ length: displayRows }, (_, r) => {
      const isFiller = r >= numRows;
      return {
        rowId: String(r),
        height: 25,
        cells: [
          { type: "text" as const, text: isFiller ? "" : String(r + 1), nonEditable: true },
          ...Array.from({ length: numCols }, (_, c) => {
            if (isFiller) return { type: "text" as const, text: "", nonEditable: true };
            const key = `${r}:${c}`;
            const raw = cells[key] ?? "";
            const display = computed[key] ?? "";
            return {
              type: "text" as const,
              text: display,
              _rawValue: raw,
            } as TextCell & { _rawValue: string };
          }),
        ],
      };
    });

    return [headerRow, ...dataRows];
  }, [displayRows, numRows, numCols, cells, computed]);

  // Since ReactGrid v4 doesn't support separate display/edit values for TextCell,
  // we need to track which cell is being edited to show the formula.
  // We handle this via a custom onCellsChanged approach:
  // The cell's text is always the computed value for display.
  // When the user commits an edit, we get the newCell.text which is the raw input.
  // This works correctly: user types "=A1+1", commits, we store "=A1+1", display computed.

  const handleTitleBlur = useCallback(
    async (newTitle: string) => {
      if (newTitle === title) return;
      try {
        await renameNote({ id: noteId, title: newTitle });
        onTitleChange?.(newTitle);
      } catch (err) {
        console.error("Failed to rename spreadsheet:", err);
        setLocalTitle(title);
      }
    },
    [noteId, title, onTitleChange],
  );

  const statusColor =
    saveStatus === "saved"
      ? "green"
      : saveStatus === "saving"
        ? "dimmed"
        : saveStatus === "error"
          ? "red"
          : "dimmed";

  const statusText =
    saveStatus === "saved"
      ? "Saved"
      : saveStatus === "saving"
        ? "Saving…"
        : saveStatus === "error"
          ? "Save error"
          : "";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
      }}
      data-testid="spreadsheet-editor"
    >
      <Group
        gap="sm"
        style={{
          padding: "8px 16px",
          borderBottom: "1px solid var(--mantine-color-default-border)",
          flexShrink: 0,
        }}
      >
        <TextInput
          value={localTitle}
          onChange={(e) => setLocalTitle(e.currentTarget.value)}
          onBlur={(e) => handleTitleBlur(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          variant="unstyled"
          style={{ flex: 1, fontWeight: 600, fontSize: "1.1rem" }}
          data-testid="spreadsheet-title-input"
        />
        {statusText && (
          <Text size="xs" c={statusColor}>
            {statusText}
          </Text>
        )}
      </Group>
      <div
        ref={scrollContainerRef}
        style={{
          flex: 1,
          overflow: "auto",
          padding: 8,
        }}
      >
        <ReactGrid
          rows={rows}
          columns={columns}
          onCellsChanged={handleCellsChanged as (changes: CellChange[]) => void}
          enableFillHandle
          enableRangeSelection
          stickyTopRows={1}
          stickyLeftColumns={1}
        />
      </div>
    </div>
  );
}
