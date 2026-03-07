use std::path::PathBuf;
use tauri::Manager;

use crate::error::{AppError, AppResult};

pub fn resolve_data_dir(app: &tauri::AppHandle) -> AppResult<PathBuf> {
    app.path()
        .app_data_dir()
        .map_err(|e| AppError::Config(e.to_string()))
}
