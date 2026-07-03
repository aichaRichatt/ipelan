 
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { moodleCall } from '../api/moodleClient';
import { getDBConnection } from '../storage/db-service';
import type { EpubManifest, EpubReadingSection } from './epubServerService';

const IS_DEV = process.env.NODE_ENV === 'development';

const BATCH_SIZE  = 3;
const PRIORITY_N  = 5;

export interface HighlightSegment {
  id: string;
  type: string;
  text: string;
  start: number;
  end: number;
  chapterId: string;
  wordStart: number;
  wordEnd: number;
  sectionId: string;
}

export interface HighlightsData {
  bookId: string | null;
  title: string;
  author: string;
  language: string;
  version: string;
  exportedAt: string;
  chapters: Array<{
    id: string;
    title: string;
    order: number;
    audioFile: string;
    segments: HighlightSegment[];
  }>;
  sectionSegments: Record<string, HighlightSegment[]>;
}

 
export interface DownloadProgress {
  phase      : 'manifest' | 'sections' | 'audio' | 'done';
  current    : number;
  total      : number;
  bookId     : string;
}

export type DownloadProgressCallback = (progress: DownloadProgress) => void;


// Timeout dédié à l'extraction EPUB (PHP process_sync peut prendre 30-90s)
const EPUB_EXTRACT_TIMEOUT_MS = 5 * 60 * 1000; // 5 min

export async function fetchManifestMoodle(
  cmid     : number,
  token    : string,
  options  : {
    timeoutMs?    : number;
    pollIntervalMs?: number;
    onProcessing? : () => void;
    signal?       : AbortSignal;
  } = {}
): Promise<{ manifest: EpubManifest; fileBaseUrl: string }> {
  const { timeoutMs = 10 * 60 * 1000, pollIntervalMs = 3000, onProcessing, signal } = options;
  const deadline = Date.now() + timeoutMs;
  let notifiedProcessing = false;

  // Pré-vérification rapide : si le livre n'existe pas encore, prévenir l'UI
  // immédiatement avant que get_manifest ne bloque pendant l'extraction PHP
  if (!signal?.aborted) {
    try {
      const statusData = await moodleCall('local_ipelan_epub_get_status', { cmid }, token) as any;
      if (!statusData?.exception &&
          (statusData.status === 'not_found' || statusData.status === 'processing')) {
        onProcessing?.();
        notifiedProcessing = true;
        if (IS_DEV) console.log('[EpubDownload] Pre-check: extraction needed for cmid', cmid);
      }
    } catch {
      // Pré-vérification optionnelle — ignorer les erreurs
    }
  }

  let networkRetries = 0;

  while (Date.now() < deadline) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    let data: any;
    try {
      // Timeout long pour get_manifest : process_sync() bloque le PHP pendant l'extraction
      data = await moodleCall(
        'local_ipelan_epub_get_manifest',
        { cmid },
        token,
        EPUB_EXTRACT_TIMEOUT_MS
      );
      networkRetries = 0;
    } catch (err: any) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      // Retry sur erreur réseau transitoire (max 3 tentatives, délai 5s)
      const isNetworkError = err.message?.includes('Network request failed') ||
                             err.message?.includes('Délai de connexion');
      if (isNetworkError && networkRetries < 3) {
        networkRetries++;
        if (IS_DEV) console.log(`[EpubDownload] Network error, retry ${networkRetries}/3`);
        await sleepAbortable(5000, signal);
        continue;
      }
      throw err;
    }

    if (data.exception) {
      throw new Error(data.message || data.exception);
    }

    if (data.status === 'ready' && data.manifest) {
      const manifest: EpubManifest = JSON.parse(data.manifest);
      return { manifest, fileBaseUrl: data.file_base_url || '' };
    }

    if (data.status === 'processing') {
      if (!notifiedProcessing) {
        onProcessing?.();
        notifiedProcessing = true;
      }
      if (IS_DEV) console.log('[EpubDownload] EPUB processing… retrying in', pollIntervalMs, 'ms');
      await sleepAbortable(pollIntervalMs, signal);
      continue;
    }

    if (data.status === 'error') {
      throw new Error(data.error || 'EPUB processing failed on Moodle server');
    }

    throw new Error(`Unexpected manifest status: ${data.status}`);
  }

  throw new Error('[EpubDownload] Timeout waiting for EPUB manifest');
}


