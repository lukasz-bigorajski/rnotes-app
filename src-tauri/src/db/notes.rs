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
