import { cacheDirectory } from 'expo-file-system/legacy';
import { File, Directory } from 'expo-file-system';
import { DOMParser } from 'xmldom';
import { unzipEPUB } from './unzipService';
import { getDBConnection } from '../storage/db-service';
import { normalizeMoodleUrl, normalizeFilePath, stripFileProtocol, ensureFileProtocol } from '../utils/urlNormalizer';

const IS_DEV = process.env.NODE_ENV === "development";

interface ParsedOPF {
  title?: string;
  author?: string;
  spine: string[];
  opfPath: string;
  opfDir: string;
  coverPath?: string;
}

interface EPUBChapterDB {
  id: number;
  book_id: number;
  chapter_index: number;
  chapter_title: string;
  content: string;
}

interface EPUBLoadResult {
  bookId: number;
  parsed: ParsedOPF;
  localPath: string;
  chapters: EPUBChapterDB[];
  isOffline: boolean;
  size: number;
}

interface EPUBMetadata {
  title: string;
  author?: string;
  sourceUrl: string;
  totalChapters: number;
  localPath: string;
  downloadedAt: number;
  size: number;
}

const loadingPromises = new Map<string, Promise<EPUBLoadResult>>();

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

async function verifyFileExists(uri: string, maxRetries: number = 10, delayMs: number = 500): Promise<{ exists: boolean; size?: number }> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const file = new File(uri);
      if (file.exists) {
        if (IS_DEV) console.log(`[EPUBLoader] File verified on attempt ${i + 1}: ${uri}`);
        return { exists: true };
      }
      if (IS_DEV) console.log(`[EPUBLoader] Retry ${i + 1}/${maxRetries}: file not ready`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    } catch (err) {
      if (IS_DEV) console.log(`[EPUBLoader] Retry ${i + 1} error:`, err);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  if (IS_DEV) console.log(`[EPUBLoader] File NOT found after ${maxRetries} retries: ${uri}`);
  return { exists: false };
}

async function saveMetadataToDB(metadata: EPUBMetadata): Promise<number> {
  try {
    const db = await getDBConnection();
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS epub_books(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        author TEXT,
        source_url TEXT UNIQUE,
        local_path TEXT,
        total_chapters INTEGER DEFAULT 0,
        downloaded_at INTEGER,
        size INTEGER DEFAULT 0
      );
    `);
    await db.runAsync(
      `INSERT OR REPLACE INTO epub_books(title, author, source_url, local_path, total_chapters, downloaded_at, size) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [metadata.title, metadata.author || null, metadata.sourceUrl, metadata.localPath, metadata.totalChapters, metadata.downloadedAt, metadata.size]
    );
    const result = await db.getFirstAsync<{ id: number }>(`SELECT id FROM epub_books WHERE source_url = ?`, [metadata.sourceUrl]);
    return result?.id || 0;
  } catch (err) {
    if (IS_DEV) console.warn('[EPUBLoader] DB save failed:', err);
    return 0;
  }
}

async function getOfflineEPUB(sourceUrl: string): Promise<{ metadata: EPUBMetadata; chapters: EPUBChapterDB[] } | null> {
  try {
    const db = await getDBConnection();
    const result = await db.getFirstAsync<any>(`SELECT * FROM epub_books WHERE source_url = ?`, [sourceUrl]);
    
    if (!result) return null;
    
    const checkUri = ensureFileProtocol(result.local_path);
    const checkDir = new Directory(checkUri);
    if (!checkDir.exists) return null;
    
    const chapters = await db.getAllAsync<EPUBChapterDB>(
      `SELECT * FROM epub_chapters WHERE book_id = ? ORDER BY chapter_index`,
      [result.id]
    );

    if (!chapters || chapters.length === 0) {
      if (IS_DEV) console.log('[EPUBLoader] Offline cache has 0 chapters. Invalidating cache.');
      await db.runAsync(`DELETE FROM epub_books WHERE id = ?`, [result.id]);
      return null;
    }
    
    return {
      metadata: {
        title: result.title,
        author: result.author || undefined,
        sourceUrl: result.source_url,
        totalChapters: result.total_chapters,
        localPath: result.local_path,
        downloadedAt: result.downloaded_at,
        size: result.size,
      },
      chapters,
    };
  } catch (err) {
    if (IS_DEV) console.warn('[EPUBLoader] Offline check failed:', err);
    return null;
  }
}

