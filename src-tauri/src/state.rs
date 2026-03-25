use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct DbState(pub Mutex<Connection>);

pub struct AppConfig {
    pub data_dir: PathBuf,
    pub assets_dir: PathBuf,
}

pub struct ConfigState(pub Mutex<AppConfig>);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserConfig {
    pub theme: String,
    pub auto_save_interval_ms: u64,
    pub font_size: u16,
    pub font_family: String,
    pub spell_check: bool,
}

impl Default for UserConfig {
    fn default() -> Self {
        Self {
            theme: "auto".to_string(),
            auto_save_interval_ms: 1000,
            font_size: 16,
            font_family: "system".to_string(),
            spell_check: true,
        }
    }
}

pub struct UserConfigState(pub Mutex<UserConfig>);
