// services/epub/epubServerService.ts
// ─────────────────────────────────────────────────────────────────────────────
// Client pour le serveur EPUB intermédiaire (Node.js plugin EpubPlugin).
// Ce serveur traite les EPUBs côté serveur et expose l'API suivante :
//   GET /epub/:bookId/manifest     → manifest + readingSections
//   GET /epub/:bookId/status       → état du traitement
//   GET /epub/:bookId/sections     → sections légères
//   GET /epub/:bookId/file/*       → fichiers (audio, images, HTML)
//   GET /moodle/catalog            → catalogue IPELAN
//
// bookId = "cmid-{N}" — N = cmid du module Moodle
// ─────────────────────────────────────────────────────────────────────────────

const IS_DEV = process.env.NODE_ENV === 'development';

// URL du serveur EPUB — configurée dans .env
export const EPUB_SERVER_URL = (process.env.EXPO_PUBLIC_EPUB_SERVER_URL || '').replace(/\/$/, '');

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface EpubReadingSection {
  id: string;           // "p21" — id de la div dans le XHTML
  pageNumber: number | null;
  text: string;
  audioFiles: string[]; // ["OEBPS/Audio/21.opus"] — relatif à la racine EPUB
  images: string[];     // ["OEBPS/Images/21.png"]
  hasAudio: boolean;
}

export interface EpubSpineItem {
  index: number;
  id: string;
  href: string;         // "OEBPS/Text/book.xhtml"
  hasAudio: boolean;
  timing: null;         // SMIL timing (null pour les EPUBs actuels)
  separateAudio: null;
}

export interface EpubManifest {
  bookId: string;             // "cmid-42"
  version: string;
  generatedAt: string;
  epubType: 'locuteur' | 'non-locuteur' | 'math' | 'cahier' | 'unknown';
  language: 'pulaar' | 'wolof' | 'soninke' | null;
  grade: number | null;
  metadata: { title?: string; author?: string };
  spine: EpubSpineItem[];
  totalChapters: number;
  hasAudio: boolean;
  audioType: 'embedded-html' | 'synchronized' | 'separate' | 'none';
  readingSections: EpubReadingSection[];
  embeddedAudioFiles: string[];
}

export interface EpubCatalogBook {
  bookType: string;
  cmid: number;
  bookId: string;
  manifest: string;
  name: string;
  sectionName: string;
  courseName: string;
  courseId: number;
  epubName: string;
  filesize: number;
}

export interface EpubCatalog {
  totalBooks: number;
  languages: string[];
  catalog: Record<string, Record<string, { grade: number; books: EpubCatalogBook[] }>>;
}

// ─────────────────────────────────────────────────────────────
// fetchManifest()
// Récupère le manifest du livre. Si traitement en cours → poll jusqu'à prêt.
// ─────────────────────────────────────────────────────────────

export async function fetchManifest(
  bookId: string,
  options: {
    timeoutMs?: number;
    pollIntervalMs?: number;
    onProcessing?: () => void;  // appelé quand le serveur traite (202)
    epubUrl?: string;           // URL Moodle du fichier EPUB (pluginfile.php)
  } = {}
): Promise<EpubManifest> {
  const { timeoutMs = 10 * 60 * 1000, pollIntervalMs = 2000, onProcessing } = options;
  const deadline = Date.now() + timeoutMs;

  if (!EPUB_SERVER_URL) {
    throw new Error('EPUB_SERVER_URL not configured (EXPO_PUBLIC_EPUB_SERVER_URL manquant dans .env)');
  }

  if (IS_DEV) console.log('[EpubServer] fetchManifest:', bookId);

  let notifiedProcessing = false;

  while (Date.now() < deadline) {
    const manifestUrl = options.epubUrl
      ? `${EPUB_SERVER_URL}/epub/${bookId}/manifest?epubUrl=${encodeURIComponent(options.epubUrl)}`
      : `${EPUB_SERVER_URL}/epub/${bookId}/manifest`;
    const res = await fetch(manifestUrl);

    if (res.status === 200) {
      const manifest: EpubManifest = await res.json();
      if (IS_DEV) console.log(`[EpubServer] Manifest ready: ${manifest.metadata.title} (${manifest.readingSections.length} sections)`);
      return manifest;
    }

    if (res.status === 202) {
      // Traitement en cours — notifier une seule fois puis attendre
      if (!notifiedProcessing && onProcessing) {
        onProcessing();
        notifiedProcessing = true;
      }
      if (IS_DEV) console.log('[EpubServer] Processing... polling again in', pollIntervalMs, 'ms');
      await sleep(pollIntervalMs);
      continue;
    }

    // Erreur réelle
    let errorMsg = `Server error ${res.status}`;
    try {
      const body = await res.json();
      errorMsg = body.message || body.error || errorMsg;
    } catch {}
    throw new Error(`[EpubServer] fetchManifest failed: ${errorMsg}`);
  }

  throw new Error('[EpubServer] Timeout: le traitement EPUB prend trop de temps');
}

