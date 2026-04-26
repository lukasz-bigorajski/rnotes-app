use tauri::{AppHandle, State};

use crate::error::AppError;
use crate::services::config_service;
use crate::services::export_service::{self, ImportMode};
use crate::state::DbState;

fn lock_db<'a>(
    state: &'a State<'a, DbState>,
) -> Result<std::sync::MutexGuard<'a, rusqlite::Connection>, AppError> {
    state
        .0
        .lock()
        .map_err(|_| AppError::Config("database lock poisoned".into()))
}

/// Export all notes, tasks and assets to a `.rnotes` zip archive.
///
/// `path` is the absolute destination file path chosen by the user via file dialog.
#[tauri::command]
pub fn export_all(
    app: AppHandle,
    state: State<'_, DbState>,
    path: String,
) -> Result<(), AppError> {
    let conn = lock_db(&state)?;
    let data_dir = config_service::resolve_data_dir(&app)?;
    let assets_dir = data_dir.join("assets");
    export_service::export_all(&conn, std::path::Path::new(&path), &assets_dir)
}

/// Import data from a `.rnotes` zip archive.
///
/// `path` is the absolute source file path chosen by the user via file dialog.
/// `mode` is one of:
///   - `"replace"`     — wipe all existing data, then insert archive contents
///   - `"add_missing"` — only insert rows whose ID does not already exist
///   - `"merge"`       — upsert: overwrite existing rows and insert new ones
#[tauri::command]
pub fn import_all(
    app: AppHandle,
    state: State<'_, DbState>,
    path: String,
    mode: ImportMode,
) -> Result<(), AppError> {
    let conn = lock_db(&state)?;
    let data_dir = config_service::resolve_data_dir(&app)?;
    let assets_dir = data_dir.join("assets");
    export_service::import_all(&conn, std::path::Path::new(&path), &assets_dir, mode)
}
