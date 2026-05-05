use std::path::Path;

use tauri::AppHandle;
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::services::config_service;

/// Save raw bytes to `assets/{note_id}/{uuid}.{ext}` inside the app data dir.
/// Returns the relative path: `assets/{note_id}/{uuid}.{ext}`.
pub fn save_asset(
    app: &AppHandle,
    note_id: &str,
    filename: &str,
    data: Vec<u8>,
) -> AppResult<String> {
    let data_dir = config_service::resolve_data_dir(app)?;
    let note_assets_dir = data_dir.join("assets").join(note_id);
    std::fs::create_dir_all(&note_assets_dir)?;

    let ext = Path::new(filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("bin");

    let unique_name = format!("{}.{}", Uuid::now_v7(), ext);
    let file_path = note_assets_dir.join(&unique_name);
    std::fs::write(&file_path, data)?;

    Ok(format!("assets/{}/{}", note_id, unique_name))
}

/// Read file bytes from a relative asset path.
#[allow(dead_code)]
pub fn read_asset(app: &AppHandle, asset_path: &str) -> AppResult<Vec<u8>> {
    let data_dir = config_service::resolve_data_dir(app)?;
    let full_path = data_dir.join(asset_path);

    if !full_path.exists() {
        return Err(AppError::NotFound(format!(
            "asset not found: {}",
            asset_path
        )));
    }

    Ok(std::fs::read(full_path)?)
}

/// Delete all assets for a note (call when permanently deleting a note).
#[allow(dead_code)]
pub fn delete_note_assets(app: &AppHandle, note_id: &str) -> AppResult<()> {
    let data_dir = config_service::resolve_data_dir(app)?;
    let note_assets_dir = data_dir.join("assets").join(note_id);

    if note_assets_dir.exists() {
        std::fs::remove_dir_all(note_assets_dir)?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    // Asset service functions depend on AppHandle which requires a running Tauri app.
    // Integration tests for this service are covered by manual testing and e2e tests.
    // Unit-testable parts (path logic) are straightforward.
}
