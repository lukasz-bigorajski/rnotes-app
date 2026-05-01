// notification_service.rs
use rusqlite::Connection;
use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

use crate::error::AppResult;

fn now_ms() -> i64 {
    let dur = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap();
    (dur.as_secs() as i64) * 1000 + (dur.subsec_millis() as i64)
}

/// Check for due tasks and send OS notifications for any that are overdue and not yet notified.
/// Updates `notified_at` on each notified task to prevent duplicate notifications.
pub fn check_and_send_notifications(app_handle: &AppHandle, conn: &Connection) -> AppResult<()> {
    let now = now_ms();

    // Query tasks that are:
    // - not checked (is_checked = 0)
    // - have a notify_at that has passed
    // - have not yet been notified (notified_at IS NULL)
    let mut stmt = conn.prepare(
        "SELECT t.id, t.content, n.title
         FROM note_tasks t
         JOIN notes n ON n.id = t.note_id
         WHERE t.is_checked = 0
           AND t.notify_at IS NOT NULL
           AND t.notify_at <= ?1
           AND t.notified_at IS NULL
           AND n.deleted_at IS NULL
         ORDER BY t.notify_at ASC",
    )?;

    struct DueTask {
        id: String,
        content: String,
        note_title: String,
    }

    let due_tasks: Vec<DueTask> = stmt
        .query_map([now], |row| {
            Ok(DueTask {
                id: row.get(0)?,
                content: row.get(1)?,
                note_title: row.get(2)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    for task in &due_tasks {
        let body = format!("{} — {}", task.note_title, task.content);

        // Send OS notification.
        // On Linux this requires libnotify / libdbus-1 to be installed.
        // If it fails (e.g. missing dbus on a headless system) we log and continue.
        if let Err(e) = app_handle
            .notification()
            .builder()
            .title("Task Reminder")
            .body(&body)
            .show()
        {
            eprintln!("notification send failed (task {}): {}", task.id, e);
        }

        // Mark as notified
        conn.execute(
            "UPDATE note_tasks SET notified_at = ?1 WHERE id = ?2",
            rusqlite::params![now, task.id],
        )?;
    }

    Ok(())
}