export async function loadEPUB(url: string, token?: string | null): Promise<EPUBLoadResult> {
  const cacheKey = simpleHash(url);
  
  if (IS_DEV) {
    console.log('[EPUBLoader] ===== START =====');
    console.log('[EPUBLoader] URL:', url.substring(0, 80));
  }
  
  if (loadingPromises.has(cacheKey)) {
    if (IS_DEV) console.log('[EPUBLoader] Reusing existing promise');
    return loadingPromises.get(cacheKey)!;
  }
  
  const loadPromise = doLoadEPUB(url, token, cacheKey);
  loadingPromises.set(cacheKey, loadPromise);
  
  try {
    return await loadPromise;
  } finally {
    loadingPromises.delete(cacheKey);
  }
}

async function doLoadEPUB(url: string, token: string | null | undefined, cacheKey: string): Promise<EPUBLoadResult> {
  const normalized = normalizeMoodleUrl(url, token);
  const cleanUrl = normalized.url;
  
  if (IS_DEV) console.log('[EPUBLoader] Normalized URL:', cleanUrl);
  
  const offline = await getOfflineEPUB(cleanUrl);
  if (offline) {
    if (IS_DEV) console.log('[EPUBLoader] Found offline EPUB:', offline.metadata.title);
    const opfPath = await findOPFPath(offline.metadata.localPath);
    const parsed = await parseOPF(opfPath);
    return {
      bookId: 0,
      parsed,
      localPath: offline.metadata.localPath,
      chapters: offline.chapters,
      isOffline: true,
      size: offline.metadata.size,
    };
  }
  
  if (IS_DEV) console.log('[EPUBLoader] Downloading EPUB...');
  const { realUri, extractDir } = await downloadAndExtractEPUB(cleanUrl, cacheKey);
  
  if (IS_DEV) console.log('[EPUBLoader] Extracting EPUB...');
  const opfPath = await findOPFPath(extractDir);
  const parsed = await parseOPF(opfPath);
  
  if (IS_DEV) console.log('[EPUBLoader] Parsing chapters...');
  const chapters = await parseChapters(parsed, extractDir);
  
  const size = await getFolderSize(extractDir);
  
  const metadata: EPUBMetadata = {
    title: parsed.title || 'Untitled',
    author: parsed.author,
    sourceUrl: cleanUrl,
    totalChapters: parsed.spine.length,
    localPath: extractDir,
    downloadedAt: Date.now(),
    size,
  };
  
  await saveMetadataToDB(metadata);
  
  if (IS_DEV) {
    console.log('[EPUBLoader] ===== COMPLETE =====');
    console.log('[EPUBLoader] Title:', parsed.title);
    console.log('[EPUBLoader] Chapters:', chapters.length);
  }
  
  return {
    bookId: 0,
    parsed,
    localPath: extractDir,
    chapters,
    isOffline: false,
    size,
  };
}

async function downloadAndExtractEPUB(url: string, cacheKey: string): Promise<{ realUri: string; extractDir: string }> {
  const filename = `epub_${cacheKey}.epub`;
  
  const cacheDir = cacheDirectory || '';
  const cleanCacheDir = stripFileProtocol(cacheDir);
  const targetPath = normalizeFilePath(`${cleanCacheDir}${filename}`);
  
  if (IS_DEV) {
    console.log('[EPUBLoader] Download target path:', targetPath);
  }
  
  const existingFile = new File(targetPath);
  let downloadNeeded = true;
  
  if (existingFile.exists) {
    if (IS_DEV) console.log('[EPUBLoader] File exists, checking...');
    const verified = await verifyFileExists(targetPath);
    if (verified.exists) {
      if (IS_DEV) console.log('[EPUBLoader] Using existing file');
      // Do not return here. Just skip the download step.
      downloadNeeded = false;
    }
  }
  
  const targetFile = new File(targetPath);
  
  if (downloadNeeded) {
    // expo-file-system throws on unencoded spaces and other illegal characters
    // Using encodeURI(decodeURI(url)) ensures all chars are encoded but prevents double-encoding
    let safeUrl = url;
    try {
      safeUrl = encodeURI(decodeURI(url));
    } catch {
      safeUrl = url.replace(/ /g, '%20');
    }
    
    if (IS_DEV) console.log('[EPUBLoader] Downloading from:', safeUrl);
    const downloadPromise = File.downloadFileAsync(safeUrl, targetFile);
    
    let lastLoggedProgress = 0;
    const progressInterval = setInterval(async () => {
      if (targetFile.exists) {
        const currentSize = targetFile.size;
        if (IS_DEV && currentSize > 0) {
          const estimatedPercent = Math.min(95, Math.round((currentSize / (164 * 1024 * 1024)) * 100));
          if (estimatedPercent > lastLoggedProgress) {
            console.log(`[EPUBLoader] Download: ${estimatedPercent}%`);
            lastLoggedProgress = estimatedPercent;
          }
        }
      }
    }, 1000);
    
    try {
      await downloadPromise;
      clearInterval(progressInterval);
      if (IS_DEV) console.log('[EPUBLoader] Download: 100%');
    } catch (err) {
      clearInterval(progressInterval);
      throw new Error(`Download failed: ${err}`);
    }
  }
  
  const realUri = targetFile.uri;
  if (IS_DEV) console.log('[EPUBLoader] Real URI from download:', realUri);
  
  const verified = await verifyFileExists(realUri);
  if (!verified.exists) {
    throw new Error('Downloaded file not found after retries');
  }
  
  if (IS_DEV) console.log('[EPUBLoader] URI for unzip:', realUri);
  
  const extractDir = normalizeFilePath(`${cleanCacheDir}extracted_${cacheKey}/`);
  
  if (IS_DEV) console.log('[EPUBLoader] Extract dir:', extractDir);
  
  await unzipEPUB(realUri, extractDir);
  
  if (IS_DEV) console.log('[EPUBLoader] Extraction complete');
  
  return { realUri, extractDir };
}

