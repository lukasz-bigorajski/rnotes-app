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
        .plugin(tauri_plugin_notification::init())
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

            // Spawn background task to check for due notifications every 60 seconds
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let mut interval = tokio::time::interval(std::time::Duration::from_secs(60));
                loop {
                    interval.tick().await;
                    let db_state = app_handle.state::<DbState>();
                    if let Ok(conn) = db_state.0.lock() {
                        let _ = services::notification_service::check_and_send_notifications(
                            &app_handle,
                            &conn,
                        );
                    }
                }
            });

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
            commands::task_commands::update_task_checked,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
