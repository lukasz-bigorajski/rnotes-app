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
