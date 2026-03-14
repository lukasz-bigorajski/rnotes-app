import { invoke } from "@tauri-apps/api/core";

export interface Note {
  id: string;
  parent_id: string | null;
  title: string;
  content: string | null;
  sort_order: number;
  is_folder: boolean;
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
  deleted_at: number | null;
  created_at: number;
  updated_at: number;
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
