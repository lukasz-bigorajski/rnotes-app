pub mod assets;
pub mod fts;
pub mod notes;
pub mod schema;
pub mod tasks;

#[cfg(test)]
pub mod test_helpers;

use rusqlite::Connection;
use std::path::Path;

use crate::error::AppResult;

pub fn open_and_initialize(db_path: &Path) -> AppResult<Connection> {
    let conn = Connection::open(db_path)?;
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA foreign_keys = ON;
         PRAGMA synchronous = NORMAL;",
    )?;
    schema::run_migrations(&conn)?;
    Ok(conn)
}

/// Flush the WAL file back into the main database file.
///
/// Called on app shutdown to ensure the database is in a clean state and
/// the `-wal` / `-shm` sidecar files are removed. Uses TRUNCATE mode so
/// that SQLite resets the WAL to zero bytes rather than leaving a stub.
/// Errors are intentionally non-fatal — if the checkpoint fails we still
/// allow the app to exit; the WAL will be replayed correctly on the next
/// open.
pub fn wal_checkpoint(conn: &Connection) -> AppResult<()> {
    conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wal_checkpoint_on_wal_mode_db() {
        // Use an in-memory database (WAL mode is not meaningful for :memory:,
        // but the PRAGMA is accepted and returns without error, which is what
        // we want to verify: that our wrapper does not panic or propagate errors.)
        let conn = test_helpers::test_connection();
        let result = wal_checkpoint(&conn);
        assert!(
            result.is_ok(),
            "wal_checkpoint should succeed: {:?}",
            result
        );
    }

    #[test]
    fn test_indexes_exist_after_migration() {
        let conn = test_helpers::test_connection();

        // Query sqlite_master for all indexes we rely on for query performance.
        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?1")
            .unwrap();

        let expected_indexes = [
            "idx_notes_parent",
            "idx_notes_sort",
            "idx_notes_deleted",
            "idx_assets_note",
            "idx_tasks_note",
            "idx_tasks_notify",
        ];

        for index_name in expected_indexes {
            let found: bool = stmt.query_row([index_name], |_| Ok(true)).unwrap_or(false);
            assert!(
                found,
                "Expected index '{}' to exist after migration",
                index_name
            );
        }
    }
}
