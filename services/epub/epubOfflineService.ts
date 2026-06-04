// services/epub/epubOfflineService.ts
// ─────────────────────────────────────────────────────────────────────────────
// Cache offline des sections EPUB.
//
// Architecture :
//   • Métadonnées + HTML page → SQLite (table epub_sections)
//   • Fichiers audio          → expo-filesystem (cache persistent)
//
// Flux :
//   1. Online  : WebView charge via URI serveur → section lue → cachée en SQLite
//   2. Offline : SQLite retourne le html_page → WebView via source={{ html }}
//
// Pour que le CSS et les images fonctionnent offline, le html_page est mis en
// cache avec ?inline_css=1 (CSS inliné) ce qui assure un affichage fidèle
// même sans réseau. Audio non disponible offline (nécessite un serveur local).
// ─────────────────────────────────────────────────────────────────────────────

import * as FileSystem from 'expo-file-system/legacy';
import { getDBConnection } from '../storage/db-service';
import { getSectionPageUrl, EPUB_SERVER_URL } from './epubServerService';

const IS_DEV = process.env.NODE_ENV === 'development';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface CachedSectionData {
  bookId       : string;
  sectionIndex : number;
  sectionId    : string;
  audioFiles   : string[];
  textContent  : string;
  htmlPage     : string;   // HTML complet (CSS inliné) pour offline WebView
}

// ─────────────────────────────────────────────────────────────
// getSectionOffline()
// Lit une section depuis SQLite. Retourne null si pas encore cachée.
// ─────────────────────────────────────────────────────────────

