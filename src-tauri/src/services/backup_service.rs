use std::path::{Path, PathBuf};

use rusqlite::Connection;
use serde::Serialize;

use crate::error::AppResult;

const MAX_BACKUPS: usize = 5;
const BACKUP_PREFIX: &str = "rnotes_backup_";
const BACKUP_EXT: &str = ".db";

/// Metadata returned to the frontend for a single backup file.
#[derive(Debug, Clone, Serialize)]
pub struct BackupInfo {
    pub filename: String,
    pub path: String,
    pub size_bytes: u64,
    /// ISO-8601 timestamp parsed from the filename, e.g. "2024-01-15T10:30:00"
    pub timestamp: String,
}

/// Returns a timestamp string for naming pre-restore safety copies.
///
/// Uses the same `YYYYMMDD_HHMMSS` format as regular backups.
pub fn pre_restore_timestamp() -> String {
    current_timestamp()
}

/// Returns the backups directory (`<data_dir>/backups/`), creating it if needed.
pub fn backups_dir(data_dir: &Path) -> AppResult<PathBuf> {
    let dir = data_dir.join("backups");
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

/// Create a timestamped backup of the database file.
///
/// Steps:
/// 1. Flush the WAL into the main file via `PRAGMA wal_checkpoint(TRUNCATE)`.
/// 2. Copy the DB file to `<data_dir>/backups/rnotes_backup_YYYYMMDD_HHMMSS.db`.
/// 3. Enforce the retention policy (keep only the 5 most recent files).
pub fn create_backup(conn: &Connection, db_path: &Path, data_dir: &Path) -> AppResult<BackupInfo> {
    // 1. Checkpoint WAL so the copy is self-contained.
    conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")?;

    // 2. Build destination path.
    let dir = backups_dir(data_dir)?;
    let timestamp = current_timestamp();
    let filename = format!("{}{}{}", BACKUP_PREFIX, timestamp, BACKUP_EXT);
    let dest = dir.join(&filename);

    std::fs::copy(db_path, &dest)?;

    let size_bytes = std::fs::metadata(&dest)?.len();

    // 3. Enforce retention policy.
    enforce_retention(&dir)?;

    Ok(BackupInfo {
        filename,
        path: dest.to_string_lossy().into_owned(),
        size_bytes,
        timestamp: filename_to_display_timestamp(&timestamp),
    })
}

/// List all backup files in the backups directory, sorted newest first.
pub fn list_backups(data_dir: &Path) -> AppResult<Vec<BackupInfo>> {
    let dir = backups_dir(data_dir)?;
    let mut entries = collect_backup_entries(&dir)?;
    // Sort newest first.
    entries.sort_by(|a, b| b.0.cmp(&a.0));

    let infos = entries
        .into_iter()
        .map(|(ts_key, path)| {
            let filename = path
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_default();
            let size_bytes = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
            BackupInfo {
                filename: filename.clone(),
                path: path.to_string_lossy().into_owned(),
                size_bytes,
                timestamp: filename_to_display_timestamp(&ts_key),
            }
        })
        .collect();

    Ok(infos)
}

// ── internal helpers ────────────────────────────────────────────────────────

/// Delete all but the `MAX_BACKUPS` most recent backup files.
fn enforce_retention(dir: &Path) -> AppResult<()> {
    let mut entries = collect_backup_entries(dir)?;
    // Sort oldest first so we can drain the excess from the front.
    entries.sort_by(|a, b| a.0.cmp(&b.0));

    if entries.len() > MAX_BACKUPS {
        let to_delete = entries.len() - MAX_BACKUPS;
        for (_, path) in entries.into_iter().take(to_delete) {
            if let Err(e) = std::fs::remove_file(&path) {
                eprintln!("backup: failed to delete old backup {:?}: {}", path, e);
            }
        }
    }

    Ok(())
}

/// Collect `(timestamp_key, path)` pairs for every file in `dir` that matches
/// the backup naming convention. `timestamp_key` is the raw `YYYYMMDD_HHMMSS`
/// string and is used for lexicographic sorting.
fn collect_backup_entries(dir: &Path) -> AppResult<Vec<(String, PathBuf)>> {
    if !dir.exists() {
        return Ok(vec![]);
    }

    let mut entries = Vec::new();
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if let Some(name) = path.file_name().and_then(|n| n.to_str())
            && name.starts_with(BACKUP_PREFIX)
            && name.ends_with(BACKUP_EXT)
        {
            // Extract the timestamp portion: after prefix, before extension.
            let ts = &name[BACKUP_PREFIX.len()..name.len() - BACKUP_EXT.len()];
            if is_valid_timestamp_key(ts) {
                entries.push((ts.to_string(), path));
            }
        }
    }
    Ok(entries)
}

/// Validate that `s` looks like `YYYYMMDD_HHMMSS` (16 chars, all digits + underscore).
fn is_valid_timestamp_key(s: &str) -> bool {
    if s.len() != 15 {
        return false;
    }
    let bytes = s.as_bytes();
    bytes[8] == b'_'
        && bytes[..8].iter().all(|b| b.is_ascii_digit())
        && bytes[9..].iter().all(|b| b.is_ascii_digit())
}

/// Return the current UTC time as `YYYYMMDD_HHMMSS`.
fn current_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    secs_to_timestamp(secs)
}

