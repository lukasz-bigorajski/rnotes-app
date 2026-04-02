import { invoke, convertFileSrc } from "@tauri-apps/api/core";

/**
 * Save an image file to the note's asset directory.
 * @param noteId - The note ID (used as folder name)
 * @param filename - Original filename (used to derive extension)
 * @param data - Raw file bytes
 * @returns Relative asset path: `assets/{note_id}/{uuid}.{ext}`
 */
export function saveImage(params: { noteId: string; filename: string; data: Uint8Array }): Promise<string> {
  return invoke("save_image", {
    noteId: params.noteId,
    filename: params.filename,
    data: Array.from(params.data),
  });
}

/**
 * Convert a relative asset path to an absolute URL the WebView can load.
 * @param assetPath - Relative path: `assets/{note_id}/{filename}`
 * @returns `asset://localhost/...` URL (via Tauri's convertFileSrc for correct encoding)
 */
export async function getImageUrl(assetPath: string): Promise<string> {
  const absolutePath = await invoke<string>("get_image_url", { assetPath });
  return convertFileSrc(absolutePath);
}
