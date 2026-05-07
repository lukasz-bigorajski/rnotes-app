use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use uuid::Uuid;

use crate::db::{fts, notes};
use crate::db::notes::Note;
use crate::error::{AppError, AppResult};

fn now_ms() -> i64 {
    let dur = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap();
    (dur.as_secs() as i64) * 1000 + (dur.subsec_millis() as i64)
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct SpreadsheetContent {
    pub rows: usize,
    pub cols: usize,
    pub cells: HashMap<String, String>,
    pub pivots: Vec<Value>,
    pub macros: Vec<Value>,
}

pub fn create_spreadsheet_note(
    conn: &Connection,
    parent_id: Option<String>,
    title: String,
) -> AppResult<Note> {
    let now = now_ms();
    let id = Uuid::now_v7().to_string();
    let sort_order = notes::max_sort_order(conn, parent_id.as_deref())? + 1.0;

    let content = SpreadsheetContent {
        rows: 20,
        cols: 10,
        cells: HashMap::new(),
        pivots: Vec::new(),
        macros: Vec::new(),
    };
    let content_json = serde_json::to_string(&content).map_err(AppError::Json)?;

    let note = Note {
        id,
        parent_id,
        title: title.clone(),
        content: Some(content_json),
        sort_order,
        is_folder: false,
        note_type: "spreadsheet".to_string(),
        deleted_at: None,
        created_at: now,
        updated_at: now,
    };

    let tx = conn.unchecked_transaction()?;
    notes::insert(&tx, &note)?;
    fts::upsert(&tx, &note.id, &title, "")?;
    tx.commit()?;

    Ok(note)
}

pub fn update_spreadsheet(
    conn: &Connection,
    note_id: &str,
    content_json: &str,
    plain_text: &str,
) -> AppResult<()> {
    let note = notes::get_by_id(conn, note_id)?;
    if note.note_type != "spreadsheet" {
        return Err(AppError::InvalidState(format!(
            "note {note_id} is not a spreadsheet"
        )));
    }

    let now = now_ms();
    let tx = conn.unchecked_transaction()?;
    notes::update(&tx, note_id, &note.title, content_json, now)?;
    fts::upsert(&tx, note_id, &note.title, plain_text)?;
    tx.commit()?;

    Ok(())
}

pub fn update_spreadsheet_cell(
    conn: &Connection,
    note_id: &str,
    row: usize,
    col: usize,
    value: &str,
) -> AppResult<()> {
    let note = notes::get_by_id(conn, note_id)?;
    if note.note_type != "spreadsheet" {
        return Err(AppError::InvalidState(format!(
            "note {note_id} is not a spreadsheet"
        )));
    }

    let content_str = note.content.unwrap_or_default();
    let mut content: SpreadsheetContent =
        serde_json::from_str(&content_str).map_err(AppError::Json)?;

    let key = format!("{row}:{col}");
    if value.is_empty() {
        content.cells.remove(&key);
    } else {
        content.cells.insert(key, value.to_string());
    }

    let plain_text: String = content.cells.values().cloned().collect::<Vec<_>>().join(" ");
    let new_content_json = serde_json::to_string(&content).map_err(AppError::Json)?;

    let now = now_ms();
    let tx = conn.unchecked_transaction()?;
    notes::update(&tx, note_id, &note.title, &new_content_json, now)?;
    fts::upsert(&tx, note_id, &note.title, &plain_text)?;
    tx.commit()?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_helpers::test_connection;
    use crate::error::AppError;

    fn make_spreadsheet(conn: &rusqlite::Connection, title: &str) -> Note {
        create_spreadsheet_note(conn, None, title.to_string()).unwrap()
    }

    #[test]
    fn test_create_spreadsheet_note_round_trip() {
        let conn = test_connection();
        let note = make_spreadsheet(&conn, "My Sheet");

        assert_eq!(note.note_type, "spreadsheet");
        assert_eq!(note.title, "My Sheet");
        assert!(!note.is_folder);
        assert!(note.deleted_at.is_none());

        let fetched = notes::get_by_id(&conn, &note.id).unwrap();
        assert_eq!(fetched.note_type, "spreadsheet");

        let content: SpreadsheetContent =
            serde_json::from_str(&fetched.content.unwrap()).unwrap();
        assert_eq!(content.rows, 20);
        assert_eq!(content.cols, 10);
        assert!(content.cells.is_empty());
    }

    #[test]
    fn test_update_spreadsheet_changes_content() {
        let conn = test_connection();
        let note = make_spreadsheet(&conn, "Test Sheet");

        let mut cells = HashMap::new();
        cells.insert("0:0".to_string(), "Hello".to_string());
        cells.insert("0:1".to_string(), "=A1".to_string());
        let new_content = SpreadsheetContent {
            rows: 20,
            cols: 10,
            cells,
            pivots: Vec::new(),
            macros: Vec::new(),
        };
        let json = serde_json::to_string(&new_content).unwrap();

        update_spreadsheet(&conn, &note.id, &json, "Hello").unwrap();

        let fetched = notes::get_by_id(&conn, &note.id).unwrap();
        let content: SpreadsheetContent =
            serde_json::from_str(&fetched.content.unwrap()).unwrap();
        assert_eq!(content.cells.get("0:0"), Some(&"Hello".to_string()));
        assert_eq!(content.cells.get("0:1"), Some(&"=A1".to_string()));
    }

    #[test]
    fn test_update_spreadsheet_cell_sets_value() {
        let conn = test_connection();
        let note = make_spreadsheet(&conn, "Cell Sheet");

        update_spreadsheet_cell(&conn, &note.id, 1, 2, "42").unwrap();

        let fetched = notes::get_by_id(&conn, &note.id).unwrap();
        let content: SpreadsheetContent =
            serde_json::from_str(&fetched.content.unwrap()).unwrap();
        assert_eq!(content.cells.get("1:2"), Some(&"42".to_string()));
    }

    #[test]
    fn test_update_spreadsheet_cell_removes_empty() {
        let conn = test_connection();
        let note = make_spreadsheet(&conn, "Empty Cell Sheet");

        update_spreadsheet_cell(&conn, &note.id, 0, 0, "value").unwrap();
        update_spreadsheet_cell(&conn, &note.id, 0, 0, "").unwrap();

        let fetched = notes::get_by_id(&conn, &note.id).unwrap();
        let content: SpreadsheetContent =
            serde_json::from_str(&fetched.content.unwrap()).unwrap();
        assert!(!content.cells.contains_key("0:0"));
    }

    #[test]
    fn test_soft_delete_hides_spreadsheet() {
        let conn = test_connection();
        let note = make_spreadsheet(&conn, "To Delete");

        crate::services::note_service::delete_note(&conn, &note.id).unwrap();

        let result = notes::get_by_id(&conn, &note.id);
        assert!(result.is_err());
        match result.unwrap_err() {
            AppError::NotFound(_) => {}
            other => panic!("Expected NotFound, got: {other:?}"),
        }
    }

    #[test]
    fn test_update_spreadsheet_rejects_richtext_note() {
        let conn = test_connection();
        let note = crate::services::note_service::create_note(
            &conn,
            crate::services::note_service::CreateNoteRequest {
                parent_id: None,
                title: "Rich Text".to_string(),
                is_folder: false,
            },
        )
        .unwrap();

        let result = update_spreadsheet(&conn, &note.id, "{}", "");
        assert!(result.is_err());
        match result.unwrap_err() {
            AppError::InvalidState(msg) => assert!(msg.contains("not a spreadsheet")),
            other => panic!("Expected InvalidState, got: {other:?}"),
        }
    }
}
