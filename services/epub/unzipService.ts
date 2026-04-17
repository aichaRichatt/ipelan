import { NativeModules } from 'react-native';
import { Directory, File } from 'expo-file-system';
import {
  readAsStringAsync,
  writeAsStringAsync,
  makeDirectoryAsync,
  deleteAsync,
  EncodingType,
} from 'expo-file-system/legacy';
import JSZip from 'jszip';

const IS_DEV = process.env.NODE_ENV === "development";

const RNZipArchive = NativeModules.RNZipArchive;
const hasNativeUnzip = RNZipArchive != null;

if (IS_DEV) {
  console.log('[UnzipService] Native module available:', hasNativeUnzip);
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

async function nativeUnzip(sourcePath: string, targetPath: string): Promise<string> {
  const normalizeFilePath = (p: string) =>
    p.startsWith("file://") ? p.slice(7) : p;

  const result = await RNZipArchive.unzip(
    normalizeFilePath(sourcePath),
    normalizeFilePath(targetPath),
    "UTF-8"
  );
  return result;
}

async function jszipUnzip(zipUri: string, outputDir: string): Promise<string> {
  const safeZipPath = ensureFileProtocol(zipUri);
  const safeOutputDir = ensureFileProtocol(outputDir);

  if (IS_DEV) console.log('[UnzipService] JSZip: Reading file...');

  const base64Data = await readAsStringAsync(safeZipPath, {
    encoding: EncodingType.Base64,
  });

  if (IS_DEV) console.log('[UnzipService] JSZip: Parsing archive...');

  const zip = await JSZip.loadAsync(base64Data, { base64: true });
  const entries = Object.keys(zip.files);

  if (IS_DEV) console.log('[UnzipService] JSZip: Extracting', entries.length, 'entries...');

  let extracted = 0;
  for (const entryName of entries) {
    const entry = zip.files[entryName];
    const outputPath = `${safeOutputDir}/${entryName}`;

    if (entry.dir) {
      await makeDirectoryAsync(outputPath, { intermediates: true });
    } else {
      const parentDir = outputPath.substring(0, outputPath.lastIndexOf('/'));
      await makeDirectoryAsync(parentDir, { intermediates: true });

      const content = await entry.async('base64');
      await writeAsStringAsync(outputPath, content, {
        encoding: EncodingType.Base64,
      });

      extracted++;
      if (IS_DEV && extracted % 50 === 0) {
        console.log(`[UnzipService] JSZip: ${extracted}/${entries.length} files extracted`);
      }
    }
  }

  if (IS_DEV) console.log('[UnzipService] JSZip: Extraction complete.', extracted, 'files');

  return safeOutputDir;
}

export async function unzipEPUB(zipPath: string, outputDir: string): Promise<string> {
  if (IS_DEV) console.log('[UnzipService] Starting extraction...');

  const sourcePath = stripFileProtocol(ensureFileProtocol(zipPath));
  const targetPath = stripFileProtocol(ensureFileProtocol(outputDir));

  if (IS_DEV) console.log('[UnzipService] Source:', sourcePath);
  if (IS_DEV) console.log('[UnzipService] Target:', targetPath);

  const zipFile = new File(ensureFileProtocol(zipPath));
  const fileSizeMB = zipFile.size / (1024 * 1024);
  if (IS_DEV) console.log('[UnzipService] File size:', fileSizeMB.toFixed(2), 'MB');

  try {
    await deleteAsync(ensureFileProtocol(outputDir), { idempotent: true });
    await makeDirectoryAsync(ensureFileProtocol(outputDir), { intermediates: true });
  } catch (err) {
    if (IS_DEV) console.warn('[UnzipService] Failed to recreate directory:', err);
  }

  if (hasNativeUnzip) {
    if (IS_DEV) console.log('[UnzipService] Using native unzip (fast)');
    try {
      const resultPath = await nativeUnzip(sourcePath, targetPath);
      if (IS_DEV) console.log('[UnzipService] Native extraction complete:', resultPath);
      return ensureFileProtocol(resultPath);
    } catch (err) {
      if (IS_DEV) console.warn('[UnzipService] Native unzip failed, falling back to JSZip:', err);
    }
  } else {
    if (IS_DEV) console.log('[UnzipService] Native module not available (Expo Go). Using JSZip fallback.');
  }

  if (fileSizeMB > 100) {
    if (IS_DEV) console.warn('[UnzipService] WARNING: Large file (' + fileSizeMB.toFixed(0) + 'MB). JSZip may be slow or crash. Consider using a Dev Client build.');
  }

  const resultPath = await jszipUnzip(zipPath, outputDir);
  if (IS_DEV) console.log('[UnzipService] JSZip extraction complete');
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
