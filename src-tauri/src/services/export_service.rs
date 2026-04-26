//! Export / import service for `.rnotes` archive files.
//!
//! Format: a ZIP file containing:
//!   - `meta.json`   — schema version, app version, export timestamp.
//!   - `notes.json`  — array of all note rows.
//!   - `tasks.json`  — array of all note_task rows.
//!   - `assets/`     — on-disk asset files, mirrored from `<assets_dir>/`.

use std::io::{Read, Write};
use std::path::Path;

use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};

// ── Schema version kept in exported meta ─────────────────────────────────────

const EXPORT_SCHEMA_VERSION: u32 = 1;
const APP_VERSION: &str = env!("CARGO_PKG_VERSION");

// ── Row types for serialisation ───────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExportNote {
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
pub struct ExportTask {
    pub id: String,
    pub note_id: String,
    pub content: String,
    pub is_checked: bool,
    pub notify_at: Option<i64>,
    pub notified_at: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportMeta {
    pub schema_version: u32,
    pub app_version: String,
    pub exported_at_ms: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ImportMode {
    /// Wipe all existing data, then insert everything from the archive.
    Replace,
    /// Only insert notes/tasks whose ID does not already exist; skip conflicts.
    AddMissing,
    /// Upsert: overwrite existing rows and insert new ones.
    Merge,
}

// ── Export ────────────────────────────────────────────────────────────────────

/// Write all data to a `.rnotes` ZIP archive at `zip_path`.
pub fn export_all(conn: &Connection, zip_path: &Path, assets_dir: &Path) -> AppResult<()> {
    let file = std::fs::File::create(zip_path)?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    // meta.json
    let meta = ExportMeta {
        schema_version: EXPORT_SCHEMA_VERSION,
        app_version: APP_VERSION.to_string(),
        exported_at_ms: now_ms(),
    };
    zip.start_file("meta.json", options).map_err(|e| AppError::Zip(e.to_string()))?;
    zip.write_all(serde_json::to_string_pretty(&meta)?.as_bytes())?;

    // notes.json
    let notes = load_all_notes(conn)?;
    zip.start_file("notes.json", options).map_err(|e| AppError::Zip(e.to_string()))?;
    zip.write_all(serde_json::to_string_pretty(&notes)?.as_bytes())?;

    // tasks.json
    let tasks = load_all_tasks(conn)?;
    zip.start_file("tasks.json", options).map_err(|e| AppError::Zip(e.to_string()))?;
    zip.write_all(serde_json::to_string_pretty(&tasks)?.as_bytes())?;

    // assets/ directory — walk on-disk tree
    if assets_dir.exists() {
        pack_assets_dir(&mut zip, assets_dir, options)?;
    }

    zip.finish().map_err(|e| AppError::Zip(e.to_string()))?;
    Ok(())
}

/// Walk `assets_dir` recursively and add each file as `assets/<rel_path>`.
fn pack_assets_dir(
    zip: &mut zip::ZipWriter<std::fs::File>,
    assets_dir: &Path,
    options: zip::write::SimpleFileOptions,
) -> AppResult<()> {
    for entry in walkdir(assets_dir) {
        let entry = entry?;
        let path = entry.path();
        if path.is_file() {
            // rel_path: strip the parent of assets_dir, prepend "assets/"
            let rel = path
                .strip_prefix(assets_dir.parent().unwrap_or(assets_dir))
                .map_err(|e| AppError::Config(e.to_string()))?;
            let zip_name = rel.to_string_lossy().replace('\\', "/");
            zip.start_file(&zip_name, options).map_err(|e| AppError::Zip(e.to_string()))?;
            let data = std::fs::read(path)?;
            zip.write_all(&data)?;
        }
    }
    Ok(())
}

/// Simple recursive directory iterator returning `(path)` entries.
fn walkdir(dir: &Path) -> impl Iterator<Item = AppResult<std::fs::DirEntry>> {
    WalkDir::new(dir)
}

struct WalkDir {
    stack: Vec<std::path::PathBuf>,
}

impl WalkDir {
    fn new(dir: &Path) -> Self {
        Self { stack: vec![dir.to_path_buf()] }
    }
}

impl Iterator for WalkDir {
    type Item = AppResult<std::fs::DirEntry>;

    fn next(&mut self) -> Option<Self::Item> {
        while let Some(path) = self.stack.last().cloned() {
            // read_dir this path; if it's a file, pop it but we actually need DirEntry
            // Use a different approach: flatten via the stack of read_dir iterators
            self.stack.pop();
            match std::fs::read_dir(&path) {
                Err(e) => return Some(Err(AppError::Io(e))),
                Ok(iter) => {
                    for entry in iter {
                        match entry {
                            Err(e) => return Some(Err(AppError::Io(e))),
                            Ok(e) => {
                                let p = e.path();
                                if p.is_dir() {
                                    self.stack.push(p);
                                } else {
                                    return Some(Ok(e));
                                }
                            }
                        }
                    }
                }
            }
        }
        None
    }
}

// ── Import ────────────────────────────────────────────────────────────────────

/// Import data from a `.rnotes` ZIP archive.
///
/// `Replace` mode: wipe all existing data, then insert cleanly.
/// `Merge` mode: skip notes/tasks with conflicting IDs (preserve existing).
pub fn import_all(
    conn: &Connection,
    zip_path: &Path,
    assets_dir: &Path,
    mode: ImportMode,
) -> AppResult<()> {
    // ── 1. Read the archive into memory ──────────────────────────────────────
    let file = std::fs::File::open(zip_path)?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| AppError::Zip(e.to_string()))?;

    // Validate meta.json
    let meta: ExportMeta = {
        let mut entry = archive
            .by_name("meta.json")
            .map_err(|_| AppError::InvalidState("archive missing meta.json".into()))?;
        let mut buf = String::new();
        entry.read_to_string(&mut buf)?;
        serde_json::from_str(&buf)?
    };

    if meta.schema_version > EXPORT_SCHEMA_VERSION {
        return Err(AppError::InvalidState(format!(
            "archive schema version {} is newer than supported {}",
            meta.schema_version, EXPORT_SCHEMA_VERSION
        )));
    }

    // Read notes and tasks
    let notes: Vec<ExportNote> = {
        let mut entry = archive
            .by_name("notes.json")
            .map_err(|_| AppError::InvalidState("archive missing notes.json".into()))?;
        let mut buf = String::new();
        entry.read_to_string(&mut buf)?;
        serde_json::from_str(&buf)?
    };

    let tasks: Vec<ExportTask> = {
        match archive.by_name("tasks.json") {
            Ok(mut entry) => {
                let mut buf = String::new();
                entry.read_to_string(&mut buf)?;
                serde_json::from_str(&buf)?
            }
            Err(_) => vec![],
        }
    };

    // Collect asset entries: (zip_index, zip_name)
    let asset_entries: Vec<(usize, String)> = (0..archive.len())
        .filter_map(|i| {
            archive.by_index(i).ok().and_then(|e| {
                let name = e.name().to_string();
                if name.starts_with("assets/") && !name.ends_with('/') {
                    Some((i, name))
                } else {
                    None
                }
            })
        })
        .collect();

    // ── 2. Write to DB ────────────────────────────────────────────────────────
    {
        let tx = conn.unchecked_transaction()?;

        // Allow FK violations during inserts to resolve at commit.
        tx.execute_batch("PRAGMA defer_foreign_keys = ON;")?;

        if matches!(mode, ImportMode::Replace) {
            // Wipe in dependency order.
            tx.execute_batch(
                "DELETE FROM notes_fts;
                 DELETE FROM note_tasks;
                 DELETE FROM assets;
                 DELETE FROM notes;",
            )?;
        }

        for note in &notes {
            let inserted = match mode {
                ImportMode::Replace | ImportMode::AddMissing => {
                    let res = tx.execute(
                        "INSERT INTO notes
                             (id, parent_id, title, content, sort_order, is_folder,
                              deleted_at, created_at, updated_at)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                        rusqlite::params![
                            note.id,
                            note.parent_id,
                            note.title,
                            note.content,
                            note.sort_order,
                            note.is_folder,
                            note.deleted_at,
                            note.created_at,
                            note.updated_at,
                        ],
                    );
                    match res {
                        Ok(_) => true,
                        Err(e) if matches!(mode, ImportMode::AddMissing) && is_constraint_error(&e) => false,
                        Err(e) => return Err(AppError::Database(e)),
                    }
                }
                ImportMode::Merge => {
                    tx.execute(
                        "INSERT INTO notes
                             (id, parent_id, title, content, sort_order, is_folder,
                              deleted_at, created_at, updated_at)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                         ON CONFLICT(id) DO UPDATE SET
                             parent_id  = excluded.parent_id,
                             title      = excluded.title,
                             content    = excluded.content,
                             sort_order = excluded.sort_order,
                             is_folder  = excluded.is_folder,
                             deleted_at = excluded.deleted_at,
                             created_at = excluded.created_at,
                             updated_at = excluded.updated_at",
                        rusqlite::params![
                            note.id,
                            note.parent_id,
                            note.title,
                            note.content,
                            note.sort_order,
                            note.is_folder,
                            note.deleted_at,
                            note.created_at,
                            note.updated_at,
                        ],
                    )
                    .map_err(AppError::Database)?;
                    true
                }
            };

            // Re-index in FTS (non-folders only, non-deleted).
            if inserted && !note.is_folder && note.deleted_at.is_none() {
                tx.execute(
                    "DELETE FROM notes_fts WHERE note_id = ?1",
                    rusqlite::params![note.id],
                )?;
                tx.execute(
                    "INSERT INTO notes_fts (note_id, title, body) VALUES (?1, ?2, '')",
                    rusqlite::params![note.id, note.title],
                )?;
            }
        }

        for task in &tasks {
            match mode {
                ImportMode::Replace | ImportMode::AddMissing => {
                    let res = tx.execute(
                        "INSERT INTO note_tasks
                             (id, note_id, content, is_checked, notify_at, notified_at,
                              created_at, updated_at)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                        rusqlite::params![
                            task.id,
                            task.note_id,
                            task.content,
                            task.is_checked,
                            task.notify_at,
                            task.notified_at,
                            task.created_at,
                            task.updated_at,
                        ],
                    );
                    match res {
                        Ok(_) => {}
                        Err(e) if matches!(mode, ImportMode::AddMissing) && is_constraint_error(&e) => {}
                        Err(e) => return Err(AppError::Database(e)),
                    }
                }
                ImportMode::Merge => {
                    tx.execute(
                        "INSERT INTO note_tasks
                             (id, note_id, content, is_checked, notify_at, notified_at,
                              created_at, updated_at)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                         ON CONFLICT(id) DO UPDATE SET
                             note_id     = excluded.note_id,
                             content     = excluded.content,
                             is_checked  = excluded.is_checked,
                             notify_at   = excluded.notify_at,
                             notified_at = excluded.notified_at,
                             created_at  = excluded.created_at,
                             updated_at  = excluded.updated_at",
                        rusqlite::params![
                            task.id,
                            task.note_id,
                            task.content,
                            task.is_checked,
                            task.notify_at,
                            task.notified_at,
                            task.created_at,
                            task.updated_at,
                        ],
                    )
                    .map_err(AppError::Database)?;
                }
            }
        }

        tx.commit()?;
    }

    // ── 3. Extract asset files ────────────────────────────────────────────────
    // assets_dir is the on-disk assets root (parent of per-note dirs).
    let assets_parent = assets_dir.parent().unwrap_or(assets_dir);

    for (idx, zip_name) in asset_entries {
        let mut entry = archive
            .by_index(idx)
            .map_err(|e| AppError::Zip(e.to_string()))?;
        let rel_path = std::path::PathBuf::from(&zip_name);
        let dest = assets_parent.join(&rel_path);
        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let mut data = Vec::new();
        entry.read_to_end(&mut data)?;
        std::fs::write(&dest, data)?;
    }

    Ok(())
}

fn is_constraint_error(e: &rusqlite::Error) -> bool {
    matches!(
        e,
        rusqlite::Error::SqliteFailure(
            rusqlite::ffi::Error { code: rusqlite::ErrorCode::ConstraintViolation, .. },
            _
        )
    )
}

// ── DB helpers ────────────────────────────────────────────────────────────────

fn load_all_notes(conn: &Connection) -> AppResult<Vec<ExportNote>> {
    let mut stmt = conn.prepare(
        "SELECT id, parent_id, title, content, sort_order, is_folder,
                deleted_at, created_at, updated_at
         FROM notes ORDER BY created_at",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(ExportNote {
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
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::Database)
}

fn load_all_tasks(conn: &Connection) -> AppResult<Vec<ExportTask>> {
    let mut stmt = conn.prepare(
        "SELECT id, note_id, content, is_checked, notify_at, notified_at,
                created_at, updated_at
         FROM note_tasks ORDER BY created_at",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(ExportTask {
            id: row.get(0)?,
            note_id: row.get(1)?,
            content: row.get(2)?,
            is_checked: row.get(3)?,
            notify_at: row.get(4)?,
            notified_at: row.get(5)?,
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::Database)
}

fn now_ms() -> i64 {
    let dur = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap();
    (dur.as_secs() as i64) * 1000 + (dur.subsec_millis() as i64)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_helpers::test_connection;
    use crate::services::note_service;
    use crate::services::note_service::CreateNoteRequest;
    use tempfile::TempDir;

    fn setup_notes(conn: &Connection) -> (String, String) {
        let n1 = note_service::create_note(
            conn,
            CreateNoteRequest {
                parent_id: None,
                title: "First Note".to_string(),
                is_folder: false,
            },
        )
        .unwrap();
        let n2 = note_service::create_note(
            conn,
            CreateNoteRequest {
                parent_id: None,
                title: "Second Note".to_string(),
                is_folder: false,
            },
        )
        .unwrap();
        (n1.id, n2.id)
    }

    #[test]
    fn test_export_import_roundtrip() {
        let tmp = TempDir::new().unwrap();
        let assets_dir = tmp.path().join("assets");
        std::fs::create_dir_all(&assets_dir).unwrap();
        let zip_path = tmp.path().join("export.rnotes");

        // ── Export ────────────────────────────────────────────────────────────
        let conn_export = test_connection();
        let (id1, _id2) = setup_notes(&conn_export);

        // Verify we have 2 notes before export.
        let count_before: i64 = conn_export
            .query_row("SELECT COUNT(*) FROM notes", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count_before, 2);

        export_all(&conn_export, &zip_path, &assets_dir).unwrap();
        assert!(zip_path.exists());

        // ── Import into a fresh DB (Replace mode) ─────────────────────────────
        let conn_import = test_connection();
        // Fresh DB has 0 notes.
        let count_fresh: i64 = conn_import
            .query_row("SELECT COUNT(*) FROM notes", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count_fresh, 0);

        import_all(&conn_import, &zip_path, &assets_dir, ImportMode::Replace).unwrap();

        // After import should have 2 notes.
        let count_after: i64 = conn_import
            .query_row("SELECT COUNT(*) FROM notes", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count_after, 2);

        // The specific note should be present with the same content.
        let title: String = conn_import
            .query_row(
                "SELECT title FROM notes WHERE id = ?1",
                rusqlite::params![id1],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(title, "First Note");
    }

    #[test]
    fn test_import_replace_wipes_existing() {
        let tmp = TempDir::new().unwrap();
        let assets_dir = tmp.path().join("assets");
        std::fs::create_dir_all(&assets_dir).unwrap();
        let zip_path = tmp.path().join("export.rnotes");

        // Export 2 notes from one DB.
        let conn_src = test_connection();
        setup_notes(&conn_src);
        export_all(&conn_src, &zip_path, &assets_dir).unwrap();

        // Import into a DB that already has 1 note.
        let conn_dest = test_connection();
        note_service::create_note(
            &conn_dest,
            CreateNoteRequest {
                parent_id: None,
                title: "Pre-existing Note".to_string(),
                is_folder: false,
            },
        )
        .unwrap();
        let before: i64 = conn_dest
            .query_row("SELECT COUNT(*) FROM notes", [], |r| r.get(0))
            .unwrap();
        assert_eq!(before, 1);

        import_all(&conn_dest, &zip_path, &assets_dir, ImportMode::Replace).unwrap();

        // Should now have exactly the 2 notes from the archive, not 3.
        let after: i64 = conn_dest
            .query_row("SELECT COUNT(*) FROM notes", [], |r| r.get(0))
            .unwrap();
        assert_eq!(after, 2);
    }

    #[test]
    fn test_import_add_missing_skips_existing_inserts_new() {
        let tmp = TempDir::new().unwrap();
        let assets_dir = tmp.path().join("assets");
        std::fs::create_dir_all(&assets_dir).unwrap();
        let zip_path = tmp.path().join("export.rnotes");

        // Source DB: 2 notes (id1, id2).
        let conn_src = test_connection();
        let (id1, id2) = setup_notes(&conn_src);
        export_all(&conn_src, &zip_path, &assets_dir).unwrap();

        // Destination DB: already has id1 (same ID, different title), plus a third note.
        let conn_dest = test_connection();
        conn_dest
            .execute(
                "INSERT INTO notes (id, parent_id, title, content, sort_order, is_folder,
                                    deleted_at, created_at, updated_at)
                 VALUES (?1, NULL, 'Modified Title', NULL, 1.0, 0, NULL, 1000, 1000)",
                rusqlite::params![id1],
            )
            .unwrap();
        note_service::create_note(
            &conn_dest,
            CreateNoteRequest {
                parent_id: None,
                title: "Third Note".to_string(),
                is_folder: false,
            },
        )
        .unwrap();

        let before: i64 = conn_dest
            .query_row("SELECT COUNT(*) FROM notes", [], |r| r.get(0))
            .unwrap();
        assert_eq!(before, 2);

        import_all(&conn_dest, &zip_path, &assets_dir, ImportMode::AddMissing).unwrap();

        // id1 was already present — should NOT be overwritten; id2 should be added; third stays.
        let after: i64 = conn_dest
            .query_row("SELECT COUNT(*) FROM notes", [], |r| r.get(0))
            .unwrap();
        assert_eq!(after, 3); // id1 + id2 + third

        // id1 title must remain unchanged.
        let title1: String = conn_dest
            .query_row("SELECT title FROM notes WHERE id = ?1", rusqlite::params![id1], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(title1, "Modified Title");

        // id2 should now exist.
        let count_id2: i64 = conn_dest
            .query_row(
                "SELECT COUNT(*) FROM notes WHERE id = ?1",
                rusqlite::params![id2],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count_id2, 1);
    }

    #[test]
    fn test_import_merge_overwrites_existing_and_adds_new() {
        let tmp = TempDir::new().unwrap();
        let assets_dir = tmp.path().join("assets");
        std::fs::create_dir_all(&assets_dir).unwrap();
        let zip_path = tmp.path().join("export.rnotes");

        // Source DB: 2 notes (id1 = "First Note", id2 = "Second Note").
        let conn_src = test_connection();
        let (id1, id2) = setup_notes(&conn_src);
        export_all(&conn_src, &zip_path, &assets_dir).unwrap();

        // Destination DB: has id1 with a modified title, plus a third unrelated note.
        let conn_dest = test_connection();
        conn_dest
            .execute(
                "INSERT INTO notes (id, parent_id, title, content, sort_order, is_folder,
                                    deleted_at, created_at, updated_at)
                 VALUES (?1, NULL, 'Modified Title', NULL, 1.0, 0, NULL, 1000, 1000)",
                rusqlite::params![id1],
            )
            .unwrap();
        note_service::create_note(
            &conn_dest,
            CreateNoteRequest {
                parent_id: None,
                title: "Third Note".to_string(),
                is_folder: false,
            },
        )
        .unwrap();

        let before: i64 = conn_dest
            .query_row("SELECT COUNT(*) FROM notes", [], |r| r.get(0))
            .unwrap();
        assert_eq!(before, 2);

        import_all(&conn_dest, &zip_path, &assets_dir, ImportMode::Merge).unwrap();

        // id1 + id2 + third = 3 total.
        let after: i64 = conn_dest
            .query_row("SELECT COUNT(*) FROM notes", [], |r| r.get(0))
            .unwrap();
        assert_eq!(after, 3);

        // id1 must be overwritten with archive title.
        let title1: String = conn_dest
            .query_row("SELECT title FROM notes WHERE id = ?1", rusqlite::params![id1], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(title1, "First Note");

        // id2 must now exist.
        let count_id2: i64 = conn_dest
            .query_row(
                "SELECT COUNT(*) FROM notes WHERE id = ?1",
                rusqlite::params![id2],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count_id2, 1);
    }
}
