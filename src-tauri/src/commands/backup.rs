use tauri::State;

use crate::error::AppError;
use crate::services::backup_service::{self, BackupInfo};
use crate::state::{ConfigState, DbState};

fn lock_db<'a>(
    state: &'a State<'a, DbState>,
) -> Result<std::sync::MutexGuard<'a, rusqlite::Connection>, AppError> {
    state
        .0
        .lock()
        .map_err(|_| AppError::Config("database lock poisoned".into()))
}

/// Create a backup immediately (manual trigger from the frontend).
#[tauri::command]
pub fn create_backup(
    db_state: State<'_, DbState>,
    config_state: State<'_, ConfigState>,
) -> Result<BackupInfo, AppError> {
    let conn = lock_db(&db_state)?;
    let config = config_state
        .0
        .lock()
        .map_err(|_| AppError::Config("config lock poisoned".into()))?;
    let db_path = config.data_dir.join("rnotes.db");
    backup_service::create_backup(&conn, &db_path, &config.data_dir)
}

/// Return metadata for all available backup files, newest first.
#[tauri::command]
pub fn list_backups(config_state: State<'_, ConfigState>) -> Result<Vec<BackupInfo>, AppError> {
    let config = config_state
        .0
        .lock()
        .map_err(|_| AppError::Config("config lock poisoned".into()))?;
    backup_service::list_backups(&config.data_dir)
}
