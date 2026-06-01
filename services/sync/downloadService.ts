import { Paths, Directory, File } from 'expo-file-system';

export interface DownloadProgress {
  totalBytesWritten: number;
  totalBytesExpectedToWrite: number;
}

export interface DownloadResult {
  uri: string;
  status: number;
}

const MAX_CACHE_BYTES = 500 * 1024 * 1024; // 500 MB

class DownloadService {
  private baseDir: Directory;
  private inFlight = new Map<string, Promise<DownloadResult>>();

  constructor() {
    this.baseDir = new Directory(Paths.cache, 'content');
    this.ensureBaseDir();
  }

  private async ensureBaseDir(): Promise<void> {
    if (!this.baseDir.exists) {
      await this.baseDir.create();
    }
  }

  getLocalPath(url: string, filename?: string): string {
    const name = filename || this.getFilenameFromUrl(url);
    return new File(this.baseDir, name).uri;
  }

  private getFilenameFromUrl(url: string): string {
    const parts = url.split('/');
    return parts[parts.length - 1] || 'file';
  }

  async isDownloaded(url: string): Promise<boolean> {
    const name = this.getFilenameFromUrl(url);
    const file = new File(this.baseDir, name);
    return file.exists;
  }

  async getLocalUri(url: string): Promise<string | null> {
    if (await this.isDownloaded(url)) {
      const name = this.getFilenameFromUrl(url);
      return new File(this.baseDir, name).uri;
    }
    return null;
  }

  async downloadFile(url: string): Promise<DownloadResult> {
    // Strip token from cache key so re-authenticated URLs hit the same cache entry
    const cacheKey = url.split('?')[0];

    const existing = this.inFlight.get(cacheKey);
    if (existing) return existing;

    const promise = this._downloadFile(url, cacheKey);
    this.inFlight.set(cacheKey, promise);
    try {
      return await promise;
    } finally {
      this.inFlight.delete(cacheKey);
    }
  }

  private async evictToFit(neededBytes: number): Promise<void> {
    if (!this.baseDir.exists) return;
    try {
      type Entry = { file: File; size: number; mtime: number };
      const entries: Entry[] = [];
      let total = 0;

      for (const entry of this.baseDir.list()) {
        if (!(entry instanceof File)) continue;
        try {
          const info = await entry.info();
          const size = (info as any).size ?? 0;
          const mtime = (info as any).modificationTime ?? (info as any).lastModified ?? 0;
          entries.push({ file: entry, size, mtime });
          total += size;
        } catch { /* skip unreadable entries */ }
      }

      if (total + neededBytes <= MAX_CACHE_BYTES) return;

      // Delete oldest files first until we have enough headroom
      entries.sort((a, b) => a.mtime - b.mtime);
      for (const { file, size } of entries) {
        if (total + neededBytes <= MAX_CACHE_BYTES) break;
        try { await file.delete(); total -= size; } catch { /* ignore */ }
      }
    } catch { /* non-fatal */ }
  }

  private async _downloadFile(url: string, cacheKey: string): Promise<DownloadResult> {
    const filename = this.getFilenameFromUrl(cacheKey);
    const localFile = new File(this.baseDir, filename);

    await this.ensureBaseDir();

    if (localFile.exists) {
      return { uri: localFile.uri, status: 200 };
    }

    await this.evictToFit(0);
    await File.downloadFileAsync(url, localFile);
    return { uri: localFile.uri, status: 200 };
  }

  async downloadEPUB(epubUrl: string): Promise<string> {
    const filename = 'lesson.epub';
    const localFile = new File(this.baseDir, filename);

    if (localFile.exists) {
      return localFile.uri;
    }

    await this.ensureBaseDir();
    await File.downloadFileAsync(epubUrl, localFile);
    return localFile.uri;
  }

  async downloadAudio(audioUrl: string): Promise<string> {
    const cacheKey = audioUrl.split('?')[0];
    const filename = this.getFilenameFromUrl(cacheKey);

    await this.ensureBaseDir();

    const localFile = new File(this.baseDir, filename);

    if (localFile.exists) {
      return localFile.uri;
    }

    await this.evictToFit(0);
    await File.downloadFileAsync(audioUrl, localFile);
    return localFile.uri;
  }

  async deleteFile(url: string): Promise<void> {
    const filename = this.getFilenameFromUrl(url);
    const file = new File(this.baseDir, filename);
    
    if (file.exists) {
      await file.delete();
    }
  }

  async clearAll(): Promise<void> {
    if (this.baseDir.exists) {
      await this.baseDir.delete();
    }
    await this.ensureBaseDir();
  }

  async copyLocalEPUB(sourcePath: string): Promise<string> {
    const filename = sourcePath.split('/').pop() || 'local.epub';
    const targetFile = new File(this.baseDir, filename);
    
    await this.ensureBaseDir();
    
    if (targetFile.exists) {
      console.log('[DownloadService] Local EPUB already exists');
      return targetFile.uri;
    }
    
    try {
      const sourceFile = new File(sourcePath);
      if (!sourceFile.exists) {
        throw new Error('Source EPUB file not found: ' + sourcePath);
      }
      
      console.log('[DownloadService] Copying local EPUB to cache...');
      await sourceFile.copy(targetFile);
      console.log('[DownloadService] EPUB copied successfully');
      
      return targetFile.uri;
    } catch (error) {
      console.error('[DownloadService] Failed to copy local EPUB:', error);
      throw error;
    }
  }

  getLocalEPUBPath(filename: string = 'libretest.epub'): string {
    return new File(this.baseDir, filename).uri;
  }

  async localEPUBExists(filename: string = 'libretest.epub'): Promise<boolean> {
    const file = new File(this.baseDir, filename);
    return file.exists;
  }

  async getStorageInfo(): Promise<{ used: number; available: number }> {
    let used = 0;
    
    if (this.baseDir.exists) {
      try {
        const files = this.baseDir.list();
        for (const entry of files) {
          if (entry instanceof File) {
            try {
              const info = await entry.info();
              used += info.size || 0;
            } catch {
              // Ignore
            }
          }
        }
      } catch {
        // Ignore
      }
    }

    return { used, available: Paths.availableDiskSpace };
  }
}

export const downloadService = new DownloadService();
