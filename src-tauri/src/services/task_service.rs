use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::db::tasks::NoteTask;
use crate::error::{AppError, AppResult};

fn now_ms() -> i64 {
    let dur = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap();
    (dur.as_secs() as i64) * 1000 + (dur.subsec_millis() as i64)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NoteTaskWithNote {
    pub id: String,
    pub note_id: String,
    pub note_title: String,
    pub content: String,
    pub is_checked: bool,
    pub notify_at: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Recursively walk a TipTap JSON node and collect all taskItem nodes.
fn collect_task_items(node: &Value, items: &mut Vec<(String, bool)>) {
    if let Some(node_type) = node.get("type").and_then(|t| t.as_str())
        && node_type == "taskItem"
    {
        let checked = node
            .get("attrs")
            .and_then(|a| a.get("checked"))
            .and_then(|c| c.as_bool())
            .unwrap_or(false);

        // Extract only the text from direct paragraph children (not nested taskLists)
        let text = extract_task_item_text(node);
        items.push((text, checked));

        // Continue recursing into children to find nested taskItems
        if let Some(children) = node.get("content").and_then(|c| c.as_array()) {
            for child in children {
                // Skip paragraph children — only recurse into nested taskLists
                if child.get("type").and_then(|t| t.as_str()) != Some("paragraph") {
                    collect_task_items(child, items);
                }
            }
        }
        return;
    }

    if let Some(children) = node.get("content").and_then(|c| c.as_array()) {
        for child in children {
            collect_task_items(child, items);
        }
    }
}

/// Extract text only from paragraph children of a taskItem (not nested taskLists).
fn extract_task_item_text(task_item_node: &Value) -> String {
    let mut parts = Vec::new();
    if let Some(children) = task_item_node.get("content").and_then(|c| c.as_array()) {
        for child in children {
            let child_type = child.get("type").and_then(|t| t.as_str()).unwrap_or("");
            // Only extract text from paragraph nodes, not nested taskList nodes
            if child_type == "paragraph" {
                parts.push(extract_text(child));
            }
        }
    }
    parts.join("")
}

/// Recursively extract all plain text content from a node.
fn extract_text(node: &Value) -> String {
    let mut parts = Vec::new();

    if let Some(node_type) = node.get("type").and_then(|t| t.as_str())
        && node_type == "text"
        && let Some(text) = node.get("text").and_then(|t| t.as_str())
    {
        return text.to_string();
    }

    if let Some(children) = node.get("content").and_then(|c| c.as_array()) {
        for child in children {
            parts.push(extract_text(child));
        }
    }

    parts.join("")
}

/// Parse TipTap JSON and extract task items (content, checked).
fn parse_task_items(content: &str) -> Vec<(String, bool)> {
    let Ok(json) = serde_json::from_str::<Value>(content) else {
        return Vec::new();
    };

    let mut items = Vec::new();
    collect_task_items(&json, &mut items);
    items
}

/// Sync tasks from TipTap JSON content to the note_tasks table.
/// Deletes all existing tasks for the note and re-inserts from current content.
/// Preserves notify_at values by matching on content text (best effort).
pub fn sync_tasks(conn: &Connection, note_id: &str, content: &str) -> AppResult<()> {
    let parsed_items = parse_task_items(content);

    // Load existing tasks to preserve notify_at values
    let existing = get_tasks_for_note(conn, note_id)?;
    let notify_map: std::collections::HashMap<String, Option<i64>> =
        existing.into_iter().map(|t| (t.content, t.notify_at)).collect();

    let now = now_ms();

    let tx = conn.unchecked_transaction()?;

    // Delete all existing tasks for this note
    tx.execute("DELETE FROM note_tasks WHERE note_id = ?1", [note_id])?;

    // Insert new tasks from content
    for (text, checked) in parsed_items {
        let id = Uuid::now_v7().to_string();
        let notify_at = notify_map.get(&text).copied().flatten();
        tx.execute(
            "INSERT INTO note_tasks (id, note_id, content, is_checked, notify_at, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![id, note_id, text, checked as i64, notify_at, now, now],
        )?;
    }

    tx.commit()?;
    Ok(())
}

/// Get all tasks for a given note, ordered by creation time.
pub fn get_tasks_for_note(conn: &Connection, note_id: &str) -> AppResult<Vec<NoteTask>> {
    let mut stmt = conn.prepare(
        "SELECT id, note_id, content, is_checked, notify_at, created_at, updated_at
         FROM note_tasks
         WHERE note_id = ?1
         ORDER BY created_at ASC",
    )?;

    let tasks = stmt
        .query_map([note_id], |row| {
            Ok(NoteTask {
                id: row.get(0)?,
                note_id: row.get(1)?,
                content: row.get(2)?,
                is_checked: row.get::<_, i64>(3)? != 0,
                notify_at: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(AppError::Database)?;

    Ok(tasks)
}

/// Get all tasks across all notes (for future task overview).
/// Includes note title, filters out tasks from deleted notes.
pub fn get_all_tasks(conn: &Connection) -> AppResult<Vec<NoteTaskWithNote>> {
    let mut stmt = conn.prepare(
        "SELECT t.id, t.note_id, n.title, t.content, t.is_checked, t.notify_at, t.created_at, t.updated_at
         FROM note_tasks t
         JOIN notes n ON n.id = t.note_id
         WHERE n.deleted_at IS NULL
         ORDER BY t.created_at ASC",
    )?;

    let tasks = stmt
        .query_map([], |row| {
            Ok(NoteTaskWithNote {
                id: row.get(0)?,
                note_id: row.get(1)?,
                note_title: row.get(2)?,
                content: row.get(3)?,
                is_checked: row.get::<_, i64>(4)? != 0,
                notify_at: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(AppError::Database)?;

    Ok(tasks)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_helpers::test_connection;
    use crate::services::note_service::{self, CreateNoteRequest};

    fn create_test_note(conn: &Connection) -> String {
        let req = CreateNoteRequest {
            parent_id: None,
            title: "Test Note".to_string(),
            is_folder: false,
        };
        note_service::create_note(conn, req).unwrap().id
    }

    const TIPTAP_JSON_WITH_TASKS: &str = r#"{
        "type": "doc",
        "content": [
            {
                "type": "taskList",
                "content": [
                    {
                        "type": "taskItem",
                        "attrs": { "checked": false },
                        "content": [
                            {
                                "type": "paragraph",
                                "content": [
                                    { "type": "text", "text": "Buy groceries" }
                                ]
                            }
                        ]
                    },
                    {
                        "type": "taskItem",
                        "attrs": { "checked": true },
                        "content": [
                            {
                                "type": "paragraph",
                                "content": [
                                    { "type": "text", "text": "Read book" }
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
    }"#;

    const TIPTAP_JSON_NO_TASKS: &str = r#"{
        "type": "doc",
        "content": [
            {
                "type": "paragraph",
                "content": [
                    { "type": "text", "text": "Just a regular paragraph" }
                ]
            }
        ]
    }"#;

    const TIPTAP_JSON_NESTED_TASKS: &str = r#"{
        "type": "doc",
        "content": [
            {
                "type": "taskList",
                "content": [
                    {
                        "type": "taskItem",
                        "attrs": { "checked": false },
                        "content": [
                            {
                                "type": "paragraph",
                                "content": [
                                    { "type": "text", "text": "Parent task" }
                                ]
                            },
                            {
                                "type": "taskList",
                                "content": [
                                    {
                                        "type": "taskItem",
                                        "attrs": { "checked": true },
                                        "content": [
                                            {
                                                "type": "paragraph",
                                                "content": [
                                                    { "type": "text", "text": "Child task" }
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
    }"#;

    #[test]
    fn test_parse_task_items_extracts_tasks() {
        let items = parse_task_items(TIPTAP_JSON_WITH_TASKS);
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].0, "Buy groceries");
        assert!(!items[0].1);
        assert_eq!(items[1].0, "Read book");
        assert!(items[1].1);
    }

    #[test]
    fn test_parse_task_items_returns_empty_for_no_tasks() {
        let items = parse_task_items(TIPTAP_JSON_NO_TASKS);
        assert!(items.is_empty());
    }

    #[test]
    fn test_parse_task_items_nested() {
        let items = parse_task_items(TIPTAP_JSON_NESTED_TASKS);
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].0, "Parent task");
        assert!(!items[0].1);
        assert_eq!(items[1].0, "Child task");
        assert!(items[1].1);
    }

    #[test]
    fn test_parse_task_items_invalid_json() {
        let items = parse_task_items("not valid json");
        assert!(items.is_empty());
    }

    #[test]
    fn test_sync_tasks_inserts_tasks() {
        let conn = test_connection();
        let note_id = create_test_note(&conn);

        sync_tasks(&conn, &note_id, TIPTAP_JSON_WITH_TASKS).unwrap();

        let tasks = get_tasks_for_note(&conn, &note_id).unwrap();
        assert_eq!(tasks.len(), 2);
        assert_eq!(tasks[0].content, "Buy groceries");
        assert!(!tasks[0].is_checked);
        assert_eq!(tasks[1].content, "Read book");
        assert!(tasks[1].is_checked);
    }

    #[test]
    fn test_sync_tasks_replaces_existing() {
        let conn = test_connection();
        let note_id = create_test_note(&conn);

        sync_tasks(&conn, &note_id, TIPTAP_JSON_WITH_TASKS).unwrap();
        assert_eq!(get_tasks_for_note(&conn, &note_id).unwrap().len(), 2);

        sync_tasks(&conn, &note_id, TIPTAP_JSON_NO_TASKS).unwrap();
        assert_eq!(get_tasks_for_note(&conn, &note_id).unwrap().len(), 0);
    }

    #[test]
    fn test_sync_tasks_preserves_notify_at() {
        let conn = test_connection();
        let note_id = create_test_note(&conn);

        // First sync to insert tasks
        sync_tasks(&conn, &note_id, TIPTAP_JSON_WITH_TASKS).unwrap();

        // Manually set notify_at on the first task
        let tasks = get_tasks_for_note(&conn, &note_id).unwrap();
        let task_id = &tasks[0].id;
        conn.execute(
            "UPDATE note_tasks SET notify_at = 9999 WHERE id = ?1",
            [task_id],
        ).unwrap();

        // Re-sync — notify_at should be preserved for "Buy groceries"
        sync_tasks(&conn, &note_id, TIPTAP_JSON_WITH_TASKS).unwrap();
        let updated = get_tasks_for_note(&conn, &note_id).unwrap();
        let grocery_task = updated.iter().find(|t| t.content == "Buy groceries").unwrap();
        assert_eq!(grocery_task.notify_at, Some(9999));
    }

    #[test]
    fn test_get_all_tasks_excludes_deleted_notes() {
        let conn = test_connection();
        let note_id = create_test_note(&conn);

        sync_tasks(&conn, &note_id, TIPTAP_JSON_WITH_TASKS).unwrap();

        // Soft-delete the note
        conn.execute(
            "UPDATE notes SET deleted_at = 1234 WHERE id = ?1",
            [&note_id],
        ).unwrap();

        let all_tasks = get_all_tasks(&conn).unwrap();
        assert!(all_tasks.is_empty());
    }

    #[test]
    fn test_get_all_tasks_includes_note_title() {
        let conn = test_connection();
        let note_id = create_test_note(&conn);

        sync_tasks(&conn, &note_id, TIPTAP_JSON_WITH_TASKS).unwrap();

        let all_tasks = get_all_tasks(&conn).unwrap();
        assert_eq!(all_tasks.len(), 2);
        assert_eq!(all_tasks[0].note_title, "Test Note");
    }
}
