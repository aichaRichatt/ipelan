import { unzip } from 'react-native-zip-archive';
import { Directory, File } from 'expo-file-system';

const IS_DEV = process.env.NODE_ENV === "development";

if (IS_DEV) {
  console.log('[UnzipNative] Module check:', typeof unzip);
}

if (typeof unzip !== 'function') {
  console.error('[UnzipNative] FATAL: react-native-zip-archive not initialized');
  console.error('[UnzipNative] Solution: Run "npx expo prebuild" then "npx expo run:android"');
  console.error('[UnzipNative] Note: This module requires native build, NOT Expo Go');
}

function ensureFileProtocol(path: string): string {
  if (path.startsWith('file://')) return path;
  if (path.startsWith('/')) return `file://${path}`;
  return `file:///${path}`;
}

function stripFileProtocol(path: string): string {
  if (path.startsWith('file://')) return path.substring(7);
  return path;
}

export async function unzipEPUB(zipPath: string, outputDir: string): Promise<string> {
  if (IS_DEV) console.log('[UnzipNative] Starting extraction...');

  if (typeof unzip !== 'function') {
    throw new Error(
      'Native unzip module not available. ' +
      'If using Expo Go: react-native-zip-archive requires Dev Client. ' +
      'Solution: npx expo prebuild && npx expo run:android'
    );
  }

  const sourcePath = stripFileProtocol(ensureFileProtocol(zipPath));
  const targetPath = stripFileProtocol(ensureFileProtocol(outputDir));

  if (IS_DEV) console.log('[UnzipNative] Source:', sourcePath);
  if (IS_DEV) console.log('[UnzipNative] Target:', targetPath);

  const zipFile = new File(ensureFileProtocol(zipPath));
  if (IS_DEV) console.log('[UnzipNative] File size:', (zipFile.size / (1024 * 1024)).toFixed(2), 'MB');

  const outputDirectory = new Directory(ensureFileProtocol(outputDir));
  if (outputDirectory.exists) {
    outputDirectory.delete();
  }
  outputDirectory.create();

  if (IS_DEV) console.log('[UnzipNative] Extracting with native unzip...');
  const resultPath = await unzip(sourcePath, targetPath);

  if (IS_DEV) console.log('[UnzipNative] Extraction complete:', resultPath);
  return ensureFileProtocol(resultPath);
}

export async function findEntryHtml(baseDir: string): Promise<string> {
  const absoluteBaseDir = ensureFileProtocol(baseDir);
  const baseDirectory = new Directory(absoluteBaseDir);

  if (!baseDirectory.exists) {
    throw new Error('Directory does not exist: ' + absoluteBaseDir);
  }

  async function search(dir: Directory, depth: number = 0): Promise<string | null> {
    if (depth > 5) return null;

    try {
      const entries = dir.list();

      for (const entry of entries) {
        const lower = entry.name.toLowerCase();
        
        if (lower.endsWith('.html') || lower.endsWith('.xhtml')) {
          if (!lower.includes('toc') && !lower.includes('nav')) {
            return entry.uri;
          }
        }

        if (entry instanceof Directory) {
          const result = await search(entry, depth + 1);
          if (result) return result;
        }
      }
    } catch (err) {
      if (IS_DEV) console.warn('[Unzip] Search error:', dir.uri);
    }
    return null;
  }

  const result = await search(baseDirectory);
  if (!result) {
    throw new Error('No HTML entry found in EPUB');
  }
  return result;
}

export async function unzipArchive(archivePath: string, outputDir: string): Promise<string> {
  return unzipEPUB(archivePath, outputDir);
}

export async function getEPUBBasePath(epubPath: string): Promise<string> {
  const clean = stripFileProtocol(epubPath);
  return clean.substring(0, clean.lastIndexOf('/'));
}

export async function findFirstHtml(basePath: string): Promise<string | null> {
  try {
    return await findEntryHtml(basePath);
  } catch {
    return null;
  }
}

export async function findFileInFolder(
  basePath: string,
  matcher: (name: string) => boolean
): Promise<string | null> {
  const absoluteBasePath = ensureFileProtocol(basePath);
  const baseDir = new Directory(absoluteBasePath);

  if (!baseDir.exists) return null;

  async function search(dir: Directory): Promise<string | null> {
    try {
      const entries = dir.list();

      for (const entry of entries) {
        const lower = entry.name.toLowerCase();
        if (matcher(lower)) {
          return entry.uri;
        } else if (entry instanceof Directory) {
          const result = await search(entry);
          if (result) return result;
        }
      }
    } catch (err) {
      if (IS_DEV) console.warn('[Unzip] Search error:', dir.uri);
    }
    return null;
  }

  return await search(baseDir);
}

export async function cleanOldEPUBs(cacheDir: string, maxEpubs: number = 5): Promise<void> {
  try {
    const absoluteCacheDir = ensureFileProtocol(cacheDir);
    const cacheDirectory = new Directory(absoluteCacheDir);

    if (!cacheDirectory.exists) return;

    const entries = cacheDirectory.list();
    const epubDirs = entries.filter(e => 
      e instanceof Directory && e.name.startsWith('extracted_')
    ) as Directory[];

    if (epubDirs.length > maxEpubs) {
      const dirsWithTime: { dir: Directory; mtime: number }[] = [];

      for (const dir of epubDirs) {
        const info = dir.info();
        if (info.exists && info.modificationTime) {
          dirsWithTime.push({
            dir,
            mtime: info.modificationTime,
          });
        }
      }

      dirsWithTime.sort((a, b) => a.mtime - b.mtime);

      const toDelete = dirsWithTime.slice(0, dirsWithTime.length - maxEpubs);

      for (const item of toDelete) {
        item.dir.delete();
        if (IS_DEV) console.log('[Unzip] Cleaned old EPUB:', item.dir.name);
      }
    }
  } catch (err) {
    if (IS_DEV) console.warn('[Unzip] Cache cleanup error:', err);
  }
}
