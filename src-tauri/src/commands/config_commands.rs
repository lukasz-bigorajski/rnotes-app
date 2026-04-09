use serde::Serialize;
use tauri::State;

use crate::error::AppError;
use crate::services::config_service;
use crate::state::{ConfigState, UserConfig, UserConfigState};

#[derive(Serialize)]
pub struct ConfigResponse {
    pub data_dir: String,
}

#[tauri::command]
pub fn get_config(state: State<'_, ConfigState>) -> Result<ConfigResponse, AppError> {
    let config = state
        .0
        .lock()
        .map_err(|_| AppError::Config("config lock poisoned".into()))?;
    Ok(ConfigResponse {
        data_dir: config.data_dir.to_string_lossy().into_owned(),
    })
}

#[tauri::command]
pub fn get_user_config(
    user_config_state: State<'_, UserConfigState>,
) -> Result<UserConfig, AppError> {
    let cfg = user_config_state
        .0
        .lock()
        .map_err(|_| AppError::Config("user config lock poisoned".into()))?;
    Ok(cfg.clone())
}

#[tauri::command]
pub fn update_user_config(
    config: UserConfig,
    user_config_state: State<'_, UserConfigState>,
    app_config_state: State<'_, ConfigState>,
) -> Result<(), AppError> {
    let data_dir = {
        let app_cfg = app_config_state
            .0
            .lock()
            .map_err(|_| AppError::Config("app config lock poisoned".into()))?;
        app_cfg.data_dir.clone()
    };

    config_service::save_user_config(&data_dir, &config)?;

    let mut stored = user_config_state
        .0
        .lock()
        .map_err(|_| AppError::Config("user config lock poisoned".into()))?;
    *stored = config;

    Ok(())
}