export async function fetchHighlightsMoodle(
  cmid: number,
  token: string,
  bookId?: string
): Promise<HighlightsData | null> {
  try {
    const data = await moodleCall('local_ipelan_epub_get_highlighting', { cmid }, token) as any;
    if (data?.exception) return null;
    if (!data?.highlighting_json) return null;

    const parsed: HighlightsData = JSON.parse(data.highlighting_json);
    if (!parsed?.chapters) return null;

    // Build section → segments map
    const sectionSegments: Record<string, HighlightSegment[]> = {};
    for (const ch of parsed.chapters) {
      if (!ch.segments) continue;
      for (const seg of ch.segments) {
        if (!seg.sectionId) continue;
        if (!sectionSegments[seg.sectionId]) sectionSegments[seg.sectionId] = [];
        sectionSegments[seg.sectionId].push(seg);
      }
    }
    parsed.sectionSegments = sectionSegments;

    // Cache offline
    if (bookId) cacheHighlightsOffline(bookId, parsed).catch(() => {});

    if (IS_DEV) console.log(`[EpubDownload] Highlights loaded: ${Object.keys(sectionSegments).length} sections`, Object.keys(sectionSegments));
    return parsed;
  } catch (e) {
    if (IS_DEV) console.warn('[EpubDownload] fetchHighlightsMoodle failed:', e);
    return null;
  }
}

export async function fetchSectionHtmlMoodle(
  cmid         : number,
  sectionIndex : number,
  token        : string,
  inlineCss    = true
): Promise<{ html: string; sectionId: string; audioFiles: string[] }> {
  const data = await moodleCall('local_ipelan_epub_get_section_html', {
    cmid,
    section_index: sectionIndex,
    inline_css   : inlineCss ? 1 : 0,
  }, token) as any;

  if (data.exception) throw new Error(data.message || data.exception);

  return {
    html      : data.html        || '',
    sectionId : data.section_id  || '',
    audioFiles: data.audio_files || [],
  };
}

 
export async function downloadBook(
  cmid      : number,
  token     : string,
  onProgress: DownloadProgressCallback = () => {}
): Promise<void> {
  const bookId = `cmid-${cmid}`;

  // 1. Manifest
  onProgress({ phase: 'manifest', current: 0, total: 1, bookId });
  const { manifest, fileBaseUrl } = await fetchManifestMoodle(cmid, token);
  await cacheManifest(bookId, manifest, fileBaseUrl);
  onProgress({ phase: 'manifest', current: 1, total: 1, bookId });

  const sections      = manifest.readingSections || [];
  const totalSections = sections.length;

  // 2. Sections HTML (priorité = 5 premières, puis le reste)
  onProgress({ phase: 'sections', current: 0, total: totalSections, bookId });

  let downloaded = 0;

  const downloadSection = async (section: EpubReadingSection, idx: number) => {
    if (await isSectionCached(bookId, idx)) {
      downloaded++;
      onProgress({ phase: 'sections', current: downloaded, total: totalSections, bookId });
      return;
    }
    try {
      const { html, sectionId, audioFiles } = await fetchSectionHtmlMoodle(cmid, idx, token, true);
      if (html) {
        await cacheSectionToSQLite(bookId, idx, sectionId, audioFiles, section.text || '', html);
      }
    } catch (e) {
      if (IS_DEV) console.warn(`[EpubDownload] Section ${idx} failed:`, e);
    }
    downloaded++;
    onProgress({ phase: 'sections', current: downloaded, total: totalSections, bookId });
  };

  // Priorité : premières PRIORITY_N sections
  const prioritySections = sections.slice(0, PRIORITY_N);
  for (const [i, s] of prioritySections.entries()) {
    await downloadSection(s, i);
  }

  // Reste en batches
  const remaining = sections.slice(PRIORITY_N);
  for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
    const batch = remaining.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map((s, j) => downloadSection(s, PRIORITY_N + i + j)));
  }

  // 3. Audio (si le livre contient des audios)
  if (manifest.hasAudio && fileBaseUrl) {
    const audioSections = sections.filter(s => s.audioFiles?.length > 0);
    const totalAudio    = audioSections.reduce((n, s) => n + s.audioFiles.length, 0);
    let   downloadedAudio = 0;

    onProgress({ phase: 'audio', current: 0, total: totalAudio, bookId });

    for (const section of audioSections) {
      for (const audioFile of section.audioFiles) {
        try {
          await downloadAudioFile(bookId, audioFile, fileBaseUrl, token);
        } catch (e) {
          if (IS_DEV) console.warn(`[EpubDownload] Audio ${audioFile} failed:`, e);
        }
        downloadedAudio++;
        onProgress({ phase: 'audio', current: downloadedAudio, total: totalAudio, bookId });
      }
    }
  }

  onProgress({ phase: 'done', current: totalSections, total: totalSections, bookId });
  if (IS_DEV) console.log(`[EpubDownload] Book ${bookId} fully downloaded`);
}

 
const HIGHLIGHT_KEY = (bookId: string) => `@epub_highlight_${bookId}`;

