use tauri::AppHandle;

use crate::services::assets as asset_service;

const ALLOWED_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "gif", "webp", "svg"];

fn is_allowed_image_ext(filename: &str) -> bool {
    let ext = std::path::Path::new(filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    ALLOWED_EXTENSIONS.contains(&ext.as_str())
}

/// Save an image file to the note's asset directory.
/// Returns the relative asset path (e.g. `assets/{note_id}/{uuid}.png`).
#[tauri::command]
pub fn save_image(
    app: AppHandle,
    note_id: String,
    filename: String,
    data: Vec<u8>,
) -> Result<String, String> {
    if !is_allowed_image_ext(&filename) {
        return Err(format!("File type not allowed: {}", filename));
    }
    asset_service::save_asset(&app, &note_id, &filename, data).map_err(|e| e.to_string())
}

/// Convert a relative asset path to an absolute filesystem path.
/// The frontend uses Tauri's `convertFileSrc` to turn this into a loadable asset:// URL.
#[tauri::command]
pub fn get_image_url(app: AppHandle, asset_path: String) -> Result<String, String> {
    use crate::services::config_service;

    let data_dir = config_service::resolve_data_dir(&app).map_err(|e| e.to_string())?;
    let full_path = data_dir.join(&asset_path);
    Ok(full_path.to_string_lossy().to_string())
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetInfo {
    pub name: String,
    pub size: u64,
    pub absolute_path: String,
}

/// Return metadata for a relative asset path: filename, size in bytes, and absolute path.
#[tauri::command]
pub fn get_asset_info(app: AppHandle, asset_path: String) -> Result<AssetInfo, String> {
    use crate::services::config_service;

    let data_dir = config_service::resolve_data_dir(&app).map_err(|e| e.to_string())?;
    let full_path = data_dir.join(&asset_path);

    let name = full_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();

    let size = std::fs::metadata(&full_path)
        .map(|m| m.len())
        .unwrap_or(0);

    Ok(AssetInfo {
        name,
        size,
        absolute_path: full_path.to_string_lossy().to_string(),
    })
}
