// services/epub/epubServerService.ts
// ─────────────────────────────────────────────────────────────────────────────
// Client EPUB — deux modes de fonctionnement :
//
// Mode A — Moodle WS (plugin PHP local_ipelan_epub) :
//   fetchManifestMoodle(cmid, token)               → manifest via moodleCall()
//   fetchSectionHtmlMoodle(cmid, idx, token)       → HTML section via moodleCall()
//   fetchStatusMoodle(cmid, token)                 → statut de traitement
//
// Mode B — Serveur Node.js intermédiaire (EpubPlugin, rétrocompat) :
//   fetchManifest(bookId)                          → GET /epub/:bookId/manifest
//   getSectionPageUrl(bookId, idx)                 → URL section HTML
//   getFileUrl(bookId, path)                       → URL fichier
//
// bookId = "cmid-{N}" — N = cmid du module Moodle
// ─────────────────────────────────────────────────────────────────────────────

import { moodleCall } from '../api/moodleClient';

const IS_DEV = process.env.NODE_ENV === 'development';

// URL du serveur EPUB — configurée dans .env
export const EPUB_SERVER_URL = (process.env.EXPO_PUBLIC_EPUB_SERVER_URL || '').replace(/\/$/, '');

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface EpubWordTiming {
  word: string;
  start: number;  // secondes depuis le début du fichier audio
  end: number;
}