/// Convert Unix seconds to `YYYYMMDD_HHMMSS` (UTC).
fn secs_to_timestamp(secs: u64) -> String {
    // Simple UTC conversion without external crates.
    let s = secs;
    let sec = (s % 60) as u32;
    let min = ((s / 60) % 60) as u32;
    let hour = ((s / 3600) % 24) as u32;

    // Days since epoch.
    let days = (s / 86400) as u32;
    let (year, month, day) = days_to_ymd(days);

    format!(
        "{:04}{:02}{:02}_{:02}{:02}{:02}",
        year, month, day, hour, min, sec
    )
}

/// Convert days since Unix epoch (1970-01-01) to (year, month, day).
fn days_to_ymd(mut days: u32) -> (u32, u32, u32) {
    // Algorithm from http://howardhinnant.github.io/date_algorithms.html
    days += 719468;
    let era = days / 146097;
    let doe = days - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}

/// Convert a raw `YYYYMMDD_HHMMSS` key to a human-readable `YYYY-MM-DDTHH:MM:SS`.
fn filename_to_display_timestamp(ts: &str) -> String {
    if ts.len() != 15 {
        return ts.to_string();
    }
    format!(
        "{}-{}-{}T{}:{}:{}",
        &ts[0..4],
        &ts[4..6],
        &ts[6..8],
        &ts[9..11],
        &ts[11..13],
        &ts[13..15],
    )
}

// ── tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    /// Create a temporary directory with a properly-initialised SQLite database at
    /// `<data_dir>/rnotes.db`. Returns `(TempDir, data_dir, db_path, Connection)`.
    fn setup() -> (TempDir, PathBuf, PathBuf, Connection) {
        let tmp = TempDir::new().unwrap();
        let data_dir = tmp.path().to_path_buf();
        let db_path = data_dir.join("rnotes.db");
        let conn = Connection::open(&db_path).unwrap();
        conn.execute_batch(
            "PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA synchronous = NORMAL;",
        )
        .unwrap();
        crate::db::schema::run_migrations(&conn).unwrap();
        (tmp, data_dir, db_path, conn)
    }

    #[test]
    fn test_is_valid_timestamp_key() {
        assert!(is_valid_timestamp_key("20240115_103000"));
        assert!(!is_valid_timestamp_key("20240115-103000"));
        assert!(!is_valid_timestamp_key("short"));
        assert!(!is_valid_timestamp_key("20240115_10300X"));
    }

    #[test]
    fn test_secs_to_timestamp() {
        // 2024-01-15 10:30:00 UTC = 1705314600
        let ts = secs_to_timestamp(1_705_314_600);
        assert_eq!(ts, "20240115_103000");
    }

    #[test]
    fn test_filename_to_display_timestamp() {
        assert_eq!(
            filename_to_display_timestamp("20240115_103000"),
            "2024-01-15T10:30:00"
        );
    }

    #[test]
    fn test_create_backup_produces_file() {
        let (_tmp, data_dir, db_path, conn) = setup();

        let info = create_backup(&conn, &db_path, &data_dir).unwrap();

        assert!(info.filename.starts_with(BACKUP_PREFIX));
        assert!(info.filename.ends_with(BACKUP_EXT));
        assert!(std::path::Path::new(&info.path).exists());
        assert!(info.size_bytes > 0);
    }

    #[test]
    fn test_retention_keeps_at_most_5_backups() {
        let (_tmp, data_dir, db_path, _conn) = setup();

        // Create 7 backups by manipulating files directly (timestamps must differ).
        let dir = backups_dir(&data_dir).unwrap();
        for i in 0u64..7 {
            // Use distinct fake timestamps so sorting is deterministic.
            let ts = secs_to_timestamp(1_700_000_000 + i * 100);
            let name = format!("{}{}{}", BACKUP_PREFIX, ts, BACKUP_EXT);
            std::fs::copy(&db_path, dir.join(&name)).unwrap();
        }

        // Enforce retention explicitly.
        enforce_retention(&dir).unwrap();

        let remaining = collect_backup_entries(&dir).unwrap();
        assert_eq!(remaining.len(), MAX_BACKUPS);
    }

    #[test]
    fn test_retention_after_create_backup() {
        let (_tmp, data_dir, db_path, conn) = setup();

        // Pre-populate 5 old backups.
        let dir = backups_dir(&data_dir).unwrap();
        for i in 0u64..5 {
            let ts = secs_to_timestamp(1_700_000_000 + i * 100);
            let name = format!("{}{}{}", BACKUP_PREFIX, ts, BACKUP_EXT);
            std::fs::copy(&db_path, dir.join(&name)).unwrap();
        }

        // A new backup should bring it to 6 then prune back to 5.
        create_backup(&conn, &db_path, &data_dir).unwrap();

        let remaining = collect_backup_entries(&dir).unwrap();
        assert_eq!(remaining.len(), MAX_BACKUPS);
    }

    #[test]
    fn test_list_backups_returns_sorted_newest_first() {
        let (_tmp, data_dir, db_path, _conn) = setup();

        let dir = backups_dir(&data_dir).unwrap();
        for i in 0u64..3 {
            let ts = secs_to_timestamp(1_700_000_000 + i * 100);
            let name = format!("{}{}{}", BACKUP_PREFIX, ts, BACKUP_EXT);
            std::fs::copy(&db_path, dir.join(&name)).unwrap();
        }

        let infos = list_backups(&data_dir).unwrap();
        assert_eq!(infos.len(), 3);
        // Newest first: timestamps should be descending.
        assert!(infos[0].timestamp > infos[1].timestamp);
        assert!(infos[1].timestamp > infos[2].timestamp);
    }

    #[test]
    fn test_list_backups_empty_dir() {
        let (_tmp, data_dir, _db_path, _conn) = setup();
        let infos = list_backups(&data_dir).unwrap();
        assert!(infos.is_empty());
    }
}
