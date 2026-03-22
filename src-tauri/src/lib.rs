mod commands;
mod db;
mod error;
mod services;
mod state;

use state::{AppConfig, ConfigState, DbState};
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = services::config_service::resolve_data_dir(app.handle())?;
            let assets_dir = data_dir.join("assets");
            std::fs::create_dir_all(&assets_dir)?;

            let db_path = data_dir.join("rnotes.db");
            let conn = db::open_and_initialize(&db_path)?;

            app.manage(DbState(Mutex::new(conn)));
            app.manage(ConfigState(Mutex::new(AppConfig {
                data_dir,
                assets_dir,
            })));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::note_commands::create_note,
            commands::note_commands::get_note,
            commands::note_commands::list_notes,
            commands::note_commands::update_note,
            commands::note_commands::delete_note,
            commands::note_commands::rename_note,
            commands::note_commands::delete_note_tree,
            commands::note_commands::move_note,
            commands::note_commands::restore_note,
            commands::config_commands::get_config,
            commands::assets::save_image,
            commands::assets::get_image_url,
            commands::task_commands::get_note_tasks,
            commands::task_commands::get_all_tasks,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