export async function cacheHighlightsOffline(
  bookId: string,
  data: HighlightsData
): Promise<void> {
  try {
    await AsyncStorage.setItem(HIGHLIGHT_KEY(bookId), JSON.stringify({ data, cachedAt: Date.now() }));
  } catch (e) {
    if (IS_DEV) console.warn('[EpubDownload] cacheHighlightsOffline failed:', e);
  }
}

export async function getHighlightsOffline(
  bookId: string
): Promise<HighlightsData | null> {
  try {
    const raw = await AsyncStorage.getItem(HIGHLIGHT_KEY(bookId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data?.chapters) return null;
    // Reconstruire sectionSegments au cas où ce serait une version plus ancienne
    const sectionSegments: Record<string, HighlightSegment[]> = {};
    for (const ch of parsed.data.chapters) {
      if (!ch.segments) continue;
      for (const seg of ch.segments) {
        if (!seg.sectionId) continue;
        if (!sectionSegments[seg.sectionId]) sectionSegments[seg.sectionId] = [];
        sectionSegments[seg.sectionId].push(seg);
      }
    }
    parsed.data.sectionSegments = sectionSegments;
    return parsed.data as HighlightsData;
  } catch {
    return null;
  }
}

export async function clearHighlightsCache(bookId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(HIGHLIGHT_KEY(bookId));
  } catch {}
}

const MANIFEST_KEY = (bookId: string) => `@epub_manifest_${bookId}`;

export async function cacheManifest(
  bookId     : string,
  manifest   : EpubManifest,
  fileBaseUrl: string
): Promise<void> {
  try {
    await AsyncStorage.setItem(MANIFEST_KEY(bookId), JSON.stringify({ manifest, fileBaseUrl, cachedAt: Date.now() }));
  } catch (e) {
    if (IS_DEV) console.warn('[EpubDownload] cacheManifest failed:', e);
  }
}

export async function getManifestOffline(
  bookId: string
): Promise<{ manifest: EpubManifest; fileBaseUrl: string } | null> {
  try {
    const raw = await AsyncStorage.getItem(MANIFEST_KEY(bookId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.manifest) return null;
    return { manifest: data.manifest, fileBaseUrl: data.fileBaseUrl || '' };
  } catch {
    return null;
  }
}

export async function clearManifestCache(bookId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(MANIFEST_KEY(bookId));
  } catch {}
}

 
export async function invalidateStaleSections(
  bookId          : string,
  manifestGeneratedAt: string
): Promise<void> {
  try {
    const versionKey = `@epub_manifest_version_${bookId}`;
    const stored     = await AsyncStorage.getItem(versionKey);

    if (stored !== manifestGeneratedAt) {
      // Version différente → purger les sections SQLite
      const db = await getDBConnection();
      await db.runAsync('DELETE FROM epub_sections WHERE book_id = ?', [bookId]);
      await AsyncStorage.setItem(versionKey, manifestGeneratedAt);
      if (IS_DEV) console.log(`[EpubDownload] Stale sections purged for ${bookId}`);
    }
  } catch (e) {
    if (IS_DEV) console.warn('[EpubDownload] invalidateStaleSections failed:', e);
  }
}


