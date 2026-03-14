use rusqlite::Connection;
use serde::Deserialize;
use uuid::Uuid;

use crate::db::{fts, notes};
use crate::db::notes::{Note, NoteRow};
use crate::error::{AppError, AppResult};

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

pub fn rename_note(conn: &Connection, id: &str, title: &str) -> AppResult<()> {
    let now = now_ms();
    let tx = conn.unchecked_transaction()?;
    notes::rename(&tx, id, title, now)?;

    // If the note has an FTS entry, update it with the new title while preserving the body
    if let Some(body) = fts::get_body(&tx, id)? {
        fts::upsert(&tx, id, title, &body)?;
    }

    tx.commit()?;
    Ok(())
}

pub fn delete_note_tree(conn: &Connection, id: &str) -> AppResult<()> {
    let now = now_ms();
    let tx = conn.unchecked_transaction()?;
    let deleted_ids = notes::soft_delete_tree(&tx, id, now)?;

    // Remove all deleted notes from FTS index
    for deleted_id in deleted_ids {
        fts::remove(&tx, &deleted_id)?;
    }

    tx.commit()?;
    Ok(())
}

pub fn move_note(
    conn: &Connection,
    id: &str,
    new_parent_id: Option<&str>,
    new_sort_order: f64,
) -> AppResult<()> {
    // Check that the note exists and is not deleted
    let _note = notes::get_by_id(conn, id)?;

    // Prevent circular references: walk up the parent chain from new_parent_id
    if let Some(new_parent) = new_parent_id {
        let mut current_id = new_parent.to_string();
        loop {
            if current_id == id {
                return Err(AppError::Config(
                    "Cannot move note into its own subtree (circular reference)".into(),
                ));
            }
            match notes::get_by_id(conn, &current_id) {
                Ok(parent_note) => {
                    if let Some(parent_of_parent) = parent_note.parent_id {
                        current_id = parent_of_parent;
                    } else {
                        break;
                    }
                }
                Err(AppError::NotFound(_)) => break,
                Err(e) => return Err(e),
            }
        }

        // Validate that new_parent_id is a folder
        let parent_note = notes::get_by_id(conn, new_parent)?;
        if !parent_note.is_folder {
            return Err(AppError::Config(format!(
                "Cannot move note under non-folder '{}'",
                parent_note.id
            )));
        }
    }

    let now = now_ms();
    notes::move_note(conn, id, new_parent_id, new_sort_order, now)?;
    Ok(())
}

