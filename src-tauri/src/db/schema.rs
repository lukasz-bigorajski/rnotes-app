use rusqlite::Connection;

const SCHEMA_VERSION: i64 = 1;

const SCHEMA_V1: &str = "
CREATE TABLE IF NOT EXISTS notes (
    id          TEXT PRIMARY KEY NOT NULL,
    parent_id   TEXT REFERENCES notes(id) ON DELETE SET NULL,
    title       TEXT NOT NULL DEFAULT '',
    content     TEXT,
    sort_order  REAL NOT NULL DEFAULT 0.0,
    is_folder   INTEGER NOT NULL DEFAULT 0,
    deleted_at  INTEGER,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_parent ON notes(parent_id);
CREATE INDEX IF NOT EXISTS idx_notes_sort ON notes(parent_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_notes_deleted ON notes(deleted_at);

CREATE TABLE IF NOT EXISTS assets (
    id          TEXT PRIMARY KEY NOT NULL,
    note_id     TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    filename    TEXT NOT NULL,
    mime_type   TEXT NOT NULL,
    size_bytes  INTEGER NOT NULL,
    created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assets_note ON assets(note_id);

CREATE TABLE IF NOT EXISTS note_tasks (
    id          TEXT PRIMARY KEY NOT NULL,
    note_id     TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    content     TEXT NOT NULL DEFAULT '',
    is_checked  INTEGER NOT NULL DEFAULT 0,
    notify_at   INTEGER,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_note ON note_tasks(note_id);
CREATE INDEX IF NOT EXISTS idx_tasks_notify ON note_tasks(notify_at) WHERE notify_at IS NOT NULL;

CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
    note_id UNINDEXED,
    title,
    body,
    tokenize='porter unicode61'
);
";

pub fn run_migrations(conn: &Connection) -> rusqlite::Result<()> {
    let version: i64 = conn
        .pragma_query_value(None, "user_version", |row| row.get(0))
?;

    if version < SCHEMA_VERSION {
        conn.execute_batch(SCHEMA_V1)?;
        conn.pragma_update(None, "user_version", SCHEMA_VERSION)?;
    }

    Ok(())
}
