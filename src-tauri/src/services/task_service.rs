use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::db::tasks::NoteTask;
use crate::error::{AppError, AppResult};
use crate::services::note_service;

/// Returned by `update_task_checked` so callers know which note was affected.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateTaskCheckedResult {
    pub note_id: String,
}

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
    pub notified_at: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Parse an ISO 8601 datetime string (e.g. "2026-03-25T14:30") into UNIX milliseconds.
fn iso_to_unix_ms(iso: &str) -> Option<i64> {
    // Try to parse as a naive datetime with the format "YYYY-MM-DDTHH:MM" or "YYYY-MM-DDTHH:MM:SS"
    // We use a simple manual approach to avoid adding chrono as a dependency.
    let parts: Vec<&str> = iso.splitn(2, 'T').collect();
    if parts.len() != 2 {
        return None;
    }
    let date_parts: Vec<u32> = parts[0].split('-').filter_map(|s| s.parse().ok()).collect();
    let time_parts: Vec<u32> = parts[1]
        .split(':')
        .take(2)
        .filter_map(|s| s.parse().ok())
        .collect();

    if date_parts.len() < 3 || time_parts.len() < 2 {
        return None;
    }

    let (year, month, day) = (date_parts[0], date_parts[1], date_parts[2]);
    let (hour, minute) = (time_parts[0], time_parts[1]);

    // Compute days since epoch for the given date (ignoring timezone — treat as UTC)
    // This mirrors what the frontend stores (local time as ISO without tz offset).
    let days_since_epoch = days_from_civil(year as i64, month as i64, day as i64);
    let secs = days_since_epoch * 86400 + (hour as i64) * 3600 + (minute as i64) * 60;
    Some(secs * 1000)
}

/// Compute days since UNIX epoch (1970-01-01) for a given civil date.
/// Algorithm from http://howardhinnant.github.io/date_algorithms.html
fn days_from_civil(y: i64, m: i64, d: i64) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = y.div_euclid(400);
    let yoe = y - era * 400; // [0, 399]
    let doy = (153 * (if m > 2 { m - 3 } else { m + 9 }) + 2) / 5 + d - 1; // [0, 365]
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy; // [0, 146096]
    era * 146097 + doe - 719468
}

