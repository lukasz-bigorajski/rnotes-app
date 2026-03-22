use tauri::State;

use crate::db::tasks::NoteTask;
use crate::error::AppError;
use crate::services::task_service::{self, NoteTaskWithNote};
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
pub fn get_note_tasks(
    db: State<'_, DbState>,
    note_id: String,
) -> Result<Vec<NoteTask>, AppError> {
    let conn = lock_db(&db)?;
    task_service::get_tasks_for_note(&conn, &note_id)
}

#[tauri::command]
pub fn get_all_tasks(db: State<'_, DbState>) -> Result<Vec<NoteTaskWithNote>, AppError> {
    let conn = lock_db(&db)?;
    task_service::get_all_tasks(&conn)
}