pub fn restore_note(conn: &Connection, id: &str) -> AppResult<()> {
    let now = now_ms();
    let tx = conn.unchecked_transaction()?;

    // Fetch the note including deleted ones
    let note = notes::get_by_id_including_deleted(&tx, id)?;

    // Check if the note is actually deleted
    if note.deleted_at.is_none() {
        return Err(AppError::Config(format!("note {id} is not deleted")));
    }

    // Determine the new parent_id:
    // If the original parent exists and is not deleted, keep it; else restore to root (NULL)
    let corrected_parent_id = match note.parent_id {
        Some(parent_id) => {
            match notes::get_by_id(&tx, &parent_id) {
                Ok(_) => Some(parent_id),
                Err(AppError::NotFound(_)) => None,
                Err(e) => return Err(e),
            }
        }
        None => None,
    };

    // Calculate new sort_order: max_sort_order of the final parent + 1.0
    let new_sort_order = notes::max_sort_order(&tx, corrected_parent_id.as_deref())? + 1.0;

    // Restore the note
    notes::restore(&tx, id, corrected_parent_id.as_deref(), new_sort_order, now)?;

    // Re-index in FTS (only for non-folders)
    if !note.is_folder {
        let plain_text = ""; // Empty body for restored note
        fts::upsert(&tx, id, &note.title, plain_text)?;
    }

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
    fn test_create_note_has_empty_content() {
        let conn = test_connection();
        let note = create_note(&conn, create_req("Note", false)).unwrap();

        assert!(!note.is_folder);
        assert_eq!(note.content, Some("{}".to_string()));
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

    #[test]
    fn test_move_note_changes_parent() {
        let conn = test_connection();
        let folder = create_note(&conn, CreateNoteRequest {
            parent_id: None,
            title: "Folder".to_string(),
            is_folder: true,
        }).unwrap();

        let note = create_note(&conn, CreateNoteRequest {
            parent_id: None,
            title: "Note".to_string(),
            is_folder: false,
        }).unwrap();

        // Move note into folder
        move_note(&conn, &note.id, Some(&folder.id), 1.5).unwrap();

        let updated = get_note(&conn, &note.id).unwrap();
        assert_eq!(updated.parent_id, Some(folder.id));
        assert_eq!(updated.sort_order, 1.5);
    }

    #[test]
    fn test_move_note_prevents_circular_reference() {
        let conn = test_connection();
        let parent_folder = create_note(&conn, CreateNoteRequest {
            parent_id: None,
            title: "Parent".to_string(),
            is_folder: true,
        }).unwrap();

        let child_folder = create_note(&conn, CreateNoteRequest {
            parent_id: Some(parent_folder.id.clone()),
            title: "Child".to_string(),
            is_folder: true,
        }).unwrap();

        // Try to move parent into child — should fail
        let result = move_note(&conn, &parent_folder.id, Some(&child_folder.id), 1.0);
        assert!(result.is_err());
    }

    #[test]
    fn test_move_note_validates_parent_is_folder() {
        let conn = test_connection();
        let note1 = create_note(&conn, create_req("Note1", false)).unwrap();
        let note2 = create_note(&conn, create_req("Note2", false)).unwrap();

        // Try to move note1 under note2 (non-folder) — should fail
        let result = move_note(&conn, &note1.id, Some(&note2.id), 1.0);
        assert!(result.is_err());
    }

    #[test]
    fn test_restore_note_to_root() {
        let conn = test_connection();
        let note = create_note(&conn, create_req("To Delete", false)).unwrap();
        let note_id = note.id.clone();

        // Delete the note
        delete_note(&conn, &note_id).unwrap();

        // Verify it's gone from active notes
        let result = get_note(&conn, &note_id);
        assert!(result.is_err());

        // Restore it
        restore_note(&conn, &note_id).unwrap();

        // Verify it's back and active
        let restored = get_note(&conn, &note_id).unwrap();
        assert_eq!(restored.id, note_id);
        assert_eq!(restored.deleted_at, None);
        assert_eq!(restored.parent_id, None);
    }

    #[test]
    fn test_restore_note_preserves_parent() {
        let conn = test_connection();
        let folder = create_note(&conn, CreateNoteRequest {
            parent_id: None,
            title: "Folder".to_string(),
            is_folder: true,
        }).unwrap();

        let note = create_note(&conn, CreateNoteRequest {
            parent_id: Some(folder.id.clone()),
            title: "Child Note".to_string(),
            is_folder: false,
        }).unwrap();

        // Delete the note
        delete_note(&conn, &note.id).unwrap();

        // Restore it
        restore_note(&conn, &note.id).unwrap();

        // Verify parent is preserved
        let restored = get_note(&conn, &note.id).unwrap();
        assert_eq!(restored.parent_id, Some(folder.id));
        assert_eq!(restored.deleted_at, None);
    }

    #[test]
    fn test_restore_note_orphaned_goes_to_root() {
        let conn = test_connection();
        let folder = create_note(&conn, CreateNoteRequest {
            parent_id: None,
            title: "Folder".to_string(),
            is_folder: true,
        }).unwrap();

        let note = create_note(&conn, CreateNoteRequest {
            parent_id: Some(folder.id.clone()),
            title: "Child Note".to_string(),
            is_folder: false,
        }).unwrap();

        // Delete both folder and note
        delete_note_tree(&conn, &folder.id).unwrap();

        // Restore the note (parent is gone)
        restore_note(&conn, &note.id).unwrap();

        // Verify it's restored to root
        let restored = get_note(&conn, &note.id).unwrap();
        assert_eq!(restored.parent_id, None);
        assert_eq!(restored.deleted_at, None);
    }
}