export interface EpubReadingSection {
  id: string;           // "p21" — id de la div dans le XHTML
  pageNumber: number | null;
  text: string;
  audioFiles: string[]; // ["OEBPS/Audio/21.opus"] — relatif à la racine EPUB
  images: string[];     // ["OEBPS/Images/21.png"]
  hasAudio: boolean;
  // wordTimings : présent si Whisper est activé côté serveur
  // clé = nom de fichier relatif (ex: "OEBPS/Audio/21.opus")
  // valeur = [{word, start, end}] dans l'ordre de la transcription
  wordTimings?: Record<string, EpubWordTiming[]>;
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
  totalSections: number;
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
// fetchAlignment()
// Forced alignment via WhisperX : donne le texte exact EPUB + audio
// → retourne les timestamps mot-par-mot précis.
//
// Appelé en arrière-plan par epub-reader après chaque changement de section.
// Les résultats sont injectés dans la WebView via window.__ipelanSetTimings().
//
// @param bookId    "cmid-783"
// @param audioFile "OEBPS/Audio/10.opus" (relatif à la racine EPUB)
// @param text      Texte brut de la section (section.text du manifest)
// @param lang      Code langue pour le modèle d'alignement (défaut: 'fr')
// @returns [{word, start, end, score}] ou [] si indisponible
// ─────────────────────────────────────────────────────────────

export async function fetchAlignment(
  bookId  : string,
  audioFile: string,
  text     : string,
  lang     = 'fr'
): Promise<EpubWordTiming[]> {
  if (!EPUB_SERVER_URL || !text.trim()) return [];
  try {
    const res = await fetch(`${EPUB_SERVER_URL}/epub/${bookId}/align`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ audioFile, text, lang }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.words || []) as EpubWordTiming[];
  } catch {
    return [];
  }
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
// getSectionPageUrl()
// URL de la page HTML d'une section individuelle.
// Utilisée comme source={{ uri }} dans la WebView pour le lazy loading.
//
// @param bookId       "cmid-42"
// @param sectionIndex index 0-based de la section
// @param inlineCss    true → CSS inliné (pour cache offline)
// ─────────────────────────────────────────────────────────────

export function getSectionPageUrl(
  bookId: string,
  sectionIndex: number,
  inlineCss = false
): string {
  const base = `${EPUB_SERVER_URL}/epub/${bookId}/sections/${sectionIndex}/html`;
  return inlineCss ? `${base}?inline_css=1` : base;
}

// ─────────────────────────────────────────────────────────────
// EpubSectionData — métadonnées JSON d'une section
// Retournées par GET /epub/:bookId/sections/:index
// ─────────────────────────────────────────────────────────────

export interface EpubSectionData {
  index: number;
  id: string;
  pageNumber: number | null;
  audioFiles: string[];
  images: string[];
  text: string;
  lines: string[];
  hasNext: boolean;
  hasPrev: boolean;
  totalSections: number;
}

// ─────────────────────────────────────────────────────────────
// fetchSectionData()
// Récupère les métadonnées JSON d'une section (sans HTML).
// Utilisé pour pré-charger les infos de la section suivante
// et pour la mise en cache offline dans SQLite.
// ─────────────────────────────────────────────────────────────

export async function fetchSectionData(
  bookId: string,
  sectionIndex: number
): Promise<EpubSectionData> {
  if (!EPUB_SERVER_URL) throw new Error('EPUB_SERVER_URL non configuré');
  const res = await fetch(`${EPUB_SERVER_URL}/epub/${bookId}/sections/${sectionIndex}`);
  if (!res.ok) {
    throw new Error(`Section ${sectionIndex} introuvable dans ${bookId} (${res.status})`);
  }
  return res.json() as Promise<EpubSectionData>;
}

// ─────────────────────────────────────────────────────────────
// buildBookId()
// Convertir un cmid Moodle en bookId utilisé par le serveur
// ─────────────────────────────────────────────────────────────

export function buildBookId(cmid: number | string): string {
  return `cmid-${cmid}`;
}

// ═════════════════════════════════════════════════════════════
// MODE A — Moodle Web Services (plugin PHP local_ipelan_epub)
// Ces fonctions appellent moodleCall() directement — pas de
// serveur intermédiaire Node.js requis.
// ═════════════════════════════════════════════════════════════

/**
 * Récupère le manifest depuis le plugin PHP via Moodle WS.
 * Poll automatiquement si le traitement est en cours.
 *
 * @param cmid  Course Module ID de la ressource EPUB
 * @param token wstoken Moodle de l'utilisateur
 */
export async function fetchManifestMoodle(
  cmid    : number,
  token   : string,
  options : { timeoutMs?: number; pollIntervalMs?: number; onProcessing?: () => void } = {}
): Promise<{ manifest: EpubManifest; fileBaseUrl: string }> {
  const { timeoutMs = 10 * 60 * 1000, pollIntervalMs = 3000, onProcessing } = options;
  const deadline = Date.now() + timeoutMs;
  let notifiedProcessing = false;

  while (Date.now() < deadline) {
    const data = await moodleCall('local_ipelan_epub_get_manifest', { cmid }, token) as any;

    if (data.exception) throw new Error(data.message || data.exception);

    if (data.status === 'ready' && data.manifest) {
      const manifest: EpubManifest = JSON.parse(data.manifest);
      if (IS_DEV) console.log(`[EpubWS] Manifest ready: ${manifest.metadata?.title} (${manifest.readingSections?.length} sections)`);
      return { manifest, fileBaseUrl: data.file_base_url || '' };
    }

    if (data.status === 'processing') {
      if (!notifiedProcessing) { onProcessing?.(); notifiedProcessing = true; }
      await sleep(pollIntervalMs);
      continue;
    }

    if (data.status === 'error') throw new Error(data.error || 'EPUB processing failed');

    throw new Error(`Unexpected manifest status: ${data.status}`);
  }

  throw new Error('[EpubWS] Timeout waiting for EPUB manifest');
}

/**
 * Récupère le HTML complet d'une section via Moodle WS.
 * Utilisé pour le lazy loading et le prefetch offline.
 *
 * @param cmid          Course Module ID
 * @param sectionIndex  Index 0-based de la section
 * @param token         wstoken Moodle
 * @param inlineCss     true → CSS inliné pour usage offline
 */
export async function fetchSectionHtmlMoodle(
  cmid         : number,
  sectionIndex : number,
  token        : string,
  inlineCss    = false
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

/**
 * Récupère le statut de traitement depuis le plugin PHP.
 */
export async function fetchStatusMoodle(
  cmid : number,
  token: string
): Promise<{ status: 'not_found' | 'processing' | 'ready' | 'error'; totalSections: number }> {
  try {
    const data = await moodleCall('local_ipelan_epub_get_status', { cmid }, token) as any;
    if (data.exception) return { status: 'not_found', totalSections: 0 };
    return { status: data.status || 'not_found', totalSections: data.total_sections || 0 };
  } catch {
    return { status: 'not_found', totalSections: 0 };
  }
}

// ─────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