export async function getSectionOffline(
  bookId: string,
  sectionIndex: number
): Promise<CachedSectionData | null> {
  try {
    const db  = await getDBConnection();
    const row = await db.getFirstAsync<{
      section_id  : string;
      audio_files : string;
      text_content: string;
      html_page   : string;
    }>(
      'SELECT section_id, audio_files, text_content, html_page FROM epub_sections WHERE book_id = ? AND section_index = ?',
      [bookId, sectionIndex]
    );
    if (!row || !row.html_page) return null;

    return {
      bookId,
      sectionIndex,
      sectionId  : row.section_id   || '',
      audioFiles : JSON.parse(row.audio_files  || '[]'),
      textContent: row.text_content || '',
      htmlPage   : row.html_page,
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// cacheSectionOffline()
// Sauvegarde une section en SQLite. Idempotent (INSERT OR REPLACE).
// Appelé automatiquement par prefetchSectionHtml() et par epub-reader
// après chaque chargement de section réussi.
// ─────────────────────────────────────────────────────────────

export async function cacheSectionOffline(
  bookId      : string,
  sectionIndex: number,
  sectionId   : string,
  audioFiles  : string[],
  textContent : string,
  htmlPage    : string
): Promise<void> {
  try {
    const db = await getDBConnection();
    await db.runAsync(
      `INSERT OR REPLACE INTO epub_sections
         (book_id, section_index, section_id, audio_files, text_content, html_page, downloaded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [bookId, sectionIndex, sectionId, JSON.stringify(audioFiles), textContent, htmlPage, Date.now()]
    );
    if (IS_DEV) console.log(`[epubOffline] Section ${sectionIndex} of ${bookId} cached`);
  } catch (e) {
    if (IS_DEV) console.warn('[epubOffline] cacheSectionOffline failed:', e);
  }
}

// ─────────────────────────────────────────────────────────────
// prefetchSectionHtml()
// Télécharge le HTML d'une section avec CSS inliné et le stocke
// dans SQLite pour usage offline. Silencieux — n'interrompt pas l'UI.
//
// @param bookId        identifiant du livre
// @param sectionIndex  index de la section à pré-charger
// @param sectionId     id DOM (ex: "p21")
// @param audioFiles    liste des fichiers audio de la section
// @param textContent   texte brut de la section
// ─────────────────────────────────────────────────────────────

export async function prefetchSectionHtml(
  bookId      : string,
  sectionIndex: number,
  sectionId   : string,
  audioFiles  : string[],
  textContent : string
): Promise<void> {
  try {
    // Vérifier si déjà en cache
    const db  = await getDBConnection();
    const row = await db.getFirstAsync<{ downloaded_at: number }>(
      'SELECT downloaded_at FROM epub_sections WHERE book_id = ? AND section_index = ?',
      [bookId, sectionIndex]
    );
    if (row?.downloaded_at) return; // déjà mis en cache

    // Télécharger avec CSS inliné pour offline
    const url = getSectionPageUrl(bookId, sectionIndex, true); // inline_css=1
    const res = await fetch(url);
    if (!res.ok) return;

    const html = await res.text();
    await cacheSectionOffline(bookId, sectionIndex, sectionId, audioFiles, textContent, html);
  } catch (e) {
    if (IS_DEV) console.warn(`[epubOffline] prefetchSectionHtml ${sectionIndex} failed:`, e);
  }
}

// ─────────────────────────────────────────────────────────────
// isBookFullyOffline()
// Vérifie si toutes les sections d'un livre sont dans SQLite.
// ─────────────────────────────────────────────────────────────

export async function isBookFullyOffline(
  bookId       : string,
  totalSections: number
): Promise<boolean> {
  try {
    const db  = await getDBConnection();
    const row = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM epub_sections WHERE book_id = ? AND html_page != ""',
      [bookId]
    );
    return (row?.count ?? 0) >= totalSections;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// getLocalAudioPath()
// Chemin local d'un fichier audio téléchargé (expo-filesystem).
// Retourne null si le fichier n'est pas encore téléchargé.
// ─────────────────────────────────────────────────────────────

export async function getLocalAudioPath(
  bookId   : string,
  audioFile: string
): Promise<string | null> {
  try {
    const filename  = audioFile.replace(/\//g, '_').replace(/^_/, '');
    const localPath = `${FileSystem.cacheDirectory}epub/${bookId}/audio/${filename}`;
    const info      = await FileSystem.getInfoAsync(localPath);
    return info.exists ? localPath : null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// downloadAudioForSection()
// Télécharge les fichiers audio d'une section dans expo-filesystem.
// Silencieux — à appeler en arrière-plan quand le réseau est disponible.
// ─────────────────────────────────────────────────────────────

export async function downloadAudioForSection(
  bookId    : string,
  audioFiles: string[],
  getAudioUrl: (file: string) => string
): Promise<void> {
  for (const audioFile of audioFiles) {
    const filename  = audioFile.replace(/\//g, '_').replace(/^_/, '');
    const localPath = `${FileSystem.cacheDirectory}epub/${bookId}/audio/${filename}`;

    try {
      const info = await FileSystem.getInfoAsync(localPath);
      if (info.exists) continue;

      const dir = localPath.substring(0, localPath.lastIndexOf('/'));
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

      const url = getAudioUrl(audioFile);
      await FileSystem.downloadAsync(url, localPath);
      if (IS_DEV) console.log(`[epubOffline] Audio downloaded: ${filename}`);
    } catch (e) {
      if (IS_DEV) console.warn(`[epubOffline] Audio download failed: ${filename}`, e);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// clearBookOfflineCache()
// Supprime le cache SQLite et les fichiers audio d'un livre.
// ─────────────────────────────────────────────────────────────

export async function clearBookOfflineCache(bookId: string): Promise<void> {
  try {
    const db = await getDBConnection();
    await db.runAsync('DELETE FROM epub_sections WHERE book_id = ?', [bookId]);

    const audioDir = `${FileSystem.cacheDirectory}epub/${bookId}`;
    const info     = await FileSystem.getInfoAsync(audioDir);
    if (info.exists) {
      await FileSystem.deleteAsync(audioDir, { idempotent: true });
    }
    if (IS_DEV) console.log(`[epubOffline] Cache cleared for ${bookId}`);
  } catch (e) {
    if (IS_DEV) console.warn('[epubOffline] clearBookOfflineCache failed:', e);
  }
}
