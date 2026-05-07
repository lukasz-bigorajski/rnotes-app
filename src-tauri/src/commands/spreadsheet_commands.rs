use tauri::State;

use crate::db::notes::Note;
use crate::error::AppError;
use crate::services::spreadsheet_service;
use crate::state::DbState;

fn lock_db<'a>(
    state: &'a State<'a, DbState>,
) -> Result<std::sync::MutexGuard<'a, rusqlite::Connection>, AppError> {
    state
        .0
        .lock()
        .map_err(|_| AppError::Config("database lock poisoned".into()))
}

#[tauri::command]
pub fn create_spreadsheet_note(
    state: State<'_, DbState>,
    parent_id: Option<String>,
    title: String,
) -> Result<Note, AppError> {
    let conn = lock_db(&state)?;
    spreadsheet_service::create_spreadsheet_note(&conn, parent_id, title)
}

#[tauri::command]
pub fn update_spreadsheet(
    state: State<'_, DbState>,
    note_id: String,
    content: String,
    plain_text: String,
) -> Result<(), AppError> {
    let conn = lock_db(&state)?;
    spreadsheet_service::update_spreadsheet(&conn, &note_id, &content, &plain_text)
}

#[tauri::command]
pub fn update_spreadsheet_cell(
    state: State<'_, DbState>,
    note_id: String,
    row: usize,
    col: usize,
    value: String,
) -> Result<(), AppError> {
    let conn = lock_db(&state)?;
    spreadsheet_service::update_spreadsheet_cell(&conn, &note_id, row, col, &value)
}
