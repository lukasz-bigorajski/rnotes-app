use rusqlite::Connection;
use serde::Deserialize;
use uuid::Uuid;

use crate::db::{fts, notes};
use crate::db::notes::{Note, NoteRow};
use crate::error::AppResult;

fn now_ms() -> i64 {
    let dur = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap();
    (dur.as_secs() as i64) * 1000 + (dur.subsec_millis() as i64)
}

#[derive(Debug, Deserialize)]
pub struct CreateNoteRequest {
    pub parent_id: Option<String>,
    pub title: String,
    pub is_folder: bool,
}

pub fn create_note(conn: &Connection, req: CreateNoteRequest) -> AppResult<Note> {
    let now = now_ms();
    let id = Uuid::now_v7().to_string();
    let sort_order = notes::max_sort_order(conn, req.parent_id.as_deref())? + 1.0;

    let note = Note {
        id,
        parent_id: req.parent_id,
        title: req.title.clone(),
        content: if req.is_folder { None } else { Some("{}".to_string()) },
        sort_order,
        is_folder: req.is_folder,
        deleted_at: None,
        created_at: now,
        updated_at: now,
    };

    let tx = conn.unchecked_transaction()?;
    notes::insert(&tx, &note)?;
    if !req.is_folder {
        fts::upsert(&tx, &note.id, &req.title, "")?;
    }
    tx.commit()?;

    Ok(note)
}

pub fn get_note(conn: &Connection, id: &str) -> AppResult<Note> {
    notes::get_by_id(conn, id)
}

pub fn list_notes(conn: &Connection, include_deleted: bool) -> AppResult<Vec<NoteRow>> {
    notes::list_metadata(conn, include_deleted)
}

pub fn update_note(
    conn: &Connection,
    id: &str,
    title: &str,
    content: &str,
    plain_text: &str,
) -> AppResult<()> {
    let now = now_ms();
    let tx = conn.unchecked_transaction()?;
    notes::update(&tx, id, title, content, now)?;
    fts::upsert(&tx, id, title, plain_text)?;
    tx.commit()?;
    Ok(())
}

pub fn delete_note(conn: &Connection, id: &str) -> AppResult<()> {
    let now = now_ms();
    let tx = conn.unchecked_transaction()?;
    notes::soft_delete(&tx, id, now)?;
    fts::remove(&tx, id)?;
    tx.commit()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_helpers::test_connection;
    use crate::error::AppError;

    fn create_req(title: &str, is_folder: bool) -> CreateNoteRequest {
        CreateNoteRequest {
            parent_id: None,
            title: title.to_string(),
            is_folder,
        }
    }

    #[test]
    fn test_create_note_assigns_uuid_and_timestamps() {
        let conn = test_connection();
        let note = create_note(&conn, create_req("Hello", false)).unwrap();

        assert!(uuid::Uuid::parse_str(&note.id).is_ok());
        assert!(note.created_at > 0);
        assert!(note.updated_at > 0);
        assert_eq!(note.title, "Hello");
    }

    #[test]
    fn test_create_folder_has_no_content() {
        let conn = test_connection();
        let note = create_note(&conn, create_req("Folder", true)).unwrap();

        assert!(note.is_folder);
        assert!(note.content.is_none());
    }

    #[test]
    fn test_update_note_changes_content() {
        let conn = test_connection();
        let note = create_note(&conn, create_req("Original", false)).unwrap();

        update_note(&conn, &note.id, "New Title", "New Content", "plain").unwrap();

        let fetched = get_note(&conn, &note.id).unwrap();
        assert_eq!(fetched.title, "New Title");
        assert_eq!(fetched.content, Some("New Content".to_string()));
    }

    #[test]
    fn test_delete_note_soft_deletes() {
        let conn = test_connection();
        let note = create_note(&conn, create_req("To Delete", false)).unwrap();

        delete_note(&conn, &note.id).unwrap();

        let result = get_note(&conn, &note.id);
        assert!(result.is_err());
        match result.unwrap_err() {
            AppError::NotFound(_) => {}
            other => panic!("Expected NotFound, got: {:?}", other),
        }
    }

    #[test]
    fn test_sort_order_increments() {
        let conn = test_connection();
        let n1 = create_note(&conn, create_req("First", false)).unwrap();
        let n2 = create_note(&conn, create_req("Second", false)).unwrap();
        let n3 = create_note(&conn, create_req("Third", false)).unwrap();

        assert_eq!(n1.sort_order, 1.0);
        assert_eq!(n2.sort_order, 2.0);
        assert_eq!(n3.sort_order, 3.0);
    }
}