async function findOPFPath(basePath: string): Promise<string> {
  const cleanBase = stripFileProtocol(basePath);
  const containerPath = `${cleanBase}/META-INF/container.xml`;
  const containerFile = new File(normalizeFilePath(containerPath));
  
  if (!containerFile.exists) {
    throw new Error('Invalid EPUB: missing META-INF/container.xml');
  }
  
  const xml = await containerFile.text();
  const match = xml.match(/full-path="([^"]+)"/);
  
  if (!match) {
    throw new Error('OPF path not found');
  }
  
  return normalizeFilePath(`${cleanBase}/${match[1]}`);
}

async function parseOPF(opfPath: string): Promise<ParsedOPF> {
  const opfFile = new File(opfPath);
  if (!opfFile.exists) {
    throw new Error('OPF file not found');
  }
  
  const xml = await opfFile.text();
  const doc = new DOMParser().parseFromString(xml, 'text-xml');
  
  const manifestItems = doc.getElementsByTagName('item');
  const spineItems = doc.getElementsByTagName('itemref');
  
  const manifestMap: Record<string, string> = {};
  
  for (let i = 0; i < manifestItems.length; i++) {
    const item = manifestItems[i];
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    if (id && href) manifestMap[id] = href;
  }
  
  const spine: string[] = [];
  for (let i = 0; i < spineItems.length; i++) {
    const itemref = spineItems[i];
    const idref = itemref.getAttribute('idref');
    if (idref && manifestMap[idref]) {
      spine.push(manifestMap[idref]);
    }
  }
  
  const metadata = doc.getElementsByTagName('metadata')[0];
  let title: string | undefined;
  let author: string | undefined;
  
  if (metadata) {
    const dcTitle = metadata.getElementsByTagName('dc:title')[0] || metadata.getElementsByTagName('title')[0];
    const dcCreator = metadata.getElementsByTagName('dc:creator')[0] || metadata.getElementsByTagName('creator')[0];
    title = dcTitle?.textContent;
    author = dcCreator?.textContent;
  }
  
  const cleanOpfDir = stripFileProtocol(opfPath).substring(0, stripFileProtocol(opfPath).lastIndexOf('/'));
  
  return { title, author, spine, opfPath, opfDir: cleanOpfDir };
}

async function parseChapters(parsed: ParsedOPF, basePath: string): Promise<EPUBChapterDB[]> {
  const chapters: EPUBChapterDB[] = [];
  
  for (let i = 0; i < parsed.spine.length; i++) {
    const relativePath = parsed.spine[i];
    // spine paths are relative to the OPF directory, not the base directory
    const chapterPath = normalizeFilePath(`${parsed.opfDir}/${relativePath}`);
    
    const chapterFile = new File(chapterPath);
    if (chapterFile.exists) {
      const content = await chapterFile.text();
      chapters.push({
        id: i,
        book_id: 0,
        chapter_index: i,
        chapter_title: `Chapter ${i + 1}`,
        content,
      });
    }
  }
  
  return chapters;
}

async function getFolderSize(path: string): Promise<number> {
  try {
    const cleanPath = stripFileProtocol(path);
    const dir = new Directory(normalizeFilePath(cleanPath));
    if (!dir.exists) return 0;
    
    let totalSize = 0;
    
    async function calculateSize(currentDir: Directory): Promise<void> {
      const entries = currentDir.list();
      for (const entry of entries) {
        if (entry instanceof File) {
          totalSize += 1000;
        } else if (entry instanceof Directory) {
          await calculateSize(entry);
        }
      }
    }
    
    await calculateSize(dir);
    return totalSize;
  } catch {
    return 0;
  }
}
