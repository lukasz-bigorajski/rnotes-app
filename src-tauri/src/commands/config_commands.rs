use serde::Serialize;
use tauri::State;

use crate::error::AppError;
use crate::state::ConfigState;

#[derive(Serialize)]
pub struct ConfigResponse {
    pub data_dir: String,
}

#[tauri::command]
pub fn get_config(state: State<'_, ConfigState>) -> Result<ConfigResponse, AppError> {
    let config = state.0.lock().map_err(|_| AppError::Config("config lock poisoned".into()))?;
    Ok(ConfigResponse {
        data_dir: config.data_dir.to_string_lossy().into_owned(),
    })
}
