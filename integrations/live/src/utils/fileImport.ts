export const MAX_IMAGE_IMPORT_BYTES = 3 * 1024 * 1024;
export const MAX_FONT_IMPORT_BYTES = 2 * 1024 * 1024;
export const MAX_AUDIO_IMPORT_BYTES = 6 * 1024 * 1024;

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });
}

export function createAssetId(): string {
  return `asset_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