// ─────────────────────────────────────────────────────────────
// fetchStatus()
// État rapide du traitement (non bloquant)
// ─────────────────────────────────────────────────────────────

export async function fetchStatus(bookId: string): Promise<{ status: 'ready' | 'processing' | 'not_found' }> {
  if (!EPUB_SERVER_URL) return { status: 'not_found' };
  const res = await fetch(`${EPUB_SERVER_URL}/epub/${bookId}/status`);
  const data = await res.json();
  return data;
}

// ─────────────────────────────────────────────────────────────
// getFileUrl()
// Construit l'URL complète d'un fichier EPUB (audio, image, HTML)
//
// @param bookId    "cmid-42"
// @param filePath  "OEBPS/Audio/21.opus"  (relatif à la racine EPUB)
// @returns         "http://192.168.0.193:3001/epub/cmid-42/file/OEBPS/Audio/21.opus"
// ─────────────────────────────────────────────────────────────

export function getFileUrl(bookId: string, filePath: string): string {
  const cleanPath = filePath.replace(/^\//, '');
  return `${EPUB_SERVER_URL}/epub/${bookId}/file/${cleanPath}`;
}

// ─────────────────────────────────────────────────────────────
// getMainHtmlUrl()
// URL du fichier XHTML principal du livre à charger dans le WebView
// L'EPUB IPELAN a tout le contenu dans un seul fichier XHTML.
// ─────────────────────────────────────────────────────────────

export function getMainHtmlUrl(bookId: string, manifest: EpubManifest): string {
  // Le spine pointe vers le(s) fichier(s) XHTML
  // Trouver le premier fichier qui n'est pas nav.xhtml
  const mainChapter = manifest.spine.find(s =>
    !s.href.includes('nav.xhtml') && !s.href.includes('toc.')
  );
  if (mainChapter) {
    return getFileUrl(bookId, mainChapter.href);
  }
  // Fallback — chemin conventionnel des EPUBs IPELAN
  return getFileUrl(bookId, 'OEBPS/Text/book.xhtml');
}

// ─────────────────────────────────────────────────────────────
// findSectionByAudioFile()
// Trouver la section active depuis un chemin de fichier audio
//
// @param sections      readingSections du manifest
// @param audioFilePath ex: "OEBPS/Audio/21.opus"
// ─────────────────────────────────────────────────────────────

export function findSectionByAudioFile(
  sections: EpubReadingSection[],
  audioFilePath: string
): EpubReadingSection | null {
  const normalizedPath = audioFilePath.replace(/\\/g, '/');
  return sections.find(s =>
    s.audioFiles.some(af => af.replace(/\\/g, '/') === normalizedPath)
  ) || null;
}

// ─────────────────────────────────────────────────────────────
// fetchCatalog()
// Catalogue IPELAN complet depuis Moodle (via serveur)
// ─────────────────────────────────────────────────────────────

export async function fetchCatalog(): Promise<EpubCatalog> {
  if (!EPUB_SERVER_URL) {
    throw new Error('EPUB_SERVER_URL not configured');
  }
  const res = await fetch(`${EPUB_SERVER_URL}/moodle/catalog`);
  if (!res.ok) {
    throw new Error(`Catalog fetch failed: ${res.status}`);
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────
// checkServerHealth()
// Vérifier que le serveur EPUB est accessible
// ─────────────────────────────────────────────────────────────

export async function checkServerHealth(): Promise<boolean> {
  if (!EPUB_SERVER_URL) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${EPUB_SERVER_URL}/health`, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// buildBookId()
// Convertir un cmid Moodle en bookId utilisé par le serveur
// ─────────────────────────────────────────────────────────────

export function buildBookId(cmid: number | string): string {
  return `cmid-${cmid}`;
}

// ─────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
