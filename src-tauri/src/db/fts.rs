use rusqlite::{params, Connection};
use serde::Serialize;

use crate::error::{AppError, AppResult};

#[derive(Debug, Serialize)]
pub struct SearchResult {
    pub id: String,
    pub title: String,
    pub snippet: String,
    pub rank: f64,
}

/// Sanitize an FTS5 query string to avoid syntax errors from special chars.
/// Wraps the query in double quotes so it is treated as a phrase search.
fn sanitize_fts_query(query: &str) -> String {
    // Escape any embedded double-quotes by doubling them, then wrap in quotes.
    let escaped = query.replace('"', "\"\"");
    format!("\"{}\"", escaped)
}

pub fn search(conn: &Connection, query: &str) -> AppResult<Vec<SearchResult>> {
    let query = query.trim();
    if query.is_empty() {
        return Ok(vec![]);
    }

    let sanitized = sanitize_fts_query(query);

    let sql = "
        SELECT
            n.id,
            f.title,
            snippet(notes_fts, 2, '<mark>', '</mark>', '...', 30) AS snippet,
            f.rank
        FROM notes_fts f
        JOIN notes n ON n.id = f.note_id
        WHERE notes_fts MATCH ?1
          AND n.deleted_at IS NULL
          AND n.is_folder = 0
        ORDER BY f.rank
        LIMIT 50
    ";

    let mut stmt = conn.prepare(sql)?;
    let results = stmt
        .query_map(params![sanitized], |row| {
            Ok(SearchResult {
                id: row.get(0)?,
                title: row.get(1)?,
                snippet: row.get(2)?,
                rank: row.get(3)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(AppError::Database)?;

    Ok(results)
}

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

    fn insert_note(conn: &Connection, id: &str, title: &str) {
        let now = 1_000_000i64;
        conn.execute(
            "INSERT INTO notes (id, title, content, sort_order, is_folder, created_at, updated_at)
             VALUES (?1, ?2, '{}', 1.0, 0, ?3, ?3)",
            rusqlite::params![id, title, now],
        )
        .unwrap();
    }

    #[test]
    fn test_search_empty_query_returns_empty() {
        let conn = test_connection();
        upsert(&conn, "note-1", "Hello World", "Some body").unwrap();
        let results = search(&conn, "").unwrap();
        assert!(results.is_empty());
    }

    #[test]
    fn test_search_whitespace_query_returns_empty() {
        let conn = test_connection();
        upsert(&conn, "note-1", "Hello World", "Some body").unwrap();
        let results = search(&conn, "   ").unwrap();
        assert!(results.is_empty());
    }

    #[test]
    fn test_search_finds_matching_note() {
        let conn = test_connection();
        insert_note(&conn, "note-1", "My Rust Note");
        upsert(&conn, "note-1", "My Rust Note", "Rust is great for systems programming").unwrap();

        let results = search(&conn, "Rust").unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "note-1");
        assert_eq!(results[0].title, "My Rust Note");
    }

    #[test]
    fn test_search_excludes_deleted_notes() {
        let conn = test_connection();
        let now = 1_000_000i64;
        conn.execute(
            "INSERT INTO notes (id, title, content, sort_order, is_folder, deleted_at, created_at, updated_at)
             VALUES ('note-del', 'Deleted Note', '{}', 1.0, 0, ?1, ?1, ?1)",
            rusqlite::params![now],
        )
        .unwrap();
        upsert(&conn, "note-del", "Deleted Note", "Some content").unwrap();

        let results = search(&conn, "Deleted").unwrap();
        assert!(results.is_empty());
    }

    #[test]
    fn test_search_excludes_folders() {
        let conn = test_connection();
        let now = 1_000_000i64;
        conn.execute(
            "INSERT INTO notes (id, title, content, sort_order, is_folder, created_at, updated_at)
             VALUES ('folder-1', 'My Folder', NULL, 1.0, 1, ?1, ?1)",
            rusqlite::params![now],
        )
        .unwrap();
        upsert(&conn, "folder-1", "My Folder", "").unwrap();

        let results = search(&conn, "Folder").unwrap();
        assert!(results.is_empty());
    }

    #[test]
    fn test_search_returns_multiple_results() {
        let conn = test_connection();
        insert_note(&conn, "note-a", "Alpha Note");
        insert_note(&conn, "note-b", "Beta Note");
        upsert(&conn, "note-a", "Alpha Note", "common content here").unwrap();
        upsert(&conn, "note-b", "Beta Note", "common content here").unwrap();

        let results = search(&conn, "common").unwrap();
        assert_eq!(results.len(), 2);
    }
}
