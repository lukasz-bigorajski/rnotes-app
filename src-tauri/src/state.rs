use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct DbState(pub Mutex<Connection>);

pub struct AppConfig {
    pub data_dir: PathBuf,
    pub assets_dir: PathBuf,
}

pub struct ConfigState(pub Mutex<AppConfig>);
