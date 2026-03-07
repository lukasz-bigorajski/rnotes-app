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
