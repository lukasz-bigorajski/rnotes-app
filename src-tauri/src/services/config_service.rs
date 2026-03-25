use std::path::{Path, PathBuf};
use tauri::Manager;

use crate::error::{AppError, AppResult};
use crate::state::UserConfig;

pub fn resolve_data_dir(app: &tauri::AppHandle) -> AppResult<PathBuf> {
    app.path()
        .app_data_dir()
        .map_err(|e| AppError::Config(e.to_string()))
}

pub fn load_user_config(data_dir: &Path) -> UserConfig {
    let path = data_dir.join("config.json");
    match std::fs::read_to_string(&path) {
        Ok(contents) => serde_json::from_str(&contents).unwrap_or_default(),
        Err(_) => UserConfig::default(),
    }
}

pub fn save_user_config(data_dir: &Path, config: &UserConfig) -> AppResult<()> {
    let path = data_dir.join("config.json");
    let json = serde_json::to_string_pretty(config)
        .map_err(|e| AppError::Config(e.to_string()))?;
    std::fs::write(&path, json)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn temp_dir() -> (TempDir, PathBuf) {
        let dir = TempDir::new().unwrap();
        let path = dir.path().to_path_buf();
        (dir, path)
    }

    #[test]
    fn test_default_config() {
        let cfg = UserConfig::default();
        assert_eq!(cfg.theme, "auto");
        assert_eq!(cfg.auto_save_interval_ms, 1000);
        assert_eq!(cfg.font_size, 16);
        assert_eq!(cfg.font_family, "system");
        assert!(cfg.spell_check);
    }

    #[test]
    fn test_save_and_load_config() {
        let (_dir, data_dir) = temp_dir();
        let mut cfg = UserConfig::default();
        cfg.theme = "dark".to_string();
        cfg.font_size = 18;
        cfg.auto_save_interval_ms = 2000;
        cfg.spell_check = false;

        save_user_config(&data_dir, &cfg).unwrap();

        let loaded = load_user_config(&data_dir);
        assert_eq!(loaded.theme, "dark");
        assert_eq!(loaded.font_size, 18);
        assert_eq!(loaded.auto_save_interval_ms, 2000);
        assert!(!loaded.spell_check);
    }

    #[test]
    fn test_load_config_missing_file_returns_defaults() {
        let (_dir, data_dir) = temp_dir();
        let cfg = load_user_config(&data_dir);
        assert_eq!(cfg.theme, "auto");
        assert_eq!(cfg.font_size, 16);
    }

    #[test]
    fn test_load_config_invalid_json_returns_defaults() {
        let (_dir, data_dir) = temp_dir();
        let path = data_dir.join("config.json");
        std::fs::write(&path, "not valid json").unwrap();
        let cfg = load_user_config(&data_dir);
        assert_eq!(cfg.theme, "auto");
    }
}
