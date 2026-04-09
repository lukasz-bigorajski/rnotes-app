use tauri::State;

use crate::error::AppError;
use crate::services::backup_service::{self, BackupInfo};
use crate::state::{AppHealthState, ConfigState, DbHealth, DbState};

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

/// Return the current DB health status as a string.
///
/// Possible values: `"ok"`, `"missing"`, `"corrupted"`, `"recovered"`.
#[tauri::command]
pub fn get_app_health(health_state: State<'_, AppHealthState>) -> Result<String, AppError> {
    let health = health_state
        .0
        .lock()
        .map_err(|_| AppError::Config("health state lock poisoned".into()))?;
    Ok(health.as_str().to_string())
}

/// Restore the database from a backup file.
///
/// Steps:
/// 1. If the current DB file exists (even if corrupted), move it to
///    `backups/rnotes_pre_restore_YYYYMMDD_HHMMSS.db` as a safety net.
/// 2. Copy the selected backup file to the main DB location.
/// 3. Re-open the connection, run integrity check, and run pending migrations.
/// 4. Update the in-process `DbState` with the new connection.
/// 5. Set `AppHealthState` to `recovered`.
#[tauri::command]
pub fn restore_from_backup(
    backup_path: String,
    db_state: State<'_, DbState>,
    config_state: State<'_, ConfigState>,
    health_state: State<'_, AppHealthState>,
) -> Result<(), AppError> {
    let data_dir = {
        let config = config_state
            .0
            .lock()
            .map_err(|_| AppError::Config("config lock poisoned".into()))?;
        config.data_dir.clone()
    };

    let db_path = data_dir.join("rnotes.db");
    let src = std::path::Path::new(&backup_path);

    // Validate the backup file exists before proceeding.
    if !src.exists() {
        return Err(AppError::NotFound(format!(
            "backup file not found: {}",
            backup_path
        )));
    }

    // Lock DB early so no other command can use it while we swap files.
    let mut conn_guard = db_state
        .0
        .lock()
        .map_err(|_| AppError::Config("database lock poisoned".into()))?;

    // 1. Safety-copy of the existing (possibly corrupted) DB.
    if db_path.exists() {
        let backups_dir = backup_service::backups_dir(&data_dir)?;
        let ts = backup_service::pre_restore_timestamp();
        let safety_name = format!("rnotes_pre_restore_{}.db", ts);
        let safety_dest = backups_dir.join(safety_name);
        std::fs::copy(&db_path, &safety_dest)?;
    }

    // 2. Copy the chosen backup file to the main DB location.
    std::fs::copy(src, &db_path)?;

    // Remove stale WAL / SHM sidecars if present.
    let wal = db_path.with_extension("db-wal");
    let shm = db_path.with_extension("db-shm");
    let _ = std::fs::remove_file(wal);
    let _ = std::fs::remove_file(shm);

    // 3. Open the restored file and verify integrity.
    let new_conn = crate::db::open_and_initialize(&db_path)?;

    let integrity_ok: bool = new_conn
        .query_row("PRAGMA integrity_check", [], |row| {
            let result: String = row.get(0)?;
            Ok(result == "ok")
        })
        .unwrap_or(false);

    if !integrity_ok {
        return Err(AppError::Config(
            "restored database failed integrity check".into(),
        ));
    }

    // 4. Swap the in-process connection.
    *conn_guard = new_conn;

    // 5. Mark health as recovered.
    let mut health = health_state
        .0
        .lock()
        .map_err(|_| AppError::Config("health state lock poisoned".into()))?;
    *health = DbHealth::Recovered;

    Ok(())
}
