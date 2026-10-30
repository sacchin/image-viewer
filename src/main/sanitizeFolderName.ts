/**
 * Turn a gallery title into a folder name that is safe on Windows (and other
 * platforms). Kept free of Electron imports so it can be unit tested directly.
 *
 * Rules (see doc/adr/1-6.md):
 *  - Windows-forbidden characters are replaced with '_'
 *  - runs of whitespace/underscores collapse to a single '_'
 *  - leading/trailing whitespace and dots are removed
 *  - the result is capped at 200 characters
 *  - an empty result falls back to `gallery_<timestamp>`
 */
export const MAX_FOLDER_NAME_LENGTH = 200;

export function sanitizeFolderName(title: string): string {
  // Replace Windows forbidden characters
  let safe = title.replace(/[<>:"/\\|?*]/g, '_');
  // Replace consecutive spaces or underscores with single underscore
  safe = safe.replace(/[\s_]+/g, '_');
  // Remove leading/trailing whitespace and dots
  safe = safe.trim().replace(/^\.+|\.+$/g, '');
  // Limit length
  if (safe.length > MAX_FOLDER_NAME_LENGTH) {
    safe = safe.substring(0, MAX_FOLDER_NAME_LENGTH);
  }
  // Fallback if empty
  return safe || `gallery_${Date.now()}`;
}
