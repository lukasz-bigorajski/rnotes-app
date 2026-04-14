mod commands;
mod db;
mod error;
mod services;
mod state;

use state::{AppConfig, AppHealthState, ConfigState, DbHealth, DbState, UserConfigState};
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir = services::config_service::resolve_data_dir(app.handle())?;
            let assets_dir = data_dir.join("assets");
            std::fs::create_dir_all(&assets_dir)?;

            let db_path = data_dir.join("rnotes.db");

            // Determine DB health before opening.
            let db_missing = !db_path.exists();
            let (conn, db_health) = if db_missing {
                // No DB file — open/create fresh (migrations will initialise it).
                let c = db::open_and_initialize(&db_path)?;
                (c, DbHealth::Missing)
            } else {
                // File exists — open it and run an integrity check.
                match db::open_and_initialize(&db_path) {
                    Ok(c) => {
                        let integrity_ok: bool = c
                            .query_row("PRAGMA integrity_check", [], |row| {
                                let result: String = row.get(0)?;
                                Ok(result == "ok")
                            })
                            .unwrap_or(false);
                        if integrity_ok {
                            (c, DbHealth::Ok)
                        } else {
                            (c, DbHealth::Corrupted)
                        }
                    }
                    Err(_) => {
                        // Cannot open — create an empty in-memory placeholder so
                        // the app still starts; the frontend will prompt to restore.
                        let c = rusqlite::Connection::open_in_memory()
                            .expect("in-memory DB must always open");
                        db::schema::run_migrations(&c).expect("in-memory migrations must succeed");
                        (c, DbHealth::Corrupted)
                    }
                }
            };

            let user_config = services::config_service::load_user_config(&data_dir);
            let first_launch_marker = data_dir.join(".window-launched");

            app.manage(DbState(Mutex::new(conn)));
            app.manage(AppHealthState(Mutex::new(db_health)));
            app.manage(ConfigState(Mutex::new(AppConfig {
                data_dir,
                assets_dir,
            })));
            app.manage(UserConfigState(Mutex::new(user_config)));

            // On first launch (no saved window state), maximize the window.
            // On subsequent launches the window-state plugin has already restored
            // the user's last size/position before setup() runs.
            if let Some(win) = app.get_webview_window("main") {
                if !first_launch_marker.exists() {
                    let _ = std::fs::write(&first_launch_marker, "");
                    let _ = win.maximize();
                }
                let _ = win.show();
            }

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

            // Spawn periodic backup task: first run after 1 minute, then every 30 minutes.
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                // Initial delay before first backup.
                tokio::time::sleep(std::time::Duration::from_secs(60)).await;
                let mut interval = tokio::time::interval(std::time::Duration::from_secs(30 * 60));
                loop {
                    interval.tick().await;
                    let db_state = app_handle.state::<DbState>();
                    let config_state = app_handle.state::<state::ConfigState>();
                    // Try to acquire both locks; skip this cycle if either is busy.
                    let conn_guard = match db_state.0.lock() {
                        Ok(g) => g,
                        Err(_) => continue,
                    };
                    let config_guard = match config_state.0.lock() {
                        Ok(g) => g,
                        Err(_) => continue,
                    };
                    let db_path = config_guard.data_dir.join("rnotes.db");
                    let data_dir = config_guard.data_dir.clone();
                    drop(config_guard);
                    if let Err(e) =
                        services::backup_service::create_backup(&conn_guard, &db_path, &data_dir)
                    {
                        eprintln!("periodic backup failed: {e}");
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
            commands::note_commands::search_notes,
            commands::note_commands::global_replace,
            commands::config_commands::get_config,
            commands::config_commands::get_user_config,
            commands::config_commands::update_user_config,
            commands::assets::save_image,
            commands::assets::get_image_url,
            commands::task_commands::get_note_tasks,
            commands::task_commands::get_all_tasks,
            commands::task_commands::update_task_checked,
            commands::backup::create_backup,
            commands::backup::list_backups,
            commands::backup::get_app_health,
            commands::backup::restore_from_backup,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        // Flush the WAL back into the main database file on clean shutdown.
        // This ensures the -wal and -shm sidecar files are cleaned up so the
        // database is in a consistent single-file state when the app exits.
        // Errors are logged but do not prevent the process from exiting —
        // SQLite will replay any remaining WAL frames on the next open.
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                let db_state = app_handle.state::<DbState>();
                if let Ok(conn) = db_state.0.lock()
                    && let Err(e) = db::wal_checkpoint(&conn)
                {
                    eprintln!("WAL checkpoint failed on exit: {e}");
                }
            }
        });
}
