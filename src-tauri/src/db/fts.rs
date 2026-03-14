use rusqlite::{params, Connection};

use crate::error::{AppError, AppResult};

pub fn upsert(conn: &Connection, note_id: &str, title: &str, body: &str) -> AppResult<()> {
    conn.execute(
        "DELETE FROM notes_fts WHERE note_id = ?1",
        params![note_id],
    )?;
    conn.execute(
        "INSERT INTO notes_fts (note_id, title, body) VALUES (?1, ?2, ?3)",
        params![note_id, title, body],
    )?;
    Ok(())
}

pub fn remove(conn: &Connection, note_id: &str) -> AppResult<()> {
    conn.execute(
        "DELETE FROM notes_fts WHERE note_id = ?1",
        params![note_id],
    )?;
    Ok(())
}

pub fn get_body(conn: &Connection, note_id: &str) -> AppResult<Option<String>> {
    match conn.query_row(
        "SELECT body FROM notes_fts WHERE note_id = ?1",
        params![note_id],
        |row| row.get(0),
    ) {
        Ok(body) => Ok(Some(body)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(AppError::Database(e)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_helpers::test_connection;

    #[test]
    fn test_upsert_and_search() {
        let conn = test_connection();
        upsert(&conn, "note-1", "My Title", "Some body text").unwrap();

        let (title, body): (String, String) = conn
            .query_row(
                "SELECT title, body FROM notes_fts WHERE note_id = ?1",
                params!["note-1"],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();

        assert_eq!(title, "My Title");
        assert_eq!(body, "Some body text");
    }

    #[test]
    fn test_remove() {
        let conn = test_connection();
        upsert(&conn, "note-1", "Title", "Body").unwrap();
        remove(&conn, "note-1").unwrap();

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM notes_fts WHERE note_id = ?1",
                params!["note-1"],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(count, 0);
    }

    #[test]
    fn test_upsert_replaces_existing() {
        let conn = test_connection();
        upsert(&conn, "note-1", "Old Title", "Old Body").unwrap();
        upsert(&conn, "note-1", "New Title", "New Body").unwrap();

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM notes_fts WHERE note_id = ?1",
                params!["note-1"],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);

        let (title, body): (String, String) = conn
            .query_row(
                "SELECT title, body FROM notes_fts WHERE note_id = ?1",
                params!["note-1"],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();

        assert_eq!(title, "New Title");
        assert_eq!(body, "New Body");
    }
}
