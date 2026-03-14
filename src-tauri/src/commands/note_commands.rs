use tauri::State;

use crate::db::notes::{Note, NoteRow};
use crate::error::AppError;
use crate::services::note_service::{self, CreateNoteRequest};
use crate::state::DbState;

fn lock_db<'a>(state: &'a State<'a, DbState>) -> Result<std::sync::MutexGuard<'a, rusqlite::Connection>, AppError> {
    state.0.lock().map_err(|_| AppError::Config("database lock poisoned".into()))
}

#[tauri::command]
pub fn create_note(
    state: State<'_, DbState>,
    parent_id: Option<String>,
    title: String,
    is_folder: bool,
) -> Result<Note, AppError> {
    let conn = lock_db(&state)?;
    note_service::create_note(&conn, CreateNoteRequest { parent_id, title, is_folder })
}

#[tauri::command]
pub fn get_note(state: State<'_, DbState>, id: String) -> Result<Note, AppError> {
    let conn = lock_db(&state)?;
    note_service::get_note(&conn, &id)
}

#[tauri::command]
pub fn list_notes(
    state: State<'_, DbState>,
    include_deleted: Option<bool>,
) -> Result<Vec<NoteRow>, AppError> {
    let conn = lock_db(&state)?;
    note_service::list_notes(&conn, include_deleted.unwrap_or(false))
}

#[tauri::command]
pub fn update_note(
    state: State<'_, DbState>,
    id: String,
    title: String,
    content: String,
    plain_text: String,
) -> Result<(), AppError> {
    let conn = lock_db(&state)?;
    note_service::update_note(&conn, &id, &title, &content, &plain_text)
}

#[tauri::command]
pub fn delete_note(state: State<'_, DbState>, id: String) -> Result<(), AppError> {
    let conn = lock_db(&state)?;
    note_service::delete_note(&conn, &id)
}

#[tauri::command]
pub fn rename_note(state: State<'_, DbState>, id: String, title: String) -> Result<(), AppError> {
    let conn = lock_db(&state)?;
    note_service::rename_note(&conn, &id, &title)
}

#[tauri::command]
pub fn delete_note_tree(state: State<'_, DbState>, id: String) -> Result<(), AppError> {
    let conn = lock_db(&state)?;
    note_service::delete_note_tree(&conn, &id)
}

#[tauri::command]
pub fn move_note(
    state: State<'_, DbState>,
    id: String,
    new_parent_id: Option<String>,
    new_sort_order: f64,
) -> Result<(), AppError> {
    let conn = lock_db(&state)?;
    note_service::move_note(&conn, &id, new_parent_id.as_deref(), new_sort_order)
}

#[tauri::command]
pub fn restore_note(state: State<'_, DbState>, id: String) -> Result<(), AppError> {
    let conn = lock_db(&state)?;
    note_service::restore_note(&conn, &id)
}