export function buildAudioDownloadUrl(
  fileBaseUrl: string,
  bookId     : string,
  audioFile  : string,
  token      : string
): string {
  // Guard against double-replace: if fileBaseUrl already uses webservice/pluginfile.php
  // (returned by updated PHP plugin), the naive replace would produce
  // /webservice/webservice/pluginfile.php. Check first.
  const base = fileBaseUrl.includes('/webservice/pluginfile.php/')
    ? fileBaseUrl
    : fileBaseUrl.replace('/pluginfile.php/', '/webservice/pluginfile.php/');
  const clean = audioFile.replace(/^\//, '');
  return `${base}/${bookId}/${clean}?token=${encodeURIComponent(token)}`;
}

export async function downloadAudioFile(
  bookId     : string,
  audioFile  : string,
  fileBaseUrl: string,
  token      : string
): Promise<string | null> {
  const filename  = audioFile.replace(/\//g, '_').replace(/^_/, '');
  const localPath = `${FileSystem.documentDirectory}epub/${bookId}/audio/${filename}`;

  try {
    const info = await FileSystem.getInfoAsync(localPath);
    if (info.exists) return localPath; // déjà téléchargé

    const dir = localPath.substring(0, localPath.lastIndexOf('/'));
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

    const url = buildAudioDownloadUrl(fileBaseUrl, bookId, audioFile, token);
    const result = await FileSystem.downloadAsync(url, localPath);

    if (result.status !== 200) {
      await FileSystem.deleteAsync(localPath, { idempotent: true });
      return null;
    }

    if (IS_DEV) console.log(`[EpubDownload] Audio saved: ${filename}`);
    return localPath;
  } catch (e) {
    if (IS_DEV) console.warn(`[EpubDownload] Audio download failed: ${filename}`, e);
    return null;
  }
}

 
export async function getLocalAudioPath(
  bookId   : string,
  audioFile: string
): Promise<string | null> {
  try {
    const filename  = audioFile.replace(/\//g, '_').replace(/^_/, '');
    const localPath = `${FileSystem.documentDirectory}epub/${bookId}/audio/${filename}`;
    const info      = await FileSystem.getInfoAsync(localPath);
    return info.exists ? localPath : null;
  } catch {
    return null;
  }
}

 
async function isSectionCached(bookId: string, sectionIndex: number): Promise<boolean> {
  try {
    const db  = await getDBConnection();
    const row = await db.getFirstAsync<{ downloaded_at: number }>(
      'SELECT downloaded_at FROM epub_sections WHERE book_id = ? AND section_index = ? AND html_page != ""',
      [bookId, sectionIndex]
    );
    return !!row?.downloaded_at;
  } catch {
    return false;
  }
}

async function cacheSectionToSQLite(
  bookId      : string,
  sectionIndex: number,
  sectionId   : string,
  audioFiles  : string[],
  textContent : string,
  htmlPage    : string
): Promise<void> {
  const db = await getDBConnection();
  await db.runAsync(
    `INSERT OR REPLACE INTO epub_sections
       (book_id, section_index, section_id, audio_files, text_content, html_page, downloaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [bookId, sectionIndex, sectionId, JSON.stringify(audioFiles), textContent, htmlPage, Date.now()]
  );
}

 
export async function clearBookDownloads(bookId: string): Promise<void> {
  try {
    const db = await getDBConnection();
    await db.runAsync('DELETE FROM epub_sections WHERE book_id = ?', [bookId]);

    const audioDir = `${FileSystem.documentDirectory}epub/${bookId}`;
    const info     = await FileSystem.getInfoAsync(audioDir);
    if (info.exists) {
      await FileSystem.deleteAsync(audioDir, { idempotent: true });
    }

    await clearManifestCache(bookId);
    await AsyncStorage.removeItem(`@epub_manifest_version_${bookId}`);

    if (IS_DEV) console.log(`[EpubDownload] All downloads cleared for ${bookId}`);
  } catch (e) {
    if (IS_DEV) console.warn('[EpubDownload] clearBookDownloads failed:', e);
  }
}

 
function sleepAbortable(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
    const id = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(id);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}
