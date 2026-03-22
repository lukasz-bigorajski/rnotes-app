import { invoke } from "@tauri-apps/api/core";

export interface NoteTask {
  id: string;
  note_id: string;
  content: string;
  is_checked: boolean;
  notify_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface NoteTaskWithNote {
  id: string;
  note_id: string;
  note_title: string;
  content: string;
  is_checked: boolean;
  notify_at: number | null;
  created_at: number;
  updated_at: number;
}

export function getNoteTasks(noteId: string): Promise<NoteTask[]> {
  return invoke("get_note_tasks", { noteId });
}

export function getAllTasks(): Promise<NoteTaskWithNote[]> {
  return invoke("get_all_tasks");
}
