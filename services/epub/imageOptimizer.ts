import { Directory, File } from 'expo-file-system';

const IS_DEV = process.env.NODE_ENV === "development";

export interface ImageOptimizationResult {
  optimized: number;
  skipped: number;
  failed: number;
}

export async function optimizeImages(
  _basePath: string,
  _options: { removeAudio?: boolean } = {}
): Promise<{ optimized: number; removed: number }> {
  if (IS_DEV) console.log("[ImageOptimizer] Skipping optimization (expo-image-manipulator not available)");
  return { optimized: 0, removed: 0 };
}

export async function getFolderSize(_path: string): Promise<number> {
  return 0;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export async function compressImage(
  _imagePath: string,
  _outputPath: string,
  _options?: { maxWidth?: number; maxHeight?: number; quality?: number }
): Promise<boolean> {
  if (IS_DEV) console.log("[ImageOptimizer] Compression skipped - using original image");
  return false;
}
