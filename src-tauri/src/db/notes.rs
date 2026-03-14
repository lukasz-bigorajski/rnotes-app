use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Note {
    pub id: String,
    pub parent_id: Option<String>,
    pub title: String,
    pub content: Option<String>,
    pub sort_order: f64,
    pub is_folder: bool,
    pub deleted_at: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NoteRow {
    pub id: String,
    pub parent_id: Option<String>,
    pub title: String,
    pub sort_order: f64,
    pub is_folder: bool,
    pub deleted_at: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
}

pub fn insert(conn: &Connection, note: &Note) -> AppResult<()> {
    conn.execute(
        "INSERT INTO notes (id, parent_id, title, content, sort_order, is_folder, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            note.id,
            note.parent_id,
            note.title,
            note.content,
            note.sort_order,
            note.is_folder,
            note.created_at,
            note.updated_at
        ],
    )?;
    Ok(())
}

pub fn get_by_id(conn: &Connection, id: &str) -> AppResult<Note> {
    conn.query_row(
        "SELECT id, parent_id, title, content, sort_order, is_folder, deleted_at, created_at, updated_at
         FROM notes WHERE id = ?1 AND deleted_at IS NULL",
        params![id],
        |row| {
            Ok(Note {
                id: row.get(0)?,
                parent_id: row.get(1)?,
                title: row.get(2)?,
                content: row.get(3)?,
                sort_order: row.get(4)?,
                is_folder: row.get(5)?,
                deleted_at: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        },
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(format!("note {id}")),
        other => AppError::Database(other),
    })
}

pub fn get_by_id_including_deleted(conn: &Connection, id: &str) -> AppResult<Note> {
    conn.query_row(
        "SELECT id, parent_id, title, content, sort_order, is_folder, deleted_at, created_at, updated_at
         FROM notes WHERE id = ?1",
        params![id],
        |row| {
            Ok(Note {
                id: row.get(0)?,
                parent_id: row.get(1)?,
                title: row.get(2)?,
                content: row.get(3)?,
                sort_order: row.get(4)?,
                is_folder: row.get(5)?,
                deleted_at: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        },
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(format!("note {id}")),
        other => AppError::Database(other),
    })
}

pub fn list_metadata(conn: &Connection, include_deleted: bool) -> AppResult<Vec<NoteRow>> {
    let sql = if include_deleted {
        "SELECT id, parent_id, title, sort_order, is_folder, deleted_at, created_at, updated_at
         FROM notes ORDER BY sort_order"
    } else {
        "SELECT id, parent_id, title, sort_order, is_folder, deleted_at, created_at, updated_at
         FROM notes WHERE deleted_at IS NULL ORDER BY sort_order"
    };
    let mut stmt = conn.prepare(sql)?;
    let rows = stmt.query_map([], |row| {
        Ok(NoteRow {
            id: row.get(0)?,
            parent_id: row.get(1)?,
            title: row.get(2)?,
            sort_order: row.get(3)?,
            is_folder: row.get(4)?,
            deleted_at: row.get(5)?,
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(AppError::Database)
}

pub fn update(conn: &Connection, id: &str, title: &str, content: &str, now: i64) -> AppResult<()> {
    let affected = conn.execute(
        "UPDATE notes SET title = ?1, content = ?2, updated_at = ?3 WHERE id = ?4 AND deleted_at IS NULL",
        params![title, content, now, id],
    )?;
    if affected == 0 {
        return Err(AppError::NotFound(format!("note {id}")));
    }
    Ok(())
}

pub fn soft_delete(conn: &Connection, id: &str, now: i64) -> AppResult<()> {
    let affected = conn.execute(
        "UPDATE notes SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND deleted_at IS NULL",
        params![now, id],
    )?;
    if affected == 0 {
        return Err(AppError::NotFound(format!("note {id}")));
    }
    Ok(())
}

pub fn rename(conn: &Connection, id: &str, title: &str, now: i64) -> AppResult<()> {
    let affected = conn.execute(
        "UPDATE notes SET title = ?1, updated_at = ?2 WHERE id = ?3 AND deleted_at IS NULL",
        params![title, now, id],
    )?;
    if affected == 0 {
        return Err(AppError::NotFound(format!("note {id}")));
    }
    Ok(())
}

pub fn soft_delete_tree(conn: &Connection, id: &str, now: i64) -> AppResult<Vec<String>> {
    let mut deleted_ids = Vec::new();
    let mut to_delete = vec![id.to_string()];

    while let Some(current_id) = to_delete.pop() {
        // Find all children of the current note
        let mut stmt = conn.prepare(
            "SELECT id FROM notes WHERE parent_id = ?1 AND deleted_at IS NULL",
        )?;
        let children: Vec<String> = stmt
            .query_map(params![&current_id], |row| row.get(0))?
            .collect::<Result<Vec<_>, _>>()?;

        // Soft-delete the current note
        conn.execute(
            "UPDATE notes SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND deleted_at IS NULL",
            params![now, &current_id],
        )?;
        deleted_ids.push(current_id);

        // Add children to the deletion queue
        to_delete.extend(children);
    }

    Ok(deleted_ids)
}

pub fn max_sort_order(conn: &Connection, parent_id: Option<&str>) -> AppResult<f64> {
    let max: Option<f64> = match parent_id {
        Some(pid) => conn.query_row(
            "SELECT MAX(sort_order) FROM notes WHERE parent_id = ?1 AND deleted_at IS NULL",
            params![pid],
            |row| row.get(0),
        )?,
        None => conn.query_row(
            "SELECT MAX(sort_order) FROM notes WHERE parent_id IS NULL AND deleted_at IS NULL",
            [],
            |row| row.get(0),
        )?,
    };
    Ok(max.unwrap_or(0.0))
}

pub fn move_note(
    conn: &Connection,
    id: &str,
    parent_id: Option<&str>,
    sort_order: f64,
    now: i64,
) -> AppResult<()> {
    let affected = conn.execute(
        "UPDATE notes SET parent_id = ?1, sort_order = ?2, updated_at = ?3 WHERE id = ?4 AND deleted_at IS NULL",
        params![parent_id, sort_order, now, id],
    )?;
    if affected == 0 {
        return Err(AppError::NotFound(format!("note {id}")));
    }
    Ok(())
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SiblingInfo {
    pub id: String,
    pub sort_order: f64,
}

pub fn get_siblings_sorted(conn: &Connection, parent_id: Option<&str>) -> AppResult<Vec<SiblingInfo>> {
    let sql = match parent_id {
        Some(_) => "SELECT id, sort_order FROM notes WHERE parent_id = ?1 AND deleted_at IS NULL ORDER BY sort_order",
        None => "SELECT id, sort_order FROM notes WHERE parent_id IS NULL AND deleted_at IS NULL ORDER BY sort_order",
    };

    let mut stmt = conn.prepare(sql)?;
    let rows = stmt.query_map(params![parent_id], |row| {
        Ok(SiblingInfo {
            id: row.get(0)?,
            sort_order: row.get(1)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(AppError::Database)
}

pub fn restore(
    conn: &Connection,
    id: &str,
    parent_id: Option<&str>,
    sort_order: f64,
    now: i64,
) -> AppResult<()> {
    // Verify the note exists and is deleted
    let note = get_by_id_including_deleted(conn, id)?;
    if note.deleted_at.is_none() {
        return Err(AppError::Config(format!("note {id} is not deleted")));
    }

    // Update the note to restore it
    let affected = conn.execute(
        "UPDATE notes SET deleted_at = NULL, parent_id = ?1, sort_order = ?2, updated_at = ?3 WHERE id = ?4",
        params![parent_id, sort_order, now, id],
    )?;
    if affected == 0 {
        return Err(AppError::NotFound(format!("note {id}")));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_helpers::test_connection;
    use crate::error::AppError;

    fn make_note(id: &str, title: &str, sort_order: f64, parent_id: Option<&str>) -> Note {
        Note {
            id: id.to_string(),
            parent_id: parent_id.map(|s| s.to_string()),
            title: title.to_string(),
            content: Some("{}".to_string()),
            sort_order,
            is_folder: false,
            deleted_at: None,
            created_at: 1000,
            updated_at: 1000,
        }
    }

    #[test]
    fn test_insert_and_get() {
        let conn = test_connection();
        let note = make_note("note-1", "Test Note", 1.0, None);
        insert(&conn, &note).unwrap();

        let fetched = get_by_id(&conn, "note-1").unwrap();
        assert_eq!(fetched.id, "note-1");
        assert_eq!(fetched.title, "Test Note");
        assert_eq!(fetched.content, Some("{}".to_string()));
        assert_eq!(fetched.sort_order, 1.0);
        assert!(!fetched.is_folder);
        assert!(fetched.deleted_at.is_none());
        assert_eq!(fetched.created_at, 1000);
        assert_eq!(fetched.updated_at, 1000);
        assert!(fetched.parent_id.is_none());
    }

    #[test]
    fn test_list_metadata_excludes_deleted() {
        let conn = test_connection();
        insert(&conn, &make_note("n1", "Note 1", 1.0, None)).unwrap();
        insert(&conn, &make_note("n2", "Note 2", 2.0, None)).unwrap();

        soft_delete(&conn, "n1", 2000).unwrap();

        let active = list_metadata(&conn, false).unwrap();
        assert_eq!(active.len(), 1);
        assert_eq!(active[0].id, "n2");

        let all = list_metadata(&conn, true).unwrap();
        assert_eq!(all.len(), 2);
    }

    #[test]
    fn test_update() {
        let conn = test_connection();
        insert(&conn, &make_note("n1", "Original", 1.0, None)).unwrap();

        update(&conn, "n1", "Updated Title", "Updated Content", 2000).unwrap();

        let fetched = get_by_id(&conn, "n1").unwrap();
        assert_eq!(fetched.title, "Updated Title");
        assert_eq!(fetched.content, Some("Updated Content".to_string()));
        assert_eq!(fetched.updated_at, 2000);
    }

    #[test]
    fn test_soft_delete() {
        let conn = test_connection();
        insert(&conn, &make_note("n1", "Note", 1.0, None)).unwrap();

        soft_delete(&conn, "n1", 2000).unwrap();

        let result = get_by_id(&conn, "n1");
        assert!(result.is_err());
        match result.unwrap_err() {
            AppError::NotFound(msg) => assert!(msg.contains("n1")),
            other => panic!("Expected NotFound, got: {:?}", other),
        }
    }

    #[test]
    fn test_max_sort_order() {
        let conn = test_connection();
        // No notes yet — should be 0.0
        assert_eq!(max_sort_order(&conn, None).unwrap(), 0.0);

        insert(&conn, &make_note("n1", "A", 5.0, None)).unwrap();
        insert(&conn, &make_note("n2", "B", 3.0, None)).unwrap();
        assert_eq!(max_sort_order(&conn, None).unwrap(), 5.0);

        // Insert a note under a parent
        insert(&conn, &Note {
            id: "child-1".to_string(),
            parent_id: Some("n1".to_string()),
            title: "Child".to_string(),
            content: Some("{}".to_string()),
            sort_order: 10.0,
            is_folder: false,
            deleted_at: None,
            created_at: 1000,
            updated_at: 1000,
        }).unwrap();

        assert_eq!(max_sort_order(&conn, Some("n1")).unwrap(), 10.0);
        assert_eq!(max_sort_order(&conn, Some("n2")).unwrap(), 0.0);
    }

    #[test]
    fn test_get_by_id_including_deleted() {
        let conn = test_connection();
        insert(&conn, &make_note("n1", "Note", 1.0, None)).unwrap();
        soft_delete(&conn, "n1", 2000).unwrap();

        // get_by_id should fail (excluded deleted)
        let result = get_by_id(&conn, "n1");
        assert!(result.is_err());

        // get_by_id_including_deleted should succeed
        let note = get_by_id_including_deleted(&conn, "n1").unwrap();
        assert_eq!(note.id, "n1");
        assert_eq!(note.deleted_at, Some(2000));
    }

    #[test]
    fn test_restore() {
        let conn = test_connection();
        let note = make_note("n1", "Note", 1.0, None);
        insert(&conn, &note).unwrap();
        soft_delete(&conn, "n1", 2000).unwrap();

        // Restore the note to root with new sort order
        restore(&conn, "n1", None, 5.0, 3000).unwrap();

        let restored = get_by_id(&conn, "n1").unwrap();
        assert_eq!(restored.id, "n1");
        assert_eq!(restored.deleted_at, None);
        assert_eq!(restored.sort_order, 5.0);
        assert_eq!(restored.parent_id, None);
        assert_eq!(restored.updated_at, 3000);
    }

    #[test]
    fn test_restore_with_parent() {
        let conn = test_connection();
        let parent = make_note("parent-1", "Parent", 1.0, None);
        let note = make_note("n1", "Note", 1.0, None);
        insert(&conn, &parent).unwrap();
        insert(&conn, &note).unwrap();
        soft_delete(&conn, "n1", 2000).unwrap();

        // Restore with parent
        restore(&conn, "n1", Some("parent-1"), 5.0, 3000).unwrap();

        let restored = get_by_id(&conn, "n1").unwrap();
        assert_eq!(restored.parent_id, Some("parent-1".to_string()));
        assert_eq!(restored.sort_order, 5.0);
        assert_eq!(restored.deleted_at, None);
    }

    #[test]
    fn test_restore_not_deleted_fails() {
        let conn = test_connection();
        insert(&conn, &make_note("n1", "Note", 1.0, None)).unwrap();

        // Try to restore a note that's not deleted
        let result = restore(&conn, "n1", None, 5.0, 3000);
        assert!(result.is_err());
        match result.unwrap_err() {
            AppError::Config(msg) => assert!(msg.contains("is not deleted")),
            other => panic!("Expected Config error, got: {:?}", other),
        }
    }
}
