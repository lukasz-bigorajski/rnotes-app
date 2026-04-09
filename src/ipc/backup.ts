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
