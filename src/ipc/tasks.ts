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

export interface UpdateTaskCheckedResult {
  note_id: string;
}

export function updateTaskChecked(
  taskId: string,
  isChecked: boolean,
): Promise<UpdateTaskCheckedResult> {
  return invoke("update_task_checked", { taskId, isChecked });
}

export function createInboxTask(content: string, notifyAt: number | null): Promise<NoteTask> {
  return invoke("create_inbox_task", { content, notifyAt });
}
