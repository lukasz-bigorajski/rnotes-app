import { invoke } from "@tauri-apps/api/core";

export interface BackupInfo {
  filename: string;
  path: string;
  size_bytes: number;
  /** ISO-8601 timestamp, e.g. "2024-01-15T10:30:00" */
  timestamp: string;
}

/** Possible values returned by {@link getAppHealth}. */
export type AppHealth = "ok" | "missing" | "corrupted" | "recovered";

/** Return metadata for all available backup files, newest first. */
export function listBackups(): Promise<BackupInfo[]> {
  return invoke("list_backups");
}

/** Restore the database from the given backup file path. */
export function restoreFromBackup(path: string): Promise<void> {
  return invoke("restore_from_backup", { backupPath: path });
}

/** Return the DB health status reported at startup. */
export function getAppHealth(): Promise<AppHealth> {
  return invoke("get_app_health");
}

/** Create a manual backup immediately. */
export function createBackup(): Promise<BackupInfo> {
  return invoke("create_backup");
}

export type ImportMode = "replace" | "add_missing" | "merge";

/**
 * Export notes, tasks and assets to the given absolute file path.
 * The path should end with `.rnotes`.
 *
 * When `rootFolderId` is provided, only that folder and all its descendants
 * are exported. When omitted, the entire database is exported.
 */
export function exportAll(path: string, rootFolderId?: string): Promise<void> {
  return invoke("export_all", { path, rootFolderId: rootFolderId ?? null });
}

/**
 * Import data from a `.rnotes` archive.
 * `mode` = "replace"     — wipe all existing data, then insert archive contents.
 * `mode` = "add_missing" — only insert rows whose ID does not already exist.
 * `mode` = "merge"       — upsert: overwrite existing rows and insert new ones.
 */
export function importAll(path: string, mode: ImportMode): Promise<void> {
  return invoke("import_all", { path, mode });
}