/// Recursively walk a TipTap JSON node and collect all taskItem nodes.
/// Returns (text, checked, due_date_unix_ms).
fn collect_task_items(node: &Value, items: &mut Vec<(String, bool, Option<i64>)>) {
    if let Some(node_type) = node.get("type").and_then(|t| t.as_str())
        && node_type == "taskItem"
    {
        let checked = node
            .get("attrs")
            .and_then(|a| a.get("checked"))
            .and_then(|c| c.as_bool())
            .unwrap_or(false);

        let due_date_ms = node
            .get("attrs")
            .and_then(|a| a.get("dueDate"))
            .and_then(|d| d.as_str())
            .and_then(iso_to_unix_ms);

        // Extract only the text from direct paragraph children (not nested taskLists)
        let text = extract_task_item_text(node);
        items.push((text, checked, due_date_ms));

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

/// Walk the ProseMirror JSON tree and stamp each `taskItem` node with the UUIDs from
/// `task_ids` (consumed in document order, same order as `collect_task_items`).
/// Returns the modified JSON value.
fn stamp_task_ids(node: Value, task_ids: &mut std::collections::VecDeque<String>) -> Value {
    match node {
        Value::Object(mut map) => {
            let node_type = map.get("type").and_then(|t| t.as_str()).map(str::to_owned);
            if node_type.as_deref() == Some("taskItem") {
                // Assign the next task_id
                if let Some(id) = task_ids.pop_front() {
                    let attrs = map.entry("attrs").or_insert_with(|| Value::Object(Default::default()));
                    if let Value::Object(attrs_map) = attrs {
                        attrs_map.insert("task_id".to_owned(), Value::String(id));
                    }
                }
                // Recurse into children (only non-paragraph to match collect_task_items order)
                if let Some(Value::Array(children)) = map.remove("content") {
                    let new_children: Vec<Value> = children
                        .into_iter()
                        .map(|child| {
                            let is_paragraph = child.get("type").and_then(|t| t.as_str()) == Some("paragraph");
                            if is_paragraph {
                                child // paragraphs don't contain nested taskItems
                            } else {
                                stamp_task_ids(child, task_ids)
                            }
                        })
                        .collect();
                    map.insert("content".to_owned(), Value::Array(new_children));
                }
            } else {
                // Recurse into all children
                if let Some(Value::Array(children)) = map.remove("content") {
                    let new_children: Vec<Value> = children
                        .into_iter()
                        .map(|child| stamp_task_ids(child, task_ids))
                        .collect();
                    map.insert("content".to_owned(), Value::Array(new_children));
                }
            }
            Value::Object(map)
        }
        other => other,
    }
}

/// Walk the ProseMirror JSON tree and flip `attrs.checked` on the Nth `taskItem`
/// (0-indexed ordinal). Fallback for nodes that don't have a `task_id` attr yet.
fn flip_task_checked_by_ordinal(
    node: Value,
    target_ordinal: usize,
    new_checked: bool,
    counter: &mut usize,
) -> (Value, bool) {
    match node {
        Value::Object(mut map) => {
            let node_type = map.get("type").and_then(|t| t.as_str()).map(str::to_owned);
            if node_type.as_deref() == Some("taskItem") {
                if *counter == target_ordinal {
                    let attrs = map
                        .entry("attrs")
                        .or_insert_with(|| Value::Object(Default::default()));
                    if let Value::Object(attrs_map) = attrs {
                        attrs_map.insert("checked".to_owned(), Value::Bool(new_checked));
                    }
                    *counter += 1;
                    return (Value::Object(map), true);
                }
                *counter += 1;
            }
            let mut found = false;
            if let Some(Value::Array(children)) = map.remove("content") {
                let mut new_children = Vec::with_capacity(children.len());
                for child in children {
                    if found {
                        new_children.push(child);
                    } else {
                        let (updated, did_find) =
                            flip_task_checked_by_ordinal(child, target_ordinal, new_checked, counter);
                        found = did_find;
                        new_children.push(updated);
                    }
                }
                map.insert("content".to_owned(), Value::Array(new_children));
            }
            (Value::Object(map), found)
        }
        other => (other, false),
    }
}

/// Walk the ProseMirror JSON tree and flip `attrs.checked` on the `taskItem` whose
/// `attrs.task_id` matches `target_task_id`. Returns the modified JSON and a bool
/// indicating whether the node was found.
fn flip_task_checked_in_json(node: Value, target_task_id: &str, new_checked: bool) -> (Value, bool) {
    match node {
        Value::Object(mut map) => {
            let node_type = map.get("type").and_then(|t| t.as_str()).map(str::to_owned);
            if node_type.as_deref() == Some("taskItem") {
                let existing_task_id = map
                    .get("attrs")
                    .and_then(|a| a.get("task_id"))
                    .and_then(|v| v.as_str())
                    .map(str::to_owned);
                if existing_task_id.as_deref() == Some(target_task_id) {
                    // Found it — flip checked
                    let attrs = map.entry("attrs").or_insert_with(|| Value::Object(Default::default()));
                    if let Value::Object(attrs_map) = attrs {
                        attrs_map.insert("checked".to_owned(), Value::Bool(new_checked));
                    }
                    return (Value::Object(map), true);
                }
            }
            // Recurse into children
            let mut found = false;
            if let Some(Value::Array(children)) = map.remove("content") {
                let mut new_children = Vec::with_capacity(children.len());
                for child in children {
                    if found {
                        new_children.push(child);
                    } else {
                        let (updated, did_find) = flip_task_checked_in_json(child, target_task_id, new_checked);
                        found = did_find;
                        new_children.push(updated);
                    }
                }
                map.insert("content".to_owned(), Value::Array(new_children));
            }
            (Value::Object(map), found)
        }
        other => (other, false),
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

/// Parse TipTap JSON and extract task items (content, checked, notify_at_ms).
fn parse_task_items(content: &str) -> Vec<(String, bool, Option<i64>)> {
    let Ok(json) = serde_json::from_str::<Value>(content) else {
        return Vec::new();
    };

    let mut items = Vec::new();
    collect_task_items(&json, &mut items);
    items
}

/// Sync tasks from TipTap JSON content to the note_tasks table.
/// Deletes all existing tasks for the note and re-inserts from current content.
/// The `dueDate` attribute from the TipTap node takes priority for `notify_at`.
/// If `dueDate` is absent from the TipTap node, preserves any existing `notify_at` by
/// matching on content text (best effort).
/// Also stamps each `taskItem` node in the note JSON with a stable `task_id` attribute
/// and writes the updated JSON back to `notes.content`.
pub fn sync_tasks(conn: &Connection, note_id: &str, content: &str) -> AppResult<()> {
    let parsed_items = parse_task_items(content);

    // Load existing tasks to preserve notify_at values when no dueDate is in TipTap JSON
    let existing = get_tasks_for_note(conn, note_id)?;
    let existing_notify_map: std::collections::HashMap<String, Option<i64>> = existing
        .into_iter()
        .map(|t| (t.content, t.notify_at))
        .collect();

    let now = now_ms();

    // Assign stable UUIDs for all task items
    let task_ids: Vec<String> = parsed_items
        .iter()
        .map(|_| Uuid::now_v7().to_string())
        .collect();

    // Stamp task_id attributes into the content JSON
    let stamped_content = match serde_json::from_str::<Value>(content) {
        Ok(json) => {
            let mut ids_queue: std::collections::VecDeque<String> =
                task_ids.iter().cloned().collect();
            let stamped = stamp_task_ids(json, &mut ids_queue);
            match serde_json::to_string(&stamped) {
                Ok(s) => s,
                Err(_) => content.to_owned(),
            }
        }
        Err(_) => content.to_owned(),
    };

    let tx = conn.unchecked_transaction()?;

    // Delete all existing tasks for this note
    tx.execute("DELETE FROM note_tasks WHERE note_id = ?1", [note_id])?;

    // Insert new tasks from content, using the pre-assigned task_ids
    for ((text, checked, due_date_ms), id) in parsed_items.into_iter().zip(task_ids.iter()) {
        // If TipTap provided a dueDate attribute, use it; otherwise fall back to the DB value
        let notify_at = if due_date_ms.is_some() {
            due_date_ms
        } else {
            existing_notify_map.get(&text).copied().flatten()
        };
        tx.execute(
            "INSERT INTO note_tasks (id, note_id, content, is_checked, notify_at, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![id, note_id, text, checked as i64, notify_at, now, now],
        )?;
    }

    // Write the stamped content (with task_id attrs) back to notes.content
    tx.execute(
        "UPDATE notes SET content = ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params![stamped_content, now, note_id],
    )?;

    tx.commit()?;
    Ok(())
}

/// Get all tasks for a given note, ordered by creation time.
pub fn get_tasks_for_note(conn: &Connection, note_id: &str) -> AppResult<Vec<NoteTask>> {
    let mut stmt = conn.prepare(
        "SELECT id, note_id, content, is_checked, notify_at, notified_at, created_at, updated_at
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
                notified_at: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(AppError::Database)?;

    Ok(tasks)
}

/// Update the `is_checked` status of a single task and flip the corresponding
/// `taskItem` node's `checked` attribute in the owning note's ProseMirror JSON.
/// All changes happen in a single SQLite transaction.
/// Returns the note_id of the affected note.
pub fn update_task_checked(
    conn: &Connection,
    task_id: &str,
    is_checked: bool,
) -> AppResult<UpdateTaskCheckedResult> {
    let now = now_ms();

    // Look up the task to get its note_id and ordinal position (0-indexed)
    let (note_id, ordinal) = conn
        .query_row(
            "SELECT note_id,
                    (SELECT COUNT(*) FROM note_tasks
                     WHERE note_id = t.note_id AND created_at < t.created_at)
             FROM note_tasks t WHERE t.id = ?1",
            [task_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, usize>(1)?)),
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(format!("task {task_id}")),
            other => AppError::Database(other),
        })?;

    // Load note content
    let note_content: Option<String> = conn
        .query_row(
            "SELECT content FROM notes WHERE id = ?1",
            [&note_id],
            |row| row.get(0),
        )
        .map_err(AppError::Database)?;

    // Flip checked in ProseMirror JSON: try task_id attr first, fall back to ordinal
    let new_content = note_content.as_deref().and_then(|content| {
        let json = serde_json::from_str::<Value>(content).ok()?;
        let (updated, found) = flip_task_checked_in_json(json.clone(), task_id, is_checked);
        if found {
            serde_json::to_string(&updated).ok()
        } else {
            let mut counter = 0usize;
            let (updated, found) =
                flip_task_checked_by_ordinal(json, ordinal, is_checked, &mut counter);
            if found { serde_json::to_string(&updated).ok() } else { None }
        }
    });

    let tx = conn.unchecked_transaction()?;

    // Update note_tasks
    let rows = tx.execute(
        "UPDATE note_tasks SET is_checked = ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params![is_checked as i64, now, task_id],
    )?;
    if rows == 0 {
        return Err(AppError::NotFound(format!("task {task_id}")));
    }

    // Update notes.content if we successfully patched the JSON
    if let Some(content) = new_content {
        tx.execute(
            "UPDATE notes SET content = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![content, now, note_id],
        )?;
    }

    tx.commit()?;

    Ok(UpdateTaskCheckedResult { note_id })
}

/// Create a task in the special inbox note (title `__rnotes_inbox__`).
/// Creates the inbox note if it does not exist.
/// Appends a new taskItem to the note's TipTap JSON, calls `sync_tasks`,
/// then updates `notify_at` on the resulting task row.
/// Returns the new `NoteTask`.
pub fn create_inbox_task(
    conn: &Connection,
    content: String,
    notify_at: Option<i64>,
) -> AppResult<NoteTask> {
    const INBOX_TITLE: &str = "__rnotes_inbox__";

    // 1. Find or create the inbox note.
    let inbox_note_id: String = match conn.query_row(
        "SELECT id FROM notes WHERE title = ?1 AND deleted_at IS NULL",
        [INBOX_TITLE],
        |row| row.get::<_, String>(0),
    ) {
        Ok(id) => id,
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            let req = note_service::CreateNoteRequest {
                parent_id: None,
                title: INBOX_TITLE.to_string(),
                is_folder: false,
            };
            note_service::create_note(conn, req)?.id
        }
        Err(e) => return Err(AppError::Database(e)),
    };

    // 2. Load current content and build updated TipTap JSON with new taskItem appended.
    let raw_content: String = conn
        .query_row(
            "SELECT content FROM notes WHERE id = ?1",
            [&inbox_note_id],
            |row| row.get::<_, Option<String>>(0),
        )
        .map_err(AppError::Database)?
        .unwrap_or_default();

    let new_task_item = json!({
        "type": "taskItem",
        "attrs": { "checked": false },
        "content": [
            {
                "type": "paragraph",
                "content": [
                    { "type": "text", "text": content }
                ]
            }
        ]
    });

    let updated_content: Value = match serde_json::from_str::<Value>(&raw_content) {
        Ok(mut doc) if doc.get("type").and_then(|t| t.as_str()) == Some("doc") => {
            // Valid TipTap doc — find or create a top-level taskList.
            if let Some(doc_content) = doc.get_mut("content").and_then(|c| c.as_array_mut()) {
                // Look for a taskList node at the top level.
                let maybe_idx = doc_content
                    .iter()
                    .position(|n| n.get("type").and_then(|t| t.as_str()) == Some("taskList"));
                if let Some(idx) = maybe_idx {
                    // Append to existing taskList.
                    if let Some(task_list_content) = doc_content[idx]
                        .get_mut("content")
                        .and_then(|c| c.as_array_mut())
                    {
                        task_list_content.push(new_task_item);
                    }
                } else {
                    // No taskList — append a new one.
                    doc_content.push(json!({
                        "type": "taskList",
                        "content": [new_task_item]
                    }));
                }
                doc
            } else {
                // No content array in doc — build fresh.
                json!({
                    "type": "doc",
                    "content": [{ "type": "taskList", "content": [new_task_item] }]
                })
            }
        }
        _ => {
            // Not a valid TipTap doc (e.g. `{}`) — build from scratch.
            json!({
                "type": "doc",
                "content": [{ "type": "taskList", "content": [new_task_item] }]
            })
        }
    };

    let updated_content_str = serde_json::to_string(&updated_content)
        .map_err(|e| AppError::Config(format!("JSON serialization error: {e}")))?;

    // 3. Persist the new content and sync tasks (note_service::update_note also calls sync_tasks).
    note_service::update_note(conn, &inbox_note_id, INBOX_TITLE, &updated_content_str, "")?;

    // 4. After sync_tasks the new task row has been inserted. Since the new task was appended
    //    last, it will be the last row by created_at (all tasks for this sync share the same
    //    timestamp, but our task is the final item in document order and thus the last inserted).
    //    We match by content string — if multiple tasks share the same text, take the last one.
    let tasks = get_tasks_for_note(conn, &inbox_note_id)?;
    let task = tasks
        .into_iter()
        .filter(|t| t.content == content)
        .last()
        .ok_or_else(|| AppError::Config(format!("inbox task '{content}' not found after sync")))?;

    // 5. Set notify_at if provided.
    if notify_at.is_some() {
        let now = now_ms();
        conn.execute(
            "UPDATE note_tasks SET notify_at = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![notify_at, now, task.id],
        )
        .map_err(AppError::Database)?;
        return Ok(NoteTask {
            notify_at,
            updated_at: now,
            ..task
        });
    }

    Ok(task)
}

/// Get all tasks across all notes (for future task overview).
/// Includes note title, filters out tasks from deleted notes.
pub fn get_all_tasks(conn: &Connection) -> AppResult<Vec<NoteTaskWithNote>> {
    let mut stmt = conn.prepare(
        "SELECT t.id, t.note_id, n.title, t.content, t.is_checked, t.notify_at, t.notified_at, t.created_at, t.updated_at
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
                notified_at: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
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

    const TIPTAP_JSON_WITH_DUE_DATE: &str = r#"{
        "type": "doc",
        "content": [
            {
                "type": "taskList",
                "content": [
                    {
                        "type": "taskItem",
                        "attrs": { "checked": false, "dueDate": "2026-03-25T14:30" },
                        "content": [
                            {
                                "type": "paragraph",
                                "content": [
                                    { "type": "text", "text": "Task with due date" }
                                ]
                            }
                        ]
                    },
                    {
                        "type": "taskItem",
                        "attrs": { "checked": false },
                        "content": [
                            {
                                "type": "paragraph",
                                "content": [
                                    { "type": "text", "text": "Task without due date" }
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
        assert!(items[0].2.is_none());
        assert_eq!(items[1].0, "Read book");
        assert!(items[1].1);
        assert!(items[1].2.is_none());
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
    fn test_parse_task_items_extracts_due_date() {
        let items = parse_task_items(TIPTAP_JSON_WITH_DUE_DATE);
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].0, "Task with due date");
        // 2026-03-25T14:30 UTC = verify we get a non-null notify_at
        assert!(items[0].2.is_some());
        let ms = items[0].2.unwrap();
        // 2026-03-25T14:30:00Z in ms since epoch
        // = (days_since_epoch * 86400 + 14*3600 + 30*60) * 1000
        // Let's just verify it's a plausible future timestamp (> 2026-01-01)
        let year_2026_ms = 1_735_689_600_000_i64; // 2025-01-01T00:00:00Z
        assert!(ms > year_2026_ms);
        // Task without due date should have None
        assert!(items[1].2.is_none());
    }

    #[test]
    fn test_iso_to_unix_ms_known_value() {
        // 2026-03-25T14:30 UTC
        // Days from epoch to 2026-03-25:
        // We'll just check it parses and is reasonable
        let ms = iso_to_unix_ms("2026-03-25T14:30");
        assert!(ms.is_some());
        let ms = ms.unwrap();
        // Must be > 2026-01-01 (1735689600000)
        assert!(ms > 1_735_689_600_000);
    }

    #[test]
    fn test_iso_to_unix_ms_invalid() {
        assert!(iso_to_unix_ms("not-a-date").is_none());
        assert!(iso_to_unix_ms("2026-03-25").is_none()); // missing time part
    }

    #[test]
    fn test_sync_tasks_stores_due_date() {
        let conn = test_connection();
        let note_id = create_test_note(&conn);

        sync_tasks(&conn, &note_id, TIPTAP_JSON_WITH_DUE_DATE).unwrap();

        let tasks = get_tasks_for_note(&conn, &note_id).unwrap();
        assert_eq!(tasks.len(), 2);
        assert_eq!(tasks[0].content, "Task with due date");
        assert!(tasks[0].notify_at.is_some());
        assert_eq!(tasks[1].content, "Task without due date");
        assert!(tasks[1].notify_at.is_none());
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
        )
        .unwrap();

        // Re-sync — notify_at should be preserved for "Buy groceries"
        sync_tasks(&conn, &note_id, TIPTAP_JSON_WITH_TASKS).unwrap();
        let updated = get_tasks_for_note(&conn, &note_id).unwrap();
        let grocery_task = updated
            .iter()
            .find(|t| t.content == "Buy groceries")
            .unwrap();
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
        )
        .unwrap();

        let all_tasks = get_all_tasks(&conn).unwrap();
        assert!(all_tasks.is_empty());
    }

    #[test]
    fn test_update_task_checked_toggles_status() {
        let conn = test_connection();
        let note_id = create_test_note(&conn);

        sync_tasks(&conn, &note_id, TIPTAP_JSON_WITH_TASKS).unwrap();

        let tasks = get_tasks_for_note(&conn, &note_id).unwrap();
        let task_id = &tasks[0].id;
        assert!(!tasks[0].is_checked);

        update_task_checked(&conn, task_id, true).unwrap();

        let updated = get_tasks_for_note(&conn, &note_id).unwrap();
        let task = updated.iter().find(|t| t.id == *task_id).unwrap();
        assert!(task.is_checked);
    }

    #[test]
    fn test_update_task_checked_not_found() {
        let conn = test_connection();
        let result = update_task_checked(&conn, "nonexistent-id", true);
        assert!(result.is_err());
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

    /// Helper: read the raw `content` column of a note directly from DB.
    fn get_note_content(conn: &Connection, note_id: &str) -> String {
        conn.query_row(
            "SELECT content FROM notes WHERE id = ?1",
            [note_id],
            |row| row.get::<_, Option<String>>(0),
        )
        .unwrap()
        .unwrap_or_default()
    }

    #[test]
    fn test_update_task_checked_also_flips_taskitem_in_note_content() {
        let conn = test_connection();
        let note_id = create_test_note(&conn);

        // Write the content with tasks and let sync_tasks stamp task_id attrs
        note_service::update_note(&conn, &note_id, "Test Note", TIPTAP_JSON_WITH_TASKS, "").unwrap();

        // Fetch the task id for "Buy groceries" (was unchecked)
        let tasks = get_tasks_for_note(&conn, &note_id).unwrap();
        let grocery_task = tasks.iter().find(|t| t.content == "Buy groceries").unwrap();
        let task_id = grocery_task.id.clone();
        assert!(!grocery_task.is_checked);

        // Flip via update_task_checked
        let result = update_task_checked(&conn, &task_id, true).unwrap();
        assert_eq!(result.note_id, note_id);

        // Re-parse notes.content and verify the taskItem with the matching task_id is now checked
        let raw_content = get_note_content(&conn, &note_id);
        let json: Value = serde_json::from_str(&raw_content).unwrap();
        let mut found = false;
        let mut checked_in_json = false;
        fn find_task(node: &Value, task_id: &str, found: &mut bool, checked: &mut bool) {
            if node.get("type").and_then(|t| t.as_str()) == Some("taskItem") {
                if node
                    .get("attrs")
                    .and_then(|a| a.get("task_id"))
                    .and_then(|v| v.as_str())
                    == Some(task_id)
                {
                    *found = true;
                    *checked = node
                        .get("attrs")
                        .and_then(|a| a.get("checked"))
                        .and_then(|c| c.as_bool())
                        .unwrap_or(false);
                    return;
                }
            }
            if let Some(children) = node.get("content").and_then(|c| c.as_array()) {
                for child in children {
                    find_task(child, task_id, found, checked);
                }
            }
        }
        find_task(&json, &task_id, &mut found, &mut checked_in_json);
        assert!(found, "taskItem with task_id {task_id} not found in note content");
        assert!(checked_in_json, "taskItem checked attr should be true after update_task_checked");
    }

    #[test]
    fn test_toggle_in_note_content_syncs_to_note_tasks() {
        let conn = test_connection();
        let note_id = create_test_note(&conn);

        // Write initial content with one unchecked task
        note_service::update_note(&conn, &note_id, "Test Note", TIPTAP_JSON_WITH_TASKS, "").unwrap();

        // Verify initial state
        let tasks = get_tasks_for_note(&conn, &note_id).unwrap();
        let grocery_task = tasks.iter().find(|t| t.content == "Buy groceries").unwrap();
        assert!(!grocery_task.is_checked);

        // Simulate the editor toggling the checkbox: update note with the task now checked
        let checked_content = TIPTAP_JSON_WITH_TASKS.replace(
            r#""checked": false"#,
            r#""checked": true"#,
        );
        note_service::update_note(&conn, &note_id, "Test Note", &checked_content, "").unwrap();

        // Verify note_tasks.is_checked was synced
        let updated_tasks = get_tasks_for_note(&conn, &note_id).unwrap();
        let grocery_task_updated = updated_tasks
            .iter()
            .find(|t| t.content == "Buy groceries")
            .unwrap();
        assert!(
            grocery_task_updated.is_checked,
            "note_tasks.is_checked should be true after editor toggles task in content"
        );
    }
}
