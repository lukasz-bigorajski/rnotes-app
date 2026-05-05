use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct DbState(pub Mutex<Connection>);

pub struct AppConfig {
    pub data_dir: PathBuf,
    #[allow(dead_code)]
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

/// Represents the health status of the database at startup.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DbHealth {
    /// Database loaded and passed integrity check.
    Ok,
    /// Database file was not found (fresh start or deleted).
    Missing,
    /// Database file exists but failed integrity check.
    Corrupted,
    /// Database was restored from backup during this session.
    Recovered,
}

impl DbHealth {
    pub fn as_str(&self) -> &'static str {
        match self {
            DbHealth::Ok => "ok",
            DbHealth::Missing => "missing",
            DbHealth::Corrupted => "corrupted",
            DbHealth::Recovered => "recovered",
        }
    }
}

pub struct AppHealthState(pub Mutex<DbHealth>);
