use rusqlite::{params, Connection};

use crate::error::AppResult;

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
