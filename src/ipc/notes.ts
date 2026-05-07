import { invoke } from "@tauri-apps/api/core";

export interface Note {
  id: string;
  parent_id: string | null;
  title: string;
  content: string | null;
  sort_order: number;
  is_folder: boolean;
  note_type: string;
  deleted_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface NoteRow {
  id: string;
  parent_id: string | null;
  title: string;
  sort_order: number;
  is_folder: boolean;
  note_type: string;
  deleted_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface PivotConfig {
  id: string;
  sourceRange: string;
  anchorCell: string;
  rowField: string;
  colField: string;
  valueField: string;
  aggregation: "SUM" | "COUNT" | "AVG";
}

export interface SpreadsheetContent {
  rows: number;
  cols: number;
  cells: Record<string, string>;
  pivots: PivotConfig[];
  macros: unknown[];
}

export function createNote(params: {
  parentId?: string;
  title: string;
  isFolder: boolean;
}): Promise<Note> {
  return invoke("create_note", {
    parentId: params.parentId ?? null,
    title: params.title,
    isFolder: params.isFolder,
  });
}

export function getNote(id: string): Promise<Note> {
  return invoke("get_note", { id });
}

export function listNotes(includeDeleted?: boolean): Promise<NoteRow[]> {
  return invoke("list_notes", { includeDeleted: includeDeleted ?? false });
}

export function updateNote(params: {
  id: string;
  title: string;
  content: string;
  plainText: string;
}): Promise<void> {
  return invoke("update_note", {
    id: params.id,
    title: params.title,
    content: params.content,
    plainText: params.plainText,
  });
}

export function deleteNote(id: string): Promise<void> {
  return invoke("delete_note", { id });
}

export function renameNote(params: {
  id: string;
  title: string;
}): Promise<void> {
  return invoke("rename_note", {
    id: params.id,
    title: params.title,
  });
}

export function deleteNoteTree(id: string): Promise<void> {
  return invoke("delete_note_tree", { id });
}

export function moveNote(params: {
  id: string;
  newParentId?: string | null;
  newSortOrder: number;
}): Promise<void> {
  return invoke("move_note", {
    id: params.id,
    newParentId: params.newParentId ?? null,
    newSortOrder: params.newSortOrder,
  });
}

export function restoreNote(id: string): Promise<void> {
  return invoke("restore_note", { id });
}

export function copyNote(id: string): Promise<Note> {
  return invoke("copy_note", { id });
}

export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  rank: number;
}

export function searchNotes(query: string): Promise<SearchResult[]> {
  return invoke("search_notes", { query });
}

export function performGlobalReplace(
  noteId: string,
  findText: string,
  replaceText: string,
): Promise<void> {
  return invoke("global_replace", { noteId, findText, replaceText });
}

export function hardDeleteNote(id: string): Promise<void> {
  return invoke("hard_delete_note", { id });
}

export function createSpreadsheetNote(params: { parentId?: string; title: string }): Promise<Note> {
  return invoke("create_spreadsheet_note", {
    parentId: params.parentId ?? null,
    title: params.title,
  });
}

export function updateSpreadsheet(params: {
  noteId: string;
  content: string;
  plainText: string;
}): Promise<void> {
  return invoke("update_spreadsheet", {
    noteId: params.noteId,
    content: params.content,
    plainText: params.plainText,
  });
}

export function updateSpreadsheetCell(params: {
  noteId: string;
  row: number;
  col: number;
  value: string;
}): Promise<void> {
  return invoke("update_spreadsheet_cell", {
    noteId: params.noteId,
    row: params.row,
    col: params.col,
    value: params.value,
  });
}
