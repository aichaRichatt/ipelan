import { Paths, Directory, File } from 'expo-file-system';

export interface DownloadProgress {
  totalBytesWritten: number;
  totalBytesExpectedToWrite: number;
}

export interface DownloadResult {
  uri: string;
  status: number;
}

class DownloadService {
  private baseDir: Directory;

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
    const filename = this.getFilenameFromUrl(url);
    const localFile = new File(this.baseDir, filename);
    
    await this.ensureBaseDir();

    try {
      const result = await File.downloadFileAsync(url, localFile);
      
      return {
        uri: localFile.uri,
        status: 200,
      };
    } catch (error) {
      console.warn('Download failed:', error);
      return {
        uri: localFile.uri,
        status: 0,
      };
    }
  }

  async downloadEPUB(epubUrl: string): Promise<string> {
    const filename = 'lesson.epub';
    const localPath = this.getLocalPath(epubUrl, filename);
    const localFile = new File(this.baseDir, filename);
    
    if (localFile.exists) {
      return localPath;
    }

    await this.ensureBaseDir();
    
    try {
      await File.downloadFileAsync(epubUrl, localFile);
    } catch (error) {
      console.warn('Failed to download EPUB:', error);
    }
    
    return localPath;
  }

  async downloadAudio(audioUrl: string): Promise<string> {
    const filename = this.getFilenameFromUrl(audioUrl);
    const audioDir = new Directory(this.baseDir, 'audio');
    
    if (!audioDir.exists) {
      await audioDir.create();
    }

    const localFile = new File(audioDir, filename);
    
    if (localFile.exists) {
      return localFile.uri;
    }

    try {
      await File.downloadFileAsync(audioUrl, localFile);
    } catch (error) {
      console.warn('Failed to download audio:', error);
    }
    
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
